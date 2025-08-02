-- Fix schema for the documents table

-- Create the documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text,
  embedding vector(1536), -- Fixed dimension to match resized Ollama embeddings
  metadata jsonb
);

-- If the table already exists but is missing the metadata column, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE documents ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- First, drop the function if it exists (to update it)
DROP FUNCTION IF EXISTS match_documents;

-- Create the match_documents function with the correct parameters for LangChain JS
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
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
  FROM
    documents
  WHERE
    1 - (documents.embedding <=> query_embedding) > match_threshold
    AND CASE
      WHEN filter->>'documentId' IS NOT NULL THEN 
        documents.metadata->>'documentId' = filter->>'documentId'
      ELSE TRUE
    END
  ORDER BY
    documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Check if the required columns exist in the documents table
SELECT 
  column_name, 
  data_type 
FROM 
  information_schema.columns 
WHERE 
  table_name = 'documents';

-- Print success message
DO $$
BEGIN
  RAISE NOTICE 'Schema update complete! Your documents table should now have the correct structure.';
END $$; 