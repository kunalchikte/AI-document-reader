const setupController = require("../app/controllers/setupController");

module.exports = function (router, auth) {
    // System initialization and status
    router.post("/system/initialize", setupController.initializeApp);
    router.get("/system/status", setupController.getStatus);
    
    // Ollama status and installation
    router.get("/system/ollama/status", setupController.checkOllamaStatus);
    
    // Supabase setup routes
    router.get("/system/supabase/status", setupController.checkSupabaseStatus);
    router.post("/system/supabase/setup", setupController.setupSupabase);
}; 