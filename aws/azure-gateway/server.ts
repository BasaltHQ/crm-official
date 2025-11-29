/*
 Chime (Voice Connector) → Azure OpenAI Realtime Gateway (media bridge)

 Purpose:
 - Accept PCM/mu-law audio frames from a Chime Voice Connector Streaming consumer (bidirectional)
 - Maintain a WebSocket session with Azure OpenAI Realtime to send caller audio and receive AI audio
 - Stream AI audio back to the caller; for Chime PSTN playback, aggregate Azure audio and emit a single clip per response

 Notes:
 - VC Streaming → this gateway over WebSocket at /ingest?callId=...
   Upstream (caller → Azure): consumer sends binary audio frames (mu-law or pcm16). Optional JSON control frames.
   Downstream (Azure → caller): gateway aggregates Azure audio frames and sends a single binary audio clip (mu-law or pcm16) on response completion.
 - We base64-wrap audio to Azure Realtime using its JSON event protocol. Adjust types/fields as the API evolves.
 - Default telephony settings: mu-law 8kHz on the VC side; Azure typically prefers PCM16 16 kHz.
*/

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
// Defer loading of AgentBot to runtime to avoid ESM/extension resolution issues
// We'll dynamically import it inside the /start-bot handler.

// Env configuration (populate from .env when containerized)
const AZURE_REALTIME_URL = process.env.AZURE_OPENAI_REALTIME_WS_URL || 'wss://<your-azure-endpoint>/v1/realtime';
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || '<deployment-name>';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '<api-key>';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_REALTIME_API_VERSION || '';
const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.GATEWAY_SHARED_SECRET || '';
const ORIGIN_ALLOWLIST = (process.env.ORIGIN_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);

// VC side defaults
const DEFAULT_IN_ENCODING = (process.env.AUDIO_ENCODING || 'mulaw').toLowerCase(); // mulaw|pcm16
const DEFAULT_IN_SAMPLE_RATE = Number(process.env.SAMPLE_RATE || 8000);

// Azure side preferences
const AZURE_IN_ENCODING = (process.env.AZURE_IN_ENCODING || 'pcm16').toLowerCase(); // pcm16
const AZURE_IN_SAMPLE_RATE = Number(process.env.AZURE_IN_SAMPLE_RATE || 16000);
const AZURE_OUT_ENCODING = (process.env.AZURE_OUT_ENCODING || 'pcm16').toLowerCase(); // pcm16
const AZURE_OUT_SAMPLE_RATE = Number(process.env.AZURE_OUT_SAMPLE_RATE || 16000);
const AZURE_VOICE = process.env.AZURE_VOICE || 'alloy';
const FRAME_MS = 20; // hardcoded 20 ms cadence; env is ignored
const MIN_SPEECH_MS = Number(process.env.MIN_SPEECH_MS || 300); // min caller audio before triggering response

// Downstream back to VC consumer defaults (what we broadcast back)
const DEFAULT_OUT_ENCODING = (process.env.OUT_ENCODING || 'mulaw').toLowerCase(); // mulaw|pcm16
const DEFAULT_OUT_SAMPLE_RATE = Number(process.env.OUT_SAMPLE_RATE || 8000);

// ---------------- Audio helpers ----------------
// μ-law <-> PCM16 helpers adapted from standard telephony conversions
const MULAW_BIAS = 33;
function muLawDecode(mu: number): number {
  mu = ~mu & 0xff;
  const sign = (mu & 0x80) ? -1 : 1;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  const magnitude = ((mantissa << 4) + MULAW_BIAS) << (exponent + 3);
  return sign * Math.min(magnitude, 32767);
}
function muLawEncode(pcm16: number): number {
  const sign = (pcm16 < 0) ? 0x80 : 0;
  let magnitude = Math.min(Math.abs(pcm16), 32767) + MULAW_BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function decodeMuLawToPCM16(muLawBuf: Buffer): Int16Array {
  const out = new Int16Array(muLawBuf.length);
  for (let i = 0; i < muLawBuf.length; i++) out[i] = muLawDecode(muLawBuf[i]);
  return out;
}
function encodePCM16ToMuLaw(pcm: Int16Array): Buffer {
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = muLawEncode(pcm[i]);
  return out;
}

// Naive linear resampler (mono) from srcHz -> dstHz. For production, use a high-quality resampler.
function resampleLinearMono(pcm: Int16Array, srcHz: number, dstHz: number): Int16Array {
  if (srcHz === dstHz) return pcm;
  const ratio = dstHz / srcHz;
  const outLen = Math.floor(pcm.length * ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, pcm.length - 1);
    const t = srcPos - i0;
    out[i] = (pcm[i0] * (1 - t) + pcm[i1] * t) | 0;
  }
  return out;
}

