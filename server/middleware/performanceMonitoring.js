import logger from '../config/logger.js';

// Performance metrics storage (in production, this should be a proper metrics store)
const performanceMetrics = {
  requests: [],
  alerts: [],
  stats: {
    totalRequests: 0,
    slowRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0
  }
};

// Configuration
const SLOW_QUERY_THRESHOLD = 500; // 500ms threshold as per requirements
const MAX_STORED_METRICS = 1000; // Limit memory usage
const MAX_STORED_ALERTS = 100;

/**
 * Performance monitoring middleware that tracks response times
 * and generates alerts for queries exceeding 500ms threshold
 */
export const performanceMonitoringMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Store request start info
  req.performanceMetrics = {
    requestId,
    startTime,
    path: req.path,
    method: req.method,
    query: req.query
  };

  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Record performance metrics
    recordPerformanceMetrics({
      requestId,
      path: req.path,
      method: req.method,
      query: req.query,
      startTime,
      endTime,
      responseTime,
      statusCode: res.statusCode
    });
    
    // Check for slow queries and generate alerts
    if (responseTime > SLOW_QUERY_THRESHOLD) {
      generatePerformanceAlert({
        requestId,
        path: req.path,
        method: req.method,
        query: req.query,
        responseTime,
        threshold: SLOW_QUERY_THRESHOLD,
        timestamp: new Date(endTime)
      });
    }
    
    // Add performance headers to response
    res.set({
      'X-Response-Time': `${responseTime}ms`,
      'X-Request-ID': requestId
    });
    
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Record performance metrics for a request
 */
function recordPerformanceMetrics(metrics) {
  // Add to requests array (with size limit)
  performanceMetrics.requests.push(metrics);
  if (performanceMetrics.requests.length > MAX_STORED_METRICS) {
    performanceMetrics.requests.shift(); // Remove oldest
  }
  
  // Update aggregate stats
  performanceMetrics.stats.totalRequests++;
  if (metrics.responseTime > SLOW_QUERY_THRESHOLD) {
    performanceMetrics.stats.slowRequests++;
  }
  
  // Update average response time (rolling average)
  const totalTime = performanceMetrics.requests.reduce((sum, req) => sum + req.responseTime, 0);
  performanceMetrics.stats.averageResponseTime = Math.round(totalTime / performanceMetrics.requests.length);
  
  // Update max response time
  performanceMetrics.stats.maxResponseTime = Math.max(
    performanceMetrics.stats.maxResponseTime,
    metrics.responseTime
  );
  
  // Log performance data
  logger.info('Request performance recorded', {
    requestId: metrics.requestId,
    path: metrics.path,
    method: metrics.method,
    responseTime: metrics.responseTime,
    statusCode: metrics.statusCode
  });
}

/**
 * Generate performance alert for slow queries
 */
function generatePerformanceAlert(alertData) {
  const alert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'SLOW_QUERY',
    severity: alertData.responseTime > SLOW_QUERY_THRESHOLD * 2 ? 'HIGH' : 'MEDIUM',
    message: `Query exceeded ${SLOW_QUERY_THRESHOLD}ms threshold`,
    ...alertData
  };
  
  // Store alert (with size limit)
  performanceMetrics.alerts.push(alert);
  if (performanceMetrics.alerts.length > MAX_STORED_ALERTS) {
    performanceMetrics.alerts.shift(); // Remove oldest
  }
  
  // Log alert
  logger.warn('Performance alert generated', alert);
  
  // In production, this could trigger external alerting systems
  // e.g., send to monitoring service, email, Slack, etc.
}

/**
 * Get current performance metrics
 */
export function getPerformanceMetrics() {
  return {
    ...performanceMetrics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get performance statistics
 */
export function getPerformanceStats() {
  const recentRequests = performanceMetrics.requests.slice(-100); // Last 100 requests
  const recentAlerts = performanceMetrics.alerts.slice(-20); // Last 20 alerts
  
  return {
    stats: performanceMetrics.stats,
    recentRequests,
    recentAlerts,
    slowQueryThreshold: SLOW_QUERY_THRESHOLD,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get performance alerts
 */
export function getPerformanceAlerts(limit = 50) {
  return {
    alerts: performanceMetrics.alerts.slice(-limit),
    totalAlerts: performanceMetrics.alerts.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Clear performance metrics (for testing or maintenance)
 */
export function clearPerformanceMetrics() {
  performanceMetrics.requests = [];
  performanceMetrics.alerts = [];
  performanceMetrics.stats = {
    totalRequests: 0,
    slowRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0
  };
  
  logger.info('Performance metrics cleared');
}

/**
 * Get performance report for a specific time range
 */
export function getPerformanceReport(startTime, endTime) {
  const filteredRequests = performanceMetrics.requests.filter(req => 
    req.startTime >= startTime && req.startTime <= endTime
  );
  
  const filteredAlerts = performanceMetrics.alerts.filter(alert => 
    alert.timestamp >= new Date(startTime) && alert.timestamp <= new Date(endTime)
  );
  
  const stats = {
    totalRequests: filteredRequests.length,
    slowRequests: filteredRequests.filter(req => req.responseTime > SLOW_QUERY_THRESHOLD).length,
    averageResponseTime: filteredRequests.length > 0 ? 
      Math.round(filteredRequests.reduce((sum, req) => sum + req.responseTime, 0) / filteredRequests.length) : 0,
    maxResponseTime: filteredRequests.length > 0 ? 
      Math.max(...filteredRequests.map(req => req.responseTime)) : 0,
    minResponseTime: filteredRequests.length > 0 ? 
      Math.min(...filteredRequests.map(req => req.responseTime)) : 0
  };
  
  return {
    timeRange: { startTime: new Date(startTime), endTime: new Date(endTime) },
    stats,
    requests: filteredRequests,
    alerts: filteredAlerts,
    timestamp: new Date().toISOString()
  };
}

export default performanceMonitoringMiddleware;