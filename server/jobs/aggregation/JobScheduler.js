import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import JobConfiguration from '../../models/JobConfiguration.js';
import JobExecutionLog from '../../models/JobExecutionLog.js';
import logger from '../../config/logger.js';
import aggregationConfig from '../../config/aggregation.js';
import RetryHandler from '../../utils/retryHandler.js';
import TransactionManager from '../../utils/transactionManager.js';

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.runningJobs = new Map();
    this.isInitialized = false;
    this.retryHandler = new RetryHandler({
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 16000
    });
    this.transactionManager = new TransactionManager();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      const activeJobs = await JobConfiguration.find({ isActive: true });
      
      for (const jobConfig of activeJobs) {
        await this.scheduleJobFromConfig(jobConfig);
      }
      
      this.isInitialized = true;
      logger.info('JobScheduler initialized successfully', { 
        scheduledJobs: activeJobs.length 
      });
    } catch (error) {
      logger.error('Failed to initialize JobScheduler', { error: error.message });
      throw error;
    }
  }

  async scheduleJob(jobName, cronExpression, jobFunction, options = {}) {
    try {
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      if (this.jobs.has(jobName)) {
        this.jobs.get(jobName).task.stop();
      }

      const task = cron.schedule(cronExpression, async () => {
        await this.executeJob(jobName);
      }, {
        scheduled: false,
        timezone: options.timezone || 'UTC'
      });

      const jobInfo = {
        name: jobName,
        cronExpression,
        jobFunction,
        task,
        options,
        isActive: true,
        lastRun: null,
        nextRun: this.calculateNextRun(cronExpression),
        metrics: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          averageExecutionTime: 0
        }
      };

      this.jobs.set(jobName, jobInfo);
      task.start();

      logger.info('Job scheduled successfully', { 
        jobName, 
        cronExpression,
        nextRun: jobInfo.nextRun
      });

      return jobInfo;
    } catch (error) {
      logger.error('Failed to schedule job', { jobName, error: error.message });
      throw error;
    }
  }

  async scheduleJobFromConfig(jobConfig) {
    const jobFunction = this.getJobFunction(jobConfig.jobType);
    if (!jobFunction) {
      throw new Error(`No job function found for job type: ${jobConfig.jobType}`);
    }

    return await this.scheduleJob(
      jobConfig.jobName,
      jobConfig.cronExpression,
      jobFunction,
      { 
        jobType: jobConfig.jobType,
        configuration: jobConfig.configuration 
      }
    );
  }

  async executeJob(jobName, isManual = false) {
    const jobInfo = this.jobs.get(jobName);
    if (!jobInfo) {
      throw new Error(`Job not found: ${jobName}`);
    }

    if (this.runningJobs.has(jobName)) {
      logger.warn('Job already running, skipping execution', { jobName });
      return null;
    }

    const executionId = uuidv4();
    const startTime = new Date();
    const context = { jobName, executionId };

    try {
      this.runningJobs.set(jobName, { executionId, startTime });

      logger.jobStarted(jobName, executionId, { isManual });

      const startMemory = process.memoryUsage();
      
      // Execute job function with retry logic
      const result = await this.retryHandler.executeAggregationOperation(
        async () => {
          return await jobInfo.jobFunction(jobInfo.options?.configuration || {});
        },
        context,
        `execute ${jobName}`
      );
      
      const endMemory = process.memoryUsage();

      const endTime = new Date();
      const processingTimeMs = endTime.getTime() - startTime.getTime();
      const memoryUsageMB = (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024;

      // Only log success to console, not to database
      logger.jobCompleted(jobName, executionId, {
        processingTimeMs,
        recordsProcessed: result?.recordsProcessed || 0,
        memoryUsageMB
      });

      jobInfo.lastRun = endTime;
      jobInfo.nextRun = isManual ? jobInfo.nextRun : this.calculateNextRun(jobInfo.cronExpression);
      jobInfo.metrics.totalRuns++;
      jobInfo.metrics.successfulRuns++;
      jobInfo.metrics.averageExecutionTime = 
        (jobInfo.metrics.averageExecutionTime * (jobInfo.metrics.totalRuns - 1) + processingTimeMs) / 
        jobInfo.metrics.totalRuns;

      // Update job configuration with retry
      await this.retryHandler.executeDbOperation(
        async () => {
          return await this.updateJobConfiguration(jobName, {
            lastRun: jobInfo.lastRun,
            nextRun: jobInfo.nextRun
          });
        },
        context,
        'update job configuration'
      );

      return {
        executionId,
        status: 'completed',
        recordsProcessed: result?.recordsProcessed || 0,
        recordsCreated: result?.recordsCreated || 0,
        recordsUpdated: result?.recordsUpdated || 0,
        processingTimeMs,
        memoryUsageMB
      };
    } catch (error) {
      const endTime = new Date();
      
      // Only save failed execution logs to database
      try {
        await this.retryHandler.executeDbOperation(
          async () => {
            const executionLog = new JobExecutionLog({
              jobName,
              executionId,
              startTime,
              endTime,
              status: 'failed',
              errorMessage: error.message,
              metrics: {
                processingTimeMs: endTime.getTime() - startTime.getTime(),
                memoryUsageMB: null,
                cpuUsagePercent: null
              }
            });
            return await executionLog.save();
          },
          context,
          'save failed execution log'
        );
      } catch (logError) {
        logger.error('Failed to save execution log for failed job after retries', { 
          jobName, 
          executionId, 
          error: logError.message 
        });
      }

      if (jobInfo) {
        jobInfo.metrics.totalRuns++;
        jobInfo.metrics.failedRuns++;
      }

      logger.jobFailed(jobName, executionId, error);
      throw error;
    } finally {
      this.runningJobs.delete(jobName);
    }
  }

  getJobStatus(jobName) {
    const jobInfo = this.jobs.get(jobName);
    if (!jobInfo) {
      return null;
    }

    const isRunning = this.runningJobs.has(jobName);
    const runningInfo = this.runningJobs.get(jobName);

    return {
      name: jobName,
      isActive: jobInfo.isActive,
      isRunning,
      cronExpression: jobInfo.cronExpression,
      lastRun: jobInfo.lastRun,
      nextRun: jobInfo.nextRun,
      currentExecution: runningInfo ? {
        executionId: runningInfo.executionId,
        startTime: runningInfo.startTime,
        duration: Date.now() - runningInfo.startTime.getTime()
      } : null,
      metrics: jobInfo.metrics
    };
  }

  getJobMetrics(jobName) {
    const jobInfo = this.jobs.get(jobName);
    if (!jobInfo) {
      return null;
    }

    return {
      jobName,
      metrics: jobInfo.metrics,
      isRunning: this.runningJobs.has(jobName),
      lastRun: jobInfo.lastRun,
      nextRun: jobInfo.nextRun
    };
  }

  getAllJobsStatus() {
    const statuses = [];
    for (const [jobName] of this.jobs) {
      statuses.push(this.getJobStatus(jobName));
    }
    return statuses;
  }

  async stopJob(jobName) {
    const jobInfo = this.jobs.get(jobName);
    if (!jobInfo) {
      throw new Error(`Job not found: ${jobName}`);
    }

    jobInfo.task.stop();
    jobInfo.isActive = false;

    if (this.runningJobs.has(jobName)) {
      const runningInfo = this.runningJobs.get(jobName);
      // Save cancelled job as failed log
      try {
        const executionLog = new JobExecutionLog({
          jobName,
          executionId: runningInfo.executionId,
          startTime: runningInfo.startTime,
          endTime: new Date(),
          status: 'cancelled',
          errorMessage: 'Job was manually cancelled',
          metrics: {
            processingTimeMs: Date.now() - runningInfo.startTime.getTime(),
            memoryUsageMB: null,
            cpuUsagePercent: null
          }
        });
        await executionLog.save();
      } catch (error) {
        logger.error('Failed to save execution log for cancelled job', { 
          jobName, 
          error: error.message 
        });
      }
      this.runningJobs.delete(jobName);
    }

    logger.info('Job stopped', { jobName });
  }

  async startJob(jobName) {
    const jobInfo = this.jobs.get(jobName);
    if (!jobInfo) {
      throw new Error(`Job not found: ${jobName}`);
    }

    jobInfo.task.start();
    jobInfo.isActive = true;
    jobInfo.nextRun = this.calculateNextRun(jobInfo.cronExpression);

    await this.updateJobConfiguration(jobName, {
      isActive: true,
      nextRun: jobInfo.nextRun
    });

    logger.info('Job started', { jobName, nextRun: jobInfo.nextRun });
  }

  calculateNextRun(cronExpression) {
    try {
      // Use a simple approach to calculate next run time
      // For now, we'll just add the interval based on the cron expression
      const now = new Date();
      
      // Parse basic cron patterns for common intervals
      if (cronExpression === '0 */15 * * * *') {
        // Every 15 minutes
        return new Date(now.getTime() + 15 * 60 * 1000);
      } else if (cronExpression === '0 */30 * * * *') {
        // Every 30 minutes
        return new Date(now.getTime() + 30 * 60 * 1000);
      } else if (cronExpression === '0 0 */6 * * *') {
        // Every 6 hours
        return new Date(now.getTime() + 6 * 60 * 60 * 1000);
      } else if (cronExpression === '0 0 0 * * *') {
        // Daily at midnight
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow;
      }
      
      // Default: add 1 hour for unknown patterns
      return new Date(now.getTime() + 60 * 60 * 1000);
    } catch (error) {
      logger.error('Failed to calculate next run time', { cronExpression, error: error.message });
      return null;
    }
  }

  async updateJobConfiguration(jobName, updates) {
    try {
      await JobConfiguration.findOneAndUpdate(
        { jobName },
        { $set: updates },
        { new: true }
      );
    } catch (error) {
      logger.error('Failed to update job configuration', { 
        jobName, 
        updates, 
        error: error.message 
      });
    }
  }

  getJobFunction(jobType) {
    const jobFunctions = {
      flight_stats: async (config) => {
        logger.info('Executing flight stats aggregation', { config });
        return { recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0 };
      },
      weather_stats: async (config) => {
        logger.info('Executing weather stats aggregation', { config });
        return { recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0 };
      },
      battery_stats: async (config) => {
        logger.info('Executing battery stats aggregation', { config });
        return { recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0 };
      },
      mttf_stats: async (config) => {
        logger.info('Executing MTTF stats aggregation', { config });
        return { recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0 };
      }
    };

    return jobFunctions[jobType];
  }

  async shutdown() {
    logger.info('Shutting down JobScheduler');
    
    // First, abort any active transactions
    try {
      await this.transactionManager.abortAllTransactions();
    } catch (error) {
      logger.error('Error aborting transactions during shutdown', { error: error.message });
    }
    
    for (const [jobName, jobInfo] of this.jobs) {
      try {
        jobInfo.task.stop();
        
        if (this.runningJobs.has(jobName)) {
          const runningInfo = this.runningJobs.get(jobName);
          // Save cancelled job as failed log during shutdown
          try {
            const executionLog = new JobExecutionLog({
              jobName,
              executionId: runningInfo.executionId,
              startTime: runningInfo.startTime,
              endTime: new Date(),
              status: 'cancelled',
              errorMessage: 'Job was cancelled during system shutdown',
              metrics: {
                processingTimeMs: Date.now() - runningInfo.startTime.getTime(),
                memoryUsageMB: null,
                cpuUsagePercent: null
              }
            });
            await executionLog.save();
          } catch (saveError) {
            logger.error('Failed to save cancelled job log during shutdown', { 
              jobName, 
              error: saveError.message 
            });
          }
        }
      } catch (error) {
        logger.error('Error stopping job during shutdown', { jobName, error: error.message });
      }
    }

    this.jobs.clear();
    this.runningJobs.clear();
    this.isInitialized = false;
    
    logger.info('JobScheduler shutdown complete');
  }
}

export default JobScheduler;