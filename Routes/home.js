const { Router } = require("express");
const JWT = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const mongoose = require("mongoose");
const gymModel = require("../Models/gym");
const userModel = require("../Models/user");
const ShiftModel = require("../Models/shift");
const followModel = require("../Models/follow");
const gymnameModel = require("../Models/gymName");
const RequestModel = require("../Models/request");
const uploadToCloudinary = require("../utils/cloudinaryUpload");
const PhyModel = require("../Models/userphy");
const attendenceModel = require("../Models/attendence");
// const { Configuration, OpenAIApi } = require("openai");

const homeRoute = Router();

// const configuration = new Configuration({
//   apiKey: process.env.OPENAI_API_KEY, // Store your API key in environment variables
// });

// const openai = new OpenAIApi(configuration);

const getCurrentDateString = () => {
  return new Date().toISOString().split("T")[0]; // e.g., "2025-04-29"
};

function getDaysInMonth(year, month) {
  // Month is 0-based: January is 0, February is 1, etc.
  const date = new Date(year, month + 1, 0);
  return date.getDate();
}

homeRoute.get("/", async (req, res) => {
  const { city, state, rating, maxPrice } = req.query;

  const userId = req?.user?._id;
  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED ACCESS" });
  }

  try {
    const filters = {};

    if (city) {
      filters.city = { $regex: new RegExp(city, "i") };
    }
    if (state) {
      filters.state = { $regex: new RegExp(state, "i") };
    }
    if (rating) {
      filters.rating = { $gte: Number(rating) };
    }
    if (maxPrice) {
      filters.monthlyCharge = { $lte: Number(maxPrice) };
    }

    const allGyms = await gymModel.find(
      filters,
      "fullName email contactNumber gymName street city state rating profileImage monthlyCharge createdAt joinedBy"
    );

    //if you are owner then show all gyms except yours
    let gymNotJoined = [];
    const currentuser = await gymModel.findById(userId);

    if (currentuser) {
      return res.status(200).json({
        message: "WELCOME TO ONLY GYM APP YOU CAN NAVIGATE TO YOU DASHBOARD",
      });
    } else {
      //if you are user show all the gyms you have not joined
      allGyms?.forEach((gym) => {
        let hasJoined = false;
        gym.joinedBy.forEach((gym) => {
          if (gym?.joinedBy?.length !== 0) {
            if (gym.user._id.toString() == userId?.toString()) {
              hasJoined = true;
            }
          }
        });

        if (!hasJoined) {
          gymNotJoined.push({
            gymId: gym._id,
            ownerName: gym.fullName,
            city: gym.city,
            state: gym.state,
            street: gym.street,
            email: gym.email,
            gender: gym.gender,
            gymName: gym.gymName,
            rating: gym.rating,
            contactNumber: gym.contactNumber,
            profileImage: gym.profileImage,
            monthlyCharge: gym.monthlyCharge,
          });
        }
      });
    }

    return res.status(200).json({
      message: "FETCH_ALL_GYM_DATA_SUCCESSFUL",
      gymNotJoined: gymNotJoined,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "FETCH_ALL_GYM_DATA_FAILED", error: error });
  }
});

homeRoute.get("/joinedgyms", async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(401).json({ error: "UNAUTHORIZED ACCESS" });
    }

    let joinedGym = await userModel.findById(userId).populate("joinedGym");
    if (joinedGym?.joinedGym?.length === 0) {
      return res.status(200).json({ message: "NO_JOINED_GYM" });
    }

    let JoinedGymArray = [];
    joinedGym.joinedGym.some((gym) => {
      JoinedGymArray.push({
        gymId: gym?._id,
        gymName: gym?.gymName,
        ownerName: gym?.fullName,
        profileImage: gym?.profileImage,
        rating: gym?.rating,
        mmonthlyCharge: gym?.monthlyCharge,
      });
    });

    return res.status(200).json({
      message: "JOINED_GYM_DATA_FETCH_SUCESSFUL",
      joinedGym: JoinedGymArray,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "JOINED_GYM_DATA_FETCH_FAIL", error: error });
  }
});

homeRoute.post("/add-exercise", async (req, res) => {
  try {
    const {
      height,
      weight,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      workoutFrequency,
      injuriesLimitations,
    } = req.body;

    // Create a new document in the PhyModel collection
    const details = await PhyModel.create({
      height,
      weight,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      workoutFrequency,
      injuriesLimitations,
    });

    const data = await userModel
      .findByIdAndUpdate(req.user._id, { phy: details._id }, { new: true })
      .populate("phy");

    return res.status(200).json({ message: "Exercie added successfully" });
  } catch (error) {
    console.error("Error adding more details:", error);
    return res.status(500).send("Server error hai");
  }
});

