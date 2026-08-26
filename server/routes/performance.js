import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/adminAuth.js';
import {
  getMetrics,
  getStats,
  getAlerts,
  getReport,
  clearMetrics
} from '../controllers/performanceController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route GET /performance/metrics
 * @desc Get current performance metrics
 * @access Private (Admin only)
 */
router.get('/metrics', isAdmin, getMetrics);

/**
 * @route GET /performance/stats
 * @desc Get performance statistics summary
 * @access Private (Admin only)
 */
router.get('/stats', isAdmin, getStats);

/**
 * @route GET /performance/alerts
 * @desc Get performance alerts
 * @query limit - Number of alerts to return (default: 50)
 * @access Private (Admin only)
 */
router.get('/alerts', isAdmin, getAlerts);

/**
 * @route GET /performance/report
 * @desc Get performance report for a time range
 * @query startTime - Start time (ISO string)
 * @query endTime - End time (ISO string)
 * @access Private (Admin only)
 */
router.get('/report', isAdmin, getReport);

/**
 * @route DELETE /performance/metrics
 * @desc Clear performance metrics
 * @access Private (Admin only)
 */
router.delete('/metrics', isAdmin, clearMetrics);

export default router;