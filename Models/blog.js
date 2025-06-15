const { Schema, model } = require("mongoose");

const blogSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "userModel" },
    coverImage: { type: String },
    likedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "userModel" },
        likedAt: { type: Date, default: Date.now },
      },
    ],
    savedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "userModel" },
        savedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        user: {
          type: Schema.Types.ObjectId,
          required: true,
          refPath: "comments.userType",
        },
        userType: {
          type: String,
          required: true,
          enum: ["userModel", "gymModel"],
        },
        content: { type: String, required: true },
        commentAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const blogModel = model("blogModel", blogSchema);

module.exports = {
  blogModel,
};
