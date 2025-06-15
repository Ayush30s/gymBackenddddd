const { Router } = require("express");
const multer = require("multer");
const { blogModel } = require("../Models/blog");
const userModel = require("../Models/user");
const gymModel = require("../Models/gym");
const cloudinary = require("cloudinary").v2;

const blogRouter = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up multer storage (memory storage)
const upload = multer(); // For handling multipart/form-data (buffer storage)

// Utility function to upload image to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "blogimages" }, // Optionally specify a folder in Cloudinary
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url); // Resolve with Cloudinary URL
        }
      }
    );
    stream.end(fileBuffer); // Pass the file buffer to the upload stream
  });
};

blogRouter.get("/allblogs", async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized access!" });
    }

    const allblogs = await blogModel.find(
      {},
      "title content coverImage createdAt"
    );
    return res.status(200).json({ data: allblogs });
  } catch (err) {
    return res.status(500).json({ msg: "BLOGS_FETCH_SUCCESSFULL", error: err });
  }
});

blogRouter.post("/new", async (req, res) => {
  // Check if the user is logged in
  const userId = req.user._id;
  if (!req.user) {
    return res.status(401).json({ message: "UNAUTHORIZED_USER_ERROR" });
  }

  // Extracting form fields (title and content) from req.body
  const { title, content, file } = req.body;

  // Check if title and content are provided
  if (!title || !content) {
    return res.status(400).json({ message: "INCOMPLETE_DATA_ERROR" });
  }

  let cloudImageURL = null;

  // If a file is uploaded, upload it to Cloudinary
  if (file) {
    try {
      cloudImageURL = await uploadToCloudinary(file); // Upload image buffer
    } catch (error) {
      return res.status(500).json({ msg: "CLOUDINARY_UPLOADING_ERROR" });
    }
  }

  // Create the blog in the database
  try {
    const blog = await blogModel.create({
      title: title,
      content: content,
      createdBy: userId,
      coverImage: cloudImageURL,
    });

    return res.status(200).json({
      msg: "BLOG_POST_SUCCESSFULL",
      blog: {
        title: blog.title,
        content: blog.content,
        coverImage: blog.coverImage,
        createdAt: blog.createdAt,
        _id: blog._id,
      },
    });
  } catch (error) {
    return res.status(500).json({ msg: "BLOG_POST_FAILED" });
  }
});

blogRouter.get("/allblogsData", async (req, res) => {
  try {
    if (!req.user._id) {
      return res.status(401).json({ message: "UNAUTHORIZED_USER" });
    }

    const userId = req.user._id;
    const myBlogs = await blogModel.find({ createdBy: userId });
    let blogsData = "";

    if (req.user.userType === "userModel") {
      blogsData = await userModel
        .findById(req.user._id)
        .populate("likedblogs")
        .populate("savedblogs");
    } else {
      blogsData = await gymModel
        .findById(req.user._id)
        .populate("likedblogs")
        .populate("savedblogs");
    }

    return res.status(200).json({
      blogsData: blogsData,
      myBlogs: myBlogs,
    });
  } catch (err) {
    return res.status(500).json({ msg: "BLOGS_DATA_FETCH_FAILED", error: err });
  }
});

blogRouter.get("/:blogId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ msg: "USER_NOT_FOUND" });
    }

    const { blogId } = req.params;

    // Populate 'createdBy', 'likedBy.user', and 'savedBy.user'
    const blog = await blogModel
      .findById(blogId)
      .populate("createdBy")
      .populate("comments.user")
      .exec();

    if (!blog) {
      return res.status(404).json({ msg: "BLOG_NOT_FOUND" });
    }

    // Like and Save counts
    const likecount = blog.likedBy.length;
    const savecount = blog.savedBy.length;
    const commentcount = blog.comments.length;

    // Check if the current user has liked/saved the blog
    const userHasLiked = blog.likedBy.some(
      (like) => like.user._id.toString() === req.user._id.toString()
    );
    const userHasSaved = blog.savedBy.some(
      (save) => save.user._id.toString() === req.user._id.toString()
    );

    return res.status(200).json({
      blog,
      comments: blog.comments, // Assuming 'comments' exist in blog schema
      likecount,
      savecount,
      userHasLiked,
      userHasSaved,
      commentcount,
    });
  } catch (err) {
    return res.status(500).json({
      msg: "BLOG_DATA_REQUEST_FAILED",
      error: err.message,
    });
  }
});

