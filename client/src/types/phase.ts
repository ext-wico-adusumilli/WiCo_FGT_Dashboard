/**
 * Phase and Data Selection Types
 * For selecting data from blob storage for analysis jobs
 */

export interface Phase {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  dataPath: string; // Path in blob storage
  fileCount?: number;
  sizeBytes?: number;
  tags?: string[];
}

export interface DataSource {
  type: 'date_range' | 'phase' | 'custom';
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  phases?: string[]; // Phase IDs
  customPath?: string; // Custom blob storage path
}

export interface BlobStorageFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  contentType?: string;
}

export interface BlobStorageFolder {
  name: string;
  path: string;
  fileCount: number;
  totalSize: number;
  subfolders?: BlobStorageFolder[];
}

export interface DataSelectionSummary {
  totalFiles: number;
  totalSize: number;
  dateRange: {
    start: string;
    end: string;
  };
  sources: string[]; // List of selected phases or paths
}
