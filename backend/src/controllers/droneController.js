import Drone from '../models/drone.js';

// Get all drones
export const getDrones = async (req, res) => {
  try {
    const drones = await Drone.find();
    res.json(drones);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drones' });
  }
};

// Add a new drone
export const addDrone = async (req, res) => {
  try {
    const { name, model, status, batteryLevel, location } = req.body;
    const drone = await Drone.create({ name, model, status, batteryLevel, location });
    res.status(201).json(drone);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create drone' });
  }
};

// Update drone status
export const updateDroneStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status, batteryLevel, location } = req.body;
  
      const drone = await Drone.findByIdAndUpdate(
        id,
        { $set: { status, batteryLevel, location } }, // ensure $set
        { new: true, runValidators: true }
      );
  
      if (!drone) return res.status(404).json({ error: 'Drone not found' });
  
      res.json(drone);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update drone' });
    }
  };
  

// Delete a drone
export const deleteDrone = async (req, res) => {
  try {
    await Drone.findByIdAndDelete(req.params.id);
    res.json({ message: 'Drone deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete drone' });
  }
};
