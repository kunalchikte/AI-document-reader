const path = require("path");
const fs = require("fs");
const fileService = require("../services/fileService");
const embeddingService = require("../services/embeddingService");
const qaService = require("../services/qaService");
const DocumentRepository = require("../models/documentRepository");
const ChatRepository = require("../models/chatRepository");
const RetentionService = require("../services/retentionService");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

exports.uploadDocument = async (req, res) => {
    const functionName = "uploadDocument";

    try {
        if (!req.file) {
            return res.status(400).json({
                status: 400,
                msg: "No file uploaded",
                data: null,
            });
        }

        const { filename, originalname, path: filePath, size } = req.file;

        let fileType;
        try {
            fileType = fileService.getFileTypeFromExtension(originalname);
        } catch (error) {
            fs.unlinkSync(filePath);
            logError(functionName, error, { filename, originalname });
            return res.status(400).json({
                status: 400,
                msg: error.message,
                data: null,
            });
        }

        const document = await fileService.createDocument({
            filename,
            originalName: originalname,
            filePath,
            fileType,
            size,
            userId: req.user.id,
        });

        return res.status(200).json({
            status: 200,
            msg: "Document uploaded successfully",
            data: {
                documentId: document.id,
                _id: document.id,
                id: document.id,
                filename: document.originalName,
                fileType: document.fileType,
                expiresAt: document.expiresAt,
            },
        });
    } catch (error) {
        logError(functionName, error, {
            file: req.file
                ? { name: req.file.originalname, size: req.file.size }
                : "No file",
        });

        return res.status(500).json({
            status: 500,
            msg: `Error uploading document: ${error.message}`,
            data: null,
        });
    }
};

exports.processDocument = async (req, res) => {
    const functionName = "processDocument";

    try {
        const { documentId } = req.params;
        const document = await DocumentRepository.findById(documentId, req.user.id);

        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null,
            });
        }

        const text = await fileService.extractTextFromFile(document.filePath, document.fileType);
        const result = await embeddingService.createEmbeddings(documentId, text);

        return res.status(200).json({
            status: 200,
            msg: "Document processed successfully",
            data: {
                documentId,
                chunks: result.chunks,
                collection: result.collectionName,
            },
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });

        return res.status(500).json({
            status: 500,
            msg: `Error processing document: ${error.message}`,
            data: null,
        });
    }
};

exports.askQuestion = async (req, res) => {
    const functionName = "askQuestion";

    try {
        const { documentId } = req.params;
        const { question, topK } = req.body;

        if (!question) {
            return res.status(400).json({
                status: 400,
                msg: "Question is required",
                data: null,
            });
        }

        if (!UUID_REGEX.test(documentId)) {
            return res.status(200).json({
                status: 200,
                msg: "Question processed",
                data: {
                    answer: "The document ID you provided appears to be invalid. Please check that you're using a valid document ID.",
                    sources: [],
                },
            });
        }

        const document = await DocumentRepository.findById(documentId, req.user.id);
        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null,
            });
        }

        try {
            await ChatRepository.create({
                documentId,
                userId: req.user.id,
                role: "user",
                content: question,
            });

            const result = await qaService.askQuestion(documentId, question, topK || 5);

            await ChatRepository.create({
                documentId,
                userId: req.user.id,
                role: "assistant",
                content: result.answer,
                sources: result.sources || [],
            });

            return res.status(200).json({
                status: 200,
                msg: "Question answered successfully",
                data: result,
            });
        } catch (qaError) {
            logError(functionName, qaError, {
                documentId: req.params.documentId,
                question: req.body ? req.body.question : "No question",
            });

            let userMessage = "I'm having trouble retrieving information from this document.";
            let httpStatus = 200;
            let responseStatus = 200;

            if (qaError.code === "RATE_LIMIT" || qaError.status === 429 || /429|rate limit|resource.?exhausted|quota/i.test(qaError.message || "")) {
                httpStatus = 429;
                responseStatus = 429;
                userMessage =
                    "Gemini is rate-limited right now (too many requests). Please wait about a minute and try again.";
            } else if (qaError.message.includes("Document not found")) {
                userMessage = "I couldn't find the document you're referring to. Please check that the document ID is correct.";
            } else if (qaError.message.includes("not been vectorized") || qaError.message.includes("not been processed")) {
                userMessage = "This document hasn't been processed for questions yet. Please process the document first.";
            } else if (qaError.message.includes("No chunks found") || qaError.message.includes("No document chunks found")) {
                userMessage = "I couldn't find any content in this document. The document may be empty or may not have been properly processed.";
            }

            await ChatRepository.create({
                documentId,
                userId: req.user.id,
                role: "assistant",
                content: userMessage,
                sources: [],
            }).catch(() => {});

            return res.status(httpStatus).json({
                status: responseStatus,
                msg: responseStatus === 429 ? "Rate limited" : "Question processed with limited information",
                data: {
                    answer: userMessage,
                    sources: [],
                },
            });
        }
    } catch (error) {
        logError(functionName, error, {
            documentId: req.params.documentId,
            question: req.body ? req.body.question : "No question",
        });

        return res.status(200).json({
            status: 200,
            msg: "Question processed with errors",
            data: {
                answer: "I encountered an unexpected error while trying to answer your question. Please try again or contact support if the issue persists.",
                sources: [],
            },
        });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { documentId } = req.params;
        const document = await DocumentRepository.findById(documentId, req.user.id);

        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null,
            });
        }

        const messages = await ChatRepository.findByDocument(documentId, req.user.id);

        return res.status(200).json({
            status: 200,
            msg: "Messages retrieved successfully",
            data: messages,
        });
    } catch (error) {
        logError("getMessages", error, { documentId: req.params.documentId });
        return res.status(500).json({
            status: 500,
            msg: `Error retrieving messages: ${error.message}`,
            data: null,
        });
    }
};

exports.getDocuments = async (req, res) => {
    const functionName = "getDocuments";

    try {
        const documents = await DocumentRepository.findAll(req.user.id);

        return res.status(200).json({
            status: 200,
            msg: "Documents retrieved successfully",
            data: documents,
        });
    } catch (error) {
        logError(functionName, error);

        return res.status(500).json({
            status: 500,
            msg: `Error retrieving documents: ${error.message}`,
            data: null,
        });
    }
};

exports.getDocumentById = async (req, res) => {
    const functionName = "getDocumentById";

    try {
        const { documentId } = req.params;
        const document = await DocumentRepository.findById(documentId, req.user.id);

        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null,
            });
        }

        return res.status(200).json({
            status: 200,
            msg: "Document retrieved successfully",
            data: document,
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });

        return res.status(500).json({
            status: 500,
            msg: `Error retrieving document: ${error.message}`,
            data: null,
        });
    }
};

exports.deleteDocument = async (req, res) => {
    const functionName = "deleteDocument";

    try {
        const { documentId } = req.params;
        const document = await DocumentRepository.findById(documentId, req.user.id);

        if (!document) {
            return res.status(404).json({
                status: 404,
                msg: "Document not found",
                data: null,
            });
        }

        await RetentionService.purgeDocument(document);

        return res.status(200).json({
            status: 200,
            msg: "Document deleted successfully",
            data: null,
        });
    } catch (error) {
        logError(functionName, error, { documentId: req.params.documentId });

        return res.status(500).json({
            status: 500,
            msg: `Error deleting document: ${error.message}`,
            data: null,
        });
    }
};
