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

    // Construct the prompt for Gemini (identical to the original OpenAI prompt)
    const chatGptPrompt = `You must respond with a valid JSON array of objects only. No explanations or extra text.

I want you to act as a fitness assistant that recommends exercises in the following JavaScript object format:

{
  exerciseName: "",
  focusPart: "",
  time: <number>, // duration in minutes
  pushedAt: new Date(),
  caloriesBurned: "<number>",
  difficulty: "",
  sets: <number>,
  reps: <number>,
  exerciseVideoURL: "",
  equipment: "",
  restTime: "",
  muscleGroup: "",
  timeLimit: "",
  description: "",
  videoDuration: ""
}

Based on the user data below, recommend **three appropriate exercises** that match their profile. Ensure:
- The \`description\` is motivational and explains the benefit.
- \`difficulty\` aligns with the user's experience level.
- \`equipment\` does not include anything outside their available equipment.
- Exercises should be safe if any injuries or limitations are mentioned.

User Data:
- Height: ${height}
- Weight: ${weight}
- Workout Frequency: ${workoutFrequency}
- Fitness Goal: ${fitnessGoal}
- Experience Level: ${experienceLevel}
- Available Equipment: ${availableEquipment}
- Injuries/Limitations: ${injuriesLimitations}

Return only a valid JSON array of 3 exercise objects, formatted exactly as shown above.`;

    // Call Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("Gemini API key is missing");
    }

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: chatGptPrompt }],
            },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      return res.status(500).json({ error: "Failed to fetch AI recommendations" });
    }

    const geminiData = await geminiResponse.json();
    const aiMessage = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiMessage) {
      return res.status(500).json({ error: "Empty response from Gemini AI" });
    }

    // Parse the AI response as JSON
    let exercises;
    try {
      exercises = JSON.parse(aiMessage);
      // Validate that exercises is an array with 3 items (optional)
      if (!Array.isArray(exercises) || exercises.length !== 3) {
        throw new Error("Invalid response structure");
      }
      // Ensure pushedAt is a Date object (convert ISO string if needed)
      exercises = exercises.map(ex => ({
        ...ex,
        pushedAt: ex.pushedAt ? new Date(ex.pushedAt) : new Date(),
      }));
    } catch (jsonError) {
      console.error("Failed to parse Gemini response as JSON:", aiMessage);
      return res.status(500).json({
        error: "AI response could not be parsed. Here's what it returned:",
        raw: aiMessage,
      });
    }

    // Save/update user physical data
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

    return res.status(200).json({ exercises });
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
