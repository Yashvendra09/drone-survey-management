import express from 'express';
import { getDrones, addDrone, updateDroneStatus, deleteDrone } from '../controllers/droneController.js';

const router = express.Router();

router.get('/', getDrones);
router.post('/', addDrone);
router.put('/:id', updateDroneStatus);
router.delete('/:id', deleteDrone);

export default router;
