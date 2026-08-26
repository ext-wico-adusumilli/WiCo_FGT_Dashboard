import aggregationConfig from '../config/aggregation.js';
import FlightStatsSummary from '../models/FlightStatsSummary.js';
import WeatherStatsSummary from '../models/WeatherStatsSummary.js';

/**
 * Data Freshness Tracker
 * Provides utilities for tracking and evaluating data freshness across summary collections
 */
class DataFreshnessTracker {
  constructor() {
    this.freshnessThresholds = aggregationConfig.processing.freshnessThresholds;
  }

  /**
   * Get data freshness status for a specific data type
   * @param {string} dataType - Type of data (flight_stats, weather_stats, etc.)
   * @param {Object} filters - Optional filters for specific records
   * @returns {Object} Freshness status information
   */
  async getDataFreshness(dataType, filters = {}) {
    const model = this._getModelForDataType(dataType);
    if (!model) {
      throw new Error(`Unsupported data type: ${dataType}`);
    }

    const threshold = this.freshnessThresholds[dataType];
    const freshnessThreshold = new Date(Date.now() - threshold);

    // Build query based on filters
    const query = { ...filters };
    
    // Get the most recent update timestamp
    const mostRecentRecord = await model.findOne(query)
      .sort({ lastUpdated: -1 })
      .select('lastUpdated sourceRecordCount executionId');

    if (!mostRecentRecord) {
      return {
        dataType,
        status: 'no_data',
        lastUpdated: null,
        dataAge: null,
        isFresh: false,
        threshold: threshold,
        message: 'No summary data available'
      };
    }

    const lastUpdated = mostRecentRecord.lastUpdated;
    const dataAge = Date.now() - lastUpdated.getTime();
    const isFresh = lastUpdated >= freshnessThreshold;

    // Get total record count for this data type
    const totalRecords = await model.countDocuments(query);

    // Get count of stale records
    const staleRecords = await model.countDocuments({
      ...query,
      lastUpdated: { $lt: freshnessThreshold }
    });

    return {
      dataType,
      status: isFresh ? 'fresh' : 'stale',
      lastUpdated,
      dataAge,
      dataAgeHours: Math.round(dataAge / (1000 * 60 * 60) * 100) / 100,
      isFresh,
      threshold,
      thresholdHours: Math.round(threshold / (1000 * 60 * 60) * 100) / 100,
      totalRecords,
      staleRecords,
      freshRecords: totalRecords - staleRecords,
      stalenessPercentage: totalRecords > 0 ? Math.round((staleRecords / totalRecords) * 100) : 0,
      message: this._getFreshnessMessage(isFresh, dataAge, threshold)
    };
  }

  /**
   * Get freshness status for all data types
   * @returns {Object} Comprehensive freshness status
   */
  async getAllDataFreshness() {
    const dataTypes = Object.keys(this.freshnessThresholds);
    const freshnessStatus = {};

    for (const dataType of dataTypes) {
      try {
        freshnessStatus[dataType] = await this.getDataFreshness(dataType);
      } catch (error) {
        freshnessStatus[dataType] = {
          dataType,
          status: 'error',
          error: error.message,
          isFresh: false
        };
      }
    }

    // Calculate overall system freshness
    const allStatuses = Object.values(freshnessStatus);
    const freshCount = allStatuses.filter(s => s.isFresh).length;
    const totalCount = allStatuses.length;
    
    return {
      overall: {
        status: freshCount === totalCount ? 'fresh' : (freshCount === 0 ? 'stale' : 'mixed'),
        freshDataTypes: freshCount,
        totalDataTypes: totalCount,
        freshnessPercentage: Math.round((freshCount / totalCount) * 100)
      },
      dataTypes: freshnessStatus,
      timestamp: new Date()
    };
  }

  /**
   * Get freshness metadata for dashboard responses
   * @param {string} dataType - Type of data being queried
   * @param {Object} filters - Filters used in the query
   * @returns {Object} Freshness metadata for API responses
   */
  async getFreshnessMetadata(dataType, filters = {}) {
    const freshness = await this.getDataFreshness(dataType, filters);
    
    return {
      lastUpdated: freshness.lastUpdated,
      dataAge: freshness.dataAge,
      dataAgeHours: freshness.dataAgeHours,
      isFresh: freshness.isFresh,
      status: freshness.status,
      source: 'summary',
      freshnessThreshold: freshness.thresholdHours,
      warning: freshness.isFresh ? null : freshness.message
    };
  }

  /**
   * Check if data is fresh enough for a specific use case
   * @param {string} dataType - Type of data
   * @param {Object} options - Options for freshness check
   * @param {number} options.customThresholdMs - Custom threshold in milliseconds
   * @param {Object} options.filters - Filters for specific records
   * @returns {boolean} Whether data is fresh enough
   */
  async isDataFresh(dataType, options = {}) {
    const { customThresholdMs, filters = {} } = options;
    const threshold = customThresholdMs || this.freshnessThresholds[dataType];
    
    if (!threshold) {
      throw new Error(`No freshness threshold configured for data type: ${dataType}`);
    }

    const model = this._getModelForDataType(dataType);
    if (!model) {
      throw new Error(`Unsupported data type: ${dataType}`);
    }

    const freshnessThreshold = new Date(Date.now() - threshold);
    
    const recentRecord = await model.findOne({
      ...filters,
      lastUpdated: { $gte: freshnessThreshold }
    });

    return !!recentRecord;
  }

