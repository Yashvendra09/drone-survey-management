// backend/src/server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import droneRoutes from './routes/droneRoutes.js';
import missionRoutes from './routes/missionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/auth.js';
import authMiddleware from './middleware/authMiddleware.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initSimulator } from './utils/missionSimulator.js';

const app = express();

// CORS: allow your frontend origin in production (adjust)
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*'
}));

// Body parsers (increase limits for big mission payloads)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Dev helper: log incoming Content-Length for debugging
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const cl = req.headers['content-length'];
    if (cl) console.log(`[dev] ${req.method} ${req.path} - Content-Length: ${cl} bytes`);
    next();
  });
}

/**
 * AUTH (public)
 * Mount auth routes first. /api/auth/* remains public so users can register/login.
 */
app.use('/api/auth', authRoutes);

/**
 * GLOBAL AUTH MIDDLEWARE
 * Protect everything under /api (except /api/auth which was mounted above).
 * Any request to /api/* will pass through authMiddleware now.
 */
app.use('/api', authMiddleware);

/**
 * Protected API routes (now behind authMiddleware)
 * These routes become accessible only with a valid Authorization: Bearer <token>
 */
app.use('/api/drones', droneRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/reports', reportRoutes);

/**
 * Public base route (non-API) — keep as heartbeat/open endpoint
 * If you also host the frontend from this server and want the UI protected
 * at the server level, tell me and I'll show the static serving + middleware version.
 */
app.get('/', (req, res) => {
  res.json({ message: 'Drone Survey API Running' });
});

const PORT = process.env.PORT || 5000;

(async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // HTTP + Socket.IO
    const httpServer = createServer(app);
    const io = new Server(httpServer, { cors: { origin: process.env.FRONTEND_ORIGIN || '*' } });

    // Socket handlers
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('pauseMission', (missionId) => {
        io.emit('missionControl', { missionId, action: 'pause' });
      });

      socket.on('resumeMission', (missionId) => {
        io.emit('missionControl', { missionId, action: 'resume' });
      });

      socket.on('abortMission', (missionId) => {
        io.emit('missionControl', { missionId, action: 'abort' });
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    // Init simulator
    initSimulator(io);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
})();
