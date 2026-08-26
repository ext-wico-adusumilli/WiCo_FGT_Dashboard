/**
 * Airflow Service Layer - Backend
 * Handles communication with Apache Airflow REST API v1 (Airflow 2.9.3)
 * 
 * Authentication: Uses HTTP Basic Authentication
 * Reference: https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html
 * 
 * Airflow 2.9.3 supports simple Basic Auth for API access
 */

import fetch from 'node-fetch';

class AirflowService {
  constructor() {
    // Load configuration from environment variables
    this.config = {
      apiUrl: process.env.AIRFLOW_API_URL,
      username: process.env.AIRFLOW_USERNAME,
      password: process.env.AIRFLOW_PASSWORD,
      timeout: parseInt(process.env.AIRFLOW_API_TIMEOUT) || 30000,
      retryAttempts: parseInt(process.env.AIRFLOW_RETRY_ATTEMPTS) || 3,
      retryDelay: parseInt(process.env.AIRFLOW_RETRY_DELAY) || 1000
    };

    // Validate required configuration
    if (!this.config.apiUrl || !this.config.username || !this.config.password) {
      throw new Error('Missing required Airflow configuration. Please set AIRFLOW_API_URL, AIRFLOW_USERNAME, and AIRFLOW_PASSWORD in .env file');
    }

    // Create Basic Auth header
    this.authHeader = 'Basic ' + Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');

    console.log('✅ [AirflowService] Initialized with config:', {
      apiUrl: this.config.apiUrl,
      username: this.config.username,
      timeout: this.config.timeout
    });

    // Connection status tracking
    this.connectionStatus = {
      isConnected: false,
      lastChecked: null,
      consecutiveFailures: 0,
      maxFailures: 5
    };
  }

