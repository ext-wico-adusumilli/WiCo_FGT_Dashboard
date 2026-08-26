import express from 'express';
import {
  getAllDataFreshness,
  getDataTypeFreshness,
  getFreshnessMetadata,
  checkDataFreshness,
  getDataAgeByGranularity,
  getHealthCheckIndicators,
  getFreshnessThresholds,
  updateFreshnessThresholds
} from '../controllers/dataFreshnessController.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// Public health check endpoint (no auth required)
router.get('/health', getHealthCheckIndicators);

// Protected endpoints (require authentication)
router.use(authMiddleware);

// Get freshness status for all data types
router.get('/', getAllDataFreshness);

// Get freshness status for specific data type
router.get('/:dataType', getDataTypeFreshness);

// Get freshness metadata for dashboard responses
router.get('/:dataType/metadata', getFreshnessMetadata);

// Check if data is fresh
router.get('/:dataType/check', checkDataFreshness);

// Get data age by granularity for specific entity
router.get('/:dataType/age/:entityId', getDataAgeByGranularity);

// Get current freshness thresholds configuration
router.get('/config/thresholds', getFreshnessThresholds);

// Admin-only endpoints
router.use(isAdmin);

// Update freshness thresholds (admin only)
router.put('/config/thresholds', updateFreshnessThresholds);

export default router;