const { pgPool } = require("../../config/dbConnect");

/**
 * PostgreSQL Vector Store implementation for pgvector
 * This replaces the SupabaseVectorStore with direct PostgreSQL operations
 */
class PostgresVectorStore {
    constructor(config) {
        this.pool = pgPool;
        this.tableName = config.tableName || 'documents';
        this.queryName = config.queryName || 'match_documents';
    }

    /**
     * Create vector store from texts
     * @param {Array<string>} texts - Array of text content
     * @param {Array<Object>} metadatas - Array of metadata objects
     * @param {Object} embeddings - Embeddings instance
     * @param {Object} config - Configuration object
     * @returns {Promise<PostgresVectorStore>} Vector store instance
     */
    static async fromTexts(texts, metadatas, embeddings, config) {
        const store = new PostgresVectorStore(config);
        
        // Generate embeddings for all texts
        const vectors = await embeddings.embedDocuments(texts);
        
        // Insert into PostgreSQL
        const client = await store.pool.connect();
        try {
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                const metadata = metadatas[i] || {};
                const embedding = vectors[i];
                
                await client.query(
                    `INSERT INTO ${store.tableName} (content, metadata, embedding) VALUES ($1, $2, $3)`,
                    [text, JSON.stringify(metadata), `[${embedding.join(',')}]`]
                );
            }
        } finally {
            client.release();
        }
        
        return store;
    }

    /**
     * Create vector store from documents
     * @param {Array<Object>} documents - Array of document objects
     * @param {Object} embeddings - Embeddings instance
     * @param {Object} config - Configuration object
     * @returns {Promise<PostgresVectorStore>} Vector store instance
     */
    static async fromDocuments(documents, embeddings, config) {
        const texts = documents.map(doc => doc.pageContent);
        const metadatas = documents.map(doc => doc.metadata || {});
        
        return PostgresVectorStore.fromTexts(texts, metadatas, embeddings, config);
    }

    /**
     * Search for similar vectors
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} k - Number of results to return
     * @param {Object} filter - Optional metadata filter
     * @returns {Promise<Array<Object>>} Similar documents
     */
    async similaritySearchVectorWithScore(queryEmbedding, k = 5, filter = null) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT id, content, metadata, 
                       1 - (embedding <=> $1::vector) AS similarity
                FROM ${this.tableName}
            `;
            
            const params = [`[${queryEmbedding.join(',')}]`];
            
            if (filter) {
                // Add metadata filter if provided
                query += ' WHERE metadata @> $2';
                params.push(JSON.stringify(filter));
            }
            
            query += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
            params.push(k);
            
            const result = await client.query(query, params);
            
            return result.rows.map(row => ({
                pageContent: row.content,
                metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
                similarity: parseFloat(row.similarity)
            }));
        } finally {
            client.release();
        }
    }

    /**
     * Search for similar vectors (without scores)
     * @param {Array<number>} queryEmbedding - Query embedding vector
     * @param {number} k - Number of results to return
     * @param {Object} filter - Optional metadata filter
     * @returns {Promise<Array<Object>>} Similar documents
     */
    async similaritySearch(queryEmbedding, k = 5, filter = null) {
        const results = await this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
        return results.map(result => ({
            pageContent: result.pageContent,
            metadata: result.metadata
        }));
    }

    /**
     * Add texts to the vector store
     * @param {Array<string>} texts - Array of text content
     * @param {Array<Object>} metadatas - Array of metadata objects
     * @param {Object} embeddings - Embeddings instance
     * @returns {Promise<Array<string>>} Array of document IDs
     */
    async addTexts(texts, metadatas, embeddings) {
        const vectors = await embeddings.embedDocuments(texts);
        const ids = [];
        
        const client = await this.pool.connect();
        try {
            for (let i = 0; i < texts.length; i++) {
                const text = texts[i];
                const metadata = metadatas[i] || {};
                const embedding = vectors[i];
                
                const result = await client.query(
                    `INSERT INTO ${this.tableName} (content, metadata, embedding) VALUES ($1, $2, $3) RETURNING id`,
                    [text, JSON.stringify(metadata), `[${embedding.join(',')}]`]
                );
                
                ids.push(result.rows[0].id.toString());
            }
        } finally {
            client.release();
        }
        
        return ids;
    }

    /**
     * Delete documents by IDs
     * @param {Array<string>} ids - Array of document IDs to delete
     * @returns {Promise<void>}
     */
    async delete(ids) {
        const client = await this.pool.connect();
        try {
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
            await client.query(
                `DELETE FROM ${this.tableName} WHERE id = ANY(ARRAY[${placeholders}])`,
                ids
            );
        } finally {
            client.release();
        }
    }
}

module.exports = PostgresVectorStore;