  /**
   * Generic API request handler with Basic Auth
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.config.apiUrl}${endpoint}`;
    
    console.log('🚀 [AirflowService] Request:', {
      method: options.method || 'GET',
      url,
      timestamp: new Date().toISOString()
    });
    
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const headers = {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          ...options.headers
        };
        
        // Only add Content-Type for requests with a body
        if (options.body) {
          headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('📡 [AirflowService] Response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        // Handle non-OK responses
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          try {
            const errorData = await response.json();
            console.error('❌ [AirflowService] Error response body:', errorData);
            errorMessage = errorData.detail || errorData.title || errorMessage;
          } catch (e) {
            try {
              const errorText = await response.text();
              console.error('❌ [AirflowService] Error response text:', errorText);
              if (errorText) errorMessage = errorText;
            } catch (e2) {
              // Use default error message
            }
          }
          
          // Handle specific HTTP status codes
          if (response.status === 401) {
            console.error('❌ [AirflowService] Authentication failed');
            throw new Error(`Authentication failed: ${errorMessage}`);
          } else if (response.status === 403) {
            throw new Error(`Access forbidden: ${errorMessage}`);
          } else if (response.status === 404) {
            throw new Error(`Resource not found: ${errorMessage}`);
          } else if (response.status >= 500) {
            throw new Error(`Airflow server error: ${errorMessage}`);
          }
          
          throw new Error(errorMessage);
        }

        // Parse JSON response (handle 204 No Content)
        let data = null;
        if (response.status !== 204) {
          const text = await response.text();
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              // If not JSON, return as text
              data = { message: text };
            }
          }
        }
        
        // Update connection status on success
        this.connectionStatus.isConnected = true;
        this.connectionStatus.lastChecked = new Date().toISOString();
        this.connectionStatus.consecutiveFailures = 0;
        
        console.log('✅ [AirflowService] Request successful');
        return data;
        
      } catch (error) {
        lastError = error;
        
        console.error(`❌ [AirflowService] Attempt ${attempt}/${this.config.retryAttempts} failed:`, error.message);
        
        // Update connection status on failure
        this.connectionStatus.consecutiveFailures++;
        this.connectionStatus.lastChecked = new Date().toISOString();
        
        if (this.connectionStatus.consecutiveFailures >= this.connectionStatus.maxFailures) {
          this.connectionStatus.isConnected = false;
        }
        
        // Don't retry on authentication errors
        if (error.message.includes('Authentication failed')) {
          throw error;
        }
        
        // Retry with exponential backoff
        if (attempt < this.config.retryAttempts) {
          const delayMs = this.config.retryDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ [AirflowService] Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    // All retries failed
    this.connectionStatus.isConnected = false;
    throw new Error(`Airflow API request failed after ${this.config.retryAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Delay utility for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== DAG Management Methods =====

  async getDags(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.dagIds?.length) {
      filters.dagIds.forEach(id => queryParams.append('dag_id_pattern', id));
    }
    if (filters.paused !== undefined) {
      queryParams.append('paused', filters.paused);
    }
    if (filters.tags?.length) {
      queryParams.append('tags', filters.tags.join(','));
    }

    const endpoint = `/dags${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    
    const dags = response.dags || [];
    
    // Fetch recent runs for each DAG - get all runs for accurate statistics and chart
    const dagsWithRuns = await Promise.all(
      dags.map(async (dag) => {
        try {
          // Fetch last 100 runs for accurate statistics and display all in chart
          const runsResponse = await this.makeRequest(
            `/dags/${dag.dag_id}/dagRuns?limit=100&order_by=-execution_date`
          );
          const allRuns = runsResponse.dag_runs || [];
          // Use all runs for both statistics and chart display
          return { ...dag, recentRuns: allRuns, allRuns: allRuns };
        } catch (error) {
          console.warn(`Failed to fetch runs for DAG ${dag.dag_id}:`, error.message);
          return { ...dag, recentRuns: [], allRuns: [] };
        }
      })
    );
    
    return this.transformDagsResponse(dagsWithRuns);
  }

  async getDag(dagId) {
    const response = await this.makeRequest(`/dags/${dagId}`);
    return this.transformDagResponse(response);
  }

  async triggerDag(dagId, conf = {}) {
    const response = await this.makeRequest(`/dags/${dagId}/dagRuns`, {
      method: 'POST',
      body: JSON.stringify({
        dag_run_id: `manual_${Date.now()}`,
        conf: conf
      })
    });
    return this.transformDagRunResponse(response);
  }

  async updateDagState(dagId, isPaused) {
    const response = await this.makeRequest(`/dags/${dagId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        is_paused: isPaused
      })
    });
    return this.transformDagResponse(response);
  }

  async deleteDag(dagId) {
    console.log(`🗑️ [AirflowService] Deleting DAG: ${dagId}`);
    console.log(`🗑️ [AirflowService] DELETE URL: ${this.config.apiUrl}/dags/${dagId}`);
    
    const result = await this.makeRequest(`/dags/${dagId}`, {
      method: 'DELETE'
    });
    
    console.log(`✅ [AirflowService] DAG deleted successfully:`, result);
    return { success: true, message: `DAG ${dagId} deleted successfully` };
  }

  async getDagRuns(dagId, limit = 25, offset = 0) {
    const response = await this.makeRequest(
      `/dags/${dagId}/dagRuns?limit=${limit}&offset=${offset}&order_by=-execution_date`
    );
    
    return {
      items: response.dag_runs?.map(run => this.transformDagRunResponse(run)) || [],
      totalEntries: response.total_entries || 0,
      totalPages: Math.ceil((response.total_entries || 0) / limit),
      currentPage: Math.floor(offset / limit) + 1,
      limit,
      offset
    };
  }

  async getTaskInstances(dagId, dagRunId) {
    const response = await this.makeRequest(
      `/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`
    );
    
    return response.task_instances?.map(task => this.transformTaskInstanceResponse(task)) || [];
  }

  // ===== Connection Management Methods =====

  async getConnections(filters = {}) {
    const queryParams = new URLSearchParams();
    
    if (filters.limit) {
      queryParams.append('limit', filters.limit.toString());
    }
    if (filters.offset) {
      queryParams.append('offset', filters.offset.toString());
    }

    const endpoint = `/connections${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    
    return {
      connections: this.transformConnectionsResponse(response.connections || []),
      totalEntries: response.total_entries || 0
    };
  }

  async getConnection(connectionId) {
    const response = await this.makeRequest(`/connections/${connectionId}`);
    return this.transformConnectionResponse(response);
  }

  async createConnection(connectionData) {
    const response = await this.makeRequest('/connections', {
      method: 'POST',
      body: JSON.stringify(this.transformConnectionToAirflowFormat(connectionData))
    });
    
    return this.transformConnectionResponse(response);
  }

  async updateConnection(connectionId, connectionData) {
    const response = await this.makeRequest(`/connections/${connectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(this.transformConnectionToAirflowFormat(connectionData))
    });
    
    return this.transformConnectionResponse(response);
  }

  async deleteConnection(connectionId) {
    await this.makeRequest(`/connections/${connectionId}`, {
      method: 'DELETE'
    });
    
    return { success: true, message: `Connection ${connectionId} deleted successfully` };
  }

  async testConnection(connectionId) {
    try {
      const response = await this.makeRequest(`/connections/test`, {
        method: 'POST',
        body: JSON.stringify({ connection_id: connectionId })
      });
      
      return {
        connectionId,
        status: response.status || 'success',
        message: response.message || 'Connection test successful',
        details: response
      };
    } catch (error) {
      return {
        connectionId,
        status: 'failed',
        message: error.message,
        details: null
      };
    }
  }

  // ===== Health and Status Methods =====

  async getConnectionStatus() {
    try {
      const startTime = Date.now();
      const response = await this.makeRequest('/health');
      const responseTime = Date.now() - startTime;

      return {
        isConnected: true,
        version: response.version || 'unknown',
        lastChecked: new Date().toISOString(),
        responseTime,
        health: response,
        consecutiveFailures: this.connectionStatus.consecutiveFailures,
        apiUrl: this.config.apiUrl
      };
    } catch (error) {
      return {
        isConnected: false,
        lastChecked: new Date().toISOString(),
        error: error.message,
        consecutiveFailures: this.connectionStatus.consecutiveFailures,
        apiUrl: this.config.apiUrl,
        maxFailuresReached: this.connectionStatus.consecutiveFailures >= this.connectionStatus.maxFailures
      };
    }
  }

  async getHealthStatus() {
    try {
      const response = await this.makeRequest('/health');
      
      return {
        status: response.metadatabase?.status === 'healthy' ? 'healthy' : 'degraded',
        components: {
          scheduler: response.scheduler?.status || 'unknown',
          webserver: 'healthy',
          database: response.metadatabase?.status || 'unknown'
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        components: {
          scheduler: 'unhealthy',
          webserver: 'unhealthy',
          database: 'unhealthy'
        },
        lastUpdated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // ===== Job Management Methods =====

  async getJobs(filters = {}) {
    try {
      console.log('🔍 [AirflowService] Fetching jobs from MongoDB with filters:', filters);
      
      // Import Job model dynamically to avoid circular dependencies
      const { default: Job } = await import('../models/Job.js');
      
      // Build query from filters
      const query = {};
      
      if (filters.statuses && filters.statuses.length > 0) {
        query.status = { $in: filters.statuses };
      }
      
      if (filters.scriptIds && filters.scriptIds.length > 0) {
        query.scriptId = { $in: filters.scriptIds };
      }
      
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { scriptName: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      if (filters.startDate) {
        query.createdAt = { ...query.createdAt, $gte: filters.startDate };
      }
      
      if (filters.endDate) {
        query.createdAt = { ...query.createdAt, $lte: filters.endDate };
      }
      
      // Build sort options
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortBy]: sortOrder };
      
      // Execute query
      const jobs = await Job.find(query).sort(sort).lean();
      
      console.log(`✅ [AirflowService] Found ${jobs.length} jobs in MongoDB`);
      
      // Enrich jobs with real-time status from Airflow DAG runs
      const enrichedJobs = await Promise.all(
        jobs.map(async (job) => {
          // Skip if job doesn't have DAG info
          if (!job.dagId) {
            return {
              ...job,
              recentRuns: []
            };
          }
          
          try {
            // Fetch ALL runs for this DAG to filter by job_id
            const runsResponse = await this.makeRequest(
              `/dags/${job.dagId}/dagRuns?limit=100&order_by=-execution_date`
            );
            
            // Filter runs that belong to this specific job (check conf.job_id)
            const jobRuns = (runsResponse.dag_runs || [])
              .filter(run => {
                // Check if this run was triggered by this job
                return run.conf && run.conf.job_id === job.jobId;
              })
              .slice(0, 5) // Take only last 5 runs for this job
              .map(run => ({
                dagRunId: run.dag_run_id,
                state: run.state,
                executionDate: run.execution_date,
                startDate: run.start_date,
                endDate: run.end_date
              }));
            
            console.log(`✅ [AirflowService] Found ${jobRuns.length} runs for job ${job.jobId}`);
            
            // Get the most recent run for this job to update status
            let currentStatus = job.status;
            let startedAt = job.startedAt;
            let completedAt = job.completedAt;
            let duration = job.duration;
            
            if (jobRuns.length > 0) {
              const latestRun = jobRuns[0];
              currentStatus = this.mapDagRunStateToJobStatus(latestRun.state);
              startedAt = latestRun.startDate || job.startedAt;
              completedAt = latestRun.endDate || job.completedAt;
              
              // Calculate duration if completed
              if (latestRun.endDate && latestRun.startDate) {
                duration = Math.floor(
                  (new Date(latestRun.endDate) - new Date(latestRun.startDate)) / 1000
                );
              }
              
              console.log(`✅ [AirflowService] Updated job ${job.jobId} status to: ${currentStatus}`);
            }
            
            return {
              ...job,
              status: currentStatus,
              startedAt: startedAt,
              completedAt: completedAt,
              duration: duration,
              recentRuns: jobRuns
            };
          } catch (error) {
            console.warn(`⚠️ [AirflowService] Could not fetch DAG runs for job ${job.jobId}:`, error.message);
            // Return job with empty recent runs if Airflow fetch fails
            return {
              ...job,
              recentRuns: []
            };
          }
        })
      );
      
      return enrichedJobs;
    } catch (error) {
      console.error('❌ [AirflowService] Error fetching jobs from MongoDB:', error);
      return [];
    }
  }

  async getJob(jobId) {
    const [dagId, dagRunId] = jobId.split('__');
    if (!dagId || !dagRunId) {
      throw new Error('Invalid job ID format. Expected: dagId__dagRunId');
    }
    
    const response = await this.makeRequest(`/dags/${dagId}/dagRuns/${dagRunId}`);
    return this.transformDagRunToJob(response);
  }

  async createJob(jobData) {
    const { dagId, conf = {} } = jobData;
    
    if (!dagId) {
      throw new Error('DAG ID is required to create a job');
    }
    
    const response = await this.triggerDag(dagId, conf);
    return this.transformDagRunToJob(response);
  }

  async cancelJob(jobId) {
    const [dagId, dagRunId] = jobId.split('__');
    if (!dagId || !dagRunId) {
      throw new Error('Invalid job ID format. Expected: dagId__dagRunId');
    }
    
    await this.makeRequest(`/dags/${dagId}/clearTaskInstances`, {
      method: 'POST',
      body: JSON.stringify({
        dag_run_id: dagRunId,
        dry_run: false,
        task_ids: [],
        reset_dag_runs: true,
        only_failed: false,
        only_running: true
      })
    });
    
    return { success: true, message: `Job ${jobId} cancelled successfully` };
  }

  async retryJob(jobId) {
    const [dagId, dagRunId] = jobId.split('__');
    if (!dagId || !dagRunId) {
      throw new Error('Invalid job ID format. Expected: dagId__dagRunId');
    }
    
    await this.makeRequest(`/dags/${dagId}/clearTaskInstances`, {
      method: 'POST',
      body: JSON.stringify({
        dag_run_id: dagRunId,
        dry_run: false,
        task_ids: [],
        reset_dag_runs: false,
        only_failed: true,
        only_running: false
      })
    });
    
    return await this.getJob(jobId);
  }

  async getJobStatistics(timeRange = '7d') {
    try {
      const response = await this.makeRequest('/dagRuns?limit=1000&order_by=-execution_date');
      const dagRuns = response.dag_runs || [];
      
      const now = new Date();
      const timeRangeMs = this.parseTimeRange(timeRange);
      const cutoffDate = new Date(now.getTime() - timeRangeMs);
      
      const recentRuns = dagRuns.filter(run => 
        new Date(run.execution_date) >= cutoffDate
      );
      
      return {
        total: recentRuns.length,
        success: recentRuns.filter(run => run.state === 'success').length,
        failed: recentRuns.filter(run => run.state === 'failed').length,
        running: recentRuns.filter(run => run.state === 'running').length,
        queued: recentRuns.filter(run => run.state === 'queued').length,
        timeRange,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching job statistics:', error);
      throw new Error(`Failed to fetch job statistics: ${error.message}`);
    }
  }

  // ===== Data Transformation Methods =====

  transformDagsResponse(dags) {
    return dags.map(dag => this.transformDagResponse(dag));
  }

  transformDagResponse(dag) {
    // Extract last run information from the fetched runs (most accurate)
    let lastRunTime = null;
    let lastRunStatus = null;
    
    if (dag.allRuns && dag.allRuns.length > 0) {
      // Use the most recent run from our fetched runs
      const mostRecentRun = dag.allRuns[0];
      lastRunTime = mostRecentRun.execution_date || mostRecentRun.start_date || null;
      lastRunStatus = mostRecentRun.state || null;
      
      console.log(`✅ [AirflowService] DAG ${dag.dag_id} - Using fetched run data:`, {
        lastRunTime,
        lastRunStatus,
        totalRuns: dag.allRuns.length
      });
    } else if (dag.last_dag_run) {
      // Fallback to last_dag_run from DAG object if no runs fetched
      lastRunTime = dag.last_dag_run.execution_date || null;
      lastRunStatus = dag.last_dag_run.state || null;
      
      console.log(`⚠️ [AirflowService] DAG ${dag.dag_id} - Using last_dag_run from DAG object:`, {
        lastRunTime,
        lastRunStatus
      });
    } else {
      console.log(`ℹ️ [AirflowService] DAG ${dag.dag_id} - No run data available`);
    }
    
    // Extract next run information - Airflow provides this in next_dagrun field
    const nextRunTime = dag.next_dagrun || dag.next_dagrun_create_after || null;
    
    // Process recent runs for mini chart (last 10)
    const recentRuns = (dag.recentRuns || []).map(run => this.transformDagRunResponse(run));
    
    // Calculate statistics from ALL runs (up to 100) for accurate counts
    const allRuns = (dag.allRuns || dag.recentRuns || []);
    const successCount = allRuns.filter(run => run.state === 'success').length;
    const failedCount = allRuns.filter(run => run.state === 'failed').length;
    const runningCount = allRuns.filter(run => run.state === 'running').length;
    const queuedCount = allRuns.filter(run => run.state === 'queued').length;
    const skippedCount = allRuns.filter(run => run.state === 'skipped').length;
    
    // Transform schedule_interval to always be a string
    let scheduleInterval = 'None';
    if (dag.schedule_interval) {
      if (typeof dag.schedule_interval === 'string') {
        scheduleInterval = dag.schedule_interval;
      } else if (typeof dag.schedule_interval === 'object') {
        // Handle Timetable objects or other complex schedule types
        scheduleInterval = dag.schedule_interval.value || dag.schedule_interval.name || JSON.stringify(dag.schedule_interval);
      } else {
        scheduleInterval = String(dag.schedule_interval);
      }
    }
    
    return {
      dagId: dag.dag_id,
      displayName: dag.dag_display_name || dag.dag_id,
      description: dag.description,
      isActive: dag.is_active,
      isPaused: dag.is_paused,
      tags: dag.tags || [],
      owners: dag.owners || [],
      scheduleInterval: scheduleInterval,
      maxActiveRuns: dag.max_active_runs,
      maxActiveTasks: dag.max_active_tasks,
      hasTaskConcurrencyLimits: dag.has_task_concurrency_limits,
      hasImportErrors: dag.has_import_errors,
      // Next run information
      nextDagrun: nextRunTime,
      nextDagrunDataIntervalStart: dag.next_dagrun_data_interval_start,
      nextDagrunDataIntervalEnd: dag.next_dagrun_data_interval_end,
      nextDagrunCreateAfter: dag.next_dagrun_create_after,
      nextRunTime: nextRunTime, // Simplified field for UI
      // Last run information
      lastRunStatus: lastRunStatus,
      lastRunTime: lastRunTime,
      lastParsedTime: dag.last_parsed_time,
      // Task counts from ALL runs (accurate statistics)
      taskCount: allRuns.length,
      successCount: successCount,
      failedCount: failedCount,
      runningCount: runningCount,
      queuedCount: queuedCount,
      skippedCount: skippedCount,
      // ALL runs for chart display (no limit)
      recentRuns: recentRuns
    };
  }

  transformDagRunResponse(dagRun) {
    // Calculate duration if start and end dates are available
    let duration = null;
    if (dagRun.end_date && dagRun.start_date) {
      duration = (new Date(dagRun.end_date).getTime() - new Date(dagRun.start_date).getTime()) / 1000; // in seconds
    }
    
    return {
      dagRunId: dagRun.dag_run_id,
      dagId: dagRun.dag_id,
      executionDate: dagRun.execution_date,
      startDate: dagRun.start_date,
      endDate: dagRun.end_date,
      duration: duration,
      state: dagRun.state,
      runType: dagRun.run_type || 'manual',
      externalTrigger: dagRun.external_trigger || false,
      conf: dagRun.conf || {},
      dataIntervalStart: dagRun.data_interval_start,
      dataIntervalEnd: dagRun.data_interval_end,
      lastSchedulingDecision: dagRun.last_scheduling_decision,
      runId: dagRun.run_id || dagRun.dag_run_id,
      note: dagRun.note
    };
  }

  transformTaskInstanceResponse(task) {
    return {
      taskId: task.task_id,
      taskDisplayName: task.task_display_name || task.task_id,
      dagId: task.dag_id,
      dagRunId: task.dag_run_id,
      executionDate: task.execution_date,
      startDate: task.start_date,
      endDate: task.end_date,
      duration: task.duration,
      state: task.state,
      tryNumber: task.try_number,
      maxTries: task.max_tries,
      hostname: task.hostname,
      unixname: task.unixname,
      jobId: task.job_id,
      pool: task.pool,
      poolSlots: task.pool_slots,
      queue: task.queue,
      priorityWeight: task.priority_weight,
      operator: task.operator,
      queuedDttm: task.queued_dttm,
      pid: task.pid,
      executorConfig: task.executor_config,
      slaMiss: task.sla_miss,
      renderedFields: task.rendered_fields,
      testMode: task.test_mode,
      trigger: task.trigger,
      triggererJob: task.triggerer_job,
      note: task.note
    };
  }

  transformConnectionsResponse(connections) {
    return connections.map(conn => this.transformConnectionResponse(conn));
  }

  transformConnectionResponse(conn) {
    return {
      connectionId: conn.connection_id,
      connType: conn.conn_type,
      description: conn.description,
      host: conn.host,
      login: conn.login,
      schema: conn.schema,
      port: conn.port,
      password: conn.password ? '***masked***' : null,
      extra: conn.extra,
      createdAt: conn.created_at || new Date().toISOString(),
      updatedAt: conn.updated_at || new Date().toISOString(),
      displayName: conn.connection_id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      isSecure: conn.conn_type?.includes('https') || conn.port === 443 || conn.port === 22,
      connectionString: this.buildConnectionString(conn)
    };
  }

  transformConnectionToAirflowFormat(connectionData) {
    return {
      connection_id: connectionData.connectionId,
      conn_type: connectionData.connType,
      description: connectionData.description,
      host: connectionData.host,
      login: connectionData.login,
      schema: connectionData.schema,
      port: connectionData.port,
      password: connectionData.password,
      extra: connectionData.extra
    };
  }

  buildConnectionString(conn) {
    if (!conn.conn_type) return 'Unknown';
    
    let connStr = conn.conn_type;
    
    if (conn.login && conn.host) {
      connStr += `://${conn.login}@${conn.host}`;
      if (conn.port) {
        connStr += `:${conn.port}`;
      }
      if (conn.schema) {
        connStr += `/${conn.schema}`;
      }
    } else if (conn.host) {
      connStr += `://${conn.host}`;
      if (conn.port) {
        connStr += `:${conn.port}`;
      }
    }
    
    return connStr;
  }

  transformDagRunToJob(dagRun) {
    const jobId = `${dagRun.dag_id}__${dagRun.dag_run_id}`;
    
    return {
      jobId,
      name: dagRun.dag_run_id,
      description: `DAG run for ${dagRun.dag_id}`,
      scriptId: dagRun.dag_id,
      scriptName: dagRun.dag_id,
      startDate: dagRun.data_interval_start || dagRun.execution_date,
      endDate: dagRun.data_interval_end || dagRun.execution_date,
      parameters: dagRun.conf || {},
      status: this.mapDagRunStateToJobStatus(dagRun.state),
      createdAt: dagRun.execution_date,
      startedAt: dagRun.start_date,
      completedAt: dagRun.end_date,
      duration: dagRun.end_date && dagRun.start_date ? 
        new Date(dagRun.end_date) - new Date(dagRun.start_date) : null,
      progress: this.calculateProgress(dagRun.state),
      createdBy: 'airflow',
      dagId: dagRun.dag_id,
      dagRunId: dagRun.dag_run_id,
      errorMessage: dagRun.state === 'failed' ? 'DAG run failed' : null,
      retryCount: 0,
      maxRetries: 3
    };
  }

  mapDagRunStateToJobStatus(state) {
    const stateMap = {
      'queued': 'scheduled',
      'running': 'running',
      'success': 'completed',
      'failed': 'failed',
      'up_for_retry': 'scheduled',
      'up_for_reschedule': 'scheduled',
      'skipped': 'cancelled'
    };
    
    return stateMap[state] || 'created';
  }

  calculateProgress(state) {
    const progressMap = {
      'queued': 0,
      'running': 50,
      'success': 100,
      'failed': 100,
      'up_for_retry': 25,
      'up_for_reschedule': 25,
      'skipped': 100
    };
    
    return progressMap[state] || 0;
  }

  parseTimeRange(timeRange) {
    const timeRangeMap = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    return timeRangeMap[timeRange] || timeRangeMap['7d'];
  }

  // ===== Report Management Methods =====

  /**
   * Get reports for a DAG+phase from Azure Blob Storage
   * Blob path: Output/Weekly_Inflight_Report/Reports/<phase>/<date>/Subreports/<filename>
   */
  async getReportsFromBlob(dagId, phase) {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error('AZURE_BLOB_CONNECTION_STRING not set');
      }