blogRouter.delete("/:blogId", async (req, res) => {
  try {
    const { userType } = req.user;
    const userId = req.user._id;
    const { blogId } = req.params;

    const blog = await blogModel.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: "BLOG_NOT_FOUND" });
    }

    let user;
    if (userType === "userModel") {
      user = await userModel.findById(
        userId,
        "likedblogs savedblogs commntedBlogs"
      );
    } else {
      user = await gymModel.findById(
        userId,
        "likedblogs savedblogs commntedBlogs"
      );
    }

    // Delete the blog document
    await blogModel.findByIdAndDelete(blogId);

    // Remove blogId from user's likedblogs, savedblogs, and commntedBlogs
    if (userType === "userModel") {
      await userModel.findByIdAndUpdate(userId, {
        $pull: {
          likedblogs: blogId,
          savedblogs: blogId,
          commntedBlogs: { blog: blogId }, // Removes comments with the matching blogId
        },
      });
    } else {
      await gymModel.findByIdAndUpdate(userId, {
        $pull: {
          likedblogs: blogId,
          savedblogs: blogId,
          commntedBlogs: { blog: blogId }, // Removes comments with the matching blogId
        },
      });
    }

    return res.status(200).json({ message: "BLOG_REMOVED_SUCCESSFULLY" });
  } catch (error) {
    console.error("Error deleting blog:", error);
    return res.status(500).json({ error: "BLOG_REMOVE_FAILED" });
  }
});

blogRouter.post("/comment/:blogId", async (req, res) => {
  try {
    const { blogId } = req.params;
    const userId = req.user?._id;
    const userType = req.user?.userType;
    const commentContent = req.body.content;

    if (!userId) {
      return res.status(401).json({ msg: "UNAUTHORIZED_USER" });
    }

    if (!blogId || !commentContent) {
      return res.status(400).json({ msg: "BLOG_ID_OR_COMMENT_MISSING" });
    }

    // Get the appropriate model based on user type
    const UserModel = userType === "gymModel" ? gymModel : userModel;

    // Get author data with proper fields
    const author = await UserModel.findById(userId)
      .select("fullName profileImage gymName userType")
      .lean();

    if (!author) {
      return res.status(404).json({ msg: "AUTHOR_NOT_FOUND" });
    }

    // Create new comment
    const newComment = {
      user: userId,
      userType: userType,
      content: commentContent,
      commentAt: new Date(),
    };

    // Add comment to blog
    const updatedBlog = await blogModel.findByIdAndUpdate(
      blogId,
      { $push: { comments: newComment } },
      { new: true }
    );

    // Get the newly added comment (last in array)
    const addedComment = updatedBlog.comments[updatedBlog.comments.length - 1];

    // Prepare response data with populated user info
    const responseComment = {
      _id: addedComment._id,
      content: addedComment.content,
      commentAt: addedComment.commentAt,
      user: {
        _id: userId,
        fullName:
          userType === "gymModel"
            ? author.gymName || author.fullName
            : author.fullName,
        profileImage: author.profileImage,
        userType: userType,
      },
    };

    // Add comment to user's/gym's commentedBlogs
    await UserModel.findByIdAndUpdate(userId, {
      $push: {
        commntedBlogs: {
          comment: commentContent,
          commentAt: new Date(),
          blog: blogId,
        },
      },
    });

    return res.status(200).json({
      msg: "COMMENT_ADD_SUCCESSFUL",
      data: {
        comment: responseComment,
      },
    });
  } catch (err) {
    console.error("COMMENT_ADD_FAILED", err);
    return res.status(500).json({
      msg: "COMMENT_ADD_FAILED",
      error: err.message,
    });
  }
});

