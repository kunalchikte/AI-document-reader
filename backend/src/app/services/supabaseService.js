const { supabase } = require("../../config/dbConnect");
const fs = require('fs');
const path = require('path');

/**
 * Service for Supabase operations, including schema management and match function setup
 */
class SupabaseService {
    /**
     * Check connection to Supabase
     * @returns {Promise<Object>} Connection status
     */
    async checkConnection() {
        try {
            if (!supabase) {
                return {
                    status: false,
                    message: "Supabase client not initialized. Check your environment variables."
                };
            }

            // Simple query to check connection
            const { error } = await supabase.from('_dummy_query_').select('*').limit(1);
            
            // This query is expected to fail, but with a specific error about the relation not existing
            if (error && error.message && error.message.includes('does not exist')) {
                return {
                    status: true,
                    message: "Connected to Supabase successfully"
                };
            } else if (error) {
                // If we get a different error, it might be a connection issue
                return {
                    status: false,
                    message: `Error connecting to Supabase: ${error.message}`
                };
            }

            return {
                status: true,
                message: "Connected to Supabase successfully"
            };
        } catch (error) {
            return {
                status: false,
                message: `Failed to connect to Supabase: ${error.message}`
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

            // Try to execute the extension check function, create it if it doesn't exist
            try {
                const { data, error } = await supabase.rpc('get_installed_extensions');
                
                if (error) {
                    // Function might not exist, try to create it
                    await this.createExtensionCheckFunction();
                    const retryResult = await supabase.rpc('get_installed_extensions');
                    
                    if (retryResult.error) {
                        throw new Error(`Could not check extensions: ${retryResult.error.message}`);
                    }
                    
                    const hasPgVector = retryResult.data.some(ext => ext.name === 'vector');
                    return {
                        status: hasPgVector,
                        message: hasPgVector ? 
                            "pgvector extension is enabled" : 
                            "pgvector extension is NOT enabled. Enable it in your Supabase dashboard."
                    };
                }
                
                const hasPgVector = data.some(ext => ext.name === 'vector');
                return {
                    status: hasPgVector,
                    message: hasPgVector ? 
                        "pgvector extension is enabled" : 
                        "pgvector extension is NOT enabled. Enable it in your Supabase dashboard."
                };
            } catch (error) {
                return {
                    status: false,
                    message: `Error checking pgvector: ${error.message}`
                };
            }
        } catch (error) {
            return {
                status: false,
                message: `Error checking pgvector: ${error.message}`
            };
        }
    }

    /**
     * Create a function to check installed PostgreSQL extensions
     * @returns {Promise<Object>} Result of function creation
     */
    async createExtensionCheckFunction() {
        try {
            const sql = `
            CREATE OR REPLACE FUNCTION get_installed_extensions()
            RETURNS TABLE (name text, default_version text, installed_version text)
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY SELECT 
                    e.extname::text, 
                    e.extdefault::text, 
                    e.extversion::text
                FROM pg_extension e;
            END;
            $$;`;
            
            // Execute using exec_sql RPC or direct SQL if available
            try {
                const { error } = await supabase.rpc('exec_sql', { sql });
                if (error && !error.message.includes('does not exist')) {
                    throw new Error(error.message);
                }
            } catch (error) {
                // Try direct SQL query if available
                await supabase.sql(sql);
            }
            
            return {
                status: true,
                message: "Extension check function created successfully"
            };
        } catch (error) {
            return {
                status: false,
                message: `Failed to create extension check function: ${error.message}`
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

            // Try to query the documents table
            const { data, error } = await supabase.from('documents').select('id').limit(1);
            
            if (error) {
                if (error.message.includes('does not exist')) {
                    return {
                        status: false,
                        message: "Documents table does not exist"
                    };
                }
                return {
                    status: false,
                    message: `Error checking documents table: ${error.message}`
                };
            }
            
            return {
                status: true,
                message: "Documents table exists"
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
            
            const tableExists = await this.checkDocumentsTable();
            if (tableExists.status) {
                return {
                    status: true,
                    message: "Documents table already exists"
                };
            }

            // Read SQL from the schema file
            const schemaFilePath = path.join(__dirname, './supabase.scripts/supabase-fix-schema.sql');
            let sql = fs.readFileSync(schemaFilePath, 'utf8');
            
            // Split SQL into separate statements
            const statements = sql
                .replace(/--.*$/gm, '') // Remove comments
                .split(';')
                .filter(stmt => stmt.trim()); // Remove empty statements
            
            // Execute each statement separately
            let success = true;
            let message = "Table creation successful";
            
            for (const [index, statement] of statements.entries()) {
                try {
                    // Try to use the exec_sql RPC function
                    const { error } = await supabase.rpc('exec_sql', { sql: statement });
                    
                    if (error && !error.message.includes('already exists')) {
                        console.warn(`Warning executing statement ${index + 1}: ${error.message}`);
                        message = `Partial success with warnings: ${error.message}`;
                        success = false;
                    }
                } catch (error) {
                    // Try direct SQL if available
                    try {
                        await supabase.sql(statement);
                    } catch (sqlError) {
                        console.warn(`Warning executing statement ${index + 1}: ${sqlError.message}`);
                        message = `Partial success with warnings: ${sqlError.message}`;
                        success = false;
                    }
                }
            }
            
            return {
                status: success,
                message: message
            };
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

            // Try to execute a simple function check
            const checkSql = `
            SELECT proname, proargtypes, pronargs 
            FROM pg_proc 
            WHERE proname = 'match_documents';`;
            
            try {
                // Try to use the exec_sql RPC function
                const { data, error } = await supabase.rpc('exec_sql', { sql: checkSql });
                
                if (error) {
                    // Try direct SQL if available
                    const sqlResult = await supabase.sql(checkSql);
                    
                    return {
                        status: sqlResult.data && sqlResult.data.length > 0,
                        message: sqlResult.data && sqlResult.data.length > 0 ?
                            "match_documents function exists" : 
                            "match_documents function does not exist"
                    };
                }
                
                return {
                    status: data && data.length > 0,
                    message: data && data.length > 0 ?
                        "match_documents function exists" : 
                        "match_documents function does not exist"
                };
            } catch (error) {
                return {
                    status: false,
                    message: `Error checking match_documents function: ${error.message}`
                };
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
            
            // Read SQL from the match function file
            const matchFunctionFilePath = path.join(__dirname, './supabase.scripts/fix-match-function.sql');
            let sql = fs.readFileSync(matchFunctionFilePath, 'utf8');
            
            // Split SQL into separate statements
            const statements = sql
                .replace(/--.*$/gm, '') // Remove comments
                .split(';')
                .filter(stmt => stmt.trim()); // Remove empty statements
            
            // Execute each statement separately
            let success = true;
            let message = "Function creation successful";
            
            for (const [index, statement] of statements.entries()) {
                if (!statement.includes('match_documents')) continue;
                
                try {
                    // Try to use the exec_sql RPC function
                    const { error } = await supabase.rpc('exec_sql', { sql: statement });
                    
                    if (error && !error.message.includes('already exists')) {
                        console.warn(`Warning executing statement: ${error.message}`);
                        message = `Partial success with warnings: ${error.message}`;
                        success = false;
                    }
                } catch (error) {
                    // Try direct SQL if available
                    try {
                        await supabase.sql(statement);
                    } catch (sqlError) {
                        console.warn(`Warning executing SQL: ${sqlError.message}`);
                        message = `Partial success with warnings: ${sqlError.message}`;
                        success = false;
                    }
                }
            }
            
            // Verify the function was created
            const checkResult = await this.checkMatchFunction();
            success = checkResult.status;
            
            return {
                status: success,
                message: success ? "match_documents function created successfully" : message
            };
        } catch (error) {
            return {
                status: false,
                message: `Error creating match_documents function: ${error.message}`
            };
        }
    }

    /**
     * Run a comprehensive Supabase setup check
     * @returns {Promise<Object>} Status of Supabase setup
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
     * Run the full Supabase setup process
     * @returns {Promise<Object>} Result of setup process
     */
    async setupSupabase() {
        try {
            const initialStatus = await this.checkSetup();
            const results = {
                connection: initialStatus.connection,
                pgvector: initialStatus.pgvector,
                documentsTable: initialStatus.documentsTable,
                matchFunction: initialStatus.matchFunction,
                actions: []
            };

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
                    "Supabase setup completed successfully" : 
                    "Supabase setup completed with issues",
                results
            };
        } catch (error) {
            return {
                status: false,
                message: `Error during Supabase setup: ${error.message}`
            };
        }
    }
}

module.exports = new SupabaseService(); 