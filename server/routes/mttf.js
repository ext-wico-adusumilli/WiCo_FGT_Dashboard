import express from 'express';
import { 
  getCategories, 
  initializeCategories, 
  getMTTFData, 
  createMTTFData, 
  updateMTTFData, 
  deleteMTTFData,
  getFlightTimeAnalysis,
  getComponentReplacements
} from '../controllers/mttfController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Category routes
router.get('/categories', getCategories);
router.post('/categories/initialize', initializeCategories);

// MTTF data routes
router.get('/data', getMTTFData);
router.post('/data', createMTTFData);
router.put('/data/:id', updateMTTFData);
router.delete('/data/:id', deleteMTTFData);

// Flight time analysis routes
router.get('/flight-time-analysis', getFlightTimeAnalysis);
router.post('/component-replacements', getComponentReplacements);

export default router;
