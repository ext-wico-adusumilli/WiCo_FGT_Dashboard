import LogDetail from '../models/LogDetail.js';
import logger from '../config/logger.js';

/**
 * Get LTE Connectivity Dashboard Statistics (optimized)
 * Returns aggregated statistics matching original calculation logic
 */
export const getLTEConnectivityDashboardStats = async (req, res) => {
  const startTime = Date.now();
  try {
    const { startDate, endDate, sn } = req.query;
    
    const matchStage = { flight: true };
    
    // SN filter
    if (sn) {
      const snArray = Array.isArray(sn) ? sn : sn.split(',').filter(Boolean);
      matchStage.sn = { $in: snArray };
    }
    
    // Date filter
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

    logger.info(`[LTE Dashboard Stats] Starting query with filters: ${JSON.stringify(matchStage)}`);

    // Fetch only necessary fields
    const logDetails = await LogDetail.find(matchStage)
      .select('sn lte_loss')
      .lean();
    
    const fetchTime = Date.now();
    logger.info(`[LTE Dashboard Stats] Fetched ${logDetails.length} records in ${fetchTime - startTime}ms`);
    
    // Calculate stats using same logic as original
    const totalFlights = logDetails.length;
    const uniqueDrones = new Set(logDetails.map(e => e.sn)).size;
    
    let totalPingTimeAbove0 = 0;
    let totalPingTimeAbove1 = 0;
    let totalPingTime2_5to5 = 0;
    let totalPingTime5to10 = 0;
    let totalPingTimeAbove10 = 0;
    
    let minPingTimeAbove0 = Infinity;
    let maxPingTimeAbove0 = 0;
    let minPingTimeAbove1 = Infinity;
    let maxPingTimeAbove1 = 0;
    let minPingTime2_5to5 = Infinity;
    let maxPingTime2_5to5 = 0;
    let minPingTime5to10 = Infinity;
    let maxPingTime5to10 = 0;
    let minPingTimeAbove10 = Infinity;
    let maxPingTimeAbove10 = 0;
    
    let flightsWithNoLoss = 0;
    
    // Process each entry with same logic as original
    logDetails.forEach(entry => {
      const lteLoss = entry.lte_loss || 0;
      
      let ping_time_above_0 = 0;
      let ping_time_above_1 = 0;
      let ping_time_2_5_to_5 = 0;
      let ping_time_5_to_10 = 0;
      let ping_time_above_10 = 0;
      
      if (lteLoss > 0) {
        ping_time_above_0 = lteLoss + Math.floor(Math.random() * 5);
        ping_time_above_1 = Math.floor(ping_time_above_0 * 0.8);
        
        if (lteLoss <= 3) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.7);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
        } else if (lteLoss <= 8) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.5);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
          ping_time_above_10 = Math.floor(lteLoss * 0.2);
        } else {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.3);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.4);
          ping_time_above_10 = Math.floor(lteLoss * 0.3);
        }
      } else {
        flightsWithNoLoss++;
      }
      
      // Accumulate totals
      totalPingTimeAbove0 += ping_time_above_0;
      totalPingTimeAbove1 += ping_time_above_1;
      totalPingTime2_5to5 += ping_time_2_5_to_5;
      totalPingTime5to10 += ping_time_5_to_10;
      totalPingTimeAbove10 += ping_time_above_10;
      
      // Track min/max
      if (ping_time_above_0 > 0) {
        minPingTimeAbove0 = Math.min(minPingTimeAbove0, ping_time_above_0);
        maxPingTimeAbove0 = Math.max(maxPingTimeAbove0, ping_time_above_0);
      }
      if (ping_time_above_1 > 0) {
        minPingTimeAbove1 = Math.min(minPingTimeAbove1, ping_time_above_1);
        maxPingTimeAbove1 = Math.max(maxPingTimeAbove1, ping_time_above_1);
      }
      if (ping_time_2_5_to_5 > 0) {
        minPingTime2_5to5 = Math.min(minPingTime2_5to5, ping_time_2_5_to_5);
        maxPingTime2_5to5 = Math.max(maxPingTime2_5to5, ping_time_2_5_to_5);
      }
      if (ping_time_5_to_10 > 0) {
        minPingTime5to10 = Math.min(minPingTime5to10, ping_time_5_to_10);
        maxPingTime5to10 = Math.max(maxPingTime5to10, ping_time_5_to_10);
      }
      if (ping_time_above_10 > 0) {
        minPingTimeAbove10 = Math.min(minPingTimeAbove10, ping_time_above_10);
        maxPingTimeAbove10 = Math.max(maxPingTimeAbove10, ping_time_above_10);
      }
    });
    
    const connectivityReliability = totalFlights > 0 ? (flightsWithNoLoss / totalFlights) * 100 : 0;
    
    const result = {
      totalFlights,
      uniqueDrones,
      connectivityReliability,
      excellentConnectivity: flightsWithNoLoss,
      // Ping time statistics
      totalPingTimeAbove0,
      totalPingTimeAbove1,
      totalPingTime2_5to5,
      totalPingTime5to10,
      totalPingTimeAbove10,
      avgPingTimeAbove0: totalFlights > 0 ? totalPingTimeAbove0 / totalFlights : 0,
      avgPingTimeAbove1: totalFlights > 0 ? totalPingTimeAbove1 / totalFlights : 0,
      avgPingTime2_5to5: totalFlights > 0 ? totalPingTime2_5to5 / totalFlights : 0,
      avgPingTime5to10: totalFlights > 0 ? totalPingTime5to10 / totalFlights : 0,
      avgPingTimeAbove10: totalFlights > 0 ? totalPingTimeAbove10 / totalFlights : 0,
      // Min/max (handle Infinity case)
      minPingTimeAbove0: minPingTimeAbove0 === Infinity ? 0 : minPingTimeAbove0,
      maxPingTimeAbove0,
      minPingTimeAbove1: minPingTimeAbove1 === Infinity ? 0 : minPingTimeAbove1,
      maxPingTimeAbove1,
      minPingTime2_5to5: minPingTime2_5to5 === Infinity ? 0 : minPingTime2_5to5,
      maxPingTime2_5to5,
      minPingTime5to10: minPingTime5to10 === Infinity ? 0 : minPingTime5to10,
      maxPingTime5to10,
      minPingTimeAbove10: minPingTimeAbove10 === Infinity ? 0 : minPingTimeAbove10,
      maxPingTimeAbove10
    };

    logger.info(`[LTE Dashboard Stats] Total request time: ${Date.now() - startTime}ms`);

    res.json(result);
  } catch (error) {
    logger.error('Error fetching LTE connectivity dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch LTE connectivity dashboard stats' });
  }
};

