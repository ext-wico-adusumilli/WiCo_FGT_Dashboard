import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getSNOverview,
  getBatteryOverview,
  getFCVersionOverview,
  getCSVersionOverview,
  getFCVersionDashboardStats,
  getCSVersionDashboardStats
} from '../controllers/generalOverviewController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Aggregated data endpoints
router.get('/sn-overview', getSNOverview);
router.get('/battery-overview', getBatteryOverview);
router.get('/fc-version', getFCVersionOverview);
router.get('/cs-version', getCSVersionOverview);

// Dashboard stats endpoints
router.get('/fc-version-stats', getFCVersionDashboardStats);
router.get('/cs-version-stats', getCSVersionDashboardStats);

export default router;
