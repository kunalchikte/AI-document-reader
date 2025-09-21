const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const PostgresVectorStore = require("./postgresVectorStore");
const Document = require("../models/documentModel");
const { DirectOllamaEmbeddings } = require("./customEmbeddings");

class EmbeddingService {
    /**
     * Create embeddings for a document
     * @param {string} documentId - MongoDB document ID
     * @param {string} text - Text content of the document
     * @returns {Promise<Object>} Result of embedding process
     */
    async createEmbeddings(documentId, text) {
        try {
            // Retrieve the document
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error("Document not found");
            }

            // Check if PostgreSQL is properly configured
            const { pgPool } = require("../../config/dbConnect");
            if (!pgPool) {
                throw new Error("PostgreSQL connection pool is not initialized. Check your PostgreSQL environment variables.");
            }
            
            // Test PostgreSQL connection
            try {
                const client = await pgPool.connect();
                await client.query('SELECT 1');
                client.release();
            } catch (error) {
                throw new Error(`Failed to connect to PostgreSQL: ${error.message}`);
            }

            // Ensure database schema is synchronized before creating embeddings
            const pgVectorService = require("./pgVectorService");
            const syncResult = await pgVectorService.syncDatabase();
            if (!syncResult.status) {
                console.warn(`Database sync warning: ${syncResult.message}`);
                // Continue anyway, as the sync might have partial success
            } else {
                console.log("Database schema synchronized successfully");
            }

            // Initialize the embedding model
            const embeddings = this._getEmbeddingModel();
            
            // Split text into chunks for embedding
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            
            const chunks = await textSplitter.splitText(text);
            
            // Create the vector store with the chunks
            const tableName = "documents";
            const docIdStr = documentId.toString();
            
            await PostgresVectorStore.fromTexts(
                chunks,
                chunks.map(() => ({ 
                    documentId: docIdStr,
                    source: document.originalName,
                    document_id: docIdStr,
                    id: docIdStr
                })),
                embeddings,
                {
                    tableName: tableName,
                    queryName: "match_documents",
                }
            );
            
            // Update the document record with embedding info
            document.vectorized = true;
            document.supabaseCollectionName = tableName; // Keep field name for compatibility
            await document.save();
            
            return {
                success: true,
                documentId,
                chunks: chunks.length,
                collectionName: tableName
            };
        } catch (error) {
            console.error("Error creating embeddings:", error);
            throw new Error(`Failed to create embeddings: ${error.message}`);
        }
    }
    
    /**
     * Get embedding model based on configuration
     * @returns {OpenAIEmbeddings|DirectOllamaEmbeddings} Embedding model instance
     * @private
     */
    _getEmbeddingModel() {
        const embeddingModel = process.env.EMBEDDING_MODEL || "ollama";
        
        if (embeddingModel === "openai") {
            return new OpenAIEmbeddings({
                openAIApiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
            });
        } else {
            // Use our robust DirectOllamaEmbeddings that works even without dedicated embedding endpoints
            const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || "llama2";
            console.log(`Using Ollama model for embeddings: ${ollamaModel}`);
            
            return new DirectOllamaEmbeddings({
                baseUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
                model: ollamaModel,
                timeout: 120000 // Increase timeout to 2 minutes
            });
        }
    }
    
    /**
     * Find document chunks relevant to a query
     * @param {string} documentId - MongoDB document ID
     * @param {string} query - Query text
     * @param {number} topK - Number of results to return
     * @returns {Promise<Array>} Relevant document chunks
     */
    async findRelevantChunks(documentId, query, topK = 5) {
        try {
            console.log(`[DEBUG] Finding relevant chunks for document: ${documentId}`);
            
            const document = await Document.findById(documentId);
            if (!document) {
                console.log(`[DEBUG] Document not found in MongoDB: ${documentId}`);
                throw new Error("Document not found");
            }
            
            console.log(`[DEBUG] Document found: ${document.originalName}, vectorized: ${document.vectorized}`);
            
            if (!document.vectorized) {
                console.log(`[DEBUG] Document has not been vectorized: ${documentId}`);
                throw new Error("Document has not been vectorized");
            }
            
            const docIdStr = documentId.toString();
            const { pgPool } = require("../../config/dbConnect");
            const client = await pgPool.connect();
            
            try {
                // First, try direct document lookup (most reliable)
                console.log(`[DEBUG] Attempting direct document lookup for: ${docIdStr}`);
                const directResult = await client.query(
                    `SELECT id, content, metadata FROM documents WHERE metadata->>'documentId' = $1 OR metadata->>'document_id' = $1 OR metadata->>'id' = $1`,
                    [docIdStr]
                );
                
                console.log(`[DEBUG] Direct lookup returned ${directResult.rows.length} results`);
                
                if (directResult.rows.length > 0) {
                    console.log(`[DEBUG] ✅ Found document chunks directly, using text-based relevance scoring`);
                    
                    // Use text-based relevance scoring
                    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
                    
                    if (queryTerms.length === 0) {
                        // If no meaningful query terms, return all chunks
                        return directResult.rows.slice(0, topK).map(doc => ({
                            pageContent: doc.content,
                            metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata
                        }));
                    }
                    
                    // Score chunks based on query term frequency
                    const scoredChunks = directResult.rows.map(doc => {
                        const content = doc.content.toLowerCase();
                        let score = 0;
                        
                        queryTerms.forEach(term => {
                            const regex = new RegExp(term, 'g');
                            const matches = content.match(regex);
                            if (matches) {
                                score += matches.length;
                            }
                        });
                        
                        return {
                            doc,
                            score
                        };
                    });
                    
                    // Sort by score and return top results
                    scoredChunks.sort((a, b) => b.score - a.score);
                    
                    return scoredChunks.slice(0, topK).map(item => ({
                        pageContent: item.doc.content,
                        metadata: typeof item.doc.metadata === 'string' ? JSON.parse(item.doc.metadata) : item.doc.metadata
                    }));
                }
                
                // If direct lookup fails, try vector search as fallback
                console.log(`[DEBUG] Direct lookup failed, attempting vector search...`);
                
                try {
                    const embeddings = this._getEmbeddingModel();
                    const queryEmbedding = await embeddings.embedQuery(query);
                    
                    // Check if embedding is valid (not all zeros from fallback)
                    const hasNonZeroValues = queryEmbedding.some(val => val !== 0);
                    if (hasNonZeroValues) {
                        console.log(`[DEBUG] Using vector search with valid embedding`);
                        const vectorResult = await client.query(
                            `SELECT * FROM match_documents($1, 0.1, $2)`,
                            [`[${queryEmbedding.join(',')}]`, topK * 2]
                        );
                        
                        console.log(`[DEBUG] Vector search returned ${vectorResult.rows.length} results`);
                        
                        // Filter vector results by document ID
                        const matchingChunks = vectorResult.rows.filter(doc => {
                            try {
                                const meta = typeof doc.metadata === 'string' 
                                    ? JSON.parse(doc.metadata) 
                                    : doc.metadata;
                                
                                return (meta?.documentId && meta.documentId.toString() === docIdStr) || 
                                       (meta?.document_id && meta.document_id.toString() === docIdStr) || 
                                       (meta?.id && meta.id.toString() === docIdStr);
                            } catch (err) {
                                return false;
                            }
                        });
                        
                        if (matchingChunks.length > 0) {
                            console.log(`[DEBUG] ✅ Found ${matchingChunks.length} chunks via vector search`);
                            return matchingChunks.slice(0, topK).map(doc => ({
                                pageContent: doc.content,
                                metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata
                            }));
                        }
                    } else {
                        console.log(`[DEBUG] Embedding is invalid (all zeros), skipping vector search`);
                    }
                } catch (vectorError) {
                    console.log(`[DEBUG] Vector search failed: ${vectorError.message}`);
                }
                
                // If both methods fail, throw error
                console.log(`[DEBUG] ❌ No chunks found for document ID: ${docIdStr}`);
                throw new Error(`No chunks found for document ID: ${docIdStr}`);
                
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Error finding relevant chunks:", error);
            throw new Error(`Failed to find relevant chunks: ${error.message}`);
        }
    }
}

module.exports = new EmbeddingService();