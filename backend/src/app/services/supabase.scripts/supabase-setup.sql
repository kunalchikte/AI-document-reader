-- Enable pgvector extension (need to be run by superuser)
-- Note: In Supabase, you can enable this extension from the web interface
CREATE EXTENSION IF NOT EXISTS vector;

-- Function to check installed extensions
CREATE OR REPLACE FUNCTION get_installed_extensions()
RETURNS TABLE (name text, default_version text, installed_version text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT e.extname::text, e.extdefault::text, e.extversion::text
    FROM pg_extension e;
END;
$$;

-- Function to create the get_installed_extensions function
-- This is a meta-function that can be called from the app
CREATE OR REPLACE FUNCTION create_pg_extension_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE $FUNC$
    CREATE OR REPLACE FUNCTION get_installed_extensions()
    RETURNS TABLE (name text, default_version text, installed_version text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $INNER$
    BEGIN
        RETURN QUERY
        SELECT e.extname::text, e.extdefault::text, e.extversion::text
        FROM pg_extension e;
    END;
    $INNER$;
    $FUNC$;
END;
$$;

-- Grant permissions to your service role (replace with your actual role)
GRANT EXECUTE ON FUNCTION get_installed_extensions() TO service_role;
GRANT EXECUTE ON FUNCTION create_pg_extension_function() TO service_role;

-- Example of a SQL function for similarity search (used by LangChain)
-- This will be created automatically by LangChain, but here for reference
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
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
        id,
        content,
        metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM
        documents
    WHERE
        1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY
        documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$; 