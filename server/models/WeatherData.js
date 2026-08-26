import mongoose from 'mongoose';

const weatherDataSchema = new mongoose.Schema({
  pressure: {
    type: Number,
    required: false,
    default: null,
  },
  humidity: {
    type: Number,
    required: false,
    default: null,
  },
  rain: {
    type: String,
    required: false,
    default: '',
  },
  temperature: {
    type: Number,
    required: false,
    default: null,
  },
  uaSN: {
    type: String,
    required: true,
  },
  flightLog: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: false,
    default: '',
  },
  amslMaxWind: {
    type: Number,
    required: false,
    default: null,
  },
  maxGust: {
    type: Number,
    required: false,
    default: null,
  },
  lowWindChill: {
    type: Number,
    required: false,
    default: null,
  },
  thwIndex: {
    type: Number,
    required: false,
    default: null,
  },
  wetBulb: {
    type: Number,
    required: false,
    default: null,
  },
  windChill: {
    type: Number,
    required: false,
    default: null,
  },
  windRun: {
    type: Number,
    required: false,
    default: null,
  },
  cloud: {
    type: Number,
    required: false,
    default: null,
  },
  amsl: {
    type: Number,
    required: false,
    default: null,
  },
  // Additional fields from WeatherStationData.xlsx
  windDirection: {
    type: String,
    required: false,
    default: '',
  },
  takeoffTime: {
    type: String,
    required: false,
    default: '',
  },
  landingTime: {
    type: String,
    required: false,
    default: '',
  },
  dateTime: {
    type: String,
    required: false,
    default: '',
  },
  highTemp: {
    type: Number,
    required: false,
    default: null,
  },
  gustBeforeTakeoff: {
    type: Number,
    required: false,
    default: null,
  },
  // Operation Type field
  operationType: {
    type: String,
    enum: ['Automatic', 'BVLOS / BLOS', 'Not Labelled', 'VLOS (Manual)', 'VLOS Autonomous', 'VLOS LTS', ''],
    default: '',
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
weatherDataSchema.index({ flightLog: 1 });
weatherDataSchema.index({ uaSN: 1 });
weatherDataSchema.index({ operationType: 1 });
weatherDataSchema.index({ dateTime: 1 });
weatherDataSchema.index({ uaSN: 1, dateTime: 1 });
weatherDataSchema.index({ operationType: 1, uaSN: 1 });

export default mongoose.model('WeatherData', weatherDataSchema);
