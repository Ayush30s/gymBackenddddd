const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const { createHmac, randomBytes } = require("crypto");

const gymSchema = new mongoose.Schema(
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
    },
    contactNumber: {
      type: Number,
      required: true,
    },
    gymName: {
      type: String,
      required: true,
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
    rating: {
      type: Number,
      default: 0, // For average rating
    },
    ratedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "userModel" },
        rating: { type: Number, required: true, default: 0 },
        ratedAt: { type: Date, default: Date.now },
      },
    ],
    profileImage: {
      type: String,
      default: "/images/gym.jpg",
    },
    userType: {
      type: String,
      default: "gymModel",
      enum: ["userModel", "gymModel"],
    },
    joinedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "userModel" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    monthlyCharge: {
      type: Number,
    },
    description: {
      type: String,
      required: true,
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
    plans: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "planModel",
    },
  },
  { timestamps: true }
);

// Hashing the password for security purposes
gymSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  const salt = randomBytes(16).toString("hex"); // Corrected string format
  const hashPassword = createHmac("sha256", salt)
    .update(user.password)
    .digest("hex");

  this.salt = salt;
  this.password = hashPassword;

  next();
});

const gymModel = mongoose.model("gymModel", gymSchema);

module.exports = gymModel;
