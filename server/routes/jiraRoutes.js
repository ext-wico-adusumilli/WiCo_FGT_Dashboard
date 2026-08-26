import express from 'express';
import * as jiraController from '../controllers/jiraController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get current parent ticket key
router.get('/parent-key', jiraController.getParentTicketKey);

// Update parent ticket key
router.put('/parent-key', jiraController.updateParentTicketKey);

// Get parent issue
router.get('/parent', jiraController.getParentIssue);

// Get child issues
router.get('/children', jiraController.getChildIssues);

// Get all tickets (parent + children)
router.get('/all', jiraController.getAllTickets);

// Natural Language Query endpoint
router.post('/query', jiraController.queryTickets);

// Direct JQL Query endpoint
router.post('/query-jql', jiraController.queryTicketsJQL);

export default router;
