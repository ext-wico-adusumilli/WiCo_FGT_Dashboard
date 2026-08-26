import mongoose from 'mongoose';
import logger from './logger.js';

// Import models to ensure they are registered
import JobConfiguration from '../models/JobConfiguration.js';
import JobExecutionLog from '../models/JobExecutionLog.js';
import LogDetail from '../models/LogDetail.js';
import WeatherData from '../models/WeatherData.js';

/**
 * Initialize database indexes and schema on application startup
 * This ensures optimal query performance for the aggregation system
 */
export async function initializeDatabase() {
  try {
    logger.info('Starting database initialization...');

    // Wait for database connection to be ready
    if (mongoose.connection.readyState !== 1) {
      logger.info('Waiting for database connection...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout'));
        }, 30000); // 30 second timeout

        mongoose.connection.on('connected', () => {
          clearTimeout(timeout);
          resolve();
        });

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    logger.info('Database connected, creating indexes...');

    // Create indexes for all models
    await createJobConfigurationIndexes();
    await createJobExecutionLogIndexes();
    await createLogDetailIndexes();
    await createWeatherDataIndexes();

    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message });
    throw error;
  }
}

/**
 * Create indexes for JobConfiguration collection
 */
async function createJobConfigurationIndexes() {
  try {
    const collection = mongoose.connection.db.collection('jobconfigurations');
    
    // Unique index on jobName
    await collection.createIndex({ jobName: 1 }, { unique: true });
    
    // Index for active jobs
    await collection.createIndex({ isActive: 1 });
    
    // Index for job type queries
    await collection.createIndex({ jobType: 1 });
    
    // Compound index for active jobs by type
    await collection.createIndex({ isActive: 1, jobType: 1 });
    
    logger.info('JobConfiguration indexes created successfully');
  } catch (error) {
    logger.error('Failed to create JobConfiguration indexes', { error: error.message });
    throw error;
  }
}

/**
 * Create indexes for JobExecutionLog collection
 */
async function createJobExecutionLogIndexes() {
  try {
    const collection = mongoose.connection.db.collection('jobexecutionlogs');
    
    // Unique index on executionId
    await collection.createIndex({ executionId: 1 }, { unique: true });
    
    // Index for job name queries
    await collection.createIndex({ jobName: 1 });
    
    // Index for status queries
    await collection.createIndex({ status: 1 });
    
    // Index for time-based queries
    await collection.createIndex({ startTime: -1 });
    await collection.createIndex({ endTime: -1 });
    
    // Compound indexes for common query patterns
    await collection.createIndex({ jobName: 1, startTime: -1 });
    await collection.createIndex({ jobName: 1, status: 1 });
    await collection.createIndex({ status: 1, startTime: -1 });
    
    // Index for finding last successful execution
    await collection.createIndex({ jobName: 1, status: 1, endTime: -1 });
    
    logger.info('JobExecutionLog indexes created successfully');
  } catch (error) {
    logger.error('Failed to create JobExecutionLog indexes', { error: error.message });
    throw error;
  }
}



/**
 * Create indexes for LogDetail collection
 * Critical for performance on large datasets
 */
async function createLogDetailIndexes() {
  try {
    const collection = mongoose.connection.db.collection('logdetails');

    // Get existing indexes to avoid conflicts
    const existingIndexes = await collection.indexes();
    const existingIndexNames = existingIndexes.map(idx => idx.name);

    // Helper function to create index if it doesn't exist
    const createIndexIfNotExists = async (keys, options = {}) => {
      const indexName = options.name || Object.keys(keys).map(k => `${k}_${keys[k]}`).join('_');
      if (!existingIndexNames.includes(indexName)) {
        await collection.createIndex(keys, options);
      }
    };

    // Compound index for sn and date (most common query pattern)
    await createIndexIfNotExists({ sn: 1, date: 1 });

    // Index for key (already exists, skip unique constraint to avoid conflict)
    // The existing index is sufficient for queries

    // Index for flight filtering (critical for dashboard queries)
    await createIndexIfNotExists({ flight: 1 });

    // Index for date range queries
    await createIndexIfNotExists({ date: 1 });

    // Compound index for sn + flight (very common filter combination)
    await createIndexIfNotExists({ sn: 1, flight: 1 });

    // Compound index for date + flight (dashboard queries)
    await createIndexIfNotExists({ date: 1, flight: 1 });

    // Compound index for all three common filters
    await createIndexIfNotExists({ sn: 1, date: 1, flight: 1 });

    logger.info('LogDetail indexes created successfully');
  } catch (error) {
    logger.error('Failed to create LogDetail indexes', { error: error.message });
    throw error;
  }
}

