// models/Service.js
const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  organization: {
    type: String,
    required: true,
    index: true
  },
  name: { type: String, required: true },
  duration: { type: Number, required: true }, // in minutes
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Service", serviceSchema);
