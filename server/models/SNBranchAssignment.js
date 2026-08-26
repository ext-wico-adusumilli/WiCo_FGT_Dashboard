import mongoose from 'mongoose';

const snBranchAssignmentSchema = new mongoose.Schema({
  sn: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  branchName: {
    type: String,
    required: false, // Allow null for unassigned SNs
    trim: true,
    index: true,
    default: null
  },
  status: {
    type: String,
    enum: ['assigned', 'unassigned'],
    default: 'unassigned',
    index: true
  },
  assignedAt: {
    type: Date,
    default: null
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
snBranchAssignmentSchema.index({ status: 1, branchName: 1 });
snBranchAssignmentSchema.index({ sn: 1, status: 1 });

const SNBranchAssignment = mongoose.model('SNBranchAssignment', snBranchAssignmentSchema);

export default SNBranchAssignment;