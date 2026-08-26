import express from 'express';
import * as weatherDataController from '../controllers/weatherDataController.js';
import * as weatherDataControllerSimple from '../controllers/weatherDataControllerSimple.js';
import WeatherData from '../models/WeatherData.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET all entries with filtering and pagination
router.get('/', weatherDataController.getAllEntries);

// NEW OPTIMIZED ENDPOINTS (SIMPLIFIED)
// GET dashboard stats with caching
router.get('/dashboard-stats', weatherDataControllerSimple.getDashboardStats);

// GET paginated data with server-side filtering/sorting
router.get('/paginated', weatherDataControllerSimple.getPaginatedData);

// GET filter options with caching
router.get('/filter-options', weatherDataControllerSimple.getFilterOptions);

// GET chart data for Flight Hours vs Weather Conditions
router.get('/chart-data', weatherDataControllerSimple.getChartData);

// GET ALL chart data for preloading (OPTIMIZED BULK ENDPOINT)
router.get('/chart-data/bulk', weatherDataControllerSimple.getAllChartData);

// GET raw weather data for frontend processing
router.get('/raw-data', weatherDataControllerSimple.getRawWeatherData);

// GET log details for frontend processing
router.get('/log-details', weatherDataControllerSimple.getLogDetails);

// GET cache stats (for monitoring)
router.get('/cache/stats', weatherDataControllerSimple.getCacheStats);

// DELETE clear cache (for admin)
router.delete('/cache/clear', weatherDataControllerSimple.clearCache);

// DEBUG: Test location filtering
router.get('/test-location-filtering', weatherDataControllerSimple.testLocationFiltering);

// EXISTING ENDPOINTS
// GET weather statistics
router.get('/stats', weatherDataController.getWeatherStats);

// GET legacy weather statistics (backward compatibility)
router.get('/stats/legacy', weatherDataController.getWeatherStatsLegacy);

// GET unique locations
router.get('/locations', weatherDataController.getUniqueLocations);

// TEST ENDPOINT (remove in production)
router.get('/test-dashboard', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date() });
});

// SIMPLE TEST FOR DASHBOARD STATS
router.get('/test-dashboard-simple', async (req, res) => {
  try {
    console.log('Simple dashboard test called');
    console.log('User from auth:', req.user);
    
    const count = await WeatherData.countDocuments({});
    const sample = await WeatherData.findOne({}).lean();
    
    res.json({ 
      message: 'Simple dashboard test working',
      totalCount: count,
      sampleData: sample ? {
        id: sample._id,
        uaSN: sample.uaSN,
        temperature: sample.temperature,
        pressure: sample.pressure,
        humidity: sample.humidity
      } : null,
      timestamp: new Date() 
    });
  } catch (error) {
    console.error('Simple dashboard test error:', error);
    res.status(500).json({ message: 'Simple dashboard test error', error: error.message });
  }
});

// TEST WEATHER DATA MODEL
router.get('/test-model', async (req, res) => {
  try {
    const count = await WeatherData.countDocuments({});
    const sample = await WeatherData.findOne({}).lean();
    res.json({ 
      message: 'WeatherData model working', 
      count, 
      sampleFields: sample ? Object.keys(sample) : [],
      timestamp: new Date() 
    });
  } catch (error) {
    res.status(500).json({ message: 'WeatherData model error', error: error.message });
  }
});

// GET single entry by ID
router.get('/:id', weatherDataController.getEntryById);

// POST create new entry
router.post('/', weatherDataController.createEntry);

// PUT update entry
router.put('/:id', weatherDataController.updateEntry);

// DELETE entry
router.delete('/:id', weatherDataController.deleteEntry);

export default router;
