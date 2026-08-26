import AggregationSystem from '../jobs/aggregation/integration.js';
import JobExecutionLog from '../models/JobExecutionLog.js';
import JobConfiguration from '../models/JobConfiguration.js';
import logger from '../config/logger.js';

// Get all job statuses
export const getJobStatuses = async (req, res) => {
  try {
    const statuses = AggregationSystem.getAllJobsStatus();
    
    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    logger.error('Error fetching job statuses', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job statuses',
      error: error.message
    });
  }
};

// Get specific job status
export const getJobStatus = async (req, res) => {
  try {
    const { jobName } = req.params;
    const status = AggregationSystem.getJobScheduler().getJobStatus(jobName);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error fetching job status', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job status',
      error: error.message
    });
  }
};

// Manually trigger a job execution
export const triggerJob = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    // Check if job configuration exists
    const jobConfig = await JobConfiguration.findOne({ jobName });
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    const scheduler = AggregationSystem.getJobScheduler();
    
    // Check if job is already running
    const currentStatus = scheduler.getJobStatus(jobName);
    if (currentStatus && currentStatus.isRunning) {
      return res.status(409).json({
        success: false,
        message: 'Job is already running',
        data: {
          executionId: currentStatus.currentExecution.executionId,
          startTime: currentStatus.currentExecution.startTime,
          duration: currentStatus.currentExecution.duration
        }
      });
    }
    
    // Execute the job manually
    const executionLog = await scheduler.executeJob(jobName, true);
    
    logger.info('Job triggered manually', { 
      jobName, 
      executionId: executionLog.executionId,
      triggeredBy: req.user?.username || 'unknown'
    });
    
    res.json({
      success: true,
      message: 'Job triggered successfully',
      data: {
        executionId: executionLog.executionId,
        jobName,
        startTime: executionLog.startTime,
        status: executionLog.status
      }
    });
  } catch (error) {
    logger.error('Error triggering job', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to trigger job',
      error: error.message
    });
  }
};

// Cancel a running job
export const cancelJob = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const scheduler = AggregationSystem.getJobScheduler();
    const currentStatus = scheduler.getJobStatus(jobName);
    
    if (!currentStatus) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    if (!currentStatus.isRunning) {
      return res.status(400).json({
        success: false,
        message: 'Job is not currently running'
      });
    }
    
    // Stop the job
    await scheduler.stopJob(jobName);
    
    logger.info('Job cancelled', { 
      jobName,
      cancelledBy: req.user?.username || 'unknown'
    });
    
    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling job', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel job',
      error: error.message
    });
  }
};

// Get job execution history
export const getJobExecutionHistory = async (req, res) => {
  try {
    const { jobName } = req.params;
    const { limit = 50, offset = 0, status } = req.query;
    
    const filter = { jobName };
    if (status) filter.status = status;
    
    const executions = await JobExecutionLog.find(filter)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await JobExecutionLog.countDocuments(filter);
    
    res.json({
      success: true,
      data: executions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching job execution history', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job execution history',
      error: error.message
    });
  }
};

// Get specific job execution details
export const getJobExecution = async (req, res) => {
  try {
    const { executionId } = req.params;
    
    const execution = await JobExecutionLog.findOne({ executionId });
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Job execution not found'
      });
    }
    
    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    logger.error('Error fetching job execution', { 
      executionId: req.params.executionId, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job execution',
      error: error.message
    });
  }
};

// Get job metrics
export const getJobMetrics = async (req, res) => {
  try {
    const { jobName } = req.params;
    const { days = 7 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get execution statistics
    const executions = await JobExecutionLog.find({
      jobName,
      startTime: { $gte: startDate }
    }).sort({ startTime: -1 });
    
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;
    const cancelledExecutions = executions.filter(e => e.status === 'cancelled').length;
    
    const avgProcessingTime = executions
      .filter(e => e.metrics?.processingTimeMs)
      .reduce((sum, e) => sum + e.metrics.processingTimeMs, 0) / 
      (executions.filter(e => e.metrics?.processingTimeMs).length || 1);
    
    const totalRecordsProcessed = executions
      .reduce((sum, e) => sum + (e.recordsProcessed || 0), 0);
    
    // Get current job status from scheduler
    const scheduler = AggregationSystem.getJobScheduler();
    const currentStatus = scheduler.getJobStatus(jobName);
    
    res.json({
      success: true,
      data: {
        jobName,
        period: `${days} days`,
        currentStatus: currentStatus || null,
        statistics: {
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          cancelledExecutions,
          successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) : 0,
          avgProcessingTimeMs: Math.round(avgProcessingTime),
          totalRecordsProcessed
        },
        recentExecutions: executions.slice(0, 10)
      }
    });
  } catch (error) {
    logger.error('Error fetching job metrics', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job metrics',
      error: error.message
    });
  }
};

// Start a job (activate and schedule)
export const startJob = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    // Check if job configuration exists
    const jobConfig = await JobConfiguration.findOne({ jobName });
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    const scheduler = AggregationSystem.getJobScheduler();
    await scheduler.startJob(jobName);
    
    logger.info('Job started', { 
      jobName,
      startedBy: req.user?.username || 'unknown'
    });
    
    res.json({
      success: true,
      message: 'Job started successfully'
    });
  } catch (error) {
    logger.error('Error starting job', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to start job',
      error: error.message
    });
  }
};

// Stop a job (deactivate and unschedule)
export const stopJob = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const scheduler = AggregationSystem.getJobScheduler();
    await scheduler.stopJob(jobName);
    
    logger.info('Job stopped', { 
      jobName,
      stoppedBy: req.user?.username || 'unknown'
    });
    
    res.json({
      success: true,
      message: 'Job stopped successfully'
    });
  } catch (error) {
    logger.error('Error stopping job', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to stop job',
      error: error.message
    });
  }
};