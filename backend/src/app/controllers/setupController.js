const pgVectorService = require("../services/pgVectorService");
const ollamaService = require("../services/ollamaService");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

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
        const config = {
            embeddingModel: process.env.EMBEDDING_MODEL || "openai",
            llmModel: process.env.LLM_MODEL || "openai",
            usingOllama: (process.env.EMBEDDING_MODEL === "ollama" || process.env.LLM_MODEL === "ollama"),
            usingOpenAI: (process.env.EMBEDDING_MODEL === "openai" || process.env.LLM_MODEL === "openai"),
            ollamaApiUrl: process.env.OLLAMA_API_URL || "http://localhost:11434",
            ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || "llama2",
            ollamaChatModel: process.env.OLLAMA_CHAT_MODEL || "llama2"
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
 * Check Ollama setup status and run installation script if needed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.checkOllamaStatus = async (req, res) => {
    try {
        // Get Ollama API URL from request or environment
        const ollamaApiUrl = req.query.api_url || process.env.OLLAMA_API_URL || "http://localhost:11434";
        
        // Execute the install-ollama.js script directly
        return new Promise((resolve) => {
            const projectRoot = path.resolve(__dirname, '../../../');
            const scriptPath = path.join(projectRoot, 'scripts', 'install-ollama.js');
            
            console.log(`Running Ollama installation script: ${scriptPath}`);
            
            const installProcess = exec(`node "${scriptPath}"`, { cwd: projectRoot });
            
            let stdoutData = '';
            let stderrData = '';
            
            installProcess.stdout.on('data', (data) => {
                stdoutData += data;
                console.log(data); // Log output in real-time
            });
            
            installProcess.stderr.on('data', (data) => {
                stderrData += data;
                console.error(data); // Log errors in real-time
            });
            
            installProcess.on('close', async (code) => {
                // Check Ollama status after script execution
                const ollamaStatus = await ollamaService.checkStatus(ollamaApiUrl);
                
                if (code === 0 && ollamaStatus.server.status) {
                    resolve(res.status(200).json({
                        status: 200,
                        msg: "Ollama status checked and installation completed successfully",
                        data: {
                            status: "healthy",
                            ollamaStatus: ollamaStatus,
                            scriptOutput: stdoutData,
                            exitCode: code
                        }
                    }));
                } else {
                    resolve(res.status(200).json({
                        status: 200,
                        msg: "Ollama status checked but installation has issues",
                        data: {
                            status: "unhealthy",
                            ollamaStatus: ollamaStatus,
                            scriptOutput: stdoutData,
                            scriptError: stderrData,
                            exitCode: code
                        }
                    }));
                }
            });
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error checking Ollama status: ${error.message}`,
            data: {
                status: "unhealthy",
                error: error.message
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

/**
 * Debug PostgreSQL documents table
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.debugPostgreSQL = async (req, res) => {
    try {
        const { pgPool } = require("../../config/dbConnect");
        const client = await pgPool.connect();
        
        try {
            // Get document count
            const countResult = await client.query('SELECT COUNT(*) as total FROM documents');
            
            // Get sample documents with metadata
            const sampleResult = await client.query(`
                SELECT id, 
                       LEFT(content, 100) as content_preview,
                       metadata,
                       created_at
                FROM documents 
                ORDER BY created_at DESC 
                LIMIT 5
            `);
            
            // Get unique document IDs from metadata
            const metadataResult = await client.query(`
                SELECT DISTINCT 
                    metadata->>'documentId' as document_id,
                    metadata->>'source' as source,
                    COUNT(*) as chunk_count
                FROM documents 
                WHERE metadata->>'documentId' IS NOT NULL
                GROUP BY metadata->>'documentId', metadata->>'source'
                ORDER BY chunk_count DESC
            `);
            
            return res.status(200).json({
                status: 200,
                msg: "PostgreSQL debug information",
                data: {
                    totalDocuments: parseInt(countResult.rows[0].total),
                    sampleDocuments: sampleResult.rows,
                    documentMetadata: metadataResult.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error debugging PostgreSQL: ${error.message}`,
            data: null
        });
    }
};

/**
 * Test document lookup by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.testDocumentLookup = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { pgPool } = require("../../config/dbConnect");
        const client = await pgPool.connect();
        
        try {
            // Test direct query
            const directQuery = await client.query(
                `SELECT id, LEFT(content, 200) as content_preview, metadata FROM documents WHERE metadata->>'documentId' = $1 OR metadata->>'document_id' = $1 OR metadata->>'id' = $1`,
                [documentId]
            );
            
            // Test vector search function
            let vectorTest = null;
            try {
                const testEmbedding = `[${Array(1536).fill(0.1).join(',')}]`;
                const vectorQuery = await client.query(
                    `SELECT id, LEFT(content, 100) as content_preview, metadata FROM match_documents($1::vector, 0.1, 5)`,
                    [testEmbedding]
                );
                vectorTest = {
                    success: true,
                    results: vectorQuery.rows.length,
                    sample: vectorQuery.rows.slice(0, 2)
                };
            } catch (error) {
                vectorTest = {
                    success: false,
                    error: error.message
                };
            }
            
            return res.status(200).json({
                status: 200,
                msg: "Document lookup test results",
                data: {
                    documentId,
                    directQuery: {
                        results: directQuery.rows.length,
                        data: directQuery.rows
                    },
                    vectorTest
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Error testing document lookup: ${error.message}`,
            data: null
        });
    }
};

 