const { pgPool } = require("../../config/dbConnect");
const PostgresDocumentModel = require("../models/postgresDocumentModel");
const fs = require('fs');
const path = require('path');

/**
 * Service for PostgreSQL with pgvector operations, including schema management and match function setup
 */
class PgVectorService {
    /**
     * Check connection to PostgreSQL
     * @returns {Promise<Object>} Connection status
     */
    async checkConnection() {
        try {
            if (!pgPool) {
                return {
                    status: false,
                    message: "PostgreSQL connection pool not initialized. Check your environment variables."
                };
            }

            const client = await pgPool.connect();
            try {
                // Simple query to check connection
                await client.query('SELECT 1');
                return {
                    status: true,
                    message: "Connected to PostgreSQL successfully"
                };
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                status: false,
                message: `Failed to connect to PostgreSQL: ${error.message}`
            };
        }
    }

    /**
     * Check if pgvector extension is enabled
     * @returns {Promise<Object>} Status of pgvector extension
     */
    async checkPgVector() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }

            const client = await pgPool.connect();
            try {
                const result = await client.query(
                    "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector"
                );
                
                const hasPgVector = result.rows[0].has_vector;
                return {
                    status: hasPgVector,
                    message: hasPgVector ? 
                        "pgvector extension is enabled" : 
                        "pgvector extension is NOT enabled. Please install it first."
                };
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                status: false,
                message: `Error checking pgvector: ${error.message}`
            };
        }
    }

    /**
     * Enable pgvector extension
     * @returns {Promise<Object>} Result of extension creation
     */
    async enablePgVector() {
        try {
            const client = await pgPool.connect();
            try {
                await client.query('CREATE EXTENSION IF NOT EXISTS vector');
                return {
                    status: true,
                    message: "pgvector extension enabled successfully"
                };
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                status: false,
                message: `Error enabling pgvector: ${error.message}`
            };
        }
    }

    /**
     * Check if the documents table exists and has the correct schema
     * @returns {Promise<Object>} Status of documents table
     */
    async checkDocumentsTable() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }

            const schemaCheck = await PostgresDocumentModel.checkSchema();
            
            if (!schemaCheck.exists) {
                return {
                    status: false,
                    message: "Documents table does not exist"
                };
            }

            const existingColumns = schemaCheck.columns.map(col => col.column_name);
            const missingColumns = schemaCheck.requiredColumns.filter(col => !existingColumns.includes(col));

            if (missingColumns.length > 0) {
                return {
                    status: false,
                    message: `Documents table missing required columns: ${missingColumns.join(', ')}`
                };
            }
            
            return {
                status: true,
                message: "Documents table exists with correct schema"
            };
        } catch (error) {
            return {
                status: false,
                message: `Error checking documents table: ${error.message}`
            };
        }
    }

    /**
     * Create documents table with required schema
     * @returns {Promise<Object>} Result of table creation
     */
    async createDocumentsTable() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }
            
            // Use the model to create the table
            return await PostgresDocumentModel.createTable();
        } catch (error) {
            return {
                status: false,
                message: `Error creating documents table: ${error.message}`
            };
        }
    }

    /**
     * Check if the match_documents function exists
     * @returns {Promise<Object>} Status of match_documents function
     */
    async checkMatchFunction() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }

            const client = await pgPool.connect();
            try {
                const result = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM pg_proc 
                        WHERE proname = 'match_documents'
                    ) as function_exists;
                `);
                
                const exists = result.rows[0].function_exists;
                return {
                    status: exists,
                    message: exists ?
                        "match_documents function exists" : 
                        "match_documents function does not exist"
                };
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                status: false,
                message: `Error checking match_documents function: ${error.message}`
            };
        }
    }

    /**
     * Create the match_documents function for similarity search
     * @returns {Promise<Object>} Result of function creation
     */
    async createMatchFunction() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }
            
            const client = await pgPool.connect();
            try {
                await client.query(`
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
                `);
                
                return {
                    status: true,
                    message: "match_documents function created successfully"
                };
            } finally {
                client.release();
            }
        } catch (error) {
            return {
                status: false,
                message: `Error creating match_documents function: ${error.message}`
            };
        }
    }

    /**
     * Run a comprehensive PostgreSQL setup check
     * @returns {Promise<Object>} Status of PostgreSQL setup
     */
    async checkSetup() {
        const connection = await this.checkConnection();
        if (!connection.status) {
            return {
                connection,
                pgvector: { status: false, message: "Connection failed" },
                documentsTable: { status: false, message: "Connection failed" },
                matchFunction: { status: false, message: "Connection failed" }
            };
        }

        const pgvector = await this.checkPgVector();
        const documentsTable = await this.checkDocumentsTable();
        const matchFunction = await this.checkMatchFunction();

        return {
            connection,
            pgvector,
            documentsTable,
            matchFunction
        };
    }

    /**
     * Synchronize database schema - ensures all tables and functions exist
     * @returns {Promise<Object>} Result of synchronization
     */
    async syncDatabase() {
        try {
            const connection = await this.checkConnection();
            if (!connection.status) {
                return {
                    status: false,
                    message: connection.message
                };
            }

            const actions = [];

            // Enable pgvector extension
            const enableVectorResult = await this.enablePgVector();
            actions.push({
                action: "Enable pgvector extension",
                result: enableVectorResult
            });

            // Sync documents table schema
            const syncTableResult = await PostgresDocumentModel.sync();
            actions.push({
                action: "Sync documents table schema",
                result: syncTableResult
            });

            // Check final status
            const finalStatus = await this.checkSetup();
            const success = finalStatus.connection.status &&
                          finalStatus.pgvector.status &&
                          finalStatus.documentsTable.status &&
                          finalStatus.matchFunction.status;

            return {
                status: success,
                message: success ? 
                    "Database schema synchronized successfully" : 
                    "Database schema synchronization completed with issues",
                results: finalStatus,
                actions
            };
        } catch (error) {
            return {
                status: false,
                message: `Error during database synchronization: ${error.message}`
            };
        }
    }

    /**
     * Run the full PostgreSQL setup process
     * @returns {Promise<Object>} Result of setup process
     */
    async setupPostgreSQL() {
        try {
            const initialStatus = await this.checkSetup();
            const results = {
                connection: initialStatus.connection,
                pgvector: initialStatus.pgvector,
                documentsTable: initialStatus.documentsTable,
                matchFunction: initialStatus.matchFunction,
                actions: []
            };

            // Enable pgvector extension if not enabled
            if (!initialStatus.pgvector.status) {
                const enableVectorResult = await this.enablePgVector();
                results.actions.push({
                    action: "Enable pgvector extension",
                    result: enableVectorResult
                });
                results.pgvector = await this.checkPgVector();
            }

            // Create documents table if it doesn't exist
            if (!initialStatus.documentsTable.status) {
                const createTableResult = await this.createDocumentsTable();
                results.actions.push({
                    action: "Create documents table",
                    result: createTableResult
                });
                results.documentsTable = await this.checkDocumentsTable();
            }

            // Create match function if it doesn't exist
            if (!initialStatus.matchFunction.status) {
                const createFunctionResult = await this.createMatchFunction();
                results.actions.push({
                    action: "Create match_documents function",
                    result: createFunctionResult
                });
                results.matchFunction = await this.checkMatchFunction();
            }

            // Check final status
            const success = results.connection.status &&
                          results.pgvector.status &&
                          results.documentsTable.status &&
                          results.matchFunction.status;

            return {
                status: success,
                message: success ? 
                    "PostgreSQL setup completed successfully" : 
                    "PostgreSQL setup completed with issues",
                results
            };
        } catch (error) {
            return {
                status: false,
                message: `Error during PostgreSQL setup: ${error.message}`
            };
        }
    }
}

module.exports = new PgVectorService();
