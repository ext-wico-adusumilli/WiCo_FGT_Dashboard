import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getDashboardStats,
  getChartData,
  getAllChartData
} from '../controllers/snOverviewController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Dashboard and chart data routes
router.get('/dashboard-stats', getDashboardStats);
router.get('/chart-data', getChartData);
router.get('/chart-data/bulk', getAllChartData);

// SN Overview routes
router.get('/', getAllEntries);
router.post('/', createEntry);
router.put('/:entryId', updateEntry);
router.delete('/:entryId', deleteEntry);

export default router;
