/**
 * Script to fix Supabase table schema for documents
 * Run with: node fix-supabase-schema.js
 */

require('dotenv').config({ path: '.env.local' });
const { supabase } = require('../../../config/dbConnect');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Starting Supabase schema fix...');
  
  try {
    // Check if supabase client is initialized
    if (!supabase) {
      throw new Error('Supabase client is not initialized. Check your SUPABASE_URL and SUPABASE_PRIVATE_KEY environment variables.');
    }
    
    console.log('Connected to Supabase');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, 'supabase-fix-schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into separate statements
    const statements = sqlContent
      .replace(/--.*$/gm, '') // Remove comments
      .split(';')
      .filter(stmt => stmt.trim()); // Remove empty statements
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement separately
    for (const [index, statement] of statements.entries()) {
      try {
        console.log(`Executing statement ${index + 1}/${statements.length}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.warn(`Warning executing statement ${index + 1}: ${error.message}`);
        } else {
          console.log(`Statement ${index + 1} executed successfully`);
        }
      } catch (error) {
        console.warn(`Warning executing statement ${index + 1}: ${error.message}`);
      }
    }

    // Explicitly create the match_documents function (most important part)
    console.log('\nCreating match_documents function...');
    try {
      const matchFunctionSQL = `
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
              metadata->>'documentId' = filter->>'documentId'
            ELSE TRUE
          END
        ORDER BY
          documents.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;`;
      
      const { error } = await supabase.rpc('exec_sql', { sql: matchFunctionSQL });
      
      if (error) {
        console.warn(`Warning: Could not create match_documents function directly: ${error.message}`);
        console.log('Trying alternative method...');
        
        // Try direct SQL query if available
        await supabase.sql(matchFunctionSQL);
        console.log('✅ match_documents function created via SQL API');
      } else {
        console.log('✅ match_documents function created successfully');
      }
    } catch (error) {
      console.warn(`Warning: Could not create match_documents function: ${error.message}`);
      console.log('Will need to run SQL manually in Supabase SQL Editor');
    }
    
    console.log('\n✅ Schema update completed!');
    console.log('Your documents table should now have the following structure:');
    console.log('- id: uuid (primary key)');
    console.log('- content: text (document content)');
    console.log('- embedding: vector(1536) (embedding vector)');
    console.log('- metadata: jsonb (document metadata)');
    console.log('\nIf you still have issues with the "match_documents" function:');
    console.log('1. Go to the Supabase dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Run the SQL from the file: fix-match-function.sql');
    
  } catch (error) {
    console.error('\n❌ Error fixing schema:', error.message);
    
    console.error('\nPlease execute the SQL manually in your Supabase SQL Editor:');
    console.error('1. Go to the Supabase dashboard');
    console.error('2. Open the SQL Editor');
    console.error('3. Run the SQL from the file: fix-match-function.sql');
    
    process.exit(1);
  }
}

main().catch(console.error); 