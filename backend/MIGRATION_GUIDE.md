# Migration Guide: Supabase + MongoDB → PostgreSQL with pgvector

> **Status: Complete.** The application now uses PostgreSQL exclusively for both document metadata and vector storage.

This guide documents the migration from Supabase (vectors) and MongoDB (metadata) to a unified PostgreSQL + pgvector setup.

## Overview of Changes

The backend has been migrated from using Supabase as a vector database to using local PostgreSQL with the pgvector extension. This provides better control, performance, and eliminates external dependencies.

## Key Changes Made

### 1. Database Connection (`src/config/dbConnect.js`)
- **Removed**: Supabase client initialization
- **Added**: PostgreSQL connection pool using `pg` library
- **Added**: `initializePostgreSQL()` function to test pgvector extension

### 2. New Services Created

#### `src/app/models/postgresDocumentModel.js`
- **Purpose**: PostgreSQL document model with automatic schema synchronization
- **Features**:
  - Automatic table creation and schema validation
  - Database synchronization similar to Sequelize
  - Comprehensive schema checking and column validation
  - Index creation for optimal performance
  - CRUD operations for documents table

#### `src/app/services/pgVectorService.js`
- **Purpose**: Replaces SupabaseService with PostgreSQL-specific operations
- **Features**:
  - Connection testing
  - pgvector extension management
  - Documents table schema management
  - match_documents function creation
  - Comprehensive setup and health checks
  - Database schema synchronization

#### `src/app/services/postgresVectorStore.js`
- **Purpose**: Custom PostgreSQL vector store implementation
- **Features**:
  - Direct PostgreSQL operations instead of SupabaseVectorStore
  - Vector similarity search using pgvector
  - Text and metadata storage
  - Efficient querying with proper indexing

### 3. Updated Services

#### `src/app/services/embeddingService.js`
- **Removed**: SupabaseVectorStore dependency
- **Added**: PostgresVectorStore integration
- **Updated**: Connection testing to use PostgreSQL
- **Enhanced**: Automatic database schema synchronization before creating embeddings
- **Enhanced**: Fallback text-based search when vector search fails

#### `src/app/services/qaService.js`
- **Removed**: Supabase-specific queries
- **Added**: PostgreSQL fallback queries
- **Maintained**: Same API interface for backward compatibility

### 4. Configuration Updates

#### `src/app/controllers/setupController.js`
- **Replaced**: `supabaseService` with `pgVectorService`
- **Updated**: API endpoints from `/system/supabase/*` to `/system/postgresql/*`
- **Maintained**: Same response structure for compatibility

#### `src/routes/setupRoute.js`
- **Updated**: Route paths to reflect PostgreSQL instead of Supabase
- **Added**: New `/system/postgresql/sync` endpoint for manual schema synchronization

#### `src/handlers/main.js`
- **Added**: PostgreSQL initialization alongside MongoDB
- **Enhanced**: Automatic database schema synchronization on startup
- **Enhanced**: Database connection management

### 5. Environment Configuration

#### `env-template.txt`
- **Removed**: Supabase environment variables
- **Added**: PostgreSQL connection variables:
  ```
  PG_USER=<POSTGRES_USER>
  PG_HOST=<POSTGRES_HOST>
  PG_DATABASE=<POSTGRES_DB>
  PG_PASSWORD=<POSTGRES_PASSWORD>
  PG_PORT=<POSTGRES_PORT>
  ```

### 6. Package Dependencies

#### `package.json`
- **Removed**: `@supabase/supabase-js` dependency
- **Kept**: `pg` dependency (already present)
- **Updated**: Package description

## Database Schema

The PostgreSQL database uses the following schema:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table for vector storage
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding VECTOR(1536)
);