/**
 * Create indexes for WeatherData collection
 */
async function createWeatherDataIndexes() {
  try {
    const collection = mongoose.connection.db.collection('weatherdata');

    // Check if collection exists first
    const collections = await mongoose.connection.db.listCollections({ name: 'weatherdata' }).toArray();
    if (collections.length === 0) {
      logger.info('WeatherData collection does not exist yet, skipping index creation');
      return;
    }

    // Get existing indexes to avoid conflicts
    const existingIndexes = await collection.indexes();
    const existingIndexNames = existingIndexes.map(idx => idx.name);

    // Helper function to create index if it doesn't exist
    const createIndexIfNotExists = async (keys, options = {}) => {
      const indexName = options.name || Object.keys(keys).map(k => `${k}_${keys[k]}`).join('_');
      if (!existingIndexNames.includes(indexName)) {
        await collection.createIndex(keys, options);
      }
    };

    // Index for uaSN queries
    await createIndexIfNotExists({ uaSN: 1 });

    // Index for location queries
    await createIndexIfNotExists({ location: 1 });

    // Index for date queries
    await createIndexIfNotExists({ createdAt: -1 });

    // Compound indexes for common query patterns
    await createIndexIfNotExists({ uaSN: 1, createdAt: -1 });
    await createIndexIfNotExists({ location: 1, createdAt: -1 });
    await createIndexIfNotExists({ uaSN: 1, location: 1 });

    logger.info('WeatherData indexes created successfully');
  } catch (error) {
    logger.error('Failed to create WeatherData indexes', { error: error.message });
    // Don't throw - allow system to continue if WeatherData collection doesn't exist
    logger.warn('Continuing without WeatherData indexes');
  }
}

/**
 * Verify that all required indexes exist
 */
export async function verifyIndexes() {
  try {
    logger.info('Verifying database indexes...');

    const collections = [
      'jobconfigurations',
      'jobexecutionlogs',
      'logdetails',
      'weatherdata'
    ];

    for (const collectionName of collections) {
      try {
        // Check if collection exists first
        const collectionsList = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
        if (collectionsList.length === 0) {
          logger.info(`Collection ${collectionName} does not exist yet, skipping verification`);
          continue;
        }

        const collection = mongoose.connection.db.collection(collectionName);
        const indexes = await collection.indexes();

        logger.info(`Collection ${collectionName} has ${indexes.length} indexes`, {
          collection: collectionName,
          indexCount: indexes.length,
          indexes: indexes.map(idx => idx.name)
        });
      } catch (error) {
        logger.warn(`Failed to verify indexes for ${collectionName}`, { error: error.message });
        // Continue with other collections
      }
    }

    logger.info('Index verification completed');
  } catch (error) {
    logger.error('Index verification failed', { error: error.message });
    throw error;
  }
}

/**
 * Drop and recreate all indexes (use with caution)
 */
export async function recreateIndexes() {
  try {
    logger.warn('Recreating all indexes - this may take some time...');
    
    const collections = [
      'jobconfigurations',
      'jobexecutionlogs'
    ];
    
    // Drop existing indexes (except _id)
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        await collection.dropIndexes();
        logger.info(`Dropped indexes for collection: ${collectionName}`);
      } catch (error) {
        // Collection might not exist yet, which is fine
        logger.debug(`Could not drop indexes for ${collectionName}: ${error.message}`);
      }
    }
    
    // Recreate all indexes
    await initializeDatabase();
    
    logger.info('Index recreation completed');
  } catch (error) {
    logger.error('Index recreation failed', { error: error.message });
    throw error;
  }
}

/**
 * Get database statistics and health information
 */
export async function getDatabaseStats() {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    
    const collections = await db.listCollections().toArray();
    const collectionStats = {};
    
    for (const collection of collections) {
      try {
        const collStats = await db.collection(collection.name).stats();
        collectionStats[collection.name] = {
          count: collStats.count,
          size: collStats.size,
          avgObjSize: collStats.avgObjSize,
          indexCount: collStats.nindexes,
          totalIndexSize: collStats.totalIndexSize
        };
      } catch (error) {
        // Some collections might not support stats
        collectionStats[collection.name] = { error: error.message };
      }
    }
    
    return {
      database: {
        name: stats.db,
        collections: stats.collections,
        objects: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      },
      collections: collectionStats
    };
  } catch (error) {
    logger.error('Failed to get database stats', { error: error.message });
    throw error;
  }
}