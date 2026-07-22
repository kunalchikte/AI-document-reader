# AI Document Reader

A full-stack application for document-based Q&A using LangChain.js, PostgreSQL with pgvector, and a React frontend.

## Features

- **Document Upload**: Support for PDF, DOCX, XLSX, and TXT files
- **Document Processing**: Extract text, chunk it, and store embeddings in PostgreSQL pgvector
- **Question & Answering**: Ask questions about documents and get contextually relevant answers
- **Multiple LLM Support**: Use either OpenAI or local Ollama models for embeddings and Q&A
- **User Interface**: Responsive web interface for document management and Q&A
- **Source References**: View document sources in answers

## Project Structure

- `/frontend`: React.js application with Material UI
- `/backend`: Node.js + Express API with LangChain.js integration

## Tech Stack

### Backend
- Node.js + Express
- LangChain.js
- PostgreSQL + pgvector (document metadata and vector chunks)
- OpenAI or Ollama for embeddings & LLM
- Multer for file uploads
- Swagger for API documentation

### Frontend
- React.js
- Material UI
- Framer Motion for animations
- Axios for API requests
- React Markdown for rendering markdown content

## Prerequisites

- Node.js >= 16
- PostgreSQL 14+ with [pgvector](https://github.com/pgvector/pgvector) extension
- OpenAI API key or Ollama running locally

## Getting Started

### Backend Setup

1. Create a PostgreSQL database and enable pgvector:
   ```sql
   CREATE DATABASE ai_documents;
   \c ai_documents
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. Set up environment variables:
   ```bash
   cd backend
   cp env-template.txt .env
   ```
   Edit `.env` with your PostgreSQL and LLM settings.

3. Install dependencies and create uploads directory:
   ```bash
   npm install
   mkdir -p uploads
   ```

4. Start the backend server:
   ```bash
   npm run start:local
   ```
   The server auto-syncs the database schema on startup.

### Frontend Setup

1. Create a `.env` file:
   ```bash
   cd frontend
   echo "REACT_APP_API_URL=http://localhost:3000" > .env
   ```

2. Install and start:
   ```bash
   npm install
   npm start
   ```

### Ollama Setup (Optional)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull required models:
   ```bash
   ollama pull llama3
   ollama pull nomic-embed-text
   ```
3. Check status via API: `GET /system/ollama/status`

## API Documentation

When the backend is running:
```
http://localhost:3000/api-docs
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `uploaded_documents` | File metadata (name, path, vectorized status) |
| `documents` | Text chunks with embeddings for vector search |

## Workflow

1. Upload a document via the frontend
2. Process the document for Q&A (creates embeddings)
3. Ask questions through the chat interface

## Building for Production

```bash
# Backend
cd backend && npm run start:prod

# Frontend
cd frontend && npm run build
```

## Docker

Configure `backend/.env` (see `backend/env-template.txt`), then:

```bash
docker compose up --build -d
```

Backend loads env from `backend/.env` via `env_file` (not baked into the image).
Use Docker hostnames when Postgres/Ollama run in other containers:

```
PG_HOST=postgres
OLLAMA_API_URL=http://ollama:11434
```

Those containers must share a Docker network with the backend.

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:3001 |
| Backend  | http://localhost:3000 |
| API Docs | http://localhost:3000/api-docs |

```bash
docker compose down
```

## License

ISC (Backend) and MIT (Frontend)
