const mongoose = require("mongoose");

const EquipmentListingSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "ownerModel",
  },
  ownerModel: {
    type: String,
    required: true,
    enum: ["userModel", "gymModel"],
  },
  title: { type: String, required: true },
  description: String,
  category: { type: String, required: true },
  equipment: { type: String, required: true },

  brand: String,
  model: String,
  purchaseDate: Date,

  images: [String],
  contactNumber: { type: Number, required: true },

  condition: { type: String, enum: ["New", "Good", "Fair", "Old"] },

  type: { type: String, enum: ["rent", "sale", "both"], required: true },

  price: { type: Number, required: true }, // Common price or sale price

  negotiable: { type: Boolean, default: false },
  warrantyIncluded: { type: Boolean, default: false },
  warrantyTime: { type: String },
  gurrantyIncluded: { type: Boolean, default: false },
  gurrantyTime: { type: String },
  reasonForSale: { type: String },

  rental: {
    availableFrom: Date,
    availableUntil: Date,
    isAvailable: Boolean,
    minRentalPeriod: Number,
    maxRentalPeriod: Number,
    rentalPrice: Number,
    deposit: Number,
    maintenanceBy: { type: String, enum: ["Owner", "Renter"] },
  },

  location: {
    city: String,
    state: String,
    street: String,
  },

  status: {
    type: String,
    enum: ["active", "pending", "booked", "sold", "inactive"],
    default: "active",
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Automatically update `updatedAt` on save
EquipmentListingSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("EquipmentListing", EquipmentListingSchema);
