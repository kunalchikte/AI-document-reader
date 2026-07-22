const { pgPool } = require("../../config/dbConnect");

const TABLE_NAME = "chat_messages";

class ChatRepository {
    async syncSchema() {
        if (!pgPool) {
            throw new Error("PostgreSQL connection pool is not initialized");
        }

        const client = await pgPool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    document_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    sources JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS chat_messages_document_id_idx
                ON ${TABLE_NAME} (document_id);
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx
                ON ${TABLE_NAME} (user_id);
            `);

            return { success: true, message: `${TABLE_NAME} table is ready` };
        } finally {
            client.release();
        }
    }

    async create({ documentId, userId, role, content, sources = [] }) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `INSERT INTO ${TABLE_NAME} (document_id, user_id, role, content, sources)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [documentId, userId, role, content, JSON.stringify(sources || [])]
            );
            return this.formatMessage(result.rows[0]);
        } finally {
            client.release();
        }
    }

    formatMessage(row) {
        if (!row) return null;
        return {
            id: row.id,
            documentId: row.document_id,
            userId: row.user_id,
            role: row.role,
            content: row.content,
            sources: typeof row.sources === "string" ? JSON.parse(row.sources) : (row.sources || []),
            createdAt: row.created_at,
            sender: row.role === "user" ? "user" : "bot",
            timestamp: row.created_at,
        };
    }

    async findByDocument(documentId, userId) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM ${TABLE_NAME}
                 WHERE document_id = $1 AND user_id = $2
                 ORDER BY created_at ASC`,
                [documentId, userId]
            );
            return result.rows.map((row) => this.formatMessage(row));
        } finally {
            client.release();
        }
    }

    async deleteByDocument(documentId) {
        const client = await pgPool.connect();
        try {
            await client.query(`DELETE FROM ${TABLE_NAME} WHERE document_id = $1`, [documentId]);
        } finally {
            client.release();
        }
    }
}

module.exports = new ChatRepository();
