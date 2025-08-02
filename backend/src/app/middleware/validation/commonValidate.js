const val = require("./validator");

let conditions = {
	type:{
		...val.groupExistTrimNotEmpty("Type"),
		isIn:{
			options: [["files","images","videos"]],
			errorMessage: "Type must be files or images or videos",
		}
	},
	extn:{
		...val.groupExistTrimNotEmpty("Extn"),
		custom: {
			options: async (value, { req, location, path }) => { // eslint-disable-line
				const allowedVideoTypes = ["mp4"];
				const allowedTypes = ["png","jpeg","jpg"];
				const allowedFiles = ["pdf"];
				if(req.query.type == "videos"){
					if(!allowedVideoTypes.includes(value))
						throw new Error("Allowed extn for videos is "+JSON.stringify(allowedVideoTypes));
				}
				else if(req.query.type == "files"){
					if(!allowedFiles.includes(value))
						throw new Error("Allowed extn for files is "+JSON.stringify(allowedFiles));
				}
				else{
					if(!allowedTypes.includes(value))
						throw new Error("Allowed extn for images are "+JSON.stringify(allowedTypes));
				}
			}
		}
	},
	email:{
		...val.groupExistTrimNotEmpty("Email"),
		...val.commonMail()
	},
};

/**
* This Function that Verify the valid data for upload files.
*/
exports.valFileUpload = (req, res, next) => {

	const schema = {
		type: conditions.type,
		extn: conditions.extn,
		model: val.groupExistTrimNotEmpty("Model")
	};

	val.validateSchema(req, res, next,schema);
};
