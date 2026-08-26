import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { 
  getLTEConnectivityOverview,
  getLTEConnectivityDashboardStats,
  getLTEConnectivityPaginated,
  getLTEConnectivitySummary, 
  getLTEConnectivityTrends 
} from '../controllers/lteConnectivityController.js';

const router = express.Router();

// Get LTE connectivity dashboard stats (fast aggregation)
router.get('/dashboard-stats', authMiddleware, getLTEConnectivityDashboardStats);

// Get LTE connectivity paginated data (for table)
router.get('/paginated', authMiddleware, getLTEConnectivityPaginated);

// Get LTE connectivity overview (optimized) - DEPRECATED
router.get('/', authMiddleware, getLTEConnectivityOverview);

// Get LTE analysis summary statistics
router.get('/summary', authMiddleware, getLTEConnectivitySummary);

// Get LTE connectivity trends over time
router.get('/trends', authMiddleware, getLTEConnectivityTrends);

export default router;