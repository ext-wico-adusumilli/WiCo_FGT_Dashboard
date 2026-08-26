/**
 * Airflow Service - Frontend
 * Handles communication with backend Airflow API
 */

import { DagStatus, Job, JobCreateRequest, AirflowConnectionStatus } from '../types/airflow';

class AirflowService {
  private baseUrl = '/api/airflow';

  /**
   * Make API request to backend
   * Note: Authentication is handled by the backend service layer
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    console.log('🚀 [Client AirflowService] Request:', {
      method: options.method || 'GET',
      url,
      timestamp: new Date().toISOString()
    });
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    const startTime = Date.now();

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const endTime = Date.now();
    console.log('📡 [Client AirflowService] Response:', {
      status: response.status,
      statusText: response.statusText,
      duration: `${endTime - startTime}ms`
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Client AirflowService] HTTP error:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ [Client AirflowService] API returned success: false:', data.message);
      throw new Error(data.message || 'API request failed');
    }

    console.log('✅ [Client AirflowService] Request successful');
    return data.data;
  }

  // ===== DAG Management Methods =====

  /**
   * Get all DAGs with optional filtering
   */
  async getDags(filters?: {
    searchTerm?: string;
    states?: string[];
    active?: boolean;
    paused?: boolean;
    tags?: string[];
  }): Promise<DagStatus[]> {
    console.log('🎯 [Client AirflowService] getDags() called with filters:', filters);
    
    const params = new URLSearchParams();
    
    if (filters?.searchTerm) {
      params.append('search', filters.searchTerm);
    }
    if (filters?.states?.length) {
      params.append('states', filters.states.join(','));
    }
    if (filters?.active !== undefined) {
      params.append('active', filters.active.toString());
    }
    if (filters?.paused !== undefined) {
      params.append('paused', filters.paused.toString());
    }
    if (filters?.tags?.length) {
      params.append('tags', filters.tags.join(','));
    }

    const queryString = params.toString();
    const endpoint = `/dags${queryString ? `?${queryString}` : ''}`;
    
    console.log('🌐 [Client AirflowService] Making request to:', `${this.baseUrl}${endpoint}`);
    console.log('⏱️ [Client AirflowService] Request started at:', new Date().toISOString());
    
    const startTime = Date.now();
    
    try {
      const result = await this.makeRequest<DagStatus[]>(endpoint);
      const endTime = Date.now();
      
      console.log('✅ [Client AirflowService] Request completed in', endTime - startTime, 'ms');
      console.log('📊 [Client AirflowService] Received', result.length, 'DAGs');
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      console.error('❌ [Client AirflowService] Request failed after', endTime - startTime, 'ms:', error);
      throw error;
    }
  }

  /**
   * Get specific DAG details
   */
  async getDag(dagId: string): Promise<DagStatus> {
    return this.makeRequest<DagStatus>(`/dags/${dagId}`);
  }

  /**
   * Trigger a DAG run
   */
  async triggerDag(dagId: string, conf?: Record<string, any>): Promise<any> {
    return this.makeRequest(`/dags/${dagId}/trigger`, {
      method: 'POST',
      body: JSON.stringify({ conf }),
    });
  }

  /**
   * Pause a DAG
   */
  async pauseDag(dagId: string): Promise<void> {
    await this.makeRequest(`/dags/${dagId}/pause`, {
      method: 'POST',
    });
  }

  /**
   * Unpause a DAG
   */
  async unpauseDag(dagId: string): Promise<void> {
    await this.makeRequest(`/dags/${dagId}/unpause`, {
      method: 'POST',
    });
  }

