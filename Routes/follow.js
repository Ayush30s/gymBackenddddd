const { Router } = require("express");
const mongoose = require("mongoose");
const gymModel = require("../Models/gym");
const userModel = require("../Models/user");
const ShiftModel = require("../Models/shift");
const followModel = require("../Models/follow");

const followRoute = Router();

followRoute.get("/details/:userId", async (req, res) => {
  try {
    const user_Id = req.params.userId;
    if (!user_Id) {
      return res.status(404).json({ error: "UNAUTHORIZED_USER" });
    }

    const result = await followModel.findById(user_Id);
    return res.status(200).json({
      message: "FOLLOW_DATA_FETCHED_SUCCESSFULLY",
      followDoc: result,
    });
  } catch (error) {
    return res.status(500).json({ error: "FOLLOW_DATA_FETCH_FAILED" });
  }
});

followRoute.post(`/unfollow/user/:user_Id`, async (req, res) => {
  try {
    const { user_Id: removeId } = req.params; // Fix: Use correct param
    const loggedInuser = req.user._id; // Assuming user is authenticated

    // Fetch logged-in user's follow document
    const followDoc = await followModel
      .findOne({ user: loggedInuser })
      .select("following followingType");

    if (!followDoc) {
      return res
        .status(404)
        .json({ error: "NO_FOLLOW_DOCUMENT_FOUND_FOR_LOGGEDIN_USER" });
    }

    // Remove the user from the following list
    let removeIdIndex = followDoc.following.indexOf(removeId);
    if (removeIdIndex !== -1) {
      followDoc.following.splice(removeIdIndex, 1);
      followDoc.followingType.splice(removeIdIndex, 1);
      await followDoc.save();
    } else {
      return res.status(404).json({ message: "USER_IS_NOT_FOLLOWING_YOU" });
    }

    // Fetch the second person's follow document
    const secondPersonFollowDoc = await followModel
      .findOne({ user: removeId })
      .select("followers followerType");
    if (!secondPersonFollowDoc) {
      return res
        .status(404)
        .json({ message: "NO_FOLLOW_DOCUMENT_FOUND_FOR_SECOND_PERSON" });
    }

    // Remove logged-in user from second person's followers list
    let secondPersonIdIndex =
      secondPersonFollowDoc.followers.indexOf(loggedInuser);
    if (secondPersonIdIndex !== -1) {
      secondPersonFollowDoc.followers.splice(secondPersonIdIndex, 1);
      secondPersonFollowDoc.followerType.splice(secondPersonIdIndex, 1);
      await secondPersonFollowDoc.save();
    }

    return res.status(200).json({ message: "UNFOLLOW_SUCCESSFUL" });
  } catch (error) {
    console.error("Unfollow error:", error);
    return res.status(500).json({ error: "UNFOLLOW_FAILED" });
  }
});

