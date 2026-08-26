/**
 * Ingestion Routes
 * Mounted at /api/ingestion in server.js
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getJobs,
  getJob,
  getSummary,
  triggerScan,
  startSchedulerEndpoint,
  stopSchedulerEndpoint,
  getSchedulerStatus,
  getAzcopyJobs,
  getAzcopyJobDetails,
} from '../controllers/ingestionController.js';

const router = Router();

// All ingestion routes require a valid JWT
router.use(authenticateToken);

// Job history & details
router.get('/jobs', getJobs);
router.get('/jobs/:jobId', getJob);

// Dashboard summary stats
router.get('/summary', getSummary);

// Manual trigger
router.post('/run', triggerScan);

// Scheduler management
router.get('/scheduler/status', getSchedulerStatus);
router.post('/scheduler/start', startSchedulerEndpoint);
router.post('/scheduler/stop', stopSchedulerEndpoint);

// Raw azcopy job introspection
router.get('/azcopy/jobs', getAzcopyJobs);
router.get('/azcopy/jobs/:azcopyJobId', getAzcopyJobDetails);

export default router;

