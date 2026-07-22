const { OpenAIEmbeddings } = require("@langchain/openai");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const PostgresVectorStore = require("./postgresVectorStore");
const DocumentRepository = require("../models/documentRepository");
const { DirectOllamaEmbeddings } = require("./customEmbeddings");

class EmbeddingService {
    /**
     * Create embeddings for a document
     * @param {string} documentId - Document UUID
     * @param {string} text - Text content of the document
     * @returns {Promise<Object>} Result of embedding process
     */
    async createEmbeddings(documentId, text) {
        try {
            // Retrieve the document
            const document = await DocumentRepository.findById(documentId);
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
            
            await DocumentRepository.markVectorized(documentId, tableName);
            
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
     * @param {string} documentId - Document UUID
     * @param {string} query - Query text
     * @param {number} topK - Number of results to return
     * @returns {Promise<Array>} Relevant document chunks
     */
    async findRelevantChunks(documentId, query, topK = 5) {
        try {
            console.log(`[DEBUG] Finding relevant chunks for document: ${documentId}`);

            const document = await DocumentRepository.findById(documentId);
            if (!document) {
                throw new Error("Document not found");
            }

            if (!document.vectorized) {
                throw new Error("Document has not been vectorized");
            }

            const docIdStr = documentId.toString();
            const { pgPool } = require("../../config/dbConnect");
            const client = await pgPool.connect();

            try {
                // 1) Vector similarity within this document (real RAG grounding)
                try {
                    const embeddings = this._getEmbeddingModel();
                    const queryEmbedding = await embeddings.embedQuery(query);
                    const hasNonZeroValues = queryEmbedding.some((val) => val !== 0);

                    if (hasNonZeroValues) {
                        const vectorLiteral = `[${queryEmbedding.join(",")}]`;
                        const vectorResult = await client.query(
                            `SELECT id, content, metadata,
                                    1 - (embedding <=> $1::vector) AS similarity
                             FROM documents
                             WHERE metadata->>'documentId' = $2
                                OR metadata->>'document_id' = $2
                                OR metadata->>'id' = $2
                             ORDER BY embedding <=> $1::vector
                             LIMIT $3`,
                            [vectorLiteral, docIdStr, topK]
                        );

                        if (vectorResult.rows.length > 0) {
                            console.log(
                                `[DEBUG] Vector search returned ${vectorResult.rows.length} chunks ` +
                                `(best similarity=${Number(vectorResult.rows[0].similarity).toFixed(3)})`
                            );
                            return vectorResult.rows.map((doc) => ({
                                pageContent: doc.content,
                                metadata: typeof doc.metadata === "string"
                                    ? JSON.parse(doc.metadata)
                                    : doc.metadata
                            }));
                        }
                    } else {
                        console.warn("[DEBUG] Query embedding was all zeros; falling back to keyword scoring");
                    }
                } catch (vectorError) {
                    console.warn(`[DEBUG] Vector search failed, keyword fallback: ${vectorError.message}`);
                }

                // 2) Keyword fallback if embeddings/vector path fails
                const directResult = await client.query(
                    `SELECT id, content, metadata FROM documents
                     WHERE metadata->>'documentId' = $1
                        OR metadata->>'document_id' = $1
                        OR metadata->>'id' = $1`,
                    [docIdStr]
                );

                if (directResult.rows.length === 0) {
                    throw new Error(`No chunks found for document ID: ${docIdStr}`);
                }

                const queryTerms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
                if (queryTerms.length === 0) {
                    return directResult.rows.slice(0, topK).map((doc) => ({
                        pageContent: doc.content,
                        metadata: typeof doc.metadata === "string" ? JSON.parse(doc.metadata) : doc.metadata
                    }));
                }

                const scoredChunks = directResult.rows.map((doc) => {
                    const content = doc.content.toLowerCase();
                    let score = 0;
                    queryTerms.forEach((term) => {
                        const matches = content.match(new RegExp(term, "g"));
                        if (matches) score += matches.length;
                    });
                    return { doc, score };
                });

                scoredChunks.sort((a, b) => b.score - a.score);
                console.log(`[DEBUG] Keyword fallback selected ${Math.min(topK, scoredChunks.length)} chunks`);

                return scoredChunks.slice(0, topK).map((item) => ({
                    pageContent: item.doc.content,
                    metadata: typeof item.doc.metadata === "string"
                        ? JSON.parse(item.doc.metadata)
                        : item.doc.metadata
                }));
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