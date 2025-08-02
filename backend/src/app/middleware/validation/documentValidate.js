const { body, param, validationResult } = require("express-validator");
const { validateRequest } = require("./validator");
const path = require("path");

/**
 * Validate document ID parameter
 */
exports.validateDocumentId = [
    param("documentId")
        .notEmpty()
        .withMessage("Document ID is required")
        .isMongoId()
        .withMessage("Invalid document ID format"),
    validateRequest
];

/**
 * Validate file upload
 */
exports.validateFileUpload = (req, res, next) => {
    // File is handled by multer middleware
    if (!req.file) {
        return res.status(400).json({
            status: 400,
            msg: "Please upload a file",
            data: null
        });
    }
    
    const allowedFileTypes = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt"];
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedFileTypes.includes(fileExtension)) {
        // Delete uploaded file
        const fs = require("fs");
        fs.unlinkSync(req.file.path);
        
        return res.status(400).json({
            status: 400,
            msg: `Invalid file type. Allowed file types: ${allowedFileTypes.join(", ")}`,
            data: null
        });
    }
    
    next();
};

/**
 * Validate question request
 */
exports.validateQuestion = [
    param("documentId")
        .notEmpty()
        .withMessage("Document ID is required")
        .isMongoId()
        .withMessage("Invalid document ID format"),
    body("question")
        .notEmpty()
        .withMessage("Question is required")
        .isString()
        .withMessage("Question must be a string")
        .isLength({ min: 3, max: 1000 })
        .withMessage("Question must be between 3 and 1000 characters"),
    body("topK")
        .optional()
        .isInt({ min: 1, max: 20 })
        .withMessage("topK must be an integer between 1 and 20"),
    validateRequest
]; 