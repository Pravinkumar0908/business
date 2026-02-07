// models/Appointment.js
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  organization: {
    type: String,
    required: true,
    index: true
  },
  customerName: { type: String, required: true },
  customerPhone: { type: String },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },

  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: true
  },

  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },

  status: {
    type: String,
    enum: ["booked", "completed", "cancelled", "no-show"],
    default: "booked"
  }

}, { timestamps: true });

appointmentSchema.index({ staff: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);

