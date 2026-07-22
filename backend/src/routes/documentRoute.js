const documentController = require("../app/controllers/documentController");
const documentValidate = require("../app/middleware/validation/documentValidate");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, "../../uploads"));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, uniqueSuffix + extension);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Unsupported file type. Only PDF, DOCX, XLSX, and TXT files are allowed."), false);
    }
};

const upload = multer({ storage, fileFilter });

module.exports = function (router, auth) {
    router.get("/documents", auth.verifyToken, documentController.getDocuments);
    router.get(
        "/documents/:documentId",
        auth.verifyToken,
        documentValidate.validateDocumentId,
        documentController.getDocumentById
    );
    router.get(
        "/documents/:documentId/messages",
        auth.verifyToken,
        documentValidate.validateDocumentId,
        documentController.getMessages
    );
    router.post(
        "/documents",
        auth.verifyToken,
        upload.single("file"),
        documentValidate.validateFileUpload,
        documentController.uploadDocument
    );
    router.post(
        "/documents/:documentId/process",
        auth.verifyToken,
        documentValidate.validateDocumentId,
        documentController.processDocument
    );
    router.post(
        "/documents/:documentId/ask",
        auth.verifyToken,
        documentValidate.validateQuestion,
        documentController.askQuestion
    );
    router.delete(
        "/documents/:documentId",
        auth.verifyToken,
        documentValidate.validateDocumentId,
        documentController.deleteDocument
    );
};
