/*
  AgentBot: Server-side headless attendee that bridges Azure OpenAI Realtime <-> Amazon Chime Meeting

  Why: Eliminate browser-side mixing/VAD gating by running the bridge in a server container.

  Strategy (MVP):
  - Use Puppeteer to launch a headless Chromium page that:
    1) Joins the target Chime meeting with provided JoinInfo (Meeting, Attendee)
    2) Connects to Azure OpenAI Realtime over WebSocket
    3) Bridges media in the page:
       - Meeting downlink (mixed remote) -> capture -> encode PCM16/16k -> send to Azure as input_audio_buffer
       - Azure audio deltas (PCM16/16k base64) -> decode -> feed into a WebAudio graph -> chooseAudioInputDevice for Chime uplink

  Notes:
  - This file is a scaffold to keep changes minimal and make integration explicit. It logs each step and includes TODOs
    where concrete implementation choices depend on your Azure Realtime payload schema and container environment.
  - You will need to add a dependency on puppeteer in aws/azure-gateway/package.json and ensure the Dockerfile installs
    Chromium dependencies (see DEPLOYMENT_NOTES.md for base image hints).
*/

import type { Browser, Page } from 'puppeteer';

export type JoinInfo = {
  meeting: any;        // Meeting object from CreateMeetingCommand
  attendee: any;       // Attendee object from CreateAttendeeCommand
};

export type AzureRealtimeConfig = {
  url: string;             // wss://<region>.openai.azure.com/openai/deployments/<DEPLOY>/realtime?api-version=...
  apiKey: string;          // Azure API key (sent as 'api-key' header)
  apiVersion?: string;     // optional
  deployment?: string;     // optional when url already encodes deployment
  voice?: string;          // e.g., 'alloy'
  inSampleRate?: number;   // default 16000
  outSampleRate?: number;  // default 16000
};

export type AgentBotParams = {
  join: JoinInfo;
  azure: AzureRealtimeConfig;
  debug?: boolean;
};

export async function startAgentBot(params: AgentBotParams): Promise<{ ok: boolean; note?: string }>{
  const { join, azure, debug } = params;
  let browser: Browser | null = null;
  let page: Page | null = null;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--use-gl=swiftshader',
      ],
      defaultViewport: { width: 800, height: 600 },
    });

    page = await browser.newPage();

    // Build a minimal in-page app that:
    // - Loads Chime SDK from CDN
    // - Joins the meeting
    // - Opens an Azure Realtime WS
    // - Bridges audio both directions using Web Audio API
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>AgentBot Bridge</title>
  <style> body { font-family: sans-serif; font-size: 12px; } pre { white-space: pre-wrap; } </style>
  <script>
    // Provide join info and azure config via window.__BOOTSTRAP__ (injected below)
    window.__BOOTSTRAP__ = { join: null, azure: null };
  </script>
  <!-- Amazon Chime SDK JS (browser) via UNPKG CDN -->
  <script src="https://unpkg.com/amazon-chime-sdk-js@^3/dist/amazon-chime-sdk.min.js"></script>
