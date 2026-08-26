/**
 * Airflow Controller
 * Handles HTTP requests for Airflow integration
 */

import airflowService from '../services/airflowService.js';
import Job from '../models/Job.js';
import { v4 as uuidv4 } from 'uuid';

class AirflowController {
  // ===== DAG Management Methods =====

  /**
   * Get all DAGs with status information
   */
  async getDags(req, res) {
    console.log('🎯 [AirflowController] getDags() endpoint called');
    console.log('📝 [AirflowController] Request query params:', req.query);
    console.log('🕐 [AirflowController] Request timestamp:', new Date().toISOString());
    
    try {
      const filters = {
        dagIds: req.query.dag_ids ? req.query.dag_ids.split(',') : undefined,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        owners: req.query.owners ? req.query.owners.split(',') : undefined,
        paused: req.query.paused ? req.query.paused === 'true' : undefined,
        active: req.query.active ? req.query.active === 'true' : undefined,
        searchTerm: req.query.search
      };

      console.log('🔍 [AirflowController] Processed filters:', filters);
      console.log('⏳ [AirflowController] Calling airflowService.getDags()...');

      const startTime = Date.now();
      const dags = await airflowService.getDags(filters);
      const endTime = Date.now();
      
      console.log('✅ [AirflowController] airflowService.getDags() completed in', endTime - startTime, 'ms');
      console.log('📊 [AirflowController] Retrieved', dags.length, 'DAGs');
      console.log('📋 [AirflowController] DAG summary:', dags.map(dag => ({ 
        id: dag.dagId, 
        name: dag.displayName, 
        active: dag.isActive, 
        paused: dag.isPaused 
      })));
      
      const response = {
        success: true,
        data: dags,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending response with', dags.length, 'DAGs');
      res.json(response);
    } catch (error) {
      console.error('❌ [AirflowController] Error in getDags:', error);
      console.error('🔍 [AirflowController] Error stack:', error.stack);
      
      const errorResponse = {
        success: false,
        message: 'Failed to fetch DAGs',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get specific DAG details
   */
  async getDag(req, res) {
    try {
      const { dagId } = req.params;
      const dag = await airflowService.getDag(dagId);
      
      res.json({
        success: true,
        data: dag,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error in getDag for ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch DAG ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Trigger a DAG run
   */
  async triggerDag(req, res) {
    try {
      const { dagId } = req.params;
      const { conf } = req.body;
      
      const dagRun = await airflowService.triggerDag(dagId, conf);
      
      res.json({
        success: true,
        data: dagRun,
        message: `DAG ${dagId} triggered successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error triggering DAG ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to trigger DAG ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Pause a DAG
   */
  async pauseDag(req, res) {
    try {
      const { dagId } = req.params;
      
      await airflowService.updateDagState(dagId, true);
      
      res.json({
        success: true,
        message: `DAG ${dagId} paused successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error pausing DAG ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to pause DAG ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Unpause a DAG
   */
  async unpauseDag(req, res) {
    try {
      const { dagId } = req.params;
      
      await airflowService.updateDagState(dagId, false);
      
      res.json({
        success: true,
        message: `DAG ${dagId} unpaused successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error unpausing DAG ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to unpause DAG ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a DAG
   */
  async deleteDag(req, res) {
    try {
      const { dagId } = req.params;
      
      await airflowService.deleteDag(dagId);
      
      res.json({
        success: true,
        message: `DAG ${dagId} deleted successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error deleting DAG ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to delete DAG ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get DAG runs for a specific DAG
   */
  async getDagRuns(req, res) {
    try {
      const { dagId } = req.params;
      const limit = parseInt(req.query.limit) || 25;
      const offset = parseInt(req.query.offset) || 0;
      
      const dagRuns = await airflowService.getDagRuns(dagId, limit, offset);
      
      res.json({
        success: true,
        data: dagRuns,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching DAG runs for ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch DAG runs for ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get task instances for a DAG run
   */
  async getTaskInstances(req, res) {
    try {
      const { dagId, dagRunId } = req.params;
      
      const taskInstances = await airflowService.getTaskInstances(dagId, dagRunId);
      
      res.json({
        success: true,
        data: taskInstances,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching task instances for ${req.params.dagId}/${req.params.dagRunId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch task instances`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Script Management Methods =====

  /**
   * Get available scripts from Airflow
   */
  async getScripts(req, res) {
    try {
      // Try to get real DAGs first, then convert them to scripts
      const dags = await airflowService.getDags();
      
      const scripts = dags.map(dag => ({
        scriptId: dag.dagId,
        name: dag.displayName,
        description: dag.description,
        dagId: dag.dagId,
        parameters: [
          {
            name: 'start_date',
            type: 'date',
            description: 'Analysis start date',
            required: true
          },
          {
            name: 'end_date',
            type: 'date',
            description: 'Analysis end date',
            required: true
          },
          {
            name: 'config',
            type: 'json',
            description: 'Additional configuration parameters',
            required: false,
            defaultValue: {}
          }
        ],
        category: dag.tags.includes('real-dag') ? 'real-workflows' : 'analysis',
        tags: dag.tags,
        isActive: dag.isActive,
        estimatedDuration: 1800 // 30 minutes default
      }));
      
      res.json({
        success: true,
        data: scripts,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching scripts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch scripts',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get specific script details
   */
  async getScript(req, res) {
    try {
      const { scriptId } = req.params;
      
      // For now, get DAG details as script details
      const dag = await airflowService.getDag(scriptId);
      
      const script = {
        scriptId: dag.dagId,
        name: dag.displayName,
        description: dag.description,
        dagId: dag.dagId,
        parameters: [
          {
            name: 'start_date',
            type: 'date',
            description: 'Analysis start date',
            required: true
          },
          {
            name: 'end_date',
            type: 'date',
            description: 'Analysis end date',
            required: true
          }
        ],
        category: 'analysis',
        tags: dag.tags,
        isActive: dag.isActive,
        estimatedDuration: 1800
      };
      
      res.json({
        success: true,
        data: script,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching script ${req.params.scriptId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch script ${req.params.scriptId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Job Management Methods =====

  /**
   * Create a new analysis job with enhanced validation and lifecycle management
   */
  async createJob(req, res) {
    try {
      const { name, description, scriptId, startDate, endDate, parameters } = req.body;
      const userId = req.user?.id || 'dev-user';
      
      // Validate required fields
      if (!name || !scriptId || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: name, scriptId, startDate, endDate',
          timestamp: new Date().toISOString()
        });
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format for startDate or endDate',
          timestamp: new Date().toISOString()
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date',
          timestamp: new Date().toISOString()
        });
      }


      // Generate unique job ID with timestamp and random component
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const jobId = `job_${timestamp}_${randomSuffix}`;

      // Verify script exists (get script details)
      let scriptName = scriptId;
      try {
        const script = await airflowService.getDag(scriptId);
        scriptName = script.displayName || scriptId;
      } catch (scriptError) {
        console.warn(`Could not fetch script details for ${scriptId}:`, scriptError.message);
      }

      // Create job record with enhanced metadata
      const jobData = {
        jobId,
        name: name.trim(),
        description: description?.trim(),
        scriptId,
        scriptName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        parameters: parameters || {},
        status: 'created',
        createdAt: new Date().toISOString(),
        createdBy: userId,
        retryCount: 0,
        maxRetries: 3
      };

      const job = new Job(jobData);
      await job.save();

      // Trigger the DAG with job parameters
      try {
        const dagConf = {
          job_id: jobId,
          job_name: name,
          start_date: startDate,
          end_date: endDate,
          created_by: userId,
          created_at: jobData.createdAt,
          ...parameters
        };

        console.log('🎯 [AirflowController] Triggering DAG with configuration:', JSON.stringify(dagConf, null, 2));

        const dagRun = await airflowService.triggerDag(scriptId, dagConf);
        
        // Update job with DAG run information and set to scheduled
        job.dagId = scriptId;
        job.dagRunId = dagRun.dagRunId;
        job.status = 'scheduled';
        job.scheduledAt = new Date().toISOString();
        await job.save();

        console.log(`✅ [AirflowController] Job ${jobId} created and scheduled successfully`);
        console.log(`📋 [AirflowController] DAG Run ID: ${dagRun.dagRunId}`);
      } catch (dagError) {
        console.error('❌ [AirflowController] Error triggering DAG for job:', dagError);
        job.status = 'failed';
        job.errorMessage = `Failed to trigger DAG: ${dagError.message}`;
        job.completedAt = new Date().toISOString();
        await job.save();
      }

      res.status(201).json({
        success: true,
        data: job,
        message: 'Job created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create job',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get all jobs with enhanced filtering and pagination
   */
  async getJobs(req, res) {
    try {
      console.log('🎯 [AirflowController] getJobs() endpoint called');
      console.log('📝 [AirflowController] Request query params:', req.query);
      
      const filters = {
        statuses: req.query.statuses ? req.query.statuses.split(',') : undefined,
        scriptIds: req.query.script_ids ? req.query.script_ids.split(',') : undefined,
        search: req.query.search,
        startDate: req.query.start_date,
        endDate: req.query.end_date,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 25,
        sortBy: req.query.sort_by || 'createdAt',
        sortOrder: req.query.sort_order || 'desc'
      };

      console.log('🔍 [AirflowController] Processed filters:', filters);
      console.log('⏳ [AirflowController] Calling airflowService.getJobs()...');

      const startTime = Date.now();
      const jobs = await airflowService.getJobs(filters);
      const endTime = Date.now();
      
      console.log('✅ [AirflowController] airflowService.getJobs() completed in', endTime - startTime, 'ms');
      console.log('📊 [AirflowController] Retrieved', jobs.length, 'jobs');
      
      const response = {
        success: true,
        data: jobs,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending response with', jobs.length, 'jobs');
      res.json(response);
    } catch (error) {
      console.error('❌ [AirflowController] Error in getJobs:', error);
      console.error('🔍 [AirflowController] Error stack:', error.stack);
      
      const errorResponse = {
        success: false,
        message: 'Failed to fetch jobs',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get specific job details
   */
  async getJob(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await airflowService.getJob(jobId);
      
      res.json({
        success: true,
        data: job,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching job ${req.params.jobId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch job ${req.params.jobId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(req, res) {
    try {
      const { jobId } = req.params;
      
      const result = await airflowService.cancelJob(jobId);
      
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error cancelling job ${req.params.jobId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to cancel job ${req.params.jobId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a job from MongoDB
   */
  async deleteJob(req, res) {
    try {
      const { jobId } = req.params;
      
      console.log(`🗑️ [AirflowController] Deleting job: ${jobId}`);
      
      // Delete from MongoDB
      const Job = (await import('../models/Job.js')).default;
      const deletedJob = await Job.findOneAndDelete({ jobId });
      
      if (!deletedJob) {
        return res.status(404).json({
          success: false,
          message: `Job ${jobId} not found`,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`✅ [AirflowController] Job ${jobId} deleted successfully`);
      
      res.json({
        success: true,
        message: `Job ${jobId} deleted successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [AirflowController] Error deleting job ${req.params.jobId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to delete job ${req.params.jobId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await airflowService.retryJob(jobId);
      
      res.json({
        success: true,
        data: job,
        message: `Job ${jobId} retry initiated`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error retrying job ${req.params.jobId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to retry job ${req.params.jobId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get job statistics and metrics
   */
  async getJobStatistics(req, res) {
    try {
      const timeRange = req.query.time_range || '7d';
      
      const statistics = await airflowService.getJobStatistics(timeRange);
      
      res.json({
        success: true,
        data: statistics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching job statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch job statistics',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Connection Management Methods =====

  /**
   * Get all connections
   */
  async getConnections(req, res) {
    console.log('🎯 [AirflowController] getConnections() endpoint called');
    console.log('📝 [AirflowController] Request query params:', req.query);
    console.log('🕐 [AirflowController] Request timestamp:', new Date().toISOString());
    
    try {
      const filters = {
        connectionIds: req.query.connection_ids ? req.query.connection_ids.split(',') : undefined,
        connTypes: req.query.conn_types ? req.query.conn_types.split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset) : undefined,
        search: req.query.search
      };

      console.log('🔍 [AirflowController] Processed filters:', filters);
      console.log('⏳ [AirflowController] Calling airflowService.getConnections()...');

      const startTime = Date.now();
      const result = await airflowService.getConnections(filters);
      const endTime = Date.now();
      
      console.log('✅ [AirflowController] airflowService.getConnections() completed in', endTime - startTime, 'ms');
      console.log('📊 [AirflowController] Retrieved', result.connections.length, 'connections');
      console.log('📋 [AirflowController] Connection summary:', result.connections.map(conn => ({ 
        id: conn.connectionId, 
        type: conn.connType, 
        host: conn.host 
      })));
      
      const response = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending response with', result.connections.length, 'connections');
      res.json(response);
    } catch (error) {
      console.error('❌ [AirflowController] Error in getConnections:', error);
      console.error('🔍 [AirflowController] Error stack:', error.stack);
      
      const errorResponse = {
        success: false,
        message: 'Failed to fetch connections',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      console.log('📤 [AirflowController] Sending error response:', errorResponse);
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Get specific connection details
   */
  async getConnection(req, res) {
    try {
      const { connectionId } = req.params;
      console.log('🎯 [AirflowController] getConnection() called for:', connectionId);
      
      const connection = await airflowService.getConnection(connectionId);
      
      res.json({
        success: true,
        data: connection,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error in getConnection for ${req.params.connectionId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch connection ${req.params.connectionId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Create a new connection
   */
  async createConnection(req, res) {
    try {
      console.log('🎯 [AirflowController] createConnection() called');
      console.log('📝 [AirflowController] Request body:', req.body);
      
      const connectionData = req.body;
      
      // Validate required fields
      if (!connectionData.connectionId || !connectionData.connType) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: connectionId, connType',
          timestamp: new Date().toISOString()
        });
      }
      
      const connection = await airflowService.createConnection(connectionData);
      
      res.status(201).json({
        success: true,
        data: connection,
        message: `Connection ${connectionData.connectionId} created successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update an existing connection
   */
  async updateConnection(req, res) {
    try {
      const { connectionId } = req.params;
      const connectionData = req.body;
      
      console.log('🎯 [AirflowController] updateConnection() called for:', connectionId);
      
      const connection = await airflowService.updateConnection(connectionId, connectionData);
      
      res.json({
        success: true,
        data: connection,
        message: `Connection ${connectionId} updated successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error updating connection ${req.params.connectionId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to update connection ${req.params.connectionId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(req, res) {
    try {
      const { connectionId } = req.params;
      
      console.log('🎯 [AirflowController] deleteConnection() called for:', connectionId);
      
      const result = await airflowService.deleteConnection(connectionId);
      
      res.json({
        success: true,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error deleting connection ${req.params.connectionId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to delete connection ${req.params.connectionId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Test a connection
   */
  async testConnection(req, res) {
    try {
      const { connectionId } = req.params;
      
      console.log('🎯 [AirflowController] testConnection() called for:', connectionId);
      
      const result = await airflowService.testConnection(connectionId);
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error testing connection ${req.params.connectionId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to test connection ${req.params.connectionId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Health and Status Methods =====

  /**
   * Get Airflow connection status
   */
  async getConnectionStatus(req, res) {
    try {
      const status = await airflowService.getConnectionStatus();
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking Airflow connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check Airflow connection',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get Airflow health status
   */
  async getHealthStatus(req, res) {
    try {
      const health = await airflowService.getHealthStatus();
      
      res.json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking Airflow health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check Airflow health',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get the single latest report for a DAG across all phases from Blob
   */
  async getLatestReportFromBlob(req, res) {
    try {
      const { dagId } = req.params;
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
      if (!connectionString) throw new Error('AZURE_BLOB_CONNECTION_STRING not set');

      const containerName = 'datax-file-storage';
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);

      const isFlightTime = dagId === 'flight_time_analysis_report';
      const prefix = isFlightTime
        ? 'Output/Flight_Time_Report/'
        : 'Output/Weekly_Inflight_Report/Reports/';
      const reportType = dagId.replace(/_report$/, '').replace(/_dag$/, '');

      let latest = null;

      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        if (!blob.name.endsWith('.html') && !blob.name.endsWith('.pdf') && !blob.name.endsWith('.xlsx')) continue;
        const filename = blob.name.split('/').pop();
        if (!filename.toLowerCase().includes(reportType.toLowerCase())) continue;

        if (!latest || blob.properties.lastModified > latest.lastModified) {
          latest = {
            filename,
            blobPath: blob.name,
            timestamp: blob.properties.lastModified?.toISOString(),
            size: blob.properties.contentLength,
            url: `/api/airflow/blob-report?path=${encodeURIComponent(blob.name)}`,
            lastModified: blob.properties.lastModified
          };
        }
      }

      if (!latest) {
        return res.json({ success: true, data: null, timestamp: new Date().toISOString() });
      }

      delete latest.lastModified;
      res.json({ success: true, data: latest, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Error fetching latest blob report:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch latest report', error: error.message, timestamp: new Date().toISOString() });
    }
  }

  /**
   * Get reports from Azure Blob for a DAG + phase
   */
  async getReportsFromBlob(req, res) {
    try {
      const { dagId } = req.params;
      const { phase } = req.query;

      if (!phase) {
        return res.status(400).json({
          success: false,
          message: 'phase query parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      const reports = await airflowService.getReportsFromBlob(dagId, phase);

      res.json({
        success: true,
        data: reports,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching blob reports:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch reports from blob',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Stream a blob report file
   */
  async streamBlobReport(req, res) {
    try {
      const { path: blobPath } = req.query;

      if (!blobPath) {
        return res.status(400).json({
          success: false,
          message: 'path query parameter is required',
          timestamp: new Date().toISOString()
        });
      }

      await airflowService.streamBlobReport(blobPath, res);
    } catch (error) {
      console.error('Error streaming blob report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stream report',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Report Management Methods =====

  /**
   * Get the latest report for a DAG
   */
  async getLatestReport(req, res) {
    try {
      const { dagId } = req.params;
      
      const report = await airflowService.getLatestReport(dagId);
      
      if (!report) {
        return res.json({
          success: true,
          data: null,
          message: 'No reports found for this DAG',
          timestamp: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching latest report for ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch latest report for ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get all reports for a DAG
   */
  async getReports(req, res) {
    try {
      const { dagId } = req.params;
      
      const reports = await airflowService.getReports(dagId);
      
      res.json({
        success: true,
        data: reports,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error fetching reports for ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch reports for ${req.params.dagId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Serve a specific report file
   */
  async serveReport(req, res) {
    try {
      const { dagId, filename } = req.params;
      
      const filePath = await airflowService.getReportFilePath(dagId, filename);
      
      // Send the file
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('Error sending report file:', err);
          res.status(404).json({
            success: false,
            message: 'Report file not found',
            error: err.message,
            timestamp: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      console.error(`Error serving report ${req.params.filename} for ${req.params.dagId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to serve report file',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===== Data Discovery Methods =====

  /**
   * Get available phases from input directory
   */
  async getAvailablePhases(req, res) {
    try {
      console.log('🎯 [AirflowController] getAvailablePhases() called');
      
      const phases = await airflowService.getAvailablePhases();
      
      res.json({
        success: true,
        data: phases,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ [AirflowController] Error in getAvailablePhases:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available phases',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get available dates for a specific phase
   */
  async getAvailableDates(req, res) {
    try {
      const { phaseId } = req.params;
      console.log('🎯 [AirflowController] getAvailableDates() called for phase:', phaseId);
      
      const dates = await airflowService.getAvailableDates(phaseId);
      
      res.json({
        success: true,
        data: dates,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [AirflowController] Error in getAvailableDates for ${req.params.phaseId}:`, error);
      res.status(500).json({
        success: false,
        message: `Failed to fetch available dates for phase ${req.params.phaseId}`,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default new AirflowController();