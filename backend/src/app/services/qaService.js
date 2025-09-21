const { ChatOpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const embeddingService = require("./embeddingService");
const Document = require("../models/documentModel");

class QAService {
    /**
     * Ask a question about a specific document
     * @param {string} documentId - Document ID
     * @param {string} question - User question
     * @param {number} topK - Number of relevant chunks to retrieve
     * @returns {Promise<Object>} Answer and sources
     */
    async askQuestion(documentId, question, topK = 500) {
        try {
            // Retrieve document
            const document = await Document.findById(documentId);
            if (!document) {
                throw new Error(`Document not found with ID: ${documentId}`);
            }
            
            if (!document.vectorized) {
                throw new Error("Document has not been processed for Q&A yet");
            }
            
            // Get relevant chunks from the document
            let relevantChunks = [];
            try {
                console.log(`[QA DEBUG] Attempting to find relevant chunks for document: ${documentId}, question: ${question}`);
                relevantChunks = await embeddingService.findRelevantChunks(documentId, question, topK);
                console.log(`[QA DEBUG] Found ${relevantChunks.length} relevant chunks`);
            } catch (error) {
                console.error(`[QA ERROR] Error finding relevant chunks: ${error.message}`);
                console.error(`[QA ERROR] Stack trace:`, error.stack);
                
                // Direct PostgreSQL query as a last resort if all else fails
                try {
                    const { pgPool } = require("../../config/dbConnect");
                    const client = await pgPool.connect();
                    
                    try {
                        const docIdStr = documentId.toString();
                        const result = await client.query(
                            `SELECT id, content, metadata FROM documents WHERE metadata::text LIKE $1`,
                            [`%${docIdStr}%`]
                        );
                        
                        if (result.rows.length === 0) throw new Error("No documents found in database");
                        
                        // Filter by document ID
                        const matchingChunks = result.rows.filter(doc => {
                            try {
                                const meta = typeof doc.metadata === 'string' 
                                    ? JSON.parse(doc.metadata) 
                                    : doc.metadata;
                                
                                return meta?.documentId === docIdStr || 
                                    meta?.document_id === docIdStr || 
                                    meta?.id === docIdStr ||
                                    (meta?.documentId && meta.documentId.toString().includes(docIdStr));
                            } catch (err) {
                                return false;
                            }
                        });
                        
                        if (matchingChunks.length > 0) {
                            // Simple text matching algorithm
                            const queryTerms = question.toLowerCase().split(/\s+/).filter(term => term.length > 2);
                            
                            // Score chunks based on term frequency
                            const scoredChunks = matchingChunks.map(doc => {
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
                                    pageContent: doc.content,
                                    metadata: typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata,
                                    score
                                };
                            });
                            
                            // Sort by score and take top results
                            scoredChunks.sort((a, b) => b.score - a.score);
                            relevantChunks = scoredChunks
                                .slice(0, topK)
                                .map(({ pageContent, metadata }) => ({ pageContent, metadata }));
                        } else {
                            throw new Error(`No chunks found for document ID: ${docIdStr}`);
                        }
                    } finally {
                        client.release();
                    }
                } catch (fallbackError) {
                    console.error(`Fallback search also failed: ${fallbackError.message}`);
                    throw new Error(`Unable to retrieve relevant content: ${error.message}. Fallback also failed: ${fallbackError.message}`);
                }
            }
            
            if (!relevantChunks || relevantChunks.length === 0) {
                return {
                    answer: "I couldn't find relevant information in the document to answer your question.",
                    sources: []
                };
            }
            
            // Combine chunks into context
            const context = relevantChunks.map(chunk => chunk.pageContent).join("\n\n");
            
            // Initialize LLM with error handling
            let answer = "";
            try {
                console.log(`[QA DEBUG] Attempting to use LLM for question: ${question}`);
                const llm = this._getLLMModel();
                
                // Create prompt template
                const promptTemplate = ChatPromptTemplate.fromMessages([
                    ["system", `You are a helpful assistant that answers questions based on the provided document content. 
                    Only use information from the provided context to answer questions.
                    If you don't know the answer based on the context, say "I don't have enough information to answer this question. "
                    Be concise and accurate in your responses. Answer the question based only on the provided context. Include specific details from the context.
                    Act as a expert in the document and answer the question based on the document content.
                    Do not start your answer with "Based on the document content, here's what I found:" or any other similar phrase.`],
                    ["human", `
                    Context: {context}
                    
                    Question: {question}
                    
                    `]
                ]);
                
                // Create chain
                const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
                
                // Execute chain
                answer = await chain.invoke({
                    context: context,
                    question: question
                });
                console.log(`[QA DEBUG] LLM generated answer successfully: ${answer.substring(0, 100)}...`);
            } catch (llmError) {
                console.error(`[QA ERROR] LLM failed: ${llmError.message}`);
                console.log(`[QA FALLBACK] Using fallback answer generation`);
                
                // Fallback: Generate a simple answer based on context analysis
                answer = this._generateFallbackAnswer(question, relevantChunks);
            }
            
            // Return answer with sources
            return {
                answer: answer,
                sources: relevantChunks.map(chunk => ({
                    content: chunk.pageContent,
                    metadata: chunk.metadata
                }))
            };
        } catch (error) {
            console.error("Error in QA process:", error);
            throw new Error(`Failed to process question: ${error.message}`);
        }
    }
    
    /**
     * Get LLM model based on configuration
     * @returns {ChatOpenAI|ChatOllama} LLM model
     * @private
     */
    _getLLMModel() {
        const llmModel = process.env.LLM_MODEL || "ollama";
        
        if (llmModel === "openai") {
            return new ChatOpenAI({
                openAIApiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo",
                temperature: 0.2
            });
        } else {
            // Try different Ollama models in order of preference
            const ollamaModels = [
                process.env.OLLAMA_CHAT_MODEL || "llama3.2:1b",
                "llama3.2:1b",
                "llama2",
                "mistral",
                "codellama"
            ];
            
            // For now, use the first model and let error handling deal with failures
            const ollamaModel = ollamaModels[0];
            
            return new ChatOllama({
                baseUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
                model: ollamaModel,
                temperature: 0.2
            });
        }
    }
    
    /**
     * Generate a fallback answer when LLM fails
     * @param {string} question - User question
     * @param {Array} chunks - Relevant document chunks
     * @returns {string} Fallback answer
     * @private
     */
    _generateFallbackAnswer(question, chunks) {
        console.log(`[QA FALLBACK] Generating fallback answer for question: ${question}`);
        
        const questionLower = question.toLowerCase();
        const context = chunks.map(chunk => chunk.pageContent).join(" ");
        
        // For "what is this" type questions, provide comprehensive information
        if (questionLower.includes("what") || questionLower.includes("what is")) {
            // Extract meaningful sentences from all chunks
            const allSentences = [];
            chunks.forEach(chunk => {
                const sentences = chunk.pageContent.split(/[.!?]+/)
                    .filter(s => s.trim().length > 20)
                    .map(s => s.trim());
                allSentences.push(...sentences);
            });
            
            // Take the most relevant sentences (first few from each chunk)
            const relevantSentences = allSentences.slice(0, 5);
            
            if (relevantSentences.length > 0) {
                return relevantSentences.join(". ").trim() + ".";
            }
        }
        
        if (questionLower.includes("who")) {
            // Look for names or entities
            const namePattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
            const names = context.match(namePattern);
            if (names && names.length > 0) {
                const uniqueNames = [...new Set(names)].slice(0, 3);
                return uniqueNames.join(", ") + ".";
            }
        }
        
        if (questionLower.includes("when")) {
            // Look for dates
            const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4})/g;
            const dates = context.match(datePattern);
            if (dates && dates.length > 0) {
                const uniqueDates = [...new Set(dates)].slice(0, 3);
                return uniqueDates.join(", ") + ".";
            }
        }
        
        if (questionLower.includes("where")) {
            // Look for locations
            const locationPattern = /([A-Z][a-z]+ (?:City|District|State|Country|Pune|Mumbai|Delhi))/g;
            const locations = context.match(locationPattern);
            if (locations && locations.length > 0) {
                const uniqueLocations = [...new Set(locations)].slice(0, 3);
                return uniqueLocations.join(", ") + ".";
            }
        }
        
        // Generic fallback - extract comprehensive content
        if (chunks.length > 0) {
            // Combine content from multiple chunks for a more complete answer
            const combinedContent = chunks
                .map(chunk => chunk.pageContent.trim())
                .filter(content => content.length > 0)
                .join(" ");
            
            // Try to extract complete sentences
            const sentences = combinedContent.split(/[.!?]+/)
                .filter(s => s.trim().length > 30) // Only meaningful sentences
                .slice(0, 3) // Take first 3 complete sentences
                .map(s => s.trim());
            
            if (sentences.length > 0) {
                return sentences.join(". ").trim() + ".";
            }
            
            // If no complete sentences, return the first chunk content
            return chunks[0].pageContent.trim();
        }
        
        return "I don't have enough information to answer this question.";
    }
}

module.exports = new QAService(); 