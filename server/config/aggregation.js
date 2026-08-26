// Aggregation system configuration
// Centralizes configuration for job scheduling, data processing, and performance settings

const aggregationConfig = {
  // Job scheduling configuration
  jobs: {
    // Default cron expressions for different job types
    defaultSchedules: {
      flight_stats: '0 */15 * * * *', // Every 15 minutes
      weather_stats: '0 */30 * * * *', // Every 30 minutes
      battery_stats: '0 0 */6 * * *',  // Every 6 hours
      mttf_stats: '0 0 0 * * *'        // Daily at midnight
    },
    
    // Job execution settings
    maxRetries: 5,
    retryBackoffMs: [1000, 2000, 4000, 8000, 16000], // Exponential backoff
    maxConcurrentJobs: 3,
    jobTimeoutMs: 30 * 60 * 1000, // 30 minutes
  },

  // Data processing configuration
  processing: {
    batchSize: 1000,
    defaultLookbackDays: 30,
    timeGranularities: ['daily', 'weekly', 'monthly'],
    
    // Data freshness thresholds (in milliseconds)
    freshnessThresholds: {
      flight_stats: 15 * 60 * 1000,    // 15 minutes
      weather_stats: 30 * 60 * 1000,   // 30 minutes
      battery_stats: 6 * 60 * 60 * 1000, // 6 hours
      mttf_stats: 24 * 60 * 60 * 1000   // 24 hours
    }
  },

  // Performance settings
  performance: {
    dashboardQueryTimeoutMs: 500,
    maxMemoryUsageMB: 512,
    enableQueryOptimization: true,
    enableIndexHints: true
  },

  // Logging configuration
  logging: {
    level: process.env.AGGREGATION_LOG_LEVEL || 'info',
    enableMetrics: true,
    enablePerformanceTracking: true,
    logJobExecutionDetails: true
  }
};

export default aggregationConfig;