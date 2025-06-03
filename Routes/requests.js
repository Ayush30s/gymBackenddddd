const express = require("express");
const RequestModel = require("../Models/request");
const sendResponse = require("../utils/responseHandler");

const RequestRouter = express.Router();

RequestRouter.get("/allnotifications/:reqAction", async (req, res) => {
  const userId = req.user?._id;
  const userType = req.user.userType;
  const { reqAction } = req.params;

  try {
    let allReq = [];

    if (reqAction == "received") {
      allReq = await RequestModel.find({ reqto: userId }).populate({
        path: "reqby",
        select: "fullName email",
      });
    } else if (reqAction == "sent") {
      allReq = await RequestModel.find({ reqby: userId }).populate({
        path: "reqto",
        select: "fullName email",
      });
    } else {
      const sentRequests = await RequestModel.find({ reqby: userId }).populate({
        path: "reqto",
        select: "fullName email",
        strictPopulate: false,
      });

      const receivedRequests = await RequestModel.find({
        reqto: userId,
      }).populate({
        path: "reqby",
        select: "fullName email",
        strictPopulate: false,
      });

      allReq = [...sentRequests, ...receivedRequests];
    }

    return sendResponse(res, 200, {
      success: true,
      data: allReq,
      debug: allReq.length
        ? "ALL REQUESTS FETCHED SUCCESSFULLY"
        : "NO REQUESTS FOUND",
      message: allReq.length ? undefined : "No pending requests",
    });
  } catch (error) {
    console.log(error);
    return sendResponse(res, 500, {
      success: false,
      data: [],
      debug: "PENDING REQUESTS FETCH FAILED",
      message: "Can't fetch requests data, try again later",
      error,
    });
  }
});

// POST: Toggle join/leave request for a gym
RequestRouter.post("/handleRequest", async (req, res) => {
  try {
    const { reqby, reqto, requestType, reqbyType, reqtoType, status } =
      req.body;

    if (!reqby || !reqto || !requestType || !reqbyType || !status) {
      return sendResponse(res, 400, {
        success: false,
        debug: "ALL FIELDS ARE REQUIRED",
        message: "All fields (userId, gymId, type, userModelType) are required",
      });
    }

    const existingRequest = await RequestModel.findOne({
      reqby,
      reqto,
      requestType,
      status,
    });

    if (existingRequest) {
      await RequestModel.findOneAndUpdate(
        { _id: existingRequest._id },
        {
          status: "accepted",
        }
      );

      return sendResponse(res, 200, {
        success: true,
        debug: "USER STATUS CHANGED FROM PENDING TO ACCEPTED",
        message: "your request is accepted",
      });
    } else {
      const newRequest = await RequestModel.create({
        reqby,
        reqto,
        requestType,
        reqbyType,
        reqtoType,
        status: status,
      });

      const reqData = await RequestModel.findOne({
        _id: newRequest._id,
      }).populate({
        path: "reqby",
        select: "fullName",
      });

      return sendResponse(res, 200, {
        success: true,
        debug: "USER REQUESTED TO JOIN",
        message: "your request sent successfully",
        data: reqData,
      });
    }
  } catch (error) {
    console.error("Error in /joingym:", error);
    return sendResponse(res, 500, {
      success: false,
      debug: "JOIN GYM ACTION FAILED",
      message: "Unable to join gym, try again later",
      error,
    });
  }
});

RequestRouter.put("/updatejoinstatus", async (req, res) => {
  try {
    const data = req.body;
    console.log("data", data);

    if (!data.requestId) {
      return res.status(400).json({ error: "requestId is required" });
    }

    const updatedRequest = await RequestModel.findOneAndUpdate(
      { _id: data.requestId },
      { status: data.status },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ debug: "REQUEST NOT FOUND" });
    }

    res.status(200).json({
      message: "Request status updated successfully",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating join request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

RequestRouter.delete("/deleteNotification", async (req, res) => {
  const loggedInUser = req.user._id;
  const notification = req.body;
  console.log("notification", notification);

  try {
    if (loggedInUser == notification.reqby) {
      const data = await RequestModel.findOneAndUpdate(
        {
          status: { $in: ["accepted", "rejected"] },
          reqby: notification.reqby,
          reqto: notification.reqto,
        },
        {
          reqbyRemove: true,
        }
      );
    } else {
      const data = await RequestModel.findOneAndUpdate(
        {
          status: { $in: ["accepted", "rejected"] },
          reqby: notification.reqby,
          reqto: notification.reqto,
        },
        {
          reqtoRemove: true,
        }
      );
    }

    return res
      .status(200)
      .json({ debug: "PREVIOUS COMPLETED NOTIFICATIONS DELETED" });
  } catch (error) {
    console.error("Error deleting request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = RequestRouter;
