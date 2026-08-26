import JobScheduler from './JobScheduler.js';
import FlightStatsAggregator from './aggregators/FlightStatsAggregator.js';
import WeatherStatsAggregator from './aggregators/WeatherStatsAggregator.js';
import JobConfiguration from '../../models/JobConfiguration.js';
import aggregationConfig from '../../config/aggregation.js';
import logger from '../../config/logger.js';

class AggregationSystem {
  constructor() {
    this.jobScheduler = null;
    this.aggregators = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the aggregation system
   * - Create job scheduler instance
   * - Initialize aggregator instances
   * - Register job functions with scheduler
   * - Configure default job schedules
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Aggregation system already initialized');
      return;
    }

    try {
      logger.info('Initializing aggregation system...');

      // Initialize job scheduler
      this.jobScheduler = new JobScheduler();

      // Initialize aggregators with configuration
      this.aggregators.set('flight_stats', new FlightStatsAggregator({
        batchSize: aggregationConfig.processing.batchSize,
        timeGranularities: aggregationConfig.processing.timeGranularities,
        lookbackDays: aggregationConfig.processing.defaultLookbackDays
      }));

      this.aggregators.set('weather_stats', new WeatherStatsAggregator({
        batchSize: aggregationConfig.processing.batchSize,
        timeGranularities: aggregationConfig.processing.timeGranularities,
        lookbackDays: aggregationConfig.processing.defaultLookbackDays
      }));

      // Register job functions with scheduler
      this._registerJobFunctions();

      // Initialize default job configurations if they don't exist
      await this._initializeDefaultJobConfigurations();

      // Initialize the job scheduler (loads and schedules active jobs)
      await this.jobScheduler.initialize();

      this.isInitialized = true;
      logger.info('Aggregation system initialized successfully', {
        scheduledJobs: this.jobScheduler.jobs.size,
        availableAggregators: this.aggregators.size
      });

    } catch (error) {
      logger.error('Failed to initialize aggregation system', { error: error.message });
      throw error;
    }
  }

  /**
   * Register job functions with the scheduler
   */
  _registerJobFunctions() {
    // Override the getJobFunction method to use our aggregators
    this.jobScheduler.getJobFunction = (jobType) => {
      const aggregator = this.aggregators.get(jobType);
      if (!aggregator) {
        logger.error('No aggregator found for job type', { jobType });
        return null;
      }

      // Return a function that calls the aggregator's aggregate method
      return async (config = {}) => {
        logger.info('Executing aggregation job', { jobType, config });
        
        try {
          const result = await aggregator.aggregate({
            incremental: config.incremental !== false, // Default to incremental
            ...config
          });
          
          logger.info('Aggregation job completed successfully', { 
            jobType, 
            result: {
              recordsProcessed: result.recordsProcessed,
              recordsCreated: result.recordsCreated,
              recordsUpdated: result.recordsUpdated,
              mode: result.mode
            }
          });
          
          return result;
        } catch (error) {
          logger.error('Aggregation job failed', { jobType, error: error.message });
          throw error;
        }
      };
    };
  }

  /**
   * Initialize default job configurations in the database
   */
  async _initializeDefaultJobConfigurations() {
    const defaultJobs = [
      {
        jobName: 'flight_stats_aggregation',
        jobType: 'flight_stats',
        cronExpression: aggregationConfig.jobs.defaultSchedules.flight_stats,
        isActive: true,
        configuration: {
          timeGranularities: aggregationConfig.processing.timeGranularities,
          lookbackDays: aggregationConfig.processing.defaultLookbackDays,
          batchSize: aggregationConfig.processing.batchSize,
          incremental: true
        }
      },
      {
        jobName: 'weather_stats_aggregation',
        jobType: 'weather_stats',
        cronExpression: aggregationConfig.jobs.defaultSchedules.weather_stats,
        isActive: true,
        configuration: {
          timeGranularities: aggregationConfig.processing.timeGranularities,
          lookbackDays: aggregationConfig.processing.defaultLookbackDays,
          batchSize: aggregationConfig.processing.batchSize,
          incremental: true
        }
      },
      {
        jobName: 'battery_stats_aggregation',
        jobType: 'battery_stats',
        cronExpression: aggregationConfig.jobs.defaultSchedules.battery_stats,
        isActive: false, // Start disabled until battery aggregator is implemented
        configuration: {
          timeGranularities: aggregationConfig.processing.timeGranularities,
          lookbackDays: aggregationConfig.processing.defaultLookbackDays,
          batchSize: aggregationConfig.processing.batchSize,
          incremental: true
        }
      },
      {
        jobName: 'mttf_stats_aggregation',
        jobType: 'mttf_stats',
        cronExpression: aggregationConfig.jobs.defaultSchedules.mttf_stats,
        isActive: false, // Start disabled until MTTF aggregator is implemented
        configuration: {
          timeGranularities: aggregationConfig.processing.timeGranularities,
          lookbackDays: aggregationConfig.processing.defaultLookbackDays,
          batchSize: aggregationConfig.processing.batchSize,
          incremental: true
        }
      }
    ];

    for (const jobConfig of defaultJobs) {
      try {
        const existingJob = await JobConfiguration.findOne({ jobName: jobConfig.jobName });
        
        if (!existingJob) {
          const newJob = new JobConfiguration(jobConfig);
          await newJob.save();
          logger.info('Created default job configuration', { jobName: jobConfig.jobName });
        } else {
          logger.debug('Job configuration already exists', { jobName: jobConfig.jobName });
        }
      } catch (error) {
        logger.error('Failed to create default job configuration', { 
          jobName: jobConfig.jobName, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Get the job scheduler instance
   */
  getJobScheduler() {
    if (!this.isInitialized) {
      throw new Error('Aggregation system not initialized');
    }
    return this.jobScheduler;
  }

  /**
   * Get an aggregator instance by type
   */
  getAggregator(jobType) {
    return this.aggregators.get(jobType);
  }

  /**
   * Get all available aggregator types
   */
  getAvailableAggregatorTypes() {
    return Array.from(this.aggregators.keys());
  }

  /**
   * Manually trigger a job execution
   */
  async executeJob(jobName) {
    if (!this.isInitialized) {
      throw new Error('Aggregation system not initialized');
    }
    
    return await this.jobScheduler.executeJob(jobName, true);
  }

  /**
   * Get status of all jobs
   */
  getAllJobsStatus() {
    if (!this.isInitialized) {
      throw new Error('Aggregation system not initialized');
    }
    
    return this.jobScheduler.getAllJobsStatus();
  }

  /**
   * Get metrics for a specific job
   */
  getJobMetrics(jobName) {
    if (!this.isInitialized) {
      throw new Error('Aggregation system not initialized');
    }
    
    return this.jobScheduler.getJobMetrics(jobName);
  }

  /**
   * Shutdown the aggregation system gracefully
   */
  async shutdown() {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down aggregation system...');
    
    try {
      if (this.jobScheduler) {
        await this.jobScheduler.shutdown();
      }
      
      this.aggregators.clear();
      this.jobScheduler = null;
      this.isInitialized = false;
      
      logger.info('Aggregation system shutdown complete');
    } catch (error) {
      logger.error('Error during aggregation system shutdown', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check for the aggregation system
   */
  getHealthStatus() {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Aggregation system not initialized',
        details: {}
      };
    }

    try {
      const jobStatuses = this.getAllJobsStatus();
      const runningJobs = jobStatuses.filter(job => job.isRunning).length;
      const activeJobs = jobStatuses.filter(job => job.isActive).length;
      const failedJobs = jobStatuses.filter(job => 
        job.metrics && job.metrics.failedRuns > 0
      ).length;

      const isHealthy = this.jobScheduler && this.jobScheduler.isInitialized;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Aggregation system operational' : 'Aggregation system issues detected',
        details: {
          initialized: this.isInitialized,
          schedulerInitialized: this.jobScheduler?.isInitialized || false,
          totalJobs: jobStatuses.length,
          activeJobs,
          runningJobs,
          failedJobs,
          availableAggregators: this.aggregators.size,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error checking aggregation system health',
        details: {
          error: error.message,
          lastCheck: new Date().toISOString()
        }
      };
    }
  }
}

// Create singleton instance
const aggregationSystem = new AggregationSystem();

export default aggregationSystem;