const setupController = require("../app/controllers/setupController");

module.exports = function (router, auth) {
    // System initialization and status
    router.post("/system/initialize", setupController.initializeApp);
    router.get("/system/status", setupController.getStatus);
    
    // Ollama status and installation
    router.get("/system/ollama/status", setupController.checkOllamaStatus);
    
    // PostgreSQL setup routes
    router.get("/system/postgresql/status", setupController.checkPostgreSQLStatus);
    router.post("/system/postgresql/setup", setupController.setupPostgreSQL);
    router.post("/system/postgresql/sync", setupController.syncPostgreSQL);
    router.get("/system/postgresql/debug", setupController.debugPostgreSQL);
    router.get("/system/postgresql/test-lookup/:documentId", setupController.testDocumentLookup);
}; 