import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { airflowService } from '../airflowService'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AirflowService', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getDags', () => {
    it('should fetch DAGs successfully', async () => {
      const mockDags = [
        {
          dagId: 'test_dag',
          displayName: 'Test DAG',
          description: 'Test description',
          isActive: true,
          isPaused: false,
          lastRunStatus: 'success'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockDags })
      })

      const result = await airflowService.getDags()

      expect(mockFetch).toHaveBeenCalledWith('/api/airflow/dags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer ')
        }
      })
      expect(result).toEqual(mockDags)
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })

      await expect(airflowService.getDags()).rejects.toThrow('HTTP 500: Internal Server Error')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(airflowService.getDags()).rejects.toThrow('Network error')
    })
  })

  describe('triggerDag', () => {
    it('should trigger DAG successfully', async () => {
      const mockResponse = {
        dagRunId: 'test_run_123',
        dagId: 'test_dag',
        state: 'running'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      })

      const result = await airflowService.triggerDag('test_dag', { param1: 'value1' })

      expect(mockFetch).toHaveBeenCalledWith('/api/airflow/dags/test_dag/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer ')
        },
        body: JSON.stringify({ conf: { param1: 'value1' } })
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('pauseDag', () => {
    it('should pause DAG successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'DAG paused successfully' })
      })

      await airflowService.pauseDag('test_dag')

      expect(mockFetch).toHaveBeenCalledWith('/api/airflow/dags/test_dag/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer ')
        }
      })
    })
  })

  describe('getConnectionStatus', () => {
    it('should get connection status successfully', async () => {
      const mockStatus = {
        isConnected: true,
        version: '2.8.1',
        responseTime: 150
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStatus })
      })

      const result = await airflowService.getConnectionStatus()

      expect(mockFetch).toHaveBeenCalledWith('/api/airflow/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer ')
        }
      })
      expect(result).toEqual(mockStatus)
    })
  })

  describe('createJob', () => {
    it('should create job successfully', async () => {
      const jobData = {
        name: 'Test Job',
        description: 'Test job description',
        scriptId: 'test_script',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        parameters: { param1: 'value1' }
      }

      const mockResponse = {
        jobId: 'job_123',
        ...jobData,
        status: 'created'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse })
      })

      const result = await airflowService.createJob(jobData)

      expect(mockFetch).toHaveBeenCalledWith('/api/airflow/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.stringContaining('Bearer ')
        },
        body: JSON.stringify(jobData)
      })
      expect(result).toEqual(mockResponse)
    })

    it('should validate required fields', async () => {
      const invalidJobData = {
        name: 'Test Job'
        // Missing required fields
      }

      await expect(airflowService.createJob(invalidJobData as any)).rejects.toThrow()
    })
  })
})