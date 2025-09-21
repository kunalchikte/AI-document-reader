// Load environment variables before any other imports
const path = require("path");
const dotenv = require("dotenv");
const fs = require("fs");

// Try to load from .env.local first, then fall back to environment-specific .env file
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envEnvPath = path.resolve(process.cwd(), `.env.${process.env.NODE_ENV}`);
const envDefaultPath = path.resolve(process.cwd(), ".env");

// Determine which env file exists and should be used
let envPath = envDefaultPath;
if (fs.existsSync(envLocalPath)) {
    envPath = envLocalPath;
} else if (process.env.NODE_ENV && fs.existsSync(envEnvPath)) {
    envPath = envEnvPath;
}

// Load environment variables
dotenv.config({ path: envPath });

// Other imports
const express = require("express");
const app = express();
const router = express.Router();
const helmet = require("helmet");
const compression = require("compression");
const http = require("http");
const morgan = require("morgan");

const server = http.createServer(app);

// Custom request logger
morgan.token('request-body', (req) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const bodyClone = { ...req.body };
        // Don't log file contents
        if (bodyClone.file) bodyClone.file = '[File content omitted]';
        return JSON.stringify(bodyClone);
    }
    return '';
});

// Request logging middleware
app.use(morgan((tokens, req, res) => {
    const now = new Date();
    const timestamp = `${now.toISOString()}`;
    return [
        `[${timestamp}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), 'ms',
        tokens['request-body'](req, res)
    ].join(' ');
}));

app.use(compression({
	filter: (req, res) => {
		if (req.headers["x-no-compression"]) return false;
		return compression.filter(req, res);
	},
	level: 6
}));

// Define the static folder
app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

app.use(helmet());

require("../config/rateLimit")(app); // Rate Limit 100 Requests in 15 min allowed

app.use(express.json({ limit: "10mb" })); // Get Raw data from post API
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Initialize Swagger from the centralized config
require("../swagger")(app);

// Global error handler with enhanced logging
app.use((err, req, res, next) => {
    const now = new Date();
    const timestamp = `${now.toISOString()}`;
    console.error(`[${timestamp}] ERROR:`, err);
    
    if (err.stack) {
        console.error(`[${timestamp}] STACK:`, err.stack);
    }
    
	if (err instanceof SyntaxError) {
		return res.status(400).json({
			status: 400,
			msg: "Invalid Data sent",
			data: null
		});
	}

	// Handle other types of errors
	res.status(err.status || 500).json({
		status: err.status || 500,
		msg: process.env.NODE_ENV === "prod" ? "Internal Server Error" : err.message,
		data: null
	});
});

require("../config/cors")(app); // Cors Added
// require("../app/middleware/auth/auth").verifyKeys(app); // Verify API Keys

// Initialize database connections before mounting routes
const { initializeMongo, initializePostgreSQL } = require("../config/dbConnect");

Promise.all([
    initializeMongo(),
    initializePostgreSQL()
])
    .then(async () => {
        console.log("All database connections established successfully");
        
        // Synchronize PostgreSQL schema after connection is established
        try {
            const pgVectorService = require("../app/services/pgVectorService");
            const syncResult = await pgVectorService.syncDatabase();
            if (syncResult.status) {
                console.log("PostgreSQL schema synchronized successfully");
            } else {
                console.warn(`PostgreSQL schema sync warning: ${syncResult.message}`);
            }
        } catch (syncError) {
            console.warn(`PostgreSQL schema sync error: ${syncError.message}`);
            // Continue startup even if sync fails
        }
        
        // Mount routes after DB connections are established
        require("../routes")(app, router);
        
        const PORT = process.env.PORT || 3000;
        
        server.listen(PORT,(err) => {
        	if(process.env.NODE_ENV !="prod"){
        		(!err) ? console.log(`Server running on port ${PORT}. API documentation available at http://localhost:${PORT}/api-docs`) : console.log("Error while running the server!" + err);
        	}
        });
    })
    .catch(err => {
        console.error("Failed to connect to databases:", err);
        process.exit(1);
    });

// module.exports.main = serverless(app); // add when to work on serverless