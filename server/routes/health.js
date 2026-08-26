import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';
import {
  getBasicHealth,
  getDetailedHealth,
  getJobsHealth,
  getDataFreshnessHealth,
  getSystemHealth,
  getComprehensiveHealth
} from '../controllers/healthController.js';

const router = express.Router();

/**
 * @route GET /health
 * @desc Basic health check (public)
 * @access Public
 */
router.get('/', getBasicHealth);

/**
 * @route GET /health/detailed
 * @desc Detailed health check with system metrics
 * @access Private (Admin only)
 */
router.get('/detailed', authMiddleware, isAdmin, getDetailedHealth);

/**
 * @route GET /health/jobs
 * @desc Job status monitoring
 * @access Private (Admin only)
 */
router.get('/jobs', authMiddleware, isAdmin, getJobsHealth);

/**
 * @route GET /health/data-freshness
 * @desc Data freshness status
 * @access Private (Admin only)
 */
router.get('/data-freshness', authMiddleware, isAdmin, getDataFreshnessHealth);

/**
 * @route GET /health/system
 * @desc System health indicators (CPU, memory, etc.)
 * @access Private (Admin only)
 */
router.get('/system', authMiddleware, isAdmin, getSystemHealth);

/**
 * @route GET /health/comprehensive
 * @desc Comprehensive health check combining all components
 * @access Private (Admin only)
 */
router.get('/comprehensive', authMiddleware, isAdmin, getComprehensiveHealth);

export default router;