homeRoute.get("/gym/dashboard/", async (req, res) => {
  try {
    // Fetch the gym data associated with the user
    const Mygymdata = await gymModel.findById(req?.user?._id).populate({
      path: "joinedBy.user",
      select: "fullName profileImage userType",
    });

    // console.log("Mygymdata",Mygymdata)

    if (!Mygymdata) {
      return res.status(404).json({ message: "GYM_NOT_FOUND" });
    }

    if (Mygymdata.userType !== "gymModel") {
      console.log("Mygymdata", Mygymdata);
      return res.status(401).json({
        message: "YOU OWN A OWNERTYPE ACCOUNT CANT ACCESS A USER DASHBOARD",
      });
    }

    let followersList = [];
    let followingList = [];
    let followersCount = 0;
    let followingCount = 0;

    //isko sahi krna hai
    const followData = await followModel
      .findById(req.user._id)
      .populate("followers", "fullName profileImage userType")
      .populate("following", "fullName profileImage userType");

    let userFollowLoggedInUser = false;
    if (!followData) {
      followersCount = 0;
      followingCount = 0;
    } else {
      followersList = followData.followers;
      followingList = followData.following;
      followersCount = followData.followers?.length;
      followingCount = followData.following?.length;
      if (followData?.following?.includes(req.user._id)) {
        userFollowLoggedInUser = true;
      }
    }

    // Create a Map to store user ID to shift index mapping
    const allShifts = await ShiftModel.find({ gym: req.user._id });
    const userToshiftMap = new Array(allShifts.length);
    allShifts.shifts?.forEach((shift, shiftIndex) => {
      shift.joinedBy?.forEach((user) => {
        userToshiftMap[shiftIndex] = user;
      });
    });

    let activeMonths = new Array(12).fill(null).map(() => ({ joinedBy: [] }));
    Mygymdata?.joinedBy?.forEach((user) => {
      try {
        const joinedDate = new Date(user.joinedAt); // Handle MongoDB date format
        const monthIndex = joinedDate.getMonth(); // 1-12
        activeMonths[monthIndex]?.joinedBy?.push({
          fullName: user.user.fullName,
          profileImage: user.user.profileImage,
          userId: user.user._id,
          joinedAt: user.user.joinedAt,
        });
      } catch (error) {}
    });

    return res.status(200).json({
      data: Mygymdata,
      userToshiftMap: userToshiftMap,
      followersList: followersList,
      followingList: followingList,
      followersCount: followersCount,
      followingCount: followingCount,
      activeMonths: activeMonths,
      allShifts: allShifts,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
});

homeRoute.get("/gym/:gymId", async (req, res) => {
  const userId = req?.user?._id;
  const { gymId } = req?.params;

  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED ACCESS" });
  }

  // If the owner tries to access their own gym, redirect to /home/mygyms
  if (userId == gymId) {
    return res.status(307).json({ message: "REDIRECT_TO_GYM_DASHBOARD" });
  }

  try {
    const gymData = await gymModel.findById(gymId).populate({
      path: "joinedBy.user",
    });

    if (!gymData) {
      return res.status(404).json({ message: "GYM_NOT_FOUND" });
    }

    let followersCount = 0;
    let followingCount = 0;
    let followingGymOrNot = "Follow";
    const followData = await followModel
      .findById(gymId)
      .populate("followers", "fullName userType")
      .populate("following", "fullName userType");

    if (!followData) {
      followersCount = 0;
      followingCount = 0;
    } else {
      followersCount = followData.followers.length;
      followingCount = followData.following.length;

      if (followData.followers.length > 0) {
        followData.followers.forEach((user) => {
          if (user._id == req.user?._id) {
            followingGymOrNot = "Following";
          }
        });
      } else if (followData.followRequests.length > 0) {
        followData.followRequests.forEach((user) => {
          if (user._id == req.user?._id) {
            followingGymOrNot = "Requested";
          }
        });
      }
    }

    let GymFollowUser = false;
    if (followData?.following?.map((user) => user._id == req.user?._id)) {
      GymFollowUser = true;
    }

    let showFollowButton = true;
    if (gymId === req?.user?._id) {
      showFollowButton = false;
    }

    let ratingdone = false;
    gymData.ratedBy.forEach((rate) => {
      if (rate.user.toString() == userId) {
        ratingdone = true;
      }
    });

    let showEditPage = false;
    if (req.user._id == gymId) {
      showEditPage = true;
    }

    // Check if the user is in the joinedBy list
    let isUserJoined = false;
    let userJoinedAt = -1;
    let joinedDate = -1;
    gymData.joinedBy.some((joined) => {
      if (`${joined?.user?._id?.toString()}` === `${userId}`) {
        isUserJoined = true;
        userJoinedAt = joined?.joinedAt;
        joinedDate = joined?.joinedAt?.getDate();
      }
    });

    let daysLeftToMonth = -1;
    let attendenceStatus = false;
    if (isUserJoined && joinedDate) {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
      const joinedDay = new Date(joinedDate).getDate();
      const daysInNextMonth = new Date(year, month + 2, 0).getDate();

      daysLeftToMonth =
        daysInCurrentMonth - joinedDay + Math.min(joinedDay, daysInNextMonth);

      const today = getCurrentDateString();
      attendenceData = await attendenceModel.findOne({
        userId: userId,
        gymId: gymId,
        date: today,
      });

      if (
        attendenceData &&
        attendenceData.checkInTime &&
        attendenceData.checkOutTime
      ) {
        attendenceStatus = -1;
      }

      if (!attendenceData || attendenceData.checkInTime === null) {
        attendenceStatus = false;
      } else if (attendenceData.checkOutTime === null) {
        attendenceStatus = true;
      }
    }

    // Determine if the user has joined any shift
    const allShifts = await ShiftModel.find({ gym: gymId });
    let shiftJoinedIndex = -1;
    if (isUserJoined && allShifts?.length > 0) {
      allShifts?.forEach((shift, index) => {
        if (shift?.joinedBy?.length > 0) {
          shift.joinedBy?.forEach((user) => {
            if (user._id.toString() === userId?.toString()) {
              shiftJoinedIndex = index;
            }
          });
        }
      });
    }

    return res.status(200).json({
      message: "GYM_PAGE_DATA_FETCHED_SUCCESSFUL",
      gymData: gymData,
      showEditPage: showEditPage,
      allShifts: allShifts,
      userJoinedAt: userJoinedAt,
      isUserJoined: isUserJoined,
      shiftJoinedIndex: shiftJoinedIndex,
      daysLeftToMonth: daysLeftToMonth,
      ratingdone: ratingdone,
      followingGymOrNot: followingGymOrNot,
      followersCount: followersCount,
      followingCount: followingCount,
      GymFollowUser: GymFollowUser,
      showFollowButton: showFollowButton,
      attendenceStatus: attendenceStatus,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "GYM_PAGE_DATA_FETCHED_FAILED", error: error });
  }
});

homeRoute.post("/:gymId/joingym", async (req, res) => {
  const { gymId } = req?.params;
  const userId = req?.user?._id;

  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED ACCESS" });
  }

  try {
    const isGymOwner = await gymModel.findById(userId);

    if (isGymOwner) {
      return res.status(422).json({ message: "OWNER_CAN'T_JOIN_GYM" });
    }

    let gymData = await gymModel.findById(gymId).populate({
      path: "joinedBy.user",
    });

    if (!gymData) {
      return res.status(404).json({ message: "GYM_NOT_FOUND" });
    }

    // Check if the user has already joined the gym
    let isUserJoined = false;
    gymData.joinedBy.some((joined) => {
      if (joined.user._id.toString() === userId.toString()) {
        isUserJoined = true;
      }
    });

    console.log("isUserJoined", isUserJoined);

    // If the user has not joined the gym
    if (!isUserJoined) {
      // Add the user to the gym's joinedBy array
      await gymModel.findByIdAndUpdate(gymId, {
        $push: { joinedBy: { user: userId, joinedAt: new Date() } },
      });

      // Add the gym to the user's joinedGym array
      await userModel.findByIdAndUpdate(userId, {
        $push: { joinedGym: gymId },
      });
    } else {
      return res.status(200).json({ message: "USER_HAS_ALREADY_JOINED" });
    }

    return res.status(200).json({ message: "USER_JOIN_GYM_SUCCESSFUL" });
  } catch (error) {
    return res.status(500).json({ message: "USER_JOIN_GYM_FAILED" });
  }
});

homeRoute.post("/:gymId/leavegym", async (req, res) => {
  const { gymId } = req.params;
  const userId = req.user._id;

  try {
    // Remove gym from the user's joinedGym array
    await userModel.findByIdAndUpdate(userId, {
      $pull: { joinedGym: gymId },
    });

    // Remove user from the gym's joinedBy array
    await gymModel.findByIdAndUpdate(gymId, {
      $pull: { joinedBy: { user: userId.toString() } },
    });

    // Remove the attendence of the user
    await attendenceModel.deleteMany({
      userId: req.user._id,
      gymId: gymId,
    });

    const shiftData = await ShiftModel.find({ gym: gymId });

    if (shiftData && shiftData.length > 0) {
      for (const shift of shiftData) {
        const hasUser = shift.joinedBy.some(
          (user) => user._id.toString() === userId.toString()
        );

        if (hasUser) {
          const userObjectId = new mongoose.Types.ObjectId(userId);
          await ShiftModel.findByIdAndUpdate(shift._id, {
            $pull: { joinedBy: { _id: userObjectId } },
          });
        }
      }
    }

    return res.status(200).json({ message: "USER_LEFT_GYM_SUCCESSFUL" });
  } catch (error) {
    return res.status(500).json({ error: "USER_LEFT_GYM_FAILED" });
  }
});

homeRoute.post("/gym/mark-attendance", async (req, res) => {
  const { status } = req.query;
  const QR_SECRET = process.env.QR_SECRET;
  const userId = req.user._id;
  const { token } = req.body;

  const now = new Date();
  const currentTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentDate =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  try {
    const decoded = JWT.verify(token, QR_SECRET);
    const { gymId, date, sessionId } = decoded;
    console.log("decode", gymId, date, sessionId, decoded);

    if (currentDate != date) {
      return res.status(400).json({ message: "SOMETHING WENT WRONG" });
    }

    let userJoinThisGym = false;
    const gymData = await gymModel.findById(gymId);
    const loggedInUser = req.user._id;
    gymData.joinedBy.forEach((user) => {
      if (user.user.toString() == loggedInUser.toString()) {
        userJoinThisGym = true;
      }
    });

    if (!userJoinThisGym) {
      return res.status(200).json({
        mesage: "ONLY MEMBERS OF THIS GYM CAN MARK ATTENDENCE IN OR OUT",
      });
    }

    // Fix: Properly compare the string value
    if (status === "true") {
      // Mark attendance out
      const existingAttendance = await attendenceModel.findOne({
        userId,
        gymId,
        date,
        sessionId,
        checkOutTime: null, // Only update if not already checked out
      });

      if (!existingAttendance) {
        return res.status(404).json({
          success: false,
          message: "NO ACTIVE ATTENDENCE RECORD FOUND TO MARK OUT.",
        });
      }

      const data = await attendenceModel.findOneAndUpdate(
        { _id: existingAttendance._id },
        { checkOutTime: currentTime + " " + currentDate },
        { new: true }
      );

      return res.json({
        success: true,
        message: "ATTENDANCE_MARKED_OUT_SUCCESSFULLY",
      });
    } else {
      // Mark attendance in
      try {
        const data = await attendenceModel.create({
          userId,
          gymId,
          date,
          sessionId,
          checkInTime: currentTime + " " + currentDate,
          status: "present",
          checkOutTime: null,
        });

        return res.json({
          success: true,
          message: "ATTENDANCE_MARKED_IN_SUCCESSFULLY",
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          return res.status(409).json({
            success: false,
            message: "Attendance already marked today.",
          });
        }
        throw createErr;
      }
    }
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired QR token.",
      });
    }

    console.error("Error in attendance marking:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while marking attendance.",
    });
  }
});