function bufferToPCM16LE(buf: Buffer): Int16Array {
  const len = buf.length / 2;
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}
function pcm16LEToBuffer(pcm: Int16Array): Buffer {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], i * 2);
  return buf;
}

function toAzurePCM16(pcmOrMu: Buffer, enc: 'mulaw'|'pcm16', inHz: number): Int16Array {
  let pcm16: Int16Array;
  if (enc === 'mulaw') pcm16 = decodeMuLawToPCM16(pcmOrMu);
  else pcm16 = bufferToPCM16LE(pcmOrMu);
  if (inHz !== AZURE_IN_SAMPLE_RATE) pcm16 = resampleLinearMono(pcm16, inHz, AZURE_IN_SAMPLE_RATE);
  return pcm16;
}
function fromAzurePCM16ToDownstream(pcm16: Int16Array, outEnc: 'mulaw'|'pcm16', outHz: number): Buffer {
  let pcm = pcm16;
  if (AZURE_OUT_SAMPLE_RATE !== outHz) pcm = resampleLinearMono(pcm16, AZURE_OUT_SAMPLE_RATE, outHz);
  if (outEnc === 'mulaw') return encodePCM16ToMuLaw(pcm);
  return pcm16LEToBuffer(pcm);
}

// ---------------- Session state ----------------
interface Session {
  id: string;
  azure: WebSocket | null;
  clients: Set<WebSocket>; // one or more upstream producers (VC consumers)
  inEnc: 'mulaw'|'pcm16';
  inHz: number;
  outEnc: 'mulaw'|'pcm16';
  outHz: number;
  pending: boolean; // is there a pending Azure response generation
  upBuf: Buffer; // buffered PCM16LE for Azure commit cadence
  outAgg: Buffer[]; // aggregate Azure PCM16LE chunks for single-clip playback
  appendedMs: number; // accumulated upstream audio duration since last response
}
const sessions = new Map<string, Session>();

function log(...args: any[]) {
  console.log('[gateway]', ...args);
}
function originIsAllowed(origin?: string): boolean {
  if (!ORIGIN_ALLOWLIST.length) return true;
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return ORIGIN_ALLOWLIST.includes(u.origin) || ORIGIN_ALLOWLIST.includes(u.host);
  } catch {
    return false;
  }
}

// ---------------- Azure Realtime (WebSocket signaling) ----------------
function connectAzure(callId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const u = new URL(AZURE_REALTIME_URL);
    // Support both styles:
    // 1) Base URL + deployment query:   wss://.../openai/realtime?deployment=DEPLOY&api-version=...
    // 2) Path style with deployments:  wss://.../openai/deployments/DEPLOY/realtime?api-version=...
    if (!u.pathname.includes('/deployments/')) {
      u.searchParams.set('deployment', AZURE_DEPLOYMENT);
    }
    if (AZURE_API_VERSION) u.searchParams.set('api-version', AZURE_API_VERSION);
    log(callId, 'Azure WS URL', u.toString());
    const ws = new WebSocket(u.toString(), {
      headers: { 'api-key': AZURE_API_KEY },
    });

    ws.on('open', () => {
      log(callId, 'Azure Realtime connected');
      // Initialize session preferences (adjust to actual API schema as needed)
      const init = {
        type: 'session.update',
        session: {
          input_audio_format: { encoding: AZURE_IN_ENCODING, sample_rate_hz: AZURE_IN_SAMPLE_RATE },
          output_audio_format: { encoding: AZURE_OUT_ENCODING, sample_rate_hz: AZURE_OUT_SAMPLE_RATE },
        },
      };
      ws.send(JSON.stringify(init));
      resolve(ws);
    });

    ws.on('message', (data) => {
      const sess = sessions.get(callId);
      if (!sess) return;

      // Try to parse as JSON event first
      try {
        const msg = JSON.parse(data.toString());
        const t: string = String(msg.type || msg.event || '');
        // Expect audio deltas containing base64 PCM16 from Azure
        const base64 = msg.audio || msg.delta || msg.chunk;
        if (typeof base64 === 'string' && base64.length) {
          const pcmBuf = Buffer.from(base64, 'base64');
          // Aggregate Azure output until response completion
          sess.outAgg.push(pcmBuf);
          return;
        }
        // If response completed/stopped, flush aggregated output as one clip
        const isResp = /response/.test(t);
        const isDone = /completed|stopped|finished|end/.test(t);
        if (isResp && isDone) {
          const merged = sess.outAgg.length ? Buffer.concat(sess.outAgg) : Buffer.alloc(0);
          sess.outAgg = [];
          if (merged.length) {
            const pcm16 = bufferToPCM16LE(merged);
            const outBuf = fromAzurePCM16ToDownstream(pcm16, sess.outEnc, sess.outHz);
            sess.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(outBuf, { binary: true });
              }
            });
          }
          sess.pending = false;
          sess.appendedMs = 0; // reset speech accumulation after response
          return;
        }
        // Non-audio messages can be logged or forwarded if needed
        log(callId, 'Azure event:', t);
        return;
      } catch {
        // Not JSON; assume binary audio and aggregate
        const buf = Buffer.isBuffer(data) ? (data as Buffer) : Buffer.from(String(data || ''), 'utf8');
        if (buf.length) sessions.get(callId)?.outAgg.push(buf);
      }
    });

    ws.on('close', (code, reason) => log(callId, 'Azure Realtime closed', code, String(reason || '')));
    ws.on('error', (err) => {
      log(callId, 'Azure error', err);
      reject(err);
    });
  });
}

