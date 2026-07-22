const setupController = require("../app/controllers/setupController");

module.exports = function (router, auth) {
    router.post("/system/initialize", setupController.initializeApp);
    router.get("/system/status", setupController.getStatus);
    router.get("/system/ollama/status", setupController.checkOllamaStatus);
    router.get("/system/postgresql/status", setupController.checkPostgreSQLStatus);
    router.post("/system/postgresql/setup", setupController.setupPostgreSQL);
    router.post("/system/postgresql/sync", setupController.syncPostgreSQL);
};
