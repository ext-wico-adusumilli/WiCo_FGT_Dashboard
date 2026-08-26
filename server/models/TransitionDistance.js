import mongoose from 'mongoose';

const transitionDistanceSchema = new mongoose.Schema({
  branch: {
    type: String,
    required: true,
  },
  forwardMin: {
    type: Number,
    required: false,
    default: null,
  },
  forwardMean: {
    type: Number,
    required: false,
    default: null,
  },
  forwardMax: {
    type: Number,
    required: false,
    default: null,
  },
  backwardMin: {
    type: Number,
    required: false,
    default: null,
  },
  backwardMean: {
    type: Number,
    required: false,
    default: null,
  },
  backwardMax: {
    type: Number,
    required: false,
    default: null,
  },
  totalForward: {
    type: Number,
    required: false,
    default: null,
  },
  totalBackward: {
    type: Number,
    required: false,
    default: null,
  },
}, {
  timestamps: true,
});

export default mongoose.model('TransitionDistance', transitionDistanceSchema);
