/**
 * Ingestion Controller
 * REST handlers for the Data Ingestion feature.
 */

import IngestionJob from '../models/IngestionJob.js';
import logger from '../config/logger.js';
import {
  runIngestionJob,
  listAzcopyJobs,
  showAzcopyJob,
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
} from '../services/ingestionService.js';

// ── GET /api/ingestion/jobs ───────────────────────────────────────────────────
export const getJobs = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [jobs, total] = await Promise.all([
      IngestionJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      IngestionJob.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    logger.error('getJobs error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/ingestion/jobs/:jobId ───────────────────────────────────────────
export const getJob = async (req, res) => {
  try {
    const job = await IngestionJob.findOne({ jobId: req.params.jobId });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
  } catch (err) {
    logger.error('getJob error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/ingestion/summary ────────────────────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const summary = await IngestionJob.getSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('getSummary error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/ingestion/run ───────────────────────────────────────────────────
export const triggerScan = async (req, res) => {
  try {
    const { sourceFolder, blobSasUrl, includePath } = req.body;
    if (!sourceFolder || !blobSasUrl) {
      return res.status(400).json({
        success: false,
        message: 'sourceFolder and blobSasUrl are required',
      });
    }

    const job = await runIngestionJob(sourceFolder, blobSasUrl, 'manual', includePath || null);

    logger.info('Manual ingestion triggered', {
      jobId: job.jobId,
      sourceFolder,
      triggeredBy: req.user?.email || 'unknown',
    });

    res.json({
      success: true,
      message: 'Ingestion job started',
      data: job,
    });
  } catch (err) {
    logger.error('triggerScan error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/ingestion/scheduler/start ──────────────────────────────────────
export const startSchedulerEndpoint = (req, res) => {
  try {
    const {
      cronExpression = '0 * * * *',
      sourceFolder,
      blobSasUrl,
    } = req.body;

    if (!sourceFolder || !blobSasUrl) {
      return res.status(400).json({
        success: false,
        message: 'sourceFolder and blobSasUrl are required',
      });
    }

    startScheduler(cronExpression, sourceFolder, blobSasUrl);
    res.json({ success: true, message: 'Scheduler started', cronExpression });
  } catch (err) {
    logger.error('startScheduler error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/ingestion/scheduler/stop ───────────────────────────────────────
export const stopSchedulerEndpoint = (_req, res) => {
  try {
    stopScheduler();
    res.json({ success: true, message: 'Scheduler stopped' });
  } catch (err) {
    logger.error('stopScheduler error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/ingestion/scheduler/status ──────────────────────────────────────
export const getSchedulerStatus = (_req, res) => {
  res.json({ success: true, data: { running: isSchedulerRunning() } });
};

// ── GET /api/ingestion/azcopy/jobs ───────────────────────────────────────────
export const getAzcopyJobs = async (_req, res) => {
  try {
    const output = await listAzcopyJobs();
    res.json({ success: true, data: output });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/ingestion/azcopy/jobs/:azcopyJobId ──────────────────────────────
export const getAzcopyJobDetails = async (req, res) => {
  try {
    const output = await showAzcopyJob(req.params.azcopyJobId);
    res.json({ success: true, data: output });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

