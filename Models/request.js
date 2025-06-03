const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    reqby: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "reqbyType",
    },
    reqbyType: {
      type: String,
      required: true,
      enum: ["userModel", "gymModel"],
    },
    reqto: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "reqtoType",
    },
    reqtoType: {
      type: String,
      required: true,
      enum: ["userModel", "gymModel"],
    },
    requestType: {
      type: String,
      enum: ["join", "leave", "follow"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    reqAction: {
      type: String,
      enum: ["all", "sent", "received"],
      default: "sent",
    },
    metadata: {
      type: Object,
      default: {},
    },
    respondedAt: {
      type: Date,
    },
    reqbyRemove: {
      type: Boolean,
      default: false,
    },
    reqtoRemove: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

requestSchema.index(
  { reqto: 1, reqby: 1, requestType: 1, status: 1 },
  { unique: true }
);

module.exports = mongoose.model("Request", requestSchema);
