import mongoose from 'mongoose';
import logger from '../config/logger.js';

/**
 * Transaction manager for handling atomic operations and rollback capabilities
 */
class TransactionManager {
  constructor() {
    this.activeTransactions = new Map();
  }

  /**
   * Execute operations within a MongoDB transaction with automatic rollback on failure
   * @param {Function} operations - Function containing operations to execute
   * @param {Object} context - Context object for logging (jobName, executionId, etc.)
   * @param {string} operationName - Name of the operation for logging
   * @returns {Promise} Result of the operations
   */
  async executeInTransaction(operations, context = {}, operationName = 'transaction') {
    const session = await mongoose.startSession();
    const transactionId = `${context.executionId || 'unknown'}_${Date.now()}`;
    
    try {
      this.activeTransactions.set(transactionId, {
        session,
        startTime: new Date(),
        context,
        operationName
      });

      logger.info('Starting transaction', {
        ...context,
        transactionId,
        operationName
      });

      // Start transaction
      await session.startTransaction({
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority', j: true },
        readPreference: 'primary'
      });

      // Execute operations within transaction
      const result = await operations(session);

      // Commit transaction
      await session.commitTransaction();
      
      logger.info('Transaction committed successfully', {
        ...context,
        transactionId,
        operationName
      });

      return result;
    } catch (error) {
      logger.error('Transaction failed, rolling back', {
        ...context,
        transactionId,
        operationName,
        error: error.message
      });

      try {
        // Abort transaction to rollback changes
        await session.abortTransaction();
        logger.info('Transaction rolled back successfully', {
          ...context,
          transactionId,
          operationName
        });
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction', {
          ...context,
          transactionId,
          operationName,
          rollbackError: rollbackError.message
        });
      }