  /**
   * Get data age indicators for multiple time granularities
   * @param {string} dataType - Type of data
   * @param {string} entityId - Entity identifier (serialNumber, location, etc.)
   * @returns {Object} Age indicators by time granularity
   */
  async getDataAgeByGranularity(dataType, entityId) {
    const model = this._getModelForDataType(dataType);
    if (!model) {
      throw new Error(`Unsupported data type: ${dataType}`);
    }

    const granularities = ['daily', 'weekly', 'monthly'];
    const ageIndicators = {};

    for (const granularity of granularities) {
      const query = this._buildEntityQuery(dataType, entityId);
      query.timeGranularity = granularity;

      const mostRecent = await model.findOne(query)
        .sort({ lastUpdated: -1 })
        .select('lastUpdated');

      if (mostRecent) {
        const dataAge = Date.now() - mostRecent.lastUpdated.getTime();
        const threshold = this.freshnessThresholds[dataType];
        
        ageIndicators[granularity] = {
          lastUpdated: mostRecent.lastUpdated,
          dataAge,
          dataAgeHours: Math.round(dataAge / (1000 * 60 * 60) * 100) / 100,
          isFresh: dataAge < threshold,
          status: dataAge < threshold ? 'fresh' : 'stale'
        };
      } else {
        ageIndicators[granularity] = {
          lastUpdated: null,
          dataAge: null,
          dataAgeHours: null,
          isFresh: false,
          status: 'no_data'
        };
      }
    }

    return ageIndicators;
  }

  /**
   * Calculate data freshness indicators for health checks
   * @returns {Object} Health check freshness indicators
   */
  async getHealthCheckIndicators() {
    const allFreshness = await this.getAllDataFreshness();
    const indicators = {
      overall: allFreshness.overall,
      critical: [],
      warnings: [],
      healthy: []
    };

    for (const [dataType, status] of Object.entries(allFreshness.dataTypes)) {
      if (status.status === 'error') {
        indicators.critical.push({
          dataType,
          issue: 'Data freshness check failed',
          error: status.error
        });
      } else if (status.status === 'no_data') {
        indicators.warnings.push({
          dataType,
          issue: 'No summary data available',
          recommendation: 'Run initial aggregation job'
        });
      } else if (status.status === 'stale') {
        if (status.dataAgeHours > (status.thresholdHours * 2)) {
          indicators.critical.push({
            dataType,
            issue: `Data is severely stale (${status.dataAgeHours}h old)`,
            threshold: `${status.thresholdHours}h`,
            recommendation: 'Check aggregation job status'
          });
        } else {
          indicators.warnings.push({
            dataType,
            issue: `Data is stale (${status.dataAgeHours}h old)`,
            threshold: `${status.thresholdHours}h`,
            recommendation: 'Monitor aggregation job execution'
          });
        }
      } else {
        indicators.healthy.push({
          dataType,
          status: 'Fresh data available',
          lastUpdated: status.lastUpdated
        });
      }
    }

    return indicators;
  }

  /**
   * Get the appropriate model for a data type
   * @private
   */
  _getModelForDataType(dataType) {
    switch (dataType) {
      case 'flight_stats':
        return FlightStatsSummary;
      case 'weather_stats':
        return WeatherStatsSummary;
      // Add other data types as they are implemented
      default:
        return null;
    }
  }

  /**
   * Build entity-specific query based on data type
   * @private
   */
  _buildEntityQuery(dataType, entityId) {
    switch (dataType) {
      case 'flight_stats':
        return { serialNumber: entityId };
      case 'weather_stats':
        // For weather data, entityId could be location or uaSN
        return { $or: [{ location: entityId }, { uaSN: entityId }] };
      default:
        return {};
    }
  }

  /**
   * Generate human-readable freshness message
   * @private
   */
  _getFreshnessMessage(isFresh, dataAge, threshold) {
    if (isFresh) {
      return 'Data is fresh and up to date';
    }

    const ageHours = Math.round(dataAge / (1000 * 60 * 60) * 100) / 100;
    const thresholdHours = Math.round(threshold / (1000 * 60 * 60) * 100) / 100;
    
    if (ageHours > thresholdHours * 2) {
      return `Data is severely stale (${ageHours}h old, threshold: ${thresholdHours}h)`;
    } else {
      return `Data is stale (${ageHours}h old, threshold: ${thresholdHours}h)`;
    }
  }

  /**
   * Configure custom freshness thresholds
   * @param {Object} customThresholds - Custom thresholds by data type
   */
  setCustomThresholds(customThresholds) {
    this.freshnessThresholds = {
      ...this.freshnessThresholds,
      ...customThresholds
    };
  }

  /**
   * Get current freshness threshold for a data type
   * @param {string} dataType - Type of data
   * @returns {number} Threshold in milliseconds
   */
  getThreshold(dataType) {
    return this.freshnessThresholds[dataType];
  }

  /**
   * Get all configured thresholds
   * @returns {Object} All freshness thresholds
   */
  getAllThresholds() {
    return { ...this.freshnessThresholds };
  }
}

// Export singleton instance
export default new DataFreshnessTracker();