blogRouter.post("/like/:blogId", async (req, res) => {
  try {
    const { userType } = req.user;
    const { blogId } = req.params;
    const userId = req.user?._id; // Ensure userId exists

    if (!userId) {
      return res.status(401).json({ msg: "UNAUTHORIZED_USER" });
    }

    let blogDoc = await blogModel.findById(blogId);
    if (!blogDoc) {
      return res.status(404).json({ msg: "BLOG_NOT_FOUND" });
    }

    const isAlreadyLiked = blogDoc.likedBy.some(
      (like) => like.user.toString() === userId
    );

    if (isAlreadyLiked) {
      // Unlike the blog (remove user from likedBy array)
      await blogModel.updateOne(
        { _id: blogId },
        { $pull: { likedBy: { user: userId } } }
      );

      // Remove blog from user's liked blogs
      if (userType === "userModel") {
        await userModel.updateOne(
          { _id: userId },
          { $pull: { likedblogs: blogId } }
        );
      } else {
        await gymModel.updateOne(
          { _id: userId },
          { $pull: { likedblogs: blogId } }
        );
      }

      return res.status(200).json({ msg: "BLOG_UNLIKED_SUCCESSFULLY" });
    } else {
      // Like the blog (add user to likedBy array)
      await blogModel.updateOne(
        { _id: blogId },
        { $push: { likedBy: { user: userId, likedAt: new Date() } } }
      );

      // Add blog to user's liked blogs
      if (userType === "userModel") {
        await userModel.updateOne(
          { _id: userId },
          { $push: { likedblogs: blogId } }
        );
      } else {
        await gymModel.updateOne(
          { _id: userId },
          { $push: { likedblogs: blogId } }
        );
      }

      return res.status(200).json({ msg: "BLOG_LIKED_SUCCESSFULLY" });
    }
  } catch (err) {
    console.error("Error liking/unliking blog:", err);
    return res
      .status(500)
      .json({ msg: "BLOG_LIKE_FAILED", error: err.message });
  }
});

blogRouter.post("/save/:blogId", async (req, res) => {
  try {
    const { userType } = req.user;
    const blogId = req?.params?.blogId.toString();
    const userId = req?.user?._id; // Ensure userId exists

    if (!userId) {
      return res.status(401).json({ msg: "UNAUTHORIZED_USER" });
    }

    let blogDoc = await blogModel.findById(blogId);

    if (!blogDoc) {
      return res.status(404).json({ msg: "BLOG_NOT_FOUND" });
    }

    let isAlreadySaved = false;
    const savedArray = blogDoc?.savedBy;

    if (savedArray.length > 0) {
      isAlreadySaved = savedArray.some((user) => {
        return user.user.toString() === userId;
      });
    }

    if (isAlreadySaved) {
      await blogModel.findByIdAndUpdate(blogId, {
        $pull: { savedBy: { user: userId } },
      });

      //remove like form userModel
      if (userType === "userModel") {
        await userModel.findByIdAndUpdate(userId, {
          $pull: { savedblogs: blogId },
        });
      } else {
        await gymModel.findByIdAndUpdate(userId, {
          $pull: { savedblogs: blogId },
        });
      }

      return res.status(200).json({ msg: "BLOG_UNSAVED_SUCCESSFULLY" });
    } else {
      await blogModel.findByIdAndUpdate(
        blogId,
        { $push: { savedBy: { user: userId, likedAt: new Date() } } },
        { new: true }
      );

      if (userType === "userModel") {
        await userModel.findByIdAndUpdate(userId, {
          $push: { savedblogs: blogId },
        });
      } else {
        await gymModel.findByIdAndUpdate(userId, {
          $push: { savedblogs: blogId },
        });
      }

      return res.status(200).json({ msg: "BLOG_SAVED_SUCCESSFULLY" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "BLOG_LIKE_FAILED", error: err.message });
  }
});

module.exports = {
  blogRouter,
};
