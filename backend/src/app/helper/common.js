exports.checkType = (data) => {  
	return data.constructor.name;
};

exports.isJsonString = (str) => {
	try {
		JSON.parse(str);
	} catch (e) { // eslint-disable-line
		return false;
	}
	return true;
};

exports.getDateArray = (formatedDate="") =>{
	try {
		let dateOb = new Date(); // current date
		if(formatedDate!="")
			dateOb = new Date(formatedDate); // current date

		let date = ("0" + dateOb.getDate()).slice(-2); // adjust 0 before single digit date
		let month = ("0" + (dateOb.getMonth() + 1)).slice(-2); // current month
		let year = dateOb.getFullYear(); // current year
		let hours = dateOb.getHours(); // current hours
		let minutes = dateOb.getMinutes(); // current minutes
		let seconds = dateOb.getSeconds(); // current seconds
		return {status:true,msg:"success",data:[date,month,year,hours,minutes,seconds]};
	}
	catch(err){
		return {status:false,msg:"Error",data:err.toString()};
	}
};

exports.getPagignationLimit = (reqQuery={}) =>{ //set pagignation limit default value
	let limit=10;
	try{
		if(Object.prototype.hasOwnProperty.call(reqQuery,"limit") && reqQuery.limit > 0){
			limit = reqQuery.limit;
		}
	}
	catch(e){} // eslint-disable-line

	return parseInt(limit);
};

exports.getPagignationSkip = (reqQuery={}) =>{ //set pagignation skip values by page number
	let skip=0;
	try {
		let limit= exports.getPagignationLimit(reqQuery);
		if(Object.prototype.hasOwnProperty.call(reqQuery,"pageNo") && reqQuery.pageNo > 0){
			let pageNo = parseInt(reqQuery.pageNo) - 1;
			skip = pageNo*limit;
		}
	}
	catch(e){} // eslint-disable-line

	return skip;
};

exports.getSearchCond = async (cond,query,keys) => {
	if(Object.prototype.hasOwnProperty.call(query,"searchVal") && query.searchVal!=""){
		let searchVal = query.searchVal.trim();
		const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchVal);
		if (!isEmail) {
			let searchValCheck = searchVal.replace(/\s/g, "");
			if ((searchValCheck.split(".").length - 1) == searchValCheck.length) {
				searchVal = "~!@#$%^&*()_+";
			}
		}
		if(!cond.$or)
			cond.$or = 	[];
		for(let x of keys){
			cond.$or.push({[x]:{"$regex": searchVal,"$options":"i"}});
		}
	}
	
	let fromDate = query.fromDate?.trim() || "";
	let toDate = query.toDate?.trim() || "";
	if(fromDate!="" && toDate!=""){
		fromDate = new Date(`${fromDate}T00:00:00Z`);
		toDate = new Date(`${toDate}T23:59:59.999Z`);
		cond.createdAt= {
			$gte: fromDate,
			$lte: toDate
		};
	}
	return cond;
};

exports.filterData = (data) => {
	return Object.fromEntries(
	  	Object.entries(data).filter(([key, value]) => value !== null && value !== undefined && value !== "") // eslint-disable-line
	);	
};

exports.generateRandomNumber = (length, isAlphanumeric = false) => {
	if (isAlphanumeric) {
		const chars =
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
		let result = "";
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}
	const min = Math.pow(10, length - 1);
	const max = Math.pow(10, length) - 1;
	return Math.floor(Math.random() * (max - min + 1)) + min;
};