// Buffered helper to push caller audio up to Azure and trigger a response if idle
function sendBufferedAudioToAzure(sess: Session, pcm16: Int16Array) {
  if (!sess.azure || sess.azure.readyState !== WebSocket.OPEN) return;
  const azure = sess.azure;
  // Append new PCM16LE bytes to session buffer
  const newBytes = pcm16LEToBuffer(pcm16);
  sess.upBuf = Buffer.concat([sess.upBuf, newBytes]);

  // Calculate one frame in bytes (PCM16 mono = 2 bytes per sample)
  const frameBytes = Math.max(2, Math.floor((AZURE_IN_SAMPLE_RATE * FRAME_MS) / 1000) * 2);
  let appended = false;
  while (sess.upBuf.length >= frameBytes) {
    const chunk = sess.upBuf.subarray(0, frameBytes);
    sess.upBuf = sess.upBuf.subarray(frameBytes);
    const audioB64 = chunk.toString('base64');
    const append = { type: 'input_audio_buffer.append', audio: audioB64 } as any;
    try { azure.send(JSON.stringify(append)); appended = true; sess.appendedMs += FRAME_MS; } catch {}
  }
  if (appended) {
    const commit = { type: 'input_audio_buffer.commit' } as any;
    try { azure.send(JSON.stringify(commit)); } catch {}
  }

  // If not already generating, request a response using audio modality
  if (appended && !sess.pending && sess.appendedMs >= MIN_SPEECH_MS) {
    const create = {
      type: 'response.create',
      response: {
        modalities: ['audio'],
        instructions: 'You are a helpful voice assistant. Listen and respond concisely.',
        audio: { voice: AZURE_VOICE },
      },
    } as any;
    try {
      azure.send(JSON.stringify(create));
      sess.pending = true;
    } catch (e) {
      log(sess.id, 'error sending response.create', e);
    }
  }
}

