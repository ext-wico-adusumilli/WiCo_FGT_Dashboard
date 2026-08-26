import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import XLSX from 'xlsx';
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
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Function to generate timestamp for report filename
function generateTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-');
}

// Function to ensure reports directory exists
function ensureReportsDirectory() {
  const reportsDir = path.join(__dirname, '../../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    console.log('📁 Created reports directory');
  }
  return reportsDir;
}

// Function to write report to file
function writeReport(reportContent, filename) {
  const reportsDir = ensureReportsDirectory();
  const reportPath = path.join(reportsDir, filename);
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log('📄 Report written to: reports/' + filename);
  return reportPath;
}

// Function to parse Excel file
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error('❌ Error parsing Excel file ' + filePath + ':', error);
    return [];
  }
}

// Function to convert Excel serial date to JavaScript Date
function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || serial <= 0) {
    return serial;
  }
  
  const excelEpoch = new Date(1900, 0, 1);
  const days = serial - 1;
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const adjustedDays = serial > 59 ? days - 1 : days;
  const date = new Date(excelEpoch.getTime() + adjustedDays * millisecondsPerDay);
  return date.toISOString();
}

// Function to format Excel serial date to readable string
function formatExcelDate(serial) {
  if (typeof serial !== 'number' || serial <= 0) {
    return serial;
  }
  
  const date = new Date(excelSerialToDate(serial));
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Function to parse weather data string
function parseWeatherString(weatherStr) {
  if (!weatherStr || typeof weatherStr !== 'string') return {};
  
  const weatherData = {};
  const patterns = {
    cloud: /Cloud:\s*(\d+)\s*%/i,
    temperature: /Temp\.?:\s*(-?\d+)/i,
    wind: /Wind:\s*(\d+\.?\d*)/i,
    humidity: /Humidity:\s*(\d+)\s*%/i,
    pressure: /Pressure:\s*(\d+\.?\d*)/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = weatherStr.match(pattern);
    if (match) {
      let value = parseFloat(match[1]);
      
      if (key === 'temperature') {
        if (weatherStr.includes('F')) {
          value = (value - 32) * 5/9;
        }
      }
      
      if (key === 'wind') {
        if (weatherStr.toLowerCase().includes('miles/h')) {
          value = value * 1.60934;
        }
        value = value / 3.6;
        value = Math.round(value * 100) / 100;
      }
      
      weatherData[key] = value;
    }
  }
  
  return weatherData;
}

// Function to extract serial number from drone name or key
function extractSerialNumber(droneName, key) {
  if (droneName && typeof droneName === 'string') {
    const snMatch = droneName.match(/SN(\d+)/i);
    if (snMatch) return snMatch[1];
  }
  
  if (key && typeof key === 'string') {
    const keyMatch = key.match(/^(\d+)\./);
    if (keyMatch) return keyMatch[1];
  }
  
  return null;
}

// ==================== DATA IMPORT FUNCTIONS ====================

// Function to clear existing log detail data
async function clearLogDetailData() {
  console.log('🧹 Clearing existing log detail data...');
  const result = await LogDetail.deleteMany({});
  console.log('✅ Deleted ' + result.deletedCount + ' existing log detail records');
}

// Function to clear existing weather data
async function clearWeatherData() {
  console.log('🧹 Clearing existing weather data...');
  const result = await WeatherData.deleteMany({});
  console.log('✅ Deleted ' + result.deletedCount + ' existing weather records');
}

// Function to import flight data from LogDetail.xlsx
async function importLogDetailData() {
  console.log('📥 Starting LogDetail.xlsx import...');
  
  const logDetailPath = path.join(__dirname, '../../newdata/LogDetail.xlsx');
  if (!fs.existsSync(logDetailPath)) {
    console.log('⚠️  LogDetail.xlsx not found in newdata folder');
    return { success: false, count: 0 };
  }
  
  const logDetailData = parseExcelFile(logDetailPath);
  if (logDetailData.length === 0) {
    console.log('⚠️  No data found in LogDetail.xlsx');
    return { success: false, count: 0 };
  }
  
  console.log('📊 Found ' + logDetailData.length + ' LogDetail records');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const row of logDetailData) {
    try {
      const logDetail = new LogDetail({
        key: row.Key,
        sn: row.SN ? row.SN.toString() : undefined,
        date: row.Date ? row.Date.toString() : undefined,
        total_time: row.Total_time,
        flight_time: row.Flight_time,
        filtered_flight_time: row.filtered_flight_time,
        mc_time: row.MC_time,
        fw_time: row.FW_time,
        fc_version: row.fc_version,
        cs_version: row.cs_version,
        fwd_transitions: row.fwd_transitions,
        bwd_transitions: row.bwd_transitions,
        lte_loss: row.lte_loss,
        rth_loss: row.rth_loss,
        rth_logs: row.rth_logs,
        distance: row.distance,
        fwd_distance: row.fwd_distance,
        bwd_distance: row.bwd_distance,
        max_mc_xy_deviation: row.max_mc_xy_deviation,
        max_mc_altitude_deviation: row.max_mc_altitude_deviation,
        max_fw_xy_deviation: row.max_fw_xy_deviation,
        max_fw_altitude_deviation: row.max_fw_altitude_deviation,
        battery_0_sn: row.battery_0_sn ? row.battery_0_sn.toString() : undefined,
        battery_0_cycle: row.battery_0_cycle,
        battery_0_max_temp: row.battery_0_max_temp,
        battery_0_remaining: row.battery_0_remaining,
        battery_1_sn: row.battery_1_sn ? row.battery_1_sn.toString() : undefined,
        battery_1_cycle: row.battery_1_cycle,
        battery_1_max_temp: row.battery_1_max_temp,
        battery_1_remaining: row.battery_1_remaining,
        calculated_groundspeed: row.calculated_groundspeed,
        last_usage: typeof row.last_usage === 'number' ? formatExcelDate(row.last_usage) : row.last_usage,
        flight: row.Flight
      });
      
      await logDetail.save();
      successCount++;
      
      if (successCount % 1000 === 0) {
        console.log('   📈 Imported ' + successCount + ' LogDetail records...');
      }
    } catch (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error('   ❌ Error importing LogDetail record:', error.message);
      }
    }
  }
  
  console.log('✅ LogDetail import completed: ' + successCount + ' successful, ' + errorCount + ' errors');
  return { success: true, count: successCount, errors: errorCount };
}
// Function to import weather data from WeatherData.xlsx
async function importWeatherData() {
  console.log('📥 Starting WeatherData.xlsx import...');
  
  const weatherDataPath = path.join(__dirname, '../../newdata/WeatherData.xlsx');
  if (!fs.existsSync(weatherDataPath)) {
    console.log('⚠️  WeatherData.xlsx not found in newdata folder');
    return { success: false, count: 0 };
  }
  
  const weatherData = parseExcelFile(weatherDataPath);
  if (weatherData.length === 0) {
    console.log('⚠️  No data found in WeatherData.xlsx');
    return { success: false, count: 0 };
  }
  
  console.log('📊 Found ' + weatherData.length + ' WeatherData records');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const row of weatherData) {
    try {
      const weatherStr = row['Weather Data'] || row.WeatherData || row.weather_data;
      const parsedWeather = parseWeatherString(weatherStr);
      
      const droneName = row['Drone Name'] || row.DroneName || row.drone_name;
      const key = row.Key || row.key || row.KEY;
      const serialNumber = extractSerialNumber(droneName, key);
      
      // Map Operation Type
      const operationTypeRaw = row['Operation Type'] || row.OperationType || row.operation_type || '';
      let operationType = '';
      
      // Normalize operation type
      const opTypeStr = String(operationTypeRaw).trim();
      if (opTypeStr.toLowerCase().includes('automatic')) {
        operationType = 'Automatic';
      } else if (opTypeStr.toLowerCase().includes('bvlos') || opTypeStr.toLowerCase().includes('blos')) {
        operationType = 'BVLOS / BLOS';
      } else if (opTypeStr.toLowerCase().includes('vlos') && opTypeStr.toLowerCase().includes('manual')) {
        operationType = 'VLOS (Manual)';
      } else if (opTypeStr.toLowerCase().includes('vlos') && opTypeStr.toLowerCase().includes('autonomous')) {
        operationType = 'VLOS Autonomous';
      } else if (opTypeStr.toLowerCase().includes('vlos') && opTypeStr.toLowerCase().includes('lts')) {
        operationType = 'VLOS LTS';
      } else if (opTypeStr.toLowerCase().includes('not labelled') || opTypeStr === '') {
        operationType = 'Not Labelled';
      } else {
        operationType = opTypeStr || 'Not Labelled';
      }
      
      if (!serialNumber || !key) {
        errorCount++;
        continue;
      }
      
      const weather = new WeatherData({
        pressure: parsedWeather.pressure,
        humidity: parsedWeather.humidity,
        rain: row.rain || row.Rain,
        temperature: parsedWeather.temperature,
        uaSN: serialNumber,
        flightLog: key,
        location: row['Place Name'] || row.PlaceName || row.place_name,
        amslMaxWind: parsedWeather.wind,
        windRun: parsedWeather.wind,
        maxGust: row.maxGust || row['Max Gust'],
        lowWindChill: row.lowWindChill || row['Low Wind Chill'],
        thwIndex: row.thwIndex || row['THW Index'],
        wetBulb: row.wetBulb || row['Wet Bulb'],
        windChill: row.windChill || row['Wind Chill'],
        cloud: parsedWeather.cloud,
        amsl: row.AMSL || row.amsl,
        operationType: operationType
      });
      
      await weather.save();
      successCount++;
      
      if (successCount % 1000 === 0) {
        console.log('   📈 Imported ' + successCount + ' WeatherData records...');
      }
    } catch (error) {
      errorCount++;
      if (errorCount <= 5) {
        console.error('   ❌ Error importing WeatherData record:', error.message);
      }
    }
  }
  
  console.log('✅ WeatherData import completed: ' + successCount + ' successful, ' + errorCount + ' errors');
  return { success: true, count: successCount, errors: errorCount };
}

