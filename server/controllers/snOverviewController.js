import SNOverview from '../models/SNOverview.js';
import LogDetail from '../models/LogDetail.js';
import memoryCache from '../utils/memoryCache.js';
import { performance } from 'perf_hooks';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  DASHBOARD_STATS: 900,    // 15 minutes
  CHART_DATA: 600,         // 10 minutes
};

// Helper to build filter query
const buildFilterQuery = (sns, startDate, endDate) => {
  const filter = { flight: true }; // Only flight entries

  // SN filter
  if (sns && sns.length > 0) {
    const snArray = Array.isArray(sns) ? sns : sns.split(',').filter(Boolean);
    filter.sn = { $in: snArray };
  }

  // Date range filter
  if (startDate || endDate) {
    const dateFilter = {};
    
    if (startDate) {
      // Convert YYYY-MM-DD to YYMMDD format
      const [year, month, day] = startDate.split('-');
      const yymmdd = year.slice(-2) + month + day;
      dateFilter.$gte = yymmdd;
    }
    
    if (endDate) {
      // Convert YYYY-MM-DD to YYMMDD format
      const [year, month, day] = endDate.split('-');
      const yymmdd = year.slice(-2) + month + day;
      dateFilter.$lte = yymmdd;
    }
    
    filter.date = dateFilter;
  }

  return filter;
};

