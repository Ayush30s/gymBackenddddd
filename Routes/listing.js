const { Router } = require("express");
const mongoose = require("mongoose");
const equipmentListing = require("../Models/listing/equipmentListing");
const sendResponse = require("../utils/responseHandler");
const LikeModel = require("../Models/listing/like");
const SaveModel = require("../Models/listing/save");
const ReportModel = require("../Models/listing/report");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const upload = multer();
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "listingimages" },
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

const listingRouter = Router();

listingRouter.get("/all", async (req, res) => {
  try {
    const { type, city, state, equipment, minPrice, maxPrice } = req.query;
    const userId = req.user?._id;

    const filter = {};

    if (type) filter.type = type;
    if (city) filter["location.city"] = { $regex: new RegExp(city, "i") };
    if (state) filter["location.state"] = { $regex: new RegExp(state, "i") };
    if (equipment && equipment !== "write equipment name...")
      filter.equipment = { $regex: new RegExp(equipment, "i") };

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min) || !isNaN(max)) {
      filter.price = {};
      if (!isNaN(min)) filter.price.$gte = min;
      if (!isNaN(max)) filter.price.$lte = max;
    }

    const listings = await equipmentListing
      .find(filter)
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, {
      success: true,
      debug: "LISTING FETCHED SUCCESSFULLY",
      data: listings,
    });
  } catch (error) {
    console.log(error);
    return sendResponse(res, 500, {
      success: false,
      debug: "FAILED TO FETCH",
      error,
      message: "Oops! Something went wrong. Please try again.",
    });
  }
});

listingRouter.get("/mylisting", async (req, res) => {
  try {
    const userId = req.user?._id;
    const myListing = await equipmentListing.find({ owner: userId });

    return sendResponse(res, 200, {
      data: myListing,
      success: true,
      debug: "DATA FETCHED SUCCESSFULLY",
    });
  } catch (error) {
    return sendResponse(res, 500, {
      data: [],
      success: false,
      debug: "DATA FETCH FAILED",
    });
  }
});

listingRouter.post("/new", async (req, res) => {
  try {
    const owner = req.user?._id;
    const ownerModel = req.user?.userType;

    if (!owner) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized access!",
      });
    }

    const {
      title,
      description,
      category,
      equipment,
      brand,
      model,
      purchaseDate,
      condition = "Good",
      type,
      price,
      negotiable = false,
      warrantyIncluded = false,
      warrantyTime,
      gurrantyIncluded = false,
      gurrantyTime,
      reasonForSale,
      contactNumber,
      images = [],
      status = "active",
      location,
      rental,
    } = req.body;

    const {
      availableFrom,
      availableUntil,
      isAvailable = true,
      minRentalPeriod,
      maxRentalPeriod,
      rentalPrice,
      deposit,
      maintenanceBy = "Owner",
    } = rental;

    const { city, state, street } = location || {};

    // Validate required fields
    if (
      !title ||
      !category ||
      !type ||
      !(price || rentalPrice) ||
      !contactNumber ||
      !city ||
      !state ||
      !street
    ) {
      return sendResponse(res, 400, {
        success: false,
        message: "Missing required fields.",
      });
    }

    // Additional validation for rental listings
    if (type === "rent" || type === "both") {
      if (rentalPrice < 0) {
        return sendResponse(res, 400, {
          success: false,
          message: "Rental price is required for rental listings.",
        });
      }
      if (!availableFrom) {
        return sendResponse(res, 400, {
          success: false,
          message: "Available from date is required for rental listings.",
        });
      }
    }

    const cloudinaryImages = await Promise.all(
      images.map((image) => uploadToCloudinary(image))
    );

    console.log("Uploaded images:", cloudinaryImages);
    const newListing = await equipmentListing.create({
      owner,
      ownerModel,
      title,
      description,
      category,
      equipment,
      brand,
      model,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      condition,
      type,
      price: Number(price),
      negotiable,
      warrantyIncluded,
      gurrantyIncluded,
      warrantyTime,
      gurrantyTime,
      reasonForSale,
      contactNumber: String(contactNumber),
      images: cloudinaryImages,
      status,
      rental: {
        availableFrom: rental.availableFrom
          ? new Date(rental.availableFrom)
          : null,
        availableUntil: rental.availableUntil
          ? new Date(rental.availableUntil)
          : null,
        isAvailable,
        minRentalPeriod: rental.minRentalPeriod
          ? Number(rental.minRentalPeriod)
          : null,
        maxRentalPeriod: rental.maxRentalPeriod
          ? Number(rental.maxRentalPeriod)
          : null,
        rentalPrice: rental.rentalPrice ? Number(rentalPrice) : null,
        deposit: rental.deposit ? Number(deposit) : null,
        maintenanceBy: rental.maintenanceBy,
      },
      location: {
        city,
        state,
        street,
      },
    });

    console.log("newListing-----", newListing);

    return sendResponse(res, 201, {
      success: true,
      message: "Listing created successfully.",
      data: newListing,
    });
  } catch (error) {
    console.log(error);
    return sendResponse(res, 500, {
      success: false,
      message: "An error occurred while creating the listing.",
      error: error,
    });
  }
});

