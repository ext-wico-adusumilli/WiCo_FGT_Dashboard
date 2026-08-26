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

// Get all SN-Branch assignments (including unassigned)
const getAllAssignments = async (req, res) => {
  try {
    const { status, branchName } = req.query;
    
    let filter = {};
    if (status) {
      filter.status = status;
    }
    if (branchName) {
      filter.branchName = branchName;
    }
    
    const assignments = await SNBranchAssignment.find(filter)
      .sort({ status: -1, branchName: 1, sn: 1 }); // assigned first, then by branch and SN
    
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching SN-Branch assignments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create new SN entry (assigned or unassigned)
const createAssignment = async (req, res) => {
  try {
    const { sn, branchName } = req.body;

    if (!sn) {
      return res.status(400).json({ message: 'SN is required' });
    }

    const normalizedSN = normalizeSerialNumber(sn);

    // Check if SN already exists
    const existingAssignment = await SNBranchAssignment.findOne({ sn: normalizedSN });

    if (existingAssignment) {
      // If it exists and we're trying to assign it
      if (branchName && existingAssignment.status === 'unassigned') {
        existingAssignment.branchName = branchName.trim();
        existingAssignment.status = 'assigned';
        existingAssignment.assignedAt = new Date();
        existingAssignment.lastSeen = new Date();
        
        const updatedAssignment = await existingAssignment.save();
        return res.json(updatedAssignment);
      } else if (branchName && existingAssignment.status === 'assigned') {
        return res.status(400).json({ message: 'SN is already assigned to a branch' });
      } else {
        // Just update lastSeen for unassigned
        existingAssignment.lastSeen = new Date();
        const updatedAssignment = await existingAssignment.save();
        return res.json(updatedAssignment);
      }
    }

    // Create new entry
    const assignment = new SNBranchAssignment({
      sn: normalizedSN,
      branchName: branchName ? branchName.trim() : null,
      status: branchName ? 'assigned' : 'unassigned',
      assignedAt: branchName ? new Date() : null,
      lastSeen: new Date()
    });

    const savedAssignment = await assignment.save();
    
    res.status(201).json(savedAssignment);
  } catch (error) {
    console.error('Error creating SN-Branch assignment:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'SN already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update SN-Branch assignment
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { sn, branchName } = req.body;

    if (!sn) {
      return res.status(400).json({ message: 'SN is required' });
    }

    const normalizedSN = normalizeSerialNumber(sn);

    // Check if another assignment exists with the same SN (excluding current one)
    const existingAssignment = await SNBranchAssignment.findOne({ 
      sn: normalizedSN, 
      _id: { $ne: id } 
    });

    if (existingAssignment) {
      return res.status(400).json({ message: 'SN is already assigned to another entry' });
    }

    const updateData = {
      sn: normalizedSN,
      lastSeen: new Date()
    };

    if (branchName) {
      updateData.branchName = branchName.trim();
      updateData.status = 'assigned';
      updateData.assignedAt = new Date();
    } else {
      updateData.branchName = null;
      updateData.status = 'unassigned';
      updateData.assignedAt = null;
    }

    const updatedAssignment = await SNBranchAssignment.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedAssignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating SN-Branch assignment:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'SN is already assigned to another entry' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete SN entry
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedAssignment = await SNBranchAssignment.findByIdAndDelete(id);

    if (!deletedAssignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json({ message: 'SN entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting SN entry:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get assignment by SN
const getAssignmentBySN = async (req, res) => {
  try {
    const { sn } = req.params;
    const normalizedSN = normalizeSerialNumber(sn);

    const assignment = await SNBranchAssignment.findOne({ sn: normalizedSN });

    if (!assignment) {
      return res.status(404).json({ message: 'SN not found' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error fetching assignment by SN:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get all assignments by branch
const getAssignmentsByBranch = async (req, res) => {
  try {
    const { branchName } = req.params;

    const assignments = await SNBranchAssignment.find({ 
      branchName,
      status: 'assigned'
    }).sort({ sn: 1 });

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments by branch:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Bulk upsert SNs (create unassigned entries for new SNs, update lastSeen for existing)
const bulkUpsertSNs = async (req, res) => {
  try {
    const { serialNumbers } = req.body;

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({ message: 'Serial numbers array is required' });
    }

    const normalizedSNs = serialNumbers.map(sn => normalizeSerialNumber(sn)).filter(Boolean);
    
    if (normalizedSNs.length === 0) {
      return res.status(400).json({ message: 'No valid serial numbers provided' });
    }

    const bulkOps = normalizedSNs.map(sn => ({
      updateOne: {
        filter: { sn },
        update: {
          $set: { lastSeen: new Date() },
          $setOnInsert: {
            sn,
            branchName: null,
            status: 'unassigned',
            assignedAt: null
          }
        },
        upsert: true
      }
    }));

    const result = await SNBranchAssignment.bulkWrite(bulkOps);
    
    res.json({
      message: 'SNs processed successfully',
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    });
  } catch (error) {
    console.error('Error bulk upserting SNs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get statistics
const getStatistics = async (req, res) => {
  try {
    const stats = await SNBranchAssignment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const branchStats = await SNBranchAssignment.aggregate([
      {
        $match: { status: 'assigned' }
      },
      {
        $group: {
          _id: '$branchName',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalSNs = await SNBranchAssignment.countDocuments();
    const assignedSNs = stats.find(s => s._id === 'assigned')?.count || 0;
    const unassignedSNs = stats.find(s => s._id === 'unassigned')?.count || 0;

    res.json({
      totalSNs,
      assignedSNs,
      unassignedSNs,
      branchBreakdown: branchStats.map(b => ({
        branchName: b._id,
        count: b.count
      }))
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export {
  getAllAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAssignmentBySN,
  getAssignmentsByBranch,
  bulkUpsertSNs,
  getStatistics
};