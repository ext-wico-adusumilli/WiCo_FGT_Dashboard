import WeatherData from '../models/WeatherData.js';
import WeatherStatsSummary from '../models/WeatherStatsSummary.js';
import dataFreshnessTracker from '../utils/dataFreshnessTracker.js';
import memoryCache from '../utils/memoryCache.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  DASHBOARD_STATS: 900,    // 15 minutes
  FILTER_OPTIONS: 1800,    // 30 minutes
  CHART_DATA: 600,         // 10 minutes
  PAGINATED_DATA: 300      // 5 minutes
};

// Helper to build filter query
const buildFilterQuery = (uaSNs, locations, startDate, endDate, search) => {
  const filter = {};

  // UA SN filter
  if (uaSNs && uaSNs.length > 0) {
    const uasnArray = Array.isArray(uaSNs) ? uaSNs : uaSNs.split(',').filter(Boolean);
    filter.uaSN = { $in: uasnArray };
  }

  // Location filter
  if (locations && locations.length > 0) {
    // Use ||| as delimiter to handle locations with commas
    const locationArray = Array.isArray(locations) ? locations : locations.split('|||').filter(Boolean);
    filter.location = { $in: locationArray };
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

  // Search filter
  if (search && search.trim()) {
    filter.$or = [
      { uaSN: { $regex: search.trim(), $options: 'i' } },
      { flightLog: { $regex: search.trim(), $options: 'i' } },
      { location: { $regex: search.trim(), $options: 'i' } }
    ];
  }

  return filter;
};

// Get dashboard stats with caching - FULL IMPLEMENTATION
export const getDashboardStats = async (req, res) => {
  try {
    console.log('getDashboardStats called with query:', req.query);
    console.log('User from auth middleware:', req.user);
    
    const { uaSNs, locations, startDate, endDate } = req.query;
    
    // Create cache key
    const cacheKey = `dashboard_stats:${JSON.stringify({ uaSNs, locations, startDate, endDate })}`;
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached data');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('Cache miss, querying database');
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate);
    console.log('Filter:', JSON.stringify(filter));

    // Full aggregation pipeline matching original functionality
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          
          // Temperature stats
          maxTemperature: { $max: '$temperature' },
          minTemperature: { $min: '$temperature' },
          avgTemperature: { $avg: '$temperature' },
          tempEntries: { $push: { $cond: [{ $ne: ['$temperature', null] }, '$$ROOT', null] } },
          
          // Humidity stats
          maxHumidity: { $max: '$humidity' },
          minHumidity: { $min: '$humidity' },
          avgHumidity: { $avg: '$humidity' },
          
          // Pressure stats
          maxPressure: { $max: '$pressure' },
          minPressure: { $min: '$pressure' },
          avgPressure: { $avg: '$pressure' },
          
          // Wind stats (windRun = Average Wind Speed Over 6 Minutes)
          maxWind: { $max: '$windRun' },
          minWind: { $min: '$windRun' },
          avgWind: { $avg: '$windRun' },
          
          // Gust stats
          maxGust: { $max: '$maxGust' },
          minGust: { $min: '$maxGust' },
          avgGust: { $avg: '$maxGust' },
          
          // Cloud stats
          maxCloud: { $max: '$cloud' },
          minCloud: { $min: '$cloud' },
          avgCloud: { $avg: '$cloud' },
          
          // Rain entries (count non-empty rain values) - matching original logic
          rainEntries: { $sum: { $cond: [{ $and: [{ $ne: ['$rain', null] }, { $ne: ['$rain', ''] }] }, 1, 0] } },
          
          // Unique values
          uniqueLocations: { $addToSet: '$location' },
          uniqueUASNs: { $addToSet: '$uaSN' },
          
          // All entries for density altitude calculation
          allEntries: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          totalEntries: 1,
          maxTemperature: { $ifNull: ['$maxTemperature', 0] },
          minTemperature: { $ifNull: ['$minTemperature', 0] },
          avgTemperature: { $round: [{ $ifNull: ['$avgTemperature', 0] }, 2] },
          maxHumidity: { $ifNull: ['$maxHumidity', 0] },
          minHumidity: { $ifNull: ['$minHumidity', 0] },
          avgHumidity: { $round: [{ $ifNull: ['$avgHumidity', 0] }, 2] },
          maxPressure: { $ifNull: ['$maxPressure', 0] },
          minPressure: { $ifNull: ['$minPressure', 0] },
          avgPressure: { $round: [{ $ifNull: ['$avgPressure', 0] }, 2] },
          maxWind: { $ifNull: ['$maxWind', 0] },
          minWind: { $ifNull: ['$minWind', 0] },
          avgWind: { $round: [{ $ifNull: ['$avgWind', 0] }, 2] },
          maxGust: { $ifNull: ['$maxGust', 0] },
          minGust: { $ifNull: ['$minGust', 0] },
          avgGust: { $round: [{ $ifNull: ['$avgGust', 0] }, 2] },
          maxCloud: { $ifNull: ['$maxCloud', 0] },
          minCloud: { $ifNull: ['$minCloud', 0] },
          avgCloud: { $round: [{ $ifNull: ['$avgCloud', 0] }, 2] },
          uniqueLocations: { $size: { $filter: { input: '$uniqueLocations', cond: { $ne: ['$$this', null] } } } },
          uniqueUASNs: { $size: { $filter: { input: '$uniqueUASNs', cond: { $ne: ['$$this', null] } } } },
          totalRainfall: '$rainEntries',
          locationsList: { $filter: { input: '$uniqueLocations', cond: { $ne: ['$$this', null] } } },
          uasnList: { $filter: { input: '$uniqueUASNs', cond: { $ne: ['$$this', null] } } },
          allEntries: 1
        }
      }
    ];

    console.log('Running aggregation pipeline...');
    const result = await WeatherData.aggregate(pipeline).maxTimeMS(30000);
    console.log('Aggregation completed, processing results...');
    
    let stats = result[0] || {
      totalEntries: 0,
      maxTemperature: 0,
      minTemperature: 0,
      avgTemperature: 0,
      maxHumidity: 0,
      minHumidity: 0,
      avgHumidity: 0,
      maxPressure: 0,
      minPressure: 0,
      avgPressure: 0,
      maxWind: 0,
      minWind: 0,
      avgWind: 0,
      maxGust: 0,
      minGust: 0,
      avgGust: 0,
      maxCloud: 0,
      minCloud: 0,
      avgCloud: 0,
      uniqueLocations: 0,
      uniqueUASNs: 0,
      totalRainfall: 0,
      locationsList: [],
      uasnList: [],
      allEntries: []
    };

    // Calculate density altitude stats (server-side calculation)
    if (stats.allEntries && stats.allEntries.length > 0) {
      const densityAltitudes = stats.allEntries
        .map(entry => {
          // Simple density altitude calculation (matching client-side logic)
          if (entry.temperature !== null && entry.pressure !== null && entry.amsl !== null) {
            const tempK = entry.temperature + 273.15;
            const standardTemp = 288.15;
            const standardPressure = 1013.25;
            const densityAltitude = entry.amsl + (standardTemp / 0.0065) * (1 - Math.pow((entry.pressure / standardPressure), 0.190284));
            return densityAltitude;
          }
          return null;
        })
        .filter(da => da !== null);

      if (densityAltitudes.length > 0) {
        stats.maxDensityAltitude = Math.max(...densityAltitudes);
        stats.minDensityAltitude = Math.min(...densityAltitudes);
        stats.avgDensityAltitude = densityAltitudes.reduce((a, b) => a + b, 0) / densityAltitudes.length;
      } else {
        stats.maxDensityAltitude = 0;
        stats.minDensityAltitude = 0;
        stats.avgDensityAltitude = 0;
      }
    } else {
      stats.maxDensityAltitude = 0;
      stats.minDensityAltitude = 0;
      stats.avgDensityAltitude = 0;
    }

    // Remove allEntries from response to reduce payload size
    delete stats.allEntries;

    console.log('Final stats:', { ...stats, allEntries: 'removed for brevity' });

    // Cache for 15 minutes
    memoryCache.set(cacheKey, stats, CACHE_TTL.DASHBOARD_STATS);

    res.json({ ...stats, source: 'database' });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message, stack: error.stack });
  }
};

