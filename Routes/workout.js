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

    const chatGptPrompt = `You must respond with a valid JSON array of objects only. No explanations or extra text.

I want you to act as a fitness assistant that recommends exercises in the following JavaScript object format:

{
  "exerciseName": "",
  "focusPart": "",
  "time": <number>,
  "pushedAt": "",
  "caloriesBurned": "<number>",
  "difficulty": "",
  "sets": <number>,
  "reps": <number>,
  "exerciseVideoURL": "",
  "equipment": "",
  "restTime": "",
  "muscleGroup": "",
  "timeLimit": "",
  "description": "",
  "videoDuration": ""
}

Based on the user data below, recommend exactly 3 appropriate exercises that match their profile. Ensure:
- The "description" is motivational and explains the benefit.
- "difficulty" aligns with the user's experience level.
- "equipment" does not include anything outside their available equipment.
- Exercises should be safe if any injuries or limitations are mentioned.
- "pushedAt" must be an ISO date string.
- Return only a valid JSON array of 3 exercise objects.
- Do not wrap the JSON in markdown.

User Data:
- Height: ${height}
- Weight: ${weight}
- Workout Frequency: ${workoutFrequency}
- Fitness Goal: ${fitnessGoal}
- Experience Level: ${experienceLevel}
- Available Equipment: ${availableEquipment}
- Injuries/Limitations: ${injuriesLimitations}`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: chatGptPrompt,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", data);
      return res.status(500).json({
        error: "Gemini API request failed",
        details: data,
      });
    }

    const aiMessage =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!aiMessage) {
      return res.status(500).json({
        error: "Empty response from Gemini",
        raw: data,
      });
    }

    let exercises;

    try {
      exercises = JSON.parse(aiMessage);

      if (!Array.isArray(exercises)) {
        throw new Error("Gemini did not return an array");
      }

      exercises = exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName || "",
        focusPart: exercise.focusPart || "",
        time: Number(exercise.time) || 0,
        pushedAt: exercise.pushedAt || new Date().toISOString(),
        caloriesBurned: String(exercise.caloriesBurned || "0"),
        difficulty: exercise.difficulty || "",
        sets: Number(exercise.sets) || 0,
        reps: Number(exercise.reps) || 0,
        exerciseVideoURL: exercise.exerciseVideoURL || "",
        equipment: exercise.equipment || "",
        restTime: exercise.restTime || "",
        muscleGroup: exercise.muscleGroup || "",
        timeLimit: exercise.timeLimit || "",
        description: exercise.description || "",
        videoDuration: exercise.videoDuration || "",
      }));
    } catch (jsonError) {
      return res.status(500).json({
        error: "AI response could not be parsed. Here's what it returned:",
        raw: aiMessage,
      });
    }

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

    return res.status(200).json({
      exercises,
      message: "AI exercises generated successfully",
    });
  } catch (err) {
    console.error("AI error:", err);
    return res.status(500).json({ error: "Something went wrong with AI" });
  }
});

workoutRouter.post("/exercise/:exerciseName?", async (req, res) => {
  try {
    let { time, focusPart, caloriesBurned, difficulty, sets, reps } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Unauthorized - User not found" });
    }

    const userId = req.user._id;

    time = Number(time);
    let exerciseName = req.params.exerciseName || "Not mentioned";

    // Convert fields to proper types
    sets = Number(sets);
    if (isNaN(sets)) {
      return res.status(400).json({ error: "Sets must be a number" });
    }

    // Build exercise data
    const exerciseData = {
      time,
      focusPart,
      exerciseName,
      caloriesBurned: String(caloriesBurned), // Ensure it's a string
      difficulty,
      sets,
      reps: String(reps), // Schema expects a string
    };

    // Push new workout to user document
    await PhyModel.findOneAndUpdate(
      { user: userId },
      { $push: { workout: exerciseData } },
      { new: true, upsert: true } // upsert ensures doc is created if not exists
    );

    return res.status(200).json({ message: "EXERCISE SUBMITTED SUCCESSFULLY" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid data format" });
  }
});

module.exports = { workoutRouter };
