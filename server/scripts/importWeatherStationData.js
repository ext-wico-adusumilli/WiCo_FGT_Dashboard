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

// Function to convert comma decimal to dot decimal (e.g., "0,6" -> 0.6)
function parseDecimalValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Replace comma with dot for decimal conversion
    const normalizedValue = value.replace(',', '.');
    const parsed = parseFloat(normalizedValue);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

// Function to format Excel serial date to readable string
function formatExcelDate(serial) {
  if (typeof serial !== 'number' || serial <= 0) {
    return serial; // Return as-is if not a valid serial number
  }
  
  // Excel's epoch starts on January 1, 1900
  const excelEpoch = new Date(1900, 0, 1);
  const days = serial - 1;
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  
  // Adjust for Excel's leap year bug
  const adjustedDays = serial > 59 ? days - 1 : days;
  
  const date = new Date(excelEpoch.getTime() + adjustedDays * millisecondsPerDay);
  return date.toISOString();
}

// Function to update existing flight logs with weather data
async function updateFlightLogsWithWeatherData() {
  console.log('Starting weather station data import from weather_station_merged.xlsx...');
  
  const weatherStationPath = path.join(__dirname, '../../newdata/weather_station_merged.xlsx');
  const weatherStationData = parseExcelFile(weatherStationPath);
  
  if (weatherStationData.length === 0) {
    console.log('No weather station data found or error parsing file');
    return;
  }
  
  console.log(`Found ${weatherStationData.length} weather station records`);
  console.log('Available columns:', Object.keys(weatherStationData[0]));
  
  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;
  
  for (const row of weatherStationData) {
    try {
      const key = row.Key;
      const flightLog = row['Flight log(.ulg)'];
      
      if (!key && !flightLog) {
        console.log('Skipping row - no Key or Flight log found');
        errorCount++;
        continue;
      }
      
      // Parse rain and gust values with comma-to-dot conversion
      const rainValue = parseDecimalValue(row['Rain - mm']);
      const gustValue = parseDecimalValue(row['Gust before takeoff (m/s)']);
      
      console.log(`Processing Key: ${key}, Rain: ${row['Rain - mm']} -> ${rainValue}, Gust: ${row['Gust before takeoff (m/s)']} -> ${gustValue}`);
      
      // Find the corresponding flight log in the database
      const query = key ? { key: key } : { flight: flightLog };
      const existingLog = await LogDetail.findOne(query);
      
      if (!existingLog) {
        if (notFoundCount < 5) {
          console.log(`Flight log not found for key: ${key} or flight: ${flightLog}`);
        }
        notFoundCount++;
        continue;
      }
      
      // Check if weather data already exists for this flight log
      let weatherData = await WeatherData.findOne({ flightLog: existingLog.key });
      
      if (weatherData) {
        // Update existing weather data
        weatherData.rain = rainValue !== null ? rainValue.toString() : null;
        weatherData.maxGust = gustValue;
        
        // Update other weather fields if available
        if (row['Temperature (celsius)'] !== undefined) {
          weatherData.temperature = parseDecimalValue(row['Temperature (celsius)']);
        }
        if (row['Humidity (%)'] !== undefined) {
          weatherData.humidity = parseDecimalValue(row['Humidity (%)']);
        }
        if (row['Pressure (hPa)'] !== undefined) {
          weatherData.pressure = parseDecimalValue(row['Pressure (hPa)']);
        }
        if (row['Wind before takeoff (m/s)'] !== undefined) {
          weatherData.windRun = parseDecimalValue(row['Wind before takeoff (m/s)']);
        }
        if (row['Maximum Wind during the flight(m/s)'] !== undefined) {
          weatherData.amslMaxWind = parseDecimalValue(row['Maximum Wind during the flight(m/s)']);
        }
        if (row['AMSL (m)'] !== undefined) {
          weatherData.amsl = parseDecimalValue(row['AMSL (m)']);
        }
        if (row['Location'] !== undefined) {
          weatherData.location = row['Location'];
        }
        
        await weatherData.save();
      } else {
        // Create new weather data record
        weatherData = new WeatherData({
          pressure: parseDecimalValue(row['Pressure (hPa)']),
          humidity: parseDecimalValue(row['Humidity (%)']),
          rain: rainValue !== null ? rainValue.toString() : null,
          temperature: parseDecimalValue(row['Temperature (celsius)']),
          uaSN: row['UA SN'] ? row['UA SN'].toString() : existingLog.sn,
          flightLog: existingLog.key,
          location: row['Location'],
          amslMaxWind: parseDecimalValue(row['Maximum Wind during the flight(m/s)']),
          windRun: parseDecimalValue(row['Wind before takeoff (m/s)']),
          maxGust: gustValue,
          amsl: parseDecimalValue(row['AMSL (m)']),
          // Additional weather fields from the Excel
          lowWindChill: parseDecimalValue(row['Low Wind Chill - °C']),
          thwIndex: parseDecimalValue(row['Thw Index - °C']),
          wetBulb: parseDecimalValue(row['Wet Bulb - °C']),
          windChill: parseDecimalValue(row['Wind Chill - °C'])
        });
        
        await weatherData.save();
      }
      
      successCount++;
      
      if (successCount % 100 === 0) {
        console.log(`Processed ${successCount} weather records...`);
      }
    } catch (error) {
      console.error(`Error processing weather record:`, error.message);
      if (errorCount < 5) {
        console.error('Row data:', {
          Key: row.Key,
          FlightLog: row['Flight log(.ulg)'],
          Rain: row['Rain - mm'],
          Gust: row['Gust before takeoff (m/s)']
        });
      }
      errorCount++;
    }
  }
  
  console.log(`Weather station data import completed:`);
  console.log(`- ${successCount} successful updates/inserts`);
  console.log(`- ${errorCount} errors`);
  console.log(`- ${notFoundCount} flight logs not found in database`);
}

// Main function
async function main() {
  try {
    await connectDB();
    
    console.log('Starting weather station data import...');
    console.log('This will update existing flight logs with rain and gust data from weather_station_merged.xlsx');
    console.log('');
    
    await updateFlightLogsWithWeatherData();
    
    console.log('');
    console.log('Weather station data import completed!');
    
  } catch (error) {
    console.error('Error during import process:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
main();