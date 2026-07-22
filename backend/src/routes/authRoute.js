const authController = require("../app/controllers/authController");

module.exports = function (router, auth) {
    router.post("/auth/register", authController.register);
    router.post("/auth/login", authController.login);
    router.get("/auth/me", auth.verifyToken, authController.me);
    router.post("/auth/logout", auth.verifyToken, authController.logout);
};