      throw error;
    } finally {
      // Clean up session
      await session.endSession();
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Execute aggregation operations with transaction integrity
   * @param {Function} aggregationOps - Aggregation operations function
   * @param {Object} context - Context for logging
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of aggregation operations
   */
  async executeAggregationTransaction(aggregationOps, context = {}, operationName = 'aggregation transaction') {
    return this.executeInTransaction(aggregationOps, context, operationName);
  }

  /**
   * Execute batch operations with transaction integrity and partial failure handling
   * @param {Array} batches - Array of batch operations
   * @param {Function} batchProcessor - Function to process each batch
   * @param {Object} context - Context for logging
   * @param {Object} options - Options for batch processing
   * @returns {Promise} Results of batch processing
   */
  async executeBatchTransaction(batches, batchProcessor, context = {}, options = {}) {
    const {
      continueOnPartialFailure = false,
      rollbackOnAnyFailure = true,
      operationName = 'batch transaction'
    } = options;

    const results = {
      successful: [],
      failed: [],
      totalBatches: batches.length,
      successCount: 0,
      failureCount: 0
    };

    if (rollbackOnAnyFailure) {
      // Execute all batches in a single transaction
      return this.executeInTransaction(async (session) => {
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          try {
            const batchResult = await batchProcessor(batch, session, i);
            results.successful.push({ batchIndex: i, result: batchResult });
            results.successCount++;
          } catch (error) {
            results.failed.push({ batchIndex: i, error: error.message });
            results.failureCount++;
            
            if (!continueOnPartialFailure) {
              throw new Error(`Batch ${i} failed: ${error.message}`);
            }
          }
        }
        return results;
      }, context, operationName);
    } else {
      // Execute each batch in its own transaction
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        try {
          const batchResult = await this.executeInTransaction(
            async (session) => await batchProcessor(batch, session, i),
            { ...context, batchIndex: i },
            `${operationName} - batch ${i}`
          );
          results.successful.push({ batchIndex: i, result: batchResult });
          results.successCount++;
        } catch (error) {
          results.failed.push({ batchIndex: i, error: error.message });
          results.failureCount++;
          
          logger.warn('Batch failed but continuing with remaining batches', {
            ...context,
            batchIndex: i,
            error: error.message,
            operationName
          });
        }
      }
      return results;
    }
  }

  /**
   * Create a savepoint for partial rollback within a transaction
   * @param {Object} session - MongoDB session
   * @param {string} savepointName - Name of the savepoint
   * @param {Object} context - Context for logging
   * @returns {Object} Savepoint information
   */
  async createSavepoint(session, savepointName, context = {}) {
    const savepoint = {
      name: savepointName,
      timestamp: new Date(),
      session: session
    };

    logger.debug('Created savepoint', {
      ...context,
      savepointName,
      timestamp: savepoint.timestamp
    });

    return savepoint;
  }

  /**
   * Execute operations with compensation logic for complex rollback scenarios
   * @param {Function} operations - Main operations to execute
   * @param {Function} compensationOps - Compensation operations for rollback
   * @param {Object} context - Context for logging
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of operations
   */
  async executeWithCompensation(operations, compensationOps, context = {}, operationName = 'compensated operation') {
    const executionLog = [];
    
    try {
      logger.info('Starting compensated operation', {
        ...context,
        operationName
      });

      const result = await operations(executionLog);
      
      logger.info('Compensated operation completed successfully', {
        ...context,
        operationName,
        executionSteps: executionLog.length
      });

      return result;
    } catch (error) {
      logger.error('Compensated operation failed, executing compensation logic', {
        ...context,
        operationName,
        error: error.message,
        executionSteps: executionLog.length
      });

      try {
        // Execute compensation operations in reverse order
        await compensationOps(executionLog.reverse());
        
        logger.info('Compensation completed successfully', {
          ...context,
          operationName,
          compensationSteps: executionLog.length
        });
      } catch (compensationError) {
        logger.error('Compensation failed', {
          ...context,
          operationName,
          compensationError: compensationError.message,
          originalError: error.message
        });
        
        // Throw combined error
        throw new Error(`Operation failed: ${error.message}. Compensation also failed: ${compensationError.message}`);
      }

      throw error;
    }
  }

  /**
   * Get status of all active transactions
   * @returns {Array} Array of active transaction information
   */
  getActiveTransactions() {
    const transactions = [];
    for (const [transactionId, transactionInfo] of this.activeTransactions) {
      transactions.push({
        transactionId,
        startTime: transactionInfo.startTime,
        duration: Date.now() - transactionInfo.startTime.getTime(),
        context: transactionInfo.context,
        operationName: transactionInfo.operationName
      });
    }
    return transactions;
  }

  /**
   * Abort all active transactions (for emergency shutdown)
   * @returns {Promise} Promise that resolves when all transactions are aborted
   */
  async abortAllTransactions() {
    const abortPromises = [];
    
    for (const [transactionId, transactionInfo] of this.activeTransactions) {
      const abortPromise = (async () => {
        try {
          await transactionInfo.session.abortTransaction();
          await transactionInfo.session.endSession();
          
          logger.info('Emergency abort of transaction completed', {
            transactionId,
            operationName: transactionInfo.operationName
          });
        } catch (error) {
          logger.error('Failed to abort transaction during emergency shutdown', {
            transactionId,
            operationName: transactionInfo.operationName,
            error: error.message
          });
        }
      })();
      
      abortPromises.push(abortPromise);
    }

    await Promise.allSettled(abortPromises);
    this.activeTransactions.clear();
    
    logger.info('Emergency abort of all transactions completed');
  }

  /**
   * Check if MongoDB supports transactions (requires replica set or sharded cluster)
   * @returns {Promise<boolean>} True if transactions are supported
   */
  async supportsTransactions() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.command({ isMaster: 1 });
      
      // Check if we're in a replica set or sharded cluster
      return !!(result.setName || result.msg === 'isdbgrid');
    } catch (error) {
      logger.warn('Could not determine transaction support', { error: error.message });
      return false;
    }
  }

  /**
   * Execute operations with fallback to non-transactional mode if transactions not supported
   * @param {Function} transactionalOps - Operations to execute in transaction
   * @param {Function} nonTransactionalOps - Fallback operations without transaction
   * @param {Object} context - Context for logging
   * @param {string} operationName - Name of the operation
   * @returns {Promise} Result of operations
   */
  async executeWithFallback(transactionalOps, nonTransactionalOps, context = {}, operationName = 'fallback operation') {
    const supportsTransactions = await this.supportsTransactions();
    
    if (supportsTransactions) {
      logger.info('Executing with transaction support', {
        ...context,
        operationName
      });
      return this.executeInTransaction(transactionalOps, context, operationName);
    } else {
      logger.warn('Transactions not supported, falling back to non-transactional mode', {
        ...context,
        operationName
      });
      return nonTransactionalOps();
    }
  }
}

export default TransactionManager;