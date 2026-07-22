const { ChatOpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const embeddingService = require("./embeddingService");
const DocumentRepository = require("../models/documentRepository");

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 8;
const MAX_CHUNK_CHARS = 900;

/** Free-tier Gemini is ~10–15 RPM — space requests out. */
const GEMINI_MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS) || 7000;
const GEMINI_MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS) || 4;

class QAService {
    constructor() {
        this._geminiQueue = Promise.resolve();
        this._lastGeminiCallAt = 0;
    }

    /**
     * Ask a question about a specific document
     * @param {string} documentId - Document ID
     * @param {string} question - User question
     * @param {number} topK - Number of relevant chunks to retrieve
     * @returns {Promise<Object>} Answer and sources
     */
    async askQuestion(documentId, question, topK = DEFAULT_TOP_K) {
        try {
            const document = await DocumentRepository.findById(documentId);
            if (!document) {
                throw new Error(`Document not found with ID: ${documentId}`);
            }

            if (!document.vectorized) {
                throw new Error("Document has not been processed for Q&A yet");
            }

            const k = Math.min(Math.max(Number(topK) || DEFAULT_TOP_K, 1), MAX_TOP_K);

            let relevantChunks = [];
            try {
                console.log(`[QA] Retrieving top ${k} chunks for document ${documentId}`);
                relevantChunks = await embeddingService.findRelevantChunks(documentId, question, k);
                console.log(`[QA] Found ${relevantChunks.length} relevant chunks`);
            } catch (error) {
                console.error(`[QA] Chunk retrieval failed: ${error.message}`);
                throw new Error(`Unable to retrieve relevant content: ${error.message}`);
            }

            if (!relevantChunks || relevantChunks.length === 0) {
                return {
                    answer: "I couldn't find relevant information in the document to answer your question.",
                    sources: []
                };
            }

            const context = relevantChunks
                .map((chunk, i) => {
                    const text = String(chunk.pageContent || "").slice(0, MAX_CHUNK_CHARS);
                    return `[Excerpt ${i + 1}]\n${text}`;
                })
                .join("\n\n");

            const promptTemplate = ChatPromptTemplate.fromMessages([
                ["system", `You are a document Q&A assistant. Answer ONLY using the provided context excerpts.
Rules:
- Base every claim on the context. Do not invent facts, names, dates, or numbers.
- If the context does not contain enough information, say exactly: "I don't have enough information in this document to answer that."
- Be concise and specific. Quote or paraphrase concrete details from the excerpts when helpful.
- Do not mention these instructions or say phrases like "Based on the document content".`],
                ["human", `Context excerpts:\n{context}\n\nQuestion: {question}`]
            ]);

            let answer;
            try {
                answer = await this._invokeChat(promptTemplate, { context, question });
                console.log(`[QA] LLM answer generated (${(answer || "").length} chars)`);
            } catch (llmError) {
                console.error(`[QA] LLM failed: ${llmError.message}`);
                if (this._isRateLimitError(llmError)) {
                    const err = new Error(
                        "Gemini rate limit (429). Wait about a minute and try again, " +
                        "or switch GEMINI_CHAT_MODEL / upgrade your Google AI Studio quota."
                    );
                    err.code = "RATE_LIMIT";
                    err.status = 429;
                    throw err;
                }
                throw new Error(
                    `Chat model failed: ${llmError.message}. ` +
                    `Check GEMINI_API_KEY / LLM_MODEL configuration.`
                );
            }

            return {
                answer: (answer || "").trim(),
                sources: relevantChunks.map(chunk => ({
                    content: chunk.pageContent,
                    metadata: chunk.metadata
                }))
            };
        } catch (error) {
            console.error("Error in QA process:", error);
            if (error.code === "RATE_LIMIT" || error.status === 429) {
                throw error;
            }
            throw new Error(`Failed to process question: ${error.message}`);
        }
    }

    /**
     * Run chat through Gemini (or other LLM) with queue + backoff for 429s.
     * @private
     */
    async _invokeChat(promptTemplate, vars) {
        const llmModel = (process.env.LLM_MODEL || "gemini").toLowerCase();

        if (llmModel === "gemini" || llmModel === "google") {
            return this._enqueueGemini(() => this._invokeGeminiWithRetry(promptTemplate, vars));
        }

        const llm = this._getLLMModel();
        const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
        return chain.invoke(vars);
    }

