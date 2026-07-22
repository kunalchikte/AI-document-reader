/**
 * Auth Middleware — JWT generate / verify
 */

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "ai-document-reader-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

exports.genToken = async (userData) => {
    try {
        const token = jwt.sign(userData, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return { status: true, token };
    } catch (err) {
        return { status: false, errMsg: err.toString() };
    }
};

exports.verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : req.headers["x-access-token"] || null;

        if (!token) {
            return res.status(401).json({
                status: 401,
                msg: "Authentication required",
                data: null,
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            email: decoded.email,
        };
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({
            status: 401,
            msg: "Invalid or expired token",
            data: null,
        });
    }
};

exports.destroyToken = (req, res) => {
    return res.status(200).json({
        status: 200,
        msg: "Logged out successfully",
        data: null,
    });
};
