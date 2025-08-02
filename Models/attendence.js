const mongoose = require("mongoose");

const attendenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "gymModel",
      required: true,
    },
    date: { type: String, required: true },
    checkInTime: { type: Date, default: Date.now },
    checkOutTime: { type: Date, default: Date.now },
    status: { type: String, default: "present" },
    sessionId: { type: String },
  },
  { timestamps: true }
);

attendenceSchema.index(
  { userId: 1, gymId: 1, sessionId: 1, date: 1 },
  { unique: true }
);

module.exports = mongoose.model("attendenceModel", attendenceSchema);
