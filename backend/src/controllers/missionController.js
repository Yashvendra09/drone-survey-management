// backend/src/controllers/missionController.js
import Mission from '../models/Mission.js';
import Drone from '../models/drone.js';
import { startTickerForMission, pauseTicker, resumeTicker } from '../utils/missionSimulator.js';

/**
 * Normalize incoming pattern values to canonical internal values.
 * Accepts 'lawnmower' from older frontends and maps to 'grid' internally.
 */
const normalizePattern = (p) => {
  if (!p) return 'grid';
  const s = String(p).toLowerCase().trim();
  if (s === 'lawnmower' || s === 'grid' || s === 'mower') return 'grid';
  if (s === 'crosshatch' || s === 'cross') return 'crosshatch';
  if (s === 'perimeter' || s === 'edge' || s === 'outline') return 'perimeter';
  // fallback to grid
  return 'grid';
};

// Get all missions
export const getMissions = async (req, res) => {
  try {
    const missions = await Mission.find().populate('drone');
    res.json(missions);
  } catch (error) {
    console.error('getMissions error:', error);
    res.status(500).json({ error: 'Failed to fetch missions' });
  }
};

// Create a mission — tolerant mapper for waypoint field names + clearer validation
export const createMission = async (req, res) => {
  try {
    // require authenticated user
    const userId = req.user && (req.user.id ?? req.user._id);
    // Optional role check: if a role exists and it's explicitly a non-creator role, reject.
    // Adjust roles as needed for your app ('viewer' used here as an example).
    const userRole = req.user && req.user.role;

    if (!userId) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    if (userRole && userRole === 'viewer') {
      return res.status(403).json({ error: 'Insufficient role to create missions' });
    }

    const {
      name,
      drone,
      areaCoordinates,
      flightPath,
      altitude,
      overlap,
      pattern,
      sensors,
      swathWidth,
    } = req.body;

    // Basic validation: flightPath must be an array
    if (!Array.isArray(flightPath)) {
      return res.status(400).json({ error: 'flightPath must be an array of waypoints' });
    }
    if (flightPath.length === 0) {
      return res.status(400).json({ error: 'flightPath contains no waypoints' });
    }

    // Normalize areaCoordinates into objects with numbers (defensive)
    const normalizedArea = (areaCoordinates || []).map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const lat = Number(pt[0]), lng = Number(pt[1]);
        return { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null };
      }
      if (pt && typeof pt === 'object') {
        const lat = Number(pt.lat ?? pt.latitude ?? pt[0]);
        const lng = Number(pt.lng ?? pt.longitude ?? pt[1]);
        return { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null };
      }
      return { lat: null, lng: null };
    }).filter(p => p.lat !== null && p.lng !== null);

    // Validate and map waypoints
    const mappedFlightPath = [];
    for (let i = 0; i < flightPath.length; i++) {
      const wp = flightPath[i] || {};
      let lat = wp.lat ?? wp.latitude ?? (Array.isArray(wp) ? wp[0] : undefined);
      let lng = wp.lng ?? wp.longitude ?? (Array.isArray(wp) ? wp[1] : undefined);
      let alt = wp.alt ?? wp.altitude ?? (Array.isArray(wp) ? wp[2] : undefined) ?? altitude ?? 50;

      lat = Number(lat);
      lng = Number(lng);
      alt = Number(alt);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(422).json({
          error: `Invalid waypoint at index ${i}: expected finite lat/lng.`,
          waypoint: wp,
          index: i,
        });
      }

      mappedFlightPath.push({
        lat,
        lng,
        altitude: alt,
        alt,
        order: i,
      });
    }

    // Normalize pattern and set both top-level and parameters.pattern
    const canonicalPattern = normalizePattern(pattern);

    // Build mission document
    const missionDoc = {
      name,
      drone,
      areaCoordinates: normalizedArea,
      flightPath: mappedFlightPath,
      pattern: canonicalPattern, // top-level convenience
      parameters: {
        altitude: altitude ?? 50,
        overlap: overlap ?? 20,
        pattern: canonicalPattern,
        sensors: sensors ?? ['camera'],
        frequency: 1,
        swathWidth: swathWidth ?? undefined,
      },
      status: 'planned',
      progress: 0,
      simIndex: 0,
      simProgress: 0,
      // New fields per request
      createdBy: userId,
      createdAt: new Date(),
    };

    // Create mission and handle mongoose validation errors explicitly
    try {
      const mission = await Mission.create(missionDoc);

      if (drone) {
        try {
          await Drone.findByIdAndUpdate(drone, { status: 'in-mission' });
        } catch (err) {
          console.warn('Failed to set drone status after mission create:', err);
        }
      }

      return res.status(201).json(mission);
    } catch (createErr) {
      console.error('Mission.create failed:', createErr && createErr.stack ? createErr.stack : createErr);
      if (createErr.name === 'ValidationError') {
        return res.status(422).json({ error: 'ValidationError', details: createErr.errors });
      }
      return res.status(500).json({ error: 'Mission creation failed', detail: createErr.message });
    }
  } catch (error) {
    console.error('createMission top-level error:', error && error.stack ? error.stack : error);
    return res.status(500).json({ error: error.message || 'Failed to create mission' });
  }
};

