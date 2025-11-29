/*
 Simple gateway ingestion validation: generate μ-law 8kHz sine tone and send over /ingest WebSocket.
 Use this to verify the Gateway ↔ Azure session wiring without attaching to VC streaming yet.

 Env:
 - GATEWAY_URL=wss://<gateway-host>/ingest
 - GATEWAY_SECRET=...
 - CALL_ID=<uuid or any identifier>
 - IN_SAMPLE_RATE=8000 (default 8000)
 - FREQ_HZ=440 (default 440)
 - DURATION_MS=10000 (default 10000)
*/

import WebSocket from 'ws';
import crypto from 'crypto';

const GATEWAY_URL = process.env.GATEWAY_URL || '';
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || '';
const CALL_ID = (process.env.CALL_ID || crypto.randomUUID()).trim();
const IN_SAMPLE_RATE = Number(process.env.IN_SAMPLE_RATE || 8000);
const FREQ_HZ = Number(process.env.FREQ_HZ || 440);
const DURATION_MS = Number(process.env.DURATION_MS || 10000);

if (!GATEWAY_URL) throw new Error('GATEWAY_URL is required');
if (!GATEWAY_SECRET) console.warn('[test-sine] GATEWAY_SECRET not set; connection may be rejected');

// μ-law encoding helpers
const MULAW_BIAS = 33;
function muLawEncodeSample(pcm16: number): number {
  const sign = (pcm16 < 0) ? 0x80 : 0;
  let magnitude = Math.min(Math.abs(pcm16), 32767) + MULAW_BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (magnitude & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function genMuLawToneFrame(freqHz: number, sr: number, ms: number = 20, amplitude: number = 0.3): Buffer {
  const samples = Math.floor(sr * (ms / 1000));
  const buf = Buffer.alloc(samples);
  const twoPiF = 2 * Math.PI * freqHz;
  for (let i = 0; i < samples; i++) {
    const t = i / sr;
    const sampleFloat = amplitude * Math.sin(twoPiF * t); // -1..1
    const pcm16 = Math.max(-1, Math.min(1, sampleFloat)) * 32767;
    buf[i] = muLawEncodeSample(pcm16 | 0);
  }
  return buf;
}

async function main() {
  const u = new URL(GATEWAY_URL);
  u.searchParams.set('callId', CALL_ID);
  u.searchParams.set('enc', 'mulaw');
  u.searchParams.set('sr', String(IN_SAMPLE_RATE));
  u.searchParams.set('oenc', 'mulaw');
  u.searchParams.set('osr', String(IN_SAMPLE_RATE));

  console.log('[test-sine] connecting', { url: u.toString(), CALL_ID, IN_SAMPLE_RATE, FREQ_HZ, DURATION_MS });
  const ws = new WebSocket(u.toString(), { headers: { 'x-gateway-secret': GATEWAY_SECRET } });

  ws.on('open', () => {
    console.log('[test-sine] connected');
    const start = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - start > DURATION_MS) {
        clearInterval(iv);
        try { ws.close(); } catch {}
        return;
      }
      const frame = genMuLawToneFrame(FREQ_HZ, IN_SAMPLE_RATE, 20);
      try { ws.send(frame, { binary: true }); } catch (e) { console.warn('[test-sine] send error', e); }
    }, 20);
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      console.log('[test-sine] downstream frame len=', (data as Buffer).length);
    } else {
      try { console.log('[test-sine] ctrl', (data as Buffer).toString()); } catch {}
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[test-sine] closed', { code, reason: reason?.toString() });
  });
  ws.on('error', (e) => console.error('[test-sine] error', e));
}

main().catch((e) => { console.error(e); process.exit(1); });
