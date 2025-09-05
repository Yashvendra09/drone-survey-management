// src/config/db.js
import mongoose from 'mongoose';

const connectDB = async (uri) => {
  const mongoUri = uri || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI not provided to connectDB');
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message || err);
    // rethrow so caller can decide (server.js currently exits)
    throw err;
  }
};

export default connectDB;
