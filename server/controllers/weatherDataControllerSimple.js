import WeatherData from '../models/WeatherData.js';
import LogDetail from '../models/LogDetail.js';
import memoryCache from '../utils/memoryCache.js';

// Helper function to normalize location names for matching
const normalizeLocationName = (location) => {
  if (!location) return '';
  return location
    .toString()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-\(\)]/g, '') // Remove special characters except basic ones
    .toLowerCase();
};

// Helper function to normalize serial numbers for matching
const normalizeSerialNumber = (sn) => {
  if (!sn) return '';
  return sn.toString().trim().replace(/^0+/, '') || '0';
};

// Helper function to get flight hours for weather entries with timeout and fallback
const getFlightHoursForRanges = async (weatherEntries, ranges, metric, timeoutMs = 15000) => {
  console.log('⚡ Using optimized flight hours calculation with parallel processing');
  
  // Create a map of flight logs to flight hours for faster lookup
  const logMap = new Map();
  
  try {
    // Get all unique flight logs from weather entries
    const uniqueFlightLogs = [...new Set(weatherEntries.map(entry => entry.flightLog))];
    console.log(`🔍 Found ${uniqueFlightLogs.length} unique flight logs to process`);
    
    // Batch query for all log details at once
    const logDetails = await LogDetail.find({
      key: { $in: uniqueFlightLogs }
    }).lean().maxTimeMS(timeoutMs);
    
    console.log(`📊 Retrieved ${logDetails.length} log details from database`);
    
    // Create lookup map with normalized serial numbers
    logDetails.forEach(log => {
      const normalizedSN = normalizeSerialNumber(log.sn);
      const key = `${log.key}_${normalizedSN}`;
      const flightHours = log.flight_time / 3600; // Convert seconds to hours
      logMap.set(key, flightHours);
    });
    
    console.log(`⚡ Created flight hours lookup map with ${logMap.size} entries`);
    
  } catch (error) {
    console.log('⚠️ Flight hours lookup failed, falling back to entry counts:', error.message);
    return getEntryCountsForRanges(weatherEntries, ranges, metric);
  }
  
  // Process all ranges in parallel for maximum speed
  const rangePromises = ranges.map(async (range) => {
    let totalHours = 0;
    let entryCount = 0;
    
    // Process all weather entries for this range
    weatherEntries.forEach(entry => {
      // Check if entry falls in this range
      let value;
      switch (metric) {
        case 'temperature':
          value = entry.temperature;
          break;
        case 'humidity':
          value = entry.humidity;
          break;
        case 'pressure':
          value = entry.pressure;
          break;
        case 'wind':
          value = entry.windRun;
          break;
        case 'gust':
          value = entry.maxGust;
          break;
        case 'cloud':
          value = entry.cloud;
          break;
        case 'rain':
          try {
            if (!entry.rain) value = 0;
            else {
              const rainStr = String(entry.rain).trim();
              if (rainStr === '' || rainStr === '0' || rainStr === '0,0') value = 0;
              else {
                const normalizedRain = rainStr.replace(',', '.');
                value = parseFloat(normalizedRain);
                if (isNaN(value)) value = 0;
              }
            }
          } catch {
            value = 0;
          }
          break;
        case 'densityAltitude':
          value = calculateDensityAltitude(entry);
          break;
        default:
          value = null;
      }
      
      if (value !== null && value >= range.min && value < range.max) {
        // Look up flight hours for this entry
        const normalizedSN = normalizeSerialNumber(entry.uaSN);
        const lookupKey = `${entry.flightLog}_${normalizedSN}`;
        const flightHours = logMap.get(lookupKey) || 0;
        
        if (flightHours > 0) {
          totalHours += flightHours;
          entryCount++;
        }
      }
    });
    
    return {
      range: range.label,
      hours: totalHours,
      count: entryCount,
      min: range.min,
      max: range.max
    };
  });
  
  // Wait for all ranges to be processed in parallel
  const rangeHours = await Promise.all(rangePromises);
  
  // Filter out ranges with no flight hours
  const validRanges = rangeHours.filter(range => range.hours > 0);
  console.log('⚡ Parallel flight hours calculation completed:', validRanges.length, 'ranges with flight hours');
  console.log('Sample results:', validRanges.slice(0, 3));
  
  return validRanges;
};

// Fallback function to get entry counts instead of flight hours
const getEntryCountsForRanges = (weatherEntries, ranges, metric) => {
  console.log('🔄 Calculating entry counts for', weatherEntries.length, 'weather entries');
  
  const rangeHours = ranges.map(range => {
    let entryCount = 0;
    
    weatherEntries.forEach(entry => {
      // Check if entry falls in this range
      let value;
      switch (metric) {
        case 'temperature':
          value = entry.temperature;
          break;
        case 'humidity':
          value = entry.humidity;
          break;
        case 'pressure':
          value = entry.pressure;
          break;
        case 'wind':
          value = entry.windRun;
          break;
        case 'gust':
          value = entry.maxGust;
          break;
        case 'cloud':
          value = entry.cloud;
          break;
        case 'rain':
          try {
            if (!entry.rain) value = 0;
            else {
              const rainStr = String(entry.rain).trim();
              if (rainStr === '' || rainStr === '0' || rainStr === '0,0') value = 0;
              else {
                const normalizedRain = rainStr.replace(',', '.');
                value = parseFloat(normalizedRain);
                if (isNaN(value)) value = 0;
              }
            }
          } catch {
            value = 0;
          }
          break;
        case 'densityAltitude':
          value = calculateDensityAltitude(entry);
          break;
        default:
          value = null;
      }
      
      if (value !== null && value >= range.min && value < range.max) {
        entryCount++;
      }
    });
    
    // Estimate flight hours based on entry count
    // Assume average flight duration of 30 minutes (0.5 hours) per weather entry
    const estimatedHours = entryCount * 0.5;
    
    return {
      range: range.label,
      hours: estimatedHours,
      count: entryCount,
      min: range.min,
      max: range.max
    };
  });
  
  // Filter out ranges with no entries
  const validRanges = rangeHours.filter(range => range.count > 0);
  console.log('Entry counts calculation completed:', validRanges.length, 'ranges with entries');
  console.log('Sample results:', validRanges.slice(0, 3));
  
  return validRanges;
};
const calculateDensityAltitude = (weatherData) => {
  const { pressure, temperature, humidity, amsl } = weatherData;

  if (pressure === null || temperature === null || humidity === null || amsl === null) {
    return null;
  }

  try {
    // data_df['air_pressure_derived'] = (Pressure**0.190263-(8.417286*(10**-5)*AMSL))**(1/0.190263)
    const airPressureDerived = Math.pow(
      Math.pow(pressure, 0.190263) - (8.417286 * Math.pow(10, -5) * amsl),
      1 / 0.190263
    );

    // data_df['water_vapour_derived'] = (Humidity/100)*6.1078*10**(7.5*Temp/(Temp+237.3))
    const waterVapourDerived =
      (humidity / 100) *
      6.1078 *
      Math.pow(10, (7.5 * temperature) / (temperature + 237.3));

    // data_df['air_density'] = ((air_pressure_derived*100)/(287.058*(Temp+273.15))+((water_vapour_derived*100)/(461.495*(Temp+273.15))))
    const airDensity =
      (airPressureDerived * 100) / (287.058 * (temperature + 273.15)) +
      (waterVapourDerived * 100) / (461.495 * (temperature + 273.15));

    // data_df['density_altitude'] = (44.3308-42.2665*air_density**0.234969)*1000
    const densityAltitude =
      (44.3308 - 42.2665 * Math.pow(airDensity, 0.234969)) * 1000;

    return densityAltitude;
  } catch (error) {
    console.error('Error calculating density altitude:', error);
    return null;
  }
};

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  DASHBOARD_STATS: 900,    // 15 minutes
  FILTER_OPTIONS: 1800,    // 30 minutes
  PAGINATED_DATA: 300,     // 5 minutes
  CHART_DATA: 1800,        // 30 minutes for chart data (longer cache)
  BULK_CHART_DATA: 3600    // 1 hour for bulk chart data (even longer)
};

