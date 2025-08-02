const { Embeddings } = require("@langchain/core/embeddings");
const axios = require("axios");

/**
 * Custom Ollama Embeddings that work even without dedicated embedding endpoints
 * This uses the chat completion endpoint as a fallback for embeddings
 */
class DirectOllamaEmbeddings extends Embeddings {
  constructor(fields = {}) {
    super(fields);
    
    this.model = fields.model || "llama2";
    this.baseUrl = fields.baseUrl || "http://localhost:11434";
    this.dimensions = fields.dimensions || 1536; // Target dimension for compatibility with Supabase
    this.timeout = fields.timeout || 60000;
    
    // Remove trailing slash if present in baseUrl
    if (this.baseUrl.endsWith("/")) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }
  
  /**
   * Get embeddings for multiple texts
   */
  async embedDocuments(texts) {
    const embeddings = [];
    
    for (const text of texts) {
      try {
        const embedding = await this._generateEmbedding(text);
        const resizedEmbedding = this._resizeEmbedding(embedding, this.dimensions);
        embeddings.push(resizedEmbedding);
      } catch (error) {
        console.error(`Error embedding text: ${error.message}`);
        // Return zero vector if embedding fails to avoid breaking the process
        embeddings.push(new Array(this.dimensions).fill(0));
      }
    }
    
    return embeddings;
  }
  
  /**
   * Get embedding for a single text
   */
  async embedQuery(text) {
    try {
      const embedding = await this._generateEmbedding(text);
      return this._resizeEmbedding(embedding, this.dimensions);
    } catch (error) {
      console.error(`Error embedding query: ${error.message}`);
      // Return zero vector if embedding fails
      return new Array(this.dimensions).fill(0);
    }
  }
  
  /**
   * Resize embedding to target dimensions
   */
  _resizeEmbedding(embedding, targetDim) {
    const originalDim = embedding.length;
    
    // If dimensions already match, return as is
    if (originalDim === targetDim) {
      return embedding;
    }
    
    if (originalDim > targetDim) {
      // If original is larger, take subset or average values
      if (originalDim % targetDim === 0) {
        // If it divides evenly, average groups
        const groupSize = originalDim / targetDim;
        const result = [];
        
        for (let i = 0; i < targetDim; i++) {
          let sum = 0;
          for (let j = 0; j < groupSize; j++) {
            sum += embedding[i * groupSize + j];
          }
          result.push(sum / groupSize);
        }
        
        return result;
      } else {
        // Just take first targetDim elements
        return embedding.slice(0, targetDim);
      }
    } else {
      // If original is smaller, repeat or interpolate values
      const repeats = Math.ceil(targetDim / originalDim);
      const repeated = Array(repeats).fill(embedding).flat();
      return repeated.slice(0, targetDim);
    }
  }
  
  /**
   * Generate embedding using multiple fallback methods
   */
  async _generateEmbedding(text) {
    const methods = [
      this._tryEmbeddingsEndpoint.bind(this),
      this._tryEmbedEndpoint.bind(this),
      this._tryChatCompletionEmbedding.bind(this),
      this._tryCompletionEmbedding.bind(this)
    ];
    
    for (const method of methods) {
      try {
        const embedding = await method(text);
        if (embedding && embedding.length > 0) {
          return embedding;
        }
      } catch (error) {
        console.warn(`Embedding method failed: ${error.message}`);
        // Continue to next method
      }
    }
    
    // If all methods fail, generate a deterministic pseudo-embedding from the text
    console.warn("All embedding methods failed, using fallback hashing method");
    return this._generatePseudoEmbedding(text);
  }
  
