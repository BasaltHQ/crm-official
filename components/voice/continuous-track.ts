// Continuous audio source using MediaStreamTrackGenerator + WebCodecs AudioData
// Produces a steady sine baseline to defeat VAD/DTX gating in capture/transmit paths.
// Chromium-only at the moment; feature-detected with graceful fallback.

export type ContinuousAudioOptions = {
  sampleRate?: number;        // Hz, default 48000
  channelCount?: number;      // mono only supported here
  framesPerChunk?: number;    // number of frames per write, default 960 (~20 ms at 48k)
  frequency?: number;         // Hz for baseline tone, default 1000
  amplitude?: number;         // 0..1 amplitude, default 0.03 (~-30 dBFS)
};

export type ContinuousAudioController = {
  stream: MediaStream;                  // MediaStream wrapping the generator track
  start: () => Promise<void>;           // begin writing frames continuously
  stop: () => Promise<void>;            // stop writing and close the track
  setTone: (opts: { frequency?: number; amplitude?: number }) => void; // live adjust
  isSupported: boolean;                 // whether MSTG + AudioData are available
};

export type PushAudioController = {
  stream: MediaStream;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  writeF32: (data: Float32Array) => Promise<void>;
  isSupported: boolean;
};

function hasSupport(): boolean {
  const w = (typeof window !== 'undefined') ? (window as any) : {};
  return !!(w.MediaStreamTrackGenerator && w.AudioData);
}

export function createContinuousAudioStream(options: ContinuousAudioOptions = {}): ContinuousAudioController | null {
  const isSupported = hasSupport();
  const sampleRate = options.sampleRate ?? 48000;
  const channelCount = options.channelCount ?? 1;
  const framesPerChunk = options.framesPerChunk ?? 960; // ~20 ms at 48k
  let frequency = options.frequency ?? 1000;
  let amplitude = options.amplitude ?? 0.03; // ~-30 dBFS

  if (!isSupported) {
    try {
      let ctx: any = null;
      try {
        const W: any = window as any;
        if (W.AudioContext) {
          ctx = new W.AudioContext({ sampleRate });
        } else if (W.webkitAudioContext) {
          ctx = new W.webkitAudioContext({ sampleRate });
        }
      } catch {}
      const dest = ctx?.createMediaStreamDestination?.();
      // Fallback: inject an oscillator for keepalive so callers can still get a stream
      const osc = ctx?.createOscillator?.();
      const gain = ctx?.createGain?.();
      if (osc && gain && dest) {
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.value = amplitude;
        osc.connect(gain);
        gain.connect(dest);
        try { osc.start(); } catch {}
        const stream = dest.stream as MediaStream;
        return {
          stream,
          start: async () => { try { await (ctx as any)?.resume?.(); } catch {} },
          stop: async () => { try { osc?.stop?.(); osc?.disconnect?.(); gain?.disconnect?.(); await ctx?.close?.(); } catch {} },
          setTone: (opts) => { if (opts.frequency) osc!.frequency.value = opts.frequency; if (opts.amplitude != null) gain!.gain.value = opts.amplitude!; },
          isSupported: false,
        };
      }
    } catch {}
    return null;
  }

  const w = window as any;
  const generator = new w.MediaStreamTrackGenerator({ kind: 'audio' });
  const writer: WritableStreamDefaultWriter<any> = generator.writable.getWriter();
  const track = generator as MediaStreamTrack;
  const stream = new MediaStream([track]);

  let running = false;
  let framesWritten = 0; // for timestamp derivation
  let timer: any = null;

  // Pre-allocated buffer reused across writes
  const dataF32 = new Float32Array(framesPerChunk * channelCount);

  const writeChunk = async () => {
    try {
      // Generate mono sine
      for (let i = 0; i < framesPerChunk; i++) {
        const t = (framesWritten + i) / sampleRate; // seconds
        const s = Math.sin(2 * Math.PI * frequency * t) * amplitude;
        dataF32[i] = s;
      }
      const timestampUS = Math.round((framesWritten / sampleRate) * 1_000_000); // microseconds
      const audioData = new w.AudioData({
        format: 'f32',
        sampleRate,
        numberOfFrames: framesPerChunk,
        numberOfChannels: channelCount,
        timestamp: timestampUS,
        data: dataF32.buffer,
      });
      await writer.write(audioData);
      audioData.close?.();
      framesWritten += framesPerChunk;
    } catch (e) {
      // Swallow write errors when stopping
      // console.warn('[MSTG_WRITE_ERR]', e);
    }
  };

  const start = async () => {
    if (running) return;
    running = true;
    framesWritten = 0;
    // Drive at ~20ms cadence
    timer = setInterval(writeChunk, Math.round((framesPerChunk / sampleRate) * 1000));
    // Kick first write synchronously to avoid initial silence
    await writeChunk();
  };

  const stop = async () => {
    if (!running) return;
    running = false;
    try { clearInterval(timer); } catch {}
    timer = null;
    try { await writer.close(); } catch {}
    try { (track as any).stop?.(); } catch {}
  };

  const setTone = (opts: { frequency?: number; amplitude?: number }) => {
    if (opts.frequency != null) frequency = opts.frequency!;
    if (opts.amplitude != null) amplitude = opts.amplitude!;
  };

  return { stream, start, stop, setTone, isSupported };
}

export function createPushAudioStream(options: ContinuousAudioOptions = {}): PushAudioController | null {
  const isSupported = hasSupport();
  const sampleRate = options.sampleRate ?? 48000;
  const channelCount = options.channelCount ?? 1;
  let framesWritten = 0;

  if (!isSupported) {
    // Fallback: return null; caller should use mixer stream directly
    return null;
  }

  const w = window as any;
  const generator = new w.MediaStreamTrackGenerator({ kind: 'audio' });
  const writer: WritableStreamDefaultWriter<any> = generator.writable.getWriter();
  const track = generator as MediaStreamTrack;
  const stream = new MediaStream([track]);

  let running = false;

  const start = async () => { running = true; };
  const stop = async () => {
    running = false;
    try { await writer.close(); } catch {}
    try { (track as any).stop?.(); } catch {}
  };

  const writeF32 = async (dataF32: Float32Array) => {
    if (!running) return;
    try {
      const numberOfFrames = dataF32.length / channelCount;
      const timestampUS = Math.round((framesWritten / sampleRate) * 1_000_000);
      const audioData = new w.AudioData({
        format: 'f32', sampleRate, numberOfFrames, numberOfChannels: channelCount, timestamp: timestampUS, data: dataF32.buffer,
      });
      await writer.write(audioData);
      audioData.close?.();
      framesWritten += numberOfFrames;
    } catch {}
  };

  return { stream, start, stop, writeF32, isSupported };
}
