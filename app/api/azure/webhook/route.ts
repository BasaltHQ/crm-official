import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

// In-memory idempotency store (replace with DB for production)
const processedIds: Set<string> = (globalThis as any).__WEBHOOK_IDS ?? new Set<string>()
;(globalThis as any).__WEBHOOK_IDS = processedIds

function getIdempotencyStore() {
  return processedIds
}

function verifySignature(body: string, timestamp: string, headerSignature: string, secret: string): boolean {
  try {
    // Many webhook schemes use base string `${timestamp}.${body}` with HMAC-SHA256 over the signing secret
    const base = `${timestamp}.${body}`
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(base)
    const digestHex = hmac.digest('hex').toLowerCase()

    // Header may be in formats like: "v1=<hex>" or just the hex; support multiple comma-separated values
    const candidates = (headerSignature || '')
      .split(',')
      .map((s) => s.trim())
      .map((s) => (s.includes('=') ? s.split('=')[1] : s))
      .map((s) => s.toLowerCase())

    const match = candidates.some((sig) => sig === digestHex)
    if (!match) console.error('[webhook] signature mismatch', { digestHex, candidates })
    return match
  } catch (e) {
    console.error('[webhook] verifySignature error', e)
    return false
  }
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
    console.error('[webhook] missing signing secret in env (OPENAI_WEBHOOK_SECRET/AZURE_OPENAI_WEBHOOK_SECRET)')
    return new NextResponse('Server misconfigured', { status: 500 })
  }

  if (!verifySignature(rawBody, timestamp, signature, secret)) {
    return new NextResponse('Invalid signature', { status: 400 })
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
  console.log('[webhook] event', { type, id: event?.id })

  // Route by event type (expand as needed)
  switch (type) {
    case 'response.completed': {
      // Example: record completion, notify systems
      console.log('[webhook] response.completed', event?.id)
      break
    }
    case 'response.failed': {
      console.warn('[webhook] response.failed', event?.id)
      break
    }
    case 'realtime.call.incoming': {
      const callId = event?.data?.call_id
      const sipHeaders = event?.data?.sip_headers
      console.log('[webhook] realtime.call.incoming', { callId, sipHeaders })
      // TODO: Kick off VC consumer/bridge orchestration or persistence
      break
    }
    default: {
      console.log('[webhook] unhandled event type', type)
      break
    }
  }

  // Offload heavy work to background (respond fast to avoid timeouts)
  setImmediate(() => {
    try {
      // TODO: enqueue job or trigger async processing
    } catch (e) {
      console.error('[webhook] async error', e)
    }
  })

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}