/**
 * Get LTE Connectivity Paginated Data (optimized)
 * Returns paginated data for table display
 */
export const getLTEConnectivityPaginated = async (req, res) => {
  const startTime = Date.now();
  try {
    const { 
      startDate, 
      endDate, 
      sn,
      page = 1,
      limit = 200,
      sortField = 'date',
      sortOrder = 'desc'
    } = req.query;
    
    const matchStage = { flight: true };
    
    // SN filter
    if (sn) {
      const snArray = Array.isArray(sn) ? sn : sn.split(',').filter(Boolean);
      if (snArray.length > 0) {
        matchStage.sn = { $in: snArray };
      }
    }
    
    // Date filter
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

    logger.info(`[LTE Paginated] Query filters: ${JSON.stringify(matchStage)}, page: ${page}, limit: ${limit}`);

    // Get total count for pagination
    const totalCount = await LogDetail.countDocuments(matchStage);
    
    // Build sort object
    const sort = {};
    sort[sortField] = sortOrder === 'desc' ? -1 : 1;
    
    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Aggregation pipeline with pagination
    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: sort },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          key: 1,
          sn: 1,
          date: 1,
          flight_time: 1,
          distance: 1,
          lte_loss: 1,
          rth_loss: 1,
          rth_logs: 1,
          flight: 1
        }
      }
    ];
    
    const logDetails = await LogDetail.aggregate(aggregationPipeline);
    const aggregationTime = Date.now();
    logger.info(`[LTE Paginated] Aggregation completed in ${aggregationTime - startTime}ms, found ${logDetails.length} records`);
    
    // Transform to LTE analysis format with simulated ping time data
    const lteAnalysisData = logDetails.map(entry => {
      const lteLoss = entry.lte_loss || 0;
      
      // Simulate ping time categories based on LTE loss patterns
      let ping_time_above_0 = 0;
      let ping_time_above_1 = 0;
      let ping_time_2_5_to_5 = 0;
      let ping_time_5_to_10 = 0;
      let ping_time_above_10 = 0;
      
      if (lteLoss > 0) {
        ping_time_above_0 = lteLoss + Math.floor(Math.random() * 5);
        ping_time_above_1 = Math.floor(ping_time_above_0 * 0.8);
        
        if (lteLoss <= 3) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.7);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
        } else if (lteLoss <= 8) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.5);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
          ping_time_above_10 = Math.floor(lteLoss * 0.2);
        } else {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.3);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.4);
          ping_time_above_10 = Math.floor(lteLoss * 0.3);
        }
      }
      
      const total_ping_events = ping_time_2_5_to_5 + ping_time_5_to_10 + ping_time_above_10;
      
      // Calculate connectivity score (0-100)
      let connectivity_score = 100;
      if (ping_time_above_0 > 0) {
        connectivity_score = Math.max(0, 100 - (ping_time_above_0 * 2 + ping_time_above_1 * 3 + ping_time_2_5_to_5 * 5 + ping_time_5_to_10 * 10 + ping_time_above_10 * 20));
      }
      
      return {
        _id: entry._id,
        key: entry.key,
        sn: entry.sn,
        date: entry.date,
        flight_time: entry.flight_time,
        distance: entry.distance,
        ping_time_above_0,
        ping_time_above_1,
        ping_time_2_5_to_5,
        ping_time_5_to_10,
        ping_time_above_10,
        total_ping_events,
        connectivity_score,
        flight: entry.flight,
        lte_loss: entry.lte_loss,
        rth_loss: entry.rth_loss,
        rth_logs: entry.rth_logs
      };
    });

    const transformTime = Date.now();
    logger.info(`[LTE Paginated] Data transformation completed in ${transformTime - aggregationTime}ms`);
    logger.info(`[LTE Paginated] Total request time: ${transformTime - startTime}ms`);

    res.json({
      data: lteAnalysisData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching LTE connectivity paginated data:', error);
    res.status(500).json({ error: 'Failed to fetch LTE connectivity paginated data' });
  }
};

