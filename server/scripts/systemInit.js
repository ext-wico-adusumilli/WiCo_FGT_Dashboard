#!/usr/bin/env node

/**
 * System Initialization CLI Script
 * 
 * This script provides command-line utilities for initializing and managing
 * the data pre-aggregation system.
 * 
 * Usage:
 *   node scripts/systemInit.js [command] [options]
 * 
 * Commands:
 *   init          - Initialize database indexes and aggregation system
 *   verify        - Verify database indexes and system health
 *   recreate      - Recreate all database indexes (destructive)
 *   status        - Show system status
 *   restart-jobs  - Restart aggregation system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

import { connectDB } from '../config/db.js';
import { initializeDatabase, verifyIndexes, recreateIndexes, getDatabaseStats } from '../config/dbInitialization.js';
import { initializeSystem, getSystemStatus, restartAggregationSystem } from '../config/startup.js';
import logger from '../config/logger.js';

// Parse command line arguments
const command = process.argv[2] || 'help';
const options = process.argv.slice(3);

/**
 * Display help information
 */
function showHelp() {
  console.log(`
Data Pre-Aggregation System Initialization CLI

Usage: node scripts/systemInit.js [command] [options]

Commands:
  init          Initialize database indexes and aggregation system
  verify        Verify database indexes and system health
  recreate      Recreate all database indexes (DESTRUCTIVE - use with caution)
  status        Show current system status and health
  restart-jobs  Restart the aggregation system
  stats         Show database statistics
  help          Show this help message

Options:
  --verbose     Enable verbose logging
  --force       Force operations (skip confirmations)

Examples:
  node scripts/systemInit.js init
  node scripts/systemInit.js verify --verbose
  node scripts/systemInit.js recreate --force
  node scripts/systemInit.js status
`);
}

/**
 * Initialize the complete system
 */
