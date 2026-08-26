import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import LogDetail from '../models/LogDetail.js';
import WeatherData from '../models/WeatherData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask user a question
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wingcopter');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Function to generate timestamp for report filename
function generateTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

// Function to write report to file
function writeReport(reportContent, filename) {
  const reportPath = path.join(__dirname, '../../', filename);
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`Report written to: ${filename}`);
}

// Main cleanup function
async function cleanupUnmatchedData() {
  try {
    await connectDB();
    
    console.log('Starting data cleanup process...');
    console.log('Matching WeatherData.flightLog with LogDetail.key');
    console.log('');
    
    // Get all LogDetail keys more efficiently
    console.log('Fetching all LogDetail keys...');
    const logDetailKeys = await LogDetail.distinct('key');
    const logDetailKeySet = new Set(logDetailKeys.filter(key => key)); // Remove null/undefined
    console.log(`Found ${logDetailKeySet.size} unique LogDetail keys`);
    
    // Get all WeatherData flightLog values
    console.log('Fetching all WeatherData flightLog values...');
    const weatherFlightLogs = await WeatherData.distinct('flightLog');
    const weatherFlightLogSet = new Set(weatherFlightLogs.filter(log => log)); // Remove null/undefined
    console.log(`Found ${weatherFlightLogSet.size} unique WeatherData flightLog values`);
    
    // Find unmatched entries
    console.log('Analyzing matches...');
    const unmatchedWeatherLogs = [...weatherFlightLogSet].filter(log => !logDetailKeySet.has(log));
    const unmatchedLogDetailKeys = [...logDetailKeySet].filter(key => !weatherFlightLogSet.has(key));
    
    console.log('');
    console.log('=== ANALYSIS RESULTS ===');
    console.log(`Total unique LogDetail keys: ${logDetailKeySet.size}`);
    console.log(`Total unique WeatherData flightLogs: ${weatherFlightLogSet.size}`);
    console.log(`Unmatched WeatherData flightLogs: ${unmatchedWeatherLogs.length}`);
    console.log(`Unmatched LogDetail keys: ${unmatchedLogDetailKeys.length}`);
    
    // Count actual records that will be affected
    console.log('Counting affected records...');
    const unmatchedWeatherCount = await WeatherData.countDocuments({ 
      flightLog: { $in: unmatchedWeatherLogs } 
    });
    const unmatchedLogDetailCount = await LogDetail.countDocuments({ 
      key: { $in: unmatchedLogDetailKeys } 
    });
    
    console.log(`WeatherData records to be removed: ${unmatchedWeatherCount}`);
    console.log(`LogDetail records to be removed: ${unmatchedLogDetailCount}`);
    console.log('');
    
    // Generate detailed report
    const timestamp = generateTimestamp();
    const reportFilename = `cleanup_report_${timestamp}.txt`;
    
    let reportContent = `DATA CLEANUP REPORT\n`;
    reportContent += `Generated: ${new Date().toISOString()}\n`;
    reportContent += `=`.repeat(80) + '\n\n';
    
    reportContent += `SUMMARY:\n`;
    reportContent += `-`.repeat(40) + '\n';
    reportContent += `Total unique LogDetail keys: ${logDetailKeySet.size}\n`;
    reportContent += `Total unique WeatherData flightLogs: ${weatherFlightLogSet.size}\n`;
    reportContent += `Unmatched WeatherData flightLogs: ${unmatchedWeatherLogs.length}\n`;
    reportContent += `Unmatched LogDetail keys: ${unmatchedLogDetailKeys.length}\n`;
    reportContent += `WeatherData records to be removed: ${unmatchedWeatherCount}\n`;
    reportContent += `LogDetail records to be removed: ${unmatchedLogDetailCount}\n\n`;
    
    // Get ALL unmatched WeatherData records for detailed report
    console.log('Fetching all unmatched WeatherData records...');
    const allUnmatchedWeather = await WeatherData.find({ 
      flightLog: { $in: unmatchedWeatherLogs } 
    }).lean();
    
    reportContent += `ALL UNMATCHED WEATHERDATA RECORDS (${unmatchedWeatherCount} total):\n`;
    reportContent += `-`.repeat(70) + '\n';
    reportContent += `These WeatherData records have flightLog values that don't match any LogDetail key:\n\n`;
    
    allUnmatchedWeather.forEach((record, index) => {
      reportContent += `${index + 1}. ID: ${record._id}\n`;
      reportContent += `   Flight Log: ${record.flightLog}\n`;
      reportContent += `   UA SN: ${record.uaSN}\n`;
      reportContent += `   Location: ${record.location || 'N/A'}\n`;
      reportContent += `   Temperature: ${record.temperature || 'N/A'}°C\n`;
      reportContent += `   Pressure: ${record.pressure || 'N/A'} hPa\n`;
      reportContent += `   Humidity: ${record.humidity || 'N/A'}%\n`;
      reportContent += `   Wind Run: ${record.windRun || 'N/A'} m/s\n`;
      reportContent += `   Max Gust: ${record.maxGust || 'N/A'} m/s\n`;
      reportContent += `   AMSL: ${record.amsl || 'N/A'} m\n`;
      reportContent += `   Wind Direction: ${record.windDirection || 'N/A'}\n`;
      reportContent += `   Takeoff Time: ${record.takeoffTime || 'N/A'}\n`;
      reportContent += `   Landing Time: ${record.landingTime || 'N/A'}\n`;
      reportContent += `   High Temp: ${record.highTemp || 'N/A'}°C\n`;
      reportContent += `   Created: ${record.createdAt}\n`;
      reportContent += `   Updated: ${record.updatedAt}\n`;
      reportContent += '\n';
    });
    
    // Get ALL unmatched LogDetail records
    console.log('Fetching all unmatched LogDetail records...');
    const allUnmatchedLogDetail = await LogDetail.find({ 
      key: { $in: unmatchedLogDetailKeys } 
    }).lean();
    
    reportContent += `\nALL UNMATCHED LOGDETAIL RECORDS (${unmatchedLogDetailCount} total):\n`;
    reportContent += `-`.repeat(70) + '\n';
    reportContent += `These LogDetail keys don't have corresponding WeatherData records:\n\n`;
    
    allUnmatchedLogDetail.forEach((record, index) => {
      reportContent += `${index + 1}. ID: ${record._id}\n`;
      reportContent += `   Key: ${record.key}\n`;
      reportContent += `   SN: ${record.sn}\n`;
      reportContent += `   Date: ${record.date}\n`;
      reportContent += `   Total Time: ${record.total_time || 'N/A'} hours\n`;
      reportContent += `   Flight Time: ${record.flight_time || 'N/A'} seconds\n`;
      reportContent += `   Filtered Flight Time: ${record.filtered_flight_time || 'N/A'} seconds\n`;
      reportContent += `   MC Time: ${record.mc_time || 'N/A'} seconds\n`;
      reportContent += `   FW Time: ${record.fw_time || 'N/A'} seconds\n`;
      reportContent += `   FC Version: ${record.fc_version || 'N/A'}\n`;
      reportContent += `   CS Version: ${record.cs_version || 'N/A'}\n`;
      reportContent += `   Forward Transitions: ${record.fwd_transitions || 'N/A'}\n`;
      reportContent += `   Backward Transitions: ${record.bwd_transitions || 'N/A'}\n`;
      reportContent += `   Distance: ${record.distance || 'N/A'} m\n`;
      reportContent += `   Forward Distance: ${record.fwd_distance || 'N/A'} m\n`;
      reportContent += `   Backward Distance: ${record.bwd_distance || 'N/A'} m\n`;
      reportContent += `   LTE Loss: ${record.lte_loss || 'N/A'}\n`;
      reportContent += `   RTH Loss: ${record.rth_loss || 'N/A'}\n`;
      reportContent += `   RTH Logs: ${record.rth_logs || 'N/A'}\n`;
      reportContent += `   Max MC XY Deviation: ${record.max_mc_xy_deviation || 'N/A'} m\n`;
      reportContent += `   Max MC Altitude Deviation: ${record.max_mc_altitude_deviation || 'N/A'} m\n`;
      reportContent += `   Max FW XY Deviation: ${record.max_fw_xy_deviation || 'N/A'} m\n`;
      reportContent += `   Max FW Altitude Deviation: ${record.max_fw_altitude_deviation || 'N/A'} m\n`;
      reportContent += `   Battery 0 SN: ${record.battery_0_sn || 'N/A'}\n`;
      reportContent += `   Battery 0 Cycle: ${record.battery_0_cycle || 'N/A'}\n`;
      reportContent += `   Battery 0 Max Temp: ${record.battery_0_max_temp || 'N/A'}°C\n`;
      reportContent += `   Battery 0 Remaining: ${record.battery_0_remaining || 'N/A'}\n`;
      reportContent += `   Battery 1 SN: ${record.battery_1_sn || 'N/A'}\n`;
      reportContent += `   Battery 1 Cycle: ${record.battery_1_cycle || 'N/A'}\n`;
      reportContent += `   Battery 1 Max Temp: ${record.battery_1_max_temp || 'N/A'}°C\n`;
      reportContent += `   Battery 1 Remaining: ${record.battery_1_remaining || 'N/A'}\n`;
      reportContent += `   Calculated Groundspeed: ${record.calculated_groundspeed || 'N/A'} m/s\n`;
      reportContent += `   Last Usage: ${record.last_usage || 'N/A'}\n`;
      reportContent += `   Flight: ${record.flight || 'N/A'}\n`;
      reportContent += `   Created: ${record.createdAt}\n`;
      reportContent += `   Updated: ${record.updatedAt}\n`;
      reportContent += '\n';
    });
    
    // List all unmatched flightLog values
    reportContent += `\nCOMPLETE LIST OF UNMATCHED WEATHERDATA FLIGHTLOG VALUES (${unmatchedWeatherLogs.length} total):\n`;
    reportContent += `-`.repeat(80) + '\n';
    unmatchedWeatherLogs.forEach((log, index) => {
      reportContent += `${index + 1}. ${log}\n`;
    });
    
    reportContent += `\nCOMPLETE LIST OF UNMATCHED LOGDETAIL KEYS (${unmatchedLogDetailKeys.length} total):\n`;
    reportContent += `-`.repeat(70) + '\n';
    unmatchedLogDetailKeys.forEach((key, index) => {
      reportContent += `${index + 1}. ${key}\n`;
    });
    
    // Add some statistics
    reportContent += `\nSTATISTICS:\n`;
    reportContent += `-`.repeat(30) + '\n';
    reportContent += `Percentage of matched records: ${((logDetailKeySet.size - unmatchedLogDetailKeys.length) / logDetailKeySet.size * 100).toFixed(2)}%\n`;
    reportContent += `Percentage of unmatched LogDetail: ${(unmatchedLogDetailKeys.length / logDetailKeySet.size * 100).toFixed(2)}%\n`;
    reportContent += `Percentage of unmatched WeatherData: ${(unmatchedWeatherLogs.length / weatherFlightLogSet.size * 100).toFixed(2)}%\n`;
    
    // Add sample of matched records for verification
    reportContent += `\nSAMPLE MATCHED RECORDS (First 20 for verification):\n`;
    reportContent += `-`.repeat(60) + '\n';
    reportContent += `These records have matching flightLog/key pairs:\n\n`;
    
    const matchedSample = [...logDetailKeySet].filter(key => weatherFlightLogSet.has(key)).slice(0, 20);
    for (let i = 0; i < matchedSample.length; i++) {
      const key = matchedSample[i];
      const weatherRecord = await WeatherData.findOne({ flightLog: key }).lean();
      const logDetailRecord = await LogDetail.findOne({ key: key }).lean();
      
      reportContent += `${i + 1}. Flight Log/Key: ${key}\n`;
      reportContent += `   WeatherData ID: ${weatherRecord._id}\n`;
      reportContent += `   LogDetail ID: ${logDetailRecord._id}\n`;
      reportContent += `   UA SN: ${weatherRecord.uaSN} | LogDetail SN: ${logDetailRecord.sn}\n`;
      reportContent += `   Location: ${weatherRecord.location || 'N/A'}\n`;
      reportContent += `   Temperature: ${weatherRecord.temperature || 'N/A'}°C\n`;
      reportContent += `   Flight Time: ${logDetailRecord.flight_time || 'N/A'} seconds\n`;
      reportContent += '\n';
    }
    
    // Write report to file
    writeReport(reportContent, reportFilename);
    
    console.log('CLEANUP OPTIONS:');
    console.log('1. Remove unmatched WeatherData records only');
    console.log('2. Remove unmatched LogDetail records only');
    console.log('3. Remove both unmatched WeatherData and LogDetail records');
    console.log('4. Exit without removing anything');
    console.log('');
    console.log('Please review the generated report before proceeding.');
    console.log(`Report saved as: ${reportFilename}`);
    console.log('');
    
    // Interactive prompt for user choice
    const choice = await askQuestion('Enter your choice (1-4): ');
    const choiceNum = parseInt(choice);
    
    if (choiceNum >= 1 && choiceNum <= 3) {
      console.log('');
      console.log('⚠️  WARNING: This action will permanently delete data from the database!');
      console.log('');
      
      if (choiceNum === 1 || choiceNum === 3) {
        console.log(`This will delete ${unmatchedWeatherCount} WeatherData records.`);
      }
      if (choiceNum === 2 || choiceNum === 3) {
        console.log(`This will delete ${unmatchedLogDetailCount} LogDetail records.`);
      }
      
      console.log('');
      const confirm = await askQuestion('Are you sure you want to proceed? (yes/no): ');
      
      if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
        await performCleanup(choiceNum, unmatchedWeatherLogs, unmatchedLogDetailKeys);
      } else {
        console.log('Cleanup cancelled. No data was deleted.');
      }
    } else if (choiceNum === 4) {
      console.log('Exiting without removing anything.');
    } else {
      console.log('Invalid choice. Exiting without removing anything.');
    }
    
    rl.close();
    
  } catch (error) {
    console.error('Error during cleanup process:', error);
    rl.close();
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Function to actually perform the cleanup
async function performCleanup(option, unmatchedWeatherLogs, unmatchedLogDetailKeys) {
  console.log('');
  console.log(`🔄 Performing cleanup option: ${option}`);
  console.log('');
  
  let deletedWeatherCount = 0;
  let deletedLogDetailCount = 0;
  
  try {
    if (option === 1 || option === 3) {
      // Delete unmatched WeatherData records
      console.log('Deleting unmatched WeatherData records...');
      const weatherDeleteResult = await WeatherData.deleteMany({
        flightLog: { $in: unmatchedWeatherLogs }
      });
      deletedWeatherCount = weatherDeleteResult.deletedCount;
      console.log(`✅ Deleted ${deletedWeatherCount} unmatched WeatherData records`);
    }
    
    if (option === 2 || option === 3) {
      // Delete unmatched LogDetail records
      console.log('Deleting unmatched LogDetail records...');
      const logDetailDeleteResult = await LogDetail.deleteMany({
        key: { $in: unmatchedLogDetailKeys }
      });
      deletedLogDetailCount = logDetailDeleteResult.deletedCount;
      console.log(`✅ Deleted ${deletedLogDetailCount} unmatched LogDetail records`);
    }
    
    // Generate cleanup summary
    const timestamp = generateTimestamp();
    const summaryFilename = `cleanup_summary_${timestamp}.txt`;
    
    let summaryContent = `CLEANUP SUMMARY\n`;
    summaryContent += `Generated: ${new Date().toISOString()}\n`;
    summaryContent += `=`.repeat(50) + '\n\n';
    summaryContent += `Cleanup Option Selected: ${option}\n`;
    summaryContent += `Deleted WeatherData records: ${deletedWeatherCount}\n`;
    summaryContent += `Deleted LogDetail records: ${deletedLogDetailCount}\n`;
    summaryContent += `Total records deleted: ${deletedWeatherCount + deletedLogDetailCount}\n\n`;
    
    if (option === 1) {
      summaryContent += `Action: Removed unmatched WeatherData records only\n`;
    } else if (option === 2) {
      summaryContent += `Action: Removed unmatched LogDetail records only\n`;
    } else if (option === 3) {
      summaryContent += `Action: Removed both unmatched WeatherData and LogDetail records\n`;
    }
    
    summaryContent += `\nRemaining records after cleanup:\n`;
    const remainingWeatherCount = await WeatherData.countDocuments();
    const remainingLogDetailCount = await LogDetail.countDocuments();
    summaryContent += `WeatherData records: ${remainingWeatherCount}\n`;
    summaryContent += `LogDetail records: ${remainingLogDetailCount}\n`;
    
    writeReport(summaryContent, summaryFilename);
    
    console.log('');
    console.log('🎉 Cleanup completed successfully!');
    console.log(`📊 Summary report saved as: ${summaryFilename}`);
    console.log('');
    console.log('Final database state:');
    console.log(`  WeatherData records: ${remainingWeatherCount}`);
    console.log(`  LogDetail records: ${remainingLogDetailCount}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the script
cleanupUnmatchedData();