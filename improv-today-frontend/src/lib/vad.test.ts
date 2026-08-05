import { EnergyVad, VAD, VadEvent } from './vad';

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
