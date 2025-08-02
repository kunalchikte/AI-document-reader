const { ChatOpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const embeddingService = require("./embeddingService");
const Document = require("../models/documentModel");
const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
const { supabase } = require("../../config/dbConnect");

class QAService {
    /**
     * Ask a question about a specific document
     * @param {string} documentId - Document ID
     * @param {string} question - User question
     * @param {number} topK - Number of relevant chunks to retrieve
     * @returns {Promise<Object>} Answer and sources
     */
    async askQuestion(documentId, question, topK = 5) {
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
                relevantChunks = await embeddingService.findRelevantChunks(documentId, question, topK);
            } catch (error) {
                console.error(`Error finding relevant chunks: ${error.message}`);
                
                // Direct Supabase query as a last resort if all else fails
                try {
                    const tableName = "documents";
                    const { data, error: queryError } = await supabase
                        .from(tableName)
                        .select("id, content, metadata")
                        .limit(100);
                    
                    if (queryError) throw new Error(`Supabase query error: ${queryError.message}`);
                    if (!data || data.length === 0) throw new Error("No documents found in database");
                    
                    // Filter by document ID
                    const docIdStr = documentId.toString();
                    const matchingChunks = data.filter(doc => {
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
            
            // Initialize LLM
            const llm = this._getLLMModel();
            
            // Create prompt template
            const promptTemplate = ChatPromptTemplate.fromMessages([
                ["system", `You are a helpful assistant that answers questions based on the provided document content. 
                Only use information from the provided context to answer questions.
                If you don't know the answer based on the context, say "I don't have enough information to answer this question."
                Be concise and accurate in your responses.`],
                ["human", `
                Context: {context}
                
                Question: {question}
                
                Answer the question based only on the provided context. Include specific details from the context.`]
            ]);
            
            // Create chain
            const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
            
            // Execute chain
            const answer = await chain.invoke({
                context: context,
                question: question
            });
            
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
            // Default to Ollama - use llama2 which is more commonly available
            const ollamaModel = process.env.OLLAMA_CHAT_MODEL || "llama2";
            
            return new ChatOllama({
                baseUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
                model: ollamaModel,
                temperature: 0.2
            });
        }
    }
}

module.exports = new QAService(); 