// Get paginated data with server-side filtering and sorting
export const getPaginatedData = async (req, res) => {
  try {
    console.log('getPaginatedData called with query:', req.query);
    console.log('User from auth middleware:', req.user);
    
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

    // Create cache key
    const cacheKey = `paginated_data:${JSON.stringify(req.query)}`;
    
    // Try cache first (shorter TTL for paginated data)
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached paginated data');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('Cache miss, querying database for paginated data');
    const filter = buildFilterQuery(uaSNs, locations, startDate, endDate, search);
    console.log('Paginated filter:', JSON.stringify(filter));

    // Build sort object
    const sort = {};
    sort[sortField] = sortOrder === 'desc' ? -1 : 1;

    // Convert page and limit to numbers
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    console.log('Pagination params:', { pageNum, limitNum, skip, sort });

    // Use simple find with pagination instead of aggregation for debugging
    const [data, totalCount] = await Promise.all([
      WeatherData.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .maxTimeMS(30000),
      WeatherData.countDocuments(filter).maxTimeMS(10000)
    ]);

    console.log('Query results:', { dataCount: data.length, totalCount });
    
    const result = {
      data: data || [],
      totalCount: totalCount || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((totalCount || 0) / limitNum),
      hasMore: skip + data.length < (totalCount || 0)
    };

    // Cache for 5 minutes
    memoryCache.set(cacheKey, result, CACHE_TTL.PAGINATED_DATA);

    res.json({ ...result, source: 'database' });
  } catch (error) {
    console.error('Error in getPaginatedData:', error);
    res.status(500).json({ message: 'Error fetching paginated data', error: error.message });
  }
};

