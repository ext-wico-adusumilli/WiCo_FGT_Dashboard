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

// Function to find duplicates in LogDetail collection
async function findLogDetailDuplicates() {
  console.log('Finding duplicates in LogDetail collection...');
  
  // Find duplicates based on 'key' field
  const duplicatesByKey = await LogDetail.aggregate([
    {
      $group: {
        _id: '$key',
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  // Find duplicates based on combination of SN + Date + Flight_time
  const duplicatesBySnDateTime = await LogDetail.aggregate([
    {
      $group: {
        _id: {
          sn: '$sn',
          date: '$date',
          flight_time: '$flight_time'
        },
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return {
    byKey: duplicatesByKey,
    bySnDateTime: duplicatesBySnDateTime
  };
}

// Function to find duplicates in WeatherData collection
async function findWeatherDataDuplicates() {
  console.log('Finding duplicates in WeatherData collection...');
  
  // Find duplicates based on 'flightLog' field
  const duplicatesByFlightLog = await WeatherData.aggregate([
    {
      $group: {
        _id: '$flightLog',
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  // Find duplicates based on combination of uaSN + flightLog + location
  const duplicatesBySnLogLocation = await WeatherData.aggregate([
    {
      $group: {
        _id: {
          uaSN: '$uaSN',
          flightLog: '$flightLog',
          location: '$location'
        },
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  return {
    byFlightLog: duplicatesByFlightLog,
    bySnLogLocation: duplicatesBySnLogLocation
  };
}

// Function to generate detailed duplicate report
function generateDuplicateReport(logDetailDuplicates, weatherDataDuplicates) {
  const timestamp = generateTimestamp();
  const reportFilename = `duplicate_analysis_${timestamp}.txt`;
  
  let reportContent = `DUPLICATE ANALYSIS REPORT\n`;
  reportContent += `Generated: ${new Date().toISOString()}\n`;
  reportContent += `=`.repeat(80) + '\n\n';
  
  // LogDetail duplicates summary
  reportContent += `LOGDETAIL DUPLICATES SUMMARY:\n`;
  reportContent += `-`.repeat(50) + '\n';
  reportContent += `Duplicates by Key: ${logDetailDuplicates.byKey.length} groups\n`;
  reportContent += `Duplicates by SN+Date+FlightTime: ${logDetailDuplicates.bySnDateTime.length} groups\n\n`;
  
  // WeatherData duplicates summary
  reportContent += `WEATHERDATA DUPLICATES SUMMARY:\n`;
  reportContent += `-`.repeat(50) + '\n';
  reportContent += `Duplicates by FlightLog: ${weatherDataDuplicates.byFlightLog.length} groups\n`;
  reportContent += `Duplicates by SN+FlightLog+Location: ${weatherDataDuplicates.bySnLogLocation.length} groups\n\n`;
  
  // Detailed LogDetail duplicates by Key
  if (logDetailDuplicates.byKey.length > 0) {
    reportContent += `DETAILED LOGDETAIL DUPLICATES BY KEY (${logDetailDuplicates.byKey.length} groups):\n`;
    reportContent += `-`.repeat(70) + '\n';
    
    logDetailDuplicates.byKey.forEach((group, groupIndex) => {
      reportContent += `\nGroup ${groupIndex + 1}: Key "${group._id}" (${group.count} duplicates)\n`;
      reportContent += `${'='.repeat(60)}\n`;
      
      // Sort records by creation date (newest first) to show which will be kept
      const sortedRecords = group.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      sortedRecords.forEach((record, recordIndex) => {
        const status = recordIndex === 0 ? ' [WILL BE KEPT - LATEST]' : ' [WILL BE REMOVED - OLDER]';
        reportContent += `  Record ${recordIndex + 1}:${status}\n`;
        reportContent += `    ID: ${record._id}\n`;
        reportContent += `    SN: ${record.sn}\n`;
        reportContent += `    Date: ${record.date}\n`;
        reportContent += `    Flight Time: ${record.flight_time || 'N/A'} seconds\n`;
        reportContent += `    Total Time: ${record.total_time || 'N/A'} hours\n`;
        reportContent += `    FC Version: ${record.fc_version || 'N/A'}\n`;
        reportContent += `    CS Version: ${record.cs_version || 'N/A'}\n`;
        reportContent += `    Distance: ${record.distance || 'N/A'} m\n`;
        reportContent += `    Forward Transitions: ${record.fwd_transitions || 'N/A'}\n`;
        reportContent += `    Backward Transitions: ${record.bwd_transitions || 'N/A'}\n`;
        reportContent += `    Battery 0 SN: ${record.battery_0_sn || 'N/A'}\n`;
        reportContent += `    Battery 1 SN: ${record.battery_1_sn || 'N/A'}\n`;
        reportContent += `    Created: ${record.createdAt}\n`;
        reportContent += `    Updated: ${record.updatedAt}\n`;
        reportContent += '\n';
      });
    });
  }
  
  // Detailed LogDetail duplicates by SN+Date+FlightTime
  if (logDetailDuplicates.bySnDateTime.length > 0) {
    reportContent += `\nDETAILED LOGDETAIL DUPLICATES BY SN+DATE+FLIGHTTIME (${logDetailDuplicates.bySnDateTime.length} groups):\n`;
    reportContent += `-`.repeat(80) + '\n';
    
    logDetailDuplicates.bySnDateTime.forEach((group, groupIndex) => {
      reportContent += `\nGroup ${groupIndex + 1}: SN="${group._id.sn}", Date="${group._id.date}", FlightTime="${group._id.flight_time}" (${group.count} duplicates)\n`;
      reportContent += `${'='.repeat(80)}\n`;
      
      group.records.forEach((record, recordIndex) => {
        reportContent += `  Record ${recordIndex + 1}:\n`;
        reportContent += `    ID: ${record._id}\n`;
        reportContent += `    Key: ${record.key}\n`;
        reportContent += `    FC Version: ${record.fc_version || 'N/A'}\n`;
        reportContent += `    CS Version: ${record.cs_version || 'N/A'}\n`;
        reportContent += `    Distance: ${record.distance || 'N/A'} m\n`;
        reportContent += `    Created: ${record.createdAt}\n`;
        reportContent += `    Updated: ${record.updatedAt}\n`;
        reportContent += '\n';
      });
    });
  }
  
  // Detailed WeatherData duplicates by FlightLog
  if (weatherDataDuplicates.byFlightLog.length > 0) {
    reportContent += `\nDETAILED WEATHERDATA DUPLICATES BY FLIGHTLOG (${weatherDataDuplicates.byFlightLog.length} groups):\n`;
    reportContent += `-`.repeat(70) + '\n';
    
    weatherDataDuplicates.byFlightLog.forEach((group, groupIndex) => {
      reportContent += `\nGroup ${groupIndex + 1}: FlightLog "${group._id}" (${group.count} duplicates)\n`;
      reportContent += `${'='.repeat(60)}\n`;
      
      // Sort records by creation date (newest first) to show which will be kept
      const sortedRecords = group.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      sortedRecords.forEach((record, recordIndex) => {
        const status = recordIndex === 0 ? ' [WILL BE KEPT - LATEST]' : ' [WILL BE REMOVED - OLDER]';
        reportContent += `  Record ${recordIndex + 1}:${status}\n`;
        reportContent += `    ID: ${record._id}\n`;
        reportContent += `    UA SN: ${record.uaSN}\n`;
        reportContent += `    Location: ${record.location || 'N/A'}\n`;
        reportContent += `    Temperature: ${record.temperature || 'N/A'}°C\n`;
        reportContent += `    Pressure: ${record.pressure || 'N/A'} hPa\n`;
        reportContent += `    Humidity: ${record.humidity || 'N/A'}%\n`;
        reportContent += `    Wind Run: ${record.windRun || 'N/A'} m/s\n`;
        reportContent += `    Max Gust: ${record.maxGust || 'N/A'} m/s\n`;
        reportContent += `    AMSL: ${record.amsl || 'N/A'} m\n`;
        reportContent += `    Wind Direction: ${record.windDirection || 'N/A'}\n`;
        reportContent += `    Takeoff Time: ${record.takeoffTime || 'N/A'}\n`;
        reportContent += `    Landing Time: ${record.landingTime || 'N/A'}\n`;
        reportContent += `    Created: ${record.createdAt}\n`;
        reportContent += `    Updated: ${record.updatedAt}\n`;
        reportContent += '\n';
      });
    });
  }
  
  // Detailed WeatherData duplicates by SN+FlightLog+Location
  if (weatherDataDuplicates.bySnLogLocation.length > 0) {
    reportContent += `\nDETAILED WEATHERDATA DUPLICATES BY SN+FLIGHTLOG+LOCATION (${weatherDataDuplicates.bySnLogLocation.length} groups):\n`;
    reportContent += `-`.repeat(80) + '\n';
    
    weatherDataDuplicates.bySnLogLocation.forEach((group, groupIndex) => {
      reportContent += `\nGroup ${groupIndex + 1}: SN="${group._id.uaSN}", FlightLog="${group._id.flightLog}", Location="${group._id.location}" (${group.count} duplicates)\n`;
      reportContent += `${'='.repeat(80)}\n`;
      
      group.records.forEach((record, recordIndex) => {
        reportContent += `  Record ${recordIndex + 1}:\n`;
        reportContent += `    ID: ${record._id}\n`;
        reportContent += `    Temperature: ${record.temperature || 'N/A'}°C\n`;
        reportContent += `    Pressure: ${record.pressure || 'N/A'} hPa\n`;
        reportContent += `    Humidity: ${record.humidity || 'N/A'}%\n`;
        reportContent += `    Created: ${record.createdAt}\n`;
        reportContent += `    Updated: ${record.updatedAt}\n`;
        reportContent += '\n';
      });
    });
  }
  
  // Statistics
  let totalLogDetailDuplicateRecords = 0;
  let totalWeatherDataDuplicateRecords = 0;
  
  logDetailDuplicates.byKey.forEach(group => {
    totalLogDetailDuplicateRecords += group.count - 1; // Subtract 1 to count only the extra duplicates
  });
  
  weatherDataDuplicates.byFlightLog.forEach(group => {
    totalWeatherDataDuplicateRecords += group.count - 1; // Subtract 1 to count only the extra duplicates
  });
  
  reportContent += `\nSTATISTICS:\n`;
  reportContent += `-`.repeat(30) + '\n';
  reportContent += `Total LogDetail duplicate records that could be removed: ${totalLogDetailDuplicateRecords}\n`;
  reportContent += `Total WeatherData duplicate records that could be removed: ${totalWeatherDataDuplicateRecords}\n`;
  reportContent += `Total duplicate records across both collections: ${totalLogDetailDuplicateRecords + totalWeatherDataDuplicateRecords}\n`;
  
  writeReport(reportContent, reportFilename);
  return reportFilename;
}

// Function to remove duplicates
async function removeDuplicates(option, logDetailDuplicates, weatherDataDuplicates) {
  console.log('');
  console.log(`🔄 Performing duplicate removal option: ${option}`);
  console.log('');
  
  let removedLogDetailCount = 0;
  let removedWeatherDataCount = 0;
  
  try {
    if (option === 1 || option === 3) {
      // Remove LogDetail duplicates (keep the latest record, remove the older ones)
      console.log('Removing LogDetail duplicates...');
      
      for (const group of logDetailDuplicates.byKey) {
        if (group.count > 1) {
          // Keep the latest record (newest by creation date), remove the rest
          const recordsToRemove = group.records
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort descending (newest first)
            .slice(1); // Remove all except the first one (which is the newest)
          
          const idsToRemove = recordsToRemove.map(record => record._id);
          const deleteResult = await LogDetail.deleteMany({ _id: { $in: idsToRemove } });
          removedLogDetailCount += deleteResult.deletedCount;
        }
      }
      
      console.log(`✅ Removed ${removedLogDetailCount} duplicate LogDetail records (kept latest versions)`);
    }
    
    if (option === 2 || option === 3) {
      // Remove WeatherData duplicates (keep the latest record, remove the older ones)
      console.log('Removing WeatherData duplicates...');
      
      for (const group of weatherDataDuplicates.byFlightLog) {
        if (group.count > 1) {
          // Keep the latest record (newest by creation date), remove the rest
          const recordsToRemove = group.records
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort descending (newest first)
            .slice(1); // Remove all except the first one (which is the newest)
          
          const idsToRemove = recordsToRemove.map(record => record._id);
          const deleteResult = await WeatherData.deleteMany({ _id: { $in: idsToRemove } });
          removedWeatherDataCount += deleteResult.deletedCount;
        }
      }
      
      console.log(`✅ Removed ${removedWeatherDataCount} duplicate WeatherData records (kept latest versions)`);
    }
    
    // Generate removal summary
    const timestamp = generateTimestamp();
    const summaryFilename = `duplicate_removal_summary_${timestamp}.txt`;
    
    let summaryContent = `DUPLICATE REMOVAL SUMMARY\n`;
    summaryContent += `Generated: ${new Date().toISOString()}\n`;
    summaryContent += `=`.repeat(50) + '\n\n';
    summaryContent += `Removal Option Selected: ${option}\n`;
    summaryContent += `Removed LogDetail duplicates: ${removedLogDetailCount}\n`;
    summaryContent += `Removed WeatherData duplicates: ${removedWeatherDataCount}\n`;
    summaryContent += `Total duplicate records removed: ${removedLogDetailCount + removedWeatherDataCount}\n\n`;
    
    if (option === 1) {
      summaryContent += `Action: Removed LogDetail duplicates only\n`;
    } else if (option === 2) {
      summaryContent += `Action: Removed WeatherData duplicates only\n`;
    } else if (option === 3) {
      summaryContent += `Action: Removed duplicates from both collections\n`;
    }
    
    summaryContent += `\nRemaining records after cleanup:\n`;
    const remainingWeatherCount = await WeatherData.countDocuments();
    const remainingLogDetailCount = await LogDetail.countDocuments();
    summaryContent += `WeatherData records: ${remainingWeatherCount}\n`;
    summaryContent += `LogDetail records: ${remainingLogDetailCount}\n`;
    
    writeReport(summaryContent, summaryFilename);
    
    console.log('');
    console.log('🎉 Duplicate removal completed successfully!');
    console.log(`📊 Summary report saved as: ${summaryFilename}`);
    console.log('');
    console.log('Final database state:');
    console.log(`  WeatherData records: ${remainingWeatherCount}`);
    console.log(`  LogDetail records: ${remainingLogDetailCount}`);
    
  } catch (error) {
    console.error('❌ Error during duplicate removal:', error);
    throw error;
  }
}

// Main function
async function findDuplicatesMain() {
  try {
    await connectDB();
    
    console.log('Starting duplicate analysis...');
    console.log('This will analyze both LogDetail and WeatherData collections for duplicates');
    console.log('');
    
    // Find duplicates in both collections
    const logDetailDuplicates = await findLogDetailDuplicates();
    const weatherDataDuplicates = await findWeatherDataDuplicates();
    
    console.log('');
    console.log('=== DUPLICATE ANALYSIS RESULTS ===');
    console.log(`LogDetail duplicates by Key: ${logDetailDuplicates.byKey.length} groups`);
    console.log(`LogDetail duplicates by SN+Date+FlightTime: ${logDetailDuplicates.bySnDateTime.length} groups`);
    console.log(`WeatherData duplicates by FlightLog: ${weatherDataDuplicates.byFlightLog.length} groups`);
    console.log(`WeatherData duplicates by SN+FlightLog+Location: ${weatherDataDuplicates.bySnLogLocation.length} groups`);
    console.log('');
    
    // Generate detailed report
    const reportFilename = generateDuplicateReport(logDetailDuplicates, weatherDataDuplicates);
    
    // Calculate total duplicate records
    let totalLogDetailDuplicates = 0;
    let totalWeatherDataDuplicates = 0;
    
    logDetailDuplicates.byKey.forEach(group => {
      totalLogDetailDuplicates += group.count - 1;
    });
    
    weatherDataDuplicates.byFlightLog.forEach(group => {
      totalWeatherDataDuplicates += group.count - 1;
    });
    
    if (totalLogDetailDuplicates === 0 && totalWeatherDataDuplicates === 0) {
      console.log('🎉 No duplicates found in either collection!');
      console.log(`📊 Analysis report saved as: ${reportFilename}`);
    } else {
      console.log('DUPLICATE REMOVAL OPTIONS:');
      console.log('1. Remove LogDetail duplicates only');
      console.log('2. Remove WeatherData duplicates only');
      console.log('3. Remove duplicates from both collections');
      console.log('4. Exit without removing anything');
      console.log('');
      console.log(`Potential LogDetail duplicates to remove: ${totalLogDetailDuplicates}`);
      console.log(`Potential WeatherData duplicates to remove: ${totalWeatherDataDuplicates}`);
      console.log('');
      console.log('Please review the generated report before proceeding.');
      console.log(`📊 Analysis report saved as: ${reportFilename}`);
      console.log('');
      
      // Interactive prompt for user choice
      const choice = await askQuestion('Enter your choice (1-4): ');
      const choiceNum = parseInt(choice);
      
      if (choiceNum >= 1 && choiceNum <= 3) {
        console.log('');
        console.log('⚠️  WARNING: This action will permanently delete duplicate records from the database!');
        console.log('The system will keep the LATEST record (by creation date) and remove older duplicates.');
        console.log('');
        
        if (choiceNum === 1 || choiceNum === 3) {
          console.log(`This will remove ${totalLogDetailDuplicates} duplicate LogDetail records.`);
        }
        if (choiceNum === 2 || choiceNum === 3) {
          console.log(`This will remove ${totalWeatherDataDuplicates} duplicate WeatherData records.`);
        }
        
        console.log('');
        const confirm = await askQuestion('Are you sure you want to proceed? (yes/no): ');
        
        if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
          await removeDuplicates(choiceNum, logDetailDuplicates, weatherDataDuplicates);
        } else {
          console.log('Duplicate removal cancelled. No data was deleted.');
        }
      } else if (choiceNum === 4) {
        console.log('Exiting without removing duplicates.');
      } else {
        console.log('Invalid choice. Exiting without removing duplicates.');
      }
    }
    
    rl.close();
    
  } catch (error) {
    console.error('Error during duplicate analysis:', error);
    rl.close();
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
findDuplicatesMain();