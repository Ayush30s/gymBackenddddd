const { Router } = require("express");
const userModel = require("../Models/user");
const gymModel = require("../Models/gym");
const { blogModel } = require("../Models/blog");

const workoutPlan = {
  user: {
    height: 145, // cm
    weight: 40, // kg
    fitnessGoal: "Muscle Gain",
    experienceLevel: "Beginner",
    availableEquipment: "Dumbbell",
    workoutFrequency: 3, // days per week
    injuriesLimitations: "Pain in left leg, can't lift heavy weights",
  },
  workoutDays: [
    {
      day: "Day 1",
      focus: "Upper Body (Chest, Shoulders, Triceps)",
      exercises: [
        {
          name: "Dumbbell Bench Press",
          sets: 3,
          reps: "10-12",
          focus: "Chest, Triceps",
        },
        {
          name: "Dumbbell Row",
          sets: 3,
          reps: "10-12",
          focus: "Back, Biceps",
        },
        {
          name: "Dumbbell Shoulder Press",
          sets: 3,
          reps: "10-12",
          focus: "Shoulders, Triceps",
        },
        {
          name: "Dumbbell Bicep Curls",
          sets: 3,
          reps: "12-15",
          focus: "Biceps",
        },
        {
          name: "Dumbbell Tricep Extensions",
          sets: 3,
          reps: "12-15",
          focus: "Triceps",
        },
      ],
    },
    {
      day: "Day 2",
      focus: "Lower Body (Leg-Friendly) and Core",
      exercises: [
        {
          name: "Seated Dumbbell Leg Extensions",
          sets: 3,
          reps: "12-15",
          focus: "Quadriceps",
        },
        {
          name: "Dumbbell Deadlifts",
          sets: 3,
          reps: "10-12",
          focus: "Hamstrings, Glutes",
        },
        {
          name: "Glute Bridges",
          sets: 3,
          reps: "15",
          focus: "Glutes, Lower Back",
        },
        {
          name: "Standing Calf Raises (Bodyweight)",
          sets: 3,
          reps: "15-20",
          focus: "Calves",
        },
        {
          name: "Dumbbell Russian Twists",
          sets: 3,
          reps: "15-20 (each side)",
          focus: "Core, Obliques",
        },
      ],
    },
    {
      day: "Day 3",
      focus: "Full Body",
      exercises: [
        {
          name: "Dumbbell Squats (Bodyweight or Light Dumbbells)",
          sets: 3,
          reps: "10-12",
          focus: "Quads, Glutes",
        },
        {
          name: "Dumbbell Chest Flyes",
          sets: 3,
          reps: "12-15",
          focus: "Chest",
        },
        {
          name: "Dumbbell Shoulder Lateral Raises",
          sets: 3,
          reps: "12-15",
          focus: "Shoulders",
        },
        {
          name: "Dumbbell Hammer Curls",
          sets: 3,
          reps: "12-15",
          focus: "Biceps",
        },
        {
          name: "Dumbbell Overhead Tricep Extensions",
          sets: 3,
          reps: "12-15",
          focus: "Triceps",
        },
      ],
    },
  ],
  additionalNotes: [
    "Warm-Up: 5-10 minutes of light cardio or dynamic stretching",
    "Cool-Down: 5-10 minutes of static stretching",
    "Rest Between Sets: 60-90 seconds",
    "Progress by gradually increasing the weight as strength improves, but prioritize form and safety.",
    "Avoid exercises that heavily strain the injured leg; focus on proper form and use lighter weights if necessary.",
  ],
};

const staticRoute = Router();

staticRoute.get("/", (req, res) => {
  return res.render("frontpage");
});

staticRoute.get("/register-user", (req, res) => {
  return res.render("register");
});

staticRoute.get("/register-user/form", (req, res) => {
  return res.render("registerUser");
});

staticRoute.get("/register-owner/form", (req, res) => {
  return res.render("registerOwner");
});

staticRoute.get("/signin-form", (req, res) => {
  return res.render("signin");
});

staticRoute.get("/home", (req, res) => {
  return res.render("landing");
});

staticRoute.get("/editprofile", async (req, res) => {
  const { _id } = req.user;
  let data = await userModel.findById(_id);

  if (!data) {
    data = await gymModel.findById(_id);
  }

  return res.render("editform", {
    user: req.user,
    userData: data,
  });
});

staticRoute.get("/edit-gym/:gymId", (req, res) => {
  const { gymId } = req.params;
  return res.render("gymShiftEditForm", {
    gymId: gymId,
  });
});

staticRoute.get("/edit-shift/:gymId/:shiftId", (req, res) => {
  const { gymId, shiftId } = req.params;
  return res.render("gymupdateForm", {
    gymId: gymId,
    shiftId: shiftId,
  });
});

staticRoute.get("/addmoredetails", async (req, res) => {
  const userData = await userModel.findById(req.user._id).populate("phy");

  return res.render("userphy", {
    userData,
  });
});

staticRoute.get(
  "/transform",
  (req, res, next) => {
    if (req.user.userType == "OWNER") {
      return res.send("To use Transformatoion service use a userId");
    } else {
      next();
    }
  },
  async (req, res) => {
    return res.render("userphy", {
      user: req.user,
    });
  }
);

staticRoute.get(
  "/blogs",
  (req, res, next) => {
    console.log(req.user);
    if (req.user.userType == "OWNER") {
      return res.send("To use Blog service use a user type userId");
    } else {
      next();
    }
  },
  async (req, res) => {
    const allblogs = await blogModel.find({}).populate("createdBy");
    return res.render("home", {
      user: req.user,
      blogs: allblogs,
    });
  }
);

module.exports = staticRoute;
