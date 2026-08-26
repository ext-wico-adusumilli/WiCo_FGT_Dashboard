import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getConfig, getRuns, triggerRun, getRunById } from '../controllers/blobSyncController.js';

const router = Router();
router.use(authenticateToken);

router.get('/config', getConfig);
router.get('/runs', getRuns);
router.get('/runs/:id', getRunById);
router.post('/trigger', triggerRun);

export default router;
