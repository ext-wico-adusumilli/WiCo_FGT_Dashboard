import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false, // Made optional for backward compatibility
    trim: true,
    default: function() {
      // Generate name from email if not provided
      return this.email ? this.email.split('@')[0] : 'User';
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  privileges: {
    generalOverview: {
      snOverview: { type: Boolean, default: true },
      batteryOverview: { type: Boolean, default: true },
      transitionDistance: { type: Boolean, default: true },
      fcVersion: { type: Boolean, default: true },
      csVersion: { type: Boolean, default: true },
      vlosBvlos: { type: Boolean, default: true }
    },
    mttfDashboard: {
      dashboard: { type: Boolean, default: true },
      data: { type: Boolean, default: true },
      jiraTickets: { type: Boolean, default: true },
      naturalLanguageQuery: { type: Boolean, default: true },
      flightTimeAnalysis: { type: Boolean, default: true },
      filters: { type: Boolean, default: true }
    },
    administration: {
      userManagement: { type: Boolean, default: false },
      privilegeManagement: { type: Boolean, default: false }
    },
    weatherStation: { type: Boolean, default: true },
    logDetails: { type: Boolean, default: true },
    lteConnectivity: { type: Boolean, default: true },
    snGeoLocations: { type: Boolean, default: true },
    analysisManager: { type: Boolean, default: true },
    dataIngestion: { type: Boolean, default: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
