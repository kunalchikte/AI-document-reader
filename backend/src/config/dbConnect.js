const { Pool } = require("pg");

const pgConfig = {
	user: process.env.PG_USER || process.env.POSTGRES_USER,
	host: process.env.PG_HOST || process.env.POSTGRES_HOST || "localhost",
	database: process.env.PG_DATABASE || process.env.POSTGRES_DB || "ai_documents",
	password: process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD,
	port: Number(process.env.PG_PORT || process.env.POSTGRES_PORT || 5432),
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
};

let pgPool = null;

if (pgConfig.user && pgConfig.password) {
	try {
		pgPool = new Pool(pgConfig);
		console.log("PostgreSQL connection pool initialized successfully");

		pgPool.on("error", (err) => {
			console.error("PostgreSQL pool error:", err);
		});
	} catch (err) {
		console.error("PostgreSQL connection error:", err);
	}
} else {
	console.warn("PostgreSQL connection not configured. Check PG_USER and PG_PASSWORD environment variables.");
}

const initializePostgreSQL = async () => {
	if (!pgPool) {
		return Promise.reject(new Error("PostgreSQL connection pool not initialized. Check your environment variables."));
	}

	const client = await pgPool.connect();
	try {
		const extensionQuery = await client.query(
			"SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector"
		);

		if (!extensionQuery.rows[0].has_vector) {
			console.warn("pgvector extension is not installed. Attempting to enable it...");
			await client.query("CREATE EXTENSION IF NOT EXISTS vector");
		}

		console.log("pgvector extension is available");
		return Promise.resolve();
	} finally {
		client.release();
	}
};

module.exports = {
	pgPool,
	initializePostgreSQL,
};
