require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");

// Routes & Middleware
const ownerRoute = require("./Routes/owner.js");
const { homeRoute } = require("./Routes/home.js");
const followRoute = require("./Routes/follow.js");
const { workoutRouter } = require("./Routes/workout.js");
const { blogRouter } = require("./Routes/blog.js");
const { listingRouter } = require("./Routes/listing.js");
const { authenticateUser } = require("./Middleware/authentication.js");
const requestRoute = require("./Routes/requests.js");
const paymentRouter = require("./Routes/payment.js");

const app = express();
const PORT = process.env.PORT || 7000;

app.set("trust proxy", 1);

const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "https://gym-frontendnew-lnl5.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
  pingTimeout: 20000,
  pingInterval: 25000,
});

const gymIdToSocketId = {};
const userIdToSocketId = {};

io.on("connection", (socket) => {
  console.log("new user connected", socket.id);

  socket.on("register", ({ reqby, reqbyType }) => {
    if (reqbyType === "gymModel") {
      gymIdToSocketId[reqby] = socket.id;
    } else {
      userIdToSocketId[reqby] = socket.id;
    }
  });

  socket.on("request", async (data) => {
    const { reqto, requestType } = data;
    const reqtoSocketId = gymIdToSocketId[reqto] || userIdToSocketId[reqto];

    if (reqtoSocketId) {
      io.to(reqtoSocketId).emit(requestType, data);
    } else {
      console.log(`No socket registered for reqto: ${reqto}`);
    }
  });

  socket.on("request accepted", (data) => {
    const userSocketId =
      userIdToSocketId[data.to._id] || gymIdToSocketId[data.to._id];

    if (userSocketId) {
      socket.to(userSocketId).emit("accepted", data);
    }
  });

  socket.on("request rejected", (data) => {
    const userSocketId =
      userIdToSocketId[data.to._id] || gymIdToSocketId[data.to._id];

    if (userSocketId) {
      socket.to(userSocketId).emit("rejected", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", socket.id);

    for (const key in gymIdToSocketId) {
      if (gymIdToSocketId[key] === socket.id) {
        delete gymIdToSocketId[key];
        break;
      }
    }

    for (const key in userIdToSocketId) {
      if (userIdToSocketId[key] === socket.id) {
        delete userIdToSocketId[key];
        break;
      }
    }
  });
});

// Middleware
app.use(limiter);
app.use(
  cors({
    origin: "https://gym-frontendnew-lnl5.vercel.app",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health / Test routes
app.get("/test", (req, res) => {
  return res.send("You got it!!");
});

app.get("/db-check", (req, res) => {
  return res.status(200).json({
    mongoConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    dbName: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
  });
});

// Auth middleware
app.use(authenticateUser("token"));

// Routes
app.use("/listing", listingRouter);
app.use("/register", ownerRoute);
app.use("/home", homeRoute);
app.use("/request", followRoute);
app.use("/notify", requestRoute);
app.use("/blog", blogRouter);
app.use("/workout", workoutRouter);
app.use("/payment", paymentRouter);

// Mongo connection listeners
mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to DB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

// Start server only after DB connection
async function startServer() {
  try {
    console.log("MONGO_URL exists:", !!process.env.MONGO_URL);

    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL is missing in environment variables");
    }

    await mongoose.connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 30000,
    });

    console.log("MongoDB connected successfully");
    console.log("Mongo readyState:", mongoose.connection.readyState);
    console.log("Mongo DB Name:", mongoose.connection.name);

    server.listen(PORT, () => {
      console.log("Server with Socket.IO running at PORT:", PORT);
    });
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

startServer();
