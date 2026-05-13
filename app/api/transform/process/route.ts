import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import pdfParse from "pdf-parse";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import * as ExcelJS from "exceljs";
import { prismadb } from "@/lib/prisma";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const maxDuration = 300; // 5 mins

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

// Initialize S3 Client
const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-west-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
    }
});
const S3_BUCKET = process.env.AWS_TEXTRACT_BUCKET_NAME || "basalt-lens-textract-jobs-7c87e486796f";

async function processJobInBackground(
    jobId: string, 
    buffer: Buffer, 
    fileType: string, 
    fileName: string, 
    type: string, 
    saveHistory: boolean, 
    userId: string | null, 
    teamId: string | null, 
    numPages: number, 
    extractedText: string, 
    isImage: boolean, 
    ip: string
) {
    try {
        await (prismadb as any).crm_Transform_Jobs.update({
            where: { id: jobId },
            data: { status: "PROCESSING", progress: 10 }
        });

        // --- Model Execution ---
        const { model, modelId } = await getAiSdkModel("system", "pdf_wizard", isImage);
        
        let resultBuffer: Buffer;
        let mimeType = "text/plain";
        let extension = ".txt";
        let cost = numPages * (type === "EXCEL" ? 0.25 : type === "TEXT" ? 0.01 : 0.02);

        // We prepare the content array. If it's an image, pass the image data. If PDF, pass extracted text.
        const contentPayload: any[] = [];
        if (isImage) {
            contentPayload.push({
                type: "image" as const,
                image: buffer,
            });
        } else {
            contentPayload.push({
                type: "text",
                text: `Document Content:\n\n${extractedText.substring(0, 80000)}`
            });
        }

        if (type === "EXCEL" && !isImage) {
            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 20 } });
            
            // ── AWS Textract Async Batch API (Bypassing LLM for deterministic multi-page table extraction) ──
            const { TextractClient, StartDocumentAnalysisCommand, GetDocumentAnalysisCommand } = require("@aws-sdk/client-textract");
            const textract = new TextractClient({
                region: process.env.AWS_REGION || "us-west-2",
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                },
            });

            const s3Key = `transform_jobs/${jobId}.pdf`;
            
            // 1. Upload PDF to S3
            await s3.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: buffer,
                ContentType: "application/pdf"
            }));

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 30 } });

            // 2. Start Async Analysis
            const startRes = await textract.send(new StartDocumentAnalysisCommand({
                DocumentLocation: { S3Object: { Bucket: S3_BUCKET, Name: s3Key } },
                FeatureTypes: ["TABLES"]
            }));
            const textractJobId = startRes.JobId;

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 40 } });

            // 3. Poll for Completion
            let jobStatus = "IN_PROGRESS";
            while (jobStatus === "IN_PROGRESS" || jobStatus === "PARTIAL_SUCCESS") {
                await new Promise(resolve => setTimeout(resolve, 5000));
                const statusRes = await textract.send(new GetDocumentAnalysisCommand({ JobId: textractJobId }));
                jobStatus = statusRes.JobStatus;
                if (jobStatus === "FAILED") {
                    throw new Error("AWS Textract Analysis Failed: " + statusRes.StatusMessage);
                }
            }

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 75 } });

            // 4. Fetch Paginated Results
            let allBlocks: any[] = [];
            let nextToken = undefined;
            do {
                const pageRes: any = await textract.send(new GetDocumentAnalysisCommand({ JobId: textractJobId, NextToken: nextToken }));
                if (pageRes.Blocks) allBlocks.push(...pageRes.Blocks);
                nextToken = pageRes.NextToken;
            } while (nextToken);

            // 5. Parse Tables and Consolidate
            const blockMap: Record<string, any> = {};
            allBlocks.forEach(b => { if (b.Id) blockMap[b.Id] = b; });

            const getBlockText = (block: any): string => {
                if (!block?.Relationships) return block?.Text || "";
                const childRel = block.Relationships.find((r: any) => r.Type === "CHILD");
                if (!childRel?.Ids) return block?.Text || "";
                return childRel.Ids.map((id: string) => blockMap[id]?.Text || "").filter(Boolean).join(" ");
            }

            const tableBlocks = allBlocks.filter((b: any) => b.BlockType === "TABLE");
            
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Consolidated Data");

            let currentRowOffset = 0;
            let previousTableHeaders: string[] = [];

            for (const table of tableBlocks) {
                const cellRel = table.Relationships?.find((r: any) => r.Type === "CHILD");
                if (cellRel?.Ids) {
                    const cells = cellRel.Ids.map((id: string) => blockMap[id]).filter(Boolean);
                    
                    let maxRow = 0;
                    let maxCol = 0;
                    const cellGrid: Record<string, string> = {};

                    cells.forEach((cell: any) => {
                        if (cell.BlockType === "CELL") {
                            const r = cell.RowIndex || 0;
                            const c = cell.ColumnIndex || 0;
                            maxRow = Math.max(maxRow, r);
                            maxCol = Math.max(maxCol, c);
                            cellGrid[`${r}_${c}`] = getBlockText(cell).trim();
                        }
                    });

                    // Extract current table headers (Row 1)
                    const currentHeaders: string[] = [];
                    for (let c = 1; c <= maxCol; c++) {
                        currentHeaders.push(cellGrid[`1_${c}`] || "");
                    }

                    // AI Continuation Check
                    let isContinuation = false;
                    let isRepeatedHeader = false;

                    if (currentRowOffset > 0) {
                        try {
                            const { object } = await generateObject({
                                model,
                                schema: z.object({
                                    isContinuation: z.boolean().describe("True if this new table is actually just a continuation of the previous table's data across a page break."),
                                    isRepeatedHeader: z.boolean().describe("True if the first row of this new table is exactly repeating the column headers of the previous table.")
                                }),
                                messages: [
                                    {
                                        role: "user",
                                        content: `We are merging tables extracted from a multi-page document.
Here are the column headers of the PREVIOUS table:
${JSON.stringify(previousTableHeaders)}

Here is the FIRST row of the NEW table found on the next page:
${JSON.stringify(currentHeaders)}

Analyze this. Is the new table a continuation of the previous one? And is the first row just repeating the headers?`
                                    }
                                ]
                            });
                            isContinuation = object.isContinuation;
                            isRepeatedHeader = object.isRepeatedHeader;
                        } catch (e) {
                            // Fallback heuristic
                            isRepeatedHeader = previousTableHeaders.length === currentHeaders.length && previousTableHeaders.every((h, i) => h === currentHeaders[i]);
                            isContinuation = isRepeatedHeader || (previousTableHeaders.length === currentHeaders.length && currentHeaders.length > 0);
                        }
                    }

                    let startRow = 1;
                    if (isContinuation) {
                        if (isRepeatedHeader) {
                            startRow = 2; // Skip the repeated header
                        }
                        // Do not add gap
                    } else if (currentRowOffset > 0) {
                        // New table, add gap
                        currentRowOffset += 1;
                        previousTableHeaders = currentHeaders;
                    } else {
                        // Very first table
                        previousTableHeaders = currentHeaders;
                    }

                    for (let r = startRow; r <= maxRow; r++) {
                        const excelRow = sheet.getRow(currentRowOffset + (r - startRow + 1));
                        for (let c = 1; c <= maxCol; c++) {
                            excelRow.getCell(c).value = cellGrid[`${r}_${c}`] || "";
                        }
                    }
                    
                    // Style headers if this is a new table
                    if (!isContinuation) {
                        const headerExcelRow = sheet.getRow(currentRowOffset + 1);
                        headerExcelRow.font = { bold: true };
                        headerExcelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                    }

                    currentRowOffset += (maxRow - startRow + 1);
                }
            }

            // Cleanup S3
            try {
                await s3.send(new DeleteObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: s3Key
                }));
            } catch (cleanupErr) {
                console.error("[S3_CLEANUP_ERROR]", cleanupErr);
            }

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 95 } });

            resultBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
            mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            extension = ".xlsx";

        } else if (type === "EXCEL" && isImage) {
            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 30 } });
            
            // ── Hybrid: Textract for raw extraction, Qwen for structuring ──
            const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");
            const textract = new TextractClient({
                region: process.env.AWS_REGION || "us-west-2",
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                },
            });

            let textractKVPairs: string[] = [];
            let textractTableText = "";

            if (isImage || numPages === 1) {
                const textractRes = await textract.send(new AnalyzeDocumentCommand({
                    Document: { Bytes: buffer },
                    FeatureTypes: ["FORMS", "TABLES", "LAYOUT"],
                }));

                const blocks = textractRes.Blocks || [];
                const blockMap: Record<string, any> = {};
                blocks.forEach((b: any) => { if (b.Id) blockMap[b.Id] = b; });

                const getBlockText = (block: any): string => {
                    if (!block?.Relationships) return block?.Text || "";
                    const childRel = block.Relationships.find((r: any) => r.Type === "CHILD");
                    if (!childRel?.Ids) return block?.Text || "";
                    return childRel.Ids.map((id: string) => blockMap[id]?.Text || "").filter(Boolean).join(" ");
                }

                const keyBlocks = blocks.filter((b: any) => b.BlockType === "KEY_VALUE_SET" && b.EntityTypes?.includes("KEY"));
                for (const keyBlock of keyBlocks) {
                    const keyText = getBlockText(keyBlock);
                    if (!keyText.trim()) continue;
                    const valueRel = keyBlock.Relationships?.find((r: any) => r.Type === "VALUE");
                    let valueText = "";
                    if (valueRel?.Ids) {
                        valueText = getBlockText(blockMap[valueRel.Ids[0]]);
                    }
                    textractKVPairs.push(`"${keyText.trim()}": "${valueText.trim()}"`);
                }

                const tableBlocks = blocks.filter((b: any) => b.BlockType === "TABLE");
                for (const table of tableBlocks) {
                    const cellRel = table.Relationships?.find((r: any) => r.Type === "CHILD");
                    if (cellRel?.Ids) {
                        const cells = cellRel.Ids.map((id: string) => blockMap[id]).filter(Boolean);
                        const cellGrid: Record<string, string> = {};
                        let maxRow = 0, maxCol = 0;
                        cells.forEach((cell: any) => {
                            if (cell.BlockType === "CELL") {
                                const row = cell.RowIndex || 0;
                                const col = cell.ColumnIndex || 0;
                                maxRow = Math.max(maxRow, row);
                                maxCol = Math.max(maxCol, col);
                                cellGrid[`${row}_${col}`] = getBlockText(cell);
                            }
                        });
                        let tableStr = "Table:\n";
                        for (let r = 1; r <= maxRow; r++) {
                            const rowVals = [];
                            for (let c = 1; c <= maxCol; c++) {
                                rowVals.push(cellGrid[`${r}_${c}`] || "");
                            }
                            tableStr += rowVals.join(" | ") + "\n";
                        }
                        textractTableText += tableStr;
                    }
                }
            }

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 60 } });

            const textractContext = [
                textractKVPairs.length > 0 ? `Textract Form Fields:\n${textractKVPairs.join("\n")}` : "",
                textractTableText ? `Textract Tables:\n${textractTableText}` : "",
                extractedText ? `PDF Text:\n${extractedText.substring(0, 40000)}` : "",
            ].filter(Boolean).join("\n\n");

            contentPayload.push({
                type: "text",
                text: `Structure this document data into clean, organized output. Use the Textract-extracted data as ground truth. Clean up any OCR artifacts.\n\n${textractContext}`
            });

            const { object: rawObject, usage } = await generateObject({
                model,
                schema: z.object({
                    dataType: z.enum(["FORM_FIELDS", "TABULAR", "MIXED"]),
                    formFields: z.array(z.object({
                        label: z.string().default(""),
                        value: z.string().default("")
                    })).optional(),
                    tables: z.array(z.object({
                        tableName: z.string().default("Table"),
                        headers: z.array(z.string()),
                        rows: z.array(z.object({
                            cells: z.array(z.object({
                                header: z.string().default(""),
                                value: z.string().default("")
                            }))
                        }))
                    })).optional()
                }),
                messages: [{ role: "user", content: contentPayload }],
                temperature: 0.1,
                maxOutputTokens: 16000,
            });

            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 85 } });

            const object = { ...rawObject };
            if (object.formFields && object.formFields.length > 0) {
                const seen = new Set<string>();
                object.formFields = object.formFields.filter(f => {
                    if (!f.label && !f.value) return false;
                    const key = `${f.label}|||${f.value}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
            }

            logAiUsage({ teamId, userId, service: "pdf_wizard", model: modelId, usage: { promptTokens: (usage as any).inputTokens || 0, completionTokens: (usage as any).outputTokens || 0 }, description: `BasaltLens EXCEL (${numPages} pages)` }).catch(console.error);

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Extracted Data");
            
            if (object.dataType === "FORM_FIELDS" || (!object.tables?.length && object.formFields?.length)) {
                sheet.columns = [
                    { header: "FIELD NAME", key: "label", width: 30 },
                    { header: "VALUE", key: "value", width: 50 }
                ];
                object.formFields?.forEach(field => {
                    sheet.addRow({ label: field.label, value: field.value });
                });
                sheet.getRow(1).font = { bold: true };
                sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            } else if (object.tables && object.tables.length > 0) {
                const table = object.tables[0];
                const keys = new Set<string>();
                table.rows.forEach(row => {
                    row.cells?.forEach(cell => {
                        if (cell.header) keys.add(cell.header);
                    });
                });
                sheet.columns = Array.from(keys).map(key => ({ header: key.toUpperCase(), key, width: 20 }));
                table.rows.forEach(row => {
                    const flatObj: any = {};
                    row.cells?.forEach(cell => {
                        if (cell.header) flatObj[cell.header] = cell.value || "";
                    });
                    sheet.addRow(flatObj);
                });
                sheet.getRow(1).font = { bold: true };
                sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            }
            resultBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
            mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            extension = ".xlsx";

        } else if (type === "MARKDOWN") {
            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 40 } });
            contentPayload.push({ type: "text", text: "Convert this document perfectly to Markdown (.md). Preserve all headers, bolding, lists, and tables." });
            const { text, usage } = await generateText({
                model,
                messages: [{ role: "user", content: contentPayload }],
                temperature: 0.2,
            });
            logAiUsage({ teamId, userId, service: "pdf_wizard", model: modelId, usage: { promptTokens: (usage as any).inputTokens || 0, completionTokens: (usage as any).outputTokens || 0 }, description: `BasaltTransform MARKDOWN (${numPages} pages)` }).catch(console.error);
            resultBuffer = Buffer.from(text, "utf-8");
            mimeType = "text/markdown";
            extension = ".md";

        } else if (type === "JSON") {
            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 40 } });
            contentPayload.push({ type: "text", text: "Extract receipt/invoice fields into JSON." });
            const { object, usage } = await generateObject({
                model,
                schema: z.object({
                    vendorName: z.string().optional(),
                    date: z.string().optional(),
                    totalAmount: z.number().optional(),
                    taxAmount: z.number().optional(),
                    lineItems: z.array(z.object({ description: z.string(), amount: z.number() })).optional()
                }),
                messages: [{ role: "user", content: contentPayload }],
                temperature: 0.1,
            });
            logAiUsage({ teamId, userId, service: "pdf_wizard", model: modelId, usage: { promptTokens: (usage as any).inputTokens || 0, completionTokens: (usage as any).outputTokens || 0 }, description: `BasaltTransform JSON (${numPages} pages)` }).catch(console.error);
            resultBuffer = Buffer.from(JSON.stringify(object, null, 2), "utf-8");
            mimeType = "application/json";
            extension = ".json";

        } else {
            await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 40 } });
            // TEXT / OCR
            contentPayload.push({ type: "text", text: "Extract all handwriting or visible text exactly as written." });
            const { text, usage } = await generateText({
                model,
                messages: [{ role: "user", content: contentPayload }],
                temperature: 0.1,
            });
            logAiUsage({ teamId, userId, service: "pdf_wizard", model: modelId, usage: { promptTokens: (usage as any).inputTokens || 0, completionTokens: (usage as any).outputTokens || 0 }, description: `BasaltTransform TEXT (${numPages} pages)` }).catch(console.error);
            resultBuffer = Buffer.from(text, "utf-8");
            mimeType = "text/plain";
            extension = ".txt";
        }

        await (prismadb as any).crm_Transform_Jobs.update({ where: { id: jobId }, data: { progress: 95 } });

        // --- History & Storage ---
        let originalS3Key = null;
        let resultS3Key = null;

        if (saveHistory && teamId) {
            try {
                const timestamp = Date.now();
                originalS3Key = `${teamId}/transforms/${timestamp}_original_${fileName}`;
                resultS3Key = `${teamId}/transforms/${timestamp}_result${extension}`;

                // Upload original
                await s3.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: originalS3Key,
                    Body: buffer,
                    ContentType: fileType
                }));

                // Upload result
                await s3.send(new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: resultS3Key,
                    Body: resultBuffer,
                    ContentType: mimeType
                }));

                await (prismadb as any).crm_TransformHistory.create({
                    data: {
                        user_id: userId === "anonymous" ? undefined : userId,
                        team_id: teamId,
                        original_name: fileName,
                        transform_type: type,
                        cost: cost,
                        pages: numPages,
                        s3_key_original: originalS3Key,
                        s3_key_result: resultS3Key,
                        status: "COMPLETED",
                        is_saved: true
                    }
                });
            } catch (err) {
                console.error("[S3_UPLOAD_ERROR] Failed to save history", err);
            }
        }

        // Complete the Job
        await (prismadb as any).crm_Transform_Jobs.update({
            where: { id: jobId },
            data: {
                status: "COMPLETED",
                progress: 100,
                processedPages: numPages,
                resultData: {
                    base64: resultBuffer.toString("base64"),
                    mimeType,
                    extension,
                    fileName
                }
            }
        });

    } catch (error: any) {
        console.error("[PROCESS_JOB_ERROR]", error);
        await (prismadb as any).crm_Transform_Jobs.update({
            where: { id: jobId },
            data: { status: "FAILED", error: error.message || "Unknown error occurred" }
        }).catch(console.error);
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || null;
        const teamId = session?.user?.team_id || null;
        const ip = req.headers.get("x-forwarded-for") || "unknown_ip";

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string; // EXCEL | MARKDOWN | JSON | TEXT
        const saveHistory = formData.get("saveHistory") === "true";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const isImage = file.type.includes("image");
        let numPages = 1;
        let extractedText = "";

        if (!isImage) {
            const parsedPdf = await pdfParse(buffer);
            numPages = parsedPdf.numpages;
            extractedText = parsedPdf.text;
        }

        if (numPages > 200) {
            return NextResponse.json({ error: "File exceeds 200 pages. Contact support." }, { status: 400 });
        }

        // --- Rate Limiting & Billing Logic ---
        const freeLimit = type === "EXCEL" ? 5 : (type === "MARKDOWN" || type === "JSON" ? 10 : 20);
        let isPaidJob = false;
        
        if (numPages <= freeLimit && redis) {
            const ratelimit = new Ratelimit({
                redis,
                limiter: Ratelimit.fixedWindow(25, "30 d"), // Simplified tracking
                analytics: true,
                prefix: `@upstash/ratelimit:transform_${type.toLowerCase()}`,
            });

            const identifier = `${ip}_${userId}`;
            const { success, remaining } = await ratelimit.limit(identifier);

            if (!success) {
                isPaidJob = true;
            }
        } else {
            isPaidJob = true;
        }

        if (isPaidJob) {
            if (!teamId) {
                return NextResponse.json({ error: "You must be logged in to a team to process files beyond the free tier." }, { status: 402 });
            }
            const { checkTeamQuota } = await import("@/lib/quota-service");
            const quota = await checkTeamQuota(teamId, "AI_TOKENS", userId ?? undefined);
            if (!quota.allowed) {
                return NextResponse.json({ error: quota.message || "Insufficient balance for paid transform." }, { status: 402 });
            }
        }

        // Create the Job Entry
        const job = await (prismadb as any).crm_Transform_Jobs.create({
            data: {
                userId: userId !== "anonymous" ? userId : undefined,
                teamId: teamId || undefined,
                status: "QUEUED",
                fileName: file.name,
                fileSize: file.size,
                transformType: type,
                progress: 0,
                totalPages: numPages
            }
        });

        // Start processing asynchronously
        processJobInBackground(
            job.id, 
            buffer, 
            file.type, 
            file.name, 
            type, 
            saveHistory, 
            userId, 
            teamId, 
            numPages, 
            extractedText, 
            isImage, 
            ip
        );

        // Return immediately to avoid timeout
        return NextResponse.json({ jobId: job.id }, { status: 202 });

    } catch (error: any) {
        console.error("[TRANSFORM_PROCESS]", error);
        return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
    }
}
