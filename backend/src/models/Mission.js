// backend/src/models/Mission.js
import mongoose from 'mongoose';

const flightPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    altitude: { type: Number }, // canonical altitude
    alt: { type: Number }, 
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const missionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // mission may require an assigned drone
    drone: { type: mongoose.Schema.Types.ObjectId, ref: 'Drone', required: true },

    // Survey polygon
    areaCoordinates: [{ lat: Number, lng: Number }],

    // ordered waypoints
    flightPath: [flightPointSchema],

    // top-level pattern 
    pattern: { type: String, enum: ['grid', 'lawnmower', 'crosshatch', 'perimeter'], default: 'grid' },

    status: {
      type: String,
      enum: ['planned', 'in-progress', 'paused', 'completed', 'aborted'],
      default: 'planned',
    },

    parameters: {
      altitude: { type: Number, default: 50 },
      overlap: { type: Number, default: 20 },
      // Accept both canonical and common alias to avoid create-time validation issues.
      pattern: { type: String, enum: ['grid', 'lawnmower', 'crosshatch', 'perimeter'], default: 'grid' },
      sensors: { type: [String], default: ['camera'] },
      frequency: { type: Number, default: 1 },
      swathWidth: { type: Number },
    },

    progress: { type: Number, default: 0 },
    estimatedTime: { type: Number, default: 0 },

    // Persist simulation state for workers / simulator to resume reliably
    simIndex: { type: Number, default: 0 },
    simProgress: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Mission', missionSchema);
