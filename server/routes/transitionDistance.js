import express from 'express';
import * as transitionDistanceController from '../controllers/transitionDistanceController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET all entries
router.get('/', transitionDistanceController.getAllEntries);

// GET test data
router.get('/test/data', transitionDistanceController.testData);

// GET single entry by ID
router.get('/:id', transitionDistanceController.getEntryById);

// POST create new entry
router.post('/', transitionDistanceController.createEntry);

// PUT update entry
router.put('/:id', transitionDistanceController.updateEntry);

// DELETE entry
router.delete('/:id', transitionDistanceController.deleteEntry);

export default router;