// Get filter options with caching
export const getFilterOptions = async (req, res) => {
  try {
    console.log('getFilterOptions called');
    console.log('User from auth middleware:', req.user);
    
    const cacheKey = 'filter_options';
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached filter options');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('Cache miss, querying database for filter options');

    // Use simple distinct queries instead of aggregation for debugging
    const [uaSNs, locations] = await Promise.all([
      WeatherData.distinct('uaSN').maxTimeMS(10000),
      WeatherData.distinct('location').maxTimeMS(10000)
    ]);

    console.log('Filter options results:', { uaSNsCount: uaSNs.length, locationsCount: locations.length });
    
    const options = {
      uaSNs: uaSNs.filter(sn => sn && sn.trim() !== '').sort(),
      locations: locations.filter(loc => loc && loc.trim() !== '').sort()
    };

    // Cache for 30 minutes
    memoryCache.set(cacheKey, options, CACHE_TTL.FILTER_OPTIONS);

    res.json({ ...options, source: 'database' });
  } catch (error) {
    console.error('Error in getFilterOptions:', error);
    res.status(500).json({ message: 'Error fetching filter options', error: error.message });
  }
};

// Cache invalidation helper
const invalidateWeatherCaches = () => {
  const deletedCount = memoryCache.deletePattern('^(dashboard_stats|paginated_data|filter_options|chart_data):');
  console.log(`Invalidated ${deletedCount} weather cache entries`);
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
        key.startsWith('filter_options') ||
        key.startsWith('chart_data:')
      )
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cache stats', error: error.message });
  }
};

