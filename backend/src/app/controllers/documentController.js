const path = require("path");
const fs = require("fs");
const fileService = require("../services/fileService");
const embeddingService = require("../services/embeddingService");
const qaService = require("../services/qaService");
const Document = require("../models/documentModel");

// Helper function for enhanced error logging
const logError = (functionName, error, additionalInfo = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR in ${functionName}:`, error.message);
    if (error.stack) {
        console.error(`[${timestamp}] STACK:`, error.stack);
    }
    if (Object.keys(additionalInfo).length > 0) {
        console.error(`[${timestamp}] ADDITIONAL INFO:`, additionalInfo);
    }
};

/**
 * Upload a document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.uploadDocument = async (req, res) => {
    const functionName = 'uploadDocument';
    
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                msg: "No file uploaded",
                data: null
            });
        }

        const { filename, originalname, path: filePath, size } = req.file;
        
        // Determine file type from extension
        let fileType;
        try {
            fileType = fileService.getFileTypeFromExtension(originalname);
        } catch (error) {
            // Delete the uploaded file
            fs.unlinkSync(filePath);
            logError(functionName, error, { filename, originalname });
            return res.status(400).json({
                status: 400,
                msg: error.message,
                data: null
            });
        }

        // Create document record
        const document = await fileService.createDocument({
            filename,
            originalName: originalname,
            filePath,
            fileType,
            size,
            userId: req.user ? req.user._id : null
        });

        return res.status(200).json({
            status: 200,
            msg: "Document uploaded successfully",
            data: {
                documentId: document._id,
                filename: document.originalName,
                fileType: document.fileType
            }
        });
    } catch (error) {
        logError(functionName, error, { 
            file: req.file ? { 
                name: req.file.originalname, 
                size: req.file.size 
            } : 'No file' 
        });
        
        return res.status(500).json({
            status: 500,
            msg: `Error uploading document: ${error.message}`,
            data: null
        });
    }
};

/**
 * Process a document for embeddings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.processDocument = async (req, res) => {
    const functionName = 'processDocument';
    
    try {
        const { documentId } = req.params;
        
        // Get document
        const document = await Document.findById(documentId);
        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null
            });
        }
        
        // Extract text from document
        const text = await fileService.extractTextFromFile(document.filePath, document.fileType);
        
        // Create embeddings
        const result = await embeddingService.createEmbeddings(documentId, text);
        
        return res.status(200).json({
            status: 200,
            msg: "Document processed successfully",
            data: {
                documentId,
                chunks: result.chunks,
                collection: result.collectionName
            }
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });
        
        return res.status(500).json({
            status: 500,
            msg: `Error processing document: ${error.message}`,
            data: null
        });
    }
};

/**
 * Ask a question about a document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.askQuestion = async (req, res) => {
    const functionName = 'askQuestion';
    
    try {
        const { documentId } = req.params;
        const { question, topK } = req.body;
        
        if (!question) {
            return res.status(400).json({
                status: 400,
                msg: "Question is required",
                data: null
            });
        }
        
        // Validate that documentId is a valid MongoDB ObjectId
        if (!documentId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(200).json({
                status: 200,
                msg: "Question processed",
                data: {
                    answer: "The document ID you provided appears to be invalid. Please check that you're using a valid document ID.",
                    sources: []
                }
            });
        }
        
        try {
            // Get answer
            const result = await qaService.askQuestion(documentId, question, topK || 5);
            
            return res.status(200).json({
                status: 200,
                msg: "Question answered successfully",
                data: result
            });
        } catch (qaError) {
            // Log the error but don't expose internal details to the client
            logError(functionName, qaError, { 
                documentId: req.params.documentId,
                question: req.body ? req.body.question : 'No question'
            });
            
            let userMessage = "I'm having trouble retrieving information from this document.";
            
            if (qaError.message.includes("Document not found")) {
                userMessage = "I couldn't find the document you're referring to. Please check that the document ID is correct.";
            } else if (qaError.message.includes("not been vectorized") || qaError.message.includes("not been processed")) {
                userMessage = "This document hasn't been processed for questions yet. Please process the document first using the /process endpoint.";
            } else if (qaError.message.includes("No chunks found") || qaError.message.includes("No document chunks found")) {
                userMessage = "I couldn't find any content in this document. The document may be empty or may not have been properly processed.";
            }
            
            // Return a helpful message to the user with a 200 status code
            return res.status(200).json({
                status: 200,
                msg: "Question processed with limited information",
                data: {
                    answer: userMessage,
                    sources: []
                }
            });
        }
    } catch (error) {
        logError(functionName, error, { 
            documentId: req.params.documentId,
            question: req.body ? req.body.question : 'No question'
        });
        
        // Return a user-friendly message with a 200 status code
        return res.status(200).json({
            status: 200,
            msg: "Question processed with errors",
            data: {
                answer: "I encountered an unexpected error while trying to answer your question. Please try again or contact support if the issue persists.",
                sources: []
            }
        });
    }
};

/**
 * Get document list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getDocuments = async (req, res) => {
    const functionName = 'getDocuments';
    
    try {
        // Get documents (non-deleted)
        const documents = await Document.find({ isDeleted: false })
            .sort({ createdAt: -1 })
            .select("_id originalName fileType vectorized createdAt");
        
        return res.status(200).json({
            status: 200,
            msg: "Documents retrieved successfully",
            data: documents
        });
    } catch (error) {
        logError(functionName, error);
        
        return res.status(500).json({
            status: 500,
            msg: `Error retrieving documents: ${error.message}`,
            data: null
        });
    }
};

/**
 * Get document by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.getDocumentById = async (req, res) => {
    const functionName = 'getDocumentById';
    
    try {
        const { documentId } = req.params;
        
        // Get document
        const document = await Document.findById(documentId);
        if (!document || document.isDeleted) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null
            });
        }
        
        return res.status(200).json({
            status: 200,
            msg: "Document retrieved successfully",
            data: {
                _id: document._id,
                originalName: document.originalName,
                fileType: document.fileType,
                vectorized: document.vectorized,
                createdAt: document.createdAt,
                updatedAt: document.updatedAt,
                metadata: document.metadata
            }
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });
        
        return res.status(500).json({
            status: 500,
            msg: `Error retrieving document: ${error.message}`,
            data: null
        });
    }
};

/**
 * Delete document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
exports.deleteDocument = async (req, res) => {
    const functionName = 'deleteDocument';
    
    try {
        const { documentId } = req.params;
        
        // Get document
        const document = await Document.findById(documentId);
        if (!document || document.isDeleted) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null
            });
        }
        
        // Soft delete
        document.isDeleted = true;
        await document.save();
        
        // Try to delete the file
        try {
            if (fs.existsSync(document.filePath)) {
                fs.unlinkSync(document.filePath);
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error deleting file:`, err);
        }
        
        return res.status(200).json({
            status: 200,
            msg: "Document deleted successfully",
            data: null
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });
        
        return res.status(500).json({
            status: 500,
            msg: `Error deleting document: ${error.message}`,
            data: null
        });
    }
}; 