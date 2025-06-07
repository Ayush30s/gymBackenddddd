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

const app = express();
const PORT = 7000;
const http = require("http").createServer(app);

const { Server } = require("socket.io");
const io = new Server(http, {
  cors: {
    origin: "https://gymfrontendd.netlify.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const gymIdToOwnerSocketId = {};
const userIdToSocketId = {};

io.on("connection", (socket) => {
  console.log("New socket connected:", socket.id);

  socket.on("register", ({ reqby, reqbyType }) => {
    if (reqbyType == "gymModel") gymIdToOwnerSocketId[reqby] = socket.id;
    else userIdToSocketId[reqby] = socket.id;
    console.log(`user registered: reqby=${reqby}, socketId=${socket.id}`);
  });

  socket.on("request received", async (data) => {
    console.log("-----------", data);
    const { reqto, reqby, requestType, reqtoType, reqbyType, status } = data;
    console.log(data);
    const reqtoSocketId = gymIdToOwnerSocketId[reqto];
    if (reqtoSocketId) {
      io.to(reqtoSocketId).emit(requestType, data);
      console.log(`Join request sent to reqto ${reqto}`);
    } else {
      console.log(`No owner socket registered for reqto: ${reqto}`);
    }
  });

  socket.on("request accepted", (data) => {
    console.log("requser acctepted");
    const userSocketId = userIdToSocketId[data.to._id];
    console.log("request accepted11", userSocketId);
    socket.to(userSocketId).emit("ownerAccepted", data);
  });

  socket.on("request rejected", (data) => {
    const userSocketId = userIdToSocketId[data.to._id];
    console.log("request accepted", userSocketId);
    socket.to(userSocketId).emit("ownerRejected", data);
  });
});

app.use(
  cors({
    origin: "http://localhost:5173",
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

http.listen(PORT, () => {
  console.log("Server with Socket.IO running at PORT:", PORT);
});
