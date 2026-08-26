import mongoose from 'mongoose';

/**
 * JobExecutionLog Model
 * 
 * NOTE: As of the optimization update, only FAILED and CANCELLED job executions
 * are saved to the database to reduce storage usage. Successful executions are
 * logged to the console/logger only.
 * 
 * This means queries will primarily return error logs for troubleshooting purposes.
 */

const jobExecutionLogSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: [true, 'Job name is required'],
    trim: true,
    maxlength: [100, 'Job name cannot exceed 100 characters']
  },
  executionId: {
    type: String,
    required: [true, 'Execution ID is required'],
    unique: true,
    trim: true
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required'],
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['running', 'completed', 'failed', 'cancelled'],
      message: 'Status must be one of: running, completed, failed, cancelled'
    },
    default: 'running'
  },
  recordsProcessed: {
    type: Number,
    default: 0,
    min: [0, 'Records processed cannot be negative']
  },
  recordsCreated: {
    type: Number,
    default: 0,
    min: [0, 'Records created cannot be negative']
  },
  recordsUpdated: {
    type: Number,
    default: 0,
    min: [0, 'Records updated cannot be negative']
  },
  errorMessage: {
    type: String,
    default: null,
    maxlength: [1000, 'Error message cannot exceed 1000 characters']
  },
  metrics: {
    processingTimeMs: {
      type: Number,
      default: null,
      min: [0, 'Processing time cannot be negative']
    },
    memoryUsageMB: {
      type: Number,
      default: null,
      min: [0, 'Memory usage cannot be negative']
    },
    cpuUsagePercent: {
      type: Number,
      default: null,
      min: [0, 'CPU usage cannot be negative'],
      max: [100, 'CPU usage cannot exceed 100%']
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate processing time when endTime is set
jobExecutionLogSchema.pre('save', function(next) {
  if (this.endTime && this.startTime && !this.metrics.processingTimeMs) {
    this.metrics.processingTimeMs = this.endTime.getTime() - this.startTime.getTime();
  }
  next();
});

// Create indexes for efficient querying by job name and execution time
jobExecutionLogSchema.index({ jobName: 1, startTime: -1 });
jobExecutionLogSchema.index({ status: 1 });
jobExecutionLogSchema.index({ startTime: -1 });
jobExecutionLogSchema.index({ endTime: -1 });

// Compound index for querying job execution history
jobExecutionLogSchema.index({ jobName: 1, status: 1, startTime: -1 });

export default mongoose.model('JobExecutionLog', jobExecutionLogSchema);