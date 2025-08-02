const mongoose = require("mongoose");

// Define the physical attributes schema
const PhySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
    },
    fitnessGoal: {
      type: String,
      required: true,
    },
    experienceLevel: {
      type: String,
      required: true,
    },
    availableEquipment: {
      type: String,
      required: true,
    },
    workoutFrequency: {
      type: String,
      required: true,
    },
    injuriesLimitations: {
      type: String,
      required: true,
    },
    workout: [
      {
        time: {
          type: Number,
          required: true,
        },
        pushedAt: {
          type: Date,
          default: Date.now,
        },
        focusPart: {
          type: String,
          required: true,
        },
        exerciseName: {
          type: String,
          required: true,
        },
        caloriesBurned: {
          type: String,
          required: true,
        },
        difficulty: {
          type: String,
          required: true,
        },
        sets: {
          type: Number,
          required: true,
        },
        reps: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

// Register the PhyModel
const PhyModel = mongoose.model("PhyModel", PhySchema);

module.exports = PhyModel;
