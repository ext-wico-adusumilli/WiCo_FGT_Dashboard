import LogDetail from '../models/LogDetail.js';
import FlightStatsSummary from '../models/FlightStatsSummary.js';
import dataFreshnessTracker from '../utils/dataFreshnessTracker.js';

// Get all log details
export const getAllLogDetails = async (req, res) => {
  try {
    const {
      sn,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 1000, // Increased default from 100 to 1000 for better UX
      all = false, // Parameter to fetch all records (deprecated, use high limit instead)
      flight = null // Parameter to filter by flight status
    } = req.query;

    // Helper function to convert YYYY-MM-DD to YYMMDD format
    const convertDateToDBFormat = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };

    // Build filter object
    const filter = {};

    if (sn) {
      const snArray = sn.split(',').map(s => s.trim()).filter(Boolean);
      filter.sn = snArray.length === 1 ? snArray[0] : { $in: snArray };
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const dbStartDate = convertDateToDBFormat(startDate);
        if (dbStartDate) {
          filter.date.$gte = dbStartDate;
        }
      }
      if (endDate) {
        const dbEndDate = convertDateToDBFormat(endDate);
        if (dbEndDate) {
          filter.date.$lte = dbEndDate;
        }
      }
    }

    // Filter by flight status if specified
    if (flight !== null) {
      filter.flight = flight === 'true';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Convert page and limit to numbers and apply reasonable limits
    const pageNum = Math.max(1, parseInt(page));

    // If 'all' is requested, use a very high limit but still paginate
    let limitNum;
    if (all === 'true' || all === true) {
      limitNum = 100000; // Very high limit for "all" requests, but still capped
    } else {
      limitNum = Math.min(10000, Math.max(1, parseInt(limit)));
    }

    const skip = (pageNum - 1) * limitNum;

    // Get paginated records with lean() for better performance
    // Use parallel queries for count and data
    const [logDetails, totalCount] = await Promise.all([
      LogDetail.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean() // Returns plain JS objects, much faster
        .maxTimeMS(60000), // 60 second timeout
      LogDetail.countDocuments(filter).maxTimeMS(5000) // 5 second timeout for count
    ]);

    res.json({
      data: logDetails,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
        hasMore: skip + logDetails.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching log details:', error);
    res.status(500).json({ message: 'Error fetching log details', error: error.message });
  }
};

// Get log details statistics using summary collections with freshness tracking
export const getLogDetailsStats = async (req, res) => {
  try {
    const { sn, startDate, endDate, timeGranularity = 'daily' } = req.query;
    
    // Build filter for summary collection
    const summaryFilter = {};
    if (sn) summaryFilter.serialNumber = sn;
    if (timeGranularity) summaryFilter.timeGranularity = timeGranularity;
    
    // Add date range filter if provided
    if (startDate || endDate) {
      summaryFilter['dateRange.start'] = {};
      if (startDate) summaryFilter['dateRange.start'].$gte = new Date(startDate);
      if (endDate) summaryFilter['dateRange.end'] = { $lte: new Date(endDate) };
    }

    // Get freshness metadata
    const freshnessMetadata = await dataFreshnessTracker.getFreshnessMetadata('flight_stats', summaryFilter);
    
    // Check if we should use summary data or fall back to real-time
    const useSummaryData = freshnessMetadata.isFresh;
    
    let stats;
    
    if (useSummaryData) {
      // Use optimized summary collection
      const summaries = await FlightStatsSummary.find(summaryFilter);
      
      if (summaries.length > 0) {
        // Aggregate summary data
        const aggregatedStats = summaries.reduce((acc, summary) => {
          const metrics = summary.metrics;
          
          acc.totalFlights += metrics.totalFlights || 0;
          acc.totalFlightTime += metrics.totalFlightTime || 0;
          acc.totalDistance += metrics.totalDistance || 0;
          
          // Track for average calculations
          acc.flightTimeSum += (metrics.avgFlightTime || 0) * (metrics.totalFlights || 0);
          acc.distanceSum += (metrics.avgDistance || 0) * (metrics.totalFlights || 0);
          acc.flightCount += metrics.totalFlights || 0;
          
          // Track unique drones
          if (summary.serialNumber) {
            acc.uniqueDrones.add(summary.serialNumber);
          }
          
          return acc;
        }, {
          totalFlights: 0,
          totalFlightTime: 0,
          totalDistance: 0,
          flightTimeSum: 0,
          distanceSum: 0,
          flightCount: 0,
          uniqueDrones: new Set()
        });
        
        // Calculate final averages
        stats = {
          totalFlights: aggregatedStats.totalFlights,
          totalFlightTime: Math.round(aggregatedStats.totalFlightTime * 100) / 100,
          totalDistance: Math.round(aggregatedStats.totalDistance * 100) / 100,
          avgFlightTime: aggregatedStats.flightCount > 0 ? 
            Math.round((aggregatedStats.flightTimeSum / aggregatedStats.flightCount) * 100) / 100 : 0,
          avgDistance: aggregatedStats.flightCount > 0 ? 
            Math.round((aggregatedStats.distanceSum / aggregatedStats.flightCount) * 100) / 100 : 0,
          uniqueDronesCount: aggregatedStats.uniqueDrones.size,
          uniqueDrones: Array.from(aggregatedStats.uniqueDrones)
        };
        
        res.json({
          ...stats,
          dataFreshness: freshnessMetadata
        });
        return;
      }
    }
    
    // Fallback to real-time aggregation
    // Helper function to convert YYYY-MM-DD to YYMMDD format
    const convertDateToDBFormat = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    const filter = {};
    if (sn) filter.sn = sn;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        const dbStartDate = convertDateToDBFormat(startDate);
        if (dbStartDate) {
          filter.date.$gte = dbStartDate;
        }
      }
      if (endDate) {
        const dbEndDate = convertDateToDBFormat(endDate);
        if (dbEndDate) {
          filter.date.$lte = dbEndDate;
        }
      }
    }

    const realTimeStats = await LogDetail.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalFlights: { $sum: 1 },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' },
          avgFlightTime: { $avg: '$flight_time' },
          avgDistance: { $avg: '$distance' },
          uniqueDrones: { $addToSet: '$sn' }
        }
      },
      {
        $project: {
          _id: 0,
          totalFlights: 1,
          totalFlightTime: 1,
          totalDistance: 1,
          avgFlightTime: { $round: ['$avgFlightTime', 2] },
          avgDistance: { $round: ['$avgDistance', 2] },
          uniqueDronesCount: { $size: '$uniqueDrones' },
          uniqueDrones: 1
        }
      }
    ]);

    const defaultStats = {
      totalFlights: 0,
      totalFlightTime: 0,
      totalDistance: 0,
      avgFlightTime: 0,
      avgDistance: 0,
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
    console.error('Error fetching log details stats:', error);
    res.status(500).json({ message: 'Error fetching log details stats', error: error.message });
  }
};

