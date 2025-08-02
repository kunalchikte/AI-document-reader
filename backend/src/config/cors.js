const cors = require("cors");
module.exports = function (app) {
	// Define a list of allowed origins (URLs)
	const allowedOrigins = ["*"];

	// Define a list of allowed headers
	const allowedHeaders = ["*"];

	// Define a list of allowed HTTP methods
	const allowedMethods = ["*"];

	// CORS options
	const corsOptions = { // eslint-disable-line
		origin: function (origin, callback) {
			// Check if the request origin is allowed
			if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
		allowedHeaders: allowedHeaders,
		methods: allowedMethods.join(","),
	};
	// Enable CORS for all routes
	// app.use(cors(corsOptions));
	app.use(cors({ origin: true }));
};