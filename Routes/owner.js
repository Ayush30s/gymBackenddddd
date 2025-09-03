const JWT = require("jsonwebtoken");
const { Router } = require("express");
const multer = require("multer");
const gymModel = require("../Models/gym");
const userModel = require("../Models/user");
const PhyModel = require("../Models/userphy");
const { createHmac } = require("crypto");
const { createToken } = require("../services/auth");
const cloudinary = require("cloudinary").v2;

const ownerRoute = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "profileImages" },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    stream.end(fileBuffer);
  });
};

ownerRoute.get("/verify-token", (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    return res.status(200).json({ user: decoded });
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
});

// Register as a gym owner
ownerRoute.post("/owner", async (req, res) => {
  try {
    // Extract fields from req.body and convert them to lowercase
    const fullName = req.body.fullName;
    const email = req.body.email;
    const password = req.body.password;
    const state = req.body.state?.toLowerCase();
    const city = req.body.city?.toLowerCase();
    const street = req.body.street?.toLowerCase();
    const gymName = req.body.gymName?.toLowerCase();
    const description = req.body.description?.toLowerCase();
    const gender = req.body.gender?.toLowerCase();
    const contactNumber = req.body.contact;
    const image = req.body.profileImage;
    const monthlyCharge = req.body.monthlyCharge;

    // Ensure all fields are filled
    if (
      !fullName ||
      !email ||
      !password ||
      !gymName ||
      !description ||
      !gender ||
      !contactNumber ||
      !monthlyCharge ||
      !state ||
      !street ||
      !city
    ) {
      return res.status(400).send("All fields are required");
    }

    let cloudImageURL = null;

    // If a file is uploaded, upload it to Cloudinary
    if (image && image.startsWith("data:image")) {
      try {
        cloudImageURL = await uploadToCloudinary(image); // Upload image buffer
      } catch (error) {
        console.error("Error uploading image to Cloudinary:", error);
        return res.status(500).send("Error uploading image to Cloudinary.");
      }
    }

    // Check if the email is already registered in the user model
    const checkEmailInUserModel = await userModel.findOne({ email: email });
    const checkEmailInGymModel = await gymModel.findOne({ email: email });

    if (checkEmailInUserModel || checkEmailInGymModel) {
      return res.send("This Email is already registered.");
    }

    // Create a new gym owner entry in the gym model with the Cloudinary URL
    const newGymOwner = await gymModel.create({
      fullName,
      email,
      password,
      rating: 0,
      gymName,
      description,
      gender,
      contactNumber,
      profileImage: cloudImageURL,
      monthlyCharge,
      state,
      city,
      street,
    });

    return res.status(200).send("Owner is rgistered successfully");
  } catch (error) {
    console.log("Error:", error);
    return res.status(500).send("Internal Server Error");
  }
});

// Register as a user
ownerRoute.post("/user", async (req, res) => {
  try {
    // Extract fields from req.body and convert them to lowercase
    const fullName = req.body.fullName;
    const email = req.body.email;
    const password = req.body.password?.toLowerCase();
    const gender = req.body.gender?.toLowerCase();
    const contactNumber = req.body.contact;
    const image = req.body.profileImage;
    const state = req.body?.state;
    const city = req.body?.city;
    const street = req.body?.street;

    // Ensure all fields are filled
    if (
      !fullName ||
      !email ||
      !password ||
      !gender ||
      !contactNumber ||
      !state ||
      !city ||
      !street
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(401)
        .json({ message: "Password must contain atleast 6 characters" });
    }

    // Check if the email is already registered in the gym model or user Model
    const checkEmailInGymModel = await gymModel.findOne({ email: email });
    const checkEmailInUserModel = await userModel.findOne({ email: email });
    if (checkEmailInGymModel || checkEmailInUserModel) {
      return res
        .status(409)
        .json({ message: "This Email is already registered." });
    }

    let cloudImageURL = null;

    // If a file is uploaded, upload it to Cloudinary
    if (image && image.startsWith("data:image")) {
      try {
        cloudImageURL = await uploadToCloudinary(image);
      } catch (error) {
        console.error("Error uploading image to Cloudinary:", error);
        return res.status(500).send("Error uploading image to Cloudinary.");
      }
    }

    // Create a new user entry in the user model
    const newUser = await userModel.create({
      fullName,
      email,
      password,
      gender,
      contactNumber,
      profileImage: cloudImageURL,
      state,
      city,
      street,
    });

    // Redirect to sign-in form upon successful registration
    return res.status(201).json({ message: "User Registered successfully" });
  } catch (error) {
    // Log the actual error message to debug what's happening
    console.error("Error during registration process:", error);
    return res.sendStatus(500);
  }
});

ownerRoute.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await gymModel.findOne({ email });

    if (!user) {
      user = await userModel.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ message: "Wrong Email or Password" });
    }

    const salt = user.salt;
    const hashPassword = user.password;

    const inputPasswordHash = createHmac("sha256", salt)
      .update(password)
      .digest("hex");

    if (inputPasswordHash !== hashPassword) {
      return res.status(400).json({ message: "Wrong Email or Password" });
    }

    const token = createToken(user);
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        partitioned: true,
        maxAge: 24 * 60 * 60 * 1000,
      })
      .json({
        message: "USER_SIGNIN_SUCCESSFUL",
        user: {
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          userType: user.userType,
        },
      });
  } catch (error) {
    return res.status(500).json({ message: "USER_SIGNIN_FAILED" });
  }
});

ownerRoute.post("/generate-qr-token", (req, res) => {
  const { gymId, sessionId, date } = req.body;

  if (!gymId || !sessionId || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const token = JWT.sign({ gymId, sessionId, date }, process.env.QR_SECRET, {
    expiresIn: "5m",
  });

  res.json({ token });
});

// Sign out route
ownerRoute.post("/signout", async (req, res) => {
  try {
    return res
      .status(200)
      .clearCookie("token")
      .json({ message: "SIGNOUT_SUCCESSFULL" });
  } catch (err) {
    return res.status(401).json({ error: "SIGNOUT_FAILED" });
  }
});

// Add more details
ownerRoute.post("/addmoredetails", async (req, res) => {
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

    const details = await PhyModel.create({
      height,
      weight,
      fitnessGoal,
      experienceLevel,
      availableEquipment,
      workoutFrequency,
      injuriesLimitations,
    });

    await userModel
      .findByIdAndUpdate(req.user._id, { phy: details._id }, { new: true })
      .populate("phy");

    return res.redirect(`/home/profile/${req.user._id}/workoutplan`);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Server error hai");
  }
});

ownerRoute.get("/userDetails/:email", async (req, res) => {
  const { email } = req.params;

  let data = "";
  data = await userModel
    .findOne({ email: email })
    .populate("joinedGym")
    .populate("followData")
    .populate("phy")
    .populate("likedblogs")
    .populate("commntedBlogs")
    .populate("savedblogs");

  if (data === "") {
    data = await gymModel
      .findOne({ email: email })
      .populate("ratedBy.user")
      .populate("joinedBy.user")
      .populate("shifts")
      .populate("plans");
  }

  if (data === "") {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({ data: data });
});

module.exports = ownerRoute;
