import JobConfiguration from '../models/JobConfiguration.js';
import logger from '../config/logger.js';

// Get all job configurations
export const getJobConfigurations = async (req, res) => {
  try {
    const { jobType, isActive } = req.query;
    
    const filter = {};
    if (jobType) filter.jobType = jobType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const jobConfigs = await JobConfiguration.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: jobConfigs,
      count: jobConfigs.length
    });
  } catch (error) {
    logger.error('Error fetching job configurations', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job configurations',
      error: error.message
    });
  }
};

// Get a specific job configuration
export const getJobConfiguration = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const jobConfig = await JobConfiguration.findOne({ jobName });
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error fetching job configuration', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job configuration',
      error: error.message
    });
  }
};

// Create a new job configuration
export const createJobConfiguration = async (req, res) => {
  try {
    const jobConfigData = req.body;
    
    // Check if job with same name already exists
    const existingJob = await JobConfiguration.findOne({ jobName: jobConfigData.jobName });
    if (existingJob) {
      return res.status(409).json({
        success: false,
        message: 'Job configuration with this name already exists'
      });
    }
    
    const jobConfig = new JobConfiguration(jobConfigData);
    await jobConfig.save();
    
    logger.info('Job configuration created', { 
      jobName: jobConfig.jobName, 
      jobType: jobConfig.jobType 
    });
    
    res.status(201).json({
      success: true,
      message: 'Job configuration created successfully',
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error creating job configuration', { error: error.message });
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create job configuration',
      error: error.message
    });
  }
};

// Update a job configuration
export const updateJobConfiguration = async (req, res) => {
  try {
    const { jobName } = req.params;
    const updates = req.body;
    
    // Don't allow updating jobName or jobType
    delete updates.jobName;
    delete updates.jobType;
    
    const jobConfig = await JobConfiguration.findOneAndUpdate(
      { jobName },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    logger.info('Job configuration updated', { 
      jobName, 
      updates: Object.keys(updates) 
    });
    
    res.json({
      success: true,
      message: 'Job configuration updated successfully',
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error updating job configuration', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update job configuration',
      error: error.message
    });
  }
};

// Delete a job configuration
export const deleteJobConfiguration = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const jobConfig = await JobConfiguration.findOneAndDelete({ jobName });
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    logger.info('Job configuration deleted', { jobName });
    
    res.json({
      success: true,
      message: 'Job configuration deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting job configuration', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to delete job configuration',
      error: error.message
    });
  }
};

// Activate a job configuration
export const activateJobConfiguration = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const jobConfig = await JobConfiguration.findOneAndUpdate(
      { jobName },
      { $set: { isActive: true } },
      { new: true }
    );
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    logger.info('Job configuration activated', { jobName });
    
    res.json({
      success: true,
      message: 'Job configuration activated successfully',
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error activating job configuration', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to activate job configuration',
      error: error.message
    });
  }
};

// Deactivate a job configuration
export const deactivateJobConfiguration = async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const jobConfig = await JobConfiguration.findOneAndUpdate(
      { jobName },
      { $set: { isActive: false } },
      { new: true }
    );
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    logger.info('Job configuration deactivated', { jobName });
    
    res.json({
      success: true,
      message: 'Job configuration deactivated successfully',
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error deactivating job configuration', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate job configuration',
      error: error.message
    });
  }
};

// Update job schedule (cron expression)
export const updateJobSchedule = async (req, res) => {
  try {
    const { jobName } = req.params;
    const { cronExpression } = req.body;
    
    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Cron expression is required'
      });
    }
    
    const jobConfig = await JobConfiguration.findOneAndUpdate(
      { jobName },
      { $set: { cronExpression } },
      { new: true, runValidators: true }
    );
    
    if (!jobConfig) {
      return res.status(404).json({
        success: false,
        message: 'Job configuration not found'
      });
    }
    
    logger.info('Job schedule updated', { jobName, cronExpression });
    
    res.json({
      success: true,
      message: 'Job schedule updated successfully',
      data: jobConfig
    });
  } catch (error) {
    logger.error('Error updating job schedule', { 
      jobName: req.params.jobName, 
      error: error.message 
    });
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid cron expression',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update job schedule',
      error: error.message
    });
  }
};