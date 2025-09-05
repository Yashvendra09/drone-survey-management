import express from 'express';
import { getReports, createReport, getAnalytics } from '../controllers/reportController.js';

const router = express.Router();

router.get('/', getReports);
router.post('/', createReport);
router.get('/analytics', getAnalytics);

export default router;
