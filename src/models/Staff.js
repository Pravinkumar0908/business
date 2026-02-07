// models/Staff.js
const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
  organization: {
    type: String,
    required: true,
    index: true
  },
  name: { type: String, required: true },
  role: { type: String },
  commissionRate: { type: Number, default: 0 }, // %
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Staff", staffSchema);
