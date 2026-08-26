// Logging configuration for aggregation system
// Provides structured logging for job execution tracking

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    // In production, this could be enhanced to write to files or external logging services
    if (this.shouldLog(level)) {
      console.log(JSON.stringify(logEntry));
    }
  }

  shouldLog(level) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.logLevel];
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  // Specific methods for job execution logging
  jobStarted(jobName, executionId, metadata = {}) {
    this.info('Job started', {
      jobName,
      executionId,
      event: 'job_started',
      ...metadata
    });
  }

  jobCompleted(jobName, executionId, metrics = {}) {
    this.info('Job completed successfully', {
      jobName,
      executionId,
      event: 'job_completed',
      ...metrics
    });
  }

  jobFailed(jobName, executionId, error, metadata = {}) {
    this.error('Job failed', {
      jobName,
      executionId,
      event: 'job_failed',
      error: error.message,
      stack: error.stack,
      ...metadata
    });
  }

  jobRetry(jobName, executionId, attempt, error) {
    this.warn('Job retry attempt', {
      jobName,
      executionId,
      event: 'job_retry',
      attempt,
      error: error.message
    });
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;