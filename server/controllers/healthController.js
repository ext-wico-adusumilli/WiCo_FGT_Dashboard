import mongoose from 'mongoose';
import os from 'os';
import { getPerformanceStats } from '../middleware/performanceMonitoring.js';
import dataFreshnessTracker from '../utils/dataFreshnessTracker.js';
import AggregationSystem from '../jobs/aggregation/integration.js';
import JobExecutionLog from '../models/JobExecutionLog.js';

/**
 * Basic health check endpoint
 * GET /health
 */
export const getBasicHealth = (req, res) => {
  try {
    const health = {
      status: 'ok',
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Detailed health check endpoint with system metrics
 * GET /health/detailed
 */
export const getDetailedHealth = async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: await getDatabaseHealth(),
      system: getSystemHealth(),
      memory: getMemoryHealth(),
      performance: await getPerformanceHealth()
    };
    
    // Determine overall status based on components
    const componentStatuses = [
      health.database.status,
      health.system.status,
      health.memory.status,
      health.performance.status
    ];
    
    if (componentStatuses.includes('critical')) {
      health.status = 'critical';
    } else if (componentStatuses.includes('warning')) {
      health.status = 'warning';
    }
    
    const statusCode = health.status === 'critical' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Detailed health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Job status monitoring endpoint
 * GET /health/jobs
 */
export const getJobsHealth = async (req, res) => {
  try {
    const aggregationHealth = AggregationSystem.getHealthStatus();
    
    let jobsHealth = {
      status: aggregationHealth.status,
      message: aggregationHealth.message,
      jobs: [],
      summary: {
        total: 0,
        active: 0,
        running: 0,
        failed: 0
      },
      recentExecutions: [],
      aggregationSystem: aggregationHealth.details,
      timestamp: new Date().toISOString()
    };
    
    if (aggregationHealth.status === 'healthy') {
      try {
        const allJobsStatus = AggregationSystem.getAllJobsStatus();
        
        // Get recent job executions (last 10)
        const recentExecutions = await JobExecutionLog.find({})
          .sort({ startTime: -1 })
          .limit(10)
          .select('jobName executionId status startTime endTime recordsProcessed errorMessage');
        
        // Calculate summary statistics
        const summary = {
          total: allJobsStatus.length,
          active: allJobsStatus.filter(job => job.isActive).length,
          running: allJobsStatus.filter(job => job.isRunning).length,
          failed: recentExecutions.filter(exec => exec.status === 'failed').length
        };
        
        // Determine overall job health status
        let status = 'ok';
        let message = 'All jobs are healthy';
        
        if (summary.failed > 0) {
          status = 'warning';
          message = `${summary.failed} recent job failures detected`;
        }
        
        if (summary.active === 0) {
          status = 'warning';
          message = 'No active jobs scheduled';
        }
        
        jobsHealth = {
          ...jobsHealth,
          status,
          message,
          jobs: allJobsStatus,
          summary,
          recentExecutions
        };
      } catch (error) {
        jobsHealth.status = 'error';
        jobsHealth.message = `Error retrieving job details: ${error.message}`;
      }
    }
    
    res.json(jobsHealth);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Job health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Data freshness status endpoint
 * GET /health/data-freshness
 */
export const getDataFreshnessHealth = async (req, res) => {
  try {
    const indicators = await dataFreshnessTracker.getHealthCheckIndicators();
    
    // Determine overall health status
    let overallStatus = 'ok';
    let message = 'All data is fresh';
    
    if (indicators.critical.length > 0) {
      overallStatus = 'critical';
      message = `${indicators.critical.length} critical data freshness issues`;
    } else if (indicators.warnings.length > 0) {
      overallStatus = 'warning';
      message = `${indicators.warnings.length} data freshness warnings`;
    }
    
    const health = {
      status: overallStatus,
      message,
      indicators,
      summary: {
        critical: indicators.critical.length,
        warnings: indicators.warnings.length,
        healthy: indicators.healthy.length
      },
      timestamp: new Date().toISOString()
    };
    
    const statusCode = overallStatus === 'critical' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Data freshness health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * System health indicators endpoint
 * GET /health/system
 */
export const getSystemHealth = (req, res) => {
  try {
    const systemHealth = getSystemHealthInternal();
    res.json({
      ...systemHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'System health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Comprehensive health check combining all components
 * GET /health/comprehensive
 */
export const getComprehensiveHealth = async (req, res) => {
  try {
    const [
      databaseHealth,
      systemHealth,
      memoryHealth,
      performanceHealth,
      jobsHealthData,
      dataFreshnessHealthData
    ] = await Promise.all([
      getDatabaseHealth(),
      Promise.resolve(getSystemHealthInternal()),
      Promise.resolve(getMemoryHealth()),
      getPerformanceHealth(),
      getJobsHealthData(),
      getDataFreshnessHealthData()
    ]);
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      components: {
        database: databaseHealth,
        system: systemHealth,
        memory: memoryHealth,
        performance: performanceHealth,
        jobs: jobsHealthData,
        dataFreshness: dataFreshnessHealthData
      }
    };
    
    // Determine overall status
    const componentStatuses = Object.values(health.components).map(comp => comp.status);
    
    if (componentStatuses.includes('critical')) {
      health.status = 'critical';
    } else if (componentStatuses.includes('warning')) {
      health.status = 'warning';
    }
    
    const statusCode = health.status === 'critical' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Comprehensive health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper functions

async function getDatabaseHealth() {
  try {
    const dbState = mongoose.connection.readyState;
    const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    const health = {
      status: dbState === 1 ? 'ok' : 'critical',
      connected: dbState === 1,
      state: stateNames[dbState] || 'unknown',
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port
    };
    
    if (dbState === 1) {
      // Test database responsiveness
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;
      
      health.responseTime = responseTime;
      health.message = `Database connected and responsive (${responseTime}ms)`;
      
      if (responseTime > 1000) {
        health.status = 'warning';
        health.message = `Database slow response time: ${responseTime}ms`;
      }
    } else {
      health.message = `Database ${health.state}`;
    }
    
    return health;
  } catch (error) {
    return {
      status: 'critical',
      connected: false,
      message: `Database health check failed: ${error.message}`,
      error: error.message
    };
  }
}

function getSystemHealthInternal() {
  try {
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    
    // Calculate CPU usage percentage (approximate)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / process.uptime() * 100;
    
    let status = 'ok';
    let message = 'System resources healthy';
    
    // Check load average (1-minute load)
    const loadPerCore = loadAverage[0] / cpuCount;
    if (loadPerCore > 0.8) {
      status = 'warning';
      message = `High system load: ${loadPerCore.toFixed(2)} per core`;
    }
    if (loadPerCore > 1.5) {
      status = 'critical';
      message = `Critical system load: ${loadPerCore.toFixed(2)} per core`;
    }
    
    return {
      status,
      message,
      cpu: {
        usage: Math.round(cpuPercent * 100) / 100,
        loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
        cores: cpuCount
      },
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    };
  } catch (error) {
    return {
      status: 'error',
      message: `System health check failed: ${error.message}`,
      error: error.message
    };
  }
}

function getMemoryHealth() {
  try {
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Convert to MB
    const memoryStats = {
      process: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      system: {
        total: Math.round(totalMemory / 1024 / 1024),
        used: Math.round(usedMemory / 1024 / 1024),
        free: Math.round(freeMemory / 1024 / 1024),
        usagePercent: Math.round((usedMemory / totalMemory) * 100)
      }
    };
    
    let status = 'ok';
    let message = 'Memory usage healthy';
    
    // Check heap usage
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (heapUsagePercent > 80) {
      status = 'warning';
      message = `High heap usage: ${Math.round(heapUsagePercent)}%`;
    }
    if (heapUsagePercent > 95) {
      status = 'critical';
      message = `Critical heap usage: ${Math.round(heapUsagePercent)}%`;
    }
    
    // Check system memory
    if (memoryStats.system.usagePercent > 90) {
      status = 'critical';
      message = `Critical system memory usage: ${memoryStats.system.usagePercent}%`;
    } else if (memoryStats.system.usagePercent > 80) {
      status = 'warning';
      message = `High system memory usage: ${memoryStats.system.usagePercent}%`;
    }
    
    return {
      status,
      message,
      ...memoryStats
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Memory health check failed: ${error.message}`,
      error: error.message
    };
  }
}

async function getPerformanceHealth() {
  try {
    const perfStats = getPerformanceStats();
    
    let status = 'ok';
    let message = 'Performance metrics healthy';
    
    // Check for high percentage of slow requests
    const slowRequestPercent = perfStats.stats.totalRequests > 0 ? 
      (perfStats.stats.slowRequests / perfStats.stats.totalRequests) * 100 : 0;
    
    if (slowRequestPercent > 20) {
      status = 'warning';
      message = `High percentage of slow requests: ${Math.round(slowRequestPercent)}%`;
    }
    if (slowRequestPercent > 50) {
      status = 'critical';
      message = `Critical percentage of slow requests: ${Math.round(slowRequestPercent)}%`;
    }
    
    // Check average response time
    if (perfStats.stats.averageResponseTime > 1000) {
      status = 'warning';
      message = `High average response time: ${perfStats.stats.averageResponseTime}ms`;
    }
    if (perfStats.stats.averageResponseTime > 2000) {
      status = 'critical';
      message = `Critical average response time: ${perfStats.stats.averageResponseTime}ms`;
    }
    
    return {
      status,
      message,
      stats: perfStats.stats,
      recentAlerts: perfStats.recentAlerts.length,
      slowQueryThreshold: perfStats.slowQueryThreshold
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Performance health check failed: ${error.message}`,
      error: error.message
    };
  }
}

async function getJobsHealthData() {
  try {
    const aggregationHealth = AggregationSystem.getHealthStatus();
    
    if (aggregationHealth.status !== 'healthy') {
      return {
        status: 'warning',
        message: aggregationHealth.message,
        available: false,
        details: aggregationHealth.details
      };
    }
    
    const allJobsStatus = AggregationSystem.getAllJobsStatus();
    const recentFailures = await JobExecutionLog.countDocuments({
      status: 'failed',
      startTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    let status = 'ok';
    let message = 'All jobs healthy';
    
    if (recentFailures > 0) {
      status = 'warning';
      message = `${recentFailures} job failures in last 24 hours`;
    }
    
    const activeJobs = allJobsStatus.filter(job => job.isActive).length;
    if (activeJobs === 0) {
      status = 'warning';
      message = 'No active jobs scheduled';
    }
    
    return {
      status,
      message,
      available: true,
      summary: {
        total: allJobsStatus.length,
        active: activeJobs,
        running: allJobsStatus.filter(job => job.isRunning).length,
        recentFailures
      },
      aggregationSystem: aggregationHealth.details
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Jobs health check failed: ${error.message}`,
      error: error.message
    };
  }
}

async function getDataFreshnessHealthData() {
  try {
    const indicators = await dataFreshnessTracker.getHealthCheckIndicators();
    
    let status = 'ok';
    let message = 'All data fresh';
    
    if (indicators.critical.length > 0) {
      status = 'critical';
      message = `${indicators.critical.length} critical freshness issues`;
    } else if (indicators.warnings.length > 0) {
      status = 'warning';
      message = `${indicators.warnings.length} freshness warnings`;
    }
    
    return {
      status,
      message,
      summary: {
        critical: indicators.critical.length,
        warnings: indicators.warnings.length,
        healthy: indicators.healthy.length
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Data freshness health check failed: ${error.message}`,
      error: error.message
    };
  }
}