import mongoose from 'mongoose';

const jiraConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'config'
  },
  parentTicketKey: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: String,
    default: 'system'
  }
});

const JiraConfig = mongoose.model('JiraConfig', jiraConfigSchema);

export default JiraConfig;
