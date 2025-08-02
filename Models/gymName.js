const mongoose = require("mongoose");

// Define the schema
const gymnameSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true
    }
});

// Define the model
const gymnameModel = mongoose.model("gymnameModel", gymnameSchema);

module.exports = gymnameModel;
