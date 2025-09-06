import Drone from '../models/drone.js';

// Helper to build owner filter (admin sees all)
function ownerFilter(req) {
  if (!req.user) return {}; // defensive
  if (req.user.role === 'admin') return {};
  return { createdBy: req.user.id };
}

// Get all drones (only user's drones unless admin)
export const getDrones = async (req, res) => {
  try {
    const filter = ownerFilter(req);
    const drones = await Drone.find(filter);
    res.json(drones);
  } catch (error) {
    console.error('getDrones error:', error);
    res.status(500).json({ error: 'Failed to fetch drones' });
  }
};

// Add a new drone (owned by current user)
export const addDrone = async (req, res) => {
  try {
    const { name, model, status, batteryLevel, location } = req.body;
    const createdBy = req.user && (req.user.id ?? req.user._id);
    if (!createdBy) return res.status(403).json({ error: 'Not allowed' });

    const drone = await Drone.create({ name, model, status, batteryLevel, location, createdBy });
    res.status(201).json(drone);
  } catch (error) {
    console.error('addDrone error:', error);
    res.status(500).json({ error: 'Failed to create drone' });
  }
};

// Update drone status (only owner or admin)
export const updateDroneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, batteryLevel, location } = req.body;

    // ensure user owns the drone unless admin
    const filter = { _id: id, ...(req.user.role !== 'admin' ? { createdBy: req.user.id } : {}) };

    const drone = await Drone.findOneAndUpdate(
      filter,
      { $set: { status, batteryLevel, location } },
      { new: true, runValidators: true }
    );

    if (!drone) return res.status(404).json({ error: 'Drone not found or not permitted' });

    res.json(drone);
  } catch (error) {
    console.error('updateDroneStatus error:', error);
    res.status(500).json({ error: 'Failed to update drone' });
  }
};

// Delete a drone (only owner or admin)
export const deleteDrone = async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: id, ...(req.user.role !== 'admin' ? { createdBy: req.user.id } : {}) };

    const drone = await Drone.findOneAndDelete(filter);
    if (!drone) return res.status(404).json({ error: 'Drone not found or not permitted' });

    res.json({ message: 'Drone deleted' });
  } catch (error) {
    console.error('deleteDrone error:', error);
    res.status(500).json({ error: 'Failed to delete drone' });
  }
};
