/**
 * TypeScript interfaces for Airflow data models
 * Used for Airflow Analysis Manager integration
 */

// DAG Status Types
export type DagRunState = 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 'up_for_retry' | 'up_for_reschedule';
export type TaskState = 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 'retry' | 'upstream_failed' | 'up_for_retry' | 'up_for_reschedule';

// Core DAG Interface
export interface DAG {
  dagId: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  isPaused: boolean;
  tags: string[];
  owners: string[];
  scheduleInterval?: string;
  maxActiveRuns: number;
  maxActiveTasks: number;
  hasTaskConcurrencyLimits: boolean;
  hasImportErrors: boolean;
  nextDagrun?: string;
  nextDagrunDataIntervalStart?: string;
  nextDagrunDataIntervalEnd?: string;
  nextDagrunCreateAfter?: string;
}

// DAG Status with Runtime Information
export interface DagStatus extends DAG {
  lastRunStatus?: DagRunState;
  lastRunTime?: string;
  nextRunTime?: string;
  taskCount: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  queuedCount: number;
  skippedCount: number;
  duration?: number;
  recentRuns: DagRun[];
}

// DAG Run Information
export interface DagRun {
  dagRunId: string;
  dagId: string;
  executionDate: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  state: DagRunState;
  runType: 'manual' | 'scheduled' | 'dataset_triggered' | 'backfill';
  externalTrigger: boolean;
  conf?: Record<string, any>;
  dataIntervalStart?: string;
  dataIntervalEnd?: string;
  lastSchedulingDecision?: string;
  runId: string;
  note?: string;
}

// Task Instance Information
export interface TaskInstance {
  taskId: string;
  taskDisplayName?: string;
  dagId: string;
  dagRunId: string;
  executionDate: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  state: TaskState;
  tryNumber: number;
  maxTries: number;
  hostname?: string;
  unixname?: string;
  jobId?: number;
  pool: string;
  poolSlots: number;
  queue?: string;
  priorityWeight?: number;
  operator: string;
  queuedDttm?: string;
  pid?: number;
  executorConfig?: Record<string, any>;
  slaMiss?: boolean;
  renderedFields?: Record<string, any>;
  testMode?: boolean;
  trigger?: Record<string, any>;
  triggererJob?: Record<string, any>;
  note?: string;
}

// Job Management Types
export type JobStatus = 'created' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

export interface Job {
  jobId: string;
  name: string;
  description?: string;
  scriptId: string;
  scriptName: string;
  startDate: string;
  endDate: string;
  parameters?: Record<string, any>;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  progress?: number;
  logUrl?: string;
  createdBy: string;
  dagId?: string;
  dagRunId?: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  recentRuns?: Array<{
    dagRunId: string;
    state: string;
    executionDate: string;
    startDate?: string;
    endDate?: string;
  }>;
}

// Job Creation Request
export interface JobCreateRequest {
  name: string;
  description?: string;
  scriptId: string;
  startDate: string;
  endDate: string;
  parameters?: Record<string, any>;
}

// Script/Template Information
export interface AirflowScript {
  scriptId: string;
  name: string;
  description?: string;
  dagId: string;
  parameters: ScriptParameter[];
  category?: string;
  tags: string[];
  isActive: boolean;
  estimatedDuration?: number;
  resourceRequirements?: {
    cpu?: string;
    memory?: string;
    disk?: string;
  };
}

export interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'select';
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For select type
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// API Response Types
export interface AirflowApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalEntries: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  offset: number;
}

// Connection and Health Status
export interface AirflowConnectionStatus {
  isConnected: boolean;
  version?: string;
  lastChecked: string;
  responseTime?: number;
  error?: string;
}

export interface AirflowHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    scheduler: 'healthy' | 'unhealthy';
    webserver: 'healthy' | 'unhealthy';
    database: 'healthy' | 'unhealthy';
  };
  lastUpdated: string;
}

// Error Types
export interface AirflowError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Filter and Search Types
export interface DagFilter {
  dagIds?: string[];
  tags?: string[];
  owners?: string[];
  states?: DagRunState[];
  paused?: boolean;
  active?: boolean;
  searchTerm?: string;
}

export interface JobFilter {
  statuses?: JobStatus[];
  createdBy?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  searchTerm?: string;
}

// Real-time Update Types
export interface DagStatusUpdate {
  dagId: string;
  status: DagRunState;
  timestamp: string;
  runId?: string;
  taskUpdates?: TaskStatusUpdate[];
}

export interface TaskStatusUpdate {
  taskId: string;
  dagId: string;
  runId: string;
  status: TaskState;
  timestamp: string;
  duration?: number;
}

// Configuration Types
export interface AirflowConfig {
  apiUrl: string;
  username: string;
  password: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  pollInterval: number;
}

// Connection Management Types
export interface AirflowConnection {
  connectionId: string;
  connType: string;
  description?: string;
  host?: string;
  login?: string;
  schema?: string;
  port?: number;
  password?: string; // Will be masked in responses
  extra?: string;
  createdAt?: string;
  updatedAt?: string;
  displayName?: string;
  isSecure?: boolean;
  connectionString?: string;
}

export interface ConnectionCreateRequest {
  connectionId: string;
  connType: string;
  description?: string;
  host?: string;
  login?: string;
  schema?: string;
  port?: number;
  password?: string;
  extra?: string;
}

export interface ConnectionUpdateRequest {
  connType?: string;
  description?: string;
  host?: string;
  login?: string;
  schema?: string;
  port?: number;
  password?: string;
  extra?: string;
}

export interface ConnectionTestResult {
  connectionId: string;
  status: 'success' | 'failed';
  message: string;
  details?: any;
}

export interface ConnectionFilter {
  connectionIds?: string[];
  connTypes?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

// Common Connection Types
export type ConnectionType = 
  | 'postgres'
  | 'mysql'
  | 'sqlite'
  | 'oracle'
  | 'mssql'
  | 'mongodb'
  | 'redis'
  | 'http'
  | 'https'
  | 'ftp'
  | 'sftp'
  | 's3'
  | 'gcs'
  | 'azure_blob_storage'
  | 'docker'
  | 'kubernetes'
  | 'ssh'
  | 'email'
  | 'slack'
  | 'generic';

export interface ConnectionTypeInfo {
  type: ConnectionType;
  displayName: string;
  description: string;
  defaultPort?: number;
  requiredFields: string[];
  optionalFields: string[];
  supportsTest: boolean;
}