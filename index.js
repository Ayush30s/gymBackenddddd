require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

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
const PORT = 7000;
const http = require("http").createServer(app);

const { Server } = require("socket.io");

const io = new Server(http, {
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
    if (reqbyType == "gymModel") gymIdToSocketId[reqby] = socket.id;
    else userIdToSocketId[reqby] = socket.id;
  });

  socket.on("request", async (data) => {
    const { reqto, reqby, requestType, reqtoType, reqbyType, status } = data;
    let reqtoSocketId = gymIdToSocketId[reqto];
    if (reqtoSocketId == null) {
      reqtoSocketId = userIdToSocketId[reqto];
    }

    if (reqtoSocketId) {
      io.to(reqtoSocketId).emit(requestType, data);
    } else {
      console.log(`No socket registered for reqto: ${reqto}`);
    }
  });

  socket.on("request accepted", (data) => {
    let userSocketId = userIdToSocketId[data.to._id];
    if (userSocketId == null) {
      userSocketId = gymIdToSocketId[data.to._id];
    }
    socket.to(userSocketId).emit("accepted", data);
  });

  socket.on("request rejected", (data) => {
    let userSocketId = userIdToSocketId[data.to._id];
    if (userSocketId == null) {
      userSocketId = gymIdToSocketId[data.to._id];
    }
    socket.to(userSocketId).emit("rejected", data);
  });
});

// https://gym-frontendnew-lnl5.vercel.app
// https://gym-frontendnew-lnl5.vercel.app
app.use(
  cors({
    origin: "https://gym-frontendnew-lnl5.vercel.app",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected Successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

app.get("/test", (req, res) => {
  return res.send("You got it!!");
});

app.use(authenticateUser("token"));

app.use("/listing", listingRouter);
app.use("/register", ownerRoute);
app.use("/home", homeRoute);
app.use("/request", followRoute);
app.use("/notify", requestRoute);
app.use("/blog", blogRouter);
app.use("/workout", workoutRouter);
app.use("/payment", paymentRouter);

http.listen(PORT, () => {
  console.log("Server with Socket.IO running at PORT:", PORT);
});
