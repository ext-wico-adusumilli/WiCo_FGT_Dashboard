import mongoose from 'mongoose';
import BaseSummaryCollection from './BaseSummaryCollection.js';

const weatherStatsSummarySchema = new mongoose.Schema({
  location: { type: String, required: true },
  uaSN: { type: String, required: true },
  metrics: {
    temperature: { 
      min: { type: Number, default: null }, 
      max: { type: Number, default: null }, 
      avg: { type: Number, default: null },
      count: { type: Number, default: 0 }
    },
    humidity: { 
      min: { type: Number, default: null }, 
      max: { type: Number, default: null }, 
      avg: { type: Number, default: null },
      count: { type: Number, default: 0 }
    },
    pressure: { 
      min: { type: Number, default: null }, 
      max: { type: Number, default: null }, 
      avg: { type: Number, default: null },
      count: { type: Number, default: 0 }
    },
    wind: { 
      maxWind: { type: Number, default: null }, 
      maxGust: { type: Number, default: null }, 
      avgWind: { type: Number, default: null },
      windRun: { type: Number, default: null }
    },
    conditions: {
      cloudCoverage: { 
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        avg: { type: Number, default: null }
      },
      precipitation: { type: String, default: '' },
      windChill: { 
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        avg: { type: Number, default: null }
      },
      thwIndex: { 
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        avg: { type: Number, default: null }
      },
      wetBulb: { 
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        avg: { type: Number, default: null }
      }
    }
  }
});

// Pre-save hook to sync location+uaSN to entityId (required by BaseSummaryCollection)
weatherStatsSummarySchema.pre('save', function(next) {
  this.entityId = `${this.location}_${this.uaSN}`;
  next();
});

// Location-based indexes for geographic queries
weatherStatsSummarySchema.index({ location: 1, 'dateRange.start': 1, 'dateRange.end': 1 });
weatherStatsSummarySchema.index({ uaSN: 1, 'dateRange.start': 1, 'dateRange.end': 1 });
weatherStatsSummarySchema.index({ location: 1, timeGranularity: 1, lastUpdated: -1 });
weatherStatsSummarySchema.index({ uaSN: 1, location: 1, timeGranularity: 1 });

const WeatherStatsSummary = BaseSummaryCollection.discriminator('weather_stats', weatherStatsSummarySchema);

export default WeatherStatsSummary;