// Get unique serial numbers
export const getUniqueSerialNumbers = async (req, res) => {
  try {
    const serialNumbers = await LogDetail.distinct('sn');
    res.json(serialNumbers.sort());
  } catch (error) {
    console.error('Error fetching serial numbers:', error);
    res.status(500).json({ message: 'Error fetching serial numbers', error: error.message });
  }
};

// Get log detail by ID
export const getLogDetailById = async (req, res) => {
  try {
    const logDetail = await LogDetail.findById(req.params.id);
    if (!logDetail) {
      return res.status(404).json({ message: 'Log detail not found' });
    }
    res.json(logDetail);
  } catch (error) {
    console.error('Error fetching log detail:', error);
    res.status(500).json({ message: 'Error fetching log detail', error: error.message });
  }
};

// Create new log detail
export const createLogDetail = async (req, res) => {
  try {
    const logDetail = new LogDetail(req.body);
    await logDetail.save();
    res.status(201).json(logDetail);
  } catch (error) {
    console.error('Error creating log detail:', error);
    res.status(400).json({ message: 'Error creating log detail', error: error.message });
  }
};

// Update log detail
export const updateLogDetail = async (req, res) => {
  try {
    const logDetail = await LogDetail.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!logDetail) {
      return res.status(404).json({ message: 'Log detail not found' });
    }
    res.json(logDetail);
  } catch (error) {
    console.error('Error updating log detail:', error);
    res.status(400).json({ message: 'Error updating log detail', error: error.message });
  }
};

// Delete log detail
export const deleteLogDetail = async (req, res) => {
  try {
    const logDetail = await LogDetail.findByIdAndDelete(req.params.id);
    if (!logDetail) {
      return res.status(404).json({ message: 'Log detail not found' });
    }
    res.json({ message: 'Log detail deleted successfully' });
  } catch (error) {
    console.error('Error deleting log detail:', error);
    res.status(500).json({ message: 'Error deleting log detail', error: error.message });
  }
};

// Bulk create log details
export const bulkCreateLogDetails = async (req, res) => {
  try {
    const logDetails = await LogDetail.insertMany(req.body);
    res.status(201).json({ 
      message: `${logDetails.length} log details created successfully`,
      data: logDetails 
    });
  } catch (error) {
    console.error('Error bulk creating log details:', error);
    res.status(400).json({ message: 'Error bulk creating log details', error: error.message });
  }
};

/**
 * Get Log Details Dashboard Stats
 * Returns aggregated statistics for dashboard cards
 */
export const getLogDetailsDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate, sns } = req.query;
    
    const matchStage = { flight: true };
    
    // Date filtering
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) {
        const [year, month, day] = startDate.split('-');
        matchStage.date.$gte = `${year.slice(2)}${month}${day}`;
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-');
        matchStage.date.$lte = `${year.slice(2)}${month}${day}`;
      }
    }
    
    // SN filtering
    if (sns) {
      const snArray = sns.split(',');
      matchStage.sn = { $in: snArray };
    }

    // Get aggregated stats
    const stats = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalFlights: { $sum: 1 },
          uniqueSNs: { $addToSet: '$sn' },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' },
          totalTransitions: { $sum: { $add: ['$fwd_transitions', '$bwd_transitions'] } },
          flightTimes: { $push: '$flight_time' },
          distances: { $push: '$distance' }
        }
      },
      {
        $project: {
          _id: 0,
          totalFlights: 1,
          uniqueSNs: { $size: '$uniqueSNs' },
          totalFlightTime: 1,
          totalDistance: 1,
          totalTransitions: 1,
          minFlightTime: { $min: '$flightTimes' },
          maxFlightTime: { $max: '$flightTimes' },
          minDistance: { $min: '$distances' },
          maxDistance: { $max: '$distances' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalFlights: 0,
      uniqueSNs: 0,
      totalFlightTime: 0,
      totalDistance: 0,
      totalTransitions: 0,
      minFlightTime: 0,
      maxFlightTime: 0,
      minDistance: 0,
      maxDistance: 0
    });
  } catch (error) {
    console.error('Error fetching log details dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch log details dashboard stats' });
  }
};
