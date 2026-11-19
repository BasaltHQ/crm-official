import { prismadb } from "@/lib/prisma";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { cosineSimilarity } from "@/lib/vector-search";
import { systemLogger } from "@/lib/logger";
import { safeFetch } from "@/lib/security/ssrf-guard";

// ─── Text Extraction ────────────────────────────────────────────────────────

/**
 * Extract text from a document based on MIME type.
 * Supports PDF, DOCX, and plain text formats.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const mime = mimeType.toLowerCase();

  if (mime === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) {
    return extractDocxText(buffer);
  }

  if (mime.startsWith("text/") || mime === "application/json") {
    return buffer.toString("utf-8");
  }

  // CSV / TSV
  if (
    mime === "text/csv" ||
    mime === "text/tab-separated-values" ||
    mime === "application/csv"
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported MIME type for text extraction: ${mimeType}`);
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid bundling issues
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (err: any) {
    systemLogger.warn(`[DOC_RAG] PDF extraction failed: ${err?.message}`);
    return "";
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore — mammoth installed separately: npm install mammoth
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err: any) {
    systemLogger.warn(`[DOC_RAG] DOCX extraction failed: ${err?.message}`);
    return "";
  }
}

// ─── Chunking ────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping chunks of ~500 tokens (~2000 chars).
 * Designed for RAG — each chunk is self-contained enough for retrieval.
 */
export function chunkText(
  text: string,
  maxChars: number = 2000,
  overlap: number = 200
): Array<{ content: string; index: number }> {
  if (!text || text.length === 0) return [];

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, " ").trim();
  const chunks: Array<{ content: string; index: number }> = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    // Try to break at a sentence boundary
    if (end < normalized.length) {
      const lastPeriod = normalized.lastIndexOf(". ", end);
      const lastNewline = normalized.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + maxChars * 0.5) {
        end = breakPoint + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ content: chunk, index });
      index++;
    }

    start = end - overlap;
    if (start >= normalized.length) break;
  }

  return chunks;
}

// ─── Embedding ───────────────────────────────────────────────────────────────

/**
 * Generate embeddings using Amazon Bedrock Nova 2 multimodal embeddings.
 * Falls back to a deterministic hash embedding if Bedrock is unavailable.
 */
export async function generateEmbedding(
  text: string,
  teamId?: string
): Promise<number[]> {
  // Try Bedrock Nova embeddings first
  try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return await bedrockNovaEmbedding(text);
    }
  } catch (err: any) {
    systemLogger.warn(`[DOC_RAG] Bedrock embedding failed, using hash fallback: ${err?.message}`);
  }

  // Fallback: deterministic hash-based embedding
  return hashEmbedding(text, 1024); // Match Nova's dimension for consistency
}

/**
 * Call Amazon Bedrock Nova 2 multimodal embeddings via InvokeModel.
 * Model: amazon.nova-embed-v2:0
 * Output: 1024-dim normalized vector
 */
async function bedrockNovaEmbedding(text: string): Promise<number[]> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import(
    "@aws-sdk/client-bedrock-runtime"
  );

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      ...(process.env.AWS_SESSION_TOKEN &&
        !process.env.AWS_ACCESS_KEY_ID?.startsWith("AKIA") && {
          sessionToken: process.env.AWS_SESSION_TOKEN,
        }),
    },
  });

  // Truncate to Nova's 512 token soft limit (~2048 chars) for optimal quality
  const truncated = text.substring(0, 8192);

  const command = new InvokeModelCommand({
    modelId: "amazon.nova-embed-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: truncated,
      dimensions: 1024,
      normalize: true,
    }),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
    throw new Error("Invalid embedding response from Bedrock Nova");
  }

  return responseBody.embedding as number[];
}

/**
 * Deterministic hash-based embedding (fallback when Bedrock is unavailable).
 * Creates a fixed-dimension vector from n-gram hashing.
 */
