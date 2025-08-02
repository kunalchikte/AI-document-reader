const axios = require('axios');
const { execSync } = require('child_process');

/**
 * Service for interacting with Ollama API and managing models
 */
class OllamaService {
    /**
     * Check if Ollama server is running and available
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Status of Ollama server
     */
    async checkServerStatus(ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            await axios.get(ollamaApiUrl);
            return { 
                status: true, 
                message: 'Ollama server is running'
            };
        } catch (error) {
            return { 
                status: false, 
                message: `Ollama server is not accessible: ${error.message}`
            };
        }
    }

    /**
     * Get list of available models
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} List of available models
     */
    async listModels(ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            const serverStatus = await this.checkServerStatus(ollamaApiUrl);
            if (!serverStatus.status) {
                return { 
                    status: false, 
                    message: serverStatus.message,
                    models: []
                };
            }

            const response = await axios.get(`${ollamaApiUrl}/api/tags`);
            
            if (response.data && response.data.models) {
                return {
                    status: true,
                    message: 'Models retrieved successfully',
                    models: response.data.models.map(model => ({
                        name: model.name,
                        size: model.size,
                        modified: model.modified
                    }))
                };
            } else {
                return {
                    status: false,
                    message: 'Unexpected response format from Ollama server',
                    models: []
                };
            }
        } catch (error) {
            return {
                status: false,
                message: `Error listing models: ${error.message}`,
                models: []
            };
        }
    }

    /**
     * Check if embeddings API is available
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Status of embeddings API
     */
    async checkEmbeddingsApi(ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            const serverStatus = await this.checkServerStatus(ollamaApiUrl);
            if (!serverStatus.status) {
                return { 
                    status: false, 
                    message: serverStatus.message
                };
            }

            // Try the main embeddings endpoint
            try {
                await axios.post(`${ollamaApiUrl}/api/embeddings`, {
                    model: 'llama2',
                    prompt: 'Test embedding'
                });
                return {
                    status: true,
                    message: 'Embeddings API is available',
                    endpoint: '/api/embeddings'
                };
            } catch (error) {
                // Try the alternate embed endpoint
                try {
                    await axios.post(`${ollamaApiUrl}/api/embed`, {
                        model: 'llama2',
                        prompt: 'Test embedding'
                    });
                    return {
                        status: true,
                        message: 'Alternate embeddings API is available',
                        endpoint: '/api/embed'
                    };
                } catch (embedError) {
                    return {
                        status: false,
                        message: 'No embeddings API available',
                        error: {
                            main: error.message,
                            alternate: embedError.message
                        }
                    };
                }
            }
        } catch (error) {
            return {
                status: false,
                message: `Error checking embeddings API: ${error.message}`
            };
        }
    }

    /**
     * Check Ollama setup status, including server, models, and embeddings API
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Status of Ollama setup
     */
    async checkStatus(ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        const serverStatus = await this.checkServerStatus(ollamaApiUrl);
        
        if (!serverStatus.status) {
            return {
                server: serverStatus,
                models: {
                    status: false,
                    message: 'Server unavailable',
                    models: []
                },
                embeddings: {
                    status: false,
                    message: 'Server unavailable'
                }
            };
        }

        const modelsResult = await this.listModels(ollamaApiUrl);
        const embeddingsResult = await this.checkEmbeddingsApi(ollamaApiUrl);

        return {
            server: serverStatus,
            models: modelsResult,
            embeddings: embeddingsResult
        };
    }

    /**
     * Pull a model from Ollama
     * @param {string} modelName - Name of the model to pull
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Status of pull operation
     */
    async pullModel(modelName, ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            const serverStatus = await this.checkServerStatus(ollamaApiUrl);
            if (!serverStatus.status) {
                return { 
                    status: false, 
                    message: serverStatus.message
                };
            }

            // Check if model already exists
            const modelsResult = await this.listModels(ollamaApiUrl);
            if (modelsResult.status && modelsResult.models.some(m => m.name === modelName)) {
                return {
                    status: true,
                    message: `Model '${modelName}' is already installed`,
                    alreadyInstalled: true
                };
            }

            // Check if Ollama CLI is installed
            let useCliForPull = false;
            try {
                execSync('ollama --version', { stdio: 'ignore' });
                useCliForPull = true;
            } catch (error) {
                // CLI not available, will use API
            }

            if (useCliForPull) {
                // Use local CLI for better progress reporting
                execSync(`ollama pull ${modelName}`, { stdio: 'ignore' });
                return {
                    status: true,
                    message: `Successfully installed '${modelName}' using CLI`,
                    method: 'cli'
                };
            } else {
                // Use API directly
                await axios.post(`${ollamaApiUrl}/api/pull`, { name: modelName });
                return {
                    status: true,
                    message: `Successfully installed '${modelName}' using API`,
                    method: 'api'
                };
            }
        } catch (error) {
            return {
                status: false,
                message: `Failed to pull model '${modelName}': ${error.message}`
            };
        }
    }

    /**
     * Set up required models for the application
     * @param {string[]} models - List of models to set up
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Status of setup operation
     */
    async setupModels(models = ['llama2', 'nomic-embed-text'], ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            const serverStatus = await this.checkServerStatus(ollamaApiUrl);
            if (!serverStatus.status) {
                return { 
                    status: false, 
                    message: serverStatus.message,
                    results: []
                };
            }

            const results = [];
            for (const model of models) {
                const pullResult = await this.pullModel(model, ollamaApiUrl);
                results.push({
                    model,
                    ...pullResult
                });
            }

            const allSuccessful = results.every(result => result.status);
            return {
                status: allSuccessful,
                message: allSuccessful ? 'All models set up successfully' : 'Some models failed to set up',
                results
            };
        } catch (error) {
            return {
                status: false,
                message: `Error setting up models: ${error.message}`,
                results: []
            };
        }
    }

    /**
     * Test a specific model by generating a response
     * @param {string} modelName - Name of the model to test
     * @param {string} ollamaApiUrl - Ollama API URL
     * @returns {Promise<Object>} Test result with model response
     */
    async testModel(modelName, ollamaApiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434') {
        try {
            const serverStatus = await this.checkServerStatus(ollamaApiUrl);
            if (!serverStatus.status) {
                return { 
                    status: false, 
                    message: serverStatus.message
                };
            }

            // Try chat endpoint first
            try {
                const response = await axios.post(
                    `${ollamaApiUrl}/api/chat`,
                    {
                        model: modelName,
                        messages: [{ role: "user", content: "Say 'Hello world!'" }]
                    },
                    { timeout: 30000 }
                );
                
                if (response.data && response.data.message) {
                    return {
                        status: true,
                        message: `Model '${modelName}' tested successfully using chat endpoint`,
                        response: response.data.message.content,
                        endpoint: '/api/chat'
                    };
                }
            } catch (error) {
                // Try generate endpoint as fallback
                try {
                    const response = await axios.post(
                        `${ollamaApiUrl}/api/generate`,
                        {
                            model: modelName,
                            prompt: "Say 'Hello world!'"
                        },
                        { timeout: 30000 }
                    );
                    
                    if (response.data && response.data.response) {
                        return {
                            status: true,
                            message: `Model '${modelName}' tested successfully using generate endpoint`,
                            response: response.data.response,
                            endpoint: '/api/generate'
                        };
                    }
                } catch (fallbackError) {
                    return {
                        status: false,
                        message: `Failed to test model '${modelName}': ${error.message}, fallback also failed: ${fallbackError.message}`
                    };
                }
            }

            return {
                status: false,
                message: `Unexpected response format from model '${modelName}'`
            };
        } catch (error) {
            return {
                status: false,
                message: `Error testing model '${modelName}': ${error.message}`
            };
        }
    }
}

module.exports = new OllamaService(); 