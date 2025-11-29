/*
 Voice Connector Streaming Consumer (bidirectional scaffold)

 Goal
 - Connect to Amazon Chime Voice Connector Streaming for a given call (upstream + downstream)
 - Forward upstream caller audio frames to the Azure Gateway over WebSocket
 - Receive downstream AI audio frames from the Gateway and inject back into the Voice Connector stream

 Current status
 - This file implements the consumer core and Gateway WS bridge
 - AWS VC streaming adapters are scaffolded with TODOs; pick one implementation:
   1) Kinesis Video Streams (KVS) reader (upstream-only while we validate) + TODO downstream inject path
   2) Voice Connector Bidirectional Streaming adapter (when enabled on your VC)

 Env
 - GATEWAY_URL=wss://<gateway-host>/ingest
 - GATEWAY_SECRET=...
 - CALL_ID=<uuid or provider call id>
 - IN_ENCODING=mulaw|pcm16 (default: mulaw)
 - IN_SAMPLE_RATE=8000 (default: 8000)
 - OUT_ENCODING=mulaw|pcm16 (default: mulaw)
 - OUT_SAMPLE_RATE=8000 (default: 8000)
 - MODE=kvs|bidi (choose adapter)
 - AWS_REGION=us-west-2
 - VC_ID=<VoiceConnectorId> (for bidi mode if needed)
 - KVS_STREAM_ARN=<arn> (for kvs mode)
*/

import WebSocket, { RawData } from 'ws';
import crypto from 'crypto';

// Simple console logger (replace with pino/winston if desired)
function log(...args: any[]) { console.log('[vc-consumer]', ...args); }

// Env
const GATEWAY_URL = process.env.GATEWAY_URL || '';
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || '';
const CALL_ID = process.env.CALL_ID || crypto.randomUUID();
const IN_ENCODING = (process.env.IN_ENCODING || 'mulaw').toLowerCase() as 'mulaw'|'pcm16';
const IN_SAMPLE_RATE = Number(process.env.IN_SAMPLE_RATE || 8000);
const OUT_ENCODING = (process.env.OUT_ENCODING || 'mulaw').toLowerCase() as 'mulaw'|'pcm16';
const OUT_SAMPLE_RATE = Number(process.env.OUT_SAMPLE_RATE || 8000);
const FRAME_MS = Number(process.env.FRAME_MS || 20);
const MODE = (process.env.MODE || 'bidi').toLowerCase(); // 'kvs' | 'bidi'
const VC_MEDIA_WS_URL = process.env.VC_MEDIA_WS_URL || '';
const VC_MEDIA_AUTH = process.env.VC_MEDIA_AUTH || '';

if (!GATEWAY_URL) {
  throw new Error('GATEWAY_URL is required');
}

// ---------------- Audio helpers (μ-law <-> PCM16, passthrough) ----------------
const MULAW_BIAS = 33;
function muLawDecode(mu: number): number { mu = ~mu & 0xff; const sign = (mu & 0x80) ? -1 : 1; const exponent = (mu >> 4) & 0x07; const mantissa = mu & 0x0f; const magnitude = ((mantissa << 4) + MULAW_BIAS) << (exponent + 3); return sign * Math.min(magnitude, 32767); }
function muLawEncode(pcm16: number): number { const sign = (pcm16 < 0) ? 0x80 : 0; let magnitude = Math.min(Math.abs(pcm16), 32767) + MULAW_BIAS; let exponent = 7; for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {} const mantissa = (magnitude >> (exponent + 3)) & 0x0f; return ~(sign | (exponent << 4) | mantissa) & 0xff; }
function decodeMuLawToPCM16(muLawBuf: Buffer): Int16Array { const out = new Int16Array(muLawBuf.length); for (let i = 0; i < muLawBuf.length; i++) out[i] = muLawDecode(muLawBuf[i]); return out; }
function encodePCM16ToMuLaw(pcm: Int16Array): Buffer { const out = Buffer.alloc(pcm.length); for (let i = 0; i < pcm.length; i++) out[i] = muLawEncode(pcm[i]); return out; }
function bufferToPCM16LE(buf: Buffer): Int16Array { const len = buf.length / 2; const out = new Int16Array(len); for (let i = 0; i < len; i++) out[i] = buf.readInt16LE(i * 2); return out; }
function pcm16LEToBuffer(pcm: Int16Array): Buffer { const buf = Buffer.alloc(pcm.length * 2); for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2); return buf; }

// ---------------- Gateway bridge ----------------
class GatewayBridge {
  ws!: WebSocket;
  constructor(private url: string, private secret: string, private callId: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const u = new URL(this.url);
      u.searchParams.set('callId', this.callId);
      u.searchParams.set('enc', IN_ENCODING);
      u.searchParams.set('sr', String(IN_SAMPLE_RATE));
      u.searchParams.set('oenc', OUT_ENCODING);
      u.searchParams.set('osr', String(OUT_SAMPLE_RATE));
      const ws = new WebSocket(u.toString(), { headers: { 'x-gateway-secret': this.secret } });
      this.ws = ws;
      ws.on('open', () => { log('gateway connected'); resolve(); });
      ws.on('close', () => log('gateway closed'));
      ws.on('error', (e: any) => { log('gateway error', e); reject(e); });
    });
  }

  sendUpstreamAudioFrame(buf: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(buf, { binary: true });
  }

  onDownstreamAudio(cb: (buf: Buffer) => void) {
    this.ws.on('message', (data: RawData, isBinary: boolean) => {
      if (!isBinary) return; // ignore control for now
      cb(Buffer.from(data as Buffer));
    });
  }
}

