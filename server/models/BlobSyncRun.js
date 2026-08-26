import mongoose from 'mongoose';

const blobSyncRunSchema = new mongoose.Schema({
  triggeredBy: { type: String, enum: ['scheduler', 'manual'], default: 'manual' },
  status:      { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  startTime:   { type: Date, default: Date.now },
  endTime:     { type: Date, default: null },
  durationMs:  { type: Number, default: null },
  totalBlobsScanned: { type: Number, default: 0 },
  filesFound:  { type: Number, default: 0 },
  inserted:    { type: Number, default: 0 },
  skipped:     { type: Number, default: 0 },
  rowErrors:   { type: Number, default: 0 },
  blobs: [{
    blob:      { type: String },
    type:      { type: String },
    rows:      { type: Number },
    inserted:  { type: Number },
    skipped:   { type: Number },
    rowErrors: { type: Number },
    error:     { type: String },
  }],
  errorMessage:{ type: String, default: null },
}, { timestamps: true, collection: 'blob_sync_runs' });

export default mongoose.model('BlobSyncRun', blobSyncRunSchema);
