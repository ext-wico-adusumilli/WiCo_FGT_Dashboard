import logger from '../config/logger.js';

/**
 * Retry handler with exponential backoff for transient failures
 */
class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.baseDelayMs = options.baseDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 16000;
    this.retryableErrors = options.retryableErrors || [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'MongoNetworkError',
      'MongoTimeoutError',
      'MongoServerSelectionError'
    ];
  }

  /**
   * Execute a function with retry logic and exponential backoff
   * @param {Function} fn - The function to execute
   * @param {Object} context - Context object for logging (jobName, executionId, etc.)
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise} Result of the function execution
   */
  async executeWithRetry(fn, context = {}, operationName = 'operation') {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info('Retrying operation', {
            ...context,
            operationName,
            attempt,
            maxRetries: this.maxRetries
          });
        }
        
        const result = await fn();
        
        if (attempt > 0) {
          logger.info('Operation succeeded after retry', {
            ...context,
            operationName,
            attempt,
            totalAttempts: attempt + 1
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if this is the last attempt
        if (attempt === this.maxRetries) {
          logger.error('Operation failed after all retry attempts', {
            ...context,
            operationName,
            totalAttempts: attempt + 1,
            maxRetries: this.maxRetries,
            error: error.message,
            errorCode: error.code,
            errorName: error.name
          });
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          logger.error('Non-retryable error encountered, aborting retry attempts', {
            ...context,
            operationName,
            attempt: attempt + 1,
            error: error.message,
            errorCode: error.code,
            errorName: error.name
          });
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        
        logger.warn('Operation failed, will retry after delay', {
          ...context,
          operationName,
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs: delay,
          error: error.message,
          errorCode: error.code,
          errorName: error.name
        });
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Operation '${operationName}' failed after ${this.maxRetries + 1} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Check if an error is retryable based on error type and code
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   */
  isRetryableError(error) {
    // Check error code
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check error name/type
    if (error.name && this.retryableErrors.includes(error.name)) {
      return true;
    }
    
    // Check error message for known transient error patterns
    const errorMessage = error.message.toLowerCase();
    const transientPatterns = [
      'network error',
      'connection timeout',
      'connection refused',
      'temporary failure',
      'server selection timed out',
      'no suitable servers found',
      'connection pool closed',
      'socket hang up'
    ];
    
    return transientPatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Calculate delay for exponential backoff
   * @param {number} attempt - Current attempt number (0-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^attempt
    const delay = this.baseDelayMs * Math.pow(2, attempt);
    
    // Cap at maximum delay
    return Math.min(delay, this.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after the delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry handler with custom configuration
   * @param {Object} options - Configuration options
   * @returns {RetryHandler} New retry handler instance
   */
  static create(options = {}) {
    return new RetryHandler(options);
  }

  /**
   * Execute a database operation with retry logic
   * @param {Function} dbOperation - Database operation function
   * @param {Object} context - Context for logging
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of the database operation
   */
  async executeDbOperation(dbOperation, context = {}, operationName = 'database operation') {
    return this.executeWithRetry(dbOperation, context, operationName);
  }

  /**
   * Execute an aggregation operation with retry logic
   * @param {Function} aggregationOperation - Aggregation operation function
   * @param {Object} context - Context for logging
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of the aggregation operation
   */
  async executeAggregationOperation(aggregationOperation, context = {}, operationName = 'aggregation operation') {
    return this.executeWithRetry(aggregationOperation, context, operationName);
  }
}

export default RetryHandler;