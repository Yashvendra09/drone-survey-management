import mongoose from 'mongoose';

const droneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  model: { type: String, required: true },
  status: { type: String, enum: ['available', 'in-mission', 'charging', 'maintenance'], default: 'available' },
  batteryLevel: { type: Number, min: 0, max: 100, default: 100 },
  lastMaintenance: { type: Date, default: Date.now },
  location: {
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 }
  },

  // ownership: which user created / owns this drone
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// Index for faster owner lookups
droneSchema.index({ createdBy: 1 });

export default mongoose.model('Drone', droneSchema);
