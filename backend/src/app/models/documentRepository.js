const { pgPool } = require("../../config/dbConnect");

const TABLE_NAME = "uploaded_documents";

/**
 * PostgreSQL repository for uploaded document metadata.
 * Vector chunks remain in the `documents` table (pgvector).
 */
class DocumentRepository {
    async syncSchema() {
        if (!pgPool) {
            throw new Error("PostgreSQL connection pool is not initialized");
        }

        const client = await pgPool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    filename TEXT NOT NULL,
                    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'xlsx', 'txt')),
                    original_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    uploaded_by UUID,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    vectorized BOOLEAN DEFAULT FALSE,
                    vector_table_name TEXT DEFAULT 'documents',
                    is_deleted BOOLEAN DEFAULT FALSE,
                    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                ALTER TABLE ${TABLE_NAME}
                ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days');
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS uploaded_documents_is_deleted_idx
                ON ${TABLE_NAME} (is_deleted);
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS uploaded_documents_created_at_idx
                ON ${TABLE_NAME} (created_at DESC);
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS uploaded_documents_uploaded_by_idx
                ON ${TABLE_NAME} (uploaded_by);
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS uploaded_documents_expires_at_idx
                ON ${TABLE_NAME} (expires_at);
            `);

            return { success: true, message: `${TABLE_NAME} table is ready` };
        } finally {
            client.release();
        }
    }

    formatDocument(row) {
        if (!row) return null;

        return {
            _id: row.id,
            id: row.id,
            filename: row.filename,
            fileType: row.file_type,
            originalName: row.original_name,
            filePath: row.file_path,
            uploadedBy: row.uploaded_by,
            metadata: row.metadata || {},
            vectorized: row.vectorized,
            vectorTableName: row.vector_table_name,
            isDeleted: row.is_deleted,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    async create(data) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `INSERT INTO ${TABLE_NAME}
                    (filename, file_type, original_name, file_path, uploaded_by, metadata, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '7 days')
                 RETURNING *`,
                [
                    data.filename,
                    data.fileType,
                    data.originalName,
                    data.filePath,
                    data.uploadedBy || null,
                    JSON.stringify(data.metadata || {}),
                ]
            );

            return this.formatDocument(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async findById(id, userId = null) {
        const client = await pgPool.connect();
        try {
            const params = [id];
            let sql = `SELECT * FROM ${TABLE_NAME} WHERE id = $1 AND is_deleted = FALSE`;
            if (userId) {
                params.push(userId);
                sql += ` AND uploaded_by = $2`;
            }
            const result = await client.query(sql, params);
            return this.formatDocument(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async findAll(userId) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT id, original_name, file_type, vectorized, created_at, expires_at
                 FROM ${TABLE_NAME}
                 WHERE is_deleted = FALSE AND uploaded_by = $1
                 ORDER BY created_at DESC`,
                [userId]
            );

            return result.rows.map((row) => ({
                _id: row.id,
                id: row.id,
                originalName: row.original_name,
                fileType: row.file_type,
                vectorized: row.vectorized,
                createdAt: row.created_at,
                expiresAt: row.expires_at,
            }));
        } finally {
            client.release();
        }
    }

    async markVectorized(id, vectorTableName = "documents") {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `UPDATE ${TABLE_NAME}
                 SET vectorized = TRUE,
                     vector_table_name = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND is_deleted = FALSE
                 RETURNING *`,
                [id, vectorTableName]
            );

            return this.formatDocument(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async deleteChunksForDocument(documentId) {
        const client = await pgPool.connect();
        try {
            await client.query(
                `DELETE FROM documents
                 WHERE metadata->>'documentId' = $1
                    OR metadata->>'document_id' = $1
                    OR metadata->>'id' = $1`,
                [documentId]
            );
        } finally {
            client.release();
        }
    }

    async hardDelete(id) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `DELETE FROM ${TABLE_NAME} WHERE id = $1 RETURNING *`,
                [id]
            );
            return this.formatDocument(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async findExpired() {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM ${TABLE_NAME}
                 WHERE (expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP)
                    OR (expires_at IS NULL AND created_at <= CURRENT_TIMESTAMP - INTERVAL '7 days')`
            );
            return result.rows.map((row) => this.formatDocument(row));
        } finally {
            client.release();
        }
    }
}

module.exports = new DocumentRepository();