  /**
   * Try the standard /api/embeddings endpoint
   */
  async _tryEmbeddingsEndpoint(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: text
        },
        {
          timeout: this.timeout
        }
      );
      
      if (response.data && response.data.embedding) {
        return response.data.embedding;
      }
      throw new Error("No embedding in response");
    } catch (error) {
      throw new Error(`Embeddings endpoint failed: ${error.message}`);
    }
  }
  
  /**
   * Try the alternate /api/embed endpoint
   */
  async _tryEmbedEndpoint(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embed`,
        {
          model: this.model,
          prompt: text
        },
        {
          timeout: this.timeout
        }
      );
      
      if (response.data && response.data.embedding) {
        return response.data.embedding;
      }
      throw new Error("No embedding in response");
    } catch (error) {
      throw new Error(`Embed endpoint failed: ${error.message}`);
    }
  }
  
  /**
   * Try generating embeddings using chat completion
   * This is a fallback for when embedding endpoints aren't available
   */
  async _tryChatCompletionEmbedding(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are an embedding generator. Generate a semantic representation of the text as a JSON array of 64 floating point numbers between -1 and 1. Only respond with the JSON array, no other text."
            },
            {
              role: "user",
              content: text
            }
          ],
          options: {
            temperature: 0.0
          }
        },
        {
          timeout: this.timeout
        }
      );
      
      if (response.data && response.data.message && response.data.message.content) {
        const content = response.data.message.content;
        // Extract JSON array from response, handle cases where there might be extra text
        const matches = content.match(/\[[\s\S]*?\]/);
        if (matches && matches[0]) {
          const array = JSON.parse(matches[0]);
          if (Array.isArray(array) && array.length > 0) {
            return array;
          }
        }
      }
      throw new Error("No valid embedding in chat response");
    } catch (error) {
      throw new Error(`Chat completion embedding failed: ${error.message}`);
    }
  }
  
  /**
   * Try generating embeddings using completion endpoint
   */
  async _tryCompletionEmbedding(text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: `Generate a semantic representation of the following text as a JSON array of 64 floating point numbers between -1 and 1. Only respond with the JSON array, no other text.\n\nText: ${text}\n\nArray:`,
          options: {
            temperature: 0.0
          }
        },
        {
          timeout: this.timeout
        }
      );
      
      if (response.data && response.data.response) {
        const content = response.data.response;
        // Extract JSON array from response
        const matches = content.match(/\[[\s\S]*?\]/);
        if (matches && matches[0]) {
          const array = JSON.parse(matches[0]);
          if (Array.isArray(array) && array.length > 0) {
            return array;
          }
        }
      }
      throw new Error("No valid embedding in completion response");
    } catch (error) {
      throw new Error(`Completion embedding failed: ${error.message}`);
    }
  }
  
  /**
   * Generate a deterministic pseudo-embedding from text using hashing
   * This is a last resort fallback that always works but has limited semantic value
   */
  _generatePseudoEmbedding(text) {
    // Create a more stable pseudo-embedding using word frequencies
    // This will at least preserve some minimal semantic properties
    
    // Clean and normalize text
    const cleanedText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
      
    // Extract words and count frequencies
    const words = cleanedText.split(' ');
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 2) { // Skip very short words
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    // Get the top words by frequency
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(entry => entry[0]);
      
    // Generate a fixed-size vector using these words
    const vector = new Array(this.dimensions).fill(0);
    
    // Each word will influence multiple dimensions of the vector
    topWords.forEach((word, wordIndex) => {
      const hash = this._simpleHash(word);
      
      // Use the hash to influence multiple dimensions
      for (let i = 0; i < 16; i++) {
        const position = Math.abs((hash * (i + 1)) % this.dimensions);
        const value = (wordFreq[word] / words.length) * (1.0 - (wordIndex * 0.01));
        vector[position] += value;
      }
    });
    
    // Add a component based on text length
    for (let i = 0; i < this.dimensions; i += 200) {
      vector[i] += text.length / 10000;
    }
    
    // Normalize the vector to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vector.map(val => val / magnitude);
  }
  
  /**
   * Simple string hashing function
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

module.exports = { DirectOllamaEmbeddings }; 