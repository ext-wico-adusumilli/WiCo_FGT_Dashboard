import {
  getPerformanceMetrics,
  getPerformanceStats,
  getPerformanceAlerts,
  getPerformanceReport,
  clearPerformanceMetrics
} from '../middleware/performanceMonitoring.js';

/**
 * Get current performance metrics
 */
export const getMetrics = async (req, res) => {
  try {
    const metrics = getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching performance metrics', 
      error: error.message 
    });
  }
};

/**
 * Get performance statistics summary
 */
export const getStats = async (req, res) => {
  try {
    const stats = getPerformanceStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching performance stats', 
      error: error.message 
    });
  }
};

/**
 * Get performance alerts
 */
export const getAlerts = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = getPerformanceAlerts(parseInt(limit));
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching performance alerts', 
      error: error.message 
    });
  }
};

/**
 * Get performance report for a time range
 */
export const getReport = async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ 
        message: 'startTime and endTime query parameters are required' 
      });
    }
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ 
        message: 'Invalid date format for startTime or endTime' 
      });
    }
    
    if (start >= end) {
      return res.status(400).json({ 
        message: 'startTime must be before endTime' 
      });
    }
    
    const report = getPerformanceReport(start, end);
    res.json(report);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error generating performance report', 
      error: error.message 
    });
  }
};

/**
 * Clear performance metrics (admin only)
 */
export const clearMetrics = async (req, res) => {
  try {
    clearPerformanceMetrics();
    res.json({ 
      message: 'Performance metrics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error clearing performance metrics', 
      error: error.message 
    });
  }
};