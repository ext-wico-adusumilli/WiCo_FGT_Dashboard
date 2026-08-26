import mongoose from 'mongoose';

const mttfDataSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['structure', 'propulsion', 'actuators', 'controller', 'communication'],
    index: true
  },
  // Structure/Airframe specific fields
  frameSection: {
    type: String,
    required: function() { return this.category === 'structure'; },
    trim: true
  },
  ataChapter: {
    type: String,
    trim: true
  },
  componentLifetime: {
    type: Number,
    min: 0
  },
  totalFlightHours: {
    type: Number,
    min: 0,
    default: 0
  },
  mcFlightHours: {
    type: Number,
    min: 0,
    default: 0
  },
  fwFlightHours: {
    type: Number,
    min: 0,
    default: 0
  },
  damageOccurrence: {
    type: String,
    trim: true
  },
  mtsbTicketId: {
    type: String,
    trim: true
  },
  mtsbTicketLink: {
    type: String,
    trim: true
  },
  lastRepairDate: {
    type: Date
  },
  // Common fields for other categories (propulsion, actuators, controller, communication)
  component: {
    type: String,
    required: function() { return this.category !== 'structure'; },
    trim: true
  },
  componentVersionNo: {
    type: String,
    trim: true
  },
  partNo: {
    type: String,
    trim: true
  },
  dateOfInstallation: {
    type: Date
  },
  // Common fields for all categories
  uaSpecification: {
    type: String,
    trim: true
  },
  uaName: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  ticket: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

// Update the updatedAt timestamp before saving
mttfDataSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for filtering
mttfDataSchema.index({ category: 1, uaSpecification: 1, uaName: 1, serialNumber: 1 });

export default mongoose.model('MTTFData', mttfDataSchema);
