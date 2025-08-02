const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;

// Initialize Supabase client
let supabase = null;

if (supabaseUrl && supabaseKey) {
	try {
		supabase = createClient(supabaseUrl, supabaseKey);
	} catch (err) {
		console.error("Supabase connection error: ", err);
	}
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

// Export the mongoose instance, supabase client, and the initialization function
module.exports = {
	mongoose,
	supabase,
    initializeMongo
};