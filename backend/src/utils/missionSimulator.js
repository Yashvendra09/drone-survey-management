// src/utils/missionSimulator.js
import dotenv from 'dotenv';
dotenv.config();

import Mission from '../models/Mission.js';
import Drone from '../models/drone.js';

const TICK_MS = Number(process.env.SIM_INTERVAL_MS || '1000');
const DRONE_SPEED_MPS = Number(process.env.SIM_SPEED_MPS || '8');
const BATTERY_DRAIN_PER_TICK = Number(process.env.SIM_DRAIN_PER_TICK || '0.15');

let ioRef = null;
const timers = new Map();

function distMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.max(0, s1 + s2)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPos(a, b, t, altA, altB) {
  return {
    lat: lerp(a.lat, b.lat, t),
    lng: lerp(a.lng, b.lng, t),
    alt: lerp(altA, altB, t),
  };
}

export function initSimulator(ioInstance) {
  ioRef = ioInstance;
}

/** Start or restart the ticker for a mission */
export async function startTickerForMission(missionId) {
  stopTicker(missionId); // ensure single timer

  const mission = await Mission.findById(missionId).populate('drone');
  if (!mission || !Array.isArray(mission.flightPath) || mission.flightPath.length < 2) return;

  mission.status = 'in-progress';
  mission.simIndex = mission.simIndex ?? 0;
  mission.simProgress = mission.simProgress ?? 0;
  await mission.save();

  const tick = async () => {
    try {
      const m = await Mission.findById(missionId).populate('drone');
      if (!m) return stopTicker(missionId);
      if (m.status !== 'in-progress') return; // do nothing until resumed

      const path = m.flightPath;
      if (!Array.isArray(path) || path.length < 2) return;

      const lastIdx = path.length - 1;
      m.simIndex = Math.max(0, Math.min(m.simIndex ?? 0, lastIdx - 1));
      const from = path[m.simIndex];
      const to = path[m.simIndex + 1] || path[m.simIndex];

      const altA = from.alt ?? from.altitude ?? m.parameters?.altitude ?? 50;
      const altB = to.alt ?? to.altitude ?? m.parameters?.altitude ?? 50;

      const segLen = Math.max(1, distMeters(from, to));
      const segDuration = Math.max(0.001, segLen / Math.max(0.001, DRONE_SPEED_MPS));
      const delta = TICK_MS / 1000 / segDuration;
      m.simProgress = (m.simProgress ?? 0) + delta;

      if (m.simProgress >= 1) {
        m.simProgress = 0;
        m.simIndex++;
      }

      const i = Math.min(m.simIndex, lastIdx - 1);
      const A = path[i];
      const B = path[i + 1] || A;
      const aA = A.alt ?? A.altitude ?? altA;
      const aB = B.alt ?? B.altitude ?? altB;
      const pos = lerpPos(A, B, m.simProgress, aA, aB);

      const overall = Math.min(99, Math.floor((i / lastIdx) * 100));
      m.progress = overall;

      if (m.simIndex >= lastIdx && m.simProgress >= 1) {
        m.status = 'completed';
        m.progress = 100;
        await Drone.findByIdAndUpdate(m.drone._id ?? m.drone, { status: 'available' });
        await m.save();
        if (ioRef) {
          ioRef.emit('missionProgress', {
            missionId: m._id,
            droneId: m.drone._id ?? m.drone,
            status: m.status,
            progress: m.progress,
            currentWaypoint: pos,
            battery: m.drone?.batteryLevel,
            speed: DRONE_SPEED_MPS,
          });
        }
        return stopTicker(missionId);
      }

      // update drone state
      const drone = await Drone.findById(m.drone._id ?? m.drone);
      const newBattery = Math.max(0, (drone?.batteryLevel ?? 100) - BATTERY_DRAIN_PER_TICK);
      await Drone.findByIdAndUpdate(m.drone._id ?? m.drone, {
        $set: { batteryLevel: newBattery, location: { lat: pos.lat, lng: pos.lng } },
      });

      await m.save();

      if (ioRef) {
        ioRef.emit('missionProgress', {
          missionId: m._id,
          droneId: m.drone._id ?? m.drone,
          status: m.status,
          progress: m.progress,
          currentWaypoint: pos,
          battery: newBattery,
          speed: DRONE_SPEED_MPS,
        });
      }
    } catch (err) {
      console.error('Ticker tick error:', err);
    }
  };

  const id = setInterval(tick, TICK_MS);
  timers.set(missionId, { id, paused: false });
}

export async function pauseTicker(missionId) {
  const mission = await Mission.findByIdAndUpdate(missionId, { status: 'paused' }, { new: true });
  const t = timers.get(missionId);
  if (t && !t.paused) {
    clearInterval(t.id);
    timers.set(missionId, { ...t, paused: true });
  }
  return mission;
}

export async function resumeTicker(missionId) {
  const mission = await Mission.findByIdAndUpdate(missionId, { status: 'in-progress' }, { new: true });
  const t = timers.get(missionId);
  if (t && t.paused) {
    clearInterval(t.id);
    timers.delete(missionId);
  }
  await startTickerForMission(missionId);
  return mission;
}

export async function abortTicker(missionId) {
  const mission = await Mission.findByIdAndUpdate(
    missionId,
    { status: 'aborted', progress: 0, simIndex: 0, simProgress: 0 },
    { new: true }
  );
  stopTicker(missionId);
  if (mission?.drone) {
    await Drone.findByIdAndUpdate(mission.drone._id ?? mission.drone, { status: 'available' });
  }
  return mission;
}

function stopTicker(missionId) {
  const t = timers.get(missionId);
  if (t) {
    clearInterval(t.id);
    timers.delete(missionId);
  }
}
