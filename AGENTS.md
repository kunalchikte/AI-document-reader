## Learned User Preferences

- Prefer cleaning out ad-hoc debug/test scripts; keep the repo focused on the running app.
- Use PostgreSQL + pgvector only for document metadata and vectors — do not reintroduce MongoDB or Supabase as the primary store.
- Docker images should stay minimal: do not bake or COPY `.env` into Dockerfiles; load env via `env_file` / host `.env`.
- App `docker-compose.yml` should run frontend and backend only; Postgres and Ollama are expected as separate containers — point `PG_HOST` / `OLLAMA_API_URL` at those services.
- Require user login with per-user document isolation (users must not see others’ documents).
- Uploaded documents must be fully purged after 7 days (files, DB rows, embeddings, and chat history).
- Use Ollama for embeddings only; use Gemini (`GEMINI_API_KEY`) for chat/Q&A conversations.
- Prefer Gemini models/settings that reduce free-tier 429s (e.g. flash-lite + request spacing / fallbacks).
- UI should feel realistic, attractive, and responsive; fix weak/ugly default fonts when they stand out.

## Learned Workspace Facts

- Stack is a React frontend and Express backend for an AI document Q&A app (upload → embed → chat with sources).
- Vector chunks live in Postgres `documents` (pgvector); upload metadata in `uploaded_documents`; auth is JWT-based.
- Root `docker-compose.yml` builds/runs `backend` (:3000) and `frontend` (:3001→80) with `backend/.env` via `env_file`.
- Default model env: `EMBEDDING_MODEL=ollama`, `LLM_MODEL=gemini`, embedding model `nomic-embed-text`.
- Retention runs an hourly 7-day purge job via `retentionService`.
- Frontend typography uses Plus Jakarta Sans through CSS variables (`--font-display` / `--font-body`).
