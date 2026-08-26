import express from 'express';
import {
  getAllAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentBySN,
  getAssignmentsByBranch,
  bulkUpsertSNs,
  getStatistics
} from '../controllers/snBranchController.js';

const router = express.Router();

// Get all SN-Branch assignments (including unassigned)
router.get('/', getAllAssignments);

// Get statistics
router.get('/statistics', getStatistics);

// Create new SN entry (assigned or unassigned)
router.post('/', createAssignment);

// Bulk upsert SNs
router.post('/bulk-upsert', bulkUpsertSNs);

// Update SN-Branch assignment
router.put('/:id', updateAssignment);

// Delete SN entry
router.delete('/:id', deleteAssignment);

// Get assignment by SN
router.get('/sn/:sn', getAssignmentBySN);

// Get assignments by branch
router.get('/branch/:branchName', getAssignmentsByBranch);

export default router;