// Function to import combined weather station data
async function importWeatherStationData() {
  console.log('📥 Starting WeatherStationData.xlsx import...');
  
  const weatherStationDataPath = path.join(__dirname, '../../newdata/WeatherStationData.xlsx');
  if (!fs.existsSync(weatherStationDataPath)) {
    console.log('⚠️  WeatherStationData.xlsx not found in newdata folder');
    return { success: false, logDetailCount: 0, weatherCount: 0 };
  }
  
  const weatherStationData = parseExcelFile(weatherStationDataPath);
  if (weatherStationData.length === 0) {
    console.log('⚠️  No data found in WeatherStationData.xlsx');
    return { success: false, logDetailCount: 0, weatherCount: 0 };
  }
  
  console.log('📊 Found ' + weatherStationData.length + ' combined records');
  
  let logDetailSuccessCount = 0;
  let weatherSuccessCount = 0;
  let logDetailErrorCount = 0;
  let weatherErrorCount = 0;
  
  for (const row of weatherStationData) {
    // Import LogDetail data
    try {
      const logDetail = new LogDetail({
        key: row.Key,
        sn: row.SN ? row.SN.toString() : undefined,
        date: row.Date ? row.Date.toString() : undefined,
        total_time: row.Total_time,
        flight_time: row.Flight_time,
        filtered_flight_time: row.filtered_flight_time,
        mc_time: row.MC_time,
        fw_time: row.FW_time,
        fc_version: row.fc_version,
        cs_version: row.cs_version,
        fwd_transitions: row.fwd_transitions,
        bwd_transitions: row.bwd_transitions,
        lte_loss: row.lte_loss,
        rth_loss: row.rth_loss,
        rth_logs: row.rth_logs,
        distance: row.distance,
        fwd_distance: row.fwd_distance,
        bwd_distance: row.bwd_distance,
        max_mc_xy_deviation: row.max_mc_xy_deviation,
        max_mc_altitude_deviation: row.max_mc_altitude_deviation,
        max_fw_xy_deviation: row.max_fw_xy_deviation,
        max_fw_altitude_deviation: row.max_fw_altitude_deviation,
        battery_0_sn: row.battery_0_sn ? row.battery_0_sn.toString() : undefined,
        battery_0_cycle: row.battery_0_cycle,
        battery_0_max_temp: row.battery_0_max_temp,
        battery_0_remaining: row.battery_0_remaining,
        battery_1_sn: row.battery_1_sn ? row.battery_1_sn.toString() : undefined,
        battery_1_cycle: row.battery_1_cycle,
        battery_1_max_temp: row.battery_1_max_temp,
        battery_1_remaining: row.battery_1_remaining,
        calculated_groundspeed: row.calculated_groundspeed,
        last_usage: typeof row.last_usage === 'number' ? formatExcelDate(row.last_usage) : row.last_usage,
        flight: row.Flight
      });
      
      await logDetail.save();
      logDetailSuccessCount++;
    } catch (error) {
      logDetailErrorCount++;
    }
    
    // Import WeatherData
    try {
      const serialNumber = row['UA SN'] || row.SN;
      const flightLog = row['Flight log(.ulg)'] || row.Key;
      
      if (!serialNumber || !flightLog) {
        weatherErrorCount++;
        continue;
      }
      
      const parseNumericValue = (value) => {
        if (typeof value === 'string' && value.includes(',')) {
          return parseFloat(value.replace(',', '.'));
        }
        return value;
      };
      
      const weather = new WeatherData({
        pressure: row['Pressure (hPa)'],
        humidity: row['Humidity (%)'],
        rain: parseNumericValue(row['Rain - mm']),
        temperature: parseNumericValue(row['Temperature (celsius)']),
        uaSN: serialNumber.toString(),
        flightLog: flightLog,
        location: row.Location,
        amslMaxWind: row['Maximum Wind during the flight(m/s)'],
        windRun: row['Wind before takeoff (m/s)'],
        maxGust: row['Max Gust during the flight(m/s)'],
        gustBeforeTakeoff: row['Gust before takeoff (m/s)'],
        amsl: row['AMSL (m)'],
        windDirection: row['Wind Direction (Before takeoff)'],
        takeoffTime: row['Takeoff time[Local](DD/MM/YY HH:MM)'],
        landingTime: row['Landing time[Local](DD/MM/YY HH:MM)'],
        dateTime: typeof row['Date & Time'] === 'number' ? formatExcelDate(row['Date & Time']) : row['Date & Time'],
        highTemp: parseNumericValue(row['High Temp - °C'])
      });
      
      await weather.save();
      weatherSuccessCount++;
    } catch (error) {
      weatherErrorCount++;
    }
    
    if ((logDetailSuccessCount + weatherSuccessCount) % 1000 === 0) {
      console.log('   📈 Processed ' + Math.floor((logDetailSuccessCount + weatherSuccessCount) / 2) + ' combined records...');
    }
  }
  
  console.log('✅ WeatherStationData import completed:');
  console.log('   📊 LogDetail: ' + logDetailSuccessCount + ' successful, ' + logDetailErrorCount + ' errors');
  console.log('   📊 WeatherData: ' + weatherSuccessCount + ' successful, ' + weatherErrorCount + ' errors');
  
  return { 
    success: true, 
    logDetailCount: logDetailSuccessCount, 
    weatherCount: weatherSuccessCount,
    logDetailErrors: logDetailErrorCount,
    weatherErrors: weatherErrorCount
  };
}