async function initializeSystemCommand() {
  try {
    console.log('🚀 Initializing system...\n');
    
    const result = await initializeSystem();
    
    if (result.success) {
      console.log('✅ System initialization completed successfully!');
      console.log(`   Initialization time: ${result.initializationTimeMs}ms`);
      console.log(`   Aggregation system: ${result.aggregationSystem.status}`);
      console.log(`   Active jobs: ${result.aggregationSystem.details.activeJobs}`);
      console.log(`   Total jobs: ${result.aggregationSystem.details.totalJobs}`);
    } else {
      console.error('❌ System initialization failed:');
      console.error(`   Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error during initialization:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Verify system health and indexes
 */
async function verifySystemCommand() {
  try {
    console.log('🔍 Verifying system health...\n');
    
    // Verify database indexes
    await verifyIndexes();
    
    // Get system status
    const status = getSystemStatus();
    
    console.log('✅ System verification completed!');
    console.log(`   System status: ${status.status}`);
    console.log(`   Uptime: ${Math.round(status.uptime)}s`);
    console.log(`   Memory usage: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`);
    
    if (status.aggregationSystem) {
      console.log(`   Aggregation system: ${status.aggregationSystem.status}`);
      console.log(`   Scheduled jobs: ${status.aggregationSystem.details.totalJobs}`);
      console.log(`   Active jobs: ${status.aggregationSystem.details.activeJobs}`);
    }
    
    if (options.includes('--verbose')) {
      console.log('\n📊 Detailed status:');
      console.log(JSON.stringify(status, null, 2));
    }
  } catch (error) {
    console.error('❌ System verification failed:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Recreate all database indexes
 */
async function recreateIndexesCommand() {
  try {
    if (!options.includes('--force')) {
      console.log('⚠️  WARNING: This will drop and recreate all database indexes.');
      console.log('   This operation may take some time and could impact performance.');
      console.log('   Use --force flag to skip this confirmation.');
      process.exit(1);
    }
    
    console.log('🔄 Recreating database indexes...\n');
    
    await recreateIndexes();
    
    console.log('✅ Database indexes recreated successfully!');
  } catch (error) {
    console.error('❌ Failed to recreate indexes:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show current system status
 */
async function showStatusCommand() {
  try {
    console.log('📊 System Status\n');
    
    const status = getSystemStatus();
    
    // System overview
    console.log(`Status: ${status.status}`);
    console.log(`Uptime: ${Math.round(status.uptime)}s`);
    console.log(`Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB heap used`);
    console.log(`Timestamp: ${status.timestamp}`);
    
    // Aggregation system details
    if (status.aggregationSystem) {
      console.log('\n🔧 Aggregation System:');
      console.log(`  Status: ${status.aggregationSystem.status}`);
      console.log(`  Message: ${status.aggregationSystem.message}`);
      
      if (status.aggregationSystem.details) {
        console.log(`  Total Jobs: ${status.aggregationSystem.details.totalJobs}`);
        console.log(`  Active Jobs: ${status.aggregationSystem.details.activeJobs}`);
        console.log(`  Running Jobs: ${status.aggregationSystem.details.runningJobs}`);
        console.log(`  Available Aggregators: ${status.aggregationSystem.details.availableAggregators}`);
      }
    }
    
    if (options.includes('--verbose')) {
      console.log('\n📋 Full Status Details:');
      console.log(JSON.stringify(status, null, 2));
    }
  } catch (error) {
    console.error('❌ Failed to get system status:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Restart aggregation system
 */
async function restartJobsCommand() {
  try {
    console.log('🔄 Restarting aggregation system...\n');
    
    const result = await restartAggregationSystem();
    
    if (result.success) {
      console.log('✅ Aggregation system restarted successfully!');
      console.log(`   Status: ${result.status}`);
    } else {
      console.error('❌ Failed to restart aggregation system:');
      console.error(`   ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error during restart:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show database statistics
 */
async function showStatsCommand() {
  try {
    console.log('📈 Database Statistics\n');
    
    const stats = await getDatabaseStats();
    
    console.log(`Database: ${stats.database.name}`);
    console.log(`Collections: ${stats.database.collections}`);
    console.log(`Total Objects: ${stats.database.objects}`);
    console.log(`Data Size: ${Math.round(stats.database.dataSize / 1024 / 1024)}MB`);
    console.log(`Storage Size: ${Math.round(stats.database.storageSize / 1024 / 1024)}MB`);
    console.log(`Index Size: ${Math.round(stats.database.indexSize / 1024 / 1024)}MB`);
    
    console.log('\n📋 Collection Details:');
    for (const [name, collStats] of Object.entries(stats.collections)) {
      if (collStats.error) {
        console.log(`  ${name}: Error - ${collStats.error}`);
      } else {
        console.log(`  ${name}:`);
        console.log(`    Documents: ${collStats.count}`);
        console.log(`    Size: ${Math.round(collStats.size / 1024)}KB`);
        console.log(`    Indexes: ${collStats.indexCount}`);
        console.log(`    Index Size: ${Math.round(collStats.totalIndexSize / 1024)}KB`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to get database statistics:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Set up verbose logging if requested
    if (options.includes('--verbose')) {
      process.env.LOG_LEVEL = 'debug';
    }
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected\n');
    
    // Execute command
    switch (command) {
      case 'init':
        await initializeSystemCommand();
        break;
      case 'verify':
        await verifySystemCommand();
        break;
      case 'recreate':
        await recreateIndexesCommand();
        break;
      case 'status':
        await showStatusCommand();
        break;
      case 'restart-jobs':
        await restartJobsCommand();
        break;
      case 'stats':
        await showStatsCommand();
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
    
    // Close database connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    
  } catch (error) {
    console.error('❌ Fatal error:');
    console.error(`   ${error.message}`);
    
    if (options.includes('--verbose')) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, closing database connection...');
  try {
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, closing database connection...');
  try {
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error closing database connection:', error.message);
  }
  process.exit(0);
});

// Run the main function
main().catch((error) => {
  console.error('Unhandled error in main:', error.message);
  process.exit(1);
});