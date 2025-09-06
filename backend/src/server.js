// backend/src/server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
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

// Allow a list of exact origins from env FRONTEND_ORIGINS (comma-separated).
// If FRONTEND_ORIGINS is not set, allow same-origin requests.
const FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS
  ? process.env.FRONTEND_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : null;

const corsOptions = {
  origin: (origin, callback) => {
    // If no origin (e.g. curl, server-to-server) allow
    if (!origin) return callback(null, true);
    if (!FRONTEND_ORIGINS) {
      // If not configured, allow the request but log a message in non-prod
      return callback(null, true);
    }
    if (FRONTEND_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsers (increase limits for big mission payloads)
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Mount auth routes first (public)
app.use('/api/auth', authRoutes);

// Protect /api/* with JWT middleware
app.use('/api', authMiddleware);

// Protected API routes
app.use('/api/drones', droneRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/reports', reportRoutes);

// Serve frontend static files if they exist
// Expect frontend built output to be at ../frontend/dist or ../frontend/build
const clientDistPaths = [
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), 'frontend', 'build'),
  path.join(process.cwd(), 'public'),
];

let servedClient = false;
for (const p of clientDistPaths) {
  try {
    // require('fs').accessSync(p) would throw if not present; but keep try/catch simple
    app.use(express.static(p));
    // fallback to index.html for SPA routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(p, 'index.html'), err => {
        if (err) next();
      });
    });
    servedClient = true;
    break;
  } catch (e) {
    // ignore and try next path
  }
}

// Heartbeat if frontend isn't served
if (!servedClient) {
  app.get('/', (req, res) => {
    res.json({ message: 'Drone Survey API Running' });
  });
}

const PORT = process.env.PORT || 5000;

(async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB(process.env.MONGO_URI);
    console.log('MongoDB connected');

    // HTTP + Socket.IO
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: {
        origin: FRONTEND_ORIGINS || (process.env.FRONTEND_ORIGIN || '*'),
        methods: ['GET', 'POST'],
        credentials: true,
      },
      // if you need specific transports you can set them
      transports: ['websocket', 'polling'],
    });

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

    // Init simulator with the socket instance
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
