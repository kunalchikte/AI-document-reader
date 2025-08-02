/**
 * Auth Middleware
 * 
 * This middleware is a simplified version of what would normally handle authentication.
 * For the AI Document Reader application, we've simplified it to avoid dependencies.
 */

const jwt = require("jsonwebtoken");

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "ai-document-reader-secret-key";

// Generate a JWT token
exports.genToken = async (userData) => {
    try {
        const token = jwt.sign(
            userData,
            JWT_SECRET,
            { expiresIn: "24h" }
        );
        
        return {
            status: true,
            token: token,
        };
    } catch (err) {
        return {
            status: false,
            errMsg: err.toString(),
        };
    }
};

// Verify token middleware
exports.verifyToken = (req, res, next) => {
    // For the simplified application, we'll just let requests through
    // In a real app, this would verify the JWT token
    
    // Mock user ID for testing
    req.userId = "mockuser123";
    next();
};

// Destroy token (logout)
exports.destroyToken = (req, res) => {
    return res.status(200).json({
        status: 200,
        msg: "Logged out successfully",
        data: null
    });
};

