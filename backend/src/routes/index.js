const fs = require("fs");
const path = require("path");
const directoryPath = path.join(__dirname, "./"); // replace 'your-directory' with your folder name
const auth = require("../app/middleware/auth/auth");
module.exports = function (app, router) {
	fs.readdirSync(directoryPath).forEach(file => {
		// const filePath = path.join(directoryPath, file);
		if (file !== "index.js" && file.endsWith(".js")) {
			require("./"+file)(router, auth);
		}
	});
	// require("./userRoute")(router,auth);
	app.use("", router);
	app.use("/*",(req,res) => {
		res.status(404).json({status:404,msg:"Not Found",data:null});
	});
};
