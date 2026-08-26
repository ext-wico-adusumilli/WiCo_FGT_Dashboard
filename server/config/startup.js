import { initializeDatabase, verifyIndexes } from './dbInitialization.js';
import AggregationSystem from '../jobs/aggregation/integration.js';
import logger from './logger.js';

/**
 * Complete system startup initialization
 * This function orchestrates the startup sequence for the entire application
 */
export async function initializeSystem() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting system initialization...');
    
    // Step 1: Initialize database indexes and schema
    logger.info('Step 1: Initializing database...');
    await initializeDatabase();
    
    // Step 2: Verify indexes were created correctly
    logger.info('Step 2: Verifying database indexes...');
    await verifyIndexes();
    
    // Step 3: Initialize aggregation system
    logger.info('Step 3: Initializing aggregation system...');
    await AggregationSystem.initialize();
    
    // Step 4: Verify aggregation system health
    logger.info('Step 4: Verifying aggregation system health...');
    const healthStatus = AggregationSystem.getHealthStatus();
    
    if (healthStatus.status !== 'healthy') {
      throw new Error(`Aggregation system health check failed: ${healthStatus.message}`);
    }
    
    const initializationTime = Date.now() - startTime;
    
    logger.info('System initialization completed successfully', {
      initializationTimeMs: initializationTime,
      aggregationSystemStatus: healthStatus.status,
      scheduledJobs: healthStatus.details.totalJobs,
      activeJobs: healthStatus.details.activeJobs
    });
    
    return {
      success: true,
      initializationTimeMs: initializationTime,
      aggregationSystem: healthStatus
    };
    
  } catch (error) {
    const initializationTime = Date.now() - startTime;
    
    logger.error('System initialization failed', {
      error: error.message,
      initializationTimeMs: initializationTime,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message,
      initializationTimeMs: initializationTime
    };
  }
}

/**
 * Graceful system shutdown
 * This function handles the shutdown sequence for the entire application
 */
export async function shutdownSystem(signal = 'SIGTERM') {
  const startTime = Date.now();
  
  try {
    logger.info('Starting graceful system shutdown...', { signal });
    
    // Step 1: Shutdown aggregation system
    logger.info('Step 1: Shutting down aggregation system...');
    await AggregationSystem.shutdown();
    
    // Step 2: Close any other resources (database connections are handled by mongoose)
    logger.info('Step 2: Closing additional resources...');
    // Add any other cleanup tasks here
    
    const shutdownTime = Date.now() - startTime;
    
    logger.info('System shutdown completed successfully', {
      shutdownTimeMs: shutdownTime,
      signal
    });
    
    return {
      success: true,
      shutdownTimeMs: shutdownTime
    };
    
  } catch (error) {
    const shutdownTime = Date.now() - startTime;
    
    logger.error('System shutdown failed', {
      error: error.message,
      shutdownTimeMs: shutdownTime,
      signal,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message,
      shutdownTimeMs: shutdownTime
    };
  }
}

/**
 * Get system status and health information
 */
export function getSystemStatus() {
  try {
    const aggregationHealth = AggregationSystem.getHealthStatus();
    
    return {
      status: aggregationHealth.status === 'healthy' ? 'operational' : 'degraded',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      aggregationSystem: aggregationHealth,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Restart the aggregation system without restarting the entire application
 */
export async function restartAggregationSystem() {
  try {
    logger.info('Restarting aggregation system...');
    
    // Shutdown current system
    await AggregationSystem.shutdown();
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize
    await AggregationSystem.initialize();
    
    const healthStatus = AggregationSystem.getHealthStatus();
    
    logger.info('Aggregation system restarted successfully', {
      status: healthStatus.status,
      scheduledJobs: healthStatus.details.totalJobs
    });
    
    return {
      success: true,
      status: healthStatus.status,
      message: 'Aggregation system restarted successfully'
    };
    
  } catch (error) {
    logger.error('Failed to restart aggregation system', { error: error.message });
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to restart aggregation system'
    };
  }
}

/**
 * Initialize system with retry logic for production environments
 */
export async function initializeSystemWithRetry(maxRetries = 3, retryDelayMs = 5000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`System initialization attempt ${attempt}/${maxRetries}`);
      
      const result = await initializeSystem();
      
      if (result.success) {
        return result;
      } else {
        lastError = new Error(result.error);
        throw lastError;
      }
      
    } catch (error) {
      lastError = error;
      
      logger.warn(`System initialization attempt ${attempt} failed`, {
        error: error.message,
        attempt,
        maxRetries,
        willRetry: attempt < maxRetries
      });
      
      if (attempt < maxRetries) {
        logger.info(`Waiting ${retryDelayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }
  
  logger.error('System initialization failed after all retry attempts', {
    maxRetries,
    finalError: lastError?.message
  });
  
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    attempts: maxRetries
  };
}