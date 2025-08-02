const MongoObjectID = require("mongoose").Types.ObjectId;

/**
* Function that get Model
* @return This model function that get Model list.
*/

exports.getModel = async (params={}) => {
	try{
		const {model=null,oneResult=false,cond={},proj={},skip=0,limit=10,sort={_id:-1},joins=[]} = params;
		
		if(Object.prototype.hasOwnProperty.call(cond,"_id")){
			if(Object.prototype.hasOwnProperty.call(cond._id,"$ne")){
				cond._id.$ne = new MongoObjectID(cond._id.$ne);
			}
			else{
				cond._id = new MongoObjectID(cond._id);
			}
		}
		
		let result = (oneResult) ? model.findOne(cond) : model.find(cond);
		let count = await model.countDocuments(cond);


		result = result.select(proj).sort(sort).skip(skip).limit(limit).populate({ path: "createdBy", select: "id fName lName", strictPopulate: false })
			.populate({ path: "updatedBy", select: "id fName lName", strictPopulate: false });

		for (const join of joins) {
			result = result.populate(join[0], join[1]);
		}

		result = await result;

		if(result && (oneResult || result.length > 0))
			return {status:200,msg:"Data Found",data:result,total: count };
		else
			return {status:200,msg:"Data Not Found",data:null,total: count };
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

/**
* Function that Get Model.
* @return This model function that get Model with the condition count.
*/

exports.getCountModel = async (params={}) => {
	try{
		const {model,cond={}} = params;
		if(Object.prototype.hasOwnProperty.call(cond,"_id")){
			if(Object.prototype.hasOwnProperty.call(cond._id,"$ne")){
				cond._id.$ne = new MongoObjectID(cond._id.$ne);
			}
			else if(Object.prototype.hasOwnProperty.call(cond._id,"$in")){
				for(let x in cond._id.$in){
					cond._id.$in[x] = new MongoObjectID(cond._id.$in[x]);
				}
			}
			else
				cond._id = new MongoObjectID(cond._id);
		}
		let result = await model.countDocuments(cond);
		if(result!=null && result > 0)
			return {status:200,msg:"Data Found",data:result};
		else
			return {status:200,msg:"Data Not Found",data:null};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

/**
* Function that Add Model.
* @return This model function that Add Model.
*/

exports.addModel = async (params={}) => {
	try{
		const {model,title="",data} = params;
		const result = await model.create(data);
		return {status:201,msg: title+" Added Successfully",data:result};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

exports.delModel = async (params={}) => {
	try{
		const {model,title="",srcId,userId} = params;
		let id = new MongoObjectID(srcId);
		const data = {
			deleted: {
				status: true,
				at:	(new Date()).getTime(),
				by: userId
			}
		};
		await model.updateOne({"_id":id},data);
		return {status:200,msg: title+" Removed Successfully",data:null};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

exports.delMultipleModel = async (params={}) => {
	try{
		const {model,title="",data,userId} = params;
		const deleteList = data.map(deleteId => new MongoObjectID(deleteId));

		const updateData = {
			deleted: {
				status: true,
				at: (new Date()).getTime(),
				by: userId
			}
		};

		await model.updateMany(
			{ _id: { $in: deleteList } }, 
			{ $set: updateData }
		);
		return {status:200,msg: title+" Removed Successfully",data:null};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

exports.delMultipleModelByChapter = async (params={}) => {
	try{
		const {model,title="",chapterId,userId} = params;
		let id = new MongoObjectID(chapterId);
		const data = {
			deleted: {
				status: true,
				at:	(new Date()).getTime(),
				by: userId
			}
		};

		await model.updateMany({ chapter: id },{ $set: data }
		);
		return {status:200,msg: title+" Removed Successfully",data:null};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};

/**
* Function that update Model.
* @return This model function that update Model by ID.
*/

exports.updateModel = async (params={}) => {
	try{
		let {model,title="",cond={},data={}} = params;
		if(Object.prototype.hasOwnProperty.call(cond,"_id")){
			cond._id = new MongoObjectID(cond._id);
		}
		else if(Object.prototype.hasOwnProperty.call(data,"id")){
			cond = {_id:new MongoObjectID(data.id)};
		}
		delete data.id;
		await model.updateOne(cond,data);
		return {status:200,msg:title+" Updated Successfully",data:null};
	}
	catch (err) {
		return {status:400,msg:"Error",data:err.toString()};
	}
};
