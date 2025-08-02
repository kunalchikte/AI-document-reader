const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
const { supabase } = require("../../config/dbConnect");
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

            // Check if Supabase is properly configured
            if (!supabase) {
                throw new Error("Supabase client is not initialized. Check your SUPABASE_URL and SUPABASE_PRIVATE_KEY environment variables.");
            }
            
            // Test Supabase connection
            try {
                const { error } = await supabase.from('documents').select('id').limit(1);
                if (error && !error.message.includes('does not exist')) {
                    throw new Error(`Supabase connection error: ${error.message}`);
                }
            } catch (error) {
                throw new Error(`Failed to connect to Supabase: ${error.message}`);
            }

            // Initialize the embedding model
            const embeddings = this._getEmbeddingModel();
            
            // Split text into chunks for embedding
            const textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            
            const chunks = await textSplitter.splitText(text);
            
            // Use the fixed "documents" table in Supabase
            const tableName = "documents";
            
            // Ensure document ID is stored consistently as a string
            const docIdStr = documentId.toString();
            
            // Store embeddings in Supabase with all possible ID formats
            await SupabaseVectorStore.fromTexts(
                chunks,
                { 
                    // documentId: docIdStr, 
                    // document_id: docIdStr,
                    id: docIdStr,
                    source: document.originalName 
                },
                embeddings,
                {
                    client: supabase,
                    tableName: tableName,
                    queryName: "match_documents",
                }
            );
            
            // Update the document record with embedding info
            document.vectorized = true;
            document.supabaseCollectionName = tableName; // Store the fixed table name
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
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error("Document not found");
            }
            
            if (!document.vectorized) {
                throw new Error("Document has not been vectorized");
            }
            
            // Use the fixed "documents" table
            const tableName = "documents";
            
            // Try direct query to find documents matching our ID
            try {
                // Direct query to find all chunks for this document
                const { data: matchingDocs, error: queryError } = await supabase
                    .from(tableName)
                    .select('id, content, metadata')
                    .limit(100);
                
                if (queryError) {
                    console.error(`Direct query error: ${queryError.message}`);
                    throw new Error(`Direct query error: ${queryError.message}`);
                }
                
                if (!matchingDocs || matchingDocs.length === 0) {
                    throw new Error("No documents found in Supabase");
                }
                
                // Filter chunks by document ID
                const docIdStr = documentId.toString();
                const matchingChunks = matchingDocs.filter(doc => {
                    try {
                        const meta = typeof doc.metadata === 'string' 
                            ? JSON.parse(doc.metadata) 
                            : doc.metadata;
                        
                        // Try multiple formats of the ID
                        return meta?.documentId === docIdStr || 
                              meta?.document_id === docIdStr || 
                              meta?.id === docIdStr ||
                              (meta?.documentId && meta.documentId.toString().includes(docIdStr));
                    } catch (err) {
                        return false;
                    }
                });
                
                if (matchingChunks.length > 0) {
                    // Convert the chunks to the expected format
                    const formattedChunks = matchingChunks.map(doc => ({
                        pageContent: doc.content,
                        metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata
                    }));
                    
                    // If embedding API is failing, use simple text-based relevance
                    try {
                        // Convert query to lowercase for comparison
                        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
                        
                        if (queryTerms.length === 0) {
                            // If query is too short or has no meaningful terms, just return the chunks
                            return formattedChunks.slice(0, topK);
                        }
                        
                        // Score each chunk based on query term frequency
                        const scoredChunks = formattedChunks.map(chunk => {
                            const content = chunk.pageContent.toLowerCase();
                            let score = 0;
                            
                            // Calculate score based on term frequency
                            queryTerms.forEach(term => {
                                const regex = new RegExp(term, 'g');
                                const matches = content.match(regex);
                                if (matches) {
                                    score += matches.length;
                                }
                            });
                            
                            return { chunk, score };
                        });
                        
                        // Sort by score (descending)
                        scoredChunks.sort((a, b) => b.score - a.score);
                        
                        // Get top K results
                        const results = scoredChunks
                            .slice(0, topK)
                            .map(item => item.chunk);
                        
                        return results;
                    } catch (scoringError) {
                        console.error(`Error in text-based scoring: ${scoringError.message}`);
                        // Fall back to returning the chunks without scoring
                        return formattedChunks.slice(0, topK);
                    }
                } else {
                    throw new Error(`No chunks found for document ID: ${docIdStr}`);
                }
            } catch (directQueryError) {
                console.error(`Error in direct query: ${directQueryError.message}`);
                throw directQueryError;
            }
        } catch (error) {
            console.error("Error finding relevant chunks:", error);
            throw new Error(`Failed to find relevant chunks: ${error.message}`);
        }
    }
    
    /**
     * List all documents that have been vectorized
     * @returns {Promise<Array>} List of vectorized documents
     */
    async listVectorizedDocuments() {
        try {
            return await Document.find({
                vectorized: true,
                isDeleted: false
            }).select("_id originalName fileType createdAt");
        } catch (error) {
            throw new Error(`Error listing vectorized documents: ${error.message}`);
        }
    }
}

module.exports = new EmbeddingService(); 