      const containerName = 'datax-file-storage';
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      // Extract report type from dagId e.g. "corrupt_report" -> search under phase folder
      const prefix = `Output/Weekly_Inflight_Report/Reports/${phase}/`;

      const reports = [];
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (!blob.name.endsWith('.html') && !blob.name.endsWith('.pdf')) continue;

        // Only include files that match the dagId report type
        const filename = blob.name.split('/').pop();
        const reportType = dagId.replace(/_report$/, '').replace(/_dag$/, '');
        if (!filename.toLowerCase().includes(reportType.toLowerCase())) continue;

        reports.push({
          filename,
          blobPath: blob.name,
          timestamp: blob.properties.lastModified?.toISOString(),
          size: blob.properties.contentLength,
          url: `/api/airflow/blob-report?path=${encodeURIComponent(blob.name)}`
        });
      }

      // Sort newest first
      reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return reports;
    } catch (error) {
      console.error('❌ [AirflowService] Error fetching reports from blob:', error);
      throw error;
    }
  }

  /**
   * Stream a blob report file to the response
   */
  async streamBlobReport(blobPath, res) {
    try {
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
      const containerName = 'datax-file-storage';
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobPath);

      const downloadResponse = await blobClient.download();
      const contentType = blobPath.endsWith('.pdf') ? 'application/pdf' : 'text/html';
      res.setHeader('Content-Type', contentType);
      downloadResponse.readableStreamBody.pipe(res);
    } catch (error) {
      console.error('❌ [AirflowService] Error streaming blob report:', error);
      throw error;
    }
  }

  /**
   * Get the latest report for a DAG
   * Reports can be stored in two ways:
   * 1. Organized by DAG ID: /reports/{dagId}/report.html
   * 2. Flat structure with DAG ID in filename: /reports/{dagId}_report_all.html
   */
  async getLatestReport(dagId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const reportsBasePath = process.env.AIRFLOW_REPORTS_PATH || '\\\\wsl$\\Ubuntu\\home\\iet1621\\airflow_docker\\Output\\Weekly_Inflight_Report\\Reports';
      
      // First, try to find reports in a DAG-specific subdirectory
      const dagReportsPath = path.join(reportsBasePath, dagId);
      let files = [];
      let isSubdirectory = false;
      
      try {
        await fs.access(dagReportsPath);
        files = await fs.readdir(dagReportsPath);
        isSubdirectory = true;
      } catch (error) {
        // Subdirectory doesn't exist, look in flat structure
        try {
          await fs.access(reportsBasePath);
          const allFiles = await fs.readdir(reportsBasePath);
          
          // Extract DAG name from dag_id (e.g., "new_actuator_report" -> "actuator")
          const dagName = dagId.replace(/^new_/, '').replace(/_dag$/, '').replace(/_report$/, '');
          
          // Filter files that match the DAG name
          files = allFiles.filter(file => {
            const fileName = file.toLowerCase();
            const searchName = dagName.toLowerCase();
            
            return fileName.includes(searchName) && 
                   (fileName.endsWith('.html') || 
                    fileName.endsWith('.pdf') || 
                    fileName.endsWith('.xlsx') ||
                    fileName.endsWith('.csv'));
          });
        } catch (error) {
          return null;
        }
      }
      
      if (files.length === 0) {
        return null;
      }
      
      // Filter for report files
      const reportFiles = files.filter(file => 
        file.endsWith('.html') || 
        file.endsWith('.pdf') || 
        file.endsWith('.xlsx') ||
        file.endsWith('.csv')
      );
      
      if (reportFiles.length === 0) {
        return null;
      }
      
      // Get file stats to sort by modification time
      const basePath = isSubdirectory ? dagReportsPath : reportsBasePath;
      const fileStats = await Promise.all(
        reportFiles.map(async (file) => {
          const filePath = path.join(basePath, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            timestamp: stats.mtime.toISOString(),
            size: stats.size,
            path: filePath
          };
        })
      );
      
      // Sort by modification time (newest first)
      fileStats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const latestReport = fileStats[0];
      
      return {
        filename: latestReport.filename,
        timestamp: latestReport.timestamp,
        size: latestReport.size,
        url: `/api/airflow/reports/${dagId}/file/${encodeURIComponent(latestReport.filename)}`
      };
    } catch (error) {
      console.error('❌ [AirflowService] Error getting latest report:', error);
      throw error;
    }
  }

  /**
   * Get all reports for a DAG
   */
  async getReports(dagId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const reportsBasePath = process.env.AIRFLOW_REPORTS_PATH || '\\\\wsl$\\Ubuntu\\home\\iet1621\\airflow_docker\\Output\\Weekly_Inflight_Report\\Reports';
      
      // Try subdirectory first
      const dagReportsPath = path.join(reportsBasePath, dagId);
      let files = [];
      let isSubdirectory = false;
      
      try {
        await fs.access(dagReportsPath);
        files = await fs.readdir(dagReportsPath);
        isSubdirectory = true;
      } catch (error) {
        // Look in flat structure
        try {
          await fs.access(reportsBasePath);
          const allFiles = await fs.readdir(reportsBasePath);
          
          // Extract DAG name
          const dagName = dagId.replace(/^new_/, '').replace(/_dag$/, '').replace(/_report$/, '');
          
          // Filter matching files
          files = allFiles.filter(file => {
            const fileName = file.toLowerCase();
            const searchName = dagName.toLowerCase();
            
            return fileName.includes(searchName) && 
                   (fileName.endsWith('.html') || 
                    fileName.endsWith('.pdf') || 
                    fileName.endsWith('.xlsx') ||
                    fileName.endsWith('.csv'));
          });
        } catch (error) {
          return [];
        }
      }
      
      // Filter for report files
      const reportFiles = files.filter(file => 
        file.endsWith('.html') || 
        file.endsWith('.pdf') || 
        file.endsWith('.xlsx') ||
        file.endsWith('.csv')
      );
      
      // Get file stats
      const basePath = isSubdirectory ? dagReportsPath : reportsBasePath;
      const fileStats = await Promise.all(
        reportFiles.map(async (file) => {
          const filePath = path.join(basePath, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            timestamp: stats.mtime.toISOString(),
            size: stats.size,
            url: `/api/airflow/reports/${dagId}/file/${encodeURIComponent(file)}`
          };
        })
      );
      
      // Sort by modification time (newest first)
      fileStats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return fileStats;
    } catch (error) {
      console.error('❌ [AirflowService] Error getting reports:', error);
      throw error;
    }
  }

  /**
   * Get the file path for a specific report
   */
  async getReportFilePath(dagId, filename) {
    const path = await import('path');
    const fs = await import('fs/promises');
    
    const reportsBasePath = process.env.AIRFLOW_REPORTS_PATH || '\\\\wsl$\\Ubuntu\\home\\iet1621\\airflow_docker\\Output\\Weekly_Inflight_Report\\Reports';
    
    // Try subdirectory first
    let filePath = path.join(reportsBasePath, dagId, filename);
    
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      // Try flat structure
      filePath = path.join(reportsBasePath, filename);
      
      try {
        await fs.access(filePath);
        return filePath;
      } catch (error) {
        throw new Error(`Report file not found: ${filename}`);
      }
    }
  }

  // ===== Data Discovery Methods =====

  /**
   * Get available phases by scanning the Dataframes folder.
   * Phases are subfolder names inside any one category folder (e.g., Actuator/).
   * Path: AIRFLOW_DATAFRAMES_PATH/<AnyCategory>/<PhaseName>/
   */
  async getAvailablePhases() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const dataframesPath = process.env.AIRFLOW_DATAFRAMES_PATH ||
        '/home/azureuser/airflow_docker/Output/Weekly_Inflight_Report/Dataframes';

      console.log('🔍 [AirflowService] Scanning phases from Dataframes:', dataframesPath);

      // Pick the first category subfolder to read phase names from
      const categoryEntries = await fs.readdir(dataframesPath, { withFileTypes: true });
      const categoryDir = categoryEntries.find(e => e.isDirectory());

      if (!categoryDir) {
        console.warn('⚠️ [AirflowService] No category folders found in Dataframes');
        return [];
      }

      const categoryPath = path.join(dataframesPath, categoryDir.name);
      const phaseEntries = await fs.readdir(categoryPath, { withFileTypes: true });

      const phases = phaseEntries
        .filter(e => e.isDirectory())
        .map(e => ({
          phaseId: e.name,
          phaseName: e.name,
          displayName: e.name.replace(/_/g, ' '),
          path: path.join(categoryPath, e.name)
        }))
        .sort((a, b) => a.phaseName.localeCompare(b.phaseName));

      console.log('✅ [AirflowService] Found phases:', phases.map(p => p.phaseName));
      return phases;
    } catch (error) {
      console.error('❌ [AirflowService] Error scanning phases:', error);
      throw new Error(`Failed to scan for phases: ${error.message}`);
    }
  }

  /**
   * Get available dates for a specific phase by reading its ulg_files_<phase>.txt.
   * Each line in the txt file is a folder name like: 2025.11.27_ALD_FAA_FTC01_R1_Verf_Loop_6.3
   * Path: AIRFLOW_LOG_FILES_LIST_PATH/ulg_files_<phaseId>.txt
   */
  async getAvailableDates(phaseId) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const logFilesListPath = process.env.AIRFLOW_LOG_FILES_LIST_PATH ||
        '/home/azureuser/airflow_docker/Output/Weekly_Inflight_Report/Log files list';

      const txtFile = path.join(logFilesListPath, `ulg_files_${phaseId}.txt`);

      console.log('🔍 [AirflowService] Reading dates from:', txtFile);

      let content;
      try {
        content = await fs.readFile(txtFile, 'utf8');
      } catch (err) {
        console.warn(`⚠️ [AirflowService] No txt file for phase ${phaseId}:`, err.message);
        return [];
      }

      const dateSet = new Set();

      for (const line of content.split('\n')) {
        const fullPath = line.trim();
        if (!fullPath) continue;

        // Extract date from folder name in path: .../2025.11.27_ALD_.../filename.ulg
        const dateMatch = fullPath.match(/\/(\d{4})\.(\d{2})\.(\d{2})_/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          dateSet.add(`${year}-${month}-${day}`);
        }
      }

      const dates = [...dateSet]
        .sort((a, b) => new Date(b) - new Date(a)) // newest first
        .map(dateStr => ({
          date: dateStr,
          folderName: dateStr,
          path: '',
          fileCount: 0,
          displayName: dateStr
        }));

      console.log('✅ [AirflowService] Found dates for phase', phaseId, ':', dates.map(d => d.date));
      return dates;
    } catch (error) {
      console.error('❌ [AirflowService] Error reading dates for phase:', error);
      throw new Error(`Failed to get dates for phase ${phaseId}: ${error.message}`);
    }
  }
}

export default new AirflowService();
