const { Router } = require("express");
const PhyModel = require("../Models/userphy");

const workoutRouter = Router();

workoutRouter.get("/user-physic-data", async (req, res) => {
  try {
    const userId = req.user._id;
    const userPhysicData = await PhyModel.findOne(
      { user: userId },
      "height weight weight experienceLevel availableEquipment workoutFrequency injuriesLimitations"
    );

    return res
      .status(200)
      .json({ message: "DATA_FETCHED_SUCCESSFULLY", data: userPhysicData });
  } catch (err) {
    return res.status(500).json({ message: "DATA_FETCH_FAILED" });
  }
});

workoutRouter.post("/ai-assistance", async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      height,
      weight,
      workoutFrequency,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      injuriesLimitations,
    } = req.body;

    //     const chatGptPrompt = `You must respond with a valid JSON array of objects only. No explanations or extra text.

    // I want you to act as a fitness assistant that recommends exercises in the following JavaScript object format:

    // {
    //   exerciseName: "",
    //   focusPart: "",
    //   time: <number>, // duration in minutes
    //   pushedAt: new Date(),
    //   caloriesBurned: "<number>",
    //   difficulty: "",
    //   sets: <number>,
    //   reps: <number>,
    //   exerciseVideoURL: "",
    //   equipment: "",
    //   restTime: "",
    //   muscleGroup: "",
    //   timeLimit: "",
    //   description: "",
    //   videoDuration: ""
    // }

    // Based on the user data below, recommend **three appropriate exercises** that match their profile. Ensure:
    // - The \`description\` is motivational and explains the benefit.
    // - \`difficulty\` aligns with the user's experience level.
    // - \`equipment\` does not include anything outside their available equipment.
    // - Exercises should be safe if any injuries or limitations are mentioned.

    // User Data:
    // - Height: ${height}
    // - Weight: ${weight}
    // - Workout Frequency: ${workoutFrequency}
    // - Fitness Goal: ${fitnessGoal}
    // - Experience Level: ${experienceLevel}
    // - Available Equipment: ${availableEquipment}
    // - Injuries/Limitations: ${injuriesLimitations}

    // Return only a valid JSON array of 3 exercise objects, formatted exactly as shown above.`;

    //     const openaiResponse = await fetch(
    //       "https://api.openai.com/v1/chat/completions",
    //       {
    //         method: "POST",
    //         headers: {
    //           Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           model: "gpt-3.5-turbo",
    //           messages: [{ role: "user", content: chatGptPrompt }],
    //           temperature: 0.7,
    //         }),
    //       }
    //     );

    //     const data = await openaiResponse.json();

    //     const aiMessage = data.choices?.[0]?.message?.content;

    // Attempt to parse AI output
    const exercises = [
      {
        exerciseName: "Bodyweight Squats",
        focusPart: "Quadriceps",
        time: 5,
        pushedAt: new Date(),
        caloriesBurned: "50",
        difficulty: "Beginner",
        sets: 3,
        reps: 15,
        exerciseVideoURL: "https://www.youtube.com/watch?v=aclHkVaku9U",
        equipment: "None",
        restTime: "60 seconds",
        muscleGroup: "Lower Body",
        timeLimit: "5 minutes",
        description:
          "A great exercise to target your legs, especially the quadriceps.",
        videoDuration: "1:45",
      },
      {
        exerciseName: "Push-Ups",
        focusPart: "Chest",
        time: 5,
        pushedAt: new Date(),
        caloriesBurned: "40",
        difficulty: "Intermediate",
        sets: 3,
        reps: 12,
        exerciseVideoURL: "https://www.youtube.com/watch?v=_l3ySVKYVJ8",
        equipment: "None",
        restTime: "90 seconds",
        muscleGroup: "Upper Body",
        timeLimit: "5 minutes",
        description:
          "An essential upper body exercise for building strength in the chest and arms.",
        videoDuration: "2:10",
      },
      {
        exerciseName: "Plank",
        focusPart: "Core",
        time: 5,
        pushedAt: new Date(),
        caloriesBurned: "20",
        difficulty: "Intermediate",
        sets: 3,
        reps: 1, // simplified for 'Hold for 30 seconds'
        exerciseVideoURL: "https://www.youtube.com/watch?v=pSHjTRCQxIw",
        equipment: "None",
        restTime: "30 seconds",
        muscleGroup: "Core",
        timeLimit: "5 minutes",
        description:
          "A great static exercise to strengthen the core and improve stability.",
        videoDuration: "3:00",
      },
    ];

    // try {
    //   exercises = JSON.parse(aiMessage);
    // } catch (jsonError) {
    //   return res.status(500).json({
    //     error: "AI response could not be parsed. Here's what it returned:",
    //     raw: aiMessage,
    //   });
    // }

    // Save/update user data
    const userData = await PhyModel.findOne({ user: userId });

    if (userData) {
      await PhyModel.findOneAndUpdate(
        { user: userId },
        {
          height,
          weight,
          workoutFrequency,
          fitnessGoal,
          experienceLevel,
          availableEquipment,
          injuriesLimitations,
        }
      );
    } else {
      await PhyModel.create({
        user: userId,
        height,
        weight,
        workoutFrequency,
        fitnessGoal,
        experienceLevel,
        availableEquipment,
        injuriesLimitations,
      });
    }

    return res
      .status(200)
      .json({ exercises, message: "Token balance exhausted" });
  } catch (err) {
    console.error("AI error:", err);
    return res.status(500).json({ error: "Something went wrong with AI" });
  }
});

workoutRouter.post("/exercise/:exerciseName", async (req, res) => {
  const {
    time,
    focusPart,
    exerciseName,
    caloriesBurned,
    difficulty,
    sets,
    reps,
  } = req.body;

  console.log(
    time,
    focusPart,
    exerciseName,
    caloriesBurned,
    difficulty,
    sets,
    reps
  );
  const userId = req.user._id;
  const data = await PhyModel.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        workout: {
          time: time,
          focusPart: focusPart,
          exerciseName: exerciseName,
          caloriesBurned: caloriesBurned,
          difficulty: difficulty,
          sets: sets,
          reps: reps,
        },
      },
    }
  );

  console.log(data);
  return res.status(200).json({ message: "EXERCISE SUBMITTED SUCCESSFULLY" });
});

module.exports = { workoutRouter };