// Get dashboard stats with caching
export const getDashboardStats = async (req, res) => {
  try {
    console.log('getDashboardStats called with query:', req.query);
    
    const { sns, startDate, endDate } = req.query;
    
    // Create cache key
    const cacheKey = `sn_dashboard_stats:${JSON.stringify({ sns, startDate, endDate })}`;
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached SN dashboard stats');
      return res.json({ ...cached, source: 'cache' });
    }

    console.log('Cache miss, querying database for SN stats');
    const filter = buildFilterQuery(sns, startDate, endDate);
    console.log('Filter:', JSON.stringify(filter));

    // Aggregation pipeline
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalEntries: { $sum: 1 },
          uniqueCopters: { $addToSet: '$sn' },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' },
          maxFlightTime: { $max: '$flight_time' },
          minFlightTime: { $min: '$flight_time' },
          avgFlightTime: { $avg: '$flight_time' },
          maxDistance: { $max: '$distance' },
          minDistance: { $min: '$distance' },
          avgDistance: { $avg: '$distance' },
        }
      },
      {
        $project: {
          _id: 0,
          totalEntries: 1,
          uniqueCopters: { $size: '$uniqueCopters' },
          totalFlightTime: { $ifNull: ['$totalFlightTime', 0] },
          totalDistance: { $ifNull: ['$totalDistance', 0] },
          totalUlogFiles: '$totalEntries',
          maxFlightTime: { $ifNull: ['$maxFlightTime', 0] },
          minFlightTime: { $ifNull: ['$minFlightTime', 0] },
          avgFlightTime: { $round: [{ $ifNull: ['$avgFlightTime', 0] }, 2] },
          maxDistance: { $ifNull: ['$maxDistance', 0] },
          minDistance: { $ifNull: ['$minDistance', 0] },
          avgDistance: { $round: [{ $ifNull: ['$avgDistance', 0] }, 2] },
          snList: '$uniqueCopters',
        }
      }
    ];

    console.log('Running SN aggregation pipeline...');
    const result = await LogDetail.aggregate(pipeline);
    console.log('SN aggregation completed');
    
    const stats = result[0] || {
      totalEntries: 0,
      uniqueCopters: 0,
      totalFlightTime: 0,
      totalDistance: 0,
      totalUlogFiles: 0,
      maxFlightTime: 0,
      minFlightTime: 0,
      avgFlightTime: 0,
      maxDistance: 0,
      minDistance: 0,
      avgDistance: 0,
      snList: []
    };

    // Get unique SN list
    if (stats.totalEntries > 0) {
      const snList = await LogDetail.distinct('sn', filter);
      stats.snList = snList.sort();
    }

    // Cache the result
    memoryCache.set(cacheKey, stats, CACHE_TTL.DASHBOARD_STATS);
    console.log('SN dashboard stats cached');

    res.json({ ...stats, source: 'database' });
  } catch (error) {
    console.error('Get SN dashboard stats error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
};

// Get chart data for flight time or distance distribution
export const getChartData = async (req, res) => {
  try {
    console.log('getChartData called with query:', req.query);
    
    const { metric, sns, startDate, endDate } = req.query;
    
    if (!metric || !['flightTime', 'distance'].includes(metric)) {
      return res.status(400).json({ message: 'Invalid metric. Must be flightTime or distance' });
    }

    // Create cache key
    const cacheKey = `sn_chart_data:${metric}:${JSON.stringify({ sns, startDate, endDate })}`;
    
    // Try cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log('Returning cached SN chart data');
      return res.json({ data: cached, source: 'cache' });
    }

    console.log('Cache miss, querying database for SN chart data');
    const filter = buildFilterQuery(sns, startDate, endDate);

    // Define ranges based on metric
    let ranges = [];
    let field = '';
    
    if (metric === 'flightTime') {
      field = 'flight_time';
      // Flight time ranges in seconds (converted to hours for display)
      ranges = [
        { min: 0, max: 300, label: '0-5min' },
        { min: 300, max: 600, label: '5-10min' },
        { min: 600, max: 900, label: '10-15min' },
        { min: 900, max: 1200, label: '15-20min' },
        { min: 1200, max: 1800, label: '20-30min' },
        { min: 1800, max: 2400, label: '30-40min' },
        { min: 2400, max: 3600, label: '40-60min' },
        { min: 3600, max: 7200, label: '1-2h' },
        { min: 7200, max: Infinity, label: '2h+' }
      ];
    } else if (metric === 'distance') {
      field = 'distance';
      // Distance ranges in meters (converted to km for display)
      ranges = [
        { min: 0, max: 1000, label: '0-1km' },
        { min: 1000, max: 2000, label: '1-2km' },
        { min: 2000, max: 5000, label: '2-5km' },
        { min: 5000, max: 10000, label: '5-10km' },
        { min: 10000, max: 20000, label: '10-20km' },
        { min: 20000, max: 50000, label: '20-50km' },
        { min: 50000, max: Infinity, label: '50km+' }
      ];
    }

    // Fetch all matching entries
    const entries = await LogDetail.find(filter).select(`${field} flight_time`).lean();
    
    // Group entries into ranges and calculate flight hours
    const chartData = ranges.map(range => {
      const matchingEntries = entries.filter(entry => {
        const value = entry[field] || 0;
        return value >= range.min && value < range.max;
      });
      
      // Sum flight hours for this range
      const totalSeconds = matchingEntries.reduce((sum, entry) => sum + (entry.flight_time || 0), 0);
      const hours = totalSeconds / 3600;
      
      return {
        range: range.label,
        hours: parseFloat(hours.toFixed(4)),
        count: matchingEntries.length,
        min: range.min,
        max: range.max === Infinity ? 999999999 : range.max
      };
    }).filter(item => item.hours > 0); // Only include ranges with data

    // Cache the result
    memoryCache.set(cacheKey, chartData, CACHE_TTL.CHART_DATA);
    console.log(`SN chart data cached for ${metric}`);

    res.json({ data: chartData, source: 'database' });
  } catch (error) {
    console.error('Get SN chart data error:', error);
    res.status(500).json({ message: 'Server error fetching chart data' });
  }
};

