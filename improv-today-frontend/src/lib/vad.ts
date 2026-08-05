// Voice activity detection from Web Audio RMS energy.
//
// This replaces the blind 1.8s "no new interim results" timer the Chrome path leans on
// (config.speech.interimSilenceTimeout). That timer measures the recogniser going quiet,
// which is not the same thing as the user going quiet — hence the state-doesn't-change bug.
// Energy measures the microphone, which is.
//
// ponytail: energy VAD, not a model. It cannot tell speech from a door slam, so a noisy
// room will end utterances early and start them on nothing. Upgrade path is silero via
// `@ricky0123/vad-web` (~2MB wasm + onnx) behind this same push()/VadEvent interface —
// swap the implementation, keep the caller. Do that only if the knobs below can't be tuned
// to a real room; a dependency that ships a neural net is not the first thing you reach for.

export const VAD = {
  // The room sets the floor, not this file. Absolute thresholds are the reason energy VAD
  // gets a bad name: a laptop mic in a cafe idles above the level a headset calls speech.
  calibrationMs: 400, // ambient measured at the top of every session, before we listen
  floorMultiplier: 3.0, // speech must beat the measured noise floor by this much
  minSpeechRms: 0.008, // ...but never trust a floor of ~0 from a muted/dead mic
  releaseRatio: 0.55, // hysteresis: once speaking, stay speaking down to 55% of the threshold
  minSpeechMs: 250, // a cough, a click, a chair — not an utterance. Discard and re-arm.
  hangoverMs: 800, // silence this long after speech ends the utterance
  startTimeoutMs: 9000, // never heard anything at all: give the turn back
  maxUtteranceMs: 30000, // hard stop, also the server's audio cap
};

export type VadConfig = typeof VAD;

// 'listening' = nothing yet (or a blip we threw away), 'speech' = mid-utterance,
// 'end' = utterance complete, transcribe it, 'timeout' = silence only, nothing to send.
export type VadEvent = 'listening' | 'speech' | 'end' | 'timeout';

export class EnergyVad {
  private floorSum = 0;
  private floorCount = 0;
  private threshold = Infinity; // until calibration finishes, nothing counts as speech
  private speechStartMs: number | null = null;
  private lastLoudMs = 0;
  private done = false;

  constructor(private readonly startMs: number, private readonly cfg: VadConfig = VAD) {}

  /** Milliseconds into the session at which speech began, or null if it hasn't. */
  get speechStartedAt(): number | null {
    return this.speechStartMs;
  }

  /** The calibrated speech threshold, for surfacing in a mic-level UI. */
  get speechThreshold(): number {
    return this.threshold;
  }

  push(rms: number, nowMs: number): VadEvent {
    if (this.done) return 'end';
    const elapsed = nowMs - this.startMs;

    if (elapsed < this.cfg.calibrationMs) {
      this.floorSum += rms;
      this.floorCount++;
      return 'listening';
    }
    if (this.threshold === Infinity) {
      const floor = this.floorCount ? this.floorSum / this.floorCount : 0;
      this.threshold = Math.max(this.cfg.minSpeechRms, floor * this.cfg.floorMultiplier);
    }

    const speaking = this.speechStartMs !== null;
    // Hysteresis: a lower bar to keep talking than to start. Without it, the natural dips
    // between words cross back under a single threshold and chop one sentence into three.
    const loud = rms >= this.threshold * (speaking ? this.cfg.releaseRatio : 1);

    if (loud) {
      this.lastLoudMs = nowMs;
      if (!speaking) this.speechStartMs = nowMs;
      if (nowMs - this.speechStartMs! >= this.cfg.maxUtteranceMs) return this.finish();
      return 'speech';
    }

    if (speaking) {
      if (nowMs - this.lastLoudMs < this.cfg.hangoverMs) return 'speech';
      // Long enough to be words? Send it. Otherwise forget it happened and keep waiting —
      // re-arming rather than ending is what stops a cough from posting empty audio.
      if (this.lastLoudMs - this.speechStartMs! >= this.cfg.minSpeechMs) return this.finish();
      this.speechStartMs = null;
      return 'listening';
    }

    return elapsed >= this.cfg.startTimeoutMs ? 'timeout' : 'listening';
  }

  private finish(): VadEvent {
    this.done = true;
    return 'end';
  }
}

/** What a hands-free session cares about. 'idle' folds together "nothing yet" and "gated". */
export type ContinuousEvent = 'idle' | 'speech' | 'end';

/**
 * Hands-free driver over EnergyVad: one mic session, many turns. Two differences from the
 * single-shot machine above — an utterance ending re-arms instead of finishing, and silence
 * never times the session out, because nobody is waiting to press a button again.
 */
export class ContinuousVad {
  private vad: EnergyVad;
  private gated = false;

  constructor(startMs = 0, private readonly cfg: VadConfig = VAD) {
    this.vad = new EnergyVad(startMs, cfg);
  }

  /** Nothing was captured this frame — the caller should not even buffer it. */
  get isGated(): boolean {
    return this.gated;
  }

  /**
   * Half-duplex: closed while Clara speaks so her own voice cannot open a turn.
   * Lifting the gate re-arms on the room as it is now, not as it was before she started.
   */
  setGated(gated: boolean, nowMs: number) {
    if (gated === this.gated) return;
    this.gated = gated;
    if (!gated) this.vad = new EnergyVad(nowMs, this.cfg);
  }

  push(rms: number, nowMs: number): ContinuousEvent {
    if (this.gated) return 'idle';
    const event = this.vad.push(rms, nowMs);
    if (event === 'end') {
      this.vad = new EnergyVad(nowMs, this.cfg); // next turn, immediately
      return 'end';
    }
    // 'timeout' is a single-shot concept: it exists to hand the turn back to a button.
    return event === 'speech' ? 'speech' : 'idle';
  }
}
