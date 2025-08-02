const passwordMessage = "The password must contain 8 to 16 characters with atleast 1 uppercase, 1 lowercase, 1 number and 1 special character";
const exampleValidation = require("express-validator");
// const userService = require("../../services/userService");

/**
 * Process validation results from express-validator middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.validateRequest = (req, res, next) => {
	const errors = exampleValidation.validationResult(req);
	if (!errors.isEmpty()) {
		const errorMessages = errors.array().map(error => error.msg).join(", ");
		return res.status(400).json({
			status: 400,
			msg: errorMessages,
			data: null
		});
	}
	next();
};

exports.validateSchema = async (req, res, next, schema,nextApply=true) => {
	await exampleValidation.checkSchema(schema).run(req);

	const errorFormatter = ({ location, msg, param, value, nestedErrors }) => { // eslint-disable-line
		return `${msg}`;
	};
	
	const errors = await exampleValidation.validationResult(req).formatWith(errorFormatter);
	if (errors.isEmpty()) {
		if(nextApply)
			next();
		else
			return true;
	}
	else {
		var msg = errors.array({ onlyFirstError: true }).join(", ");
		if(msg.includes("Invalid password")){
			msg = passwordMessage;
		}
		res.status(400).json({status:400,msg:msg,data:null});
	}
};

exports.groupExistTrimNotEmpty = (field) => {
	return {
		exists: {
			errorMessage: `${field} must required`
		},
		trim: true,
		notEmpty: {
			errorMessage: `${field} should not be empty`,
		}
	};
};

exports.groupExistTrim = (field) => {
	return {
		exists: {
			errorMessage: `${field} must required`
		},
		trim: true
	};
};

exports.groupExistNotEmpty = (field) => {
	return {
		exists: {
			errorMessage: `${field} must required`
		},
		notEmpty: {
			errorMessage: `${field} should not be empty`,
		}
	};
};

exports.commonNumber= (field="number") => {
	return {
		isMobilePhone:{
			errorMessage: "Invalid "+field,
		},
		custom: {
			options: async (value, { req, location, path }) => { // eslint-disable-line
				if(/^0*$/.test(value)){
					throw new Error("Invalid "+field);
				}
			}
		}
	};
};

exports.commonMail= (field="email") => {
	return {
		isEmail:{
			errorMessage: "Please enter valid "+field
		},
		normalizeEmail:true,
	};
};

exports.optional= () => {
	return {
		optional: { options: { nullable: true,checkFalsy: true } },
		trim:true,
	};
};

exports.valDate= (label="Date") => {
	return {
		...exports.groupExistTrimNotEmpty(label),
		isDate:{
			options: {"format":"YYYY-MM-DD","delimiters":["-"]},
			errorMessage: "Date Format must be YYYY-MM-DD",
		}
	};
};

exports.valTime= (label="Time") => {
	return {
		...exports.groupExistTrimNotEmpty(label),
		isTime:{
			options: {"hourFormat":"hour24","mode":"default"},
			errorMessage: label+" Format must be 24hrs HH:MM",
		}
	};
};

exports.arrayOfIds = (field) => {
	return {
		exists: {
			errorMessage: `${field} field must required`,
		},
		isArray: {
			errorMessage: `${field} must be an array`,
		},
		custom: {
			options: (value) => {
				if (!Array.isArray(value) || value.length === 0) {
					throw new Error(`${field} array must contain at least one value`);
				}
				for (const item of value) {
					if (item === "") {
						throw new Error(
							`${field} array must not contain empty strings values`
						);
					}
				}
				return true;
			},
		},
	};
};

exports.commonStringValidation = (field) => {
	return {
		optional: true,
		trim: true,
		notEmpty: {
			errorMessage: `${field} should not be empty`,
		},
		custom: {
			options: (value) => value !== null,
			errorMessage: `${field} should not be null`,
		},
	};
};