// ==================== CLEANUP FUNCTIONS ====================

// Function to cleanup unmatched data
async function cleanupUnmatchedData() {
  console.log('🔍 Starting unmatched data analysis...');
  
  const logDetailKeys = await LogDetail.distinct('key');
  const logDetailKeySet = new Set(logDetailKeys.filter(key => key));
  console.log('📊 Found ' + logDetailKeySet.size + ' unique LogDetail keys');
  
  const weatherFlightLogs = await WeatherData.distinct('flightLog');
  const weatherFlightLogSet = new Set(weatherFlightLogs.filter(log => log));
  console.log('📊 Found ' + weatherFlightLogSet.size + ' unique WeatherData flightLog values');
  
  const unmatchedWeatherLogs = [...weatherFlightLogSet].filter(log => !logDetailKeySet.has(log));
  const unmatchedLogDetailKeys = [...logDetailKeySet].filter(key => !weatherFlightLogSet.has(key));
  
  const unmatchedWeatherCount = await WeatherData.countDocuments({ 
    flightLog: { $in: unmatchedWeatherLogs } 
  });
  const unmatchedLogDetailCount = await LogDetail.countDocuments({ 
    key: { $in: unmatchedLogDetailKeys } 
  });
  
  console.log('');
  console.log('📋 UNMATCHED DATA ANALYSIS:');
  console.log('   🔸 Unmatched WeatherData records: ' + unmatchedWeatherCount);
  console.log('   🔸 Unmatched LogDetail records: ' + unmatchedLogDetailCount);
  
  if (unmatchedWeatherCount === 0 && unmatchedLogDetailCount === 0) {
    console.log('🎉 No unmatched data found!');
    return { hasUnmatched: false };
  }
  
  // Generate cleanup report
  const timestamp = generateTimestamp();
  const reportFilename = 'cleanup_report_' + timestamp + '.txt';
  
  let reportContent = 'UNMATCHED DATA CLEANUP REPORT\n';
  reportContent += 'Generated: ' + new Date().toISOString() + '\n';
  reportContent += '='.repeat(80) + '\n\n';
  reportContent += 'SUMMARY:\n';
  reportContent += 'Unmatched WeatherData records: ' + unmatchedWeatherCount + '\n';
  reportContent += 'Unmatched LogDetail records: ' + unmatchedLogDetailCount + '\n\n';
  
  if (unmatchedWeatherCount > 0) {
    const unmatchedWeatherRecords = await WeatherData.find({ 
      flightLog: { $in: unmatchedWeatherLogs } 
    }).lean();
    
    reportContent += 'UNMATCHED WEATHERDATA RECORDS:\n';
    reportContent += '-'.repeat(50) + '\n';
    unmatchedWeatherRecords.forEach((record, index) => {
      reportContent += (index + 1) + '. ID: ' + record._id + '\n';
      reportContent += '   Flight Log: ' + record.flightLog + '\n';
      reportContent += '   UA SN: ' + record.uaSN + '\n';
      reportContent += '   Location: ' + (record.location || 'N/A') + '\n\n';
    });
  }
  
  if (unmatchedLogDetailCount > 0) {
    const unmatchedLogDetailRecords = await LogDetail.find({ 
      key: { $in: unmatchedLogDetailKeys } 
    }).lean();
    
    reportContent += 'UNMATCHED LOGDETAIL RECORDS:\n';
    reportContent += '-'.repeat(50) + '\n';
    unmatchedLogDetailRecords.forEach((record, index) => {
      reportContent += (index + 1) + '. ID: ' + record._id + '\n';
      reportContent += '   Key: ' + record.key + '\n';
      reportContent += '   SN: ' + record.sn + '\n';
      reportContent += '   Date: ' + record.date + '\n\n';
    });
  }
  
  writeReport(reportContent, reportFilename);
  
  return {
    hasUnmatched: true,
    unmatchedWeatherCount,
    unmatchedLogDetailCount,
    unmatchedWeatherLogs,
    unmatchedLogDetailKeys,
    reportFilename
  };
}

