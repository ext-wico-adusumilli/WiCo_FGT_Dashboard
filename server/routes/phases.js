/**
 * Phase Routes
 * API endpoints for phase and data selection management
 */

import express from 'express';
import phaseController from '../controllers/phaseController.js';

const router = express.Router();

// Get all active phases
router.get('/', phaseController.getPhases);

// Get specific phase details
router.get('/:phaseId', phaseController.getPhase);

// Get blob storage structure
router.get('/blob-structure', phaseController.getBlobStructure);

// Get data selection summary
router.post('/data-summary', phaseController.getDataSummary);

// Validate data selection
router.post('/validate', phaseController.validateSelection);

// Create a new phase
router.post('/', phaseController.createPhase);

// Update an existing phase
router.patch('/:phaseId', phaseController.updatePhase);

// Delete a phase (soft delete)
router.delete('/:phaseId', phaseController.deletePhase);

export default router;
