import express from 'express';
import * as logDetailController from '../controllers/logDetailController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all log details with filtering and pagination
router.get('/', logDetailController.getAllLogDetails);

// Get log details statistics
router.get('/stats', logDetailController.getLogDetailsStats);

// Get dashboard statistics (optimized)
router.get('/dashboard-stats', logDetailController.getLogDetailsDashboardStats);

// Get unique serial numbers
router.get('/serial-numbers', logDetailController.getUniqueSerialNumbers);

// Get log detail by ID
router.get('/:id', logDetailController.getLogDetailById);

// Create new log detail
router.post('/', logDetailController.createLogDetail);

// Bulk create log details
router.post('/bulk', logDetailController.bulkCreateLogDetails);

// Update log detail
router.put('/:id', logDetailController.updateLogDetail);

// Delete log detail
router.delete('/:id', logDetailController.deleteLogDetail);

export default router;
