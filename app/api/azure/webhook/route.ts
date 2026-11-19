import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { systemLogger } from "@/lib/logger";

export const runtime = 'nodejs'

// In-memory idempotency store (replace with DB for production)
const processedIds: Set<string> = (globalThis as any).__WEBHOOK_IDS ?? new Set<string>()
  ; (globalThis as any).__WEBHOOK_IDS = processedIds

function getIdempotencyStore() {
  return processedIds
}

const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

function verifySignature(body: string, timestamp: string, headerSignature: string, secret: string): boolean {
  try {
    if (!timestamp || !headerSignature || !secret) {
      return false
    }

    const tsNum = Number(timestamp)
    if (!Number.isFinite(tsNum)) {
      return false
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > WEBHOOK_TOLERANCE_SECONDS) {
      return false
    }

    // Standard scheme uses base string `${timestamp}.${body}` with HMAC-SHA256 over the signing secret
    const base = `${timestamp}.${body}`
    const expectedBuf = crypto.createHmac('sha256', secret).update(base, 'utf8').digest()

    // Header may be in formats like: "v1=<hex>" or just the hex; support multiple comma-separated values
    const candidates = headerSignature
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.includes('=') ? s.split('=').slice(1).join('=') : s))
      .map((s) => s.trim())

    for (const sig of candidates) {
      if (!/^[0-9a-fA-F]{64}$/.test(sig)) continue
      const candidateBuf = Buffer.from(sig, 'hex')
      if (
        candidateBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candidateBuf, expectedBuf)
      ) {
        return true
      }
    }

    systemLogger.warn('[webhook] signature verification failed')
    return false
  } catch (e) {
    systemLogger.error('[webhook] verifySignature error', e)
    return false
  }
}

import { taskQueue } from "@/lib/background/queue"

// Register Task Handler for webhooks (only once)
if (!(globalThis as any).__AZURE_WEBHOOK_HANDLER_REGISTERED) {
  taskQueue.register('AZURE_OPENAI_WEBHOOK', async (event: any) => {
    const type = event?.type || ''
    // Real logic for heavy processing goes here
    systemLogger.info(`[WEBHOOK_BACKGROUND] Processing ${type}`, { id: event?.id })

    // Simulate complex logic like Vector DB indexing or heavy API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  })
    ; (globalThis as any).__AZURE_WEBHOOK_HANDLER_REGISTERED = true;
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const rawBody = await req.text()

  const id = req.headers.get('Webhook-ID') || ''
  const timestamp = req.headers.get('Webhook-Timestamp') || ''
  const signature = req.headers.get('Webhook-Signature') || ''

  const secret =
    process.env.OPENAI_WEBHOOK_SECRET || process.env.AZURE_OPENAI_WEBHOOK_SECRET || process.env.WEBHOOK_SIGNING_SECRET || ''

  if (!secret) {
    systemLogger.error('[webhook] missing signing secret in env (OPENAI_WEBHOOK_SECRET/AZURE_OPENAI_WEBHOOK_SECRET)')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  if (!verifySignature(rawBody, timestamp, signature, secret)) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  // Idempotency: avoid duplicate processing
  const store = getIdempotencyStore()
  if (id && store.has(id)) {
    return NextResponse.json({ ok: true, dedup: true })
  }
  if (id) store.add(id)

  // Parse JSON payload
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Bad JSON', { status: 400 })
  }

  const type: string = event?.type || ''
  systemLogger.error('[webhook] event', { type, id: event?.id })

  // Offload to background queue immediately
  taskQueue.enqueue('AZURE_OPENAI_WEBHOOK', event);

  return NextResponse.json({ ok: true, status: 'QUEUED' })
}

export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}
