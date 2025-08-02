const { supabase } = require("../../config/dbConnect");

class SetupSupabaseService {
    /**
     * Initialize Supabase for vector storage
     * @returns {Promise<Object>} Result of initialization
     */
    async initializeVectorStore() {
        try {
            // Check if pgvector extension is enabled
            const { data: extensionData, error: extensionError } = await supabase.rpc(
                'get_installed_extensions'
            );

            if (extensionError) {
                throw new Error(`Error checking pgvector extension: ${extensionError.message}`);
            }

            const hasPgVector = extensionData.some(ext => ext.name === 'vector');
            if (!hasPgVector) {
                throw new Error("pgvector extension is not enabled in your Supabase project. Please enable it from the database settings.");
            }

            console.log("pgvector extension is enabled");
            
            // Ensure the documents table exists
            const documentsTableResult = await this.ensureDocumentsTable();
            
            return { 
                success: true, 
                message: "Supabase pgvector is ready",
                documentsTable: documentsTableResult 
            };
        } catch (error) {
            console.error("Error initializing vector store:", error);
            throw new Error(`Failed to initialize vector store: ${error.message}`);
        }
    }

    /**
     * Create a function to get installed PostgreSQL extensions
     * @returns {Promise<Object>} Result of function creation
     */
    async createExtensionFunction() {
        try {
            const { error } = await supabase.rpc('create_pg_extension_function');
            
            if (error) {
                // If function already exists, this is fine
                if (error.message.includes('already exists')) {
                    return { success: true, message: "Extension function already exists" };
                }
                throw new Error(`Error creating extension function: ${error.message}`);
            }
            
            return { success: true, message: "Extension function created successfully" };
        } catch (error) {
            console.error("Error creating extension function:", error);
            throw new Error(`Failed to create extension function: ${error.message}`);
        }
    }
    
    /**
     * Ensure that the documents table exists with the correct schema
     * @returns {Promise<Object>} Result of table check/creation
     */
    async ensureDocumentsTable() {
        try {
            // Check if the documents table exists
            const { data, error } = await supabase
                .from('documents')
                .select('id')
                .limit(1);
                
            if (error && !error.message.includes('does not exist')) {
                console.error("Error checking documents table:", error);
                return { success: false, message: `Error checking documents table: ${error.message}` };
            }
            
            if (!error) {
                console.log("Documents table already exists");
                return { success: true, message: "Documents table already exists" };
            }
            
            console.log("Documents table does not exist, schema should be created through Supabase interface");
            return { 
                success: false, 
                message: "Documents table does not exist. Please create it in the Supabase dashboard with columns: id (uuid), content (text), and embedding (vector)" 
            };
        } catch (error) {
            console.error("Error checking documents table:", error);
            return { success: false, message: `Error checking documents table: ${error.message}` };
        }
    }
}

module.exports = new SetupSupabaseService(); 