// Clear cache
export const clearCache = async (req, res) => {
  try {
    const deletedCount = memoryCache.deletePattern('^(dashboard_stats|paginated_data|filter_options|chart_data):');
    res.json({ 
      message: 'Weather cache cleared successfully', 
      deletedEntries: deletedCount 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cache', error: error.message });
  }
};

// Get all weather data entries
export const getAllEntries = async (req, res) => {
  try {
    const {
      uaSN,
      location,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 1000, // Increased default from 100 to 1000
      all = false // Parameter to fetch all records (deprecated)
    } = req.query;

    // Build filter object
    const filter = {};

    if (uaSN) {
      filter.uaSN = uaSN;
    }

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Convert page and limit to numbers and apply reasonable limits
    const pageNum = Math.max(1, parseInt(page));

    // If 'all' is requested, use a very high limit but still paginate
    let limitNum;
    if (all === 'true' || all === true || all === 'True' || all === 'TRUE') {
      limitNum = 100000; // Very high limit for "all" requests
    } else {
      limitNum = Math.min(10000, Math.max(1, parseInt(limit)));
    }

    const skip = (pageNum - 1) * limitNum;

    // Get paginated records with lean() for better performance
    const [entries, totalCount] = await Promise.all([
      WeatherData.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .maxTimeMS(60000), // 60 second timeout
      WeatherData.countDocuments(filter).maxTimeMS(5000)
    ]);

    res.json({
      data: entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
        hasMore: skip + entries.length < totalCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching weather data', error: error.message });
  }
};

// Get weather data statistics using summary collections with freshness tracking
export const getWeatherStats = async (req, res) => {
  try {
    const { uaSN, location, timeGranularity = 'daily', startDate, endDate } = req.query;
    
    // Build filter for summary collection
    const summaryFilter = {};
    if (uaSN) summaryFilter.uaSN = uaSN;
    if (location) summaryFilter.location = { $regex: location, $options: 'i' };
    if (timeGranularity) summaryFilter.timeGranularity = timeGranularity;
    
    // Add date range filter if provided
    if (startDate || endDate) {
      summaryFilter['dateRange.start'] = {};
      if (startDate) summaryFilter['dateRange.start'].$gte = new Date(startDate);
      if (endDate) summaryFilter['dateRange.end'] = { $lte: new Date(endDate) };
    }

    // Get freshness metadata
    const freshnessMetadata = await dataFreshnessTracker.getFreshnessMetadata('weather_stats', summaryFilter);
    
    // Check if we should use summary data or fall back to real-time
    const useSummaryData = freshnessMetadata.isFresh;
    
    let stats;
    
    if (useSummaryData) {
      // Use optimized summary collection
      const summaries = await WeatherStatsSummary.find(summaryFilter);
      
      if (summaries.length > 0) {
        // Aggregate summary data
        stats = summaries.reduce((acc, summary) => {
          const metrics = summary.metrics;
          
          // Aggregate temperature
          if (metrics.temperature.count > 0) {
            acc.totalTemperatureRecords += metrics.temperature.count;
            acc.tempSum += metrics.temperature.avg * metrics.temperature.count;
            acc.minTemperature = acc.minTemperature === null ? metrics.temperature.min : 
              Math.min(acc.minTemperature, metrics.temperature.min || acc.minTemperature);
            acc.maxTemperature = acc.maxTemperature === null ? metrics.temperature.max : 
              Math.max(acc.maxTemperature, metrics.temperature.max || acc.maxTemperature);
          }
          
          // Aggregate humidity
          if (metrics.humidity.count > 0) {
            acc.totalHumidityRecords += metrics.humidity.count;
            acc.humiditySum += metrics.humidity.avg * metrics.humidity.count;
          }
          
          // Aggregate pressure
          if (metrics.pressure.count > 0) {
            acc.totalPressureRecords += metrics.pressure.count;
            acc.pressureSum += metrics.pressure.avg * metrics.pressure.count;
          }
          
          // Wind metrics
          if (metrics.wind.maxWind !== null) {
            acc.maxWind = acc.maxWind === null ? metrics.wind.maxWind : 
              Math.max(acc.maxWind, metrics.wind.maxWind);
          }
          if (metrics.wind.avgWind !== null) {
            acc.windSum += metrics.wind.avgWind;
            acc.windCount++;
          }
          
          // Cloud coverage
          if (metrics.conditions.cloudCoverage.avg !== null) {
            acc.cloudSum += metrics.conditions.cloudCoverage.avg;
            acc.cloudCount++;
          }
          
          // Track unique locations and drones
          if (summary.location) acc.uniqueLocations.add(summary.location);
          if (summary.uaSN) acc.uniqueDrones.add(summary.uaSN);
          
          acc.totalRecords += summary.sourceRecordCount;
          
          return acc;
        }, {
          totalRecords: 0,
          totalTemperatureRecords: 0,
          totalHumidityRecords: 0,
          totalPressureRecords: 0,
          tempSum: 0,
          humiditySum: 0,
          pressureSum: 0,
          windSum: 0,
          windCount: 0,
          cloudSum: 0,
          cloudCount: 0,
          minTemperature: null,
          maxTemperature: null,
          maxWind: null,
          uniqueLocations: new Set(),
          uniqueDrones: new Set()
        });
        
        // Calculate final averages
        const finalStats = {
          totalRecords: stats.totalRecords,
          avgTemperature: stats.totalTemperatureRecords > 0 ? 
            Math.round((stats.tempSum / stats.totalTemperatureRecords) * 100) / 100 : 0,
          avgHumidity: stats.totalHumidityRecords > 0 ? 
            Math.round((stats.humiditySum / stats.totalHumidityRecords) * 100) / 100 : 0,
          avgPressure: stats.totalPressureRecords > 0 ? 
            Math.round((stats.pressureSum / stats.totalPressureRecords) * 100) / 100 : 0,
          avgWind: stats.windCount > 0 ? 
            Math.round((stats.windSum / stats.windCount) * 100) / 100 : 0,
          avgCloud: stats.cloudCount > 0 ? 
            Math.round((stats.cloudSum / stats.cloudCount) * 100) / 100 : 0,
          minTemperature: stats.minTemperature,
          maxTemperature: stats.maxTemperature,
          maxWind: stats.maxWind,
          uniqueLocationsCount: stats.uniqueLocations.size,
          uniqueLocations: Array.from(stats.uniqueLocations),
          uniqueDronesCount: stats.uniqueDrones.size,
          uniqueDrones: Array.from(stats.uniqueDrones)
        };
        
        res.json({
          ...finalStats,
          dataFreshness: freshnessMetadata
        });
        return;
      }
    }
    
    // Fallback to real-time aggregation
    const filter = {};
    if (uaSN) filter.uaSN = uaSN;
    if (location) filter.location = { $regex: location, $options: 'i' };
    
    // Add date filter for real-time query
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const realTimeStats = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          avgTemperature: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          avgPressure: { $avg: '$pressure' },
          avgWind: { $avg: '$amslMaxWind' },
          avgCloud: { $avg: '$cloud' },
          minTemperature: { $min: '$temperature' },
          maxTemperature: { $max: '$temperature' },
          maxWind: { $max: '$amslMaxWind' },
          uniqueLocations: { $addToSet: '$location' },
          uniqueDrones: { $addToSet: '$uaSN' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRecords: 1,
          avgTemperature: { $round: ['$avgTemperature', 2] },
          avgHumidity: { $round: ['$avgHumidity', 2] },
          avgPressure: { $round: ['$avgPressure', 2] },
          avgWind: { $round: ['$avgWind', 2] },
          avgCloud: { $round: ['$avgCloud', 2] },
          minTemperature: 1,
          maxTemperature: 1,
          maxWind: 1,
          uniqueLocationsCount: { $size: '$uniqueLocations' },
          uniqueLocations: 1,
          uniqueDronesCount: { $size: '$uniqueDrones' },
          uniqueDrones: 1
        }
      }
    ]);

    const defaultStats = {
      totalRecords: 0,
      avgTemperature: 0,
      avgHumidity: 0,
      avgPressure: 0,
      avgWind: 0,
      avgCloud: 0,
      minTemperature: 0,
      maxTemperature: 0,
      maxWind: 0,
      uniqueLocationsCount: 0,
      uniqueLocations: [],
      uniqueDronesCount: 0,
      uniqueDrones: []
    };

    res.json({
      ...(realTimeStats[0] || defaultStats),
      dataFreshness: {
        ...freshnessMetadata,
        source: 'realtime',
        lastUpdated: new Date(),
        warning: 'Using real-time data due to stale summary data'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching optimized weather stats', error: error.message });
  }
};

// Get weather data statistics (legacy method for backward compatibility)
export const getWeatherStatsLegacy = async (req, res) => {
  try {
    const { uaSN, location } = req.query;
    
    // Build filter object
    const filter = {};
    if (uaSN) filter.uaSN = uaSN;
    if (location) filter.location = { $regex: location, $options: 'i' };

    const stats = await WeatherData.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          avgTemperature: { $avg: '$temperature' },
          avgHumidity: { $avg: '$humidity' },
          avgPressure: { $avg: '$pressure' },
          avgWind: { $avg: '$amslMaxWind' },
          avgCloud: { $avg: '$cloud' },
          minTemperature: { $min: '$temperature' },
          maxTemperature: { $max: '$temperature' },
          uniqueLocations: { $addToSet: '$location' },
          uniqueDrones: { $addToSet: '$uaSN' }
        }
      },
      {
        $project: {
          _id: 0,
          totalRecords: 1,
          avgTemperature: { $round: ['$avgTemperature', 2] },
          avgHumidity: { $round: ['$avgHumidity', 2] },
          avgPressure: { $round: ['$avgPressure', 2] },
          avgWind: { $round: ['$avgWind', 2] },
          avgCloud: { $round: ['$avgCloud', 2] },
          minTemperature: 1,
          maxTemperature: 1,
          uniqueLocationsCount: { $size: '$uniqueLocations' },
          uniqueLocations: 1,
          uniqueDronesCount: { $size: '$uniqueDrones' },
          uniqueDrones: 1
        }
      }
    ]);

    res.json(stats[0] || {
      totalRecords: 0,
      avgTemperature: 0,
      avgHumidity: 0,
      avgPressure: 0,
      avgWind: 0,
      avgCloud: 0,
      minTemperature: 0,
      maxTemperature: 0,
      uniqueLocationsCount: 0,
      uniqueLocations: [],
      uniqueDronesCount: 0,
      uniqueDrones: []
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching weather stats', error: error.message });
  }
};

// Get unique locations
export const getUniqueLocations = async (req, res) => {
  try {
    const locations = await WeatherData.distinct('location');
    res.json(locations.filter(loc => loc && loc.trim()).sort());
  } catch (error) {
    res.status(500).json({ message: 'Error fetching locations', error: error.message });
  }
};

// Get single entry by ID
export const getEntryById = async (req, res) => {
  try {
    const entry = await WeatherData.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching entry', error: error.message });
  }
};

// Create new entry
export const createEntry = async (req, res) => {
  try {
    const entry = new WeatherData(req.body);
    await entry.save();
    
    // Invalidate caches
    invalidateWeatherCaches();
    
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: 'Error creating entry', error: error.message });
  }
};

// Update entry
export const updateEntry = async (req, res) => {
  try {
    const entry = await WeatherData.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Invalidate caches
    invalidateWeatherCaches();
    
    res.json(entry);
  } catch (error) {
    res.status(400).json({ message: 'Error updating entry', error: error.message });
  }
};

// Delete entry
export const deleteEntry = async (req, res) => {
  try {
    const entry = await WeatherData.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Invalidate caches
    invalidateWeatherCaches();
    
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting entry', error: error.message });
  }
};