-- Index for vector similarity search
CREATE INDEX documents_embedding_idx 
ON documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_documents (
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.78,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id bigint,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

## Setup Instructions

### 1. Install PostgreSQL with pgvector

#### Ubuntu/Debian:
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install pgvector extension
sudo apt install postgresql-14-pgvector  # Adjust version as needed
```

#### macOS:
```bash
# Install PostgreSQL with pgvector
brew install pgvector
```

#### Docker:
```bash
docker run --name postgres-pgvector -e POSTGRES_PASSWORD=password -p 5432:5432 -d pgvector/pgvector:pg16
```

### 2. Create Database and User

```sql
-- Connect to PostgreSQL as superuser
sudo -u postgres psql

-- Create database
CREATE DATABASE ai_documents;

-- Create user
CREATE USER ai_user WITH PASSWORD 'your_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ai_documents TO ai_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO ai_user;

-- Connect to the database
\c ai_documents

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant extension privileges
GRANT USAGE ON SCHEMA public TO ai_user;
```

### 3. Update Environment Variables

Create a `.env` file with:

```env
# PostgreSQL Configuration
PG_USER=ai_user
PG_HOST=localhost
PG_DATABASE=ai_documents
PG_PASSWORD=your_password
PG_PORT=5432

# Alternative names (both supported)
POSTGRES_USER=ai_user
POSTGRES_HOST=localhost
POSTGRES_DB=ai_documents
POSTGRES_PASSWORD=your_password
POSTGRES_PORT=5432

# MongoDB (unchanged)
DB_URL=your_mongodb_url
DB_NAME=your_db_name

# Other configurations remain the same
JWT_SECRET=your_jwt_secret
EMBEDDING_MODEL=ollama
LLM_MODEL=ollama
OLLAMA_API_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=llama2
OLLAMA_CHAT_MODEL=llama2
PORT=3000
```

### 4. Initialize the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the application:
   ```bash
   npm run start:local
   ```

3. Check PostgreSQL setup:
   ```bash
   curl http://localhost:3000/api/system/postgresql/status
   ```

4. Setup PostgreSQL schema if needed:
   ```bash
   curl -X POST http://localhost:3000/api/system/postgresql/setup
   ```

## API Changes

### Updated Endpoints

| Old Supabase Endpoint | New PostgreSQL Endpoint |
|----------------------|-------------------------|
| `GET /api/system/supabase/status` | `GET /api/system/postgresql/status` |
| `POST /api/system/supabase/setup` | `POST /api/system/postgresql/setup` |
| *New* | `POST /api/system/postgresql/sync` |

### Response Format

The response format remains the same, but with updated field names:

```json
{
  "status": 200,
  "msg": "Initialization status",
  "data": {
    "postgresql": {
      "connection": { "status": true, "message": "..." },
      "pgvector": { "status": true, "message": "..." },
      "documentsTable": { "status": true, "message": "..." },
      "matchFunction": { "status": true, "message": "..." }
    },
    "ollama": { ... },
    "uploads": { ... }
  }
}
```

## Automatic Schema Synchronization

The new implementation includes automatic database schema synchronization similar to Sequelize:

### Features:
1. **Automatic Table Creation**: Tables are created automatically if they don't exist
2. **Schema Validation**: Checks for required columns and recreates table if schema is incomplete
3. **Index Creation**: Automatically creates optimized indexes for vector operations
4. **Function Creation**: Creates the `match_documents` function for similarity search
5. **Startup Sync**: Database schema is synchronized automatically on server startup
6. **Manual Sync**: New endpoint for manual schema synchronization

### How It Works:
- On server startup, the system automatically checks and creates the required database schema
- Before creating embeddings, the system ensures the database schema is up to date
- If the schema is missing or incomplete, it's automatically recreated
- All operations continue seamlessly without manual intervention

## Benefits of Migration

1. **Local Control**: No external dependencies on Supabase
2. **Performance**: Direct PostgreSQL access without API overhead
3. **Cost**: No Supabase subscription costs
4. **Flexibility**: Full control over database configuration and optimization
5. **Privacy**: All data stays on your local infrastructure
6. **Scalability**: Can easily scale PostgreSQL as needed
7. **Automatic Schema Management**: No manual database setup required
8. **Seamless Migration**: Automatic schema synchronization eliminates setup errors

## Troubleshooting

### Common Issues

1. **pgvector extension not found**:
   - Ensure pgvector is properly installed
   - Check PostgreSQL version compatibility
   - Verify extension is enabled in the database

2. **Connection refused**:
   - Check PostgreSQL is running
   - Verify connection parameters in environment variables
   - Ensure firewall allows connections

3. **Permission denied**:
   - Verify database user has proper privileges
   - Check user can create tables and functions

4. **Vector operations fail**:
   - Ensure pgvector extension is enabled
   - Check embedding dimensions match (1536 for OpenAI)
   - Verify match_documents function is created

### Logs and Debugging

The application provides detailed logging for:
- Database connection status
- pgvector extension availability
- Schema creation progress
- Vector operations

Check application logs for detailed error messages and troubleshooting information.

## Migration Checklist

- [ ] Install PostgreSQL with pgvector extension
- [ ] Create database and user
- [ ] Update environment variables
- [ ] Install updated dependencies (`npm install`)
- [ ] Test PostgreSQL connection
- [ ] Run PostgreSQL setup endpoint
- [ ] Verify vector operations work
- [ ] Test document upload and Q&A functionality
- [ ] Update any frontend API calls if needed
