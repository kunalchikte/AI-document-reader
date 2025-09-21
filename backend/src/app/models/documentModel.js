const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
	{
		filename: {
			type: String,
			required: true,
		},
		fileType: {
			type: String,
			required: true,
			enum: ["pdf", "docx", "xlsx", "txt"],
		},
		originalName: {
			type: String,
			required: true,
		},
		filePath: {
			type: String,
			required: true,
		},
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		metadata: {
			size: Number,
			pageCount: Number,
			createdAt: Date,
			modifiedAt: Date
		},
		vectorized: {
			type: Boolean,
			default: false,
		},
		supabaseCollectionName: {
			type: String,
			// Note: This field name is kept for backward compatibility
			// It now refers to the PostgreSQL table name instead of Supabase collection
		},
		isDeleted: {
			type: Boolean,
			default: false,
		}
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model("Document", documentSchema); 