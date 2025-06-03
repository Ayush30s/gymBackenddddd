const { Schema } = require("mongoose");
const mongoose = require("mongoose");
const { createHmac, randomBytes } = require("crypto");

// Define the user schema
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female"],
    },
    contactNumber: {
      type: Number,
      required: true,
    },
    profileImage: {
      type: String,
      default: "/images/profile.jpg",
    },
    joinedGym: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "gymModel",
      },
    ],
    phy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhyModel", // Ensure this matches the name used to register the model
    },
    userType: {
      type: String,
      default: "userModel",
      enum: ["gymModel", "userModel"],
    },
    state: {
      type: String,
    },
    city: {
      type: String,
    },
    street: {
      type: String,
    },
    bio: {
      type: String,
      default: "Bio...",
    },
    likedblogs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "blogModel",
      },
    ],
    savedblogs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "blogModel",
      },
    ],
    commntedBlogs: [
      {
        comment: String,
        commentAt: { type: Date, default: Date.now },
        blog: { type: Schema.Types.ObjectId, ref: "blogModel" },
      },
    ],
    salt: {
      type: String,
    },
    notifications: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RequestModel",
    },
  },
  { timestamps: true }
);

// Hashing the password for security purposes
userSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  const salt = randomBytes(16).toString("hex"); // Ensure to convert to hex
  const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

  this.salt = salt;
  this.password = hashPassword;

  next();
});

// Register the userModel
const userModel = mongoose.model("userModel", userSchema);

module.exports = userModel;
