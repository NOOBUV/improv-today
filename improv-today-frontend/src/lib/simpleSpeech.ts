import { config } from './config';
import { LocalSpeech, MicPermissionError, localSttAvailable, markLocalSttDown } from './localSpeech';

export type SpeechListener = (result: { transcript: string; isFinal: boolean }) => void;

// Minimal DOM type guards for browsers that expose webkit speech recognition
type AnySpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export class SimpleSpeech {
  private recognition?: AnySpeechRecognition;
  private isSpeaking = false;
  private preferredVoice?: SpeechSynthesisVoice;
  private local = new LocalSpeech();


  constructor() {
    type SpeechWindow = {
      SpeechRecognition?: new () => AnySpeechRecognition;
      webkitSpeechRecognition?: new () => AnySpeechRecognition;
    };
    const SpeechRecognitionImpl =
      (typeof window !== 'undefined' && (window as unknown as SpeechWindow).SpeechRecognition) ||
      (typeof window !== 'undefined' && (window as unknown as SpeechWindow).webkitSpeechRecognition);
    if (SpeechRecognitionImpl) {
      const rec: AnySpeechRecognition = new SpeechRecognitionImpl();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      this.recognition = rec;
    }

    // Initialize voices and set default to Google UK English Female if available
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const setDefaultVoice = () => {
        const voices = window.speechSynthesis.getVoices() || [];
        const defaultVoice = this.pickDefaultUkFemaleVoice(voices);
        if (defaultVoice) {
          this.preferredVoice = defaultVoice;
        }
        if (!this.preferredVoice && voices.length > 0) {
          // Robust fallback order if Google UK Female isn't present
          this.preferredVoice =
            voices.find(v => v.name === 'Samantha') ||
            voices.find(v => v.name === 'Alex') ||
            voices.find(v => /^en-GB/i.test(v.lang || '')) ||
            voices.find(v => /^en-/i.test(v.lang || '')) ||
            voices.find(v => v.default) ||
            voices[0];
        }
      };
      setDefaultVoice();
      window.speechSynthesis.onvoiceschanged = () => setDefaultVoice();
    }
  }

  public canListen(): boolean {
    // Whether the local server is actually up is only knowable asynchronously; startListening
    // finds out and falls back. This just says "some path exists".
    return !!this.recognition || config.localStt.enabled;
  }

  public async speak(text: string): Promise<void> {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    await this.stopListening();
    this.isSpeaking = true;
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
        // Align language if voice is en-GB
        if (this.preferredVoice.lang && this.preferredVoice.lang.toLowerCase().startsWith('en-gb')) {
          utterance.lang = 'en-GB';
        }
      }
      utterance.onend = () => {
        this.isSpeaking = false;
        resolve();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  public async startListening(onResult: SpeechListener): Promise<void> {
    if (this.isSpeaking) return;

    // Local first: real VAD decides when the utterance ended, and the audio never leaves the
    // machine. Mirrors how speech.ts prefers the local voice server over speechSynthesis.
    if (config.localStt.enabled && (await localSttAvailable())) {
      try {
        const text = await this.local.listenOnce();
        // One final result, then resolve — same contract as Chrome's continuous:false session.
        if (text) onResult({ transcript: text, isFinal: true });
        return;
      } catch (e) {
        if (e instanceof MicPermissionError) throw e; // Chrome would fail on this too
        console.warn('Local STT failed, falling back to Chrome Web Speech:', e);
        markLocalSttDown();
      }
    }

    if (!this.recognition) {
      throw new Error('Speech recognition unavailable. Start the local voice server, or use Chrome/Edge.');
    }

    // Ensure microphone permission (Brave and some Chromium derivatives require this)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately; we just needed permission
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      throw new Error('Microphone access denied or unavailable. Please allow mic permission.');
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition) return reject(new Error('Speech recognition unavailable'));

      this.recognition.onresult = (event: unknown) => {
        const evt = event as { resultIndex: number; results: Array<{ 0: { transcript: string }; isFinal: boolean }> };
        let transcript = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          transcript += evt.results[i][0].transcript;
          const isFinal = evt.results[i].isFinal;
          onResult({ transcript, isFinal });
        }
      };

      this.recognition.onerror = (e: unknown) => {
        const err = e as { error?: string };
        if (err?.error === 'no-speech') {
          // Non-fatal; resolve to allow caller to continue UI loop
          return resolve();
        }
        if (err?.error === 'network') {
          return reject(new Error('Speech recognition network error.'));
        }
        if (err?.error === 'not-allowed') {
          return reject(new Error('Microphone permission blocked. Please allow mic access in browser settings.'));
        }
        if (err?.error === 'audio-capture') {
          return reject(new Error('No microphone detected.'));
        }
        return reject(e);
      };

      this.recognition.onend = () => {
        resolve();
      };

      try {
        this.recognition.start();
      } catch {
        // Some browsers throw if already started. Stop and retry once.
        try {
          this.recognition.stop();
          this.recognition.start();
        } catch (err) {
          reject(err as unknown);
        }
      }
    });
  }

  public async stopListening(): Promise<void> {
    this.local.stop(); // no-op unless a capture or transcription is in flight
    if (!this.recognition) return;
    try {
      this.recognition.stop();
    } catch {}
  }

  private pickDefaultUkFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    if (!voices || voices.length === 0) return undefined;

    // 1) Exact common Chrome voice name
    let v = voices.find((vv) => vv.name === 'Google UK English Female');
    if (v) return v;

    // 2) Name contains Google + UK + Female
    v = voices.find((vv) => /google/i.test(vv.name) && /uk/i.test(vv.name) && /female/i.test(vv.name));
    if (v) return v;

    // 3) en-GB + Google
    v = voices.find((vv) => /^en-GB/i.test(vv.lang || '') && /google/i.test(vv.name));
    if (v) return v;

    // 4) Any en-GB
    v = voices.find((vv) => /^en-GB/i.test(vv.lang || ''));
    if (v) return v;

    // 5) Fallback first English voice
    v = voices.find((vv) => /^en-/i.test(vv.lang || ''));
    if (v) return v;

    // 6) Fallback to default
    return voices[0];
  }
}


