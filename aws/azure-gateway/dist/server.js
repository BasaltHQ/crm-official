/*
 Chime (Voice Connector) → Azure OpenAI Realtime Gateway (media bridge)

 Purpose:
 - Accept PCM/mu-law audio frames from a Chime Voice Connector Streaming consumer (bidirectional)
 - Maintain a WebSocket session with Azure OpenAI Realtime to send caller audio and receive AI audio
 - Stream AI audio back to the caller by broadcasting frames to the connected VC streaming consumer(s)

 Notes:
 - VC Streaming → this gateway over WebSocket at /ingest?callId=...
   Upstream (caller → Azure): consumer sends binary audio frames (mu-law or pcm16). Optional JSON control frames.
   Downstream (Azure → caller): gateway sends binary audio frames (mu-law or pcm16) back to the same WS client(s).
 - We base64-wrap audio to Azure Realtime using its JSON event protocol. Adjust types/fields as the API evolves.
 - Default telephony settings: mu-law 8kHz on the VC side; Azure typically prefers PCM16 16 kHz.
*/
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
// Env configuration (populate from .env when containerized)
const AZURE_REALTIME_URL = process.env.AZURE_OPENAI_REALTIME_WS_URL || 'wss://<your-azure-endpoint>/v1/realtime';
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || '<deployment-name>';
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY || '<api-key>';
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
// Downstream back to VC consumer defaults (what we broadcast back)
const DEFAULT_OUT_ENCODING = (process.env.OUT_ENCODING || 'mulaw').toLowerCase(); // mulaw|pcm16
const DEFAULT_OUT_SAMPLE_RATE = Number(process.env.OUT_SAMPLE_RATE || 8000);
// ---------------- Audio helpers ----------------
// μ-law <-> PCM16 helpers adapted from standard telephony conversions
const MULAW_BIAS = 33;
function muLawDecode(mu) {
    mu = ~mu & 0xff;
    const sign = (mu & 0x80) ? -1 : 1;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    const magnitude = ((mantissa << 4) + MULAW_BIAS) << (exponent + 3);
    return sign * Math.min(magnitude, 32767);
}
function muLawEncode(pcm16) {
    const sign = (pcm16 < 0) ? 0x80 : 0;
    let magnitude = Math.min(Math.abs(pcm16), 32767) + MULAW_BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) { }
    const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
    return ~(sign | (exponent << 4) | mantissa) & 0xff;
}
function decodeMuLawToPCM16(muLawBuf) {
    const out = new Int16Array(muLawBuf.length);
    for (let i = 0; i < muLawBuf.length; i++)
        out[i] = muLawDecode(muLawBuf[i]);
    return out;
}
function encodePCM16ToMuLaw(pcm) {
    const out = Buffer.alloc(pcm.length);
    for (let i = 0; i < pcm.length; i++)
        out[i] = muLawEncode(pcm[i]);
    return out;
}
// Naive linear resampler (mono) from srcHz -> dstHz. For production, use a high-quality resampler.
function resampleLinearMono(pcm, srcHz, dstHz) {
    if (srcHz === dstHz)
        return pcm;
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
function bufferToPCM16LE(buf) {
    const len = buf.length / 2;
    const out = new Int16Array(len);
    for (let i = 0; i < len; i++)
        out[i] = buf.readInt16LE(i * 2);
    return out;
}
function pcm16LEToBuffer(pcm) {
    const buf = Buffer.alloc(pcm.length * 2);
    for (let i = 0; i < pcm.length; i++)
        buf.writeInt16LE(pcm[i], i * 2);
    return buf;
}
function toAzurePCM16(pcmOrMu, enc, inHz) {
    let pcm16;
    if (enc === 'mulaw')
        pcm16 = decodeMuLawToPCM16(pcmOrMu);
    else
        pcm16 = bufferToPCM16LE(pcmOrMu);
    if (inHz !== AZURE_IN_SAMPLE_RATE)
        pcm16 = resampleLinearMono(pcm16, inHz, AZURE_IN_SAMPLE_RATE);
    return pcm16;
}
function fromAzurePCM16ToDownstream(pcm16, outEnc, outHz) {
    let pcm = pcm16;
    if (AZURE_OUT_SAMPLE_RATE !== outHz)
        pcm = resampleLinearMono(pcm16, AZURE_OUT_SAMPLE_RATE, outHz);
    if (outEnc === 'mulaw')
        return encodePCM16ToMuLaw(pcm);
    return pcm16LEToBuffer(pcm);
}
const sessions = new Map();
function log(...args) {
    console.log('[gateway]', ...args);
}
function originIsAllowed(origin) {
    if (!ORIGIN_ALLOWLIST.length)
        return true;
    if (!origin)
        return false;
    try {
        const u = new URL(origin);
        return ORIGIN_ALLOWLIST.includes(u.origin) || ORIGIN_ALLOWLIST.includes(u.host);
    }
    catch {
        return false;
    }
}
// ---------------- Azure Realtime (WebSocket signaling) ----------------
function connectAzure(callId) {
    return new Promise((resolve, reject) => {
        const url = `${AZURE_REALTIME_URL}?deployment=${encodeURIComponent(AZURE_DEPLOYMENT)}`;
        const ws = new WebSocket(url, {
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
                    // You can set default voice here if the API supports it at session level
                },
            };
            ws.send(JSON.stringify(init));
            resolve(ws);
        });
        ws.on('message', (data) => {
            const sess = sessions.get(callId);
            if (!sess)
                return;
            // Try to parse as JSON event first
            try {
                const msg = JSON.parse(data.toString());
                const t = msg.type || msg.event || '';
                // Expect audio deltas containing base64 PCM16 from Azure
                const base64 = msg.audio || msg.delta || msg.chunk;
                if (t && /audio/.test(String(t)) && typeof base64 === 'string') {
                    const pcmBuf = Buffer.from(base64, 'base64');
                    const pcm16 = bufferToPCM16LE(pcmBuf);
                    const outBuf = fromAzurePCM16ToDownstream(pcm16, sess.outEnc, sess.outHz);
                    for (const client of sess.clients)
                        if (client.readyState === WebSocket.OPEN)
                            client.send(outBuf, { binary: true });
                    return;
                }
                // If response completed/stopped, clear pending so we can request a new one on next audio
                {
                    const tStr = String(t);
                    const isResp = /response/.test(tStr);
                    const isDone = /completed|stopped/.test(tStr);
                    if (isResp && isDone) {
                        sess.pending = false;
                    }
                }
                // Non-audio messages can be logged or forwarded if needed
                log(callId, 'Azure event:', t);
                return;
            }
            catch {
                // Not JSON, assume binary audio (unlikely) and forward as-is
                for (const client of sess.clients)
                    if (client.readyState === WebSocket.OPEN)
                        client.send(data, { binary: true });
            }
        });
        ws.on('close', () => log(callId, 'Azure Realtime closed'));
        ws.on('error', (err) => {
            log(callId, 'Azure error', err);
            reject(err);
        });
    });
}
// Helper to push caller audio up to Azure and trigger a response if idle
function sendAudioChunkToAzure(sess, pcm16) {
    if (!sess.azure || sess.azure.readyState !== WebSocket.OPEN)
        return;
    const azure = sess.azure;
    const audioB64 = pcm16LEToBuffer(pcm16).toString('base64');
    const append = { type: 'input_audio_buffer.append', audio: audioB64 };
    azure.send(JSON.stringify(append));
    const commit = { type: 'input_audio_buffer.commit' };
    try {
        azure.send(JSON.stringify(commit));
    }
    catch { }
    // If not already generating, request a response using audio modality
    if (!sess.pending) {
        const create = {
            type: 'response.create',
            response: {
                modalities: ['audio'],
                instructions: 'You are a helpful voice assistant. Listen and respond concisely.',
                audio: { voice: AZURE_VOICE },
            },
        };
        try {
            azure.send(JSON.stringify(create));
            sess.pending = true;
        }
        catch (e) {
            log(sess.id, 'error sending response.create', e);
        }
    }
}
// ---------------- HTTP + WS server ----------------
const server = http.createServer((req, res) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
    }
    if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ ok: true }));
        return;
    }
    res.writeHead(404, corsHeaders);
    res.end();
});
const wss = new WebSocketServer({ server, path: '/ingest' });
wss.on('connection', async (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const callId = url.searchParams.get('callId') || crypto.randomUUID();
    const origin = req.headers.origin;
    const headerSecret = req.headers['x-gateway-secret'] || url.searchParams.get('secret') || '';
    if (!originIsAllowed(origin) || (SECRET && headerSecret !== SECRET)) {
        log(callId, 'unauthorized connection attempt from', origin);
        ws.close(1008, 'unauthorized');
        return;
    }
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    // Determine encodings/sample rates from query (fallback to defaults)
    const inEnc = (url.searchParams.get('enc') || DEFAULT_IN_ENCODING);
    const inHz = Number(url.searchParams.get('sr') || DEFAULT_IN_SAMPLE_RATE) || DEFAULT_IN_SAMPLE_RATE;
    const outEnc = (url.searchParams.get('oenc') || DEFAULT_OUT_ENCODING);
    const outHz = Number(url.searchParams.get('osr') || DEFAULT_OUT_SAMPLE_RATE) || DEFAULT_OUT_SAMPLE_RATE;
    log(callId, 'consumer connected', { inEnc, inHz, outEnc, outHz });
    let sess = sessions.get(callId);
    if (!sess) {
        sess = { id: callId, azure: null, clients: new Set(), inEnc, inHz, outEnc, outHz, pending: false };
        sessions.set(callId, sess);
    }
    sess.clients.add(ws);
    // Update session encodings to latest joiner prefs
    sess.inEnc = inEnc;
    sess.inHz = inHz;
    sess.outEnc = outEnc;
    sess.outHz = outHz;
    // Ensure Azure session
    if (!sess.azure) {
        try {
            sess.azure = await connectAzure(callId);
        }
        catch (e) {
            log(callId, 'failed to connect Azure:', e);
        }
    }
    ws.on('message', (data, isBinary) => {
        const s = sessions.get(callId);
        if (!s || !s.azure || s.azure.readyState !== WebSocket.OPEN)
            return;
        if (!isBinary) {
            // Control plane JSON messages
            try {
                const msg = JSON.parse(data.toString());
                const t = msg.type || msg.event;
                if (t === 'close') {
                    s.azure?.close();
                }
                else if (t === 'ping') {
                    // ignore
                }
            }
            catch { /* ignore */ }
            return;
        }
        // Binary = upstream audio from VC consumer
        const pcm16 = toAzurePCM16(Buffer.from(data), s.inEnc, s.inHz);
        try {
            sendAudioChunkToAzure(s, pcm16);
        }
        catch (e) {
            log(callId, 'azure send error', e);
        }
    });
    ws.on('close', () => {
        log(callId, 'consumer disconnected');
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
    for (const client of wss.clients) {
        const anyClient = client;
        if (anyClient.isAlive === false) {
            client.terminate();
            continue;
        }
        anyClient.isAlive = false;
        try {
            client.ping();
        }
        catch { }
    }
}, 30000);
