const fs = require("fs");
const DocumentRepository = require("../models/documentRepository");
const ChatRepository = require("../models/chatRepository");

class RetentionService {
    /**
     * Hard-delete a document: embeddings, chat, file, and metadata row.
     */
    async purgeDocument(document) {
        if (!document) return { success: false, message: "No document" };

        const documentId = document.id || document._id;

        try {
            await DocumentRepository.deleteChunksForDocument(documentId);
            await ChatRepository.deleteByDocument(documentId);

            if (document.filePath && fs.existsSync(document.filePath)) {
                try {
                    fs.unlinkSync(document.filePath);
                } catch (fileErr) {
                    console.error(`Failed to delete file ${document.filePath}:`, fileErr.message);
                }
            }

            await DocumentRepository.hardDelete(documentId);

            return { success: true, documentId };
        } catch (error) {
            console.error(`Retention purge failed for ${documentId}:`, error.message);
            return { success: false, documentId, message: error.message };
        }
    }

    async purgeExpiredDocuments() {
        const expired = await DocumentRepository.findExpired();
        const results = [];

        for (const doc of expired) {
            results.push(await this.purgeDocument(doc));
        }

        if (results.length > 0) {
            console.log(`[Retention] Purged ${results.filter((r) => r.success).length}/${results.length} expired documents`);
        }

        return {
            scanned: expired.length,
            results,
        };
    }

    start(intervalMs = 60 * 60 * 1000) {
        this.purgeExpiredDocuments().catch((err) => {
            console.error("[Retention] Initial run failed:", err.message);
        });

        this._timer = setInterval(() => {
            this.purgeExpiredDocuments().catch((err) => {
                console.error("[Retention] Scheduled run failed:", err.message);
            });
        }, intervalMs);

        if (this._timer.unref) this._timer.unref();
        console.log("[Retention] Hourly 7-day purge job started");
    }
}

module.exports = new RetentionService();
