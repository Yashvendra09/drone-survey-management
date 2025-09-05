import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  mission: { type: mongoose.Schema.Types.ObjectId, ref: 'Mission', required: true },
  drone: { type: mongoose.Schema.Types.ObjectId, ref: 'Drone', required: true },
  duration: { type: Number, required: true }, // Minutes
  distance: { type: Number, required: true }, // Meters
  coverage: { type: Number, required: true }, // Square meters
  notes: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
