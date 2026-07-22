const { pgPool } = require("../../config/dbConnect");

class UserRepository {
    async syncSchema() {
        if (!pgPool) {
            throw new Error("PostgreSQL connection pool is not initialized");
        }

        const client = await pgPool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    name TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
            `);

            return { success: true, message: "users table is ready" };
        } finally {
            client.release();
        }
    }

    formatUser(row) {
        if (!row) return null;
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    async create({ email, passwordHash, name }) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `INSERT INTO users (email, password_hash, name)
                 VALUES ($1, $2, $3)
                 RETURNING id, email, name, created_at, updated_at`,
                [email.toLowerCase().trim(), passwordHash, name || null]
            );
            return this.formatUser(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async findByEmail(email) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT * FROM users WHERE email = $1`,
                [email.toLowerCase().trim()]
            );
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async findById(id) {
        const client = await pgPool.connect();
        try {
            const result = await client.query(
                `SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1`,
                [id]
            );
            return this.formatUser(result.rows[0]);
        } finally {
            client.release();
        }
    }
}

module.exports = new UserRepository();