  /**
   * Delete a DAG
   */
  async deleteDag(dagId: string): Promise<void> {
    await this.makeRequest(`/dags/${dagId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get DAG runs for a specific DAG
   */
  async getDagRuns(dagId: string, limit = 25, offset = 0): Promise<any> {
    return this.makeRequest(`/dags/${dagId}/runs?limit=${limit}&offset=${offset}`);
  }

  /**
   * Get task instances for a DAG run
   */
  async getTaskInstances(dagId: string, dagRunId: string): Promise<any[]> {
    return this.makeRequest(`/dags/${dagId}/runs/${dagRunId}/tasks`);
  }

  // ===== Script Management Methods =====

  /**
   * Get available scripts
   */
  async getScripts(): Promise<any[]> {
    return this.makeRequest('/scripts');
  }

  /**
   * Get specific script details
   */
  async getScript(scriptId: string): Promise<any> {
    return this.makeRequest(`/scripts/${scriptId}`);
  }

  // ===== Job Management Methods =====

  /**
   * Create a new analysis job
   */
  async createJob(jobData: JobCreateRequest): Promise<Job> {
    // Validate required fields
    if (!jobData.name || !jobData.scriptId || !jobData.startDate || !jobData.endDate) {
      throw new Error('Missing required fields: name, scriptId, startDate, endDate');
    }

    // Validate date range
    const startDate = new Date(jobData.startDate);
    const endDate = new Date(jobData.endDate);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date');
    }

    return this.makeRequest<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData),
    });
  }

  /**
   * Get all jobs with filtering and pagination
   */
  async getJobs(filters?: {
    statuses?: string[];
    scriptIds?: string[];
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<Job[]> {
    const params = new URLSearchParams();
    
    if (filters?.statuses?.length) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters?.scriptIds?.length) {
      params.append('script_ids', filters.scriptIds.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.startDate) {
      params.append('start_date', filters.startDate);
    }
    if (filters?.endDate) {
      params.append('end_date', filters.endDate);
    }
    if (filters?.page) {
      params.append('page', filters.page.toString());
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.sortBy) {
      params.append('sort_by', filters.sortBy);
    }
    if (filters?.sortOrder) {
      params.append('sort_order', filters.sortOrder);
    }

    const queryString = params.toString();
    const endpoint = `/jobs${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest(endpoint);
  }

  /**
   * Get specific job details
   */
  async getJob(jobId: string): Promise<Job> {
    return this.makeRequest<Job>(`/jobs/${jobId}`);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.makeRequest(`/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.makeRequest(`/jobs/${jobId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<Job> {
    return this.makeRequest<Job>(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(timeRange?: string): Promise<any> {
    const params = new URLSearchParams();
    if (timeRange) {
      params.append('time_range', timeRange);
    }

    const queryString = params.toString();
    const endpoint = `/jobs/statistics${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest(endpoint);
  }

  // ===== Connection Management Methods =====

  /**
   * Get all connections
   */
  async getConnections(filters?: {
    connectionIds?: string[];
    connTypes?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    console.log('🎯 [Client AirflowService] getConnections() called with filters:', filters);
    
    const params = new URLSearchParams();
    
    if (filters?.connectionIds?.length) {
      params.append('connection_ids', filters.connectionIds.join(','));
    }
    if (filters?.connTypes?.length) {
      params.append('conn_types', filters.connTypes.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.offset) {
      params.append('offset', filters.offset.toString());
    }

    const queryString = params.toString();
    const endpoint = `/connections${queryString ? `?${queryString}` : ''}`;
    
    console.log('🌐 [Client AirflowService] Making request to:', `${this.baseUrl}${endpoint}`);
    console.log('⏱️ [Client AirflowService] Request started at:', new Date().toISOString());
    
    const startTime = Date.now();
    
    try {
      const result = await this.makeRequest<any>(endpoint);
      const endTime = Date.now();
      
      console.log('✅ [Client AirflowService] Request completed in', endTime - startTime, 'ms');
      console.log('📊 [Client AirflowService] Received', result.connections?.length || 0, 'connections');
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      console.error('❌ [Client AirflowService] Request failed after', endTime - startTime, 'ms:', error);
      throw error;
    }
  }

  /**
   * Get specific connection details
   */
  async getConnection(connectionId: string): Promise<any> {
    return this.makeRequest<any>(`/connections/${connectionId}`);
  }

  /**
   * Create a new connection
   */
  async createConnection(connectionData: {
    connectionId: string;
    connType: string;
    description?: string;
    host?: string;
    login?: string;
    schema?: string;
    port?: number;
    password?: string;
    extra?: string;
  }): Promise<any> {
    // Validate required fields
    if (!connectionData.connectionId || !connectionData.connType) {
      throw new Error('Missing required fields: connectionId, connType');
    }

    return this.makeRequest<any>('/connections', {
      method: 'POST',
      body: JSON.stringify(connectionData),
    });
  }

  /**
   * Update an existing connection
   */
  async updateConnection(connectionId: string, connectionData: {
    connType?: string;
    description?: string;
    host?: string;
    login?: string;
    schema?: string;
    port?: number;
    password?: string;
    extra?: string;
  }): Promise<any> {
    return this.makeRequest<any>(`/connections/${connectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(connectionData),
    });
  }

  /**
   * Delete a connection
   */
  async deleteConnection(connectionId: string): Promise<void> {
    await this.makeRequest(`/connections/${connectionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test a connection
   */
  async testConnection(connectionId: string): Promise<any> {
    return this.makeRequest<any>(`/connections/${connectionId}/test`, {
      method: 'POST',
    });
  }

  // ===== Health and Status Methods =====

  /**
   * Get Airflow connection status
   */
  async getConnectionStatus(): Promise<AirflowConnectionStatus> {
    return this.makeRequest<AirflowConnectionStatus>('/status');
  }

  /**
   * Get Airflow health status
   */
  async getHealthStatus(): Promise<any> {
    return this.makeRequest('/health');
  }

  // ===== Report Management Methods =====

  /**
   * Get the latest report URL for a DAG
   */
  async getLatestReport(dagId: string): Promise<{ url: string; filename: string; timestamp: string } | null> {
    try {
      return await this.makeRequest<{ url: string; filename: string; timestamp: string }>(`/reports/${dagId}/latest`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all reports for a DAG
   */
  async getReports(dagId: string): Promise<Array<{ filename: string; timestamp: string; url: string }>> {
    try {
      return await this.makeRequest<Array<{ filename: string; timestamp: string; url: string }>>(`/reports/${dagId}`);
    } catch (error) {
      return [];
    }
  }

  // ===== Data Discovery Methods =====

  /**
   * Get available phases from input directory
   */
  async getAvailablePhases(): Promise<Array<{ phaseId: string; phaseName: string; displayName: string; path: string }>> {
    try {
      return await this.makeRequest<Array<{ phaseId: string; phaseName: string; displayName: string; path: string }>>('/data/phases');
    } catch (error) {
      console.error('Failed to fetch available phases:', error);
      return [];
    }
  }

  /**
   * Get available dates for a specific phase
   */
  async getAvailableDates(phaseId: string): Promise<Array<{ date: string; folderName: string; path: string; fileCount: number; displayName: string }>> {
    try {
      return await this.makeRequest<Array<{ date: string; folderName: string; path: string; fileCount: number; displayName: string }>>(`/data/phases/${phaseId}/dates`);
    } catch (error) {
      console.error(`Failed to fetch available dates for phase ${phaseId}:`, error);
      return [];
    }
  }
}

export const airflowService = new AirflowService();