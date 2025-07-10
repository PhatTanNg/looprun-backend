const mongoose = require('mongoose');

const runSchema = new mongoose.Schema({
  userId: { type: String }, // Optional for now
  distanceKm: { type: Number, required: true },
  durationMin: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  coordinates: [{ lat: Number, lng: Number }]
});

module.exports = mongoose.model('Run', runSchema);
