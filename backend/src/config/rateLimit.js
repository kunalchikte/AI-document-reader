const rateLimit = require("express-rate-limit");
module.exports = function (app) {
	let limit = "false";//process.env.RATE_LIMIT || "true";
	if(limit=="true"){
		let limitInMinute = process.env.RATE_LIMIT_IN_MINUTE || 15;
		let limitMax = process.env.RATE_LIMIT_MAX || 100;
		const limiter = rateLimit({
		  windowMs: 1000 * 60 * limitInMinute, // Windows for 15 min
		  max: limitMax,
		  handler: (req, res, next, options) =>{
		  		let status = options.statusCode;
				res.status(status).send({status:status,msg:options.message,data:null});
		  }
		});
		// const limiter = rateLimit({
		//     windowMs: 15 * 60 * 1000, // 15 minutes
		//     max: 100, // limit each IP to 100 requests per windowMs
		//     message: 'Too many requests from this IP, please try again later.',
		//     standardHeaders: true,
		//     legacyHeaders: false
		// });
		app.use(limiter);
	}
};