// ---------------- HTTP + WS server ----------------
const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }

  const urlObj = new URL(req.url || '', `http://${req.headers.host}`);

  if (urlObj.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && urlObj.pathname === '/start-bot') {
    let bodyStr = '';
    req.on('data', (chunk) => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const payload = bodyStr ? JSON.parse(bodyStr) : {};
        const join = payload?.join;
        if (!join?.meeting || !join?.attendee) {
          res.writeHead(400, { 'content-type': 'application/json', ...corsHeaders });
          res.end(JSON.stringify({ ok: false, error: 'Missing join.meeting/attendee' }));
          return;
        }
        const azureCfg = payload?.azure || {
          url: process.env.AZURE_OPENAI_REALTIME_WS_URL || '',
          apiKey: process.env.AZURE_OPENAI_API_KEY || '',
          apiVersion: process.env.AZURE_OPENAI_REALTIME_API_VERSION || '',
          deployment: process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || '',
          voice: process.env.AZURE_VOICE || 'alloy',
          inSampleRate: Number(process.env.AZURE_IN_SAMPLE_RATE || 16000),
          outSampleRate: Number(process.env.AZURE_OUT_SAMPLE_RATE || 16000),
        };
        if (!azureCfg.url || !azureCfg.apiKey) {
          res.writeHead(500, { 'content-type': 'application/json', ...corsHeaders });
          res.end(JSON.stringify({ ok: false, error: 'Azure config missing (url/apiKey)' }));
          return;
        }
        const mod = await import('./agent-bot.js');
        const { startAgentBot } = mod as any;
        const result = await startAgentBot({ join, azure: azureCfg });
        res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify(result));
      } catch (e) {
        const msg = (e && (e as any).message) ? (e as any).message : String(e);
        res.writeHead(500, { 'content-type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ ok: false, error: msg }));
      }
    });
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ingest' });

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const callId = url.searchParams.get('callId') || crypto.randomUUID();

  const origin = req.headers.origin as string | undefined;
  const headerSecret = (req.headers['x-gateway-secret'] as string | undefined) || url.searchParams.get('secret') || '';
  if (!originIsAllowed(origin) || (SECRET && headerSecret !== SECRET)) {
    log(callId, 'unauthorized connection attempt from', origin);
    ws.close(1008, 'unauthorized');
    return;
  }

  (ws as any).isAlive = true;
  ws.on('pong', () => ((ws as any).isAlive = true));

  // Determine encodings/sample rates from query (fallback to defaults)
  const inEnc = ((url.searchParams.get('enc') || DEFAULT_IN_ENCODING) as 'mulaw'|'pcm16');
  const inHz = Number(url.searchParams.get('sr') || DEFAULT_IN_SAMPLE_RATE) || DEFAULT_IN_SAMPLE_RATE;
  const outEnc = ((url.searchParams.get('oenc') || DEFAULT_OUT_ENCODING) as 'mulaw'|'pcm16');
  const outHz = Number(url.searchParams.get('osr') || DEFAULT_OUT_SAMPLE_RATE) || DEFAULT_OUT_SAMPLE_RATE;

  log(callId, 'consumer connected', { inEnc, inHz, outEnc, outHz });

  let sess = sessions.get(callId);
  if (!sess) {
    sess = { id: callId, azure: null, clients: new Set(), inEnc, inHz, outEnc, outHz, pending: false, upBuf: Buffer.alloc(0), outAgg: [], appendedMs: 0 };
    sessions.set(callId, sess);
  }
  sess.clients.add(ws);
  // Update session encodings to latest joiner prefs
  sess.inEnc = inEnc; sess.inHz = inHz; sess.outEnc = outEnc; sess.outHz = outHz;

  // Ensure Azure session
  if (!sess.azure) {
    try { sess.azure = await connectAzure(callId); }
    catch (e) { log(callId, 'failed to connect Azure:', e); }
  }

  ws.on('message', (data, isBinary) => {
    const s = sessions.get(callId);
    if (!s || !s.azure || s.azure.readyState !== WebSocket.OPEN) return;

    if (!isBinary) {
      // Control plane JSON messages
      try {
        const msg = JSON.parse((data as Buffer).toString());
        const t = msg.type || msg.event;
        if (t === 'close') {
          s.azure?.close();
        } else if (t === 'ping') {
          // ignore
        } else if (t === 'say' && msg.text && typeof msg.text === 'string') {
          // Explicit TTS trigger without requiring upstream audio
          if (s.azure && s.azure.readyState === WebSocket.OPEN) {
            const create = {
              type: 'response.create',
              response: {
                modalities: ['audio'],
                instructions: String(msg.text),
                audio: { voice: AZURE_VOICE },
              },
            } as any;
            try { s.azure.send(JSON.stringify(create)); s.pending = true; } catch (e) { log(s.id, 'error sending TTS response.create', e); }
          }
        }
      } catch { /* ignore */ }
      return;
    }

    // Binary = upstream audio from VC consumer
    const pcm16 = toAzurePCM16(Buffer.from(data as Buffer), s.inEnc, s.inHz);
    try { sendBufferedAudioToAzure(s, pcm16); } catch (e) { log(callId, 'azure send error', e); }
  });

  ws.on('close', (code, reason) => {
    log(callId, 'consumer disconnected', code, String(reason || ''));
    const s = sessions.get(callId);
    s?.clients.delete(ws);
    if (s && s.clients.size === 0) {
      s.azure?.close();
      sessions.delete(callId);
    }
  });
});

server.listen(PORT, () => log('listening on', PORT));
setInterval(() => {
  wss.clients.forEach((client) => {
    const anyClient = client as any;
    if (anyClient.isAlive === false) { client.terminate(); return; }
    anyClient.isAlive = false;
    try { client.ping(); } catch {}
  });
}, 30000);
