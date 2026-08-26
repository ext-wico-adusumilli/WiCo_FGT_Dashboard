/**
 * Phase Model
 * Database model for data phases/collections in blob storage
 */

import mongoose from 'mongoose';

const phaseSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: String,
    required: true
  },
  endDate: {
    type: String,
    required: true
  },
  dataPath: {
    type: String,
    required: true
  },
  fileCount: {
    type: Number,
    default: 0
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false,
  collection: 'phases'
});

// Indexes for better query performance
phaseSchema.index({ startDate: 1, endDate: 1 });
phaseSchema.index({ isActive: 1 });
phaseSchema.index({ tags: 1 });

// Static method to find active phases
phaseSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ startDate: -1 });
};

// Static method to find phases by date range
phaseSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    isActive: true,
    $or: [
      // Phase starts within range
      { startDate: { $gte: startDate, $lte: endDate } },
      // Phase ends within range
      { endDate: { $gte: startDate, $lte: endDate } },
      // Phase encompasses the entire range
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
    ]
  }).sort({ startDate: 1 });
};

// Static method to find phases by tags
phaseSchema.statics.findByTags = function(tags) {
  return this.find({
    isActive: true,
    tags: { $in: tags }
  }).sort({ startDate: -1 });
};

const Phase = mongoose.model('Phase', phaseSchema);

export default Phase;