followRoute.post("/follow/user/:user_Id", async (req, res) => {
  try {
    const { user_Id: followId } = req.params;
    const loggedInUser = req.user._id;
    const LoggedInUserType = req.user.userType;

    let followUserType = "userModel";
    const gymData = await gymModel.findById(followId);
    if (gymData) {
      followUserType = "gymModel";
    }

    console.log(2222222222);

    let followPersonFollowDoc = await followModel.findById(followId);
    if (!followPersonFollowDoc) {
      // Create a new follow document if not found
      followPersonFollowDoc = new followModel({
        user: followId,
        followers: [loggedInUser],
        followerType: [LoggedInUserType],
      });
    } else {
      // Add to followers only if not already added
      if (!followPersonFollowDoc.followers.includes(loggedInUser)) {
        followPersonFollowDoc.followers.push(loggedInUser);
        followPersonFollowDoc.followerType.push(LoggedInUserType);
      }
    }

    console.log(333333333);

    await followPersonFollowDoc.save();
    let loginUserFollowDoc = await followModel.findById(loggedInUser);

    if (!loginUserFollowDoc) {
      // Create a new follow document if not found
      loginUserFollowDoc = new followModel({
        user: loggedInUser,
        following: [followId],
        followingType: [followUserType],
      });
    } else {
      // Add to following only if not already added
      if (!loginUserFollowDoc.following.includes(followId)) {
        loginUserFollowDoc.following.push(followId);
        loginUserFollowDoc.followingType.push(followUserType);
      }
    }

    console.log(4444444444444);

    await loginUserFollowDoc.save();
    return res.status(200).json({ message: "FOLLOW_REQUEST_SUCCESSFUL" });
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ error: "FOLLOW_REQUEST_FAILED" });
  }
});
followRoute.get("/user/followingList/:user_id", async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: "USER_ID_REQUIRED" });
    }

    // Fetch follow data for the specified user
    const userFollowDoc = await followModel
      .findOne({ user: user_id })
      .select("following followingType")
      .lean();

    if (
      !userFollowDoc ||
      !userFollowDoc.following ||
      userFollowDoc.following.length === 0
    ) {
      return res.status(200).json({
        userFollowingData: [],
        message: "NO_FOLLOWING_FOUND",
      });
    }

    // Check if the logged-in user is different from the profile user
    if (loggedInUser.toString() !== user_id.toString()) {
      // Check if the profile user follows the logged-in user
      const profileUserFollowDoc = await followModel
        .findOne({ user: user_id })
        .select("following")
        .lean();

      let profileUserFollowsLoggedInUser = false;
      if (profileUserFollowDoc?.following) {
        profileUserFollowsLoggedInUser = profileUserFollowDoc.following.some(
          (user) => user._id.toString() === loggedInUser.toString()
        );
      }

      if (!profileUserFollowsLoggedInUser) {
        return res.status(403).json({
          message: "YOU_CANT_ACCESS_FOLLOWING_LIST_OF_USER_YOU_DONT_FOLLOW",
        });
      }
    }

    // Fetch details for each followed entity
    const userFollowingData = await Promise.all(
      userFollowDoc.following.map(async (followingId, index) => {
        const followingType = userFollowDoc.followingType[index];
        const model = followingType === "userModel" ? userModel : gymModel;

        try {
          const entity = await model
            .findById(followingId)
            .select("fullName profileImage userType")
            .lean();

          return entity;
        } catch (error) {
          console.error(
            `Error fetching ${followingType} ${followingId}:`,
            error
          );
          return null;
        }
      })
    );

    return res.status(200).json({
      userFollowingData: userFollowingData.filter((user) => user),
    });
  } catch (error) {
    console.error("Error fetching following list:", error);
    return res.status(500).json({ error: "FOLLOWING_LIST_FETCH_FAILED" });
  }
});

followRoute.get("/user/followersList/:user_id", async (req, res) => {
  try {
    const loggedInuser = req.user._id;
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ error: "USER_ID_REQUIRED" });
    }

    // Fetch follow data for the specified user
    const userFollowDoc = await followModel
      .findOne({ user: user_id })
      .select("followers followerType")
      .lean(); // Better performance

    if (!userFollowDoc || userFollowDoc.followers.length === 0) {
      return res.status(200).json({
        userFollowersData: [],
        message: "NO FOLLOWERS FOUND",
      });
    }

    if (loggedInuser.toString() !== user_id.toString()) {
      const loggedInUserFollowDoc = await followModel
        .findOne({ user: loggedInuser })
        .select("followers")
        .lean();

      youFollowLoggedInUser = false;
      loggedInUserFollowDoc?.followers.forEach((user) => {
        if (user._id == user_id) {
          youFollowLoggedInUser = true;
        }
      });

      if (!youFollowLoggedInUser) {
        return res.status(403).json({
          message:
            "YOU CAN'T ACCESS THIS FOLLOWING LIST OF A USER THAT DOESN'T FOLLOW YOU",
        });
      }
    }

    const userFollowersData = await Promise.all(
      userFollowDoc.followers.map(async (followerId, index) => {
        const followerType = userFollowDoc.followerType[index];
        const model = followerType === "userModel" ? userModel : gymModel;

        return model
          .findById(followerId, "fullName profileImage userType")
          .lean();
      })
    );

    return res.status(200).json({
      userFollowersData: userFollowersData.filter((user) => user),
    });
  } catch (error) {
    console.error("Error fetching followers list:", error);
    return res.status(500).json({ error: "FOLLOWERS_LIST_FETCH_FAILED" });
  }
});

module.exports = followRoute;
