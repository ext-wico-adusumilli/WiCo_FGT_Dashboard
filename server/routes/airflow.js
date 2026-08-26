/**
 * Airflow Routes
 * API endpoints for Airflow integration
 * 
 * Note: These routes do NOT use JWT authentication.
 * Authentication to Airflow is handled via Basic Auth in the service layer.
 * If you need to protect these routes, implement API key or session-based auth.
 */

import express from 'express';
import airflowController from '../controllers/airflowController.js';

const router = express.Router();

// No JWT authentication middleware applied
// Airflow authentication is handled via Basic Auth in airflowService.js

// ===== DAG Management Routes =====

// Get all DAGs with status
router.get('/dags', airflowController.getDags);

// Get specific DAG details
router.get('/dags/:dagId', airflowController.getDag);

// Trigger a DAG
router.post('/dags/:dagId/trigger', airflowController.triggerDag);

// Pause a DAG
router.post('/dags/:dagId/pause', airflowController.pauseDag);

// Unpause a DAG
router.post('/dags/:dagId/unpause', airflowController.unpauseDag);

// Delete a DAG
router.delete('/dags/:dagId', airflowController.deleteDag);

// Get DAG runs for a specific DAG
router.get('/dags/:dagId/runs', airflowController.getDagRuns);

// Get task instances for a DAG run
router.get('/dags/:dagId/runs/:dagRunId/tasks', airflowController.getTaskInstances);

// ===== Script Management Routes =====

// Get available scripts
router.get('/scripts', airflowController.getScripts);

// Get specific script details
router.get('/scripts/:scriptId', airflowController.getScript);

// ===== Job Management Routes =====

// Create a new job
router.post('/jobs', airflowController.createJob);

// Get all jobs
router.get('/jobs', airflowController.getJobs);

// Get specific job details
router.get('/jobs/:jobId', airflowController.getJob);

// Delete a job
router.delete('/jobs/:jobId', airflowController.deleteJob);

// Retry a job
router.post('/jobs/:jobId/retry', airflowController.retryJob);

// Get job statistics
router.get('/jobs/statistics', airflowController.getJobStatistics);

// ===== Data Discovery Routes =====

// Get available phases from input directory
router.get('/data/phases', airflowController.getAvailablePhases);

// Get available dates for a specific phase
router.get('/data/phases/:phaseId/dates', airflowController.getAvailableDates);

// ===== Connection Management Routes =====

// Get all connections
router.get('/connections', airflowController.getConnections);

// Get specific connection details
router.get('/connections/:connectionId', airflowController.getConnection);

// Create a new connection
router.post('/connections', airflowController.createConnection);

// Update an existing connection
router.patch('/connections/:connectionId', airflowController.updateConnection);

// Delete a connection
router.delete('/connections/:connectionId', airflowController.deleteConnection);

// Test a connection
router.post('/connections/:connectionId/test', airflowController.testConnection);

// Get latest report from blob across all phases (for DAG Workflows tab)
router.get('/reports/:dagId/blob/latest', airflowController.getLatestReportFromBlob);

// Get reports from Azure Blob for a DAG + phase
router.get('/reports/:dagId/blob', airflowController.getReportsFromBlob);

// Stream a blob report file
router.get('/blob-report', airflowController.streamBlobReport);

// ===== Health and Status Routes =====

// Get Airflow connection status
router.get('/status', airflowController.getConnectionStatus);

// Get Airflow health status
router.get('/health', airflowController.getHealthStatus);

// ===== Report Management Routes =====

// Get latest report for a DAG
router.get('/reports/:dagId/latest', airflowController.getLatestReport);

// Get all reports for a DAG
router.get('/reports/:dagId', airflowController.getReports);

// Serve a specific report file
router.get('/reports/:dagId/file/:filename', airflowController.serveReport);

export default router;
