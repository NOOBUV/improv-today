# Clara, the Digital Companion

Clara is a voice companion with a life of her own. She has a daily schedule, she remembers what you tell her, and she talks back hands-free with emotion.

https://github.com/user-attachments/assets/38d9e509-8629-49f8-8950-387d399bc6c3

Clara explains how she works, in her own voice (1:57). If the player does not load, [download the video](docs/media/clara-explains-clara.mp4).

## How she works

- **Her life:** a Celery schedule gives her new events every hour. An LLM reacts in character and updates her mood, stress, and energy in Postgres.
- **Her memory:** pgvector recalls past conversations. A nightly job turns the day into memories, and your stories stay yours.
- **Her voice:** browser VAD detects the end of your speech. Parakeet transcribes locally, Gemini writes the reply, and Qwen3-TTS on MLX speaks it with the right emotion. The first audio plays about one second after your last word.
- **Her face:** the app's backdrop changes color with her mood.

## Repository layout

| Folder | What it holds |
| --- | --- |
| [`improv-today-backend/`](improv-today-backend/README.md) | FastAPI, Celery + Redis, Postgres + pgvector, local voice models |
| [`improv-today-frontend/`](improv-today-frontend/README.md) | Next.js app with the voice orb UI |
| [`docs/`](docs/) | PRD, architecture, and stories |

Stack: FastAPI, Celery + Redis, Postgres + pgvector, Next.js, Gemini, Qwen3-TTS, Parakeet, Auth0, Stripe.

Built end to end by Utkarsh.
