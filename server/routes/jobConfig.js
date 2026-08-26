import express from 'express';
import {
  getJobConfigurations,
  getJobConfiguration,
  createJobConfiguration,
  updateJobConfiguration,
  deleteJobConfiguration,
  activateJobConfiguration,
  deactivateJobConfiguration,
  updateJobSchedule
} from '../controllers/jobConfigController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

// All job configuration routes require authentication and admin privileges
router.use(authenticateToken);
router.use(requireAdmin);

// GET /job-config - Get all job configurations
router.get('/', getJobConfigurations);

// GET /job-config/:jobName - Get specific job configuration
router.get('/:jobName', getJobConfiguration);

// POST /job-config - Create new job configuration
router.post('/', createJobConfiguration);

// PUT /job-config/:jobName - Update job configuration
router.put('/:jobName', updateJobConfiguration);

// DELETE /job-config/:jobName - Delete job configuration
router.delete('/:jobName', deleteJobConfiguration);

// POST /job-config/:jobName/activate - Activate job configuration
router.post('/:jobName/activate', activateJobConfiguration);

// POST /job-config/:jobName/deactivate - Deactivate job configuration
router.post('/:jobName/deactivate', deactivateJobConfiguration);

// PUT /job-config/:jobName/schedule - Update job schedule
router.put('/:jobName/schedule', updateJobSchedule);

export default router;