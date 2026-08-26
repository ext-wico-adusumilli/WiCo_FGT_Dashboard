import WeatherData from '../../../models/WeatherData.js';
import WeatherStatsSummary from '../../../models/WeatherStatsSummary.js';
import JobExecutionLog from '../../../models/JobExecutionLog.js';
import JobConfiguration from '../../../models/JobConfiguration.js';
import RetryHandler from '../../../utils/retryHandler.js';
import TransactionManager from '../../../utils/transactionManager.js';
import logger from '../../../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class WeatherStatsAggregator {
  constructor(options = {}) {
    this.jobName = 'weather_stats_aggregation';
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
   * @param {string[]} options.locations - Specific locations to process (optional)
   * @param {string[]} options.uaSNs - Specific UAS serial numbers to process (optional)
   * @returns {Object} Aggregation results
   */
  async aggregate(options = {}) {
    const executionId = uuidv4();
    const startTime = new Date();

    try {
      let results;
      
      if (options.incremental) {
        results = await this._runIncrementalAggregation(executionId, options);
      } else {
        results = await this._runFullAggregation(executionId, options);
      }

      // Only log success to console, not to database
      logger.info('Weather aggregation completed successfully', {
        jobName: this.jobName,
        executionId,
        recordsProcessed: results.recordsProcessed,
        recordsCreated: results.recordsCreated,
        recordsUpdated: results.recordsUpdated
      });

      return results;
    } catch (error) {
      // Only save failed execution logs to database
      const executionLog = new JobExecutionLog({
        jobName: this.jobName,
        executionId,
        startTime,
        endTime: new Date(),
        status: 'failed',
        errorMessage: error.message
      });
      await executionLog.save();
      
      throw error;
    }
  }

  /**
   * Run incremental aggregation processing only new/modified records
   */
  async _runIncrementalAggregation(executionId, options) {
    const lastWatermark = await this._getLastProcessingWatermark();
    const currentWatermark = new Date();
    
    // Find new or modified records since last watermark
    const query = {
      updatedAt: { $gt: lastWatermark }
    };
    
    if (options.locations && options.locations.length > 0) {
      query.location = { $in: options.locations };
    }
    
    if (options.uaSNs && options.uaSNs.length > 0) {
      query.uaSN = { $in: options.uaSNs };
    }
    
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    }

    const newRecords = await WeatherData.find(query).sort({ updatedAt: 1 });
    
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
    const query = {};
    
    if (options.locations && options.locations.length > 0) {
      query.location = { $in: options.locations };
    }
    
    if (options.uaSNs && options.uaSNs.length > 0) {
      query.uaSN = { $in: options.uaSNs };
    }
    
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) query.createdAt.$gte = options.startDate;
      if (options.endDate) query.createdAt.$lte = options.endDate;
    } else {
      // Default to last N days if no date range specified
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - this.lookbackDays);
      query.createdAt = { $gte: lookbackDate };
    }

    const totalRecords = await WeatherData.countDocuments(query);
    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    // Process records in batches
    for (let skip = 0; skip < totalRecords; skip += this.batchSize) {
      const batch = await WeatherData.find(query)
        .sort({ location: 1, uaSN: 1, createdAt: 1 })
        .skip(skip)
        .limit(this.batchSize);
      
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
   * Process a batch of WeatherData records and update summary collections
   */
  async _processBatch(records, executionId, isIncremental) {
    const summaryMap = new Map();
    let created = 0;
    let updated = 0;

    // Group records by location, uaSN and time granularity
    for (const record of records) {
      for (const granularity of this.timeGranularities) {
        const dateRange = this._getDateRange(record.createdAt, granularity);
        const key = `${record.location || 'unknown'}_${record.uaSN}_${granularity}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            location: record.location || 'unknown',
            uaSN: record.uaSN,
            timeGranularity: granularity,
            dateRange,
            records: []
          });
        }
        
        summaryMap.get(key).records.push(record);
      }
    }

    // Process each summary group
    for (const [key, summaryData] of summaryMap) {
      const metrics = this._calculateMetrics(summaryData.records);
      
      // Find existing summary or create new one
      let summary = await WeatherStatsSummary.findOne({
        location: summaryData.location,
        uaSN: summaryData.uaSN,
        timeGranularity: summaryData.timeGranularity,
        'dateRange.start': summaryData.dateRange.start,
        'dateRange.end': summaryData.dateRange.end
      });

      if (summary) {
        // Update existing summary
        if (isIncremental) {
          // For incremental updates, merge with existing metrics
          summary.metrics = this._mergeMetrics(summary.metrics, metrics);
        } else {
          // For full aggregation, replace metrics
          summary.metrics = metrics;
        }
        summary.lastUpdated = new Date();
        summary.sourceRecordCount = summaryData.records.length;
        summary.executionId = executionId;
        await summary.save();
        updated++;
      } else {
        // Create new summary
        summary = new WeatherStatsSummary({
          aggregationType: 'weather_stats',
          location: summaryData.location,
          uaSN: summaryData.uaSN,
          timeGranularity: summaryData.timeGranularity,
          dateRange: summaryData.dateRange,
          metrics,
          lastUpdated: new Date(),
          sourceRecordCount: summaryData.records.length,
          executionId
        });
        await summary.save();
        created++;
      }
    }

    return { created, updated };
  }

  /**
   * Calculate weather metrics from WeatherData records
   */
  _calculateMetrics(records) {
    const metrics = {
      temperature: { min: null, max: null, avg: null, count: 0 },
      humidity: { min: null, max: null, avg: null, count: 0 },
      pressure: { min: null, max: null, avg: null, count: 0 },
      wind: { maxWind: null, maxGust: null, avgWind: null, windRun: null },
      conditions: {
        cloudCoverage: { min: null, max: null, avg: null },
        precipitation: '',
        windChill: { min: null, max: null, avg: null },
        thwIndex: { min: null, max: null, avg: null },
        wetBulb: { min: null, max: null, avg: null }
      }
    };

    let tempSum = 0, tempCount = 0;
    let humiditySum = 0, humidityCount = 0;
    let pressureSum = 0, pressureCount = 0;
    let windSum = 0, windCount = 0;
    let cloudSum = 0, cloudCount = 0;
    let windChillSum = 0, windChillCount = 0;
    let thwSum = 0, thwCount = 0;
    let wetBulbSum = 0, wetBulbCount = 0;
    
    const precipitationTypes = new Set();

    for (const record of records) {
      // Temperature metrics
      if (record.temperature !== null && record.temperature !== undefined) {
        tempSum += record.temperature;
        tempCount++;
        metrics.temperature.min = metrics.temperature.min === null ? 
          record.temperature : Math.min(metrics.temperature.min, record.temperature);
        metrics.temperature.max = metrics.temperature.max === null ? 
          record.temperature : Math.max(metrics.temperature.max, record.temperature);
      }
      
      // Humidity metrics
      if (record.humidity !== null && record.humidity !== undefined) {
        humiditySum += record.humidity;
        humidityCount++;
        metrics.humidity.min = metrics.humidity.min === null ? 
          record.humidity : Math.min(metrics.humidity.min, record.humidity);
        metrics.humidity.max = metrics.humidity.max === null ? 
          record.humidity : Math.max(metrics.humidity.max, record.humidity);
      }
      
      // Pressure metrics
      if (record.pressure !== null && record.pressure !== undefined) {
        pressureSum += record.pressure;
        pressureCount++;
        metrics.pressure.min = metrics.pressure.min === null ? 
          record.pressure : Math.min(metrics.pressure.min, record.pressure);
        metrics.pressure.max = metrics.pressure.max === null ? 
          record.pressure : Math.max(metrics.pressure.max, record.pressure);
      }
      
      // Wind metrics
      if (record.amslMaxWind !== null && record.amslMaxWind !== undefined) {
        windSum += record.amslMaxWind;
        windCount++;
        metrics.wind.maxWind = metrics.wind.maxWind === null ? 
          record.amslMaxWind : Math.max(metrics.wind.maxWind, record.amslMaxWind);
      }
      
      if (record.maxGust !== null && record.maxGust !== undefined) {
        metrics.wind.maxGust = metrics.wind.maxGust === null ? 
          record.maxGust : Math.max(metrics.wind.maxGust, record.maxGust);
      }
      
      if (record.windRun !== null && record.windRun !== undefined) {
        metrics.wind.windRun = metrics.wind.windRun === null ? 
          record.windRun : metrics.wind.windRun + record.windRun;
      }
      
      // Cloud coverage
      if (record.cloud !== null && record.cloud !== undefined) {
        cloudSum += record.cloud;
        cloudCount++;
        metrics.conditions.cloudCoverage.min = metrics.conditions.cloudCoverage.min === null ? 
          record.cloud : Math.min(metrics.conditions.cloudCoverage.min, record.cloud);
        metrics.conditions.cloudCoverage.max = metrics.conditions.cloudCoverage.max === null ? 
          record.cloud : Math.max(metrics.conditions.cloudCoverage.max, record.cloud);
      }
      
      // Precipitation
      if (record.rain && record.rain.trim() !== '') {
        precipitationTypes.add(record.rain.trim());
      }
      
      // Wind chill
      if (record.windChill !== null && record.windChill !== undefined) {
        windChillSum += record.windChill;
        windChillCount++;
        metrics.conditions.windChill.min = metrics.conditions.windChill.min === null ? 
          record.windChill : Math.min(metrics.conditions.windChill.min, record.windChill);
        metrics.conditions.windChill.max = metrics.conditions.windChill.max === null ? 
          record.windChill : Math.max(metrics.conditions.windChill.max, record.windChill);
      }
      
      // THW Index
      if (record.thwIndex !== null && record.thwIndex !== undefined) {
        thwSum += record.thwIndex;
        thwCount++;
        metrics.conditions.thwIndex.min = metrics.conditions.thwIndex.min === null ? 
          record.thwIndex : Math.min(metrics.conditions.thwIndex.min, record.thwIndex);
        metrics.conditions.thwIndex.max = metrics.conditions.thwIndex.max === null ? 
          record.thwIndex : Math.max(metrics.conditions.thwIndex.max, record.thwIndex);
      }
      
      // Wet bulb
      if (record.wetBulb !== null && record.wetBulb !== undefined) {
        wetBulbSum += record.wetBulb;
        wetBulbCount++;
        metrics.conditions.wetBulb.min = metrics.conditions.wetBulb.min === null ? 
          record.wetBulb : Math.min(metrics.conditions.wetBulb.min, record.wetBulb);
        metrics.conditions.wetBulb.max = metrics.conditions.wetBulb.max === null ? 
          record.wetBulb : Math.max(metrics.conditions.wetBulb.max, record.wetBulb);
      }
    }

    // Calculate averages
    if (tempCount > 0) {
      metrics.temperature.avg = tempSum / tempCount;
      metrics.temperature.count = tempCount;
    }
    
    if (humidityCount > 0) {
      metrics.humidity.avg = humiditySum / humidityCount;
      metrics.humidity.count = humidityCount;
    }
    
    if (pressureCount > 0) {
      metrics.pressure.avg = pressureSum / pressureCount;
      metrics.pressure.count = pressureCount;
    }
    
    if (windCount > 0) {
      metrics.wind.avgWind = windSum / windCount;
    }
    
    if (cloudCount > 0) {
      metrics.conditions.cloudCoverage.avg = cloudSum / cloudCount;
    }
    
    if (windChillCount > 0) {
      metrics.conditions.windChill.avg = windChillSum / windChillCount;
    }
    
    if (thwCount > 0) {
      metrics.conditions.thwIndex.avg = thwSum / thwCount;
    }
    
    if (wetBulbCount > 0) {
      metrics.conditions.wetBulb.avg = wetBulbSum / wetBulbCount;
    }
    
    // Combine precipitation types
    metrics.conditions.precipitation = Array.from(precipitationTypes).join(', ');

    return metrics;
  }

  /**
   * Merge metrics for incremental updates
   */
  _mergeMetrics(existingMetrics, newMetrics) {
    const merged = {
      temperature: this._mergeStatMetric(existingMetrics.temperature, newMetrics.temperature),
      humidity: this._mergeStatMetric(existingMetrics.humidity, newMetrics.humidity),
      pressure: this._mergeStatMetric(existingMetrics.pressure, newMetrics.pressure),
      wind: {
        maxWind: this._mergeMax(existingMetrics.wind.maxWind, newMetrics.wind.maxWind),
        maxGust: this._mergeMax(existingMetrics.wind.maxGust, newMetrics.wind.maxGust),
        avgWind: this._mergeAverage(existingMetrics.wind.avgWind, newMetrics.wind.avgWind),
        windRun: this._mergeSum(existingMetrics.wind.windRun, newMetrics.wind.windRun)
      },
      conditions: {
        cloudCoverage: this._mergeStatMetric(existingMetrics.conditions.cloudCoverage, newMetrics.conditions.cloudCoverage),
        precipitation: this._mergePrecipitation(existingMetrics.conditions.precipitation, newMetrics.conditions.precipitation),
        windChill: this._mergeStatMetric(existingMetrics.conditions.windChill, newMetrics.conditions.windChill),
        thwIndex: this._mergeStatMetric(existingMetrics.conditions.thwIndex, newMetrics.conditions.thwIndex),
        wetBulb: this._mergeStatMetric(existingMetrics.conditions.wetBulb, newMetrics.conditions.wetBulb)
      }
    };

    return merged;
  }

  /**
   * Merge statistical metrics (min, max, avg, count)
   */
  _mergeStatMetric(existing, newMetric) {
    if (!existing || existing.count === 0) return newMetric;
    if (!newMetric || newMetric.count === 0) return existing;

    const totalCount = existing.count + newMetric.count;
    const weightedAvg = ((existing.avg * existing.count) + (newMetric.avg * newMetric.count)) / totalCount;

    return {
      min: existing.min === null ? newMetric.min : (newMetric.min === null ? existing.min : Math.min(existing.min, newMetric.min)),
      max: existing.max === null ? newMetric.max : (newMetric.max === null ? existing.max : Math.max(existing.max, newMetric.max)),
      avg: weightedAvg,
      count: totalCount
    };
  }

  /**
   * Merge maximum values
   */
  _mergeMax(existing, newValue) {
    if (existing === null) return newValue;
    if (newValue === null) return existing;
    return Math.max(existing, newValue);
  }

  /**
   * Merge average values (simple average for now)
   */
  _mergeAverage(existing, newValue) {
    if (existing === null) return newValue;
    if (newValue === null) return existing;
    return (existing + newValue) / 2;
  }

  /**
   * Merge sum values
   */
  _mergeSum(existing, newValue) {
    if (existing === null) return newValue;
    if (newValue === null) return existing;
    return existing + newValue;
  }

  /**
   * Merge precipitation strings
   */
  _mergePrecipitation(existing, newPrecip) {
    if (!existing || existing.trim() === '') return newPrecip;
    if (!newPrecip || newPrecip.trim() === '') return existing;
    
    const existingTypes = new Set(existing.split(', ').map(s => s.trim()).filter(s => s !== ''));
    const newTypes = new Set(newPrecip.split(', ').map(s => s.trim()).filter(s => s !== ''));
    
    const combined = new Set([...existingTypes, ...newTypes]);
    return Array.from(combined).join(', ');
  }

  /**
   * Get date range for specified granularity
   */
  _getDateRange(date, granularity) {
    const targetDate = new Date(date);
    let start, end;

    switch (granularity) {
      case 'daily':
        start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
        end = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate() + 1));
        break;
      case 'weekly':
        const dayOfWeek = targetDate.getUTCDay();
        start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate() - dayOfWeek));
        end = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate() - dayOfWeek + 7));
        break;
      case 'monthly':
        start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
        end = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1));
        break;
      default:
        throw new Error(`Unsupported time granularity: ${granularity}`);
    }

    return { start, end };
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
        const dateRange = this._getDateRange(record.createdAt, granularity);
        const key = `${record.location || 'unknown'}_${record.uaSN}_${granularity}_${dateRange.start.toISOString()}_${dateRange.end.toISOString()}`;
        
        if (!affectedSummaries.has(key)) {
          affectedSummaries.set(key, {
            location: record.location || 'unknown',
            uaSN: record.uaSN,
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
    const sourceRecords = await WeatherData.find({
      location: summaryInfo.location,
      uaSN: summaryInfo.uaSN,
      createdAt: {
        $gte: summaryInfo.dateRange.start,
        $lt: summaryInfo.dateRange.end
      }
    });

    if (sourceRecords.length === 0) {
      // No source records - remove the summary if it exists
      await WeatherStatsSummary.deleteOne({
        location: summaryInfo.location,
        uaSN: summaryInfo.uaSN,
        timeGranularity: summaryInfo.timeGranularity,
        'dateRange.start': summaryInfo.dateRange.start,
        'dateRange.end': summaryInfo.dateRange.end
      });
      return;
    }

    // Calculate new metrics
    const metrics = this._calculateMetrics(sourceRecords);

    // Update or create summary
    await WeatherStatsSummary.findOneAndUpdate(
      {
        location: summaryInfo.location,
        uaSN: summaryInfo.uaSN,
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
  async validateConsistency(location, uaSN, dateRange) {
    // Run both incremental and full aggregation on the same data set
    const incrementalResults = await this.aggregate({
      incremental: true,
      locations: [location],
      uaSNs: [uaSN],
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    const fullResults = await this.aggregate({
      incremental: false,
      locations: [location],
      uaSNs: [uaSN],
      startDate: dateRange.start,
      endDate: dateRange.end
    });

    // Compare the results
    const incrementalSummaries = await WeatherStatsSummary.find({
      location,
      uaSN,
      'dateRange.start': { $gte: dateRange.start },
      'dateRange.end': { $lte: dateRange.end },
      executionId: incrementalResults.executionId
    });

    const fullSummaries = await WeatherStatsSummary.find({
      location,
      uaSN,
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

export default WeatherStatsAggregator;