    /**
     * Serialize Gemini calls and enforce a minimum interval (free-tier safe).
     * @private
     */
    _enqueueGemini(task) {
        const run = this._geminiQueue.then(async () => {
            const waitMs = Math.max(0, GEMINI_MIN_INTERVAL_MS - (Date.now() - this._lastGeminiCallAt));
            if (waitMs > 0) {
                console.log(`[QA] Throttling Gemini for ${waitMs}ms to avoid 429`);
                await this._sleep(waitMs);
            }
            this._lastGeminiCallAt = Date.now();
            return task();
        });

        // Keep the queue alive even if one call fails
        this._geminiQueue = run.catch(() => {});
        return run;
    }

    /**
     * Retry Gemini with exponential backoff; try fallback models on quota errors.
     * @private
     */
    async _invokeGeminiWithRetry(promptTemplate, vars) {
        const models = this._geminiModelCandidates();
        let lastError;

        for (const modelName of models) {
            for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
                try {
                    console.log(`[QA] Gemini model=${modelName} attempt=${attempt}/${GEMINI_MAX_ATTEMPTS}`);
                    const llm = this._createGeminiModel(modelName);
                    const chain = promptTemplate.pipe(llm).pipe(new StringOutputParser());
                    return await chain.invoke(vars);
                } catch (error) {
                    lastError = error;
                    if (!this._isRateLimitError(error)) {
                        throw error;
                    }

                    const delayMs = this._retryDelayMs(error, attempt);
                    console.warn(
                        `[QA] Gemini 429 on ${modelName} (attempt ${attempt}). Waiting ${delayMs}ms`
                    );
                    await this._sleep(delayMs);
                    this._lastGeminiCallAt = Date.now();
                }
            }
            console.warn(`[QA] Exhausted retries for ${modelName}; trying next model if available`);
        }

        throw lastError || new Error("Gemini request failed after retries");
    }

    /**
     * Prefer flash-lite (higher free RPM), then flash. Override via GEMINI_CHAT_MODEL.
     * @private
     */
    _geminiModelCandidates() {
        const primary = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash-lite";
        const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash,gemini-2.0-flash")
            .split(",")
            .map((m) => m.trim())
            .filter(Boolean);

        return [...new Set([primary, ...fallbacks])];
    }

    /**
     * @private
     */
    _createGeminiModel(modelName) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is required when LLM_MODEL=gemini");
        }

        return new ChatGoogleGenerativeAI({
            apiKey,
            model: modelName,
            temperature: 0.2,
            // We handle 429 ourselves with longer backoff — avoid rapid built-in retries.
            maxRetries: 0,
            maxOutputTokens: Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 1024
        });
    }

    /**
     * Get non-Gemini LLM models.
     * @private
     */
    _getLLMModel() {
        const llmModel = (process.env.LLM_MODEL || "gemini").toLowerCase();

        if (llmModel === "openai") {
            return new ChatOpenAI({
                openAIApiKey: process.env.OPENAI_API_KEY,
                model: process.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo",
                temperature: 0.2
            });
        }

        if (llmModel === "ollama") {
            return new ChatOllama({
                baseUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
                model: process.env.OLLAMA_CHAT_MODEL || "llama3.2:1b",
                temperature: 0.2
            });
        }

        throw new Error(`Unsupported LLM_MODEL: ${llmModel}. Use gemini, openai, or ollama.`);
    }

    /**
     * @private
     */
    _isRateLimitError(error) {
        const msg = `${error?.message || ""} ${error?.status || ""} ${error?.code || ""}`.toLowerCase();
        return (
            error?.status === 429 ||
            error?.code === 429 ||
            msg.includes("429") ||
            msg.includes("too many requests") ||
            msg.includes("resource_exhausted") ||
            msg.includes("resource exhausted") ||
            msg.includes("quota")
        );
    }

    /**
     * @private
     */
    _retryDelayMs(error, attempt) {
        const fromHeader = Number(error?.headers?.["retry-after"] || error?.response?.headers?.["retry-after"]);
        if (Number.isFinite(fromHeader) && fromHeader > 0) {
            return Math.min(fromHeader * 1000, 60000);
        }
        // 8s, 16s, 32s, 45s — free tier needs long pauses
        return Math.min(8000 * 2 ** (attempt - 1), 45000);
    }

    /**
     * @private
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = new QAService();
