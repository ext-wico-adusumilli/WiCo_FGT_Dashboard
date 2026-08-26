import mongoose from 'mongoose';

const batteryOverviewSchema = new mongoose.Schema({
  batterySN: {
    type: String,
    required: [true, 'Battery SN is required'],
    trim: true
  },
  flights: {
    type: Number,
    required: [true, 'Flights count is required'],
    min: [0, 'Flights must be a positive number']
  },
  cycleCount: {
    type: Number,
    required: [true, 'Cycle count is required'],
    min: [0, 'Cycle count must be a positive number']
  },
  peakTemperature: {
    type: Number,
    required: [true, 'Peak temperature is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('BatteryOverview', batteryOverviewSchema);
