const pgVectorService = require("../services/pgVectorService");
const ollamaService = require("../services/ollamaService");
const fs = require("fs");
const path = require("path");

/**
 * Initialize the application
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.initializeApp = async (req, res) => {
    try {
        // Check PostgreSQL connection
        const pgVectorStatus = await pgVectorService.checkSetup()
            .catch(error => {
                return { 
                    connection: { status: false, message: error.message },
                    pgvector: { status: false, message: error.message },
                    documentsTable: { status: false, message: error.message },
                    matchFunction: { status: false, message: error.message }
                };
            });
            
        // Check uploads directory
        const uploadsDir = path.join(__dirname, "../../../uploads");
        let uploadsResult = { success: true, message: "Uploads directory exists" };
        
        if (!fs.existsSync(uploadsDir)) {
            try {
                fs.mkdirSync(uploadsDir, { recursive: true });
                uploadsResult = { success: true, message: "Uploads directory created" };
            } catch (error) {
                uploadsResult = { success: false, message: `Error creating uploads directory: ${error.message}` };
            }
        }
        
        // Check Ollama status
        const ollamaStatus = await ollamaService.checkStatus()
            .catch(error => {
                return { 
                    server: { status: false, message: error.message },
                    models: { status: false, message: error.message },
                    embeddings: { status: false, message: error.message }
                };
            });
        
        // Return initialization results
        return res.status(200).json({
            status: 200,
            msg: "Initialization status",
            data: {
                postgresql: {
                    connection: pgVectorStatus.connection,
                    pgvector: pgVectorStatus.pgvector,
                    documentsTable: pgVectorStatus.documentsTable,
                    matchFunction: pgVectorStatus.matchFunction
                },
                ollama: ollamaStatus,
                uploads: uploadsResult
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Initialization error: ${error.message}`,
            data: null
        });
    }
};

/**
 * Get application status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getStatus = async (req, res) => {
    try {
        // Get configuration
        const llmModel = process.env.LLM_MODEL || "gemini";
        const embeddingModel = process.env.EMBEDDING_MODEL || "ollama";
        const config = {
            embeddingModel,
            llmModel,
            usingOllama: embeddingModel === "ollama" || llmModel === "ollama",
            usingGemini: llmModel === "gemini" || llmModel === "google",
            usingOpenAI: embeddingModel === "openai" || llmModel === "openai",
            geminiChatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash-lite",
            geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
            ollamaApiUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
            ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
            ollamaChatModel: process.env.OLLAMA_CHAT_MODEL || "llama3"
        };
        
        return res.status(200).json({
            status: 200,
            msg: "System status",
            data: {
                serverTime: new Date().toISOString(),
                config
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Status error: ${error.message}`,
            data: null
        });
    }
};

/**
 * Check Ollama setup status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.checkOllamaStatus = async (req, res) => {
    try {
        const ollamaApiUrl = req.query.api_url || process.env.OLLAMA_API_URL || "http://localhost:11434";
        const ollamaStatus = await ollamaService.checkStatus(ollamaApiUrl);

        return res.status(200).json({
            status: 200,
            msg: ollamaStatus.server.status ? "Ollama is reachable" : "Ollama is unavailable",
            data: ollamaStatus
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error checking Ollama status: ${error.message}`,
            data: {
                server: { status: false, message: error.message },
                models: { status: false, message: error.message, models: [] },
                embeddings: { status: false, message: error.message }
            }
        });
    }
};

/**
 * Setup Ollama models
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.setupOllamaModels = async (req, res) => {
    try {
        // Get parameters from request
        const { models = ['llama2', 'nomic-embed-text'], api_url } = req.body;
        const ollamaApiUrl = api_url || process.env.OLLAMA_API_URL || "http://localhost:11434";
        
        // Setup Ollama models
        const result = await ollamaService.setupModels(models, ollamaApiUrl);
        
        return res.status(200).json({
            status: 200,
            msg: result.status ? "Models setup successfully" : "Models setup completed with issues",
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error setting up Ollama models: ${error.message}`,
            data: null
        });
    }
};

/**
 * Setup specific Ollama model (e.g., llama2)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.setupSpecificModel = async (req, res) => {
    try {
        // Get parameters from request
        const { model_name = 'llama2', api_url } = req.body;
        const ollamaApiUrl = api_url || process.env.OLLAMA_API_URL || "http://localhost:11434";
        
        // Pull the specific model
        const pullResult = await ollamaService.pullModel(model_name, ollamaApiUrl);
        
        // If model was successfully pulled, test it
        let testResult = { status: false, message: "Model test skipped" };
        if (pullResult.status) {
            testResult = await ollamaService.testModel(model_name, ollamaApiUrl);
        }
        
        return res.status(200).json({
            status: 200,
            msg: pullResult.status ? "Model setup successfully" : "Model setup failed",
            data: {
                pull: pullResult,
                test: testResult
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error setting up model: ${error.message}`,
            data: null
        });
    }
};

/**
 * Check PostgreSQL setup status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.checkPostgreSQLStatus = async (req, res) => {
    try {
        // Check PostgreSQL status
        const pgVectorStatus = await pgVectorService.checkSetup();
        
        return res.status(200).json({
            status: 200,
            msg: "PostgreSQL status",
            data: pgVectorStatus
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error checking PostgreSQL status: ${error.message}`,
            data: null
        });
    }
};

/**
 * Setup PostgreSQL for vector storage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.setupPostgreSQL = async (req, res) => {
    try {
        // Setup PostgreSQL
        const result = await pgVectorService.setupPostgreSQL();
        
        return res.status(200).json({
            status: 200,
            msg: result.status ? "PostgreSQL setup completed successfully" : "PostgreSQL setup completed with issues",
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error setting up PostgreSQL: ${error.message}`,
            data: null
        });
    }
};

/**
 * Synchronize PostgreSQL database schema
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.syncPostgreSQL = async (req, res) => {
    try {
        // Synchronize database schema
        const result = await pgVectorService.syncDatabase();
        
        return res.status(200).json({
            status: 200,
            msg: result.status ? "Database schema synchronized successfully" : "Database schema synchronization completed with issues",
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error synchronizing database schema: ${error.message}`,
            data: null
        });
    }
};

 