/**
 * Get LTE Connectivity Overview data (optimized with aggregation)
 * Returns aggregated LTE analysis data - DEPRECATED, use paginated endpoint
 */
export const getLTEConnectivityOverview = async (req, res) => {
  const startTime = Date.now();
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = { flight: true };
    
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

    logger.info(`[LTE Optimized] Starting query with filters: ${JSON.stringify(matchStage)}`);

    // Use aggregation pipeline to get only necessary fields
    const aggregationPipeline = [
      { $match: matchStage },
      {
        $project: {
          _id: 1,
          key: 1,
          sn: 1,
          date: 1,
          flight_time: 1,
          distance: 1,
          lte_loss: 1,
          rth_loss: 1,
          rth_logs: 1,
          flight: 1
        }
      },
      { $sort: { date: -1 } }
    ];
    
    const logDetails = await LogDetail.aggregate(aggregationPipeline);
    const aggregationTime = Date.now();
    logger.info(`[LTE Optimized] Aggregation completed in ${aggregationTime - startTime}ms, found ${logDetails.length} records`);
    
    // Transform to LTE analysis format with simulated ping time data
    const lteAnalysisData = logDetails.map(entry => {
      const lteLoss = entry.lte_loss || 0;
      
      // Simulate ping time categories based on LTE loss patterns
      let ping_time_above_0 = 0;
      let ping_time_above_1 = 0;
      let ping_time_2_5_to_5 = 0;
      let ping_time_5_to_10 = 0;
      let ping_time_above_10 = 0;
      
      if (lteLoss > 0) {
        ping_time_above_0 = lteLoss + Math.floor(Math.random() * 5);
        ping_time_above_1 = Math.floor(ping_time_above_0 * 0.8);
        
        if (lteLoss <= 3) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.7);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
        } else if (lteLoss <= 8) {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.5);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.3);
          ping_time_above_10 = Math.floor(lteLoss * 0.2);
        } else {
          ping_time_2_5_to_5 = Math.floor(lteLoss * 0.3);
          ping_time_5_to_10 = Math.floor(lteLoss * 0.4);
          ping_time_above_10 = Math.floor(lteLoss * 0.3);
        }
      }
      
      const total_ping_events = ping_time_2_5_to_5 + ping_time_5_to_10 + ping_time_above_10;
      
      // Calculate connectivity score (0-100)
      let connectivity_score = 100;
      if (ping_time_above_0 > 0) {
        connectivity_score = Math.max(0, 100 - (ping_time_above_0 * 2 + ping_time_above_1 * 3 + ping_time_2_5_to_5 * 5 + ping_time_5_to_10 * 10 + ping_time_above_10 * 20));
      }
      
      return {
        _id: entry._id,
        key: entry.key,
        sn: entry.sn,
        date: entry.date,
        flight_time: entry.flight_time,
        distance: entry.distance,
        ping_time_above_0,
        ping_time_above_1,
        ping_time_2_5_to_5,
        ping_time_5_to_10,
        ping_time_above_10,
        total_ping_events,
        connectivity_score,
        flight: entry.flight,
        lte_loss: entry.lte_loss,
        rth_loss: entry.rth_loss,
        rth_logs: entry.rth_logs
      };
    });

    const transformTime = Date.now();
    logger.info(`[LTE Optimized] Data transformation completed in ${transformTime - aggregationTime}ms`);
    logger.info(`[LTE Optimized] Total request time: ${transformTime - startTime}ms`);

    res.json(lteAnalysisData);
  } catch (error) {
    logger.error('Error fetching LTE connectivity overview:', error);
    res.status(500).json({ error: 'Failed to fetch LTE connectivity overview data' });
  }
};

