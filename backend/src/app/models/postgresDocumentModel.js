const { pgPool } = require("../../config/dbConnect");

/**
 * PostgreSQL Document Model
 * This class handles the documents table schema and operations
 */
class PostgresDocumentModel {
    constructor() {
        this.tableName = 'documents';
        this.schema = {
            id: 'BIGSERIAL PRIMARY KEY',
            content: 'TEXT NOT NULL',
            metadata: 'JSONB',
            embedding: 'VECTOR(1536)',
            created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
            updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        };
    }

    /**
     * Check if the documents table exists
     * @returns {Promise<boolean>}
     */
    async tableExists() {
        const client = await pgPool.connect();
        try {
            const result = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [this.tableName]);
            
            return result.rows[0].exists;
        } finally {
            client.release();
        }
    }

    /**
     * Create the documents table with proper schema
     * @returns {Promise<Object>}
     */
    async createTable() {
        const client = await pgPool.connect();
        try {
            // First, ensure pgvector extension is enabled
            await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
            
            // Create the table
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS ${this.tableName} (
                    id ${this.schema.id},
                    content ${this.schema.content},
                    metadata ${this.schema.metadata},
                    embedding ${this.schema.embedding},
                    created_at ${this.schema.created_at},
                    updated_at ${this.schema.updated_at}
                );
            `;
            
            await client.query(createTableSQL);
            
            // Create indexes for better performance
            await this.createIndexes(client);
            
            // Create the match_documents function
            await this.createMatchFunction(client);
            
            return {
                success: true,
                message: `Table ${this.tableName} created successfully`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error creating table ${this.tableName}: ${error.message}`
            };
        } finally {
            client.release();
        }
    }

    /**
     * Create indexes for the documents table
     * @param {Object} client - PostgreSQL client
     */
    async createIndexes(client) {
        try {
            // Vector similarity search index
            await client.query(`
                CREATE INDEX IF NOT EXISTS documents_embedding_idx 
                ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops) 
                WITH (lists = 100);
            `);
            
            // Metadata search index
            await client.query(`
                CREATE INDEX IF NOT EXISTS documents_metadata_idx 
                ON ${this.tableName} USING gin (metadata);
            `);
            
            // Timestamp index
            await client.query(`
                CREATE INDEX IF NOT EXISTS documents_created_at_idx 
                ON ${this.tableName} (created_at);
            `);
        } catch (error) {
            console.warn(`Warning creating indexes: ${error.message}`);
        }
    }

    /**
     * Create the match_documents function for similarity search
     * @param {Object} client - PostgreSQL client
     */
    async createMatchFunction(client) {
        try {
            const matchFunctionSQL = `
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
            `;
            
            await client.query(matchFunctionSQL);
        } catch (error) {
            console.warn(`Warning creating match_documents function: ${error.message}`);
        }
    }

    /**
     * Check table schema and columns
     * @returns {Promise<Object>}
     */
    async checkSchema() {
        const client = await pgPool.connect();
        try {
            const result = await client.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position;
            `, [this.tableName]);
            
            return {
                exists: result.rows.length > 0,
                columns: result.rows,
                requiredColumns: Object.keys(this.schema)
            };
        } finally {
            client.release();
        }
    }

    /**
     * Synchronize database schema - create table if it doesn't exist
     * @returns {Promise<Object>}
     */
    async sync() {
        try {
            const tableExists = await this.tableExists();
            
            if (!tableExists) {
                console.log(`Table ${this.tableName} does not exist. Creating...`);
                return await this.createTable();
            } else {
                // Check if all required columns exist
                const schemaCheck = await this.checkSchema();
                const existingColumns = schemaCheck.columns.map(col => col.column_name);
                const missingColumns = schemaCheck.requiredColumns.filter(
                    col => !existingColumns.includes(col)
                );
                
                if (missingColumns.length > 0) {
                    console.log(`Missing columns: ${missingColumns.join(', ')}. Recreating table...`);
                    // Drop and recreate table if columns are missing
                    await this.dropTable();
                    return await this.createTable();
                } else {
                    return {
                        success: true,
                        message: `Table ${this.tableName} exists with correct schema`
                    };
                }
            }
        } catch (error) {
            return {
                success: false,
                message: `Error syncing table ${this.tableName}: ${error.message}`
            };
        }
    }

    /**
     * Drop the documents table (for recreation)
     */
    async dropTable() {
        const client = await pgPool.connect();
        try {
            await client.query(`DROP TABLE IF EXISTS ${this.tableName} CASCADE;`);
        } finally {
            client.release();
        }
    }

    /**
     * Insert a document into the table
     * @param {string} content - Document content
     * @param {Object} metadata - Document metadata
     * @param {Array<number>} embedding - Vector embedding
     * @returns {Promise<Object>}
     */
    async insert(content, metadata, embedding) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `INSERT INTO ${this.tableName} (content, metadata, embedding) 
                 VALUES ($1, $2, $3) RETURNING id`,
                [content, JSON.stringify(metadata), `[${embedding.join(',')}]`]
            );
            
            return {
                success: true,
                id: result.rows[0].id,
                message: 'Document inserted successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Error inserting document: ${error.message}`
            };
        } finally {
            client.release();
        }
    }

    /**
     * Find documents by metadata
     * @param {Object} metadataFilter - Metadata filter
     * @returns {Promise<Array>}
     */
    async findByMetadata(metadataFilter) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM ${this.tableName} WHERE metadata @> $1`,
                [JSON.stringify(metadataFilter)]
            );
            
            return result.rows;
        } finally {
            client.release();
        }
    }

    /**
     * Delete documents by IDs
     * @param {Array<number>} ids - Document IDs to delete
     * @returns {Promise<Object>}
     */
    async deleteByIds(ids) {
        const client = await pgPool.connect();
        try {
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            const result = await client.query(
                `DELETE FROM ${this.tableName} WHERE id = ANY(ARRAY[${placeholders}])`,
                ids
            );
            
            return {
                success: true,
                deletedCount: result.rowCount,
                message: `${result.rowCount} documents deleted`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error deleting documents: ${error.message}`
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get table statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        const client = await pgPool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as documents_with_embeddings,
                    MIN(created_at) as oldest_document,
                    MAX(created_at) as newest_document
                FROM ${this.tableName};
            `);
            
            return result.rows[0];
        } finally {
            client.release();
        }
    }
}

module.exports = new PostgresDocumentModel();
