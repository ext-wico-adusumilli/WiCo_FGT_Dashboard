// Load environment variables FIRST before any other imports
import './loadEnv.js';

// Suppress console.log and console.warn in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import { initializeSystemWithRetry, shutdownSystem } from './config/startup.js';
import { validateConfig } from './config/validate.js';
import authRoutes from './routes/auth.js';
import filterRoutes from './routes/filters.js';
import mttfRoutes from './routes/mttf.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import snOverviewRoutes from './routes/snOverview.js';
import batteryOverviewRoutes from './routes/batteryOverview.js';
import transitionDistanceRoutes from './routes/transitionDistance.js';
import weatherDataRoutes from './routes/weatherData.js';
import logDetailsRoutes from './routes/logDetails.js';
import lteAnalysisRoutes from './routes/lteAnalysis.js';
import snBranchRoutes from './routes/snBranchRoutes.js';
import dataFreshnessRoutes from './routes/dataFreshness.js';
import performanceRoutes from './routes/performance.js';
import healthRoutes from './routes/health.js';
import jobConfigRoutes from './routes/jobConfig.js';
import jobExecutionRoutes from './routes/jobExecution.js';
import generalOverviewRoutes from './routes/generalOverview.js';
import operationTypeRoutes from './routes/operationType.js';
import jiraRoutes from './routes/jiraRoutes.js';
import airflowRoutes from './routes/airflow.js';
import phaseRoutes from './routes/phases.js';
import ingestionRoutes from './routes/ingestion.js';
import blobSyncRoutes from './routes/blobSync.js';
import { performanceMonitoringMiddleware } from './middleware/performanceMonitoring.js';
import logger from './config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug: Log JIRA config status
console.log('JIRA Config Status:', {
  email: process.env.JIRA_EMAIL ? 'SET' : 'MISSING',
  token: process.env.JIRA_API_TOKEN ? 'SET' : 'MISSING',
  baseUrl: process.env.JIRA_BASE_URL ? 'SET' : 'MISSING',
  parentKey: process.env.JIRA_PARENT_TICKET_KEY ? 'SET' : 'MISSING',
});

// Validate configuration
validateConfig();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for Azure deployment
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173'];

// In production, when serving frontend from same server, allow same-origin requests
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
      origin: true, // Allow same-origin requests in production
      credentials: true
    }
  : {
      origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true
    };

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Performance monitoring middleware (before routes)
app.use(performanceMonitoringMiddleware);

// Connect to MongoDB
connectDB();

// Initialize system with retry logic for production environments
const initializeSystem = async () => {
  try {
    const result = await initializeSystemWithRetry(3, 5000);
    
    if (result.success) {
      logger.info('System initialization completed', result);
    } else {
      logger.error('System initialization failed after retries', { error: result.error });
      logger.error('Application will continue but aggregation features may not work');
    }
  } catch (error) {
    logger.error('Unexpected error during system initialization', { error: error.message });
  }
};

// Initialize system (non-blocking)
initializeSystem();

// Start daily blob sync cron (only when connection string is configured)
if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
  import('./scripts/blobSyncCron.js').catch(e =>
    logger.error('Failed to start blob sync cron', { error: e.message })
  );
}

// API Routes
app.use('/auth', authRoutes);
app.use('/filters', filterRoutes);
app.use('/api/mttf', mttfRoutes);  // Prefixed to avoid conflict with /mttf frontend route
app.use('/user', userRoutes);
app.use('/api/admin', adminRoutes);  // Prefixed to avoid conflict with /admin frontend route
app.use('/general-overview', generalOverviewRoutes);
app.use('/sn-overview', snOverviewRoutes);
app.use('/battery-overview', batteryOverviewRoutes);
app.use('/transition-distance', transitionDistanceRoutes);
app.use('/weather-data', weatherDataRoutes);
app.use('/log-details', logDetailsRoutes);
app.use('/lte-analysis', lteAnalysisRoutes);
app.use('/sn-branch-assignments', snBranchRoutes);
app.use('/data-freshness', dataFreshnessRoutes);
app.use('/performance', performanceRoutes);
app.use('/health', healthRoutes);
app.use('/job-config', jobConfigRoutes);
app.use('/job-execution', jobExecutionRoutes);
app.use('/operation-type', operationTypeRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/airflow', airflowRoutes);
app.use('/api/phases', phaseRoutes);
app.use('/api/ingestion', ingestionRoutes);
app.use('/blob-sync', blobSyncRoutes);

// Routes are registered and ready

// Serve static files from React build (for production deployment)
if (process.env.NODE_ENV === 'production') {
  // Serve static files with proper MIME types
  app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));
  
  // Handle React routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/auth') ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/filters') ||
        req.path.startsWith('/user') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/blob-sync') ||
        req.path.startsWith('/general-overview') ||
        req.path.startsWith('/sn-overview') ||
        req.path.startsWith('/battery-overview') ||
        req.path.startsWith('/transition-distance') ||
        req.path.startsWith('/weather-data') ||
        req.path.startsWith('/log-details') ||
        req.path.startsWith('/lte-analysis') ||
        req.path.startsWith('/sn-branch-assignments') ||
        req.path.startsWith('/data-freshness') ||
        req.path.startsWith('/performance') ||
        req.path.startsWith('/job-config') ||
        req.path.startsWith('/job-execution') ||
        req.path.startsWith('/operation-type')) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, environment: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info('Starting graceful shutdown', { signal });
  
  try {
    const result = await shutdownSystem(signal);
    
    if (result.success) {
      logger.info('Graceful shutdown completed', result);
    } else {
      logger.error('Graceful shutdown failed', { error: result.error });
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise, reason });
  gracefulShutdown('unhandledRejection');
});
