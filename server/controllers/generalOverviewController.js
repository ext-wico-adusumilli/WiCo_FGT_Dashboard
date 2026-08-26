import LogDetail from '../models/LogDetail.js';
import logger from '../config/logger.js';

/**
 * Get aggregated SN Overview data
 * Returns aggregated statistics per SN
 */
export const getSNOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build match stage for date filtering
    const matchStage = { flight: true };
    
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) {
        // Convert YYYY-MM-DD to YYMMDD format
        const [year, month, day] = startDate.split('-');
        matchStage.date.$gte = `${year.slice(2)}${month}${day}`;
      }
      if (endDate) {
        const [year, month, day] = endDate.split('-');
        matchStage.date.$lte = `${year.slice(2)}${month}${day}`;
      }
    }

    // Aggregate by SN
    const aggregatedData = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$sn',
          ulogFiles: { $sum: 1 },
          totalFlightTime: { $sum: '$flight_time' },
          totalDistance: { $sum: '$distance' },
          lastUsage: { $max: '$date' }
        }
      },
      {
        $project: {
          _id: 0,
          sn: '$_id',
          ulogFiles: 1,
          totalFlightTime: 1,
          totalDistance: 1,
          lastUsage: 1
        }
      },
      { $sort: { sn: 1 } }
    ]);

    res.json(aggregatedData);
  } catch (error) {
    logger.error('Error fetching SN overview:', error);
    res.status(500).json({ error: 'Failed to fetch SN overview data' });
  }
};

/**
 * Get aggregated Battery Overview data
 * Returns aggregated statistics per battery SN
 * Optimized with MongoDB aggregation pipeline
 */
export const getBatteryOverview = async (req, res) => {
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

    // Use aggregation pipeline for both battery_0 and battery_1
    const battery0Data = await LogDetail.aggregate([
      { $match: { ...matchStage, battery_0_sn: { $exists: true, $ne: '', $ne: null } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$battery_0_sn',
          recentCycleCount: { $first: '$battery_0_cycle' },
          totalFlightTime: { $sum: '$flight_time' },
          lastUsage: { $first: '$date' },
          lastUaSN: { $first: '$sn' },
          flights: { $sum: 1 },
          maxCycleCount: { $max: '$battery_0_cycle' },
          maxTemp: { $max: '$battery_0_max_temp' }
        }
      },
      {
        $project: {
          _id: 0,
          batterySN: '$_id',
          recentCycleCount: 1,
          totalFlightTime: 1,
          lastUsage: 1,
          lastUaSN: 1,
          flights: 1,
          maxCycleCount: 1,
          maxTemp: 1
        }
      }
    ]);

    const battery1Data = await LogDetail.aggregate([
      { $match: { ...matchStage, battery_1_sn: { $exists: true, $ne: '', $ne: null } } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$battery_1_sn',
          recentCycleCount: { $first: '$battery_1_cycle' },
          totalFlightTime: { $sum: '$flight_time' },
          lastUsage: { $first: '$date' },
          lastUaSN: { $first: '$sn' },
          flights: { $sum: 1 },
          maxCycleCount: { $max: '$battery_1_cycle' },
          maxTemp: { $max: '$battery_1_max_temp' }
        }
      },
      {
        $project: {
          _id: 0,
          batterySN: '$_id',
          recentCycleCount: 1,
          totalFlightTime: 1,
          lastUsage: 1,
          lastUaSN: 1,
          flights: 1,
          maxCycleCount: 1,
          maxTemp: 1
        }
      }
    ]);

    // Merge battery_0 and battery_1 data
    const batteryMap = new Map();
    
    [...battery0Data, ...battery1Data].forEach(battery => {
      if (batteryMap.has(battery.batterySN)) {
        const existing = batteryMap.get(battery.batterySN);
        const isNewer = battery.lastUsage > existing.lastUsage;
        
        batteryMap.set(battery.batterySN, {
          batterySN: battery.batterySN,
          recentCycleCount: isNewer ? battery.recentCycleCount : existing.recentCycleCount,
          totalFlightTime: existing.totalFlightTime + battery.totalFlightTime,
          lastUsage: isNewer ? battery.lastUsage : existing.lastUsage,
          lastUaSN: isNewer ? battery.lastUaSN : existing.lastUaSN,
          flights: existing.flights + battery.flights,
          maxCycleCount: Math.max(existing.maxCycleCount, battery.maxCycleCount),
          maxTemp: Math.max(existing.maxTemp, battery.maxTemp)
        });
      } else {
        batteryMap.set(battery.batterySN, battery);
      }
    });
    
    const aggregatedData = Array.from(batteryMap.values()).sort((a, b) => 
      a.batterySN.localeCompare(b.batterySN)
    );

    res.json(aggregatedData);
  } catch (error) {
    logger.error('Error fetching battery overview:', error);
    res.status(500).json({ error: 'Failed to fetch battery overview data' });
  }
};