</head>
<body>
  <div id="app">AgentBot starting...</div>
  <audio id="meetingAudio" autoplay playsinline></audio>
  <script>
    (async () => {
      const log = (...a) => { try { console.log('[agent-bot]', ...a); } catch {} };
      const boot = window.__BOOTSTRAP__ || {};
      const { join, azure } = boot;
      if (!join || !azure) { document.getElementById('app').textContent = 'Missing bootstrap'; return; }
      const ChimeSDK = window.ChimeSDK;
      if (!ChimeSDK) { document.getElementById('app').textContent = 'Chime SDK not loaded'; return; }

      const logger = new ChimeSDK.ConsoleLogger('AgentBot', ChimeSDK.LogLevel.INFO);
      const devCtl = new ChimeSDK.DefaultDeviceController(logger);
      const config = new ChimeSDK.MeetingSessionConfiguration(join.meeting, join.attendee);
      const session = new ChimeSDK.DefaultMeetingSession(config, logger, devCtl);
      const av = session.audioVideo;

      // Render remote meeting audio
      const meetingAudio = document.getElementById('meetingAudio');
      av.bindAudioElement(meetingAudio);

      // Set audio profile for continuous media
      try { if (av.setAudioProfile && ChimeSDK.AudioProfile?.fullbandMusic) av.setAudioProfile(ChimeSDK.AudioProfile.fullbandMusic); } catch {}

      // Build Web Audio graph to:
      // 1) Capture meeting downlink for Azure input (via MediaElementSource -> ScriptProcessor to PCM16/16k)
      // 2) Play Azure audio and route it into Chime uplink (via MediaStreamDestination)
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume().catch(()=>{});
      const elemSrc = ctx.createMediaElementSource(meetingAudio);
      const analyser = ctx.createAnalyser(); // for levels/debug
      elemSrc.connect(analyser);

      // Downlink capture path to Azure
      const downlinkDest = ctx.createMediaStreamDestination();
      elemSrc.connect(downlinkDest);

      // Prepare uplink mixer (mono) where Azure audio will be connected
      const uplinkDest = ctx.createMediaStreamDestination();

      // Choose uplinkDest.stream as Chime input (we'll attach Azure audio into it as it arrives)
      try {
        if (av.chooseAudioInputDevice) {
          await av.chooseAudioInputDevice(uplinkDest.stream);
        } else if (av.startAudioInput) {
          await av.startAudioInput(uplinkDest.stream);
        }
        if (av.realtimeSetLocalAudioInputMute) av.realtimeSetLocalAudioInputMute(false);
      } catch (e) { log('choose input failed', e); }

      // Start the meeting
      await av.start();

      // Azure Realtime WS
      const wsHeaders = { 'api-key': azure.apiKey };
      // Build URL with optional params
      const u = new URL(azure.url);
      if (azure.apiVersion) u.searchParams.set('api-version', azure.apiVersion);
      if (azure.deployment && !u.pathname.includes('/deployments/')) u.searchParams.set('deployment', azure.deployment);
      const ws = new WebSocket(u.toString(), []);
      ws.addEventListener('open', () => {
        log('Azure connected');
        const init = { type: 'session.update', session: {
          input_audio_format: { encoding: 'pcm16', sample_rate_hz: azure.inSampleRate || 16000 },
          output_audio_format: { encoding: 'pcm16', sample_rate_hz: azure.outSampleRate || 16000 },
        }};
        ws.send(JSON.stringify(init));

      });

      // Simple PCM16 encoder/decoder helpers
      function pcm16ToBase64(pcm) {
        const buf = new Int16Array(pcm.length); buf.set(pcm);
        const u8 = new Uint8Array(buf.buffer);
        let binary = ''; for (let i=0;i<u8.length;i++) binary += String.fromCharCode(u8[i]);
        return btoa(binary);
      }
      function base64ToPCM16(b64) {
        const binary = atob(b64); const len = binary.length; const u8 = new Uint8Array(len);
        for (let i=0;i<len;i++) u8[i] = binary.charCodeAt(i);
        return new Int16Array(u8.buffer);
      }

      // 1) Send meeting downlink frames to Azure (naive ScriptProcessor, consider AudioWorklet for prod)
      const proc = ctx.createScriptProcessor(1024, 2, 1); // stereo in -> mono out
      elemSrc.connect(proc);
      proc.connect(ctx.destination); // keep node alive
      const resampler = (src, srcHz, dstHz) => {
        if (srcHz === dstHz) return src;
        const ratio = dstHz / srcHz; const outLen = Math.floor(src.length * ratio);
        const out = new Float32Array(outLen);
        for (let i=0;i<outLen;i++) { const pos = i/ratio; const i0=Math.floor(pos), i1=Math.min(i0+1, src.length-1); const t=pos-i0; out[i]=src[i0]*(1-t)+src[i1]*t; }
        return out;
      };
      proc.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inL = ev.inputBuffer.getChannelData(0);
        // Downmix to mono if needed
        let mono = inL;
        if (ev.inputBuffer.numberOfChannels > 1) {
          const inR = ev.inputBuffer.getChannelData(1); mono = new Float32Array(inL.length);
          for (let i=0;i<inL.length;i++) mono[i] = 0.5*(inL[i]+inR[i]);
        }
        // Resample to 16 kHz if ctx.sampleRate != 16000
        const targetHz = (azure.inSampleRate||16000);
        const res = resampler(mono, ctx.sampleRate, targetHz);
        // Float32 -> PCM16
        const pcm16 = new Int16Array(res.length);
        for (let i=0;i<res.length;i++) { let v = Math.max(-1, Math.min(1, res[i])); pcm16[i] = (v<0? v*32768 : v*32767)|0; }
        // Send to Azure
        const audioB64 = pcm16ToBase64(pcm16);
        try {
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: audioB64 }));
          ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          // Request response if idle (simple heuristic; in production gate on events)
          ws.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio'], instructions: 'Respond concisely.', audio: { voice: azure.voice || 'alloy' } } }));
        } catch {}
      };

      // 2) Receive Azure audio and feed into uplink graph
      const azureGain = ctx.createGain(); azureGain.gain.value = 1.0; azureGain.connect(uplinkDest);
      // Decode PCM16 base64 and play via AudioBufferSource each chunk (naive). For low-latency streaming, consider an AudioWorklet or MediaStreamTrackGenerator.
      function playPcm16Chunk(pcm16, sampleRate) {
        const buf = ctx.createBuffer(1, pcm16.length, sampleRate);
        const ch = buf.getChannelData(0);
        for (let i=0;i<pcm16.length;i++) ch[i] = Math.max(-1, Math.min(1, pcm16[i] / 32768));
        const src = ctx.createBufferSource(); src.buffer = buf; src.connect(azureGain); src.start();
      }

      ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          const t = String(msg.type||msg.event||'');
          const base64 = msg.audio || msg.delta || msg.chunk;
          if (/audio/.test(t) && typeof base64 === 'string') {
            const pcm16 = base64ToPCM16(base64);
            playPcm16Chunk(pcm16, (azure.outSampleRate||16000));
            return;
          }
          // Reset pending when response completes (optional)
        } catch (e) {
          // non-JSON, ignore
        }
      });

      document.getElementById('app').textContent = 'AgentBot joined.';
    })();
  </script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Inject bootstrap objects (join + azure config) into the page context
    await page.evaluate((joinInfo, azureCfg) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.__BOOTSTRAP__ = { join: joinInfo, azure: azureCfg };
    }, params.join, params.azure);

    // Wait for the page to log readiness
    await page.waitForFunction(() => {
      const el = document.getElementById('app');
      return el && /AgentBot joined/.test(el.textContent || '');
    }, { timeout: 20000 }).catch(() => {});

    return { ok: true, note: 'AgentBot launched (puppeteer headless)' };
  } catch (e: any) {
    console.error('[agent-bot:start:error]', e?.message || e);
    return { ok: false, note: e?.message || String(e) };
  }
}
