import mongoose from 'mongoose';

const logDetailSchema = new mongoose.Schema({
  key: { type: String, required: true },
  sn: { type: String, required: true },
  date: { type: String, required: true },
  total_time: { type: Number, default: 0 },
  flight_time: { type: Number, default: 0 },
  filtered_flight_time: { type: Number, default: 0 },
  mc_time: { type: Number, default: 0 },
  fw_time: { type: Number, default: 0 },
  fc_version: { type: String, default: '' },
  cs_version: { type: String, default: '' },
  fwd_transitions: { type: Number, default: 0 },
  bwd_transitions: { type: Number, default: 0 },
  lte_loss: { type: Number, default: 0 },
  rth_loss: { type: Number, default: 0 },
  rth_logs: { type: Number, default: 0 },
  distance: { type: Number, default: 0 },
  fwd_distance: { type: Number, default: 0 },
  bwd_distance: { type: Number, default: 0 },
  max_mc_xy_deviation: { type: Number, default: 0 },
  max_mc_altitude_deviation: { type: Number, default: 0 },
  max_fw_xy_deviation: { type: Number, default: null },
  max_fw_altitude_deviation: { type: Number, default: null },
  battery_0_sn: { type: String, default: '' },
  battery_0_cycle: { type: Number, default: 0 },
  battery_0_max_temp: { type: Number, default: 0 },
  battery_0_remaining: { type: Number, default: 0 },
  battery_1_sn: { type: String, default: '' },
  battery_1_cycle: { type: Number, default: 0 },
  battery_1_max_temp: { type: Number, default: 0 },
  battery_1_remaining: { type: Number, default: 0 },
  calculated_groundspeed: { type: Number, default: 0 },
  last_usage: { type: String, default: '' },
  flight: { type: Boolean, default: false },
  // Payload fields
  payload_description: { type: String, default: '' },
  payload_weight: { type: Number, default: 0 },
  flight_mode: { type: String, enum: ['VLOS', 'BVLOS', ''], default: '' }
}, {
  timestamps: true
});

// Indexes for faster queries
logDetailSchema.index({ sn: 1, date: 1 });
logDetailSchema.index({ key: 1 });
logDetailSchema.index({ flight: 1 }); // For filtering flight entries
logDetailSchema.index({ date: 1 }); // For date range queries
logDetailSchema.index({ sn: 1, flight: 1 }); // Compound index for common filters
logDetailSchema.index({ date: 1, flight: 1 }); // For date + flight filtering
logDetailSchema.index({ battery_0_sn: 1, date: -1 }); // For battery overview queries
logDetailSchema.index({ battery_1_sn: 1, date: -1 }); // For battery overview queries
logDetailSchema.index({ sn: 1, fwd_distance: 1, bwd_distance: 1 }); // For transition distance queries

export default mongoose.model('LogDetail', logDetailSchema);
