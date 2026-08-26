import express from 'express';
import { getAllFilters, addFilter, deleteFilter, initializeDefaultFilters } from '../controllers/filterController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all filter options
router.get('/', getAllFilters);

// Add a new filter option
router.post('/', addFilter);

// Delete a filter option
router.delete('/:id', deleteFilter);

// Initialize default filters (one-time setup)
router.post('/initialize', initializeDefaultFilters);

export default router;
