import express from 'express';
import * as weatherDataController from '../controllers/weatherDataController.js';

const router = express.Router();

// Test routes without authentication for development
// Remove these in production!

// GET dashboard stats with caching
router.get('/dashboard-stats', weatherDataController.getDashboardStats);

// GET paginated data with server-side filtering/sorting
router.get('/paginated', weatherDataController.getPaginatedData);

// GET filter options with caching
router.get('/filter-options', weatherDataController.getFilterOptions);

// GET cache stats (for monitoring)
router.get('/cache/stats', weatherDataController.getCacheStats);

// DELETE clear cache (for admin)
router.delete('/cache/clear', weatherDataController.clearCache);

export default router;