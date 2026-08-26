import express from 'express';
import { getOperationTypeAnalysis, getOperationTypeSummary } from '../controllers/operationTypeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/analysis', authenticateToken, getOperationTypeAnalysis);
router.get('/summary', authenticateToken, getOperationTypeSummary);

export default router;
