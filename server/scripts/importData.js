import XLSX from 'xlsx';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import LogDetail from '../models/LogDetail.js';
import WeatherData from '../models/WeatherData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

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

// Function to parse Excel file
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error(`Error parsing Excel file ${filePath}:`, error);
    return [];
  }
}

// Function to convert Excel serial date to JavaScript Date
function excelSerialToDate(serial) {
  if (typeof serial !== 'number' || serial <= 0) {
    return serial; // Return as-is if not a valid serial number
  }
  
  // Excel's epoch starts on January 1, 1900
  // But Excel incorrectly treats 1900 as a leap year, so we need to adjust
  const excelEpoch = new Date(1900, 0, 1);
  const days = serial - 1; // Excel serial dates start from 1, not 0
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Adjust for Excel's leap year bug (1900 was not a leap year)
  const adjustedDays = serial > 59 ? days - 1 : days;
  
  const date = new Date(excelEpoch.getTime() + adjustedDays * millisecondsPerDay);
  return date.toISOString();
}

// Function to format Excel serial date to readable string
function formatExcelDate(serial) {
  if (typeof serial !== 'number' || serial <= 0) {
    return serial; // Return as-is if not a valid serial number
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

// Function to parse weather data string (based on DLB Analysis Report.ipynb)
function parseWeatherString(weatherStr) {
  if (!weatherStr || typeof weatherStr !== 'string') return {};
  
  const weatherData = {};
  
  // Define regex patterns based on the notebook analysis
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
      
      // Apply conversions based on the notebook logic
      if (key === 'temperature') {
        // Convert Fahrenheit to Celsius if 'F' is mentioned
        if (weatherStr.includes('F')) {
          value = (value - 32) * 5/9;
        }
      }
      
      if (key === 'wind') {
        // Convert miles/h to km/h if 'miles/h' is mentioned
        if (weatherStr.toLowerCase().includes('miles/h')) {
          value = value * 1.60934;
        }
        // Convert km/h to m/s (divide by 3.6)
        value = value / 3.6;
        value = Math.round(value * 100) / 100; // Round to 2 decimal places
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

// Function to clear existing log detail data
async function clearLogDetailData() {
  console.log('Clearing existing log detail data...');
  const result = await LogDetail.deleteMany({});
  console.log(`Deleted ${result.deletedCount} existing log detail records`);
}

// Function to import flight data from LogDetail.xlsx
async function importFlightData() {
  console.log('Starting flight data import from LogDetail.xlsx...');
  
  const flightDataPath = path.join(__dirname, '../../newdata/LogDetail.xlsx');
  const flightData = parseExcelFile(flightDataPath);
  
  if (flightData.length === 0) {
    console.log('No flight data found or error parsing file');
    return;
  }
  
  console.log(`Found ${flightData.length} flight records`);
  console.log('Excel columns:', Object.keys(flightData[0]));
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const row of flightData) {
    try {
      // Create LogDetail record using EXACT Excel column names
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
        console.log(`Imported ${successCount} flight records...`);
      }
    } catch (error) {
      console.error(`Error importing flight record:`, error.message);
      if (errorCount < 5) {
        console.error('Row data:', row);
      }
      errorCount++;
    }
  }
  
  console.log(`Flight data import completed: ${successCount} successful, ${errorCount} errors`);
}

// Function to clear existing weather data
async function clearWeatherData() {
  console.log('Clearing existing weather data...');
  const result = await WeatherData.deleteMany({});
  console.log(`Deleted ${result.deletedCount} existing weather records`);
}

// Function to import weather data from WeatherData.xlsx
async function importWeatherData() {
  console.log('Starting weather data import from WeatherData.xlsx...');
  
  const weatherDataPath = path.join(__dirname, '../../newdata/WeatherData.xlsx');
  const weatherData = parseExcelFile(weatherDataPath);
  
  if (weatherData.length === 0) {
    console.log('No weather data found or error parsing file');
    return;
  }
  
  console.log(`Found ${weatherData.length} weather records`);
  console.log('Excel columns:', Object.keys(weatherData[0]));
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const row of weatherData) {
    try {
      // Extract weather data from the "Weather Data" column
      const weatherStr = row['Weather Data'] || row.WeatherData || row.weather_data;
      const parsedWeather = parseWeatherString(weatherStr);
      
      // Extract serial number from drone name or key
      const droneName = row['Drone Name'] || row.DroneName || row.drone_name;
      const key = row.Key || row.key || row.KEY;
      const serialNumber = extractSerialNumber(droneName, key);
      
      if (!serialNumber || !key) {
        if (errorCount < 5) {
          console.log(`Skipping weather record - missing serial number or key:`, { droneName, key, serialNumber });
        }
        errorCount++;
        continue;
      }
      
      // Create weather record
      const weather = new WeatherData({
        pressure: parsedWeather.pressure,
        humidity: parsedWeather.humidity,
        rain: row.rain || row.Rain,
        temperature: parsedWeather.temperature,
        uaSN: serialNumber,
        flightLog: key,
        location: row['Place Name'] || row.PlaceName || row.place_name,
        amslMaxWind: parsedWeather.wind, // Store in amslMaxWind for AMSL column
        windRun: parsedWeather.wind, // Store wind data in windRun field for "Maximum Wind during the flight(m/s)" column
        maxGust: row.maxGust || row['Max Gust'],
        lowWindChill: row.lowWindChill || row['Low Wind Chill'],
        thwIndex: row.thwIndex || row['THW Index'],
        wetBulb: row.wetBulb || row['Wet Bulb'],
        windChill: row.windChill || row['Wind Chill'],
        cloud: parsedWeather.cloud,
        amsl: row.AMSL || row.amsl // Import AMSL value from Excel
      });
      
      await weather.save();
      successCount++;
      
      if (successCount % 1000 === 0) {
        console.log(`Imported ${successCount} weather records...`);
      }
    } catch (error) {
      console.error(`Error importing weather record:`, error.message);
      if (errorCount < 5) {
        console.error('Row data:', row);
      }
      errorCount++;
    }
  }
  
  console.log(`Weather data import completed: ${successCount} successful, ${errorCount} errors`);
}

// Function to import combined weather station data from WeatherStationData.xlsx
async function importWeatherStationData() {
  console.log('Starting combined data import from WeatherStationData.xlsx...');
  
  const weatherStationDataPath = path.join(__dirname, '../../newdata/WeatherStationData.xlsx');
  const weatherStationData = parseExcelFile(weatherStationDataPath);
  
  if (weatherStationData.length === 0) {
    console.log('No weather station data found or error parsing file');
    return;
  }
  
  console.log(`Found ${weatherStationData.length} combined records`);
  console.log('Excel columns:', Object.keys(weatherStationData[0]));
  
  let logDetailSuccessCount = 0;
  let weatherSuccessCount = 0;
  let logDetailErrorCount = 0;
  let weatherErrorCount = 0;
  
  for (const row of weatherStationData) {
    try {
      // Import LogDetail data (first part of the row)
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
      console.error(`Error importing log detail record:`, error.message);
      if (logDetailErrorCount < 5) {
        console.error('Row data (LogDetail part):', {
          key: row.Key,
          sn: row.SN,
          date: row.Date
        });
      }
      logDetailErrorCount++;
    }
    
    try {
      // Import WeatherData (second part of the row)
      const serialNumber = row['UA SN'] || row.SN;
      const flightLog = row['Flight log(.ulg)'] || row.Key;
      
      if (!serialNumber || !flightLog) {
        if (weatherErrorCount < 5) {
          console.log(`Skipping weather record - missing serial number or flight log:`, { 
            serialNumber, 
            flightLog,
            key: row.Key 
          });
        }
        weatherErrorCount++;
        continue;
      }
      
      // Handle comma decimal separators in numeric fields
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
        lowWindChill: undefined, // Not available in this dataset
        thwIndex: undefined, // Not available in this dataset
        wetBulb: undefined, // Not available in this dataset
        windChill: undefined, // Not available in this dataset
        cloud: undefined, // Not available in this dataset
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
      console.error(`Error importing weather record:`, error.message);
      if (weatherErrorCount < 5) {
        console.error('Row data (Weather part):', {
          uaSN: row['UA SN'],
          flightLog: row['Flight log(.ulg)'],
          location: row.Location
        });
      }
      weatherErrorCount++;
    }
    
    if ((logDetailSuccessCount + weatherSuccessCount) % 1000 === 0) {
      console.log(`Processed ${Math.floor((logDetailSuccessCount + weatherSuccessCount) / 2)} records...`);
    }
  }
  
  console.log(`Weather Station data import completed:`);
  console.log(`  LogDetail: ${logDetailSuccessCount} successful, ${logDetailErrorCount} errors`);
  console.log(`  WeatherData: ${weatherSuccessCount} successful, ${weatherErrorCount} errors`);
}

// Main function
async function main() {
  try {
    await connectDB();
    
    console.log('Starting data import from LogDetail.xlsx, WeatherData.xlsx, and WeatherStationData.xlsx...');
    console.log('This will:');
    console.log('1. Clear existing log detail data');
    console.log('2. Import flight data from LogDetail.xlsx');
    console.log('3. Clear existing weather data');
    console.log('4. Import weather data from WeatherData.xlsx');
    console.log('5. Import additional combined data from WeatherStationData.xlsx');
    console.log('');
    
    // Clear and import flight data from LogDetail.xlsx
    await clearLogDetailData();
    console.log('');
    await importFlightData();
    console.log('');
    
    // Clear existing weather data before importing
    await clearWeatherData();
    console.log('');
    
    // Import weather data from WeatherData.xlsx
    await importWeatherData();
    console.log('');
    
    // Import additional combined weather station data
    await importWeatherStationData();
    
    console.log('');
    console.log('All data import completed successfully!');
    
  } catch (error) {
    console.error('Error during import process:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
main();