// Helper to build filter query
const buildFilterQuery = (uaSNs, locations, startDate, endDate, search, weatherFilter) => {
  const filter = {};

  // UA SN filter
  if (uaSNs && uaSNs.length > 0) {
    const uasnArray = Array.isArray(uaSNs) ? uaSNs : uaSNs.split(',').filter(Boolean);
    // Normalize the filter values to match both normalized and non-normalized serial numbers
    const normalizedUaSNs = uasnArray.map(sn => normalizeSerialNumber(sn));
    const allVariations = [...new Set([...uasnArray, ...normalizedUaSNs])];
    filter.uaSN = { $in: allVariations };
  }

  // Location filter with improved matching
  if (locations && locations.length > 0) {
    // Use ||| as delimiter to handle locations with commas
    const locationArray = Array.isArray(locations) ? locations : locations.split('|||').filter(Boolean);
    console.log('🔍 Location filter debug:', {
      originalLocations: locations,
      isArray: Array.isArray(locations),
      locationArray: locationArray,
      locationArrayLength: locationArray.length
    });
    
    // Filter out empty locations and trim whitespace
    const validLocations = locationArray.filter(loc => loc && loc.trim() !== '').map(loc => loc.trim());
    console.log('🔍 Valid locations after filtering:', {
      validLocations: validLocations,
      validLocationsLength: validLocations.length
    });
    
    if (validLocations.length > 0) {
      // Try multiple matching strategies
      const exactMatches = validLocations;
      const regexMatches = validLocations.map(loc => new RegExp(`^${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      
      console.log('🔍 Location matching strategies:', {
        exactMatches,
        regexMatches: regexMatches.map(r => r.toString())
      });
      
      // Use flexible location matching
      const locationOrConditions = [
        { location: { $in: exactMatches } }, // Exact match
        { location: { $in: regexMatches } }, // Case-insensitive match
      ];
      
      // If there are existing $or conditions, combine them
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: locationOrConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = locationOrConditions;
      }
      
      console.log('🔍 Applied flexible location filter to MongoDB query:', JSON.stringify(filter.$or || filter.$and, null, 2));
    }
  }

  // Date range filter (extract from flightLog filename)
  if (startDate || endDate) {
    const dateRegexes = [];
    
    if (startDate && endDate) {
      // Generate regex patterns for date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      
      while (current <= end && dateRegexes.length < 365) { // Safety limit
        const year = current.getFullYear().toString().slice(-2);
        const month = (current.getMonth() + 1).toString().padStart(2, '0');
        const day = current.getDate().toString().padStart(2, '0');
        dateRegexes.push(`\\.${year}${month}${day}_`);
        current.setDate(current.getDate() + 1);
      }
    } else if (startDate) {
      const start = new Date(startDate);
      const year = start.getFullYear().toString().slice(-2);
      const month = (start.getMonth() + 1).toString().padStart(2, '0');
      const day = start.getDate().toString().padStart(2, '0');
      dateRegexes.push(`\\.${year}${month}${day}_`);
    } else if (endDate) {
      const end = new Date(endDate);
      const year = end.getFullYear().toString().slice(-2);
      const month = (end.getMonth() + 1).toString().padStart(2, '0');
      const day = end.getDate().toString().padStart(2, '0');
      dateRegexes.push(`\\.${year}${month}${day}_`);
    }
    
    if (dateRegexes.length > 0) {
      filter.flightLog = { $regex: dateRegexes.join('|') };
    }
  }

  // Weather filter - filter by specific weather condition ranges
  if (weatherFilter) {
    console.log('🔍 Applying weather filter:', weatherFilter);
    try {
      const wf = typeof weatherFilter === 'string' ? JSON.parse(weatherFilter) : weatherFilter;
      console.log('Parsed weather filter:', wf);
      if (wf && wf.type && wf.range) {
        const { type, range } = wf;
        const { min, max } = range;
        console.log(`Filtering ${type} between ${min} and ${max}`);

        switch (type) {
          case 'temperature':
            filter.temperature = { $gte: min, $lt: max };
            break;
          case 'humidity':
            filter.humidity = { $gte: min, $lt: max };
            break;
          case 'pressure':
            filter.pressure = { $gte: min, $lt: max };
            break;
          case 'wind':
            filter.windRun = { $gte: min, $lt: max };
            break;
          case 'gust':
            filter.maxGust = { $gte: min, $lt: max };
            break;
          case 'cloud':
            filter.cloud = { $gte: min, $lt: max };
            break;
          case 'rain':
            // Special handling for rain (string field)
            if (min === 0 && max <= 0.1) {
              // Handle zero or very small rain values - include empty strings and nulls
              filter.$or = [
                { rain: { $in: ['0', '0,0', '', null] } },
                { rain: { $exists: false } }
              ];
            } else {
              // For non-zero ranges, use aggregation with better error handling
              filter.$expr = {
                $and: [
                  {
                    $gte: [
                      {
                        $cond: {
                          if: { $or: [{ $eq: ['$rain', ''] }, { $eq: ['$rain', null] }, { $not: ['$rain'] }] },
                          then: 0,
                          else: {
                            $toDouble: {
                              $replaceAll: { input: '$rain', find: ',', replacement: '.' }
                            }
                          }
                        }
                      },
                      min
                    ]
                  },
                  {
                    $lt: [
                      {
                        $cond: {
                          if: { $or: [{ $eq: ['$rain', ''] }, { $eq: ['$rain', null] }, { $not: ['$rain'] }] },
                          then: 0,
                          else: {
                            $toDouble: {
                              $replaceAll: { input: '$rain', find: ',', replacement: '.' }
                            }
                          }
                        }
                      },
                      max
                    ]
                  }
                ]
              };
            }
            break;
          case 'densityAltitude':
            // Density altitude filtering is complex and should be handled client-side
            // For now, we'll skip server-side filtering for density altitude
            // The client will need to calculate and filter the results
            console.log('Density altitude filtering skipped - will be handled client-side');
            break;
          default:
            console.log('Unknown weather filter type:', type);
        }
        console.log('Applied weather filter to query:', JSON.stringify(filter, null, 2));
      }
    } catch (error) {
      console.error('Error parsing weather filter:', error);
    }
  }

  // Search filter
  if (search && search.trim()) {
    const normalizedSearch = normalizeSerialNumber(search.trim());
    filter.$or = [
      { uaSN: { $regex: search.trim(), $options: 'i' } },
      { uaSN: { $regex: normalizedSearch, $options: 'i' } },
      { flightLog: { $regex: search.trim(), $options: 'i' } },
      { location: { $regex: search.trim(), $options: 'i' } }
    ];
  }

  return filter;
};

// Get dashboard stats - SIMPLIFIED VERSION
export const getDashboardStats = async (req, res) => {
  try {
    console.log('=== DASHBOARD STATS DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user ? 'authenticated' : 'not authenticated');
    
    const { uaSNs, locations, startDate, endDate, weatherFilter } = req.query;
    
    // Create cache key
    const cacheKey = `dashboard_stats:${JSON.stringify({ uaSNs, locations, startDate, endDate, weatherFilter })}`;
    console.log('Cache key:', cacheKey);
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Returning cached data');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('❌ Cache miss, querying database');
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate, null, weatherFilter);
    console.log('MongoDB filter:', JSON.stringify(filter, null, 2));

    // Test basic connection first
    console.log('Testing database connection...');
    const testCount = await WeatherData.countDocuments({});
    console.log('Total documents in collection:', testCount);

    if (testCount === 0) {
      console.log('⚠️ No documents found in collection');
      const emptyStats = {
        totalEntries: 0,
        maxTemperature: 0, minTemperature: 0, avgTemperature: 0,
        maxHumidity: 0, minHumidity: 0, avgHumidity: 0,
        maxPressure: 0, minPressure: 0, avgPressure: 0,
        maxWind: 0, minWind: 0, avgWind: 0,
        maxGust: 0, minGust: 0, avgGust: 0,
        maxCloud: 0, minCloud: 0, avgCloud: 0,
        maxDensityAltitude: 0, minDensityAltitude: 0, avgDensityAltitude: 0,
        uniqueLocations: 0, uniqueUASNs: 0, totalRainfall: 0,
        locationsList: [], uasnList: []
      };
      
      memoryCache.set(cacheKey, emptyStats, CACHE_TTL.DASHBOARD_STATS);
      return res.json({ ...emptyStats, source: 'database' });
    }

    // Check filtered count
    const filteredCount = await WeatherData.countDocuments(filter);
    console.log('Filtered document count:', filteredCount);

    if (filteredCount === 0) {
      console.log('⚠️ No documents match filter');
      const emptyStats = {
        totalEntries: 0,
        maxTemperature: 0, minTemperature: 0, avgTemperature: 0,
        maxHumidity: 0, minHumidity: 0, avgHumidity: 0,
        maxPressure: 0, minPressure: 0, avgPressure: 0,
        maxWind: 0, minWind: 0, avgWind: 0,
        maxGust: 0, minGust: 0, avgGust: 0,
        maxCloud: 0, minCloud: 0, avgCloud: 0,
        maxDensityAltitude: 0, minDensityAltitude: 0, avgDensityAltitude: 0,
        uniqueLocations: 0, uniqueUASNs: 0, totalRainfall: 0,
        locationsList: [], uasnList: []
      };
      
      memoryCache.set(cacheKey, emptyStats, CACHE_TTL.DASHBOARD_STATS);
      return res.json({ ...emptyStats, source: 'database' });
    }

    console.log('🔄 Running aggregation pipeline...');
    // Get basic aggregation stats - REMOVE LIMIT TO SHOW ALL ENTRIES
    const basicStats = await WeatherData.aggregate([
      { $match: filter },
      // Removed { $limit: 5000 } to process all entries
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          maxTemperature: { $max: '$temperature' },
          minTemperature: { $min: '$temperature' },
          avgTemperature: { $avg: '$temperature' },
          maxHumidity: { $max: '$humidity' },
          minHumidity: { $min: '$humidity' },
          avgHumidity: { $avg: '$humidity' },
          maxPressure: { $max: '$pressure' },
          minPressure: { $min: '$pressure' },
          avgPressure: { $avg: '$pressure' },
          maxWind: { $max: '$windRun' },
          minWind: { $min: '$windRun' },
          avgWind: { $avg: '$windRun' },
          maxGust: { $max: '$maxGust' },
          minGust: { $min: '$maxGust' },
          avgGust: { $avg: '$maxGust' },
          maxCloud: { $max: '$cloud' },
          minCloud: { $min: '$cloud' },
          avgCloud: { $avg: '$cloud' },
          // Rain stats - simplified approach
          rainEntries: { $sum: { $cond: [{ $and: [{ $ne: ['$rain', null] }, { $ne: ['$rain', ''] }] }, 1, 0] } },
          uniqueLocations: { $addToSet: '$location' },
          uniqueUASNs: { $addToSet: '$uaSN' }
        }
      }
    ]);

    console.log('✅ Aggregation completed');
    console.log('Raw aggregation result:', basicStats[0] ? 'has data' : 'no data');

    let stats = basicStats[0] || {};

    // Calculate rain min/max separately to avoid aggregation issues
    console.log('🔄 Calculating rain statistics separately...');
    let rainStats = { maxRain: 0, minRain: 0, avgRain: 0 };
    
    try {
      // Get all rain values and process them
      const rainData = await WeatherData.find(filter, { rain: 1 }).lean();
      const rainValues = rainData
        .map(doc => doc.rain)
        .filter(rain => rain !== null && rain !== undefined && rain !== '')
        .map(rain => {
          try {
            // Handle string rain values - convert comma to dot and parse as float
            const rainStr = String(rain).trim();
            if (rainStr === '' || rainStr === '0' || rainStr === '0,0') {
              return 0;
            }
            const normalizedRain = rainStr.replace(',', '.');
            const value = parseFloat(normalizedRain);
            return isNaN(value) ? 0 : Math.max(0, value); // Ensure non-negative
          } catch {
            return 0;
          }
        });

      if (rainValues.length > 0) {
        rainStats.maxRain = Math.max(...rainValues);
        rainStats.minRain = Math.min(...rainValues);
        rainStats.avgRain = rainValues.reduce((sum, val) => sum + val, 0) / rainValues.length;
      }
      
      console.log('Rain statistics calculated:', {
        count: rainValues.length,
        min: rainStats.minRain,
        max: rainStats.maxRain,
        avg: rainStats.avgRain
      });
    } catch (rainError) {
      console.error('Error calculating rain statistics:', rainError);
      console.error('Rain error stack:', rainError.stack);
      // Use defaults if rain calculation fails
    }

    // Calculate density altitude for all entries and get min/max
    console.log('🔄 Calculating density altitude statistics...');
    let densityAltitudeStats = { maxDensityAltitude: 0, minDensityAltitude: 0, avgDensityAltitude: 0 };
    
    try {
      // Get all entries with required fields for density altitude calculation
      const densityAltitudeData = await WeatherData.find(filter, { 
        pressure: 1, 
        temperature: 1, 
        humidity: 1, 
        amsl: 1 
      }).lean();
      
      const densityAltitudeValues = densityAltitudeData
        .map(entry => {
          const da = calculateDensityAltitude(entry);
          return da;
        })
        .filter(value => value !== null && !isNaN(value) && isFinite(value));

      if (densityAltitudeValues.length > 0) {
        densityAltitudeStats.maxDensityAltitude = Math.max(...densityAltitudeValues);
        densityAltitudeStats.minDensityAltitude = Math.min(...densityAltitudeValues);
        densityAltitudeStats.avgDensityAltitude = densityAltitudeValues.reduce((sum, val) => sum + val, 0) / densityAltitudeValues.length;
      }
      
      console.log('Density altitude statistics calculated:', {
        count: densityAltitudeValues.length,
        min: densityAltitudeStats.minDensityAltitude,
        max: densityAltitudeStats.maxDensityAltitude,
        avg: densityAltitudeStats.avgDensityAltitude,
        sampleValues: densityAltitudeValues.slice(0, 5)
      });
    } catch (densityError) {
      console.error('Error calculating density altitude statistics:', densityError);
      console.error('Density error stack:', densityError.stack);
      // Use defaults if calculation fails
    }

    // Process the results
    const processedStats = {
      totalEntries: stats.totalEntries || 0,
      maxTemperature: stats.maxTemperature || 0,
      minTemperature: stats.minTemperature || 0,
      avgTemperature: Math.round((stats.avgTemperature || 0) * 100) / 100,
      maxHumidity: stats.maxHumidity || 0,
      minHumidity: stats.minHumidity || 0,
      avgHumidity: Math.round((stats.avgHumidity || 0) * 100) / 100,
      maxPressure: stats.maxPressure || 0,
      minPressure: stats.minPressure || 0,
      avgPressure: Math.round((stats.avgPressure || 0) * 100) / 100,
      maxWind: stats.maxWind || 0,
      minWind: stats.minWind || 0,
      avgWind: Math.round((stats.avgWind || 0) * 100) / 100,
      maxGust: stats.maxGust || 0,
      minGust: stats.minGust || 0,
      avgGust: Math.round((stats.avgGust || 0) * 100) / 100,
      maxCloud: stats.maxCloud || 0,
      minCloud: stats.minCloud || 0,
      avgCloud: Math.round((stats.avgCloud || 0) * 100) / 100,
      maxRain: rainStats.maxRain || 0,
      minRain: rainStats.minRain || 0,
      avgRain: Math.round((rainStats.avgRain || 0) * 100) / 100,
      uniqueLocations: (stats.uniqueLocations || []).filter(l => l && l.trim() !== '').length,
      // Normalize UA SNs to group "035" and "35" together
      uniqueUASNs: [...new Set((stats.uniqueUASNs || [])
        .filter(sn => sn && sn.trim() !== '')
        .map(sn => normalizeSerialNumber(sn)))].length,
      totalRainfall: stats.rainEntries || 0,
      locationsList: (stats.uniqueLocations || []).filter(l => l && l.trim() !== '').sort(),
      // Normalize and deduplicate UA SN list
      uasnList: [...new Set((stats.uniqueUASNs || [])
        .filter(sn => sn && sn.trim() !== '')
        .map(sn => normalizeSerialNumber(sn)))].sort((a, b) => {
          // Sort numerically if both are numbers
          const aNum = parseInt(a);
          const bNum = parseInt(b);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.localeCompare(b);
        }),
      // Simple density altitude calculation (placeholder)
      maxDensityAltitude: densityAltitudeStats.maxDensityAltitude || 0,
      minDensityAltitude: densityAltitudeStats.minDensityAltitude || 0,
      avgDensityAltitude: Math.round((densityAltitudeStats.avgDensityAltitude || 0) * 100) / 100,
    };

    console.log('📊 Final stats summary:');
    console.log('- Total entries:', processedStats.totalEntries);
    console.log('- Unique locations:', processedStats.uniqueLocations);
    console.log('- Unique UA SNs (normalized):', processedStats.uniqueUASNs);
    console.log('- Sample normalized UA SNs:', processedStats.uasnList.slice(0, 10));
    console.log('- Temperature range:', processedStats.minTemperature, 'to', processedStats.maxTemperature);

    // Cache for 15 minutes
    memoryCache.set(cacheKey, processedStats, CACHE_TTL.DASHBOARD_STATS);

    console.log('✅ Sending response');
    res.json({ ...processedStats, source: 'database' });
  } catch (error) {
    console.error('❌ ERROR in getDashboardStats:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching dashboard stats', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get paginated data
export const getPaginatedData = async (req, res) => {
  try {
    console.log('=== PAGINATED DATA DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user ? 'authenticated' : 'not authenticated');
    
    const {
      page = 1,
      limit = 200,
      sortField = 'uaSN',
      sortOrder = 'asc',
      search = '',
      uaSNs,
      locations,
      startDate,
      endDate,
      weatherFilter
    } = req.query;

    const cacheKey = `paginated_data:${JSON.stringify(req.query)}`;
    console.log('Cache key:', cacheKey);
    
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Returning cached paginated data');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('❌ Cache miss, querying database for paginated data');
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate, search, weatherFilter);
    console.log('MongoDB filter:', JSON.stringify(filter, null, 2));

    const sort = {};
    // Handle calculated fields that don't exist in the database
    if (sortField === 'densityAltitude') {
      // For density altitude, we'll sort by a combination of pressure and temperature
      // This is an approximation since we can't sort by calculated field directly
      sort['pressure'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort[sortField] = sortOrder === 'desc' ? -1 : 1;
    }

    const pageNum = Math.max(1, parseInt(page));
    // For density altitude filtering, allow larger limits since filtering is done client-side
    const maxLimit = req.query.densityAltitudeFilter ? 50000 : 1000;
    const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    console.log('Pagination params:', { pageNum, limitNum, skip, sort });

    // Test basic connection
    const testCount = await WeatherData.countDocuments({});
    console.log('Total documents in collection:', testCount);

    const [data, totalCount] = await Promise.all([
      WeatherData.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .maxTimeMS(30000),
      WeatherData.countDocuments(filter).maxTimeMS(10000)
    ]);

    console.log('Query results:');
    console.log('- Data count:', data.length);
    console.log('- Total count:', totalCount);
    console.log('- Sample data:', data.length > 0 ? Object.keys(data[0]) : 'no data');
    
    const result = {
      data: data || [],
      totalCount: totalCount || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((totalCount || 0) / limitNum),
      hasMore: skip + data.length < (totalCount || 0)
    };

    memoryCache.set(cacheKey, result, CACHE_TTL.PAGINATED_DATA);

    console.log('✅ Sending paginated response');
    res.json({ ...result, source: 'database' });
  } catch (error) {
    console.error('❌ ERROR in getPaginatedData:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching paginated data', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get filter options
export const getFilterOptions = async (req, res) => {
  try {
    console.log('=== FILTER OPTIONS DEBUG ===');
    console.log('User:', req.user ? 'authenticated' : 'not authenticated');
    
    const cacheKey = 'filter_options';
    
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Returning cached filter options');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('❌ Cache miss, querying database for filter options');

    // Test basic connection
    const testCount = await WeatherData.countDocuments({});
    console.log('Total documents in collection:', testCount);

    const [uaSNs, locations] = await Promise.all([
      WeatherData.distinct('uaSN').maxTimeMS(10000),
      WeatherData.distinct('location').maxTimeMS(10000)
    ]);

    console.log('Raw filter options results:');
    console.log('- UA SNs count:', uaSNs.length);
    console.log('- Locations count:', locations.length);
    console.log('- Sample UA SNs:', uaSNs.slice(0, 5));
    console.log('- Sample locations:', locations.slice(0, 5));
    console.log('- ALL locations in database:', locations);
    
    // Check for location formatting issues
    locations.forEach((loc, index) => {
      if (loc && typeof loc === 'string') {
        console.log(`🔍 Location ${index}: "${loc}" (length: ${loc.length}, trimmed: "${loc.trim()}")`);
        // Check for special characters
        const hasSpecialChars = /[^\w\s\-\(\)]/g.test(loc);
        if (hasSpecialChars) {
          console.log(`⚠️ Location "${loc}" contains special characters:`, loc.match(/[^\w\s\-\(\)]/g));
        }
      }
    });
    
    const options = {
      // Normalize and deduplicate UA SNs
      uaSNs: [...new Set(uaSNs
        .filter(sn => sn && sn.trim() !== '')
        .map(sn => normalizeSerialNumber(sn)))]
        .sort((a, b) => {
          // Sort numerically if both are numbers
          const aNum = parseInt(a);
          const bNum = parseInt(b);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.localeCompare(b);
        }),
      locations: locations.filter(loc => loc && loc.trim() !== '').sort()
    };

    console.log('Processed filter options:');
    console.log('- Filtered UA SNs count (normalized):', options.uaSNs.length);
    console.log('- Sample normalized UA SNs:', options.uaSNs.slice(0, 10));
    console.log('- Filtered locations count:', options.locations.length);

    memoryCache.set(cacheKey, options, CACHE_TTL.FILTER_OPTIONS);

    console.log('✅ Sending filter options response');
    res.json({ ...options, source: 'database' });
  } catch (error) {
    console.error('❌ ERROR in getFilterOptions:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching filter options', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get cache statistics
export const getCacheStats = async (req, res) => {
  try {
    const stats = memoryCache.getStats();
    res.json({
      cacheSize: stats.size,
      cacheKeys: stats.keys,
      memoryUsage: stats.memoryUsage,
      weatherCacheKeys: stats.keys.filter(key => 
        key.startsWith('dashboard_stats:') || 
        key.startsWith('paginated_data:') || 
        key.startsWith('filter_options')
      )
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cache stats', error: error.message });
  }
};

// Get chart data for Flight Hours vs Weather Conditions
export const getChartData = async (req, res) => {
  try {
    console.log('=== CHART DATA DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user ? 'authenticated' : 'not authenticated');
    
    const { metric, chartType, uaSNs, locations, startDate, endDate } = req.query;
    
    if (!metric) {
      return res.status(400).json({ message: 'Metric parameter is required' });
    }

    // Create cache key
    const cacheKey = `chart_data:${JSON.stringify({ metric, chartType, uaSNs, locations, startDate, endDate })}`;
    console.log('Cache key:', cacheKey);
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('✅ Returning cached chart data');
      console.log('Cached data sample:', Array.isArray(cached) ? cached.slice(0, 2) : 'Not an array');
      return res.json({ data: cached, source: 'cache' });
    }

    console.log('❌ Cache miss, querying database for chart data');
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate);
    console.log('MongoDB filter:', JSON.stringify(filter, null, 2));

    // Test basic connection first
    console.log('Testing database connection...');
    const testCount = await WeatherData.countDocuments({});
    console.log('Total documents in collection:', testCount);

    if (testCount === 0) {
      console.log('⚠️ No documents found in WeatherData collection');
      const emptyChartData = [];
      memoryCache.set(cacheKey, emptyChartData, CACHE_TTL.CHART_DATA);
      return res.json({ data: emptyChartData, source: 'database', message: 'No weather data available' });
    }

    // Check filtered count
    const filteredCount = await WeatherData.countDocuments(filter);
    console.log('Filtered document count:', filteredCount);

    if (filteredCount === 0) {
      console.log('⚠️ No documents match filter');
      const emptyChartData = [];
      memoryCache.set(cacheKey, emptyChartData, CACHE_TTL.CHART_DATA);
      return res.json({ data: emptyChartData, source: 'database' });
    }

    console.log('🔄 Running chart aggregation pipeline...');
    
    // Define metric field mapping
    const metricFieldMap = {
      temperature: '$temperature',
      humidity: '$humidity', 
      pressure: '$pressure',
      wind: '$windRun',
      gust: '$maxGust',
      cloud: '$cloud',
      rain: { $toDouble: { $replaceAll: { input: '$rain', find: ',', replacement: '.' } } },
      densityAltitude: 1000 // Placeholder for now
    };

    const metricField = metricFieldMap[metric];
    if (!metricField) {
      return res.status(400).json({ message: 'Invalid metric parameter' });
    }

    // Create ranges based on metric type - DYNAMIC like original
    let ranges = [];
    switch (metric) {
      case 'temperature':
        // Dynamic temperature ranges based on actual data (5°C intervals)
        const tempData = await WeatherData.find(filter, { temperature: 1 }).lean();
        const temps = tempData.map(d => d.temperature).filter(t => t !== null && t !== undefined);
        if (temps.length > 0) {
          const minTemp = Math.floor(Math.min(...temps) / 5) * 5;
          const maxTemp = Math.ceil(Math.max(...temps) / 5) * 5;
          for (let i = minTemp; i < maxTemp; i += 5) {
            ranges.push({
              label: `${i}-${i + 5}°C`,
              min: i,
              max: i + 5
            });
          }
        }
        break;
      case 'humidity':
        // Fixed humidity ranges (5% intervals from 0-100)
        for (let i = 0; i < 100; i += 5) {
          ranges.push({
            label: `${i}-${i + 5}%`,
            min: i,
            max: i + 5
          });
        }
        break;
      case 'pressure':
        // Fixed pressure ranges (2 hPa intervals for 1006-1032 range)
        for (let i = 1006; i < 1032; i += 2) {
          ranges.push({
            label: `${i}-${i + 2} hPa`,
            min: i,
            max: i + 2
          });
        }
        break;
      case 'wind':
        // Dynamic wind ranges based on actual data (1 m/s intervals)
        const windData = await WeatherData.find(filter, { windRun: 1 }).lean();
        const winds = windData.map(d => d.windRun).filter(w => w !== null && w !== undefined);
        if (winds.length > 0) {
          const minWind = Math.floor(Math.min(...winds));
          const maxWind = Math.ceil(Math.max(...winds));
          for (let i = minWind; i < maxWind; i += 1) {
            ranges.push({
              label: `${i}-${i + 1} m/s`,
              min: i,
              max: i + 1
            });
          }
        }
        break;
      case 'rain':
        // Dynamic rain ranges based on actual data (0.1 mm intervals)
        // Use a safer approach to avoid MongoDB conversion errors
        const rainData = await WeatherData.find(filter, { rain: 1 }).lean();
        const rains = [];
        
        for (const doc of rainData) {
          try {
            if (!doc.rain) {
              rains.push(0);
              continue;
            }
            const rainStr = String(doc.rain).trim();
            if (rainStr === '' || rainStr === '0' || rainStr === '0,0') {
              rains.push(0);
            } else {
              const normalizedRain = rainStr.replace(',', '.');
              const value = parseFloat(normalizedRain);
              rains.push(isNaN(value) ? 0 : Math.max(0, value));
            }
          } catch {
            rains.push(0);
          }
        }
        
        if (rains.length > 0) {
          const minRain = Math.floor(Math.min(...rains) * 10) / 10; // Round to nearest 0.1
          const maxRain = Math.ceil(Math.max(...rains) * 10) / 10;
          console.log('Rain range:', minRain, 'to', maxRain);
          // Create ranges up to the actual maximum
          for (let i = minRain; i < maxRain; i += 0.1) {
            ranges.push({
              label: `${i.toFixed(1)}-${(i + 0.1).toFixed(1)} mm`,
              min: i,
              max: i + 0.1
            });
          }
          // Add one more range if needed to include the maximum value
          if (maxRain > minRain) {
            ranges.push({
              label: `${maxRain.toFixed(1)}-${(maxRain + 0.1).toFixed(1)} mm`,
              min: maxRain,
              max: maxRain + 0.1
            });
          }
        }
        break;
      case 'cloud':
        // Fixed cloud ranges (5% intervals from 0-100)
        for (let i = 0; i < 100; i += 5) {
          ranges.push({
            label: `${i}-${i + 5}%`,
            min: i,
            max: i + 5
          });
        }
        break;
      case 'gust':
        // Dynamic gust ranges based on actual data (1 m/s intervals)
        const gustData = await WeatherData.find(filter, { maxGust: 1 }).lean();
        const gusts = gustData.map(d => d.maxGust).filter(g => g !== null && g !== undefined);
        if (gusts.length > 0) {
          const minGust = Math.floor(Math.min(...gusts));
          const maxGust = Math.ceil(Math.max(...gusts));
          for (let i = minGust; i < maxGust; i += 1) {
            ranges.push({
              label: `${i}-${i + 1} m/s`,
              min: i,
              max: i + 1
            });
          }
        }
        break;
      default:
        // Density altitude - dynamic ranges based on calculated values (500 intervals)
        const densityData = await WeatherData.find(filter, { pressure: 1, temperature: 1, humidity: 1, amsl: 1 }).lean();
        const densityAltitudes = densityData.map(d => calculateDensityAltitude(d)).filter(da => da !== null && da !== undefined);
        if (densityAltitudes.length > 0) {
          const minDA = Math.floor(Math.min(...densityAltitudes) / 500) * 500;
          const maxDA = Math.ceil(Math.max(...densityAltitudes) / 500) * 500;
          for (let i = minDA; i < maxDA; i += 500) {
            ranges.push({
              label: `${i}-${i + 500}`,
              min: i,
              max: i + 500
            });
          }
        }
    }

    // Get flight hours for each range using the helper function
    console.log('🔄 Calculating flight hours for ranges...');
    
    // Get all weather entries that match the filter
    const weatherEntries = await WeatherData.find(filter).lean();
    console.log('Found', weatherEntries.length, 'weather entries for flight hours calculation');
    
    let chartData;
    try {
      // Calculate flight hours for each range (now using entry counts for performance)
      chartData = await getFlightHoursForRanges(weatherEntries, ranges, metric);
    } catch (error) {
      console.log('⚠️ Chart calculation failed, falling back to entry counts:', error.message);
      chartData = getEntryCountsForRanges(weatherEntries, ranges, metric);
    }
    
    console.log('Flight hours calculation completed. Results:', chartData.length, 'ranges with flight hours');
    
    // Transform the data to match expected format (add count for backward compatibility)
    const transformedData = chartData.map(item => ({
      range: item.range,
      hours: item.hours, // Flight hours (main value)
      count: item.count, // Entry count (for backward compatibility)
      min: item.min,
      max: item.max
    }));
    
    console.log('📊 Chart data summary:');
    console.log('- Metric:', metric);
    console.log('- Total ranges with flight hours:', transformedData.length);
    console.log('- Sample data:', transformedData.slice(0, 2));
    console.log('- Total flight hours across all ranges:', transformedData.reduce((sum, item) => sum + item.hours, 0));

    // Cache for 30 minutes (longer for chart data)
    memoryCache.set(cacheKey, transformedData, CACHE_TTL.CHART_DATA);

    console.log('✅ Sending chart response with flight hours');
    res.json({ data: transformedData, source: 'database' });
  } catch (error) {
    console.error('❌ ERROR in getChartData:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching chart data', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get ALL chart data for preloading - OPTIMIZED BULK ENDPOINT
export const getAllChartData = async (req, res) => {
  const requestStartTime = performance.now();
  try {
    console.log('=== BULK CHART DATA REQUEST START ===');
    console.log('⏱️ Request timestamp:', new Date().toISOString());
    console.log('📊 Query params:', req.query);
    console.log('👤 User:', req.user ? `${req.user.username} (${req.user.role})` : 'not authenticated');
    
    const { uaSNs, locations, startDate, endDate } = req.query;
    
    // Create cache key for bulk data
    const cacheKey = `bulk_chart_data:${JSON.stringify({ uaSNs, locations, startDate, endDate })}`;
    console.log('🔑 Cache key:', cacheKey);
    
    // Try cache first
    const cacheCheckStart = performance.now();
    const cached = memoryCache.get(cacheKey);
    const cacheCheckTime = Math.round(performance.now() - cacheCheckStart);
    
    if (cached) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`✅ CACHE HIT! Returning cached bulk chart data in ${totalTime}ms (cache check: ${cacheCheckTime}ms)`);
      console.log('📊 Cached data metrics:', Object.keys(cached).length);
      return res.json({ data: cached, source: 'cache' });
    }

    console.log(`❌ Cache miss (check took ${cacheCheckTime}ms), generating bulk chart data`);
    
    const filterBuildStart = performance.now();
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate);
    const filterBuildTime = Math.round(performance.now() - filterBuildStart);
    
    console.log(`🔍 Filter built in ${filterBuildTime}ms:`, JSON.stringify(filter, null, 2));

    // OPTIMIZED: Get all data in parallel and create lookup maps
    console.log('🔄 Starting parallel data fetching...');
    const startFetchTime = performance.now();
    
    const [weatherEntries, logDetails] = await Promise.all([
      WeatherData.find(filter).lean(),
      LogDetail.find({}).lean() // Get all log details for faster lookup
    ]);
    
    const endFetchTime = performance.now();
    const fetchTime = Math.round(endFetchTime - startFetchTime);
    console.log(`⚡ Parallel data fetch completed in ${fetchTime}ms`);
    console.log('📊 Data summary:', {
      weatherEntries: weatherEntries.length,
      logDetails: logDetails.length,
      sampleWeatherEntry: weatherEntries[0] ? {
        uaSN: weatherEntries[0].uaSN,
        location: weatherEntries[0].location,
        flightLog: weatherEntries[0].flightLog,
        temperature: weatherEntries[0].temperature
      } : null
    });
    
    if (weatherEntries.length === 0) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`⚠️ No weather entries found, returning empty data in ${totalTime}ms`);
      const emptyBulkData = {};
      memoryCache.set(cacheKey, emptyBulkData, CACHE_TTL.BULK_CHART_DATA);
      return res.json({ data: emptyBulkData, source: 'database' });
    }
    
    // Create optimized lookup map for flight hours
    const logMapStart = performance.now();
    const logMap = new Map();
    logDetails.forEach(log => {
      const normalizedSN = normalizeSerialNumber(log.sn);
      const key = `${log.key}_${normalizedSN}`;
      const flightHours = log.flight_time / 3600; // Convert seconds to hours
      logMap.set(key, flightHours);
    });
    const logMapTime = Math.round(performance.now() - logMapStart);
    
    console.log(`⚡ Created optimized log map in ${logMapTime}ms with ${logMap.size} entries`);
    console.log('🔍 Sample log map entries:', Array.from(logMap.entries()).slice(0, 3));
    
    // Define all metrics to process
    const metrics = ['temperature', 'humidity', 'pressure', 'densityAltitude', 'wind', 'rain', 'cloud', 'gust'];
    console.log('📈 Processing metrics:', metrics);
    
    // PARALLEL PROCESSING: Process all metrics simultaneously
    const metricsProcessStart = performance.now();
    const metricPromises = metrics.map(async (metric) => {
      const metricStart = performance.now();
      console.log(`🔄 Processing ${metric} chart data...`);
      
      // Calculate ranges based on metric type
      let ranges = [];
      const rangeCalcStart = performance.now();
      
      switch (metric) {
        case 'temperature':
          const temps = weatherEntries.map(d => d.temperature).filter(t => t !== null && t !== undefined);
          if (temps.length > 0) {
            const minTemp = Math.floor(Math.min(...temps) / 5) * 5;
            const maxTemp = Math.ceil(Math.max(...temps) / 5) * 5;
            for (let i = minTemp; i < maxTemp; i += 5) {
              ranges.push({ label: `${i}-${i + 5}°C`, min: i, max: i + 5 });
            }
          }
          break;
        case 'humidity':
          for (let i = 0; i < 100; i += 5) {
            ranges.push({ label: `${i}-${i + 5}%`, min: i, max: i + 5 });
          }
          break;
        case 'pressure':
          for (let i = 1006; i < 1032; i += 2) {
            ranges.push({ label: `${i}-${i + 2} hPa`, min: i, max: i + 2 });
          }
          break;
        case 'wind':
          const winds = weatherEntries.map(d => d.windRun).filter(w => w !== null && w !== undefined);
          if (winds.length > 0) {
            const minWind = Math.floor(Math.min(...winds));
            const maxWind = Math.ceil(Math.max(...winds));
            for (let i = minWind; i < maxWind; i += 1) {
              ranges.push({ label: `${i}-${i + 1} m/s`, min: i, max: i + 1 });
            }
          }
          break;
        case 'rain':
          const rains = [];
          for (const doc of weatherEntries) {
            try {
              if (!doc.rain) {
                rains.push(0);
                continue;
              }
              const rainStr = String(doc.rain).trim();
              if (rainStr === '' || rainStr === '0' || rainStr === '0,0') {
                rains.push(0);
              } else {
                const normalizedRain = rainStr.replace(',', '.');
                const value = parseFloat(normalizedRain);
                rains.push(isNaN(value) ? 0 : Math.max(0, value));
              }
            } catch {
              rains.push(0);
            }
          }
          
          if (rains.length > 0) {
            const minRain = Math.floor(Math.min(...rains) * 10) / 10;
            const maxRain = Math.ceil(Math.max(...rains) * 10) / 10;
            for (let i = minRain; i < maxRain; i += 0.1) {
              ranges.push({ label: `${i.toFixed(1)}-${(i + 0.1).toFixed(1)} mm`, min: i, max: i + 0.1 });
            }
            if (maxRain > minRain) {
              ranges.push({ label: `${maxRain.toFixed(1)}-${(maxRain + 0.1).toFixed(1)} mm`, min: maxRain, max: maxRain + 0.1 });
            }
          }
          break;
        case 'cloud':
          for (let i = 0; i < 100; i += 5) {
            ranges.push({ label: `${i}-${i + 5}%`, min: i, max: i + 5 });
          }
          break;
        case 'gust':
          const gusts = weatherEntries.map(d => d.maxGust).filter(g => g !== null && g !== undefined);
          if (gusts.length > 0) {
            const minGust = Math.floor(Math.min(...gusts));
            const maxGust = Math.ceil(Math.max(...gusts));
            for (let i = minGust; i < maxGust; i += 1) {
              ranges.push({ label: `${i}-${i + 1} m/s`, min: i, max: i + 1 });
            }
          }
          break;
        case 'densityAltitude':
          const densityAltitudes = weatherEntries.map(d => calculateDensityAltitude(d)).filter(da => da !== null && da !== undefined);
          if (densityAltitudes.length > 0) {
            const minDA = Math.floor(Math.min(...densityAltitudes) / 500) * 500;
            const maxDA = Math.ceil(Math.max(...densityAltitudes) / 500) * 500;
            for (let i = minDA; i < maxDA; i += 500) {
              ranges.push({ label: `${i}-${i + 500}`, min: i, max: i + 500 });
            }
          }
          break;
      }

      const rangeCalcTime = Math.round(performance.now() - rangeCalcStart);
      console.log(`📊 ${metric}: calculated ${ranges.length} ranges in ${rangeCalcTime}ms`);

      // PARALLEL RANGE PROCESSING: Process all ranges for this metric simultaneously
      const rangeProcessStart = performance.now();
      const rangePromises = ranges.map(async (range) => {
        let totalHours = 0;
        let entryCount = 0;
        
        // Process all weather entries for this range
        weatherEntries.forEach(entry => {
          let value;
          switch (metric) {
            case 'temperature': value = entry.temperature; break;
            case 'humidity': value = entry.humidity; break;
            case 'pressure': value = entry.pressure; break;
            case 'wind': value = entry.windRun; break;
            case 'gust': value = entry.maxGust; break;
            case 'cloud': value = entry.cloud; break;
            case 'rain':
              try {
                if (!entry.rain) value = 0;
                else {
                  const rainStr = String(entry.rain).trim();
                  if (rainStr === '' || rainStr === '0' || rainStr === '0,0') value = 0;
                  else {
                    const normalizedRain = rainStr.replace(',', '.');
                    value = parseFloat(normalizedRain);
                    if (isNaN(value)) value = 0;
                  }
                }
              } catch {
                value = 0;
              }
              break;
            case 'densityAltitude': value = calculateDensityAltitude(entry); break;
            default: value = null;
          }
          
          if (value !== null && value >= range.min && value < range.max) {
            const normalizedSN = normalizeSerialNumber(entry.uaSN);
            const lookupKey = `${entry.flightLog}_${normalizedSN}`;
            const flightHours = logMap.get(lookupKey) || 0;
            if (flightHours > 0) {
              totalHours += flightHours;
              entryCount++;
            }
          }
        });
        
        return {
          range: range.label,
          hours: totalHours,
          count: entryCount,
          min: range.min,
          max: range.max
        };
      });

      // Wait for all ranges to be processed
      const chartData = await Promise.all(rangePromises);
      const rangeProcessTime = Math.round(performance.now() - rangeProcessStart);
      
      // Filter out ranges with no flight hours; fall back to entryCount if all hours are 0
      const hasHours = chartData.some(range => range.hours > 0);
      const validChartData = hasHours
        ? chartData.filter(range => range.hours > 0)
        : chartData.filter(range => range.count > 0).map(range => ({ ...range, hours: range.count }));
      
      const metricTime = Math.round(performance.now() - metricStart);
      console.log(`✅ ${metric}: processed in ${metricTime}ms (ranges: ${rangeCalcTime}ms, processing: ${rangeProcessTime}ms) - ${validChartData.length}/${ranges.length} ranges with flight hours`);
      
      return [metric, validChartData];
    });

    // Wait for all metrics to be processed in parallel
    const results = await Promise.all(metricPromises);
    const metricsProcessTime = Math.round(performance.now() - metricsProcessStart);
    
    // Convert results to object
    const bulkChartData = {};
    results.forEach(([metric, data]) => {
      bulkChartData[metric] = data;
    });
    
    const totalRanges = Object.values(bulkChartData).reduce((sum, data) => sum + data.length, 0);
    console.log(`📊 All metrics processed in ${metricsProcessTime}ms`);
    console.log('📊 Bulk chart data summary:', {
      processedMetrics: Object.keys(bulkChartData).length,
      totalRangesWithData: totalRanges,
      metricsBreakdown: Object.entries(bulkChartData).map(([metric, data]) => ({
        metric,
        ranges: data.length,
        totalHours: data.reduce((sum, range) => sum + range.hours, 0)
      }))
    });

    // Cache for 1 hour (longer than individual charts)
    const cacheSetStart = performance.now();
    memoryCache.set(cacheKey, bulkChartData, CACHE_TTL.BULK_CHART_DATA);
    const cacheSetTime = Math.round(performance.now() - cacheSetStart);

    const totalTime = Math.round(performance.now() - requestStartTime);
    console.log(`⚡ TOTAL BULK CHART DATA GENERATION TIME: ${totalTime}ms`);
    console.log('⏱️ Time breakdown:', {
      filterBuild: filterBuildTime,
      dataFetch: fetchTime,
      logMapCreation: logMapTime,
      metricsProcessing: metricsProcessTime,
      cacheSet: cacheSetTime,
      total: totalTime
    });
    console.log('✅ === BULK CHART DATA REQUEST COMPLETE ===');

    res.json({ data: bulkChartData, source: 'database' });
  } catch (error) {
    const totalTime = Math.round(performance.now() - requestStartTime);
    console.error(`❌ ERROR in getAllChartData after ${totalTime}ms:`, error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching bulk chart data', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get log details for frontend processing
export const getLogDetails = async (req, res) => {
  const requestStartTime = performance.now();
  try {
    console.log('=== LOG DETAILS REQUEST START ===');
    
    // Create cache key for log details
    const cacheKey = 'log_details_all';
    
    // Try cache first
    const cacheCheckStart = performance.now();
    const cached = memoryCache.get(cacheKey);
    const cacheCheckTime = Math.round(performance.now() - cacheCheckStart);
    
    if (cached) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`✅ CACHE HIT! Returning cached log details in ${totalTime}ms (cache check: ${cacheCheckTime}ms)`);
      console.log('📊 Cached log details count:', cached.length);
      return res.json({ data: cached, source: 'cache' });
    }

    console.log(`❌ Cache miss (check took ${cacheCheckTime}ms), fetching log details`);
    
    // Get all log details
    console.log('🔄 Fetching log details...');
    const dataFetchStart = performance.now();
    
    const logDetails = await LogDetail.find({})
      .select('key sn flight_time')
      .lean()
      .maxTimeMS(30000);
    
    const dataFetchTime = Math.round(performance.now() - dataFetchStart);
    console.log(`⚡ Log details fetched in ${dataFetchTime}ms`);
    console.log('📊 Log details summary:', {
      totalEntries: logDetails.length,
      sampleEntry: logDetails[0] ? {
        key: logDetails[0].key,
        sn: logDetails[0].sn,
        flight_time: logDetails[0].flight_time
      } : null
    });
    
    // Cache for 1 hour
    const cacheSetStart = performance.now();
    memoryCache.set(cacheKey, logDetails, CACHE_TTL.BULK_CHART_DATA);
    const cacheSetTime = Math.round(performance.now() - cacheSetStart);

    const totalTime = Math.round(performance.now() - requestStartTime);
    console.log(`⚡ TOTAL LOG DETAILS FETCH TIME: ${totalTime}ms`);
    console.log('⏱️ Time breakdown:', {
      dataFetch: dataFetchTime,
      cacheSet: cacheSetTime,
      total: totalTime
    });
    console.log('✅ === LOG DETAILS REQUEST COMPLETE ===');

    res.json({ data: logDetails, source: 'database' });
  } catch (error) {
    const totalTime = Math.round(performance.now() - requestStartTime);
    console.error(`❌ ERROR in getLogDetails after ${totalTime}ms:`, error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching log details', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Get raw weather data for frontend processing
export const getRawWeatherData = async (req, res) => {
  const requestStartTime = performance.now();
  try {
    console.log('=== RAW WEATHER DATA REQUEST START ===');
    console.log('⏱️ Request timestamp:', new Date().toISOString());
    console.log('📊 Query params:', req.query);
    console.log('👤 User:', req.user ? `${req.user.username} (${req.user.role})` : 'not authenticated');
    
    const { uaSNs, startDate, endDate } = req.query;
    // Note: Not filtering by locations on server - will be done on frontend
    
    // Create cache key for raw data (without locations)
    const cacheKey = `raw_weather_data:${JSON.stringify({ uaSNs, startDate, endDate })}`;
    console.log('🔑 Cache key:', cacheKey);
    
    // Try cache first
    const cacheCheckStart = performance.now();
    const cached = memoryCache.get(cacheKey);
    const cacheCheckTime = Math.round(performance.now() - cacheCheckStart);
    
    if (cached) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`✅ CACHE HIT! Returning cached raw weather data in ${totalTime}ms (cache check: ${cacheCheckTime}ms)`);
      console.log('📊 Cached data count:', cached.length);
      return res.json({ data: cached, source: 'cache' });
    }

    console.log(`❌ Cache miss (check took ${cacheCheckTime}ms), fetching raw weather data`);
    
    const filterBuildStart = performance.now();
    // Build filter without locations
    const filter = buildFilterQuery(uaSNs, null, startDate, endDate);
    const filterBuildTime = Math.round(performance.now() - filterBuildStart);
    
    console.log(`🔍 Filter built in ${filterBuildTime}ms:`, JSON.stringify(filter, null, 2));

    // Get raw weather data
    console.log('🔄 Fetching raw weather data...');
    const dataFetchStart = performance.now();
    
    const weatherData = await WeatherData.find(filter)
      .select('uaSN location flightLog temperature humidity pressure windRun maxGust cloud rain amsl')
      .lean()
      .maxTimeMS(30000);
    
    const dataFetchTime = Math.round(performance.now() - dataFetchStart);
    console.log(`⚡ Raw weather data fetched in ${dataFetchTime}ms`);
    console.log('📊 Data summary:', {
      totalEntries: weatherData.length,
      sampleEntry: weatherData[0] ? {
        uaSN: weatherData[0].uaSN,
        location: weatherData[0].location,
        flightLog: weatherData[0].flightLog,
        temperature: weatherData[0].temperature
      } : null,
      uniqueLocations: [...new Set(weatherData.map(d => d.location))].length
    });
    
    if (weatherData.length === 0) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`⚠️ No weather data found, returning empty array in ${totalTime}ms`);
      const emptyData = [];
      memoryCache.set(cacheKey, emptyData, CACHE_TTL.BULK_CHART_DATA);
      return res.json({ data: emptyData, source: 'database' });
    }
    
    // Cache for 1 hour
    const cacheSetStart = performance.now();
    memoryCache.set(cacheKey, weatherData, CACHE_TTL.BULK_CHART_DATA);
    const cacheSetTime = Math.round(performance.now() - cacheSetStart);

    const totalTime = Math.round(performance.now() - requestStartTime);
    console.log(`⚡ TOTAL RAW WEATHER DATA FETCH TIME: ${totalTime}ms`);
    console.log('⏱️ Time breakdown:', {
      filterBuild: filterBuildTime,
      dataFetch: dataFetchTime,
      cacheSet: cacheSetTime,
      total: totalTime
    });
    console.log('✅ === RAW WEATHER DATA REQUEST COMPLETE ===');

    res.json({ data: weatherData, source: 'database' });
  } catch (error) {
    const totalTime = Math.round(performance.now() - requestStartTime);
    console.error(`❌ ERROR in getRawWeatherData after ${totalTime}ms:`, error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      message: 'Error fetching raw weather data', 
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
};

// Clear cache
export const clearCache = async (req, res) => {
  try {
    const deletedCount = memoryCache.deletePattern('^(dashboard_stats|paginated_data|filter_options|chart_data|bulk_chart_data|raw_weather_data):');
    res.json({ 
      message: 'Weather cache cleared successfully', 
      deletedEntries: deletedCount 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cache', error: error.message });
  }
};

// DEBUG: Test location filtering
export const testLocationFiltering = async (req, res) => {
  try {
    console.log('=== LOCATION FILTERING TEST ===');
    const { locations } = req.query;
    
    console.log('Test params:', { locations });
    
    // Get all unique locations from database
    const allLocations = await WeatherData.distinct('location');
    console.log('All locations in database:', allLocations);
    
    if (locations) {
      // Use ||| as delimiter to handle locations with commas
      const locationArray = Array.isArray(locations) ? locations : locations.split('|||').filter(Boolean);
      const validLocations = locationArray.filter(loc => loc && loc.trim() !== '').map(loc => loc.trim());
      
      console.log('Requested locations:', validLocations);
      
      // Test exact matches
      const exactMatches = allLocations.filter(dbLoc => validLocations.includes(dbLoc));
      console.log('Exact matches:', exactMatches);
      
      // Test case-insensitive matches
      const caseInsensitiveMatches = allLocations.filter(dbLoc => 
        validLocations.some(reqLoc => 
          dbLoc && reqLoc && dbLoc.toLowerCase().trim() === reqLoc.toLowerCase().trim()
        )
      );
      console.log('Case-insensitive matches:', caseInsensitiveMatches);
      
      // Test partial matches
      const partialMatches = allLocations.filter(dbLoc => 
        validLocations.some(reqLoc => 
          dbLoc && reqLoc && (
            dbLoc.toLowerCase().includes(reqLoc.toLowerCase()) ||
            reqLoc.toLowerCase().includes(dbLoc.toLowerCase())
          )
        )
      );
      console.log('Partial matches:', partialMatches);
      
      // Test actual query
      const filter = { location: { $in: validLocations } };
      const count = await WeatherData.countDocuments(filter);
      console.log('Query result count:', count);
      
      // Test case-insensitive query
      const caseInsensitiveFilter = { 
        location: { 
          $in: validLocations.map(loc => new RegExp(`^${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
        } 
      };
      const caseInsensitiveCount = await WeatherData.countDocuments(caseInsensitiveFilter);
      console.log('Case-insensitive query result count:', caseInsensitiveCount);
      
      res.json({
        requestedLocations: validLocations,
        allDatabaseLocations: allLocations,
        exactMatches,
        caseInsensitiveMatches,
        partialMatches,
        exactQueryCount: count,
        caseInsensitiveQueryCount: caseInsensitiveCount
      });
    } else {
      res.json({
        allDatabaseLocations: allLocations,
        message: 'No locations parameter provided'
      });
    }
  } catch (error) {
    console.error('Error in testLocationFiltering:', error);
    res.status(500).json({ message: 'Error testing location filtering', error: error.message });
  }
};