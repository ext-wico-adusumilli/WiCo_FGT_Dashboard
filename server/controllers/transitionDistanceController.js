import TransitionDistance from '../models/TransitionDistance.js';
import LogDetail from '../models/LogDetail.js';
import SNBranchAssignment from '../models/SNBranchAssignment.js';

// Utility function to normalize serial numbers
function normalizeSerialNumber(sn) {
  if (!sn || typeof sn !== 'string') {
    return sn;
  }

  const trimmed = sn.trim();
  
  // If it's a 2-digit number, pad with leading zero
  if (/^\d{2}$/.test(trimmed)) {
    return `0${trimmed}`;
  }

  return trimmed;
}

// Get all transition distance entries (calculated from log details grouped by branch)
// Optimized with MongoDB aggregation pipeline
export const getAllEntries = async (req, res) => {
  try {
    console.log('Fetching transition distance data...');
    
    // Get date range parameters
    const { startDate, endDate } = req.query;
    console.log('Date range:', { startDate, endDate });
    
    // Get all SN-Branch assignments
    const assignments = await SNBranchAssignment.find().lean();
    console.log(`Found ${assignments.length} SN-Branch assignments`);
    
    // Create a map of normalized SN to branch
    const snToBranch = new Map();
    assignments.forEach(assignment => {
      const normalizedSN = normalizeSerialNumber(assignment.sn);
      snToBranch.set(normalizedSN, assignment.branchName);
    });
    
    // Helper function to convert YYYY-MM-DD to YYMMDD format
    const convertDateToDBFormat = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };
    
    // Build match stage for date filtering
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) {
        const dbStartDate = convertDateToDBFormat(startDate);
        if (dbStartDate) {
          matchStage.date.$gte = dbStartDate;
        }
      }
      if (endDate) {
        const dbEndDate = convertDateToDBFormat(endDate);
        if (dbEndDate) {
          matchStage.date.$lte = dbEndDate;
        }
      }
    }
    
    console.log('Date match stage:', matchStage);
    
    // Use aggregation pipeline to get only necessary fields
    const aggregationPipeline = [
      { $match: matchStage },
      {
        $project: {
          sn: 1,
          fwd_distance: 1,
          bwd_distance: 1,
          fwd_transitions: 1,
          bwd_transitions: 1
        }
      }
    ];
    
    const logDetails = await LogDetail.aggregate(aggregationPipeline);
    console.log(`Found ${logDetails.length} log details${startDate || endDate ? ' (filtered by date)' : ''}`);
    
    // Group log details by branch
    const branchData = new Map();
    let processedLogs = 0;
    let matchedLogs = 0;
    
    logDetails.forEach(log => {
      processedLogs++;
      const normalizedSN = normalizeSerialNumber(log.sn);
      const branch = snToBranch.get(normalizedSN);
      
      if (branch) {
        matchedLogs++;
        if (!branchData.has(branch)) {
          branchData.set(branch, {
            forwardDistances: [],
            backwardDistances: [],
            totalForward: 0,
            totalBackward: 0
          });
        }
        
        const data = branchData.get(branch);
        
        // Add forward distance if available with filtering logic
        if (log.fwd_distance && log.fwd_distance > 100 && log.fwd_distance <= 1000) {
          data.forwardDistances.push(log.fwd_distance);
        }
        
        // Add backward distance if available with filtering logic
        if (log.bwd_distance && log.bwd_distance > 100 && log.bwd_distance <= 1000) {
          data.backwardDistances.push(log.bwd_distance);
        }
        
        // Add transition counts
        if (log.fwd_transitions) {
          data.totalForward += log.fwd_transitions;
        }
        
        if (log.bwd_transitions) {
          data.totalBackward += log.bwd_transitions;
        }
      }
    });
    
    console.log(`Processed ${processedLogs} logs, matched ${matchedLogs} to branches`);
    console.log(`Found ${branchData.size} branches with data`);
    
    // Ensure all branches are represented (Malawi, Spain, Germany)
    const allBranches = ['Malawi', 'Spain', 'Germany'];
    
    // Calculate statistics for each branch
    const results = [];
    
    for (const branchName of allBranches) {
      const data = branchData.get(branchName) || {
        forwardDistances: [],
        backwardDistances: [],
        totalForward: 0,
        totalBackward: 0
      };
      
      const forwardStats = data.forwardDistances.length > 0 ? {
        min: Math.min(...data.forwardDistances),
        mean: data.forwardDistances.reduce((sum, val) => sum + val, 0) / data.forwardDistances.length,
        max: Math.max(...data.forwardDistances)
      } : { min: null, mean: null, max: null };
      
      const backwardStats = data.backwardDistances.length > 0 ? {
        min: Math.min(...data.backwardDistances),
        mean: data.backwardDistances.reduce((sum, val) => sum + val, 0) / data.backwardDistances.length,
        max: Math.max(...data.backwardDistances)
      } : { min: null, mean: null, max: null };
      
      const result = {
        _id: branchName,
        branch: branchName,
        forwardMin: forwardStats.min,
        forwardMean: forwardStats.mean,
        forwardMax: forwardStats.max,
        backwardMin: backwardStats.min,
        backwardMean: backwardStats.mean,
        backwardMax: backwardStats.max,
        totalForward: data.totalForward,
        totalBackward: data.totalBackward
      };
      
      results.push(result);
    }
    
    console.log(`Returning ${results.length} branch results`);
    res.json(results);
  } catch (error) {
    console.error('Error calculating transition distance data:', error);
    res.status(500).json({ message: 'Error fetching transition distance data', error: error.message });
  }
};

// Get single entry by ID
export const getEntryById = async (req, res) => {
  try {
    const entry = await TransitionDistance.findById(req.params.id);
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
    const entry = new TransitionDistance(req.body);
    await entry.save();
    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: 'Error creating entry', error: error.message });
  }
};

// Update entry
export const updateEntry = async (req, res) => {
  try {
    const entry = await TransitionDistance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(400).json({ message: 'Error updating entry', error: error.message });
  }
};

// Delete entry
export const deleteEntry = async (req, res) => {
  try {
    const entry = await TransitionDistance.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting entry', error: error.message });
  }
};

// Test endpoint to check data availability
export const testData = async (req, res) => {
  try {
    const assignments = await SNBranchAssignment.find();
    const logDetails = await LogDetail.find();
    
    const assignmentCount = assignments.length;
    const logDetailCount = logDetails.length;
    
    // Sample some data
    const sampleAssignments = assignments.slice(0, 3).map(a => ({
      sn: a.sn,
      normalizedSN: normalizeSerialNumber(a.sn),
      branch: a.branchName
    }));
    
    const sampleLogs = logDetails.slice(0, 3).map(l => ({
      sn: l.sn,
      normalizedSN: normalizeSerialNumber(l.sn),
      fwd_distance: l.fwd_distance,
      bwd_distance: l.bwd_distance,
      fwd_transitions: l.fwd_transitions,
      bwd_transitions: l.bwd_transitions
    }));
    
    res.json({
      assignmentCount,
      logDetailCount,
      sampleAssignments,
      sampleLogs
    });
  } catch (error) {
    console.error('Error in test data:', error);
    res.status(500).json({ error: error.message });
  }
};
