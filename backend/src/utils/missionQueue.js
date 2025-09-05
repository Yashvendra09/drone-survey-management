// src/utils/missionQueue.js
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import Mission from '../models/Mission.js';
import Drone from '../models/drone.js';

const connection = new IORedis(process.env.REDIS_URL || undefined);

export const missionQueue = new Queue('missionQueue', { connection });

export const startMissionWorker = (io) => {
  new Worker(
    'missionQueue',
    async (job) => {
      const { missionId } = job.data;
      const mission = await Mission.findById(missionId).populate('drone');
      if (!mission || mission.status !== 'in-progress') return;

      if (typeof mission.simIndex !== 'number') mission.simIndex = 0;
      if (typeof mission.simProgress !== 'number') mission.simProgress = 0;

      const path = mission.flightPath;
      if (!Array.isArray(path) || path.length < 2) return;

      const from = path[mission.simIndex] ?? path[0];
      const to = path[mission.simIndex + 1] ?? from;

      mission.simProgress += 0.1;
      if (mission.simProgress > 1) {
        mission.simProgress = 0;
        mission.simIndex++;
      }

      if (mission.simIndex >= path.length - 1) {
        mission.status = 'completed';
        mission.progress = 100;
        await Drone.findByIdAndUpdate(mission.drone._id ?? mission.drone, { status: 'available' });
      } else {
        mission.progress = Math.floor((mission.simIndex / (path.length - 1)) * 100);
      }

      const currentPosition = {
        lat: from.lat + ((to.lat - from.lat) * mission.simProgress),
        lng: from.lng + ((to.lng - from.lng) * mission.simProgress),
        alt: (from.alt ?? from.altitude ?? 0) + ((to.alt ?? to.altitude ?? 0) - (from.alt ?? from.altitude ?? 0)) * mission.simProgress,
      };

      await mission.save();

      io?.emit?.('missionProgress', {
        missionId: mission._id,
        droneId: mission.drone._id ?? mission.drone,
        status: mission.status,
        progress: mission.progress,
        currentWaypoint: currentPosition,
      });
    },
    { connection }
  );
};
