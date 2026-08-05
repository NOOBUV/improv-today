'use client';

// Speech-to-text without leaving the machine: open the mic once, let the VAD decide when each
// utterance starts and ends, POST the audio to the same local voice server that already does TTS.
// The mic stays open for the whole conversation — no per-turn button.
// The Chrome Web Speech API stays as the fallback — see SimpleSpeech.startListening.

import { config } from './config';
import { ContinuousVad } from './vad';

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

type MicSession = {
  stop(): void;
  /** Half-duplex: shut the mic while Clara talks, re-arm when she's done. */
  setGated(gated: boolean): void;
};

/**
 * Open the mic and keep it open. Every utterance the VAD delimits is handed to `onUtterance`
 * as PCM and the VAD re-arms itself for the next one — one gesture buys the whole conversation.
 */
async function openMic(onUtterance: (pcm: Float32Array) => void): Promise<MicSession> {
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

  let frames: Float32Array[] = [];
  let frameCount = 0; // audio clock; keeps ticking while gated so the VAD's timers stay honest
  let speechFrame = -1;
  let stopped = false;
  const vad = new ContinuousVad(0);

  node.onaudioprocess = (e) => {
    // Time from the audio clock, not Date.now(): a busy main thread can't skew the hangover.
    const nowMs = ++frameCount * FRAME_MS;
    if (vad.isGated) return; // her voice is not a turn — see setGated below
    const buf = e.inputBuffer.getChannelData(0);
    frames.push(new Float32Array(buf)); // the event's buffer is reused — copy or lose it

    let sumSquares = 0;
    for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i];

    switch (vad.push(Math.sqrt(sumSquares / buf.length), nowMs)) {
      case 'speech':
        if (speechFrame < 0) speechFrame = frames.length - 1;
        break;
      case 'idle':
        speechFrame = -1; // a blip the VAD threw away — don't keep its position
        // A mic that stays open all conversation is a memory leak unless the silence is
        // dropped. Keep only the lead-in the next utterance's first syllable needs.
        if (frames.length > PRE_ROLL_FRAMES) frames.splice(0, frames.length - PRE_ROLL_FRAMES);
        break;
      case 'end': {
        const from = Math.max(0, speechFrame - PRE_ROLL_FRAMES);
        const kept = frames.slice(from);
        const pcm = new Float32Array(kept.length * FRAME_SIZE);
        kept.forEach((f, i) => pcm.set(f, i * FRAME_SIZE));
        frames = [];
        speechFrame = -1;
        onUtterance(pcm);
        break;
      }
    }
  };

  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      node.onaudioprocess = null;
      node.disconnect();
      mute.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    },
    setGated(gated: boolean) {
      vad.setGated(gated, frameCount * FRAME_MS);
      // Belt and braces: the track itself goes silent, so this is not merely "we ignore her".
      stream.getAudioTracks().forEach((t) => (t.enabled = !gated));
      if (gated) {
        frames = [];
        speechFrame = -1;
      }
    },
  };
}

export class LocalSpeech {
  private mic: MicSession | null = null;
  private inFlight: AbortController | null = null;
  private endSession: ((err?: Error) => void) | null = null;

  /** Is a hands-free session holding the mic right now? */
  get active(): boolean {
    return this.mic !== null;
  }

  /**
   * Listen for the whole conversation. Each utterance the VAD delimits is transcribed and
   * handed to `onText`. Resolves when stop() ends the session; rejects if the transcription
   * server goes away mid-session, so the caller can fall back to Chrome.
   */
  async listen(onText: (text: string) => void): Promise<void> {
    const finished = new Promise<void>((resolve, reject) => {
      this.endSession = (err) => (err ? reject(err) : resolve());
    });
    try {
      this.mic = await openMic((pcm) => {
        void this.transcribe(pcm)
          .then((text) => {
            if (text) onText(text);
          })
          .catch((err) => this.stop(err as Error));
      });
    } catch (e) {
      this.endSession = null;
      throw e;
    }
    return finished;
  }

  setGated(gated: boolean) {
    this.mic?.setGated(gated);
  }

  stop(err?: Error) {
    this.mic?.stop();
    this.mic = null;
    this.inFlight?.abort(); // an aborted fetch lands in listen()'s catch, which calls stop() again — no-op by then
    this.inFlight = null;
    const end = this.endSession;
    this.endSession = null;
    end?.(err);
  }

  private async transcribe(pcm: Float32Array): Promise<string> {
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
}
