import express from 'express';
import {
  getMissions,
  createMission,
  updateMission,
  deleteMission,
  pauseMission,
  resumeMission,
  abortMission,
  startMission
} from '../controllers/missionController.js';

const router = express.Router();

router.get('/', getMissions);
router.post('/', createMission);
router.put('/:id', updateMission);
router.delete('/:id', deleteMission);

router.post('/:id/start', startMission);
router.patch('/:id/pause', pauseMission);
router.patch('/:id/resume', resumeMission);
router.patch('/:id/abort', abortMission);

export default router;
