const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    joinedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "userModel",
      },
    ],
    price: {
      type: Number,
      required: true,
    },
    timePeriod: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);
