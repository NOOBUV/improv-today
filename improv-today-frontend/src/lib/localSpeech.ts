'use client';

// Speech-to-text without leaving the machine: capture the mic, let the VAD decide when the
// utterance ended, POST the audio to the same local voice server that already does TTS.
// The Chrome Web Speech API stays as the fallback — see SimpleSpeech.startListening.

import { config } from './config';
import { EnergyVad } from './vad';

const SAMPLE_RATE = 16000; // what Parakeet wants; AudioContext resamples the mic for free
const FRAME_SIZE = 1024; // 64ms per callback at 16kHz — well under the 800ms hangover
const FRAME_MS = (FRAME_SIZE / SAMPLE_RATE) * 1000;
// The VAD only trips once speech is already loud, which is a syllable or two in. Rewind.
const PRE_ROLL_FRAMES = 6; // ~384ms

/** Thrown when the mic itself is unavailable — falling back to Chrome would fail identically. */
export class MicPermissionError extends Error {}

let availability: Promise<boolean> | null = null;

/** Is the local server up and offering transcription? Cached per page load. */
export function localSttAvailable(): Promise<boolean> {
  // ponytail: no polling. A server that starts mid-session needs a page reload; one that dies
  // mid-session is caught by the POST failing, which calls markLocalSttDown() below.
  availability ??= fetch(`${config.localStt.serverUrl}/health`, {
    signal: AbortSignal.timeout(config.localStt.healthTimeout),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((h) => !!h?.stt_endpoint)
    .catch(() => false);
  return availability;
}

/** Stop trying the local path for the rest of this page load. */
export function markLocalSttDown() {
  availability = Promise.resolve(false);
}

/** Float samples to a 16-bit mono WAV — the one format soundfile reads without ffmpeg. */
export function encodeWav(pcm: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(bytes);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 32767, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/**
 * Record until the VAD says the utterance is over. Resolves with the samples, or null if
 * nothing was ever said (or the caller aborted). Registers its own aborter via `onAbort`.
 */
async function captureUtterance(onAbort: (cancel: () => void) => void): Promise<Float32Array | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new MicPermissionError('Microphone access denied or unavailable. Please allow mic permission.');
  }

  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor({ sampleRate: SAMPLE_RATE });
  const source = ctx.createMediaStreamSource(stream);
  // ponytail: ScriptProcessorNode — deprecated for a decade, still in every shipping browser,
  // and it hands over the samples. An AnalyserNode gives the energy but not the audio, so
  // that route needs a MediaRecorder alongside it and a server that can decode webm/opus.
  // AudioWorklet is the sanctioned replacement and costs a separate module file to load.
  const node = ctx.createScriptProcessor(FRAME_SIZE, 1, 1);
  // A ScriptProcessor only runs while it reaches the destination, and wiring it there
  // directly plays the microphone back out of the speakers. Silent sink.
  const mute = ctx.createGain();
  mute.gain.value = 0;

  return new Promise<Float32Array | null>((resolve) => {
    const frames: Float32Array[] = [];
    const vad = new EnergyVad(0);
    let speechFrame = -1;
    let settled = false;

    const finish = (result: Float32Array | null) => {
      if (settled) return;
      settled = true;
      node.onaudioprocess = null;
      node.disconnect();
      mute.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      resolve(result);
    };
    onAbort(() => finish(null));

    node.onaudioprocess = (e) => {
      const buf = e.inputBuffer.getChannelData(0);
      frames.push(new Float32Array(buf)); // the event's buffer is reused — copy or lose it
      // Time from the audio clock, not Date.now(): a busy main thread can't skew the hangover.
      const nowMs = frames.length * FRAME_MS;

      let sumSquares = 0;
      for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i];

      switch (vad.push(Math.sqrt(sumSquares / buf.length), nowMs)) {
        case 'speech':
          if (speechFrame < 0) speechFrame = frames.length - 1;
          break;
        case 'listening':
          speechFrame = -1; // a blip the VAD threw away — don't keep its position
          break;
        case 'timeout':
          return finish(null);
        case 'end': {
          const from = Math.max(0, speechFrame - PRE_ROLL_FRAMES);
          const kept = frames.slice(from);
          const pcm = new Float32Array(kept.length * FRAME_SIZE);
          kept.forEach((f, i) => pcm.set(f, i * FRAME_SIZE));
          return finish(pcm);
        }
      }
    };

    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
  });
}

export class LocalSpeech {
  private cancelCapture: (() => void) | null = null;
  private inFlight: AbortController | null = null;

  /** One utterance: mic in, transcript out. '' means nothing was said. */
  async listenOnce(): Promise<string> {
    const pcm = await captureUtterance((cancel) => {
      this.cancelCapture = cancel;
    });
    this.cancelCapture = null;
    if (!pcm) return '';

    this.inFlight = new AbortController();
    try {
      const res = await fetch(`${config.localStt.serverUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: encodeWav(pcm, SAMPLE_RATE),
        signal: this.inFlight.signal,
      });
      if (!res.ok) throw new Error(`Transcription server responded ${res.status}`);
      const { text } = (await res.json()) as { text?: string };
      return (text ?? '').trim();
    } finally {
      this.inFlight = null;
    }
  }

  stop() {
    this.cancelCapture?.();
    this.inFlight?.abort();
  }
}