// Get ALL chart data for preloading - OPTIMIZED BULK ENDPOINT
export const getAllChartData = async (req, res) => {
  const requestStartTime = performance.now();
  try {
    console.log('=== SN OVERVIEW BULK CHART DATA REQUEST START ===');
    console.log('⏱️ Request timestamp:', new Date().toISOString());
    console.log('📊 Query params:', req.query);
    
    const { sns, startDate, endDate } = req.query;
    
    // Create cache key for bulk data
    const cacheKey = `sn_bulk_chart_data:${JSON.stringify({ sns, startDate, endDate })}`;
    console.log('🔑 Cache key:', cacheKey);
    
    // Try cache first
    const cacheCheckStart = performance.now();
    const cached = memoryCache.get(cacheKey);
    const cacheCheckTime = Math.round(performance.now() - cacheCheckStart);
    
    if (cached) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`✅ CACHE HIT! Returning cached bulk chart data in ${totalTime}ms (cache check: ${cacheCheckTime}ms)`);
      return res.json({ data: cached, source: 'cache' });
    }

    console.log(`❌ Cache miss (check took ${cacheCheckTime}ms), generating bulk chart data`);
    
    const filterBuildStart = performance.now();
    const filter = buildFilterQuery(sns, startDate, endDate);
    const filterBuildTime = Math.round(performance.now() - filterBuildStart);
    
    console.log(`🔍 Filter built in ${filterBuildTime}ms:`, JSON.stringify(filter, null, 2));

    // Fetch all log entries at once
    console.log('🔄 Fetching all log entries...');
    const startFetchTime = performance.now();
    
    const logEntries = await LogDetail.find(filter).lean();
    
    const endFetchTime = performance.now();
    const fetchTime = Math.round(endFetchTime - startFetchTime);
    console.log(`⚡ Data fetch completed in ${fetchTime}ms`);
    console.log('📊 Data summary:', {
      logEntries: logEntries.length,
      sampleEntry: logEntries[0] ? {
        sn: logEntries[0].sn,
        flight_time: logEntries[0].flight_time,
        distance: logEntries[0].distance
      } : null
    });
    
    if (logEntries.length === 0) {
      const totalTime = Math.round(performance.now() - requestStartTime);
      console.log(`⚠️ No log entries found, returning empty data in ${totalTime}ms`);
      const emptyBulkData = {};
      memoryCache.set(cacheKey, emptyBulkData, CACHE_TTL.CHART_DATA);
      return res.json({ data: emptyBulkData, source: 'database' });
    }
    
    // Define all metrics to process
    const metrics = ['flightTime', 'distance'];
    console.log('📈 Processing metrics:', metrics);
    
    // PARALLEL PROCESSING: Process all metrics simultaneously
    const metricsProcessStart = performance.now();
    const metricPromises = metrics.map(async (metric) => {
      const metricStart = performance.now();
      console.log(`🔄 Processing ${metric} chart data...`);
      
      // Define ranges based on metric
      let ranges = [];
      
      if (metric === 'flightTime') {
        // Flight time ranges in seconds
        ranges = [
          { min: 0, max: 300, label: '0-5min' },
          { min: 300, max: 600, label: '5-10min' },
          { min: 600, max: 900, label: '10-15min' },
          { min: 900, max: 1200, label: '15-20min' },
          { min: 1200, max: 1800, label: '20-30min' },
          { min: 1800, max: 2400, label: '30-40min' },
          { min: 2400, max: 3600, label: '40-60min' },
          { min: 3600, max: 7200, label: '1-2h' },
          { min: 7200, max: Infinity, label: '2h+' }
        ];
      } else if (metric === 'distance') {
        // Distance ranges in meters
        ranges = [
          { min: 0, max: 1000, label: '0-1km' },
          { min: 1000, max: 2000, label: '1-2km' },
          { min: 2000, max: 5000, label: '2-5km' },
          { min: 5000, max: 10000, label: '5-10km' },
          { min: 10000, max: 20000, label: '10-20km' },
          { min: 20000, max: 50000, label: '20-50km' },
          { min: 50000, max: Infinity, label: '50km+' }
        ];
      }

      console.log(`📊 ${metric}: processing ${ranges.length} ranges`);

      // PARALLEL RANGE PROCESSING: Process all ranges simultaneously
      const rangePromises = ranges.map(async (range) => {
        let totalHours = 0;
        let entryCount = 0;
        
        // Process all log entries for this range
        logEntries.forEach(entry => {
          const value = metric === 'flightTime' ? entry.flight_time : entry.distance || 0;
          
          if (value >= range.min && value < range.max) {
            const flightHours = entry.flight_time / 3600; // Convert seconds to hours
            totalHours += flightHours;
            entryCount++;
          }
        });
        
        return {
          range: range.label,
          hours: parseFloat(totalHours.toFixed(4)),
          count: entryCount,
          min: range.min,
          max: range.max === Infinity ? 999999999 : range.max
        };
      });
      
      // Wait for all ranges to be processed
      const rangeData = await Promise.all(rangePromises);
      
      // Filter out ranges with no data
      const validRanges = rangeData.filter(range => range.hours > 0);
      
      const metricTime = Math.round(performance.now() - metricStart);
      console.log(`✅ ${metric}: completed in ${metricTime}ms with ${validRanges.length} ranges`);
      
      return { metric, data: validRanges };
    });
    
    // Wait for all metrics to be processed
    const metricResults = await Promise.all(metricPromises);
    const metricsProcessTime = Math.round(performance.now() - metricsProcessStart);
    console.log(`⚡ All metrics processed in ${metricsProcessTime}ms`);
    
    // Convert to object format
    const bulkData = {};
    metricResults.forEach(result => {
      bulkData[result.metric] = result.data;
    });
    
    // Cache for 30 minutes
    memoryCache.set(cacheKey, bulkData, CACHE_TTL.CHART_DATA);
    
    const totalTime = Math.round(performance.now() - requestStartTime);
    console.log(`✅ BULK CHART DATA COMPLETE in ${totalTime}ms`);
    console.log('📊 Final data summary:', Object.keys(bulkData).map(key => `${key}: ${bulkData[key].length} ranges`));
    
    res.json({ data: bulkData, source: 'database' });
  } catch (error) {
    const totalTime = Math.round(performance.now() - requestStartTime);
    console.error(`❌ ERROR in getAllChartData after ${totalTime}ms:`, error);
    res.status(500).json({ message: 'Error fetching bulk chart data', error: error.message });
  }
};

