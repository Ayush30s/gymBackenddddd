const { Router } = require("express");
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
      .findById(loggedInuser)
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
      .findById(removeId)
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
    const loggedInuser = req.user._id;
    const userType = req.user.userType;

    let followuserType = "userModel";
    const gymData = await gymModel.findById(followId);
    if (gymData) {
      followuserType = "gymModel";
    }

    let secondPersonFollowDoc = await followModel.findById(followId);
    if (!secondPersonFollowDoc) {
      // Create a new follow document if not found
      secondPersonFollowDoc = new followModel({
        _id: followId,
        followers: [loggedInuser],
        followerType: [userType],
      });
    } else {
      // Add to followers only if not already added
      if (!secondPersonFollowDoc.followers.includes(loggedInuser)) {
        secondPersonFollowDoc.followers.push(loggedInuser);
        secondPersonFollowDoc.followerType.push(userType);
      }
    }

    await secondPersonFollowDoc.save();

    let loginUserFollowDoc = await followModel.findById(loggedInuser);

    if (!loginUserFollowDoc) {
      // Create a new follow document if not found
      loginUserFollowDoc = new followModel({
        _id: loggedInuser,
        following: [followId],
        followingType: [followuserType], // Type of the user being followed
      });
    } else {
      // Add to following only if not already added
      if (!loginUserFollowDoc.following.includes(followId)) {
        loginUserFollowDoc.following.push(followId);
        loginUserFollowDoc.followingType.push(followuserType);
      }
    }
    await loginUserFollowDoc.save();

    return res.status(200).json({ message: "FOLLOW_REQUEST_SUCCESSFUL" });
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ error: "FOLLOW_REQUEST_FAILED" });
  }
});

followRoute.get("/user/followingList/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const loggedInuser = req.user._id;

    // Fetch the follow document
    const followDoc = await followModel
      .findById(user_id)
      .select("following followingType")
      .lean();

    if (!followDoc || followDoc.following.length === 0) {
      return res.status(200).json({
        message: "THIS USER IS NOT FOLLOWING ANYONE",
        followingUsers: [],
      });
    }

    if (loggedInuser.toString() !== user_id.toString()) {
      const loggedInUserFollowDoc = await followModel
        .findById(loggedInuser)
        .select("followers")
        .lean();

      let loggedInUserFollowYou = false;
      loggedInUserFollowDoc?.followers?.forEach((user) => {
        if (user._id == user_id) {
          loggedInUserFollowYou = true;
        }
      });

      if (!loggedInUserFollowYou) {
        return res.status(200).json({
          message:
            "YOU CAN'T ACCESS THE FOLLOWERS LIST OF A USER WHO DOESN'T FOLLOW YOU",
        });
      }
    }

    const followingUsers = await Promise.all(
      followDoc.following.map(async (followedUserId, index) => {
        const userType = followDoc.followingType[index]; // Get corresponding user type
        const model = userType === "userModel" ? userModel : gymModel;

        return model
          .findById(followedUserId, "fullName profileImage userType")
          .lean();
      })
    );

    return res.status(200).json({
      followingUsers: followingUsers.filter((user) => user),
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
      .findById(user_id)
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
        .findById(loggedInuser)
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
        const followerType = userFollowDoc.followerType[index]; // Get corresponding type
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
