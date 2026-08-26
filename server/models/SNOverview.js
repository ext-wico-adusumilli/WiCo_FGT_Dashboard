import mongoose from 'mongoose';

const snOverviewSchema = new mongoose.Schema({
  sn: {
    type: String,
    required: [true, 'SN is required'],
    trim: true
  },
  ulogFiles: {
    type: String,
    required: [true, 'ULOG files are required'],
    trim: true
  },
  totalFlightTime: {
    type: String,
    required: [true, 'Total flight time is required'],
    match: [/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/, 'Flight time must be in HH:MM:SS format']
  },
  lastUsage: {
    type: Date,
    required: [true, 'Last usage date is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('SNOverview', snOverviewSchema);
