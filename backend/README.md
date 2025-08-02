# AI Document Reader Backend

A document-based Q&A application using LangChain.js and Supabase for vector storage.

## Features

- File Upload: Support for PDF, DOCX, XLSX, and TXT files
- Document Ingestion: Extract text, chunk it, and store embeddings in Supabase pgvector
- Q&A: Ask questions about documents and get contextually relevant answers
- Multiple LLM Support: Use either OpenAI or local Ollama models for embeddings and Q&A

## Tech Stack

- Node.js + Express
- LangChain.js
- Supabase (Postgres + pgvector)
- OpenAI or Ollama for embeddings & LLM
- MongoDB for document metadata storage
- Multer for file uploads
- Swagger for API documentation

## Setup Instructions

### Prerequisites

- Node.js >= 16
- MongoDB
- Supabase account with pgvector extension enabled
- OpenAI API key or Ollama running locally

### Supabase Table Setup

1. Enable the pgvector extension in your Supabase project (Database > Extensions)
2. Create a "documents" table in your Supabase database with the following schema:

   | Column       | Type          | Description                            |
   |--------------|---------------|----------------------------------------|
   | id           | uuid          | Primary key                            |
   | content      | text          | Document chunk content                 |
   | embedding    | vector(1536)  | Vector representation of content       |
   | metadata     | jsonb         | Metadata including documentId, source  |

   > **IMPORTANT**: Make sure to set the correct vector dimension:
   > - For OpenAI embeddings: vector(1536)
   > - For Ollama embeddings: depends on the model (usually vector(768) or vector(384))

3. Create an RLS policy to allow access to the table

### Fixing Supabase Schema

If you encounter errors related to missing columns (such as "metadata"), you can fix your schema using:

```bash
# Run the automated fix script
npm run fix-supabase
```

Or manually run the SQL from the `supabase-fix-schema.sql` file in your Supabase SQL Editor.

This will:
1. Add any missing columns to the documents table
2. Create the necessary search function
3. Verify the table structure

### Fixing Search Function Issues

If you encounter errors with the similarity search function (like "function public.match_documents not found"), you need to fix the match_documents function:

```bash
# Open the fix-match-function.sql file
# Then run that SQL in your Supabase SQL Editor
npm run fix-match-function
```

This will fix common issues with:
- Missing match_documents function
- Incorrect function parameters
- Filter handling for document queries

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create environment files (`.env.local`, `.env.dev`, `.env.prod`):
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

4. Create the uploads directory:
   ```bash
   mkdir uploads
   ```

### Running the Application

#### Development Mode
```bash
npm run start:dev
```

#### Production Mode
```bash
npm run start:prod
```

#### Local Development with Hot Reload
```bash
npm run start:local
```

## API Documentation

Once the server is running, access the Swagger documentation at:
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

- `POST /documents/:documentId/process` - Process a document for Q&A (extract text, create embeddings)
- `POST /documents/:documentId/ask` - Ask a question about a document

#### System Setup

- `GET /system/status` - Get system status and configuration
- `POST /system/initialize` - Initialize the application

#### Setup and Configuration

- `GET /system/ollama/status` - Check Ollama server status and available models
- `POST /system/ollama/setup` - Set up multiple Ollama models
- `POST /system/ollama/model` - Set up a specific Ollama model
- `GET /system/supabase/status` - Check Supabase configuration status
- `POST /system/supabase/setup` - Configure Supabase for vector storage

## Workflow

1. Upload a document via the `/documents` endpoint
2. Process the document via the `/documents/:documentId/process` endpoint
3. Ask questions about the document via the `/documents/:documentId/ask` endpoint

## Setup and Configuration

### Setup Overview

The application requires:
1. MongoDB for document metadata storage
2. Supabase with pgvector for embedding storage
3. An LLM service (either OpenAI API or Ollama)

You can use the setup API endpoints to configure these components.

### Ollama Setup

To set up Ollama for local LLM and embedding functionality:

1. Install Ollama by following the instructions at [ollama.com](https://ollama.com)
2. Start the Ollama service
3. Use the API to check Ollama status:
   ```
   GET /system/ollama/status
   ```
4. Set up required models using the API:
   ```
   POST /system/ollama/setup
   Body: { "models": ["llama2", "nomic-embed-text"] }
   ```

This will install and configure:
- `llama2` - A general-purpose model for chat and embeddings
- `nomic-embed-text` - A specialized embedding model (if available)

### Supabase Setup

To set up Supabase for vector storage:

1. Create a Supabase project with pgvector extension enabled
2. Set your Supabase URL and key in the .env file
3. Use the API to check Supabase status:
   ```
   GET /system/supabase/status
   ```
4. Set up the required tables and functions:
   ```
   POST /system/supabase/setup
   ```

This will:
1. Check your Supabase connection
2. Verify pgvector extension is enabled
3. Create the documents table if it doesn't exist
4. Create the match_documents function for similarity search

### Configuration Options

#### LLM and Embedding Models

You can configure the application to use either OpenAI or Ollama models for embeddings and question answering. Set the following environment variables:

- `EMBEDDING_MODEL`: Use 'ollama' or 'openai' for embeddings
- `LLM_MODEL`: Use 'ollama' or 'openai' for question answering

### Database Settings

The application stores document metadata in MongoDB and vector embeddings in Supabase.

- MongoDB settings are configured via the `DB_*` environment variables
- Supabase settings are configured via the `SUPABASE_*` environment variables

## Ollama Setup and Troubleshooting

This application can use [Ollama](https://github.com/ollama/ollama) for local embeddings and LLM functionality without requiring an API key.

### Setting Up Ollama

1. Install Ollama by following the instructions at [ollama.com](https://ollama.com)
2. Start the Ollama service
3. Install the required models using the API:
   ```
   POST /system/ollama/setup
   Body: { "models": ["llama2", "nomic-embed-text"] }
   ```

### Checking Ollama Configuration

To verify your Ollama setup is working correctly:
```
GET /system/ollama/status
```

This will:
1. Test the connection to your Ollama server
2. List available models
3. Check if the embeddings API is functioning

### Common Issues

1. **404 Not Found on /api/embeddings**:
   - This may occur if your Ollama version doesn't support the standard embeddings API
   - The application includes a fallback to the `/api/embed` endpoint
   - Make sure you have compatible models installed using the `/system/ollama/setup` endpoint

2. **Model not found**:
   - If you see errors about a model not being found, install it using:
   ```
   POST /system/ollama/model
   Body: { "model_name": "llama2" }
   ```
   - Or use the Ollama CLI directly:
   ```bash
   ollama pull llama2
   ```

3. **Slow response times**:
   - First requests to Ollama may be slow as models load into memory
   - Subsequent requests should be faster

### Using OpenAI Instead

If you encounter persistent issues with Ollama, you can use OpenAI instead by setting:
```
EMBEDDING_MODEL=openai
LLM_MODEL=openai
OPENAI_API_KEY=your-key-here
```

## License

ISC