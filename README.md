# AI Document Reader

A full-stack application for document-based Q&A using LangChain.js, Supabase for vector storage, and React.js frontend.

## Features

- **Document Upload**: Support for PDF, DOCX, XLSX, and TXT files
- **Document Processing**: Extract text, chunk it, and store embeddings in Supabase pgvector
- **Question & Answering**: Ask questions about documents and get contextually relevant answers
- **Multiple LLM Support**: Use either OpenAI or local Ollama models for embeddings and Q&A
- **User Interface**: Responsive web interface for document management and Q&A
- **Source References**: View document sources in answers

## Project Structure

This repository contains both the frontend and backend components:

- `/frontend`: React.js application with Material UI
- `/backend`: Node.js + Express API with LangChain.js integration

## Tech Stack

### Backend
- Node.js + Express
- LangChain.js
- Supabase (Postgres + pgvector)
- OpenAI or Ollama for embeddings & LLM
- MongoDB for document metadata storage
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
- MongoDB
- Supabase account with pgvector extension enabled
- OpenAI API key or Ollama running locally

## Getting Started

### Backend Setup

1. Configure Supabase:
   - Enable the pgvector extension in your Supabase project
   - Create a "documents" table with the schema as described in the backend setup instructions
   - Create an RLS policy to allow access to the table

2. Set up environment variables in the backend:
   ```
   cd backend
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration details:
   ```
   # Database
   DB_URL=mongodb://localhost:27017
   DB_NAME=ai_document_reader
   DB_USERNAME=
   DB_PASSWORD=
   
   # Supabase
   SUPABASE_URL=https://your-supabase-url.supabase.co
   SUPABASE_PRIVATE_KEY=your-supabase-private-key
   
   # LLM Settings
   EMBEDDING_MODEL=openai  # or ollama
   LLM_MODEL=openai        # or ollama
   
   # OpenAI (if using)
   OPENAI_API_KEY=your-openai-api-key
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   OPENAI_CHAT_MODEL=gpt-3.5-turbo
   
   # Ollama (if using locally)
   OLLAMA_API_URL=http://localhost:11434
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text
   OLLAMA_CHAT_MODEL=llama3
   
   # Server
   PORT=3000
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   mkdir uploads
   ```

4. Start the backend server:
   ```bash
   npm run start:dev
   ```

### Frontend Setup

1. Configure the API URL:
   ```
   cd frontend
   ```
   Create a `.env` file:
   ```
   REACT_APP_API_URL=http://localhost:3000
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm start
   ```
   The frontend application will be available at `http://localhost:3000`.

### Ollama Setup (Optional)

If you're using Ollama for local LLM functionality:

1. Install Ollama by following the instructions at [ollama.com](https://ollama.com)
2. Start the Ollama service
3. Use the backend API to set up required models:
   ```
   POST /system/ollama/setup
   Body: { "models": ["llama2", "nomic-embed-text"] }
   ```

## API Documentation

When the backend server is running, access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

## Workflow

1. Upload a document via the frontend interface
2. Process the document for Q&A
3. Ask questions about the document through the chat interface

## Building for Production

### Backend
```bash
cd backend
npm run start:prod
```

### Frontend
```bash
cd frontend
npm run build
```
This will create a `build` folder with the optimized production build.

## License

ISC (Backend) and MIT (Frontend)