/**
 * Get LTE Connectivity Summary Statistics
 */
export const getLTEConnectivitySummary = async (req, res) => {
  try {
    const { sn, startDate, endDate } = req.query;
    
    const matchStage = { flight: true };
    
    if (sn) {
      matchStage.sn = sn;
    }
    
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
    
    const summary = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalFlights: { $sum: 1 },
          uniqueDrones: { $addToSet: '$sn' },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' },
          totalLTELoss: { $sum: '$lte_loss' },
          flightsWithNoLoss: {
            $sum: {
              $cond: [{ $eq: ['$lte_loss', 0] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalFlights: 1,
          uniqueDrones: { $size: '$uniqueDrones' },
          totalFlightTime: 1,
          totalDistance: 1,
          avgLTELoss: {
            $cond: [
              { $gt: ['$totalFlights', 0] },
              { $divide: ['$totalLTELoss', '$totalFlights'] },
              0
            ]
          },
          connectivityReliability: {
            $cond: [
              { $gt: ['$totalFlights', 0] },
              { $multiply: [{ $divide: ['$flightsWithNoLoss', '$totalFlights'] }, 100] },
              0
            ]
          }
        }
      }
    ]);
    
    res.json(summary[0] || {
      totalFlights: 0,
      uniqueDrones: 0,
      totalFlightTime: 0,
      totalDistance: 0,
      avgLTELoss: 0,
      connectivityReliability: 0
    });
  } catch (error) {
    logger.error('Error fetching LTE connectivity summary:', error);
    res.status(500).json({ error: 'Failed to fetch LTE connectivity summary' });
  }
};

/**
 * Get LTE Connectivity Trends
 */
export const getLTEConnectivityTrends = async (req, res) => {
  try {
    const { sn, startDate, endDate } = req.query;
    
    const matchStage = { flight: true };
    
    if (sn) {
      matchStage.sn = sn;
    }
    
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
    
    const trends = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$date',
          flights: { $sum: 1 },
          totalLTELoss: { $sum: '$lte_loss' },
          totalRTHLoss: { $sum: '$rth_loss' },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          flights: 1,
          avgLTELoss: {
            $cond: [
              { $gt: ['$flights', 0] },
              { $divide: ['$totalLTELoss', '$flights'] },
              0
            ]
          },
          avgRTHLoss: {
            $cond: [
              { $gt: ['$flights', 0] },
              { $divide: ['$totalRTHLoss', '$flights'] },
              0
            ]
          },
          totalFlightTime: 1,
          totalDistance: 1,
          connectivityScore: {
            $cond: [
              { $gt: ['$flights', 0] },
              {
                $max: [
                  0,
                  {
                    $subtract: [
                      100,
                      { $multiply: [{ $divide: ['$totalLTELoss', '$flights'] }, 10] }
                    ]
                  }
                ]
              },
              100
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    res.json(trends);
  } catch (error) {
    logger.error('Error fetching LTE connectivity trends:', error);
    res.status(500).json({ error: 'Failed to fetch LTE connectivity trends' });
  }
};
