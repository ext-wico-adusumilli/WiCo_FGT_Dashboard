import mongoose from 'mongoose';

const jobConfigurationSchema = new mongoose.Schema({
  jobName: {
    type: String,
    required: [true, 'Job name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Job name cannot exceed 100 characters']
  },
  jobType: {
    type: String,
    required: [true, 'Job type is required'],
    enum: {
      values: ['flight_stats', 'weather_stats', 'battery_stats', 'mttf_stats'],
      message: 'Job type must be one of: flight_stats, weather_stats, battery_stats, mttf_stats'
    }
  },
  cronExpression: {
    type: String,
    required: [true, 'Cron expression is required'],
    validate: {
      validator: function(v) {
        // Basic cron expression validation (5 or 6 fields)
        const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/[0-6])( (\*|([0-9]{4})|\*\/[0-9]{4}))?$/;
        return cronRegex.test(v);
      },
      message: 'Invalid cron expression format'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastRun: {
    type: Date,
    default: null
  },
  nextRun: {
    type: Date,
    default: null
  },
  configuration: {
    timeGranularities: [{
      type: String,
      enum: {
        values: ['daily', 'weekly', 'monthly'],
        message: 'Time granularity must be one of: daily, weekly, monthly'
      }
    }],
    lookbackDays: {
      type: Number,
      default: 30,
      min: [1, 'Lookback days must be at least 1'],
      max: [365, 'Lookback days cannot exceed 365']
    },
    batchSize: {
      type: Number,
      default: 1000,
      min: [1, 'Batch size must be at least 1'],
      max: [10000, 'Batch size cannot exceed 10000']
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
jobConfigurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes for efficient querying
jobConfigurationSchema.index({ jobType: 1 });
jobConfigurationSchema.index({ isActive: 1 });
jobConfigurationSchema.index({ nextRun: 1 });

export default mongoose.model('JobConfiguration', jobConfigurationSchema);