// Function to perform cleanup
async function performCleanup(option, unmatchedWeatherLogs, unmatchedLogDetailKeys) {
  let deletedWeatherCount = 0;
  let deletedLogDetailCount = 0;
  
  if (option === 1 || option === 3) {
    const weatherDeleteResult = await WeatherData.deleteMany({
      flightLog: { $in: unmatchedWeatherLogs }
    });
    deletedWeatherCount = weatherDeleteResult.deletedCount;
    console.log('✅ Deleted ' + deletedWeatherCount + ' unmatched WeatherData records');
  }
  
  if (option === 2 || option === 3) {
    const logDetailDeleteResult = await LogDetail.deleteMany({
      key: { $in: unmatchedLogDetailKeys }
    });
    deletedLogDetailCount = logDetailDeleteResult.deletedCount;
    console.log('✅ Deleted ' + deletedLogDetailCount + ' unmatched LogDetail records');
  }
  
  const timestamp = generateTimestamp();
  const summaryFilename = 'cleanup_summary_' + timestamp + '.txt';
  
  let summaryContent = 'CLEANUP SUMMARY\n';
  summaryContent += 'Generated: ' + new Date().toISOString() + '\n';
  summaryContent += '='.repeat(50) + '\n\n';
  summaryContent += 'Deleted WeatherData records: ' + deletedWeatherCount + '\n';
  summaryContent += 'Deleted LogDetail records: ' + deletedLogDetailCount + '\n';
  summaryContent += 'Total records deleted: ' + (deletedWeatherCount + deletedLogDetailCount) + '\n';
  
  writeReport(summaryContent, summaryFilename);
  
  return { deletedWeatherCount, deletedLogDetailCount, summaryFilename };
}

