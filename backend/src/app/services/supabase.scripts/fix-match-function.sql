-- Create the match_documents function needed for similarity search
-- This must be run in your Supabase SQL Editor

-- First, check if the function exists and drop it if it does (to update it)
DROP FUNCTION IF EXISTS match_documents;

-- Create the function with correct parameters
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

-- Test if the function exists
SELECT proname, proargtypes, pronargs
FROM pg_proc
WHERE proname = 'match_documents';

-- Notify user
DO $$
BEGIN
  RAISE NOTICE 'match_documents function created or updated successfully.';
END $$; 