homeRoute.get("/attendence-report", async (req, res) => {
  try {
    const gymId = req?.user?._id;
    if (!gymId) {
      return res.status(400).json({ error: "UNAUTHORIZED_ACCESS" });
    }

    const { username } = req?.query;
    const data = await attendenceModel.find({ userId: username, gymId: gymId });
    const gymData = await gymModel.findOne({ _id: gymId });

    let joinedAt = "";
    gymData.joinedBy.forEach((user) => {
      if (user.user == username) {
        joinedAt = user.joinedAt;
      }
    });

    const dateObj = new Date(joinedAt);
    const month = dateObj.getMonth();
    const date = dateObj.getDate();

    const today = new Date();
    let attendanceArray = new Array(12);
    for (let i = 0; i < 12; i++) {
      const days = getDaysInMonth(today.getYear(), i);
      attendanceArray[i] = new Array(days);

      for (let j = 0; j < days; j++) {
        if (i < month) {
          attendanceArray[i][j] = { value: -1 };
        } else if (i == month) {
          if (j < date) {
            attendanceArray[i][j] = { value: -1 };
          } else {
            attendanceArray[i][j] = { value: 0 };
          }
        } else {
          attendanceArray[i][j] = { value: 0 };
        }
      }
    }

    data.forEach((doc) => {
      const [year, month, day] = doc.date.split("-");
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);

      let eachDayAttendenceObj = {};
      eachDayAttendenceObj["checkInTime"] = doc.checkInTime;
      eachDayAttendenceObj["checkOutTime"] = doc.checkOutTime;
      eachDayAttendenceObj["date"] = doc.date;

      attendanceArray[monthNum - 1][dayNum - 1] = {
        value: 1,
        eachDayAttendenceObj: eachDayAttendenceObj,
      };
    });

    return res.status(200).json({
      message: "DATA_FETCHED_SUCCESSFULLY",
      attendanceArray: attendanceArray,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});

homeRoute.get("/user/dashboard", async (req, res) => {
  const id = req?.user?._id;

  let userData = await userModel
    .findById(id)
    .populate("joinedGym", "profileImage fullName gymName")
    .populate("phy");

  let userPhyData = await PhyModel.findOne({ user: id });

  if (!userData) {
    return res.status(404).json({ message: "USER_NOT_FOUND" });
  }

  if (userData.userType !== "userModel") {
    return res.status(401).json({
      message: "YOU OWN A USERTYPE ACCOUNT CANT ACCESS A GYM DASHBOARD",
    });
  }

  let showEditPage = false;
  if (req.user._id === id) {
    showEditPage = true;
  }

  let followersList = [];
  let followingList = [];
  let followersCount = 0;
  let followingCount = 0;

  //isko sahi krna hai
  const followData = await followModel
    .findById(id)
    .populate("followers", "fullName profileImage userType")
    .populate("following", "fullName profileImage userType");

  if (!followData) {
    followersCount = 0;
    followingCount = 0;
  } else {
    followersList = followData.followers;
    followingList = followData.following;
    followersCount = followData.followers.length;
    followingCount = followData.following.length;
  }

  let userFollowLoggedInUser = false;
  if (followData?.following?.includes(req.user._id)) {
    userFollowLoggedInUser = true;
  }

  let { userType } = userData;

  const monthJoined = userData.createdAt.getMonth();
  const joinedDate = userData.createdAt.getDate();
  const joinedYear = userData.createdAt.getYear();

  const dateObj = {
    monthJoined: monthJoined,
    joinedDate: joinedDate,
    joinedYear: joinedYear,
  };

  const today = new Date();

  let exerciseArray = new Array(12);
  let exerciseName = new Map();
  let muscleGroup = new Map();
  let caloriesBurned = new Map();

  for (let i = 0; i < 12; i++) {
    const days = getDaysInMonth(today.getYear(), i);
    exerciseArray[i] = new Array(days);
    for (let j = 0; j < days; j++) {
      exerciseArray[i][j] = {};
    }
  }

  // Initialize exerciseArray as a 12-month array with each month having 31 days (max)
  userPhyData?.workout?.forEach((workout) => {
    // 1. Update exerciseName and muscleGroup Maps (unchanged)
    if (exerciseName.has(workout.exerciseName)) {
      exerciseName.set(
        workout.exerciseName,
        exerciseName.get(workout.exerciseName) + workout.time
      );
    } else {
      exerciseName.set(workout.exerciseName, workout.time);
    }

    if (muscleGroup.has(workout.focusPart)) {
      muscleGroup.set(
        workout.focusPart,
        muscleGroup.get(workout.focusPart) + workout.time
      );
    } else {
      muscleGroup.set(workout.focusPart, workout.time);
    }

    // 2. Extract date components safely
    const pushedAt = new Date(workout.pushedAt);
    const m = pushedAt.getMonth();
    const d = pushedAt.getDate();
    const y = pushedAt.getFullYear();

    const time = workout.time;
    const focusPart = `BodyPart-${workout.focusPart}`;
    const workoutName = `Exercise-${workout.exerciseName}`;

    // 3. Get or initialize the workout object for this date
    let workoutObj = exerciseArray[m][d];

    if (!workoutObj || workoutObj === 0) {
      workoutObj = {
        [workoutName]: time,
        [focusPart]: time,
        totalWorkoutTime: time,
        Date: `${d}/${m + 1}/${y}`, // Months are 0-indexed, so +1 for display
        caloriesBurned: 0,
      };
    } else {
      // Update existing workout object
      workoutObj[workoutName] = (workoutObj[workoutName] || 0) + time;
      workoutObj[focusPart] = (workoutObj[focusPart] || 0) + time;
      workoutObj.totalWorkoutTime = (workoutObj.totalWorkoutTime || 0) + time;
      workoutObj.caloriesBurned =
        (Number(workoutObj.caloriesBurned) || 0) +
        (Number(workout.caloriesBurned) || 0);

      if (!workoutObj.Date) {
        workoutObj.Date = `${d}/${m + 1}/${y}`;
      }
    }

    // 4. Store back in the array
    exerciseArray[m][d] = workoutObj;
  });

  let sortedMuscleMap = new Map(
    [...muscleGroup.entries()].sort((a, b) => b[1] - a[1])
  );
  let sortedExerciseMap = new Map(
    [...exerciseName.entries()].sort((a, b) => b[1] - a[1])
  );

  //fetching keys and value from map
  const muscles = [];
  const muscleCount = [];
  const exercise = [];
  const exerciseCount = [];
  let totalexerciseDone = 0;
  let tottalMuscleTrained = 0;

  sortedExerciseMap.forEach((value, key) => {
    totalexerciseDone += value;
  });

  sortedMuscleMap.forEach((value, key) => {
    tottalMuscleTrained += value;
  });

  sortedExerciseMap.forEach((value, key) => {
    exerciseCount.push(((value / totalexerciseDone) * 100).toFixed(1));
    exercise.push(key);
  });

  sortedMuscleMap.forEach((value, key) => {
    muscleCount.push(((value / tottalMuscleTrained) * 100).toFixed(1));
    muscles.push(key);
  });

  return res.status(200).json({
    data: userData,
    showEditPage: showEditPage,
    userType: userType,
    followersList: followersList,
    followingList: followingList,
    followersCount: followersCount,
    followingCount: followingCount,
    userFollowLoggedInUser: userFollowLoggedInUser,
    exerciseArray: exerciseArray,
    muscles: muscles,
    muscleCount: muscleCount,
    exercise: exercise,
    exerciseCount: exerciseCount,
    totalexerciseDone: totalexerciseDone,
    tottalMuscleTrained: tottalMuscleTrained,
  });
});

homeRoute.post("/update-dashboard-personalDetails", async (req, res) => {
  try {
    const userId = req.user._id;

    // Try to fetch user from either userModel or gymModel
    let data =
      (await userModel.findById(userId)) || (await gymModel.findById(userId));

    if (!data) {
      return res.status(404).json({ message: "USER_NOT_FOUND" });
    }

    const { userType } = data;
    console.log("userType:", userType);

    let resdata = {};
    const { profileImage } = req.body;
    let cloudImageURL = null;

    // Optional image upload
    if (profileImage && profileImage.startsWith("data:image")) {
      try {
        cloudImageURL = await uploadToCloudinary(profileImage);
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        return res.status(500).json({
          message: "CLOUDINARY_UPLOAD_FAILED",
          error: error.message,
        });
      }
    }

    // Update logic based on user type
    if (userType === "gymModel") {
      const { fullName, contactNumber, description, monthlyCharge } = req.body;

      console.log("Updating gymModel with:", {
        fullName,
        contactNumber,
        monthlyCharge,
        description,
        cloudImageURL,
      });

      resdata = await gymModel.findOneAndUpdate(
        { _id: userId },
        {
          fullName,
          profileImage: cloudImageURL || data.profileImage,
          description,
          contactNumber,
          monthlyCharge,
        },
        { new: true }
      );
    } else {
      const { fullName, contactNumber, bio } = req.body;

      console.log("Updating userModel with:", {
        fullName,
        contactNumber,
        bio,
        cloudImageURL,
      });

      resdata = await userModel.findOneAndUpdate(
        { _id: userId },
        {
          fullName,
          profileImage: cloudImageURL || data.profileImage,
          bio,
          contactNumber,
        },
        { new: true }
      );
    }

    console.log("Update result:", resdata);

    return res
      .status(200)
      .json({ message: "USER_PROFILE_UPDATED_SUCCESSFULLY" });
  } catch (error) {
    console.error("Unexpected Server Error:", error);
    return res.status(500).json({
      message: "INTERNAL_SERVER_ERROR",
      error: error.message,
    });
  }
});

homeRoute.post("/gym/:gymId/new-shift", async (req, res) => {
  const { gymId } = req.params;
  const { sex, limit, startTime, endTime } = req.body;

  try {
    const shiftData = await ShiftModel.find({});
    let shiftTimeOverloap = false;
    let shiftDetails = null;

    shiftData?.forEach((shift) => {
      if (startTime > shift.startTime && startTime < shift.endTime) {
        shiftTimeOverloap = true;
        shiftDetails = shift;
      }
    });

    if (shiftTimeOverloap) {
      return res.status(200).json({
        message: "SHIFT_TIMING_IS_OVERLAPPING_WITH_ANOTHER_SHIFT_TIME",
        overlappingShift: shiftDetails,
      });
    }

    // Create a new shift
    const shift = await ShiftModel.create({
      gym: gymId,
      sex: sex,
      limit: limit,
      startTime: startTime,
      endTime: endTime,
      status: "Active",
      joinedBy: [],
    });

    return res
      .status(200)
      .json({ message: "SHIFT_CREATED_SUCCESSFULLY", newShift: shift });
  } catch (error) {
    return res.status(500).json({ error: "SHIFT_CREATE_FAILED" });
  }
});

homeRoute.get("/user/:userId", async (req, res) => {
  const id = req.params.userId;
  let userData = await userModel.findById(id).populate("phy");

  if (!userData) {
    return res.status(404).json({ message: "USER_NOT_FOUND" });
  }

  let followersCount = 0;
  let followingCount = 0;

  //isko sahi krna hai
  const followData = await followModel
    .findById(id)
    .populate("followers", "fullName profileImage userType")
    .populate("following", "fullName profileImage userType");

  if (!followData) {
    followersCount = 0;
    followingCount = 0;
  } else {
    followersCount = followData.followers.length;
    followingCount = followData.following.length;
  }

  let userFollowLoggedInUser = false;
  followData?.following?.forEach((user) => {
    if (user._id?.toString() === req?.user?._id?.toString())
      userFollowLoggedInUser = true;
  });

  let loggedInUserFollowMe = false;
  followData?.followers?.forEach((user) => {
    if (user._id.toString() === req.user._id.toString())
      loggedInUserFollowMe = true;
  });

  let showEditPage = false;
  if (req.user._id === id) {
    showEditPage = true;
  }

  let { userType } = userData;
  const monthJoined = userData.createdAt.getMonth();
  const joinedDate = userData.createdAt.getDate();
  const joinedYear = userData.createdAt.getYear();

  const dateObj = {
    monthJoined: monthJoined,
    joinedDate: joinedDate,
    joinedYear: joinedYear,
  };

  const today = new Date();
  let exerciseArray = new Array(12);
  let exerciseName = new Map();
  let muscleGroup = new Map();

  for (let i = 0; i < 12; i++) {
    const days = getDaysInMonth(today.getYear(), i);
    exerciseArray[i] = new Array(days);
    for (let j = 0; j < days; j++) {
      exerciseArray[i][j] = {};
    }
  }

  let userPhyData = await PhyModel.findOne({ user: id });

  // Initialize exerciseArray as a 12-month array with each month having 31 days (max)
  userPhyData?.workout?.forEach((workout) => {
    // 1. Update exerciseName and muscleGroup Maps (unchanged)
    if (exerciseName.has(workout.exerciseName)) {
      exerciseName.set(
        workout.exerciseName,
        exerciseName.get(workout.exerciseName) + workout.time
      );
    } else {
      exerciseName.set(workout.exerciseName, workout.time);
    }

    if (muscleGroup.has(workout.focusPart)) {
      muscleGroup.set(
        workout.focusPart,
        muscleGroup.get(workout.focusPart) + workout.time
      );
    } else {
      muscleGroup.set(workout.focusPart, workout.time);
    }

    // 2. Extract date components safely
    const pushedAt = new Date(workout.pushedAt);
    const m = pushedAt.getMonth();
    const d = pushedAt.getDate();
    const y = pushedAt.getFullYear();

    const time = workout.time;
    const focusPart = `BodyPart-${workout.focusPart}`;
    const workoutName = `Exercise-${workout.exerciseName}`;

    // 3. Get or initialize the workout object for this date
    let workoutObj = exerciseArray[m][d];

    if (!workoutObj || workoutObj === 0) {
      workoutObj = {
        [workoutName]: time,
        [focusPart]: time,
        totalWorkoutTime: time,
        Date: `${d}/${m + 1}/${y}`, // Months are 0-indexed, so +1 for display
        caloriesBurned: 0,
      };
    } else {
      // Update existing workout object
      workoutObj[workoutName] = (workoutObj[workoutName] || 0) + time;
      workoutObj[focusPart] = (workoutObj[focusPart] || 0) + time;
      workoutObj.totalWorkoutTime = (workoutObj.totalWorkoutTime || 0) + time;
      workoutObj.caloriesBurned =
        (Number(workoutObj.caloriesBurned) || 0) +
        (Number(workout.caloriesBurned) || 0);

      if (!workoutObj.Date) {
        workoutObj.Date = `${d}/${m + 1}/${y}`;
      }
    }

    // 4. Store back in the array
    exerciseArray[m][d] = workoutObj;
  });

  let sortedMuscleMap = new Map(
    [...muscleGroup.entries()].sort((a, b) => b[1] - a[1])
  );
  let sortedExerciseMap = new Map(
    [...exerciseName.entries()].sort((a, b) => b[1] - a[1])
  );

  //fetching keys and value from map
  const muscles = [];
  const muscleCount = [];
  const exercise = [];
  const exerciseCount = [];
  let totalexerciseDone = 0;
  let tottalMuscleTrained = 0;

  sortedExerciseMap.forEach((value, key) => {
    totalexerciseDone += value;
  });

  sortedMuscleMap.forEach((value, key) => {
    tottalMuscleTrained += value;
  });

  sortedExerciseMap.forEach((value, key) => {
    exerciseCount.push(((value / totalexerciseDone) * 100).toFixed(1));
    exercise.push(key);
  });

  sortedMuscleMap.forEach((value, key) => {
    muscleCount.push(((value / tottalMuscleTrained) * 100).toFixed(1));
    muscles.push(key);
  });

  return res.status(200).json({
    data: userData,
    userType: userType,
    showEditPage: showEditPage,
    followersCount: followersCount,
    followingCount: followingCount,
    loggedInUserFollowMe: loggedInUserFollowMe,
    userFollowLoggedInUser: userFollowLoggedInUser,
    exerciseArray: exerciseArray,
    muscles: muscles,
    muscleCount: muscleCount,
    exercise: exercise,
    exerciseCount: exerciseCount,
    totalexerciseDone: totalexerciseDone,
    tottalMuscleTrained: tottalMuscleTrained,
  });
});

homeRoute.post("/gym/edit-shift/:shiftId", async (req, res) => {
  const { shiftId } = req.params;
  const { status, limit, startTime, endTime } = req.body;

  // Validate input
  if (!mongoose.Types.ObjectId.isValid(shiftId)) {
    return res.status(400).json({ error: "INVALID_SHIFT_ID" });
  }

  // Basic validation
  if (!status || !limit || !startTime || !endTime) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS" });
  }

  if (startTime >= endTime) {
    return res.status(400).json({ error: "END_TIME_MUST_BE_AFTER_START_TIME" });
  }

  try {
    const updatedShift = await ShiftModel.findByIdAndUpdate(
      shiftId,
      {
        $set: {
          status,
          limit: parseInt(limit),
          startTime,
          endTime,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedShift) {
      return res.status(404).json({ error: "SHIFT_NOT_FOUND" });
    }

    return res.status(200).json({
      message: "SHIFT_UPDATED_SUCCESSFULLY",
      shift: updatedShift,
    });
  } catch (error) {
    return res.status(500).json({
      error: "SHIFT_UPDATE_FAILED",
      message: error.message,
    });
  }
});

homeRoute.post("/gym/:gymId/join-shift/:shiftId", async (req, res) => {
  const userId = req.user._id.toString();
  const { shiftId, gymId } = req.params;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(gymId) ||
      !mongoose.Types.ObjectId.isValid(shiftId)
    ) {
      return res.status(400).json({ message: "INVALID_ID_FORMAT" });
    }

    const userData = await userModel.findById(
      userId,
      "_id fullName profileImage"
    );
    if (!userData) {
      return res.status(404).json({ message: "USER_NOT_FOUND" });
    }

    const gymData = await gymModel.findById(gymId);
    if (!gymData) {
      return res.status(404).json({ message: "GYM_NOT_FOUND" });
    }

    const hasJoinedGym = gymData.joinedBy.some(
      (user) => user.user.toString() === userId
    );
    if (!hasJoinedGym) {
      return res.status(403).json({
        message: "YOU_MUST_HAVE_JOINED_THE_GYM_TO_JOIN_ANY_SHIFT",
      });
    }

    const allShifts = await ShiftModel.find({ gym: gymId });
    if (!allShifts || allShifts.length === 0) {
      return res.status(404).json({ message: "NO_SHIFTS_FOUND_FOR_THIS_GYM" });
    }

    const requestedShift = await ShiftModel.findOne({
      _id: shiftId,
      gym: gymId,
    });
    if (!requestedShift) {
      return res.status(404).json({ message: "SHIFT_NOT_FOUND" });
    }

    // Find the shift where user is already joined
    let currentShiftId = null;
    for (const shift of allShifts) {
      const isUserInShift = shift.joinedBy.some(
        (u) => u._id.toString() === userId
      );
      if (isUserInShift) {
        currentShiftId = shift._id.toString();
        break;
      }
    }

    // Not joined any shift yet
    if (!currentShiftId) {
      if (requestedShift.joinedBy.length >= requestedShift.limit) {
        return res.status(403).json({
          message: "THIS_SHIFT_HAS_REACHED_ITS_MEMBER_LIMIT",
        });
      }

      await ShiftModel.findByIdAndUpdate(
        shiftId,
        { $addToSet: { joinedBy: userData } },
        { new: true }
      );
      return res.status(200).json({ message: "SHIFT_JOINED_SUCCESSFULLY" });
    }

    // Already in this shift
    if (currentShiftId === shiftId) {
      return res.status(400).json({
        message: "YOU_HAVE_ALREADY_JOINED_THIS_SHIFT",
      });
    }

    // Switching shifts
    if (requestedShift.joinedBy.length >= requestedShift.limit) {
      return res.status(403).json({
        message: "THIS_SHIFT_HAS_REACHED_ITS_MEMBER_LIMIT",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Remove user from current shift by _id match
      await ShiftModel.findByIdAndUpdate(
        currentShiftId,
        { $pull: { joinedBy: { _id: userData._id } } },
        { session }
      );

      // Add user to new shift
      await ShiftModel.findByIdAndUpdate(
        shiftId,
        { $addToSet: { joinedBy: userData } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({ message: "SHIFT_CHANGED_SUCCESSFULLY" });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      details: error.message,
    });
  }
});

homeRoute.delete("/gym/remove-shift/:shiftId", async (req, res) => {
  try {
    const { shiftId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      return res.status(400).json({ message: "INVALID_SHIFT_ID" });
    }

    const deletedShift = await ShiftModel.findByIdAndDelete(shiftId);

    return res.status(200).json({
      message: "SHIFT_DELETED_SUCCESSFULLY",
      deletedShift,
    });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return res.status(500).json({ error: "FAILED_TO_DELETE_SHIFT" });
  }
});

//yha se krna hai 5
homeRoute.get("/gym/shiftdetail/:gymId/:shiftId", async (req, res) => {
  try {
    const { shiftId, gymId } = req.params;
    if (gymId !== req.user._id) {
      return res.status(401).json({ message: "UNAUTHORIZED_ACCESS" });
    }

    const shiftData = await ShiftModel.findOne({ gymId, shiftId }).populate(
      "joinedBy"
    );
    if (!shiftData) {
      return res.status(404).json({ message: "SHIFT_NOT_FOUND" });
    }

    return res.status(200).json({
      shiftData: shiftData,
    });
  } catch (error) {
    return res.status(500).json({ error: "FETCH_SHIFT_DETAIL_FAILED" });
  }
});

homeRoute.post("/gym/shiftdetail/update/:shiftId", async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { limit, startTime, endTime } = req.body;
    const newshiftData = await ShiftModel.findByIdAndUpdate(
      { shiftId },
      {
        limit: limit,
        startTime: startTime,
        endTime: endTime,
      }
    );

    if (!newshiftData) {
      return res.status(404).json({ message: "SHIFT_NOT_FOUND" });
    }

    return (
      res.status(200), json({ message: "SHIFT_DETAILS_UPDATED_SUCCESSFULLY" })
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

homeRoute.post("/rating/:gymId", async (req, res) => {
  const { gymId } = req.params;
  const { rating } = req?.body;
  const userId = req.user._id;

  const gym = await gymModel.findById(gymId);
  if (!gym) {
    return res.status(404).json({ message: "GYM_NOT_FOUND" });
  }

  if (gym) {
    let present = false;
    gym.ratedBy.forEach((rate) => {
      if (rate.user.toString() == userId) {
        present = true;
      }
    });

    if (present) {
      return res.status(200).json({ message: "GYM_ALREADY_RATED" });
    }

    gym.ratedBy.push({ user: userId, rating: rating });

    // Recalculate average rating
    const totalRatings = gym.ratedBy.length;
    const totalScore = gym.ratedBy.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalScore / totalRatings;

    // Update the gym's average rating
    gym.rating = averageRating;

    // Save the changes
    await gym.save();

    return res.status(200).json({ message: "THANKS_FOR_RATING" });
  } else {
    return res.status(500).json({ error: "RATING_GYM_FAILED" });
  }
});

homeRoute.get(`/gym/members/:userId/remove`, async (req, res) => {
  const { userId } = req.params;
  const gymId = req.user._id;

  // Convert the userId string to a valid ObjectId
  const objectIdToRemove = userId;

  try {
    const d = await gymModel.findByIdAndUpdate(
      gymId,
      { $pull: { joinedBy: { user: objectIdToRemove } } }, // Removes the object with the matching 'user' _id
      { new: true }
    );

    const c = await userModel.findByIdAndUpdate(
      userId,
      { $pull: { joinedGym: gymId } },
      { new: true }
    );

    return res.status(200).json({ message: "USER_REMOVED_SUCCESSFULLY" });
  } catch (error) {
    return res.status(500).json({ error: "USER_REMOVE_FAILED" });
  }
});

//yha se krna hai 4
homeRoute.get("/profile/:userId/workoutplan", async (req, res) => {
  let workoutPlan;
  try {
    // workoutPlan = await openai.createChatCompletion({
    //   model: "gpt-4", // or 'gpt-3.5-turbo'
    //   messages: [
    //     {
    //       role: "system",
    //       content:
    //         "You are a fitness expert providing customized workout plans based on user data.",
    //     },
    //     {
    //       role: "user",
    //       content: `I am building a personalized workout plan generator.
    //           Given the following inputs, create a workout plan with exercises and information in a structured format using these keys: user, workoutDays, and additionalNotes.
    //           The workout plan should be targeted for the user’s fitness goal, experience level, available equipment, workout frequency, and any injury limitations.

    //           Height: ${userDetails.height} cm
    //           Weight: ${userDetails.weight} kg
    //           Fitness Goal: ${userDetails.fitnessGoal}
    //           Experience Level: ${userDetails.experienceLevel}
    //           Available Equipment: ${userDetails.availableEquipment}
    //           Workout Frequency: ${userDetails.workoutFrequency} days per week
    //           Injuries/Limitations: ${userDetails.injuriesLimitations}`,
    //     },
    //   ],
    //   max_tokens: 1000, // Adjust as per the length of the response you expect
    //   temperature: 0.7, // Adjust for creativity of the response
    // });

    if (!workoutPlan) {
      workoutPlan = {
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
                details:
                  "Lie on a flat bench holding dumbbells at chest level. Push them upwards while keeping your core tight.",
                videoUrl: "https://www.youtube.com/watch?v=VmB1G1K7v94",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/db-bench-press-960x540.jpg",
                caloriesPerMinute: 5, // Approximation
              },
              {
                name: "Dumbbell Row",
                sets: 3,
                reps: "10-12",
                focus: "Back, Biceps",
                details:
                  "Place one knee and one hand on a bench while rowing the dumbbell with the other hand, pulling towards your waist.",
                videoUrl: "https://www.youtube.com/watch?v=MEt8zvEoSlA",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/one-arm-dumbbell-row-960x540.jpg",
                caloriesPerMinute: 5.5, // Approximation
              },
              {
                name: "Dumbbell Shoulder Press",
                sets: 3,
                reps: "10-12",
                focus: "Shoulders, Triceps",
                details:
                  "Sit upright and press dumbbells overhead until your arms are fully extended, then slowly lower them back.",
                videoUrl: "https://www.youtube.com/watch?v=B-aVuyhvLHU",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/seated-dumbbell-shoulder-press-960x540.jpg",
                caloriesPerMinute: 4.5, // Approximation
              },
              {
                name: "Dumbbell Bicep Curls",
                sets: 3,
                reps: "12-15",
                focus: "Biceps",
                details:
                  "Hold a dumbbell in each hand, curl them up to shoulder height, and slowly lower them back.",
                videoUrl: "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-biceps-curl-960x540.jpg",
                caloriesPerMinute: 4, // Approximation
              },
              {
                name: "Dumbbell Tricep Extensions",
                sets: 3,
                reps: "12-15",
                focus: "Triceps",
                details:
                  "Hold a dumbbell overhead with both hands and lower it behind your head, then lift it back up.",
                videoUrl: "https://www.youtube.com/watch?v=nRiJVZDpdL0",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-overhead-triceps-extension-960x540.jpg",
                caloriesPerMinute: 4.5, // Approximation
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
                details:
                  "Sit on a chair, place a dumbbell between your feet, and extend your legs out straight, then lower them back.",
                videoUrl: "https://www.youtube.com/watch?v=foUbbdz6Klg",
                imageUrl:
                  "https://fitnessprogramer.com/wp-content/uploads/2022/02/Seated-Leg-Extensions.jpg",
                caloriesPerMinute: 4, // Approximation
              },
              {
                name: "Dumbbell Deadlifts",
                sets: 3,
                reps: "10-12",
                focus: "Hamstrings, Glutes",
                details:
                  "Hold dumbbells in front of you, keep your back straight, and lower them towards the floor while hinging at the hips.",
                videoUrl: "https://www.youtube.com/watch?v=r4MzxtBKyNE",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/romanian-deadlift-960x540.jpg",
                caloriesPerMinute: 6, // Approximation
              },
              {
                name: "Glute Bridges",
                sets: 3,
                reps: "15",
                focus: "Glutes, Lower Back",
                details:
                  "Lie on your back with knees bent and feet flat, push your hips upward while squeezing your glutes, then lower.",
                videoUrl: "https://www.youtube.com/watch?v=wPM8icPu6H8",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/glute-bridge-960x540.jpg",
                caloriesPerMinute: 4.5, // Approximation
              },
              {
                name: "Standing Calf Raises (Bodyweight)",
                sets: 3,
                reps: "15-20",
                focus: "Calves",
                details:
                  "Stand upright and raise your heels off the ground as high as possible, then slowly lower back down.",
                videoUrl: "https://www.youtube.com/watch?v=-M4-G8p8fmc",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/calf-raise-960x540.jpg",
                caloriesPerMinute: 3.5, // Approximation
              },
              {
                name: "Dumbbell Russian Twists",
                sets: 3,
                reps: "15-20 (each side)",
                focus: "Core, Obliques",
                details:
                  "Sit on the floor with knees bent, lean back slightly, and twist your torso side to side while holding a dumbbell.",
                videoUrl: "https://www.youtube.com/watch?v=wkD8rjkodUI",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/russian-twist-960x540.jpg",
                caloriesPerMinute: 5, // Approximation
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
                details:
                  "Hold a dumbbell in each hand or use bodyweight, squat down while keeping your chest up and knees behind your toes.",
                videoUrl: "https://www.youtube.com/watch?v=aclHkVaku9U",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-squat-960x540.jpg",
                caloriesPerMinute: 6, // Approximation
              },
              {
                name: "Dumbbell Chest Flyes",
                sets: 3,
                reps: "12-15",
                focus: "Chest",
                details:
                  "Lie on a flat bench with dumbbells in both hands, extend arms out and then bring them back together above your chest.",
                videoUrl: "https://www.youtube.com/watch?v=eozdVDA78K0",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-chest-flye-960x540.jpg",
                caloriesPerMinute: 5, // Approximation
              },
              {
                name: "Dumbbell Shoulder Lateral Raises",
                sets: 3,
                reps: "12-15",
                focus: "Shoulders",
                details:
                  "Stand upright, raise your arms out to the sides until they are at shoulder height, then lower them back down.",
                videoUrl: "https://www.youtube.com/watch?v=3VcKaXpzqRo",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-lateral-raise-960x540.jpg",
                caloriesPerMinute: 4, // Approximation
              },
              {
                name: "Dumbbell Hammer Curls",
                sets: 3,
                reps: "12-15",
                focus: "Biceps",
                details:
                  "Hold dumbbells with your palms facing each other, curl them up to shoulder level, and slowly lower them.",
                videoUrl: "https://www.youtube.com/watch?v=zC3nLlEvin4",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-hammer-curl-960x540.jpg",
                caloriesPerMinute: 4.5, // Approximation
              },
              {
                name: "Dumbbell Overhead Tricep Extensions",
                sets: 3,
                reps: "12-15",
                focus: "Triceps",
                details:
                  "Hold a dumbbell overhead with both hands, lower it behind your head, then lift it back up while keeping your elbows in.",
                videoUrl: "https://www.youtube.com/watch?v=6SS6K3lAwZ8",
                imageUrl:
                  "https://www.bodybuilding.com/images/2021/xdb/originals/dumbbell-overhead-triceps-extension-960x540.jpg",
                caloriesPerMinute: 4.5, // Approximation
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
    }

    //get data from chat gpt in the above format about the exercise for the user and render it on the page
    return res.render("dailyworkoutplan", {
      workoutPlan: workoutPlan,
      user: req.user,
    });
  } catch (error) {
    return null;
  }
});

homeRoute.get("/workout-day/:index", async (req, res) => {
  const { index } = req.params;
  return res.render("workoutday", {
    workoutDays: workoutPlan.workoutDays[index - 1],
    day: Number(index),
  });
});

homeRoute.get(
  "/workout-day/:day/workout/:index/:exercisename",
  async (req, res) => {
    const { day, index, exercisename } = req.params;
    let dayindex = Number(day);

    let exerciseObj;
    workoutPlan.workoutDays.forEach((day) => {
      day.exercises.forEach((exercise) => {
        if (exercise.name == exercisename) {
          exerciseObj = exercise;
        }
      });
    });

    //make a call to chatgpt which will give data about that "exerciseObj"
    return res.render("exercisepage", {
      exerciseObj: exerciseObj,
      day: day,
      user: req.user,
    });
  }
);

homeRoute.post("/exercise/:exercisetype/:focuspart/:day", async (req, res) => {
  try {
    const { exercisetype, focuspart, day } = req.params; // Getting the params for exercise type and focus part
    const { time } = req.body; // Extracting the workout time from the request body
    const userId = req.user._id; // Assuming the user is authenticated and the ID is available in req.user

    // Check if the time is a valid number
    if (!time || isNaN(time)) {
      return res.status(400).send("Invalid time provided");
    }

    const workoutEntry = {
      time: parseInt(time), // Store workout time
      pushedAt: new Date(),
      focusPart: focuspart,
      name: exercisetype,
    };

    // Update the user's workout array by pushing the new workout time
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        $push: {
          workout: workoutEntry,
        },
      },
      { new: true } // Return the updated document
    );

    // If no user was found, return an error
    if (!updatedUser) {
      return res.status(404).send("User not found");
    }

    let exerciseObj;
    workoutPlan.workoutDays.forEach((day) => {
      day.exercises.forEach((exercise) => {
        if (exercise.name == exercisetype) {
          exerciseObj = exercise;
        }
      });
    });

    // Send a success response
    return res.render("exercisepage", {
      exerciseObj: exerciseObj,
    });
  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
});

module.exports = {
  homeRoute,
};