// ==================== DUPLICATE FUNCTIONS ====================

// Function to find duplicates
async function findDuplicates() {
  console.log('🔍 Starting duplicate analysis...');
  
  const logDetailDuplicates = await LogDetail.aggregate([
    {
      $group: {
        _id: '$key',
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    { $sort: { count: -1 } }
  ]);
  
  const weatherDataDuplicates = await WeatherData.aggregate([
    {
      $group: {
        _id: '$flightLog',
        count: { $sum: 1 },
        records: { $push: '$$ROOT' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    { $sort: { count: -1 } }
  ]);
  
  let totalLogDetailDuplicates = 0;
  let totalWeatherDataDuplicates = 0;
  
  logDetailDuplicates.forEach(group => {
    totalLogDetailDuplicates += group.count - 1;
  });
  
  weatherDataDuplicates.forEach(group => {
    totalWeatherDataDuplicates += group.count - 1;
  });
  
  console.log('');
  console.log('📋 DUPLICATE ANALYSIS:');
  console.log('   🔸 LogDetail duplicate groups: ' + logDetailDuplicates.length);
  console.log('   🔸 WeatherData duplicate groups: ' + weatherDataDuplicates.length);
  console.log('   🔸 Total LogDetail duplicates to remove: ' + totalLogDetailDuplicates);
  console.log('   🔸 Total WeatherData duplicates to remove: ' + totalWeatherDataDuplicates);
  
  if (totalLogDetailDuplicates === 0 && totalWeatherDataDuplicates === 0) {
    console.log('🎉 No duplicates found!');
    return { hasDuplicates: false };
  }
  
  // Generate duplicate report
  const timestamp = generateTimestamp();
  const reportFilename = 'duplicate_analysis_' + timestamp + '.txt';
  
  let reportContent = 'DUPLICATE ANALYSIS REPORT\n';
  reportContent += 'Generated: ' + new Date().toISOString() + '\n';
  reportContent += '='.repeat(80) + '\n\n';
  reportContent += 'SUMMARY:\n';
  reportContent += 'LogDetail duplicate groups: ' + logDetailDuplicates.length + '\n';
  reportContent += 'WeatherData duplicate groups: ' + weatherDataDuplicates.length + '\n';
  reportContent += 'Total LogDetail duplicates to remove: ' + totalLogDetailDuplicates + '\n';
  reportContent += 'Total WeatherData duplicates to remove: ' + totalWeatherDataDuplicates + '\n\n';
  
  // Add detailed duplicate information
  if (logDetailDuplicates.length > 0) {
    reportContent += 'LOGDETAIL DUPLICATES:\n';
    reportContent += '-'.repeat(50) + '\n';
    logDetailDuplicates.forEach((group, index) => {
      reportContent += 'Group ' + (index + 1) + ': Key "' + group._id + '" (' + group.count + ' duplicates)\n';
      const sortedRecords = group.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sortedRecords.forEach((record, recordIndex) => {
        const status = recordIndex === 0 ? ' [WILL BE KEPT - LATEST]' : ' [WILL BE REMOVED - OLDER]';
        reportContent += '  Record ' + (recordIndex + 1) + ':' + status + '\n';
        reportContent += '    ID: ' + record._id + '\n';
        reportContent += '    Created: ' + record.createdAt + '\n\n';
      });
    });
  }
  
  if (weatherDataDuplicates.length > 0) {
    reportContent += 'WEATHERDATA DUPLICATES:\n';
    reportContent += '-'.repeat(50) + '\n';
    weatherDataDuplicates.forEach((group, index) => {
      reportContent += 'Group ' + (index + 1) + ': FlightLog "' + group._id + '" (' + group.count + ' duplicates)\n';
      const sortedRecords = group.records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sortedRecords.forEach((record, recordIndex) => {
        const status = recordIndex === 0 ? ' [WILL BE KEPT - LATEST]' : ' [WILL BE REMOVED - OLDER]';
        reportContent += '  Record ' + (recordIndex + 1) + ':' + status + '\n';
        reportContent += '    ID: ' + record._id + '\n';
        reportContent += '    Created: ' + record.createdAt + '\n\n';
      });
    });
  }
  
  writeReport(reportContent, reportFilename);
  
  return {
    hasDuplicates: true,
    logDetailDuplicates,
    weatherDataDuplicates,
    totalLogDetailDuplicates,
    totalWeatherDataDuplicates,
    reportFilename
  };
}

// Function to remove duplicates
async function removeDuplicates(option, logDetailDuplicates, weatherDataDuplicates) {
  let removedLogDetailCount = 0;
  let removedWeatherDataCount = 0;
  
  if (option === 1 || option === 3) {
    console.log('🧹 Removing LogDetail duplicates...');
    for (const group of logDetailDuplicates) {
      if (group.count > 1) {
        const recordsToRemove = group.records
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(1);
        
        const idsToRemove = recordsToRemove.map(record => record._id);
        const deleteResult = await LogDetail.deleteMany({ _id: { $in: idsToRemove } });
        removedLogDetailCount += deleteResult.deletedCount;
      }
    }
    console.log('✅ Removed ' + removedLogDetailCount + ' duplicate LogDetail records');
  }
  
  if (option === 2 || option === 3) {
    console.log('🧹 Removing WeatherData duplicates...');
    for (const group of weatherDataDuplicates) {
      if (group.count > 1) {
        const recordsToRemove = group.records
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(1);
        
        const idsToRemove = recordsToRemove.map(record => record._id);
        const deleteResult = await WeatherData.deleteMany({ _id: { $in: idsToRemove } });
        removedWeatherDataCount += deleteResult.deletedCount;
      }
    }
    console.log('✅ Removed ' + removedWeatherDataCount + ' duplicate WeatherData records');
  }
  
  const timestamp = generateTimestamp();
  const summaryFilename = 'duplicate_removal_summary_' + timestamp + '.txt';
  
  let summaryContent = 'DUPLICATE REMOVAL SUMMARY\n';
  summaryContent += 'Generated: ' + new Date().toISOString() + '\n';
  summaryContent += '='.repeat(50) + '\n\n';
  summaryContent += 'Removed LogDetail duplicates: ' + removedLogDetailCount + '\n';
  summaryContent += 'Removed WeatherData duplicates: ' + removedWeatherDataCount + '\n';
  summaryContent += 'Total duplicates removed: ' + (removedLogDetailCount + removedWeatherDataCount) + '\n';
  
  writeReport(summaryContent, summaryFilename);
  
  return { removedLogDetailCount, removedWeatherDataCount, summaryFilename };
}

// ==================== MAIN MENU FUNCTIONS ====================

async function showMainMenu() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WINGCOPTER DATA MANAGEMENT SYSTEM');
  console.log('='.repeat(60));
  console.log('1. 📥 Import Data');
  console.log('2. 🧹 Cleanup Unmatched Data');
  console.log('3. 🔍 Find and Remove Duplicates');
  console.log('4. 📊 Database Status');
  console.log('5. 🚪 Exit');
  console.log('='.repeat(60));
  
  const choice = await askQuestion('Enter your choice (1-5): ');
  return parseInt(choice);
}

async function showImportMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('📥 DATA IMPORT OPTIONS');
  console.log('='.repeat(50));
  console.log('1. Import LogDetail.xlsx only');
  console.log('2. Import WeatherData.xlsx only');
  console.log('3. Import WeatherStationData.xlsx only');
  console.log('4. Import LogDetail.xlsx + WeatherData.xlsx');
  console.log('5. Import LogDetail.xlsx + WeatherStationData.xlsx');
  console.log('6. Import WeatherData.xlsx + WeatherStationData.xlsx');
  console.log('7. Import all three files');
  console.log('8. Back to main menu');
  console.log('='.repeat(50));
  
  const choice = await askQuestion('Enter your choice (1-8): ');
  return parseInt(choice);
}

async function handleImport() {
  const importChoice = await showImportMenu();
  
  if (importChoice === 8) return;
  
  console.log('\n⚠️  WARNING: This will clear existing data before importing!');
  const confirm = await askQuestion('Do you want to proceed? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Import cancelled');
    return;
  }
  
  const timestamp = generateTimestamp();
  let importSummary = 'DATA IMPORT SUMMARY\n';
  importSummary += 'Generated: ' + new Date().toISOString() + '\n';
  importSummary += '='.repeat(50) + '\n\n';
  
  let totalLogDetailRecords = 0;
  let totalWeatherRecords = 0;
  let totalErrors = 0;
  
  // Clear data based on what we're importing
  if ([1, 4, 5, 7].includes(importChoice)) {
    await clearLogDetailData();
  }
  if ([2, 4, 6, 7].includes(importChoice)) {
    await clearWeatherData();
  }
  if ([3, 5, 6, 7].includes(importChoice)) {
    await clearLogDetailData();
    await clearWeatherData();
  }
  
  console.log('');
  
  // Import based on choice
  switch (importChoice) {
    case 1:
      const logResult1 = await importLogDetailData();
      totalLogDetailRecords += logResult1.count;
      totalErrors += logResult1.errors || 0;
      importSummary += 'LogDetail.xlsx: ' + logResult1.count + ' records imported\n';
      break;
      
    case 2:
      const weatherResult2 = await importWeatherData();
      totalWeatherRecords += weatherResult2.count;
      totalErrors += weatherResult2.errors || 0;
      importSummary += 'WeatherData.xlsx: ' + weatherResult2.count + ' records imported\n';
      break;
      
    case 3:
      const stationResult3 = await importWeatherStationData();
      totalLogDetailRecords += stationResult3.logDetailCount;
      totalWeatherRecords += stationResult3.weatherCount;
      totalErrors += (stationResult3.logDetailErrors || 0) + (stationResult3.weatherErrors || 0);
      importSummary += 'WeatherStationData.xlsx: ' + stationResult3.logDetailCount + ' LogDetail + ' + stationResult3.weatherCount + ' WeatherData records imported\n';
      break;
      
    case 4:
      const logResult4 = await importLogDetailData();
      const weatherResult4 = await importWeatherData();
      totalLogDetailRecords += logResult4.count;
      totalWeatherRecords += weatherResult4.count;
      totalErrors += (logResult4.errors || 0) + (weatherResult4.errors || 0);
      importSummary += 'LogDetail.xlsx: ' + logResult4.count + ' records imported\n';
      importSummary += 'WeatherData.xlsx: ' + weatherResult4.count + ' records imported\n';
      break;
      
    case 5:
      const logResult5 = await importLogDetailData();
      const stationResult5 = await importWeatherStationData();
      totalLogDetailRecords += logResult5.count + stationResult5.logDetailCount;
      totalWeatherRecords += stationResult5.weatherCount;
      totalErrors += (logResult5.errors || 0) + (stationResult5.logDetailErrors || 0) + (stationResult5.weatherErrors || 0);
      importSummary += 'LogDetail.xlsx: ' + logResult5.count + ' records imported\n';
      importSummary += 'WeatherStationData.xlsx: ' + stationResult5.logDetailCount + ' LogDetail + ' + stationResult5.weatherCount + ' WeatherData records imported\n';
      break;
      
    case 6:
      const weatherResult6 = await importWeatherData();
      const stationResult6 = await importWeatherStationData();
      totalLogDetailRecords += stationResult6.logDetailCount;
      totalWeatherRecords += weatherResult6.count + stationResult6.weatherCount;
      totalErrors += (weatherResult6.errors || 0) + (stationResult6.logDetailErrors || 0) + (stationResult6.weatherErrors || 0);
      importSummary += 'WeatherData.xlsx: ' + weatherResult6.count + ' records imported\n';
      importSummary += 'WeatherStationData.xlsx: ' + stationResult6.logDetailCount + ' LogDetail + ' + stationResult6.weatherCount + ' WeatherData records imported\n';
      break;
      
    case 7:
      const logResult7 = await importLogDetailData();
      const weatherResult7 = await importWeatherData();
      const stationResult7 = await importWeatherStationData();
      totalLogDetailRecords += logResult7.count + stationResult7.logDetailCount;
      totalWeatherRecords += weatherResult7.count + stationResult7.weatherCount;
      totalErrors += (logResult7.errors || 0) + (weatherResult7.errors || 0) + (stationResult7.logDetailErrors || 0) + (stationResult7.weatherErrors || 0);
      importSummary += 'LogDetail.xlsx: ' + logResult7.count + ' records imported\n';
      importSummary += 'WeatherData.xlsx: ' + weatherResult7.count + ' records imported\n';
      importSummary += 'WeatherStationData.xlsx: ' + stationResult7.logDetailCount + ' LogDetail + ' + stationResult7.weatherCount + ' WeatherData records imported\n';
      break;
  }
  
  importSummary += '\nTOTAL SUMMARY:\n';
  importSummary += 'Total LogDetail records: ' + totalLogDetailRecords + '\n';
  importSummary += 'Total WeatherData records: ' + totalWeatherRecords + '\n';
  importSummary += 'Total errors: ' + totalErrors + '\n';
  
  const summaryFilename = 'import_summary_' + timestamp + '.txt';
  writeReport(importSummary, summaryFilename);
  
  console.log('\n🎉 Import completed successfully!');
  console.log('📊 Summary saved as: reports/' + summaryFilename);
}

async function handleCleanup() {
  const cleanupResult = await cleanupUnmatchedData();
  
  if (!cleanupResult.hasUnmatched) {
    return;
  }
  
  console.log('📄 Detailed report saved as: reports/' + cleanupResult.reportFilename);
  console.log('');
  console.log('🧹 CLEANUP OPTIONS:');
  console.log('1. Remove unmatched WeatherData records only');
  console.log('2. Remove unmatched LogDetail records only');
  console.log('3. Remove both unmatched WeatherData and LogDetail records');
  console.log('4. Skip cleanup');
  
  const choice = await askQuestion('Enter your choice (1-4): ');
  const choiceNum = parseInt(choice);
  
  if (choiceNum >= 1 && choiceNum <= 3) {
    console.log('\n⚠️  WARNING: This will permanently delete unmatched records!');
    const confirm = await askQuestion('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      const result = await performCleanup(choiceNum, cleanupResult.unmatchedWeatherLogs, cleanupResult.unmatchedLogDetailKeys);
      console.log('📊 Cleanup summary saved as: reports/' + result.summaryFilename);
    } else {
      console.log('❌ Cleanup cancelled');
    }
  }
}

async function handleDuplicates() {
  const duplicateResult = await findDuplicates();
  
  if (!duplicateResult.hasDuplicates) {
    return;
  }
  
  console.log('📄 Detailed report saved as: reports/' + duplicateResult.reportFilename);
  console.log('');
  console.log('🧹 DUPLICATE REMOVAL OPTIONS:');
  console.log('1. Remove LogDetail duplicates only');
  console.log('2. Remove WeatherData duplicates only');
  console.log('3. Remove duplicates from both collections');
  console.log('4. Skip duplicate removal');
  
  const choice = await askQuestion('Enter your choice (1-4): ');
  const choiceNum = parseInt(choice);
  
  if (choiceNum >= 1 && choiceNum <= 3) {
    console.log('\n⚠️  WARNING: This will permanently delete duplicate records!');
    console.log('The system will keep the LATEST record (by creation date) and remove older duplicates.');
    const confirm = await askQuestion('Are you sure? (yes/no): ');
    
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      const result = await removeDuplicates(choiceNum, duplicateResult.logDetailDuplicates, duplicateResult.weatherDataDuplicates);
      console.log('📊 Duplicate removal summary saved as: reports/' + result.summaryFilename);
    } else {
      console.log('❌ Duplicate removal cancelled');
    }
  }
}

async function showDatabaseStatus() {
  console.log('\n📊 DATABASE STATUS');
  console.log('='.repeat(40));
  
  const logDetailCount = await LogDetail.countDocuments();
  const weatherDataCount = await WeatherData.countDocuments();
  
  console.log('LogDetail records: ' + logDetailCount);
  console.log('WeatherData records: ' + weatherDataCount);
  
  if (logDetailCount === weatherDataCount && logDetailCount > 0) {
    console.log('✅ Perfect 1:1 match between collections');
  } else if (logDetailCount === 0 && weatherDataCount === 0) {
    console.log('⚠️  Database is empty');
  } else {
    console.log('⚠️  Collections have different record counts');
  }
  
  console.log('='.repeat(40));
}

// ==================== MAIN FUNCTION ====================

async function main() {
  try {
    await connectDB();
    ensureReportsDirectory();
    
    console.log('🎉 Welcome to Wingcopter Data Management System!');
    console.log('📁 All reports will be saved in the "reports" folder');
    
    while (true) {
      const choice = await showMainMenu();
      
      switch (choice) {
        case 1:
          await handleImport();
          break;
        case 2:
          await handleCleanup();
          break;
        case 3:
          await handleDuplicates();
          break;
        case 4:
          await showDatabaseStatus();
          break;
        case 5:
          console.log('👋 Goodbye!');
          rl.close();
          return;
        default:
          console.log('❌ Invalid choice. Please try again.');
      }
      
      console.log('\nPress Enter to continue...');
      await askQuestion('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    rl.close();
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
main();