listingRouter.get("/:listingId", async (req, res) => {
  try {
    const LoggedInUser = req.user?._id;
    const { listingId } = req.params;

    // Validate listingId
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return sendResponse(res, 400, {
        success: false,
        message: "Invalid listing ID.",
        error: "INVALID_LISTING_ID",
      });
    }

    const [likeCount, userLikeDoc] = await Promise.all([
      LikeModel.countDocuments({ listingId: listingId }),
      LikeModel.findOne({ listingId: listingId, userId: LoggedInUser }),
    ]);
    const [saveCount, userSaveDoc] = await Promise.all([
      SaveModel.countDocuments({ listingId: listingId }),
      SaveModel.findOne({ listingId: listingId, userId: LoggedInUser }),
    ]);
    const [reportCount, userReportDoc] = await Promise.all([
      ReportModel.countDocuments({ listingId: listingId }),
      ReportModel.findOne({ listingId: listingId, userId: LoggedInUser }),
    ]);

    const listingData = await equipmentListing
      .findOne({ _id: listingId })
      .populate({
        path: "owner",
        select: "fullName email contactNumber createdAt",
      });

    if (!listingData) {
      return sendResponse(res, 404, {
        success: false,
        message: "Listing not found.",
        error: "LISTING_NOT_FOUND",
      });
    }

    const isLoggedInUser =
      LoggedInUser?.toString() === listingData.owner?._id?.toString();

    return sendResponse(res, 200, {
      success: true,
      message: "Listing data fetched successfully.",
      data: {
        listingData,
        isLoggedInUser,
        likeCount: likeCount,
        saveCount: saveCount,
        flagCount: reportCount,
        likeStatus: userLikeDoc ? true : false,
        saveStatus: userSaveDoc ? true : false,
        flagStatus: userReportDoc ? true : false,
      },
    });
  } catch (err) {
    console.error(err);
    return sendResponse(res, 500, {
      success: false,
      message: "Error fetching listing data.",
      error: err,
    });
  }
});

