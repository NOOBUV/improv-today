import { ContinuousEvent, ContinuousVad, EnergyVad, VAD, VadEvent } from './vad';

const FRAME_MS = 64; // matches localSpeech's 1024-sample frame at 16kHz

/** Push `ms` worth of frames at a constant level; returns every event seen, in order. */
function feed(vad: EnergyVad, clock: { t: number }, rms: number, ms: number): VadEvent[] {
  const events: VadEvent[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
    clock.t += FRAME_MS;
    events.push(vad.push(rms, clock.t));
  }
  return events;
}

const QUIET = 0.001;
const VOICE = 0.05;

describe('EnergyVad', () => {
  let clock: { t: number };
  let vad: EnergyVad;

  beforeEach(() => {
    clock = { t: 0 };
    vad = new EnergyVad(0);
  });

  const calibrate = (floor = QUIET) => feed(vad, clock, floor, VAD.calibrationMs);

  test('speech then a hangover of silence ends the utterance', () => {
    calibrate();
    expect(feed(vad, clock, VOICE, 1000)).toContain('speech');
    const tail = feed(vad, clock, QUIET, VAD.hangoverMs + FRAME_MS * 2);
    expect(tail).toContain('end');
    // ...and not a moment before: the hangover is the whole point.
    expect(tail.indexOf('end') * FRAME_MS).toBeGreaterThanOrEqual(VAD.hangoverMs - FRAME_MS);
  });

  test('a dip between words does not end the utterance', () => {
    calibrate();
    feed(vad, clock, VOICE, 500);
    const firstWord = vad.speechStartedAt;
    // Natural inter-word gap: quiet, but shorter than the hangover.
    expect(feed(vad, clock, QUIET, VAD.hangoverMs - FRAME_MS * 2)).not.toContain('end');
    expect(feed(vad, clock, VOICE, 500)).toContain('speech');
    // One utterance, not two: the onset (and so the audio we'd send) never moved.
    expect(vad.speechStartedAt).toBe(firstWord);
  });

  test('a level that only half-fades keeps speaking (hysteresis)', () => {
    calibrate();
    feed(vad, clock, VOICE, 300);
    const half = vad.speechThreshold * 0.7; // under the start bar, over the release bar
    expect(feed(vad, clock, half, VAD.hangoverMs * 2)).not.toContain('end');
  });

  test('a cough is discarded and listening continues', () => {
    calibrate();
    feed(vad, clock, VOICE, VAD.minSpeechMs - FRAME_MS * 2);
    const after = feed(vad, clock, QUIET, VAD.hangoverMs + FRAME_MS * 2);
    expect(after).not.toContain('end');
    expect(vad.speechStartedAt).toBeNull(); // re-armed, not ended
    expect(feed(vad, clock, VOICE, 1000)).toContain('speech');
  });

  test('a noisy room calibrates upward instead of hearing speech everywhere', () => {
    const noisy = new EnergyVad(0);
    const noisyClock = { t: 0 };
    const floor = 0.02;
    feed(noisy, noisyClock, floor, VAD.calibrationMs);
    // Room tone at its own level must not read as speech...
    expect(feed(noisy, noisyClock, floor, 2000)).not.toContain('speech');
    // ...but a voice over it still does.
    expect(feed(noisy, noisyClock, floor * VAD.floorMultiplier * 1.5, 500)).toContain('speech');
  });

  test('silence alone times out rather than posting empty audio', () => {
    calibrate();
    const events = feed(vad, clock, QUIET, VAD.startTimeoutMs);
    expect(events).toContain('timeout');
    expect(events).not.toContain('end');
  });

  test('an endless talker is cut off at maxUtteranceMs', () => {
    calibrate();
    expect(feed(vad, clock, VOICE, VAD.maxUtteranceMs + 200)).toContain('end');
  });
});

describe('ContinuousVad (hands-free)', () => {
  let clock: { t: number };
  let vad: ContinuousVad;

  /** Same driver as above, against the continuous wrapper. */
  const feedC = (rms: number, ms: number): ContinuousEvent[] => {
    const events: ContinuousEvent[] = [];
    for (let elapsed = 0; elapsed < ms; elapsed += FRAME_MS) {
      clock.t += FRAME_MS;
      events.push(vad.push(rms, clock.t));
    }
    return events;
  };
  /** One whole turn: calibrate, talk, go quiet. Returns the events from the quiet part. */
  const saySomething = () => {
    feedC(QUIET, VAD.calibrationMs);
    feedC(VOICE, 1000);
    return feedC(QUIET, VAD.hangoverMs + FRAME_MS * 2);
  };

  beforeEach(() => {
    clock = { t: 0 };
    vad = new ContinuousVad(0);
  });

  test('a gated mic hears nothing — Clara talking over herself is not a turn', () => {
    feedC(QUIET, VAD.calibrationMs);
    vad.setGated(true, clock.t);
    expect(vad.isGated).toBe(true);
    // Her own voice, loud and long, straight into the mic.
    const heard = feedC(VOICE, 5000).concat(feedC(QUIET, VAD.hangoverMs * 2));
    expect(heard.every((e) => e === 'idle')).toBe(true);
  });

  test('re-arms when the gate lifts: the next thing the user says is a turn', () => {
    feedC(QUIET, VAD.calibrationMs);
    vad.setGated(true, clock.t);
    feedC(VOICE, 3000); // Clara's reply, swallowed
    vad.setGated(false, clock.t);
    expect(vad.isGated).toBe(false);

    // Calibration runs again on the room as it is now, then the user speaks.
    expect(saySomething()).toContain('end');
  });

  test('one utterance ending arms the next — nobody presses anything', () => {
    expect(saySomething()).toContain('end');
    expect(saySomething()).toContain('end');
    expect(saySomething()).toContain('end');
  });

  test('silence never ends the session, and speech after a long pause still lands', () => {
    feedC(QUIET, VAD.calibrationMs);
    // Well past the single-shot startTimeoutMs, which would have handed the turn back.
    const quiet = feedC(QUIET, VAD.startTimeoutMs * 2);
    expect(quiet.every((e) => e === 'idle')).toBe(true);
    expect(feedC(VOICE, 1000)).toContain('speech');
    expect(feedC(QUIET, VAD.hangoverMs + FRAME_MS * 2)).toContain('end');
  });

  test('gating mid-utterance drops it rather than sending half a sentence', () => {
    feedC(QUIET, VAD.calibrationMs);
    expect(feedC(VOICE, 500)).toContain('speech');
    vad.setGated(true, clock.t);
    vad.setGated(false, clock.t);
    // The half-said sentence is gone: what follows is a fresh calibration, not an 'end'.
    expect(feedC(QUIET, VAD.hangoverMs * 2)).not.toContain('end');
  });
});
