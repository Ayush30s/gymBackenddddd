const mongoose = require("mongoose");

const ShiftSchmea = mongoose.Schema(
  {
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
    },
    sex: {
      type: String,
      default: "All",
      enum: ["Male", "Female", "All"],
    },
    limit: {
      type: Number,
      default: 10,
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
    status: {
      type: String,
      default: "Active",
      enum: ["Active", "Inactive"],
    },
    joinedBy: [{}],
  },
  { timestamps: true }
);

const ShiftModel = mongoose.model("ShiftModel", ShiftSchmea);

module.exports = ShiftModel;
