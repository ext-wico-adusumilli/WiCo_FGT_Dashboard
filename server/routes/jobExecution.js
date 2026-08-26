import express from 'express';
import {
  getJobStatuses,
  getJobStatus,
  triggerJob,
  cancelJob,
  getJobExecutionHistory,
  getJobExecution,
  getJobMetrics,
  startJob,
  stopJob
} from '../controllers/jobExecutionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// All job execution routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// GET /job-execution/status - Get all job statuses
router.get('/status', getJobStatuses);

// GET /job-execution/status/:jobName - Get specific job status
router.get('/status/:jobName', getJobStatus);

// POST /job-execution/:jobName/trigger - Manually trigger job execution
router.post('/:jobName/trigger', triggerJob);

// POST /job-execution/:jobName/cancel - Cancel running job
router.post('/:jobName/cancel', cancelJob);

// POST /job-execution/:jobName/start - Start job (activate and schedule)
router.post('/:jobName/start', startJob);

// POST /job-execution/:jobName/stop - Stop job (deactivate and unschedule)
router.post('/:jobName/stop', stopJob);

// GET /job-execution/:jobName/history - Get job execution history
router.get('/:jobName/history', getJobExecutionHistory);

// GET /job-execution/:jobName/metrics - Get job metrics
router.get('/:jobName/metrics', getJobMetrics);

// GET /job-execution/execution/:executionId - Get specific execution details
router.get('/execution/:executionId', getJobExecution);

export default router;