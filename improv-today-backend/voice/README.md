# Clara voice server (Qwen3-TTS out, Parakeet in)

Local, host-side speech so Clara has a real voice instead of the browser's robot, and
hears you without shipping the audio to Google. Runs OUTSIDE docker on purpose — the
models are GBs and have no business in the prod API image.

## TTS

Two engines, both loaded:

- **Qwen3-TTS** (`mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-bf16`, speaker `vivian`)
  is the voice. It takes an `instruct` string, which is how Clara's emotion reaches the
  audio instead of stopping at the transcript.
- **Kokoro** is the fallback. Any Qwen3 exception, or a synthesis that overruns
  `SYNTH_TIMEOUT_S`, logs a warning and gets answered by Kokoro instead.

## Setup (once)

```
./setup.sh
```

Makes a python 3.12 venv (onnxruntime has no wheels for the host's 3.14), installs
`voice/requirements.txt`, and downloads the two Kokoro model files into `voice/models/`
(gitignored). The ~2.3GB of Qwen3 weights download themselves into the default
Hugging Face cache (`~/.cache/huggingface`) the first time the server starts.

## Run

```
cd voice && .venv/bin/uvicorn app:app --port 8880
```

Startup loads Qwen3 and runs one throwaway generation so the first real request isn't
paying warm-up cost: ~10s once the weights are on disk, minutes on the first-ever run.

## API

- `GET /health` → engine readiness (`engine` is whichever is tried first; `qwen3` reads
  `unavailable (...)` if it failed to load), plus `streaming`/`streaming_endpoint` and the
  `stt_*` fields the browser gates its local-STT path on
- `POST /v1/audio/speech/stream` → **the fast path.** Raw PCM `s16le` mono, one chunk per
  ~`STREAM_INTERVAL_S` of audio, sample rate in the `X-Sample-Rate` header,
  `Content-Type: application/octet-stream`. Not WAV: a header written before the length is
  known is a lie the client then has to un-believe.
- `POST /v1/audio/speech` → the whole WAV in one response. Kept for callers that can't stream.
- `POST /v1/audio/transcriptions` → audio in, transcript out. See **STT** below.

Both take the same OpenAI-shaped body plus an emotion:
`{"input": "...", "emotion": "calm", "voice": "af_heart", "speed": 1.0}`

`emotion` is one of Clara's `EmotionType` values — `calm` (default), `happy`, `sad`,
`stressed`, `sassy` — mapped to a Qwen3 `instruct` string by `INSTRUCT` in `app.py`.
Anything unrecognised falls back to `calm` rather than erroring. `voice` and `speed`
apply to the Kokoro path only; Qwen3 is pinned to `vivian`.

Warm, on an M2: first chunk in ~0.9-1.1s whatever the sentence length, then generation runs
a little faster than playback. The whole-WAV endpoint instead costs the full synthesis before
a single byte — 3.5s for a short line, 8.8s for a long one.

### Fallback on the streaming path

If Qwen3 hasn't produced its **first** chunk within `FIRST_CHUNK_TIMEOUT_S`, or dies before it,
the response is a complete Kokoro WAV instead — so callers must branch on `Content-Type`.
Nothing audible has been committed at that point, so the swap is invisible. Once chunks are
flowing the stream is allowed to run to `MAX_TOKENS`; `SYNTH_TIMEOUT_S` applies to the
whole-WAV endpoint only. The deadline starts when the generation actually owns the model, not
when the request arrived — otherwise a prefetched sentence queued behind its predecessor would
fail it every time.

## STT

`POST /v1/audio/transcriptions` — **raw 16-bit mono WAV bytes as the request body**, not
multipart, despite the OpenAI-shaped path. One caller, one format, and it skips the
python-multipart dependency. Answers `{"text": "..."}`. 400 on an empty body, 413 past
`MAX_AUDIO_S` (60s), 422 if the audio won't decode.

`mlx-community/parakeet-tdt-0.6b-v2`, loaded on the **first transcription**, not at startup —
a session that only ever speaks never pays the ~1.3s load or the ~0.9GB. It runs on one
dedicated worker thread, because MLX streams are thread-local: a model loaded on one thread
raises `no Stream(cpu, 1) in current thread` when run from another. That single worker also
serializes STT for free, so there is no lock, and it never shares `synth_lock` — a prefetched
TTS sentence must not queue behind the transcript that asked for it.

Warm, on an M2 with Qwen3 also resident: **~0.20s to transcribe a 5s utterance**; ~0.7s for
the first request after the GPU has been idle a while. Measured against
`mlx-community/whisper-large-v3-turbo` on the same 6.4s clip: 0.24s vs 2.29s warm, identical
transcript, 0.9GB vs 1.6GB resident. Parakeet is the smaller *and* faster one, which on 16GB
shared with a 2.3GB TTS model settles it. Parakeet is English-only; that is the trade.

```
.venv/bin/python check_stt.py     # Clara says a sentence, Clara transcribes it back
```

## How the frontend uses it

### Hearing (`src/lib/localSpeech.ts` + `vad.ts`)

The browser records the mic through a `ScriptProcessorNode` at 16kHz, computes RMS energy per
64ms frame, and hands it to `EnergyVad` — a small state machine that calibrates to the room's
noise floor for 400ms, then calls the utterance over after 800ms of silence. That replaces the
1.8s "Chrome stopped sending interim results" watchdog, which measured the *recogniser* going
quiet rather than the *user*, and is the reason the UI used to stick on "Listening...". On
`end` it encodes the samples (plus ~380ms of pre-roll, or the first syllable is clipped) as a
WAV and POSTs them here.

`SimpleSpeech.startListening` picks the path: local if `config.localStt.enabled` and this
server answers `/health`, otherwise Chrome's Web Speech API — the same
local-first-then-browser shape as TTS. A failed transcription marks local down for the rest of
the page load and the next turn goes to Chrome. `NEXT_PUBLIC_LOCAL_STT=false` turns it off
entirely. Either way the caller sees one final result and a resolved promise, so
`SpeechInterface` needed no changes at all.

### Speaking (`src/lib/speech.ts`)

`BrowserSpeechService` (frontend `src/lib/speech.ts`) POSTs each sentence to the streaming
endpoint and schedules the PCM chunks back-to-back through Web Audio, so Clara starts talking
while the rest is still being generated. It reads one sentence ahead: when sentence N starts
playing, N+1's request is already in flight and waiting on this server's lock. The turn's
emotion comes off the conversation stream's `context_ready` event — which lands before the
first chunk, so even the opening sentence is in character. On any failure — server down,
non-200, fetch error — it falls back to `window.speechSynthesis` silently. Nothing breaks if
this server isn't running; Clara just sounds worse. CORS allows `http://localhost:3000` only,
and must expose `X-Sample-Rate` or the browser can't decode what it's given.

## Notes

- ponytail: one process, one lock around the model, no cache. The frontend's read-ahead means
  a second request now genuinely waits at that lock — it starts the instant the current
  sentence finishes generating, which is what you want from one GPU. Kokoro has its own lock so
  it stays servable while an abandoned Qwen3 generation winds down.
- Qwen3 occasionally rambles on low-energy lines, so generation is capped at `MAX_TOKENS`
  (~20s of audio at the 12Hz codec rate) and the whole call at `SYNTH_TIMEOUT_S`.
- Energy VAD cannot tell speech from a door slam. If a real room defeats the constants in
  `vad.ts`, the upgrade is silero via `@ricky0123/vad-web` behind the same `push()` interface —
  not a rewrite of the caller. Tune the constants first; a dependency that ships a neural net
  is not the first thing you reach for.
