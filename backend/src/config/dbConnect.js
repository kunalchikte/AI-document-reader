const mongoose = require("mongoose");
const { Pool } = require("pg");

// PostgreSQL Connection for pgvector
const pgConfig = {
	user: process.env.PG_USER || process.env.POSTGRES_USER,
	host: process.env.PG_HOST || process.env.POSTGRES_HOST || 'localhost',
	database: process.env.PG_DATABASE || process.env.POSTGRES_DB || 'ai_documents',
	password: process.env.PG_PASSWORD || process.env.POSTGRES_PASSWORD,
	port: process.env.PG_PORT || process.env.POSTGRES_PORT || 5432,
	max: 20, // Maximum number of clients in the pool
	idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
	connectionTimeoutMillis: 2000, // How long to wait for a connection
};

// Initialize PostgreSQL client
let pgPool = null;

if (pgConfig.user && pgConfig.password) {
	try {
		pgPool = new Pool(pgConfig);
		console.log("PostgreSQL connection pool initialized successfully");
		
		// Test the connection
		pgPool.on('connect', (client) => {
			console.log('New PostgreSQL client connected');
		});
		
		pgPool.on('error', (err) => {
			console.error('PostgreSQL pool error:', err);
		});
	} catch (err) {
		console.error("PostgreSQL connection error: ", err);
	}
} else {
	console.warn("PostgreSQL connection not configured. Check PG_USER and PG_PASSWORD environment variables.");
}

/**
 * Initialize MongoDB connection with proper error handling
 * @returns {Promise<void>} A promise that resolves when the connection is established
 */
const initializeMongo = async () => {
    // Get MongoDB connection details from environment variables
    const dbUrl = process.env.DB_URL;
    const dbName = process.env.DB_NAME;
    
    if (!dbUrl) {
        console.warn("Warning: MongoDB connection URL not provided. Some features may not work.");
        return Promise.resolve();
    }
    
    // Set connection options with increased timeout
    const options = {
        serverSelectionTimeoutMS: 30000, // 30 seconds
        socketTimeoutMS: 45000, // 45 seconds
        connectTimeoutMS: 30000, // 30 seconds
        heartbeatFrequencyMS: 10000 // More frequent heartbeats
    };
    
    try {
        // Register event listeners for connection status
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connection established successfully');
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB connection disconnected');
        });
        
        // Connect to MongoDB - directly use the connection string from env
        await mongoose.connect(dbUrl, options);
        return Promise.resolve();
    } catch (error) {
        console.error("MongoDB connection error:", error);
        return Promise.reject(error);
    }
};

/**
 * Initialize PostgreSQL connection and test pgvector extension
 * @returns {Promise<void>} A promise that resolves when the connection is established
 */
const initializePostgreSQL = async () => {
    if (!pgPool) {
        console.warn("PostgreSQL connection pool not initialized. Check your environment variables.");
        return Promise.resolve();
    }
    
    try {
        // Test the connection
        const client = await pgPool.connect();
        
        // Check if pgvector extension is available
        const extensionQuery = await client.query(
            "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector"
        );
        
        if (!extensionQuery.rows[0].has_vector) {
            console.warn("pgvector extension is not installed. Please install it first.");
        } else {
            console.log("pgvector extension is available");
        }
        
        client.release();
        return Promise.resolve();
    } catch (error) {
        console.error("PostgreSQL connection error:", error);
        return Promise.reject(error);
    }
};

// Export the mongoose instance, pgPool, and the initialization functions
module.exports = {
	mongoose,
	pgPool,
    initializeMongo,
    initializePostgreSQL
};