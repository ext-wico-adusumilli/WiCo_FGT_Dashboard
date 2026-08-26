/**
 * IngestionJob Model
 * Tracks AzCopy upload jobs triggered by the data ingestion scheduler.
 */

import mongoose from 'mongoose';

const ingestionJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // AzCopy internal job ID returned by `azcopy jobs list`
    azcopyJobId: {
      type: String,
      default: null,
    },
    sourceFolder: {
      type: String,
      required: true,
      trim: true,
    },
    includePath: {
      type: String,
      default: null,
    },
    blobSasUrl: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    triggeredBy: {
      type: String,
      enum: ['scheduler', 'manual'],
      default: 'scheduler',
    },
    // File statistics populated after job completes
    totalFiles: { type: Number, default: 0 },
    successFiles: { type: Number, default: 0 },
    failedFiles: { type: Number, default: 0 },
    skippedFiles: { type: Number, default: 0 },
    bytesTransferred: { type: Number, default: 0 },
    
    // Extended AzCopy summary fields
    elapsedTimeMinutes: { type: Number, default: 0 },
    folderPropertyTransfers: { type: Number, default: 0 },
    symlinkTransfers: { type: Number, default: 0 },
    totalTransfers: { type: Number, default: 0 },
    folderTransfersCompleted: { type: Number, default: 0 },
    folderTransfersFailed: { type: Number, default: 0 },
    folderTransfersSkipped: { type: Number, default: 0 },
    symbolicLinksSkipped: { type: Number, default: 0 },
    hardlinksConverted: { type: Number, default: 0 },
    hardlinksSkipped: { type: Number, default: 0 },
    specialFilesSkipped: { type: Number, default: 0 },
    logFilePath: { type: String, default: null },
    
    // Timing
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    // Raw output / error messages
    logs: { type: [String], default: [] },
    errorMessage: { type: String, default: null },
    // AzCopy percent completion (0-100) while running
    percentComplete: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
    collection: 'ingestion_jobs',
  }
);

// Composite indexes for dashboard queries
ingestionJobSchema.index({ status: 1, createdAt: -1 });
ingestionJobSchema.index({ triggeredBy: 1, createdAt: -1 });

// Virtual: compute duration on-the-fly if not persisted yet
ingestionJobSchema.virtual('computedDuration').get(function () {
  if (this.durationMs != null) return this.durationMs;
  if (this.startTime && this.endTime) {
    return new Date(this.endTime) - new Date(this.startTime);
  }
  return null;
});

// Statics ---------------------------------------------------------------

/** Aggregate summary stats for the dashboard */
ingestionJobSchema.statics.getSummary = async function () {
  const [stats] = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        running: { $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] } },
        totalFiles: { $sum: '$totalFiles' },
        successFiles: { $sum: '$successFiles' },
        failedFiles: { $sum: '$failedFiles' },
        bytesTransferred: { $sum: '$bytesTransferred' },
      },
    },
  ]);

  return (
    stats || {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      totalFiles: 0,
      successFiles: 0,
      failedFiles: 0,
      bytesTransferred: 0,
    }
  );
};

const IngestionJob = mongoose.model('IngestionJob', ingestionJobSchema);
export default IngestionJob;