/**
 * Get aggregated FC Version Overview data
 * Returns aggregated statistics per FC version
 */
export const getFCVersionOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = { 
      flight: true,
      fc_version: { $exists: true, $ne: '', $ne: null }
    };
    
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

    // Aggregate by FC version
    const aggregatedData = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$fc_version',
          totalFlightTime: { $sum: '$flight_time' },
          oldestLogDate: { $min: '$date' },
          newestLogDate: { $max: '$date' },
          newestEntry: { $last: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          fcVersion: '$_id',
          totalFlightTime: 1,
          oldestLogDate: 1,
          newestLogDate: 1,
          newestSN: '$newestEntry.sn',
          newestLogFile: '$newestEntry.key'
        }
      },
      { $sort: { fcVersion: 1 } }
    ]);

    res.json(aggregatedData);
  } catch (error) {
    logger.error('Error fetching FC version overview:', error);
    res.status(500).json({ error: 'Failed to fetch FC version overview data' });
  }
};

/**
 * Get aggregated CS Version Overview data
 * Returns aggregated statistics per CS version
 */
export const getCSVersionOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = { 
      flight: true,
      cs_version: { $exists: true, $ne: '', $ne: null }
    };
    
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

    // Aggregate by CS version
    const aggregatedData = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$cs_version',
          totalFlightTime: { $sum: '$flight_time' },
          oldestLogDate: { $min: '$date' },
          newestLogDate: { $max: '$date' },
          newestEntry: { $last: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          csVersion: '$_id',
          totalFlightTime: 1,
          oldestLogDate: 1,
          newestLogDate: 1,
          newestSN: '$newestEntry.sn',
          newestLogFile: '$newestEntry.key'
        }
      },
      { $sort: { csVersion: 1 } }
    ]);

    res.json(aggregatedData);
  } catch (error) {
    logger.error('Error fetching CS version overview:', error);
    res.status(500).json({ error: 'Failed to fetch CS version overview data' });
  }
};

/**
 * Get FC Version Dashboard Stats
 * Returns aggregated statistics for dashboard cards
 */
export const getFCVersionDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = { 
      flight: true,
      fc_version: { $exists: true, $ne: '', $ne: null }
    };
    
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

    // Get aggregated stats
    const stats = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          uniqueFCVersions: { $addToSet: '$fc_version' },
          totalFlightTime: { $sum: '$flight_time' }
        }
      },
      {
        $project: {
          _id: 0,
          uniqueFCVersions: { $size: '$uniqueFCVersions' },
          totalFlightTime: 1
        }
      }
    ]);

    res.json(stats[0] || { uniqueFCVersions: 0, totalFlightTime: 0 });
  } catch (error) {
    logger.error('Error fetching FC version dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch FC version dashboard stats' });
  }
};

/**
 * Get CS Version Dashboard Stats
 * Returns aggregated statistics for dashboard cards
 */
export const getCSVersionDashboardStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = { 
      flight: true,
      cs_version: { $exists: true, $ne: '', $ne: null }
    };
    
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

    // Get aggregated stats
    const stats = await LogDetail.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          uniqueCSVersions: { $addToSet: '$cs_version' },
          totalFlightTime: { $sum: '$flight_time' }
        }
      },
      {
        $project: {
          _id: 0,
          uniqueCSVersions: { $size: '$uniqueCSVersions' },
          totalFlightTime: 1
        }
      }
    ]);

    res.json(stats[0] || { uniqueCSVersions: 0, totalFlightTime: 0 });
  } catch (error) {
    logger.error('Error fetching CS version dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch CS version dashboard stats' });
  }
};
