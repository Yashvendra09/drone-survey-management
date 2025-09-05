// src/scripts/resetDB.js
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Drone from '../models/drone.js';
import Mission from '../models/Mission.js';

async function resetDB() {
  try {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Resetting drones...');
    await Drone.updateMany({}, { $set: { status: 'available', batteryLevel: 100 } });

    console.log('Resetting missions...');
    await Mission.updateMany({}, { $set: { status: 'planned', progress: 0, simIndex: 0, simProgress: 0 } });

    console.log('✔ Database reset complete');
    process.exit(0);
  } catch (err) {
    console.error('✖ Reset failed:', err);
    process.exit(1);
  }
}

resetDB();
