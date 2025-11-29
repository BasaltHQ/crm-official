"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const crypto_1 = __importDefault(require("crypto"));
// Simple console logger (replace with pino/winston if desired)
function log(...args) { console.log('[vc-consumer]', ...args); }
// Env
const GATEWAY_URL = process.env.GATEWAY_URL || '';
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || '';
const CALL_ID = process.env.CALL_ID || crypto_1.default.randomUUID();
const IN_ENCODING = (process.env.IN_ENCODING || 'mulaw').toLowerCase();
const IN_SAMPLE_RATE = Number(process.env.IN_SAMPLE_RATE || 8000);
const OUT_ENCODING = (process.env.OUT_ENCODING || 'mulaw').toLowerCase();
const OUT_SAMPLE_RATE = Number(process.env.OUT_SAMPLE_RATE || 8000);
const MODE = (process.env.MODE || 'bidi').toLowerCase(); // 'kvs' | 'bidi'
if (!GATEWAY_URL) {
    throw new Error('GATEWAY_URL is required');
}
// ---------------- Audio helpers (μ-law <-> PCM16, passthrough) ----------------
const MULAW_BIAS = 33;
function muLawDecode(mu) { mu = ~mu & 0xff; const sign = (mu & 0x80) ? -1 : 1; const exponent = (mu >> 4) & 0x07; const mantissa = mu & 0x0f; const magnitude = ((mantissa << 4) + MULAW_BIAS) << (exponent + 3); return sign * Math.min(magnitude, 32767); }
function muLawEncode(pcm16) { const sign = (pcm16 < 0) ? 0x80 : 0; let magnitude = Math.min(Math.abs(pcm16), 32767) + MULAW_BIAS; let exponent = 7; for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) { } const mantissa = (magnitude >> (exponent + 3)) & 0x0f; return ~(sign | (exponent << 4) | mantissa) & 0xff; }
function decodeMuLawToPCM16(muLawBuf) { const out = new Int16Array(muLawBuf.length); for (let i = 0; i < muLawBuf.length; i++)
    out[i] = muLawDecode(muLawBuf[i]); return out; }
function encodePCM16ToMuLaw(pcm) { const out = Buffer.alloc(pcm.length); for (let i = 0; i < pcm.length; i++)
    out[i] = muLawEncode(pcm[i]); return out; }
function bufferToPCM16LE(buf) { const len = buf.length / 2; const out = new Int16Array(len); for (let i = 0; i < len; i++)
    out[i] = buf.readInt16LE(i * 2); return out; }
function pcm16LEToBuffer(pcm) { const buf = Buffer.alloc(pcm.length * 2); for (let i = 0; i < pcm.length; i++)
    buf.writeInt16LE(pcm[i], i * 2); return buf; }
// ---------------- Gateway bridge ----------------
class GatewayBridge {
    constructor(url, secret, callId) {
        this.url = url;
        this.secret = secret;
        this.callId = callId;
    }
    connect() {
        return new Promise((resolve, reject) => {
            const u = new URL(this.url);
            u.searchParams.set('callId', this.callId);
            u.searchParams.set('enc', IN_ENCODING);
            u.searchParams.set('sr', String(IN_SAMPLE_RATE));
            u.searchParams.set('oenc', OUT_ENCODING);
            u.searchParams.set('osr', String(OUT_SAMPLE_RATE));
            const ws = new ws_1.default(u.toString(), { headers: { 'x-gateway-secret': this.secret } });
            this.ws = ws;
            ws.on('open', () => { log('gateway connected'); resolve(); });
            ws.on('close', () => log('gateway closed'));
            ws.on('error', (e) => { log('gateway error', e); reject(e); });
        });
    }
    sendUpstreamAudioFrame(buf) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN)
            this.ws.send(buf, { binary: true });
    }
    onDownstreamAudio(cb) {
        this.ws.on('message', (data, isBinary) => {
            if (!isBinary)
                return; // ignore control for now
            cb(Buffer.from(data));
        });
    }
}
// 1) Kinesis Video Streams adapter (upstream only scaffold)
class KvsAdapter {
    async start(onUpstreamAudio, onEnd) {
        log('KVS adapter start (TODO: implement Kinesis Video Streams GetMedia and parse audio frames)');
        // TODO: initialize Kinesis Video client, get data endpoint, call GetMedia, parse MKV audio frames (PCM/mu-law)
        // For now, this is a no-op; you may feed test audio from file for integration testing.
    }
    async writeDownstream(buf) {
        // For KVS path there is no direct injection into the call; you would use SMA Speak/PlayAudio as a fallback.
        log('KVS adapter writeDownstream: TODO (use SMA Speak/PlayAudio path if needed)');
    }
    async stop() { }
}
// 2) Voice Connector Bidirectional Streaming adapter (placeholder)
class VcBidiAdapter {
    async start(onUpstreamAudio, onEnd) {
        log('VC Bidirectional adapter start (TODO: connect to VC streaming session and emit upstream audio frames)');
        // TODO: Use your session info (from SMA event or VC Streaming API) to connect to the bidirectional media stream
        // Subscribe to inbound (caller->you) frames and call onUpstreamAudio(frame)
    }
    async writeDownstream(buf) {
        // TODO: write audio frames back to the active VC streaming session (injection path)
        log('VC Bidirectional writeDownstream (TODO) size=', buf.length);
    }
    async stop() { }
}
async function main() {
    log('starting consumer with', { MODE, CALL_ID, IN_ENCODING, IN_SAMPLE_RATE, OUT_ENCODING, OUT_SAMPLE_RATE });
    const bridge = new GatewayBridge(GATEWAY_URL, GATEWAY_SECRET, CALL_ID);
    await bridge.connect();
    const adapter = MODE === 'kvs' ? new KvsAdapter() : new VcBidiAdapter();
    bridge.onDownstreamAudio(async (buf) => {
        try {
            await adapter.writeDownstream(buf);
        }
        catch (e) {
            log('downstream write error', e);
        }
    });
    await adapter.start((frame) => {
        // Frame expected in IN_ENCODING @ IN_SAMPLE_RATE; forward to gateway as-is
        bridge.sendUpstreamAudioFrame(frame);
    }, () => {
        var _a;
        log('VC adapter ended');
        try {
            (_a = bridge.ws) === null || _a === void 0 ? void 0 : _a.close();
        }
        catch { }
    });
}
main().catch((e) => { console.error(e); process.exit(1); });