// Update mission
export const updateMission = async (req, res) => {
  try {
    const { id } = req.params;
    // allow runValidators
    const mission = await Mission.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    if (req.body.status === 'completed' || req.body.status === 'aborted') {
      try {
        await Drone.findByIdAndUpdate(mission.drone, { status: 'available' });
      } catch (err) {
        console.warn('Failed to set drone available on mission update:', err);
      }
    }
    res.json(mission);
  } catch (error) {
    console.error('updateMission error:', error);
    res.status(500).json({ error: 'Failed to update mission' });
  }
};

// Delete mission
export const deleteMission = async (req, res) => {
  try {
    await Mission.findByIdAndDelete(req.params.id);
    res.json({ message: 'Mission deleted' });
  } catch (error) {
    console.error('deleteMission error:', error);
    res.status(500).json({ error: 'Failed to delete mission' });
  }
};

// Pause mission
export const pauseMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.status !== 'in-progress') return res.status(400).json({ error: 'Mission not in progress' });

    mission.status = 'paused';
    await mission.save();
    pauseTicker(mission._id.toString());
    res.json(mission);
  } catch (error) {
    console.error('pauseMission error:', error);
    res.status(500).json({ error: 'Failed to pause mission' });
  }
};

// Resume mission
export const resumeMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id).populate('drone');
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.status !== 'paused') return res.status(400).json({ error: 'Mission not paused' });

    mission.status = 'in-progress';
    await mission.save();

    const droneId = mission.drone && mission.drone._id ? mission.drone._id : mission.drone;
    if (droneId) {
      try {
        await Drone.findByIdAndUpdate(droneId, { status: 'in-mission' });
      } catch (err) {
        console.warn('Failed to set drone in-mission on resume:', err);
      }
    }

    resumeTicker(mission._id.toString());
    res.json(mission);
  } catch (error) {
    console.error('resumeMission error:', error);
    res.status(500).json({ error: 'Failed to resume mission' });
  }
};

// Abort mission
export const abortMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    mission.status = 'aborted';
    mission.progress = 0;
    mission.simIndex = 0;
    mission.simProgress = 0;
    await mission.save();
    await Drone.findByIdAndUpdate(mission.drone, { status: 'available' });
    pauseTicker(mission._id.toString());
    res.json(mission);
  } catch (error) {
    console.error('abortMission error:', error);
    res.status(500).json({ error: 'Failed to abort mission' });
  }
};

// Start mission
export const startMission = async (req, res) => {
  try {
    const mission = await Mission.findById(req.params.id).populate('drone');
    if (!mission) return res.status(404).json({ error: 'Mission not found' });
    if (mission.status !== 'planned') {
      return res.status(400).json({ error: `Mission already ${mission.status}` });
    }

    mission.status = 'in-progress';
    mission.progress = 0;
    mission.simIndex = 0;
    mission.simProgress = 0;
    await mission.save();

    const droneId = mission.drone && mission.drone._id ? mission.drone._id : mission.drone;
    if (droneId) {
      await Drone.findByIdAndUpdate(droneId, { status: 'in-mission' });
    }

    await startTickerForMission(mission._id.toString());

    res.json({ message: 'Mission started', mission });
  } catch (error) {
    console.error('Failed to start mission', error);
    res.status(500).json({ error: 'Failed to start mission' });
  }
};
export default {
  createMission,
  // add other exports here
};