/*
 Test client for Azure Realtime Gateway /ingest
 - Connects to the gateway WS
 - Sends a control message {type:'say', text:'...'}
 - Receives a single aggregated audio clip from the gateway and saves it to a WAV file

 Usage:
 - Configure environment variables via .env or shell:
   GATEWAY_URL=wss://your-gateway-host
   GATEWAY_SHARED_SECRET=... (or GATEWAY_SECRET)
   SAY_TEXT="Hello from the bridge"
   OUT_ENCODING=pcm16  # pcm16 or mulaw
   OUT_SAMPLE_RATE=16000
   OUT_FILE=out.wav
   CALL_ID=dev-test-001

 - Run with ts-node (see package.json script): pnpm run test-say
*/

import { WebSocket } from 'ws';
import fs from 'fs';

const GATEWAY_URL = (process.env.GATEWAY_URL || '').replace(/\/$/, '');
const SECRET = process.env.GATEWAY_SECRET || process.env.GATEWAY_SHARED_SECRET || '';
const TEXT = process.env.SAY_TEXT || 'Hello from the bridge';
const OUT_ENCODING = (process.env.OUT_ENCODING || 'pcm16').toLowerCase(); // pcm16 | mulaw
const OUT_SAMPLE_RATE = Number(process.env.OUT_SAMPLE_RATE || 16000);
const OUT_FILE = process.env.OUT_FILE || 'out.wav';
const CALL_ID = process.env.CALL_ID || `say-${Date.now()}`;

if (!GATEWAY_URL) {
  console.error('GATEWAY_URL is required');
  process.exit(1);
}
if (!SECRET) {
  console.error('GATEWAY_SHARED_SECRET or GATEWAY_SECRET is required');
  process.exit(1);
}

function buildWsUrl(): string {
  const url = new URL(GATEWAY_URL);
  // Ensure path ends with /ingest
  if (!url.pathname.endsWith('/ingest')) {
    url.pathname = (url.pathname.replace(/\/$/, '')) + '/ingest';
  }
  url.searchParams.set('callId', CALL_ID);
  url.searchParams.set('oenc', OUT_ENCODING);
  url.searchParams.set('osr', String(OUT_SAMPLE_RATE));
  return url.toString();
}

function writeWavPCM16Mono(filePath: string, pcm: Buffer, sampleRate: number) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const riffSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(riffSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format code
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}

function writeWavMuLawMono(filePath: string, mu: Buffer, sampleRate: number) {
  const numChannels = 1;
  const bitsPerSample = 8;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = mu.length;
  const riffSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(riffSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16); // fmt chunk size with extension
  header.writeUInt16LE(7, 20); // mu-law format code
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.writeUInt16LE(0, 36); // cbSize (no extra bytes)
  header.write('data', 38);
  header.writeUInt32LE(dataSize, 42);

  fs.writeFileSync(filePath, Buffer.concat([header, mu]));
}

async function main() {
  const wsUrl = buildWsUrl();
  console.log('Connecting to', wsUrl);
  const ws = new WebSocket(wsUrl, { headers: { 'x-gateway-secret': SECRET } });

  ws.on('open', () => {
    console.log('WS open. Sending say control...');
    const ctrl = { type: 'say', text: TEXT };
    ws.send(JSON.stringify(ctrl));
  });

  let received = false;
  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      console.log('Non-binary message:', data.toString());
      return;
    }
    const buf = Buffer.from(data as Buffer);
    const secs = OUT_ENCODING === 'pcm16' ? (buf.length / 2) / OUT_SAMPLE_RATE : (buf.length / OUT_SAMPLE_RATE);
    console.log('Received audio clip bytes=', buf.length, 'approx seconds=', secs.toFixed(2));

    try {
      if (OUT_ENCODING === 'pcm16') writeWavPCM16Mono(OUT_FILE, buf, OUT_SAMPLE_RATE);
      else writeWavMuLawMono(OUT_FILE, buf, OUT_SAMPLE_RATE);
      console.log('Wrote', OUT_FILE);
    } catch (e) {
      console.error('Failed to write WAV', e);
    }

    received = true;
    ws.close();
  });

  ws.on('close', (code, reason) => {
    console.log('WS closed', code, String(reason || ''));
    if (!received) console.log('No audio received. Check gateway and Azure config.');
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('WS error', err);
  });
}

main().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