function hashEmbedding(text: string, dims: number = 1024): number[] {
  const vec = new Float64Array(dims);
  const words = text.toLowerCase().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Hash each word and its bigrams
    for (let n = 1; n <= 2 && i + n - 1 < words.length; n++) {
      const gram = words.slice(i, i + n).join(" ");
      let hash = 0;
      for (let c = 0; c < gram.length; c++) {
        hash = (hash * 31 + gram.charCodeAt(c)) | 0;
      }
      const idx = Math.abs(hash) % dims;
      vec[idx] += 1.0 / Math.sqrt(n);
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const result: number[] = new Array(dims);
  for (let i = 0; i < dims; i++) result[i] = vec[i] / norm;

  return result;
}

// ─── Full Ingestion Pipeline ─────────────────────────────────────────────────

/**
 * Ingest a document: fetch from S3, extract text, chunk, embed, store.
 * Idempotent — clears existing chunks for the document before re-ingesting.
 */
export async function ingestDocument(
  documentId: string,
  teamId?: string
): Promise<{ chunksCreated: number; textLength: number }> {
  // Fetch document metadata
  const doc = await prismadb.documents.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      document_name: true,
      document_file_url: true,
      document_file_mimeType: true,
      key: true,
      team_id: true,
    },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);
  if (teamId && doc.team_id && doc.team_id !== teamId) {
    throw new Error("Forbidden: Document belongs to another team");
  }

  systemLogger.info(
    `[DOC_RAG] Ingesting: "${doc.document_name}" (${doc.document_file_mimeType})`
  );

  // Fetch file from S3
  const blobClient = getBlobServiceClient();
  let fileBuffer: Buffer;

  if (doc.key) {
    // Use presigned URL to fetch
    const presignedUrl = await blobClient.getPresignedUrl(doc.key);
    const response = await safeFetch(presignedUrl);
    if (!response.ok) throw new Error(`Failed to fetch document from S3: ${response.status}`);
    fileBuffer = Buffer.from(await response.arrayBuffer());
  } else if (doc.document_file_url) {
    const response = await safeFetch(doc.document_file_url);
    if (!response.ok) throw new Error(`Failed to fetch document URL: ${response.status}`);
    fileBuffer = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("Document has no file URL or S3 key");
  }

  // Extract text
  const fullText = await extractText(fileBuffer, doc.document_file_mimeType);
  if (!fullText || fullText.trim().length === 0) {
    systemLogger.warn(`[DOC_RAG] No text extracted from "${doc.document_name}"`);
    return { chunksCreated: 0, textLength: 0 };
  }

  // Chunk
  const chunks = chunkText(fullText);

  // Clear existing chunks for this document (idempotent)
  await prismadb.crm_Document_Chunks.deleteMany({
    where: { document_id: documentId },
  });

  // Embed and store each chunk
  let created = 0;
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(
      chunk.content,
      doc.team_id || teamId
    );

    await prismadb.crm_Document_Chunks.create({
      data: {
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding,
        metadata: {
          documentName: doc.document_name,
          totalChunks: chunks.length,
        } as any,
        team_id: doc.team_id || teamId,
      },
    });
    created++;
  }

  systemLogger.info(
    `[DOC_RAG] Ingested "${doc.document_name}": ${created} chunks, ${fullText.length} chars`
  );

  return { chunksCreated: created, textLength: fullText.length };
}

// ─── Semantic Search ─────────────────────────────────────────────────────────

/**
 * Search for relevant document chunks using semantic similarity.
 * Scoped to specific documents (by IDs) or an entire team.
 */
export async function searchDocuments(
  query: string,
  options: {
    documentIds?: string[];
    teamId?: string;
    topK?: number;
    minScore?: number;
  }
): Promise<
  Array<{
    content: string;
    score: number;
    documentId: string;
    documentName: string;
    chunkIndex: number;
  }>
> {
  const { documentIds, teamId, topK = 5, minScore = 0.1 } = options;

  // Build filter — always enforce team_id when provided, even alongside documentIds
  const where: any = {};
  if (teamId) {
    where.team_id = teamId;
  }
  if (documentIds && documentIds.length > 0) {
    where.document_id = { in: documentIds };
  }
  if (!where.team_id && !where.document_id) {
    return [];
  }

  // Fetch all relevant chunks
  const chunks = await prismadb.crm_Document_Chunks.findMany({
    where,
    select: {
      id: true,
      document_id: true,
      chunk_index: true,
      content: true,
      embedding: true,
      metadata: true,
    },
  });

  if (chunks.length === 0) return [];

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query, teamId);

  // Score all chunks
  const scored = chunks
    .map((chunk: any) => ({
      content: chunk.content as string,
      score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
      documentId: chunk.document_id as string,
      documentName: (chunk.metadata as any)?.documentName || "Unknown",
      chunkIndex: chunk.chunk_index as number,
    }))
    .filter((c: any) => c.score >= minScore)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
