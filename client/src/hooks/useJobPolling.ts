import { useState, useEffect, useCallback, useRef } from 'react';
import { airflowService } from '../services/airflowService';
import { Job, JobFilter } from '../types/airflow';

interface UseJobPollingOptions {
  enabled?: boolean;
  filter?: JobFilter;
  pollInterval?: number;
  onError?: (error: Error) => void;
}

interface UseJobPollingReturn {
  jobs: Job[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  silentRefetch: () => Promise<void>;
  isPolling: boolean;
}

export function useJobPolling({
  enabled = false,
  filter,
  pollInterval = 10000, // Default to 10 seconds
  onError
}: UseJobPollingOptions = {}): UseJobPollingReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false); // Start with false
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const initialFetchDoneRef = useRef(false);
  const onErrorRef = useRef(onError);
  
  // Update onError ref when it changes
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const fetchedJobs = await airflowService.getJobs(filter);
      
      if (mountedRef.current) {
        const jobsArray = Array.isArray(fetchedJobs) ? fetchedJobs : [];
        setJobs(jobsArray);
        console.log(`✅ [useJobPolling] Fetched ${jobsArray.length} jobs`);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch jobs');
      
      if (mountedRef.current) {
        setError(error);
        setJobs([]);
        if (onErrorRef.current) {
          onErrorRef.current(error);
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filter]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchJobs();
  }, [fetchJobs]);

  const silentRefetch = useCallback(async () => {
    // Refetch without showing loading state
    await fetchJobs();
  }, [fetchJobs]);

  const startPolling = useCallback(() => {
    if (!enabled || intervalRef.current) return;

    console.log(`🔄 [useJobPolling] Starting polling (interval: ${pollInterval}ms)`);
    setIsPolling(true);
    
    // Don't fetch immediately if initial fetch is done
    if (!initialFetchDoneRef.current) {
      fetchJobs();
    }

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      console.log('🔄 [useJobPolling] Polling tick...');
      fetchJobs();
    }, pollInterval);
  }, [enabled, fetchJobs, pollInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log('⏸️ [useJobPolling] Stopping polling');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    initialFetchDoneRef.current = false;
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  // Initial fetch when component mounts
  useEffect(() => {
    if (!initialFetchDoneRef.current) {
      console.log('🎯 [useJobPolling] Initial fetch');
      initialFetchDoneRef.current = true;
      setLoading(true);
      fetchJobs();
    }
  }, [fetchJobs]);

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }
    
    // Cleanup on unmount or when enabled changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, startPolling, stopPolling]);

  // Don't refetch when filter changes if polling is enabled (polling will handle it)
  // Only refetch manually when filter changes and polling is disabled
  useEffect(() => {
    if (!enabled && initialFetchDoneRef.current) {
      console.log('🔄 [useJobPolling] Filter changed, refetching...');
      fetchJobs();
    }
  }, [filter, enabled, fetchJobs]);

  return {
    jobs,
    loading,
    error,
    refetch,
    silentRefetch,
    isPolling
  };
}