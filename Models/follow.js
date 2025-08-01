const mongoose = require("mongoose");

const followSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userType", // Dynamically reference a model
    },
    userType: {
      type: String,
      enum: ["userModel", "gymModel"], // Add models that could be referenced
    },
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "followingType",
      },
    ],
    followingType: [
      {
        type: String,
        enum: ["userModel", "gymModel"], // Specify all possible models
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "followerType",
      },
    ],
    followerType: [
      {
        type: String,
        enum: ["userModel", "gymModel"],
      },
    ],
  },
  { timestamps: true }
);

const followModel = mongoose.model("followModel", followSchema);
module.exports = followModel;
