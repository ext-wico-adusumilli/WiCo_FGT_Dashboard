import WeatherData from '../models/WeatherData.js';
import LogDetail from '../models/LogDetail.js';

// Get operation type analysis data (optimized with single aggregation pipeline)
export const getOperationTypeAnalysis = async (req, res) => {
  try {
    const { sns, startDate, endDate } = req.query;

    // Build match stages
    const weatherMatch = {};
    const logMatch = { flight: true };

    if (sns) {
      const snArray = sns.split(',').map(sn => sn.trim());
      weatherMatch.uaSN = { $in: snArray };
      logMatch.sn = { $in: snArray };
    }

    if (startDate || endDate) {
      weatherMatch.dateTime = {};
      logMatch.date = {};
      if (startDate) {
        weatherMatch.dateTime.$gte = startDate;
        logMatch.date.$gte = startDate;
      }
      if (endDate) {
        weatherMatch.dateTime.$lte = endDate;
        logMatch.date.$lte = endDate;
      }
    }

    // Single optimized aggregation pipeline
    const results = await WeatherData.aggregate([
      { $match: weatherMatch },
      { $sort: { dateTime: -1 } },
      { $limit: 20000 },
      // Lookup to join with LogDetail
      {
        $lookup: {
          from: 'logdetails',
          let: { flightLog: '$flightLog' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$key', '$$flightLog'] },
                ...logMatch
              }
            },
            {
              $project: {
                flight_time: 1,
                distance: 1,
                num_transitions: 1
              }
            }
          ],
          as: 'logDetail'
        }
      },
      // Unwind the logDetail array
      { $unwind: { path: '$logDetail', preserveNullAndEmptyArrays: false } },
      // Group by operation type
      {
        $group: {
          _id: '$operationType',
          numFlights: { $sum: 1 },
          totalDuration: { $sum: '$logDetail.flight_time' },
          totalDistance: { $sum: { $ifNull: ['$logDetail.distance', 0] } },
          totalTransitions: { $sum: { $ifNull: ['$logDetail.num_transitions', 0] } },
          durations: { $push: '$logDetail.flight_time' }
        }
      },
      // Calculate averages and format data
      {
        $project: {
          operationType: '$_id',
          numFlights: 1,
          avgDuration: {
            $round: [
              { $divide: [{ $divide: ['$totalDuration', '$numFlights'] }, 60] },
              2
            ]
          },
          totalDuration: 1,
          totalFlightHours: {
            $round: [
              { $divide: ['$totalDuration', 3600] },
              2
            ]
          },
          totalDistance: {
            $round: [
              { $divide: ['$totalDistance', 1000] },
              2
            ]
          },
          totalTransitions: 1
        }
      },
      // Sort by operation type
      {
        $sort: { operationType: 1 }
      }
    ]);

    // Ensure all operation types are present (even with 0 flights)
    const operationTypes = [
      'Automatic',
      'BVLOS / BLOS',
      'Not Labelled',
      'VLOS (Manual)',
      'VLOS Autonomous',
      'VLOS LTS'
    ];

    const resultMap = new Map(results.map(r => [r.operationType, r]));
    
    const finalResults = operationTypes.map(type => {
      const data = resultMap.get(type);
      return data || {
        operationType: type,
        numFlights: 0,
        avgDuration: 0,
        totalDuration: 0,
        totalFlightHours: 0,
        totalDistance: 0,
        totalTransitions: 0
      };
    });

    res.json(finalResults);
  } catch (error) {
    console.error('Error fetching operation type analysis:', error);
    res.status(500).json({ message: 'Error fetching operation type analysis data' });
  }
};

// Get summary statistics (optimized)
export const getOperationTypeSummary = async (req, res) => {
  try {
    const { sns, startDate, endDate } = req.query;

    const query = {};

    if (sns) {
      const snArray = sns.split(',').map(sn => sn.trim());
      query.uaSN = { $in: snArray };
    }

    if (startDate || endDate) {
      query.dateTime = {};
      if (startDate) query.dateTime.$gte = startDate;
      if (endDate) query.dateTime.$lte = endDate;
    }

    // Use aggregation for better performance
    const [stats] = await WeatherData.aggregate([
      { $match: query },
      {
        $facet: {
          total: [{ $count: 'count' }],
          vlos: [
            {
              $match: {
                operationType: { $in: ['VLOS (Manual)', 'VLOS Autonomous', 'VLOS LTS'] }
              }
            },
            { $count: 'count' }
          ],
          bvlos: [
            { $match: { operationType: 'BVLOS / BLOS' } },
            { $count: 'count' }
          ],
          uniqueSNs: [
            { $group: { _id: '$uaSN' } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    res.json({
      totalFlights: stats.total[0]?.count || 0,
      vlosFlights: stats.vlos[0]?.count || 0,
      bvlosFlights: stats.bvlos[0]?.count || 0,
      uniqueSNs: stats.uniqueSNs[0]?.count || 0
    });
  } catch (error) {
    console.error('Error fetching operation type summary:', error);
    res.status(500).json({ message: 'Error fetching operation type summary' });
  }
};
