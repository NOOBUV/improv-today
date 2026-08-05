#!/usr/bin/env python
"""Round-trip check for the STT endpoint: Clara says a sentence, Clara transcribes it back.

    .venv/bin/python check_stt.py          # against a server already on :8880

Clara's own TTS is a legitimate test input — it is the only audio this repo can generate
without a human at a microphone, and it exercises the exact wire format the browser sends
(16kHz mono 16-bit WAV, raw body). A live mic loop is the part this cannot cover.
"""

import io
import time

import httpx
import soundfile as sf
import soxr

SERVER = "http://localhost:8880"
SENTENCE = "I had a really strange dream last night about walking through an empty airport."
BROWSER_RATE = 16000  # localSpeech.ts records at exactly this


def as_browser_wav(wav_bytes: bytes) -> bytes:
    """Re-encode TTS output the way the browser's AudioContext + encodeWav would."""
    audio, rate = sf.read(io.BytesIO(wav_bytes))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    out = io.BytesIO()
    sf.write(out, soxr.resample(audio, rate, BROWSER_RATE), BROWSER_RATE, format="WAV", subtype="PCM_16")
    return out.getvalue()


def main() -> int:
    with httpx.Client(timeout=120) as client:
        spoken = client.post(f"{SERVER}/v1/audio/speech", json={"input": SENTENCE})
        spoken.raise_for_status()
        wav = as_browser_wav(spoken.content)
        duration = (len(wav) - 44) / (BROWSER_RATE * 2)

        started = time.monotonic()
        res = client.post(
            f"{SERVER}/v1/audio/transcriptions", content=wav, headers={"Content-Type": "audio/wav"}
        )
        res.raise_for_status()
        elapsed = time.monotonic() - started

    text = res.json()["text"]
    print(f"{duration:.1f}s of audio -> {elapsed:.2f}s\n  said:  {SENTENCE}\n  heard: {text}")

    heard = set(text.lower().strip(".").split())
    said = set(SENTENCE.lower().strip(".").split())
    missed = said - heard
    # Not an exact-match assert: TTS mangles the odd word and that is the model's problem,
    # not a broken endpoint. Anything under most of the sentence means it is broken.
    assert len(missed) <= len(said) // 5, f"transcript lost too much: missing {sorted(missed)}"
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
