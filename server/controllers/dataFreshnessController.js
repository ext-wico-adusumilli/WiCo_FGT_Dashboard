import dataFreshnessTracker from '../utils/dataFreshnessTracker.js';

/**
 * Data Freshness Controller
 * Provides API endpoints for monitoring data freshness across summary collections
 */

/**
 * Get freshness status for all data types
 * GET /api/data-freshness
 */
export const getAllDataFreshness = async (req, res) => {
  try {
    const freshnessStatus = await dataFreshnessTracker.getAllDataFreshness();
    
    res.json({
      success: true,
      data: freshnessStatus,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve data freshness status',
      error: error.message
    });
  }
};

/**
 * Get freshness status for a specific data type
 * GET /api/data-freshness/:dataType
 */
export const getDataTypeFreshness = async (req, res) => {
  try {
    const { dataType } = req.params;
    const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
    
    const freshnessStatus = await dataFreshnessTracker.getDataFreshness(dataType, filters);
    
    res.json({
      success: true,
      data: freshnessStatus,
      timestamp: new Date()
    });
  } catch (error) {
    if (error.message.includes('Unsupported data type')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve data freshness status',
        error: error.message
      });
    }
  }
};

/**
 * Get freshness metadata for dashboard API responses
 * GET /api/data-freshness/:dataType/metadata
 */
export const getFreshnessMetadata = async (req, res) => {
  try {
    const { dataType } = req.params;
    const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
    
    const metadata = await dataFreshnessTracker.getFreshnessMetadata(dataType, filters);
    
    res.json({
      success: true,
      data: metadata,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve freshness metadata',
      error: error.message
    });
  }
};

/**
 * Check if data is fresh for a specific data type
 * GET /api/data-freshness/:dataType/check
 */
export const checkDataFreshness = async (req, res) => {
  try {
    const { dataType } = req.params;
    const { customThresholdMs, filters } = req.query;
    
    const options = {};
    if (customThresholdMs) {
      options.customThresholdMs = parseInt(customThresholdMs);
    }
    if (filters) {
      options.filters = JSON.parse(filters);
    }
    
    const isFresh = await dataFreshnessTracker.isDataFresh(dataType, options);
    
    res.json({
      success: true,
      data: {
        dataType,
        isFresh,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to check data freshness',
      error: error.message
    });
  }
};

/**
 * Get data age by time granularity for a specific entity
 * GET /api/data-freshness/:dataType/age/:entityId
 */
export const getDataAgeByGranularity = async (req, res) => {
  try {
    const { dataType, entityId } = req.params;
    
    const ageIndicators = await dataFreshnessTracker.getDataAgeByGranularity(dataType, entityId);
    
    res.json({
      success: true,
      data: {
        dataType,
        entityId,
        ageIndicators,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve data age indicators',
      error: error.message
    });
  }
};

/**
 * Get health check indicators for data freshness
 * GET /api/data-freshness/health
 */
export const getHealthCheckIndicators = async (req, res) => {
  try {
    const indicators = await dataFreshnessTracker.getHealthCheckIndicators();
    
    // Determine overall health status
    let overallStatus = 'healthy';
    if (indicators.critical.length > 0) {
      overallStatus = 'critical';
    } else if (indicators.warnings.length > 0) {
      overallStatus = 'warning';
    }
    
    res.json({
      success: true,
      data: {
        status: overallStatus,
        indicators,
        summary: {
          critical: indicators.critical.length,
          warnings: indicators.warnings.length,
          healthy: indicators.healthy.length
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve health check indicators',
      error: error.message
    });
  }
};

/**
 * Get current freshness thresholds configuration
 * GET /api/data-freshness/config/thresholds
 */
export const getFreshnessThresholds = async (req, res) => {
  try {
    const thresholds = dataFreshnessTracker.getAllThresholds();
    
    // Convert milliseconds to human-readable format
    const readableThresholds = {};
    for (const [dataType, thresholdMs] of Object.entries(thresholds)) {
      readableThresholds[dataType] = {
        milliseconds: thresholdMs,
        minutes: Math.round(thresholdMs / (1000 * 60)),
        hours: Math.round(thresholdMs / (1000 * 60 * 60) * 100) / 100
      };
    }
    
    res.json({
      success: true,
      data: {
        thresholds: readableThresholds,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve freshness thresholds',
      error: error.message
    });
  }
};

/**
 * Update freshness thresholds (admin only)
 * PUT /api/data-freshness/config/thresholds
 */
export const updateFreshnessThresholds = async (req, res) => {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid thresholds format. Expected object with dataType: milliseconds pairs.'
      });
    }
    
    // Validate threshold values
    for (const [dataType, threshold] of Object.entries(thresholds)) {
      if (typeof threshold !== 'number' || threshold <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid threshold for ${dataType}. Must be a positive number in milliseconds.`
        });
      }
    }
    
    dataFreshnessTracker.setCustomThresholds(thresholds);
    
    res.json({
      success: true,
      message: 'Freshness thresholds updated successfully',
      data: {
        updatedThresholds: thresholds,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update freshness thresholds',
      error: error.message
    });
  }
};