listingRouter.post("/update/:listingId", async (req, res) => {
  try {
    const owner = req.user?._id;
    const { listingId } = req.params;

    if (!owner) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized access!",
      });
    }

    // Validate listingId
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      return sendResponse(res, 400, {
        success: false,
        message: "Invalid listing ID",
      });
    }

    const {
      title,
      description,
      category,
      equipment,
      brand,
      model,
      purchaseDate,
      condition = "Good",
      type,
      price,
      negotiable = false,
      warrantyIncluded = false,
      warrantyTime,
      gurrantyIncluded = false,
      gurrantyTime,
      reasonForSale,
      contactNumber,
      images = [],
      status = "active",
      location,
      rental,
    } = req.body;

    const {
      availableFrom,
      availableUntil,
      isAvailable = true,
      minRentalPeriod,
      maxRentalPeriod,
      rentalPrice,
      deposit,
      maintenanceBy = "Owner",
    } = rental;

    if (!location) {
      return sendResponse(res, 400, {
        success: false,
        message: "Location is required",
      });
    }
    const { city, state, street } = location;

    if (
      !title ||
      !category ||
      !type ||
      !(price || rentalPrice) ||
      !contactNumber ||
      !city ||
      !state ||
      !street
    ) {
      return sendResponse(res, 400, {
        success: false,
        message: "Missing required fields",
      });
    }

    // Additional validation for rental listings
    if (type === "rent" || type === "both") {
      if (!rentalPrice) {
        return sendResponse(res, 400, {
          success: false,
          message: "Rental price is required for rental listings",
        });
      }
      if (!availableFrom) {
        return sendResponse(res, 400, {
          success: false,
          message: "Available from date is required for rental listings",
        });
      }
    }

    const cloudinaryImages = await Promise.all(
      images.map((image) => uploadToCloudinary(image))
    );

    const updatedListing = await equipmentListing.findOneAndUpdate(
      { _id: listingId, owner },
      {
        title,
        description,
        category,
        equipment,
        brand,
        model,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        condition,
        type,
        price: Number(price),
        negotiable,
        warrantyIncluded,
        gurrantyIncluded,
        warrantyTime,
        gurrantyTime,
        reasonForSale,
        contactNumber: String(contactNumber),
        images: cloudinaryImages,
        status,
        rental: {
          availableFrom: availableFrom ? new Date(availableFrom) : null,
          availableUntil: availableUntil ? new Date(availableUntil) : null,
          isAvailable,
          minRentalPeriod: minRentalPeriod ? Number(minRentalPeriod) : null,
          maxRentalPeriod: maxRentalPeriod ? Number(maxRentalPeriod) : null,
          rentalPrice: rentalPrice ? Number(rentalPrice) : null,
          deposit: deposit ? Number(deposit) : null,
          maintenanceBy,
        },
        location: {
          city,
          state,
          street,
        },
      },
      { new: true }
    );

    if (!updatedListing) {
      return sendResponse(res, 404, {
        success: false,
        message: "Listing not found or you are not authorized to update it",
        debug: "LISTING NOT FOUND",
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: "Listing updated successfully",
      debug: "LISTING UPDATED SUCCESSFULLY",
      data: updatedListing,
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: "Error while updating listing",
      debug: "FAILED TO UPDATE LISTING",
      error,
    });
  }
});

listingRouter.post("/like/:listingId", async (req, res) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?._id;
    console.log(req.user);

    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized",
      });
    }

    // Check if the like already exists
    const existingLike = await LikeModel.findOne({
      listingId,
      userId,
    });

    if (existingLike) {
      // If exists, unlike (remove the like)
      await LikeModel.deleteOne({ _id: existingLike._id });

      return sendResponse(res, 200, {
        success: true,
        action: "unliked",
        data: false,
      });
    }

    // If not exists, create a new like
    await LikeModel.create({
      listingId,
      userId,
      ownerModel: req.user.userType,
    });

    return sendResponse(res, 200, {
      success: true,
      action: "liked",
      data: true,
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, {
      success: false,
      message: "Internal server error",
      error,
    });
  }
});

listingRouter.post("/report/:listingId", async (req, res) => {
  try {
    console.log(req.body, "00000000");
    const { message, reason } = req.body;
    // console.log(message, reason, "00000000-");
    const { listingId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized",
      });
    }

    const existingReport = await ReportModel.findOne({
      listingId,
      userId,
    });

    if (existingReport) {
      await ReportModel.deleteOne({ _id: existingReport._id });
      return sendResponse(res, 200, {
        success: true,
        action: "concealed",
        data: false,
      });
    }

    await ReportModel.create({
      listingId,
      userId,
      message: message,
      reason: reason,
      ownerModel: req.user.userType,
    });

    return sendResponse(res, 200, {
      success: true,
      action: "reported",
      data: true,
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, {
      success: false,
      message: "Internal server error",
      error,
    });
  }
});

listingRouter.delete("/delete/:listingId", async (req, res) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "User not authenticated",
      });
    }

    const deletedListing = await equipmentListing.findOneAndDelete({
      _id: listingId,
      owner: userId,
    });

    if (!deletedListing) {
      return sendResponse(res, 404, {
        success: false,
        message: "Listing not found or unauthorized",
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    return sendResponse(res, 500, {
      success: false,
      message: "Server error during deletion",
    });
  }
});

module.exports = { listingRouter };
