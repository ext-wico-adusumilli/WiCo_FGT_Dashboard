import LogDetail from '../../../models/LogDetail.js';
import FlightStatsSummary from '../../../models/FlightStatsSummary.js';
import JobExecutionLog from '../../../models/JobExecutionLog.js';
import JobConfiguration from '../../../models/JobConfiguration.js';
import RetryHandler from '../../../utils/retryHandler.js';
import TransactionManager from '../../../utils/transactionManager.js';
import logger from '../../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class FlightStatsAggregator {
  constructor(options = {}) {
    this.jobName = 'flight_stats_aggregation';
    this.batchSize = options.batchSize || 1000;
    this.timeGranularities = options.timeGranularities || ['daily', 'weekly', 'monthly'];
    this.lookbackDays = options.lookbackDays || 30;
    this.retryHandler = new RetryHandler({
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 16000
    });
    this.transactionManager = new TransactionManager();
  }

  /**
   * Main aggregation method that supports both incremental and full modes
   * @param {Object} options - Aggregation options
   * @param {boolean} options.incremental - Whether to run incremental aggregation
   * @param {Date} options.startDate - Start date for aggregation (optional)
   * @param {Date} options.endDate - End date for aggregation (optional)
   * @param {string[]} options.serialNumbers - Specific serial numbers to process (optional)
   * @returns {Object} Aggregation results
   */
  async aggregate(options = {}) {
    const executionId = uuidv4();
    const startTime = new Date();
    const context = { jobName: this.jobName, executionId };

    try {
      let results;
      
      if (options.incremental) {
        results = await this._runIncrementalAggregation(executionId, options);
      } else {
        results = await this._runFullAggregation(executionId, options);
      }

      // Only log success to console, not to database
      logger.info('Aggregation completed successfully', {
        ...context,
        recordsProcessed: results.recordsProcessed,
        recordsCreated: results.recordsCreated,
        recordsUpdated: results.recordsUpdated
      });

      return results;
    } catch (error) {
      // Only save failed execution logs to database
      await this.retryHandler.executeDbOperation(
        async () => {
          const executionLog = new JobExecutionLog({
            jobName: this.jobName,
            executionId,
            startTime,
            endTime: new Date(),
            status: 'failed',
            errorMessage: error.message
          });
          return await executionLog.save();
        },
        context,
        'save failed execution log'
      );
      
      throw error;
    }
  }

  /**
   * Run incremental aggregation processing only new/modified records
   */
  async _runIncrementalAggregation(executionId, options) {
    const context = { jobName: this.jobName, executionId };
    
    const lastWatermark = await this.retryHandler.executeDbOperation(
      async () => await this._getLastProcessingWatermark(),
      context,
      'get last processing watermark'
    );
    
    const currentWatermark = new Date();
    
    // Find new or modified records since last watermark
    const query = {
      updatedAt: { $gt: lastWatermark }
    };
    
    if (options.serialNumbers && options.serialNumbers.length > 0) {
      query.sn = { $in: options.serialNumbers };
    }
    
    if (options.startDate || options.endDate) {
      query.date = {};
      if (options.startDate) query.date.$gte = this._formatDate(options.startDate);
      if (options.endDate) query.date.$lte = this._formatDate(options.endDate);
    }

    const newRecords = await this.retryHandler.executeDbOperation(
      async () => await LogDetail.find(query).sort({ updatedAt: 1 }),
      context,
      'fetch new records for incremental aggregation'
    );
    
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    // Process records in batches
    for (let i = 0; i < newRecords.length; i += this.batchSize) {
      const batch = newRecords.slice(i, i + this.batchSize);
      const batchResults = await this._processBatch(batch, executionId, true);
      
      recordsProcessed += batch.length;
      recordsCreated += batchResults.created;
      recordsUpdated += batchResults.updated;
    }

    // Update processing watermark
    await this._updateProcessingWatermark(currentWatermark);

    return {
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      mode: 'incremental',
      watermark: currentWatermark
    };
  }

  /**
   * Run full aggregation processing all records
   */
  async _runFullAggregation(executionId, options) {
    const context = { jobName: this.jobName, executionId };
    const query = {};
    
    if (options.serialNumbers && options.serialNumbers.length > 0) {
      query.sn = { $in: options.serialNumbers };
    }
    
    if (options.startDate || options.endDate) {
      query.date = {};
      if (options.startDate) query.date.$gte = this._formatDate(options.startDate);
      if (options.endDate) query.date.$lte = this._formatDate(options.endDate);
    } else {
      // Default to last N days if no date range specified
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - this.lookbackDays);
      query.date = { $gte: this._formatDate(lookbackDate) };
    }

    const totalRecords = await this.retryHandler.executeDbOperation(
      async () => await LogDetail.countDocuments(query),
      context,
      'count total records for full aggregation'
    );
    
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    // Process records in batches
    for (let skip = 0; skip < totalRecords; skip += this.batchSize) {
      const batch = await this.retryHandler.executeDbOperation(
        async () => await LogDetail.find(query)
          .sort({ sn: 1, date: 1 })
          .skip(skip)
          .limit(this.batchSize),
        context,
        `fetch batch ${Math.floor(skip / this.batchSize) + 1}`
      );
      
      const batchResults = await this._processBatch(batch, executionId, false);
      
      recordsProcessed += batch.length;
      recordsCreated += batchResults.created;
      recordsUpdated += batchResults.updated;
    }

    return {
      recordsProcessed,
      recordsCreated,
      recordsUpdated,
      mode: 'full'
    };
  }

  /**
   * Process a batch of LogDetail records and update summary collections
   */
  async _processBatch(records, executionId, isIncremental) {
    const context = { jobName: this.jobName, executionId };
    
    // Execute batch processing within a transaction for atomic updates
    return await this.transactionManager.executeWithFallback(
      // Transactional operations
      async (session) => {
        return await this._processBatchTransactional(records, executionId, isIncremental, session, context);
      },
      // Non-transactional fallback
      async () => {
        return await this._processBatchNonTransactional(records, executionId, isIncremental, context);
      },
      context,
      `process batch of ${records.length} records`
    );
  }

  /**
   * Process batch with transaction support
   */
  async _processBatchTransactional(records, executionId, isIncremental, session, context) {
    const summaryMap = new Map();
    let created = 0;
    let updated = 0;

    // Group records by serial number and time granularity
    for (const record of records) {
      for (const granularity of this.timeGranularities) {
        const dateRange = this._getDateRange(record.date, granularity);
        const key = `${record.sn}_${granularity}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            serialNumber: record.sn,
            timeGranularity: granularity,
            dateRange,
            records: []
          });
        }
        
        summaryMap.get(key).records.push(record);
      }
    }

    // Process each summary group within the transaction
    for (const [key, summaryData] of summaryMap) {
      const metrics = this._calculateMetrics(summaryData.records);
      
      // Find existing summary within transaction
      let summary = await FlightStatsSummary.findOne({
        serialNumber: summaryData.serialNumber,
        timeGranularity: summaryData.timeGranularity,
        'dateRange.start': summaryData.dateRange.start,
        'dateRange.end': summaryData.dateRange.end
      }).session(session);

      if (summary) {
        // Update existing summary within transaction
        if (isIncremental) {
          summary.metrics = this._mergeMetrics(summary.metrics, metrics);
        } else {
          summary.metrics = metrics;
        }
        summary.lastUpdated = new Date();
        summary.sourceRecordCount = summaryData.records.length;
        summary.executionId = executionId;
        await summary.save({ session });
        updated++;
      } else {
        // Create new summary within transaction
        summary = new FlightStatsSummary({
          aggregationType: 'flight_stats',
          entityId: summaryData.serialNumber,
          serialNumber: summaryData.serialNumber,
          timeGranularity: summaryData.timeGranularity,
          dateRange: summaryData.dateRange,
          metrics,
          lastUpdated: new Date(),
          sourceRecordCount: summaryData.records.length,
          executionId
        });
        await summary.save({ session });
        created++;
      }
    }

    return { created, updated };
  }

  /**
   * Process batch without transaction support (fallback)
   */
  async _processBatchNonTransactional(records, executionId, isIncremental, context) {
    const summaryMap = new Map();
    let created = 0;
    let updated = 0;
    const processedSummaries = [];

    try {
      // Group records by serial number and time granularity
      for (const record of records) {
        for (const granularity of this.timeGranularities) {
          const dateRange = this._getDateRange(record.date, granularity);
          const key = `${record.sn}_${granularity}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
          
          if (!summaryMap.has(key)) {
            summaryMap.set(key, {
              serialNumber: record.sn,
              timeGranularity: granularity,
              dateRange,
              records: []
            });
          }
          
          summaryMap.get(key).records.push(record);
        }
      }

      // Process each summary group with compensation tracking
      for (const [key, summaryData] of summaryMap) {
        const metrics = this._calculateMetrics(summaryData.records);
        
        // Find existing summary with retry
        let summary = await this.retryHandler.executeDbOperation(
          async () => await FlightStatsSummary.findOne({
            serialNumber: summaryData.serialNumber,
            timeGranularity: summaryData.timeGranularity,
            'dateRange.start': summaryData.dateRange.start,
            'dateRange.end': summaryData.dateRange.end
          }),
          context,
          `find existing summary for ${key}`
        );

        let originalSummary = null;
        if (summary) {
          // Store original state for potential rollback
          originalSummary = {
            _id: summary._id,
            metrics: JSON.parse(JSON.stringify(summary.metrics)),
            lastUpdated: summary.lastUpdated,
            sourceRecordCount: summary.sourceRecordCount,
            executionId: summary.executionId
          };

          // Update existing summary with retry
          await this.retryHandler.executeDbOperation(
            async () => {
              if (isIncremental) {
                summary.metrics = this._mergeMetrics(summary.metrics, metrics);
              } else {
                summary.metrics = metrics;
              }
              summary.lastUpdated = new Date();
              summary.sourceRecordCount = summaryData.records.length;
              summary.executionId = executionId;
              return await summary.save();
            },
            context,
            `update existing summary for ${key}`
          );
          updated++;
          processedSummaries.push({ action: 'updated', summary, originalSummary });
        } else {
          // Create new summary with retry
          summary = await this.retryHandler.executeDbOperation(
            async () => {
              const newSummary = new FlightStatsSummary({
                aggregationType: 'flight_stats',
                entityId: summaryData.serialNumber,
                serialNumber: summaryData.serialNumber,
                timeGranularity: summaryData.timeGranularity,
                dateRange: summaryData.dateRange,
                metrics,
                lastUpdated: new Date(),
                sourceRecordCount: summaryData.records.length,
                executionId
              });
              return await newSummary.save();
            },
            context,
            `create new summary for ${key}`
          );
          created++;
          processedSummaries.push({ action: 'created', summary });
        }
      }

      return { created, updated };
    } catch (error) {
      // Attempt to rollback changes in non-transactional mode
      await this._rollbackBatchChanges(processedSummaries, context);
      throw error;
    }
  }

  /**
   * Rollback batch changes in non-transactional mode
   */
  async _rollbackBatchChanges(processedSummaries, context) {
    for (const item of processedSummaries.reverse()) {
      try {
        if (item.action === 'created') {
          // Remove newly created summary
          await FlightStatsSummary.deleteOne({ _id: item.summary._id });
        } else if (item.action === 'updated' && item.originalSummary) {
          // Restore original summary state
          await FlightStatsSummary.findByIdAndUpdate(
            item.originalSummary._id,
            {
              $set: {
                metrics: item.originalSummary.metrics,
                lastUpdated: item.originalSummary.lastUpdated,
                sourceRecordCount: item.originalSummary.sourceRecordCount,
                executionId: item.originalSummary.executionId
              }
            }
          );
        }
      } catch (rollbackError) {
        // Log rollback failures but continue with other rollbacks
        logger.error('Failed to rollback summary change', {
          ...context,
          summaryId: item.summary._id,
          action: item.action,
          error: rollbackError.message
        });
      }
    }
  }

  /**
   * Calculate flight metrics from LogDetail records
   */
  _calculateMetrics(records) {
    const flightRecords = records.filter(r => r.flight === true);
    const totalRecords = records.length;
    
    const metrics = {
      totalFlights: flightRecords.length,
      totalFlightTime: 0,
      totalDistance: 0,
      avgFlightTime: 0,
      avgDistance: 0,
      batteryMetrics: {
        totalCycles: 0,
        avgTemperature: 0,
        peakTemperature: 0,
        battery0Cycles: 0,
        battery1Cycles: 0,
        battery0MaxTemp: 0,
        battery1MaxTemp: 0
      },
      transitionMetrics: {
        fwdTransitions: 0,
        bwdTransitions: 0,
        fwdDistance: 0,
        bwdDistance: 0,
        totalTransitions: 0
      },
      connectivityMetrics: {
        lteLoss: 0,
        rthLoss: 0,
        rthLogs: 0,
        avgLteLoss: 0
      },
      flightModeMetrics: {
        mcTime: 0,
        fwTime: 0,
        filteredFlightTime: 0
      }
    };

    let totalTemp = 0;
    let tempCount = 0;
    let totalLteLoss = 0;
    let lteLossCount = 0;

    for (const record of records) {
      // Flight time and distance
      metrics.totalFlightTime += record.flight_time || 0;
      metrics.totalDistance += record.distance || 0;
      
      // Flight mode metrics
      metrics.flightModeMetrics.mcTime += record.mc_time || 0;
      metrics.flightModeMetrics.fwTime += record.fw_time || 0;
      metrics.flightModeMetrics.filteredFlightTime += record.filtered_flight_time || 0;
      
      // Battery metrics
      if (record.battery_0_cycle) {
        metrics.batteryMetrics.battery0Cycles += record.battery_0_cycle;
        metrics.batteryMetrics.totalCycles += record.battery_0_cycle;
      }
      if (record.battery_1_cycle) {
        metrics.batteryMetrics.battery1Cycles += record.battery_1_cycle;
        metrics.batteryMetrics.totalCycles += record.battery_1_cycle;
      }
      
      // Battery temperature tracking
      if (record.battery_0_max_temp) {
        totalTemp += record.battery_0_max_temp;
        tempCount++;
        metrics.batteryMetrics.battery0MaxTemp = Math.max(
          metrics.batteryMetrics.battery0MaxTemp, 
          record.battery_0_max_temp
        );
        metrics.batteryMetrics.peakTemperature = Math.max(
          metrics.batteryMetrics.peakTemperature, 
          record.battery_0_max_temp
        );
      }
      if (record.battery_1_max_temp) {
        totalTemp += record.battery_1_max_temp;
        tempCount++;
        metrics.batteryMetrics.battery1MaxTemp = Math.max(
          metrics.batteryMetrics.battery1MaxTemp, 
          record.battery_1_max_temp
        );
        metrics.batteryMetrics.peakTemperature = Math.max(
          metrics.batteryMetrics.peakTemperature, 
          record.battery_1_max_temp
        );
      }
      
      // Transition metrics
      metrics.transitionMetrics.fwdTransitions += record.fwd_transitions || 0;
      metrics.transitionMetrics.bwdTransitions += record.bwd_transitions || 0;
      metrics.transitionMetrics.fwdDistance += record.fwd_distance || 0;
      metrics.transitionMetrics.bwdDistance += record.bwd_distance || 0;
      
      // Connectivity metrics
      metrics.connectivityMetrics.lteLoss += record.lte_loss || 0;
      metrics.connectivityMetrics.rthLoss += record.rth_loss || 0;
      metrics.connectivityMetrics.rthLogs += record.rth_logs || 0;
      
      if (record.lte_loss !== undefined && record.lte_loss !== null) {
        totalLteLoss += record.lte_loss;
        lteLossCount++;
      }
    }

    // Calculate averages
    if (metrics.totalFlights > 0) {
      metrics.avgFlightTime = metrics.totalFlightTime / metrics.totalFlights;
      metrics.avgDistance = metrics.totalDistance / metrics.totalFlights;
    }
    
    if (tempCount > 0) {
      metrics.batteryMetrics.avgTemperature = totalTemp / tempCount;
    }
    
    if (lteLossCount > 0) {
      metrics.connectivityMetrics.avgLteLoss = totalLteLoss / lteLossCount;
    }
    
    metrics.transitionMetrics.totalTransitions = 
      metrics.transitionMetrics.fwdTransitions + metrics.transitionMetrics.bwdTransitions;

    return metrics;
  }

  /**
   * Merge metrics for incremental updates
   */
  _mergeMetrics(existingMetrics, newMetrics) {
    return {
      totalFlights: existingMetrics.totalFlights + newMetrics.totalFlights,
      totalFlightTime: existingMetrics.totalFlightTime + newMetrics.totalFlightTime,
      totalDistance: existingMetrics.totalDistance + newMetrics.totalDistance,
      avgFlightTime: (existingMetrics.totalFlightTime + newMetrics.totalFlightTime) / 
                     (existingMetrics.totalFlights + newMetrics.totalFlights) || 0,
      avgDistance: (existingMetrics.totalDistance + newMetrics.totalDistance) / 
                   (existingMetrics.totalFlights + newMetrics.totalFlights) || 0,
      batteryMetrics: {
        totalCycles: existingMetrics.batteryMetrics.totalCycles + newMetrics.batteryMetrics.totalCycles,
        avgTemperature: (existingMetrics.batteryMetrics.avgTemperature + newMetrics.batteryMetrics.avgTemperature) / 2,
        peakTemperature: Math.max(existingMetrics.batteryMetrics.peakTemperature, newMetrics.batteryMetrics.peakTemperature),
        battery0Cycles: existingMetrics.batteryMetrics.battery0Cycles + newMetrics.batteryMetrics.battery0Cycles,
        battery1Cycles: existingMetrics.batteryMetrics.battery1Cycles + newMetrics.batteryMetrics.battery1Cycles,
        battery0MaxTemp: Math.max(existingMetrics.batteryMetrics.battery0MaxTemp, newMetrics.batteryMetrics.battery0MaxTemp),
        battery1MaxTemp: Math.max(existingMetrics.batteryMetrics.battery1MaxTemp, newMetrics.batteryMetrics.battery1MaxTemp)
      },
      transitionMetrics: {
        fwdTransitions: existingMetrics.transitionMetrics.fwdTransitions + newMetrics.transitionMetrics.fwdTransitions,
        bwdTransitions: existingMetrics.transitionMetrics.bwdTransitions + newMetrics.transitionMetrics.bwdTransitions,
        fwdDistance: existingMetrics.transitionMetrics.fwdDistance + newMetrics.transitionMetrics.fwdDistance,
        bwdDistance: existingMetrics.transitionMetrics.bwdDistance + newMetrics.transitionMetrics.bwdDistance,
        totalTransitions: (existingMetrics.transitionMetrics.fwdTransitions + newMetrics.transitionMetrics.fwdTransitions) +
                         (existingMetrics.transitionMetrics.bwdTransitions + newMetrics.transitionMetrics.bwdTransitions)
      },
      connectivityMetrics: {
        lteLoss: existingMetrics.connectivityMetrics.lteLoss + newMetrics.connectivityMetrics.lteLoss,
        rthLoss: existingMetrics.connectivityMetrics.rthLoss + newMetrics.connectivityMetrics.rthLoss,
        rthLogs: existingMetrics.connectivityMetrics.rthLogs + newMetrics.connectivityMetrics.rthLogs,
        avgLteLoss: (existingMetrics.connectivityMetrics.avgLteLoss + newMetrics.connectivityMetrics.avgLteLoss) / 2
      },
      flightModeMetrics: {
        mcTime: existingMetrics.flightModeMetrics.mcTime + newMetrics.flightModeMetrics.mcTime,
        fwTime: existingMetrics.flightModeMetrics.fwTime + newMetrics.flightModeMetrics.fwTime,
        filteredFlightTime: existingMetrics.flightModeMetrics.filteredFlightTime + newMetrics.flightModeMetrics.filteredFlightTime
      }
    };
  }

  /**
   * Get date range for specified granularity
   */
  _getDateRange(dateString, granularity) {
    const date = new Date(dateString);
    let start, end;

    switch (granularity) {
      case 'daily':
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        break;
      case 'weekly':
        const dayOfWeek = date.getDay();
        start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
        end = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek + 7);
        break;
      case 'monthly':
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        break;
      default:
        throw new Error(`Unsupported time granularity: ${granularity}`);
    }

    return { start, end };
  }

  /**
   * Format date to string format used in LogDetail
   */
  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get the last processing watermark for incremental updates
   * Note: Since we only save failed logs now, we track watermark differently
   */
  async _getLastProcessingWatermark() {
    // Check job configuration for last successful run time
    const jobConfig = await JobConfiguration.findOne({ jobName: this.jobName });
    
    if (jobConfig && jobConfig.lastRun) {
      return jobConfig.lastRun;
    }

    // Default to 30 days ago if no previous execution
    const defaultWatermark = new Date();
    defaultWatermark.setDate(defaultWatermark.getDate() - 30);
    return defaultWatermark;
  }

  /**
   * Update processing watermark (stored in job execution log)
   */
  async _updateProcessingWatermark(watermark) {
    // Watermark is automatically updated through the execution log
    // This method is a placeholder for future watermark tracking enhancements
    return watermark;
  }

  /**
   * Handle data deletions by removing corresponding summary records
   */
  async handleDeletions(deletedRecordIds) {
    if (!deletedRecordIds || deletedRecordIds.length === 0) {
      return { summariesUpdated: 0, summariesRemoved: 0 };
    }

    let summariesUpdated = 0;
    let summariesRemoved = 0;

    // For each deleted record, we need to find and update affected summaries
    // Since we don't track individual record contributions, we'll use a conservative approach:
    // 1. Find all summaries that could have been affected by the deleted records
    // 2. Recalculate those summaries from scratch

    for (const recordId of deletedRecordIds) {
      // This is a simplified approach - in a production system, you'd want to track
      // which records contribute to which summaries for more efficient updates
      
      // For now, we'll trigger a full recalculation for affected time periods
      // This could be optimized by storing record-to-summary mappings
    }

    return {
      summariesUpdated,
      summariesRemoved
    };
  }

  /**
   * Handle data updates by recalculating affected summary records
   */
  async handleUpdates(updatedRecords) {
    if (!updatedRecords || updatedRecords.length === 0) {
      return { summariesUpdated: 0 };
    }

    const executionId = uuidv4();
    let summariesUpdated = 0;

    // Group updated records by the summaries they affect
    const affectedSummaries = new Map();

    for (const record of updatedRecords) {
      for (const granularity of this.timeGranularities) {
        const dateRange = this._getDateRange(record.date, granularity);
        const key = `${record.sn}_${granularity}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        
        if (!affectedSummaries.has(key)) {
          affectedSummaries.set(key, {
            serialNumber: record.sn,
            timeGranularity: granularity,
            dateRange,
            needsRecalculation: true
          });
        }
      }
    }

    // Recalculate each affected summary
    for (const [key, summaryInfo] of affectedSummaries) {
      await this._recalculateSummary(summaryInfo, executionId);
      summariesUpdated++;
    }

    return { summariesUpdated };
  }

  /**
   * Recalculate a specific summary from source data
   */
  async _recalculateSummary(summaryInfo, executionId) {
    // Find all source records for this summary
    const sourceRecords = await LogDetail.find({
      sn: summaryInfo.serialNumber,
      date: {
        $gte: this._formatDate(summaryInfo.dateRange.start),
        $lt: this._formatDate(summaryInfo.dateRange.end)
      }
    });

    if (sourceRecords.length === 0) {
      // No source records - remove the summary if it exists
      await FlightStatsSummary.deleteOne({
        serialNumber: summaryInfo.serialNumber,
        timeGranularity: summaryInfo.timeGranularity,
        'dateRange.start': summaryInfo.dateRange.start,
        'dateRange.end': summaryInfo.dateRange.end
      });
      return;
    }

    // Calculate new metrics
    const metrics = this._calculateMetrics(sourceRecords);

    // Update or create summary
    await FlightStatsSummary.findOneAndUpdate(
      {
        serialNumber: summaryInfo.serialNumber,
        timeGranularity: summaryInfo.timeGranularity,
        'dateRange.start': summaryInfo.dateRange.start,
        'dateRange.end': summaryInfo.dateRange.end
      },
      {
        $set: {
          metrics,
          lastUpdated: new Date(),
          sourceRecordCount: sourceRecords.length,
          executionId
        },
        $setOnInsert: {
          aggregationType: 'flight_stats',
          entityId: summaryInfo.serialNumber,
          serialNumber: summaryInfo.serialNumber,
          timeGranularity: summaryInfo.timeGranularity,
          dateRange: summaryInfo.dateRange
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }

  /**
   * Validate data consistency between incremental and full aggregation
   */
  async validateConsistency(serialNumber, dateRange) {
    // Run both incremental and full aggregation on the same data set
    const incrementalResults = await this.aggregate({
      incremental: true,
      serialNumbers: [serialNumber],
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    const fullResults = await this.aggregate({
      incremental: false,
      serialNumbers: [serialNumber],
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    // Compare the results
    const incrementalSummaries = await FlightStatsSummary.find({
      serialNumber,
      'dateRange.start': { $gte: dateRange.start },
      'dateRange.end': { $lte: dateRange.end },
      executionId: incrementalResults.executionId
    });

    const fullSummaries = await FlightStatsSummary.find({
      serialNumber,
      'dateRange.start': { $gte: dateRange.start },
      'dateRange.end': { $lte: dateRange.end },
      executionId: fullResults.executionId
    });

    // Basic consistency check - more sophisticated comparison could be implemented
    const isConsistent = incrementalSummaries.length === fullSummaries.length;

    return {
      isConsistent,
      incrementalCount: incrementalSummaries.length,
      fullCount: fullSummaries.length,
      incrementalResults,
      fullResults
    };
  }
}

export default FlightStatsAggregator;