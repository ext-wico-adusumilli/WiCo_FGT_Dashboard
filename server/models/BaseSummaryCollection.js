import mongoose from 'mongoose';

const baseSummarySchema = new mongoose.Schema({
  aggregationType: { 
    type: String, 
    required: true,
    enum: ['flight_stats', 'weather_stats', 'battery_stats', 'mttf_stats']
  },
  timeGranularity: { 
    type: String, 
    required: true,
    enum: ['daily', 'weekly', 'monthly'] 
  },
  dateRange: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  entityId: { type: String, required: true }, // serialNumber, location, etc.
  lastUpdated: { type: Date, default: Date.now },
  sourceRecordCount: { type: Number, required: true },
  executionId: { type: String, required: true }
}, {
  timestamps: true,
  discriminatorKey: 'aggregationType'
});

// Base indexes for time-based and entity-based queries
baseSummarySchema.index({ 'dateRange.start': 1, 'dateRange.end': 1 });
baseSummarySchema.index({ entityId: 1, 'dateRange.start': 1 });
baseSummarySchema.index({ aggregationType: 1, timeGranularity: 1, lastUpdated: 1 });
baseSummarySchema.index({ executionId: 1 });

export default mongoose.model('BaseSummaryCollection', baseSummarySchema);