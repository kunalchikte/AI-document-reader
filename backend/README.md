# AI Document Reader Backend

A document-based Q&A application using LangChain.js and PostgreSQL with pgvector.

## Features

- File Upload: Support for PDF, DOCX, XLSX, and TXT files
- Document Ingestion: Extract text, chunk it, and store embeddings in pgvector
- Q&A: Ask questions about documents and get contextually relevant answers
- Multiple LLM Support: Use either OpenAI or local Ollama models for embeddings and Q&A

## Tech Stack

- Node.js + Express
- LangChain.js
- PostgreSQL + pgvector
- OpenAI or Ollama for embeddings & LLM
- Multer for file uploads
- Swagger for API documentation

## Setup Instructions

### Prerequisites

- Node.js >= 16
- PostgreSQL 14+ with pgvector extension
- OpenAI API key or Ollama running locally

### PostgreSQL Setup

```sql
CREATE DATABASE ai_documents;
\c ai_documents
CREATE EXTENSION IF NOT EXISTS vector;
```

The application automatically creates these tables on startup:

- `uploaded_documents` — file metadata (UUID primary key)
- `documents` — text chunks with vector embeddings

### Installation

1. Copy environment template:
   ```bash
   cp env-template.txt .env
   ```

2. Configure `.env`:
   ```
   PG_USER=postgres
   PG_HOST=localhost
   PG_DATABASE=ai_documents
   PG_PASSWORD=your_password
   PG_PORT=5432

   EMBEDDING_MODEL=ollama
   LLM_MODEL=ollama
   OLLAMA_API_URL=http://localhost:11434
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text
   OLLAMA_CHAT_MODEL=llama3

   PORT=3000
   ```

3. Install dependencies and create uploads directory:
   ```bash
   npm install
   mkdir -p uploads
   ```

### Running the Application

```bash
# Development with hot reload
npm run start:local

# Production
npm run start:prod
```

## API Documentation

```
http://localhost:3000/api-docs
```

### Main Endpoints

#### Document Management

- `GET /documents` - List all documents
- `GET /documents/:documentId` - Get document details
- `POST /documents` - Upload a new document
- `DELETE /documents/:documentId` - Delete a document

#### Document Processing and Q&A

- `POST /documents/:documentId/process` - Process a document for Q&A
- `POST /documents/:documentId/ask` - Ask a question about a document

#### System Setup

- `GET /system/status` - Get system status and configuration
- `POST /system/initialize` - Initialize the application
- `GET /system/ollama/status` - Check Ollama server status
- `GET /system/postgresql/status` - Check PostgreSQL + pgvector status
- `POST /system/postgresql/setup` - Run PostgreSQL setup
- `POST /system/postgresql/sync` - Sync database schema

## License

ISC
