const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xlsx = require("xlsx");
const Document = require("../models/documentModel");

// Helper function for logging
const logOperation = (operation, info = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${operation}`, info);
};

// Helper function for error logging
const logError = (functionName, error, additionalInfo = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR in FileService.${functionName}:`, error.message);
    if (error.stack) {
        console.error(`[${timestamp}] STACK:`, error.stack);
    }
    if (Object.keys(additionalInfo).length > 0) {
        console.error(`[${timestamp}] ADDITIONAL INFO:`, additionalInfo);
    }
};

class FileService {
    /**
     * Create a new document record in MongoDB
     * @param {Object} fileInfo - File information
     * @returns {Promise<Object>} Created document record
     */
    async createDocument(fileInfo) {
        const functionName = 'createDocument';
        logOperation(`${functionName} started`, { 
            filename: fileInfo.filename,
            originalName: fileInfo.originalName,
            fileType: fileInfo.fileType,
            size: fileInfo.size
        });
        
        try {
            // Create document with retry logic
            let document = null;
            let retries = 3;
            let lastError = null;
            
            while (retries > 0 && !document) {
                try {
                    document = new Document({
                        filename: fileInfo.filename,
                        fileType: fileInfo.fileType,
                        originalName: fileInfo.originalName,
                        filePath: fileInfo.filePath,
                        uploadedBy: fileInfo.userId || null,
                        metadata: {
                            size: fileInfo.size,
                        }
                    });
                    
                    await document.save();
                    logOperation(`${functionName} document saved successfully`, { documentId: document._id });
                    return document;
                } catch (err) {
                    lastError = err;
                    retries--;
                    if (retries > 0) {
                        logOperation(`${functionName} retry attempt remaining: ${retries}`);
                        // Wait a bit before retry
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            // If we get here, all retries failed
            throw lastError || new Error("Failed to save document after multiple attempts");
        } catch (error) {
            logError(functionName, error, { 
                filename: fileInfo.filename,
                originalName: fileInfo.originalName
            });
            throw new Error(`Error creating document record: ${error.message}`);
        }
    }

    /**
     * Extract text content from a file based on file type
     * @param {string} filePath - Path to the file
     * @param {string} fileType - Type of the file (pdf, docx, xlsx, txt)
     * @returns {Promise<string>} Extracted text content
     */
    async extractTextFromFile(filePath, fileType) {
        const functionName = 'extractTextFromFile';
        logOperation(`${functionName} started`, { filePath, fileType });
        
        try {
            let result;
            switch (fileType.toLowerCase()) {
                case "pdf":
                    result = await this.extractTextFromPdf(filePath);
                    break;
                case "docx":
                    result = await this.extractTextFromDocx(filePath);
                    break;
                case "xlsx":
                    result = await this.extractTextFromExcel(filePath);
                    break;
                case "txt":
                    result = await this.extractTextFromTxt(filePath);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileType}`);
            }
            
            logOperation(`${functionName} completed`, { 
                fileType, 
                textLength: result.length,
                excerpt: result.substring(0, 50) + '...'
            });
            return result;
        } catch (error) {
            logError(functionName, error, { filePath, fileType });
            throw new Error(`Error extracting text from file: ${error.message}`);
        }
    }

    /**
     * Extract text from a PDF file
     * @param {string} filePath - Path to the PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromPdf(filePath) {
        const functionName = 'extractTextFromPdf';
        logOperation(`${functionName} started`, { filePath });
        
        try {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (error) {
            logError(functionName, error, { filePath });
            throw new Error(`Error parsing PDF file: ${error.message}`);
        }
    }

    /**
     * Extract text from a DOCX file
     * @param {string} filePath - Path to the DOCX file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromDocx(filePath) {
        const functionName = 'extractTextFromDocx';
        logOperation(`${functionName} started`, { filePath });
        
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            logError(functionName, error, { filePath });
            throw new Error(`Error parsing DOCX file: ${error.message}`);
        }
    }

    /**
     * Extract text from an Excel file
     * @param {string} filePath - Path to the Excel file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromExcel(filePath) {
        const functionName = 'extractTextFromExcel';
        logOperation(`${functionName} started`, { filePath });
        
        try {
            const workbook = xlsx.readFile(filePath);
            let result = "";
            
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const json = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                
                // Add sheet name as heading
                result += `# Sheet: ${sheetName}\n\n`;
                
                // Convert all rows to text
                json.forEach(row => {
                    if (row.length > 0) {
                        result += row.join(" | ") + "\n";
                    }
                });
                
                result += "\n\n";
            });
            
            return result;
        } catch (error) {
            logError(functionName, error, { filePath });
            throw new Error(`Error parsing Excel file: ${error.message}`);
        }
    }

    /**
     * Extract text from a TXT file
     * @param {string} filePath - Path to the TXT file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromTxt(filePath) {
        const functionName = 'extractTextFromTxt';
        logOperation(`${functionName} started`, { filePath });
        
        try {
            const data = await fs.readFile(filePath, "utf8");
            return data;
        } catch (error) {
            logError(functionName, error, { filePath });
            throw new Error(`Error parsing TXT file: ${error.message}`);
        }
    }

    /**
     * Get file type from file extension
     * @param {string} fileName - Name of the file
     * @returns {string} File type
     */
    getFileTypeFromExtension(fileName) {
        const extension = path.extname(fileName).toLowerCase();
        
        switch (extension) {
            case ".pdf":
                return "pdf";
            case ".docx":
            case ".doc":
                return "docx";
            case ".xlsx":
            case ".xls":
                return "xlsx";
            case ".txt":
                return "txt";
            default:
                throw new Error(`Unsupported file extension: ${extension}`);
        }
    }

    /**
     * Clean up temporary files
     * @param {string} filePath - Path to the file to delete
     * @returns {Promise<void>}
     */
    async cleanupTempFile(filePath) {
        const functionName = 'cleanupTempFile';
        logOperation(`${functionName} started`, { filePath });
        
        try {
            await fs.unlink(filePath);
            logOperation(`${functionName} completed`, { filePath });
        } catch (error) {
            logError(functionName, error, { filePath });
            console.error(`Error deleting temporary file ${filePath}:`, error);
        }
    }
}

module.exports = new FileService(); 