import mongoose from 'mongoose';

const filterOptionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['uaName', 'ticket'],
    index: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  ticketLink: {
    type: String,
    trim: true,
    required: function() { return this.type === 'ticket'; }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to prevent duplicate values per type
filterOptionSchema.index({ type: 1, value: 1 }, { unique: true });

export default mongoose.model('FilterOption', filterOptionSchema);
