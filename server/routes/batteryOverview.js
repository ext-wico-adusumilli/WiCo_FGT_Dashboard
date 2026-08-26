import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  getAllEntries,
  createEntry,
  updateEntry,
  deleteEntry
} from '../controllers/batteryOverviewController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Battery Overview routes
router.get('/', getAllEntries);
router.post('/', createEntry);
router.put('/:entryId', updateEntry);
router.delete('/:entryId', deleteEntry);

export default router;
