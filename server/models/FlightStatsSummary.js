import mongoose from 'mongoose';
import BaseSummaryCollection from './BaseSummaryCollection.js';

const flightStatsSummarySchema = new mongoose.Schema({
  serialNumber: { type: String, required: true },
  metrics: {
    totalFlights: { type: Number, default: 0 },
    totalFlightTime: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    avgFlightTime: { type: Number, default: 0 },
    avgDistance: { type: Number, default: 0 },
    batteryMetrics: {
      totalCycles: { type: Number, default: 0 },
      avgTemperature: { type: Number, default: 0 },
      peakTemperature: { type: Number, default: 0 },
      battery0Cycles: { type: Number, default: 0 },
      battery1Cycles: { type: Number, default: 0 },
      battery0MaxTemp: { type: Number, default: 0 },
      battery1MaxTemp: { type: Number, default: 0 }
    },
    transitionMetrics: {
      fwdTransitions: { type: Number, default: 0 },
      bwdTransitions: { type: Number, default: 0 },
      fwdDistance: { type: Number, default: 0 },
      bwdDistance: { type: Number, default: 0 },
      totalTransitions: { type: Number, default: 0 }
    },
    connectivityMetrics: {
      lteLoss: { type: Number, default: 0 },
      rthLoss: { type: Number, default: 0 },
      rthLogs: { type: Number, default: 0 },
      avgLteLoss: { type: Number, default: 0 }
    },
    flightModeMetrics: {
      mcTime: { type: Number, default: 0 },
      fwTime: { type: Number, default: 0 },
      filteredFlightTime: { type: Number, default: 0 }
    }
  }
});

// Pre-save hook to sync serialNumber to entityId (required by BaseSummaryCollection)
flightStatsSummarySchema.pre('save', function(next) {
  this.entityId = this.serialNumber;
  next();
});

// Indexes optimized for dashboard queries
flightStatsSummarySchema.index({ serialNumber: 1, 'dateRange.start': 1, 'dateRange.end': 1 });
flightStatsSummarySchema.index({ serialNumber: 1, timeGranularity: 1, lastUpdated: -1 });
flightStatsSummarySchema.index({ 'metrics.totalFlights': -1 });
flightStatsSummarySchema.index({ 'metrics.totalFlightTime': -1 });

const FlightStatsSummary = BaseSummaryCollection.discriminator('flight_stats', flightStatsSummarySchema);

export default FlightStatsSummary;