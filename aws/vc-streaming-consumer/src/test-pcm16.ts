/*
 Send PCM16 16kHz tone to gateway /ingest to A/B against mu-law.

 Env:
 - GATEWAY_URL=wss://<gateway-host>/ingest
 - GATEWAY_SECRET=...
 - CALL_ID=<uuid>
 - IN_SAMPLE_RATE=16000 (default 16000)
 - FREQ_HZ=440 (default 440)
 - DURATION_MS=15000 (default 15000)
*/
import WebSocket from 'ws';
import crypto from 'crypto';

const GATEWAY_URL = process.env.GATEWAY_URL || '';
const GATEWAY_SECRET = process.env.GATEWAY_SECRET || '';
const CALL_ID = (process.env.CALL_ID || crypto.randomUUID()).trim();
const IN_SAMPLE_RATE = Number(process.env.IN_SAMPLE_RATE || 16000);
const FREQ_HZ = Number(process.env.FREQ_HZ || 440);
const DURATION_MS = Number(process.env.DURATION_MS || 15000);

if (!GATEWAY_URL) throw new Error('GATEWAY_URL is required');
if (!GATEWAY_SECRET) console.warn('[test-pcm16] GATEWAY_SECRET not set; connection may be rejected');

function genPCM16LEFrame(freqHz: number, sr: number, ms: number = 20, amplitude: number = 0.3): Buffer {
  const samples = Math.floor(sr * (ms / 1000));
  const buf = Buffer.alloc(samples * 2);
  const twoPiF = 2 * Math.PI * freqHz;
  for (let i = 0; i < samples; i++) {
    const t = i / sr;
    const sampleFloat = amplitude * Math.sin(twoPiF * t);
    const pcm16 = Math.max(-1, Math.min(1, sampleFloat)) * 32767;
    buf.writeInt16LE(pcm16 | 0, i * 2);
  }
  return buf;
}

async function main() {
  const u = new URL(GATEWAY_URL);
  u.searchParams.set('callId', CALL_ID);
  u.searchParams.set('enc', 'pcm16');
  u.searchParams.set('sr', String(IN_SAMPLE_RATE));
  u.searchParams.set('oenc', 'mulaw');
  u.searchParams.set('osr', '8000');

  console.log('[test-pcm16] connecting', { url: u.toString(), CALL_ID, IN_SAMPLE_RATE, FREQ_HZ, DURATION_MS });
  const ws = new WebSocket(u.toString(), { headers: { 'x-gateway-secret': GATEWAY_SECRET } });

  ws.on('open', () => {
    console.log('[test-pcm16] connected');
    const start = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - start > DURATION_MS) {
        clearInterval(iv);
        try { ws.close(); } catch {}
        return;
      }
      const frame = genPCM16LEFrame(FREQ_HZ, IN_SAMPLE_RATE, 20);
      try { ws.send(frame, { binary: true }); } catch (e) { console.warn('[test-pcm16] send error', e); }
    }, 20);
  });

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      console.log('[test-pcm16] downstream frame len=', (data as Buffer).length);
    } else {
      try { console.log('[test-pcm16] ctrl', (data as Buffer).toString()); } catch {}
    }
  });

  ws.on('close', (code, reason) => {
    console.log('[test-pcm16] closed', { code, reason: reason?.toString() });
  });
  ws.on('error', (e) => console.error('[test-pcm16] error', e));
}

main().catch((e) => { console.error(e); process.exit(1); });
