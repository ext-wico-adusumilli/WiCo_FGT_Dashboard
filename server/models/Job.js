/**
 * Job Model
 * Database model for Airflow analysis jobs
 */

import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  jobId: {
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
  scriptId: {
    type: String,
    required: true
  },
  scriptName: {
    type: String,
    required: true
  },
  startDate: {
    type: String,
    required: true
  },
  endDate: {
    type: String,
    required: true
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['created', 'scheduled', 'running', 'completed', 'failed', 'cancelled', 'paused'],
    default: 'created',
    index: true
  },
  scheduledAt: {
    type: String
  },
  createdAt: {
    type: String,
    required: true,
    default: () => new Date().toISOString()
  },
  startedAt: {
    type: String
  },
  completedAt: {
    type: String
  },
  duration: {
    type: Number // Duration in seconds
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  logUrl: {
    type: String
  },
  createdBy: {
    type: String,
    required: true,
    index: true
  },
  dagId: {
    type: String
  },
  dagRunId: {
    type: String
  },
  errorMessage: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: false, // We're managing timestamps manually
  collection: 'jobs'
});

// Indexes for better query performance
jobSchema.index({ createdBy: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ scriptId: 1, createdAt: -1 });
jobSchema.index({ dagId: 1, dagRunId: 1 });

// Virtual for calculating duration if not set
jobSchema.virtual('calculatedDuration').get(function() {
  if (this.duration) {
    return this.duration;
  }
  
  if (this.startedAt && this.completedAt) {
    const start = new Date(this.startedAt);
    const end = new Date(this.completedAt);
    return Math.floor((end - start) / 1000); // Duration in seconds
  }
  
  return null;
});

// Method to update job status with timestamp
jobSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  switch (newStatus) {
    case 'running':
      if (!this.startedAt) {
        this.startedAt = new Date().toISOString();
      }
      break;
    case 'completed':
    case 'failed':
    case 'cancelled':
      if (!this.completedAt) {
        this.completedAt = new Date().toISOString();
      }
      if (this.startedAt && !this.duration) {
        const start = new Date(this.startedAt);
        const end = new Date(this.completedAt);
        this.duration = Math.floor((end - start) / 1000);
      }
      break;
  }
  
  return this.save();
};

// Method to check if job can be retried
jobSchema.methods.canRetry = function() {
  return this.status === 'failed' && this.retryCount < this.maxRetries;
};

// Static method to find jobs by user
jobSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { createdBy: userId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find active jobs
jobSchema.statics.findActive = function() {
  return this.find({ 
    status: { $in: ['created', 'scheduled', 'running'] } 
  }).sort({ createdAt: -1 });
};

// Static method to get job statistics with enhanced metrics
jobSchema.statics.getStatistics = async function(userId = null, timeRange = null) {
  const matchStage = {};
  
  if (userId) {
    matchStage.createdBy = userId;
  }
  
  if (timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = null;
    }
    
    if (startDate) {
      matchStage.createdAt = { $gte: startDate.toISOString() };
    }
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
        totalDuration: { $sum: '$duration' }
      }
    }
  ]);
  
  const result = {
    total: 0,
    created: 0,
    scheduled: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    paused: 0,
    avgDuration: 0,
    totalDuration: 0,
    successRate: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    if (stat.avgDuration) {
      result.totalDuration += stat.totalDuration || 0;
    }
  });
  
  // Calculate success rate
  const completedJobs = result.completed;
  const totalFinishedJobs = result.completed + result.failed + result.cancelled;
  result.successRate = totalFinishedJobs > 0 ? Math.round((completedJobs / totalFinishedJobs) * 100) : 0;
  
  // Calculate average duration for completed jobs
  if (result.completed > 0) {
    const completedStat = stats.find(s => s._id === 'completed');
    result.avgDuration = completedStat ? Math.round(completedStat.avgDuration) : 0;
  }
  
  return result;
};

const Job = mongoose.model('Job', jobSchema);

export default Job;