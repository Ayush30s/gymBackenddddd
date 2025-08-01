const express = require("express");
const RequestModel = require("../Models/request");
const sendResponse = require("../utils/responseHandler");

const RequestRouter = express.Router();

RequestRouter.get("/allnotifications/:reqAction", async (req, res) => {
  const userId = req?._id;
  const userType = req?.userType;
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

    // delete older accepted or rejected requests for same pair of users and requestType in the incoming request
    await RequestModel.deleteMany({
      reqby,
      reqto,
      requestType,
      status: { $in: ["accepted", "rejected"] },
    });

    // check if a pending rquest already exists between the pair of users and userType in the incoming request
    const existingRequest = await RequestModel.findOne({
      reqby,
      reqto,
      requestType,
      status,
    });

    // if the logged in user again makes request for same request Type , ignore it
    if (existingRequest && existingRequest.reqby == req.user._id) {
      return sendResponse(res, 409, {
        success: false,
        debug: "REQUEST ALREADY SENT",
        message: "your request is already sent",
        error,
      });
    }

    // if exists, change the status to accepted
    // if (existingRequest) {
    //   await RequestModel.findOneAndUpdate(
    //     { _id: existingRequest._id },
    //     {
    //       status: "accepted",
    //     }
    //   );

    //   return sendResponse(res, 200, {
    //     success: true,
    //     debug: "USER STATUS CHANGED FROM PENDING TO ACCEPTED",
    //     message: "your request is accepted",
    //   });
    // } else {
    // else, create a new request
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
    // }
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
    const { requestId, status, requestType } = req.body;

    if (!requestId || !status) {
      return res
        .status(400)
        .json({ error: "requestId and status are required" });
    }

    // Step 1: Find the current request
    const currentRequest = await RequestModel.findById(requestId);
    if (!currentRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    // // Step 2: Find and delete older requests for same reqby, reqto, requestType
    // await RequestModel.deleteMany({
    //   reqby: currentRequest.reqby,
    //   reqto: currentRequest.reqto,
    //   requestType: requestType,
    //   status: { $in: ["accepted", "rejected"] },
    // });

    // Step 3: Update the status of the current request
    currentRequest.status = status;
    await currentRequest.save();

    res.status(200).json({
      message: "Older request deleted (if any), current request status updated",
      request: currentRequest,
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
          requestType: notification.requestType,
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
          requestType: notification.requestType,
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