// ---------------- VC streaming adapters (scaffolds) ----------------
interface VCAdapter {
  start(onUpstreamAudio: (buf: Buffer) => void, onEnd: () => void): Promise<void>;
  writeDownstream(buf: Buffer): Promise<void>;
  stop(): Promise<void>;
}

// 1) Kinesis Video Streams adapter (upstream only scaffold)
class KvsAdapter implements VCAdapter {
  async start(onUpstreamAudio: (buf: Buffer) => void, onEnd: () => void): Promise<void> {
    log('KVS adapter start (TODO: implement Kinesis Video Streams GetMedia and parse audio frames)');
    // TODO: initialize Kinesis Video client, get data endpoint, call GetMedia, parse MKV audio frames (PCM/mu-law)
    // For now, this is a no-op; you may feed test audio from file for integration testing.
  }
  async writeDownstream(buf: Buffer): Promise<void> {
    // For KVS path there is no direct injection into the call; you would use SMA Speak/PlayAudio as a fallback.
    log('KVS adapter writeDownstream: TODO (use SMA Speak/PlayAudio path if needed)');
  }
  async stop(): Promise<void> { /* TODO: close streams */ }
}

// 2) Voice Connector Bidirectional Streaming adapter (placeholder)
class VcBidiAdapter implements VCAdapter {
  private ws?: WebSocket;
  private downBuf: Buffer = Buffer.alloc(0);
  private downTimer?: NodeJS.Timeout;

  async start(onUpstreamAudio: (buf: Buffer) => void, onEnd: () => void): Promise<void> {
    if (!VC_MEDIA_WS_URL) {
      throw new Error('VC_MEDIA_WS_URL is required for bidirectional adapter');
    }
    log('VC Bidirectional adapter connecting', { url: VC_MEDIA_WS_URL, hasAuth: !!VC_MEDIA_AUTH, IN_ENCODING, IN_SAMPLE_RATE });
    const headers: Record<string, string> = {};
    if (VC_MEDIA_AUTH) headers['Authorization'] = VC_MEDIA_AUTH;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(VC_MEDIA_WS_URL, { headers });
      this.ws = ws;

      ws.on('open', () => {
        log('VC media WS connected');
        // Start steady downstream pacing timer (send 20ms frames; fill with silence if underflow)
        if (!this.downTimer) {
          this.downTimer = setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            const isMulaw = OUT_ENCODING === 'mulaw';
            const bytesPerSample = isMulaw ? 1 : 2;
            const frameBytes = Math.max(bytesPerSample, Math.floor((OUT_SAMPLE_RATE * FRAME_MS) / 1000) * bytesPerSample);

            let chunk: Buffer;
            if (this.downBuf.length >= frameBytes) {
              chunk = this.downBuf.subarray(0, frameBytes);
              this.downBuf = this.downBuf.subarray(frameBytes);
            } else {
              // generate silence
              if (isMulaw) {
                chunk = Buffer.alloc(frameBytes, 0xFF);
              } else {
                chunk = Buffer.alloc(frameBytes, 0x00);
              }
            }
            try { this.ws.send(chunk, { binary: true }); } catch (e) { log('VC downstream send error', e); }
          }, FRAME_MS);
        }
        resolve();
      });

      ws.on('message', (data: RawData, isBinary: boolean) => {
        // Upstream audio from caller (assumed IN_ENCODING @ IN_SAMPLE_RATE)
        if (isBinary) {
          try {
            onUpstreamAudio(Buffer.from(data as Buffer));
          } catch (e) {
            log('onUpstreamAudio error', e);
          }
        } else {
          // Control/JSON messages if the VC media WS emits them
          try {
            const txt = (data as Buffer).toString();
            log('VC media ctrl', txt);
          } catch {}
        }
      });

      ws.on('close', (code, reason) => {
        log('VC media WS closed', { code, reason: reason?.toString() });
        onEnd();
      });

      ws.on('error', (e) => {
        log('VC media WS error', e);
        reject(e);
      });
    });
  }

  async writeDownstream(buf: Buffer): Promise<void> {
    // Just buffer downstream audio; timer started on connection will pace out frames and fill with silence as needed
    this.downBuf = Buffer.concat([this.downBuf, buf]);
  }

  async stop(): Promise<void> {
    try { if (this.downTimer) { clearInterval(this.downTimer); this.downTimer = undefined; } } catch {}
    try { this.ws?.close(); } catch {}
  }
}

async function main() {
  log('starting consumer with', { MODE, CALL_ID, IN_ENCODING, IN_SAMPLE_RATE, OUT_ENCODING, OUT_SAMPLE_RATE });
  const bridge = new GatewayBridge(GATEWAY_URL, GATEWAY_SECRET, CALL_ID);
  await bridge.connect();

  const adapter: VCAdapter = MODE === 'kvs' ? new KvsAdapter() : new VcBidiAdapter();

  let suppressUntil = 0;
  bridge.onDownstreamAudio(async (buf) => {
    // Gate upstream while we are playing back Azure audio to avoid echo/feedback
    const ms = OUT_ENCODING === 'mulaw'
      ? Math.round(1000 * buf.length / OUT_SAMPLE_RATE)
      : Math.round(1000 * (buf.length / 2) / OUT_SAMPLE_RATE);
    suppressUntil = Date.now() + ms + 100; // add a small cushion
    try { await adapter.writeDownstream(buf); } catch (e) { log('downstream write error', e); }
  });

  await adapter.start((frame) => {
    // Suppress upstream while we are outputting TTS back to caller to prevent model hearing itself
    if (Date.now() < suppressUntil) return;
    // Frame expected in IN_ENCODING @ IN_SAMPLE_RATE; forward to gateway as-is
    bridge.sendUpstreamAudioFrame(frame);
  }, () => {
    log('VC adapter ended');
    try { bridge.ws?.close(); } catch {}
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