// Get all SN overview entries
export const getAllEntries = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    
    // Convert page and limit to numbers and apply reasonable limits
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit))); // Max 1000 records per request
    const skip = (pageNum - 1) * limitNum;

    // Get paginated records
    const [entries, totalCount] = await Promise.all([
      SNOverview.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      SNOverview.countDocuments()
    ]);
    
    res.json({
      data: entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ message: 'Server error fetching entries' });
  }
};

// Create new entry
export const createEntry = async (req, res) => {
  try {
    const { sn, ulogFiles, totalFlightTime, lastUsage } = req.body;

    // Validate required fields
    if (!sn || !ulogFiles || !totalFlightTime || !lastUsage) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate time format
    const timeRegex = /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/;
    if (!timeRegex.test(totalFlightTime)) {
      return res.status(400).json({ message: 'Total flight time must be in HH:MM:SS format' });
    }

    // Create new entry
    const entry = new SNOverview({
      sn,
      ulogFiles,
      totalFlightTime,
      lastUsage: new Date(lastUsage)
    });

    await entry.save();

    res.status(201).json({
      message: 'Entry created successfully',
      entry
    });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ message: 'Server error creating entry' });
  }
};

// Update entry
export const updateEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const { sn, ulogFiles, totalFlightTime, lastUsage } = req.body;

    const entry = await SNOverview.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    // Update fields
    if (sn) entry.sn = sn;
    if (ulogFiles) entry.ulogFiles = ulogFiles;
    if (totalFlightTime) {
      const timeRegex = /^[0-9]{2}:[0-9]{2}:[0-9]{2}$/;
      if (!timeRegex.test(totalFlightTime)) {
        return res.status(400).json({ message: 'Total flight time must be in HH:MM:SS format' });
      }
      entry.totalFlightTime = totalFlightTime;
    }
    if (lastUsage) entry.lastUsage = new Date(lastUsage);

    await entry.save();

    res.json({
      message: 'Entry updated successfully',
      entry
    });
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ message: 'Server error updating entry' });
  }
};

// Delete entry
export const deleteEntry = async (req, res) => {
  try {
    const { entryId } = req.params;

    const entry = await SNOverview.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    await SNOverview.findByIdAndDelete(entryId);

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ message: 'Server error deleting entry' });
  }
};
