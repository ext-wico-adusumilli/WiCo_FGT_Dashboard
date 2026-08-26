import { useState, useEffect, useCallback, useRef } from 'react';
import { DagStatus, DagFilter, AirflowConnectionStatus } from '../types/airflow';
import { airflowService } from '../services/airflowService';

interface UseDAGPollingOptions {
  enabled?: boolean;
  interval?: number;
  filter?: DagFilter;
  onError?: (error: Error) => void;
  onConnectionChange?: (status: AirflowConnectionStatus) => void;
}

interface UseDAGPollingReturn {
  dags: DagStatus[];
  loading: boolean;
  error: Error | null;
  connectionStatus: AirflowConnectionStatus | null;
  refetch: (silent?: boolean) => Promise<void>;
  silentRefetch: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

export function useDAGPolling(options: UseDAGPollingOptions = {}): UseDAGPollingReturn {
  const {
    enabled = false, // Changed default to false - no auto-polling
    interval = 5000,
    filter,
    onError,
    onConnectionChange
  } = options;

  const [dags, setDags] = useState<DagStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<AirflowConnectionStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const initialFetchDoneRef = useRef(false); // Track if initial fetch is done
  const maxRetries = 3;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    initialFetchDoneRef.current = false; // Reset on mount
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const status = await airflowService.getConnectionStatus();
      
      if (!mountedRef.current) return false;
      
      setConnectionStatus(status);
      onConnectionChange?.(status);
      
      return status.isConnected;
    } catch (err) {
      const connectionError: AirflowConnectionStatus = {
        isConnected: false,
        lastChecked: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Connection check failed'
      };
      
      if (!mountedRef.current) return false;
      
      setConnectionStatus(connectionError);
      onConnectionChange?.(connectionError);
      
      return false;
    }
  }, [onConnectionChange]);

  const fetchDags = useCallback(async (): Promise<void> => {
    console.log('🎯 [useDAGPolling] fetchDags() called');
    console.log('🔍 [useDAGPolling] Current filter:', filter);
    console.log('🏠 [useDAGPolling] Component mounted:', mountedRef.current);
    
    try {
      setError(null);
      
      console.log('🔗 [useDAGPolling] Checking connection...');
      // Check connection first, but don't fail if it's not connected
      // We'll still try to fetch DAGs as the backend might have fallback data
      await checkConnection();

      console.log('📡 [useDAGPolling] Calling airflowService.getDags()...');
      const startTime = Date.now();
      const dagsData = await airflowService.getDags(filter);
      const endTime = Date.now();
      
      console.log('🏠 [useDAGPolling] Component still mounted after fetch:', mountedRef.current);
      
      if (!mountedRef.current) {
        console.log('⚠️ [useDAGPolling] Component unmounted, ignoring response');
        return;
      }
      
      console.log('✅ [useDAGPolling] DAGs fetched successfully in', endTime - startTime, 'ms');
      console.log('📊 [useDAGPolling] Received', dagsData.length, 'DAGs');
      
      setDags(dagsData);
      setLoading(false);
      retryCountRef.current = 0; // Reset retry count on success
      
      console.log('🎉 [useDAGPolling] State updated successfully');
      
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch DAGs');
      
      console.error('❌ [useDAGPolling] Error fetching DAGs:', fetchError.message);
      console.error('🔍 [useDAGPolling] Error stack:', fetchError.stack);
      console.log('🏠 [useDAGPolling] Component mounted during error:', mountedRef.current);
      
      if (!mountedRef.current) {
        console.log('⚠️ [useDAGPolling] Component unmounted, ignoring error');
        return;
      }
      
      setError(fetchError);
      setLoading(false);
      onError?.(fetchError);
      
      // Increment retry count
      retryCountRef.current += 1;
      console.log('🔄 [useDAGPolling] Retry count:', retryCountRef.current, '/', maxRetries);
      
      // If we've exceeded max retries, stop polling temporarily
      if (retryCountRef.current >= maxRetries && isPolling) {
        console.warn('⚠️ [useDAGPolling] Max retries exceeded, stopping polling temporarily');
        stopPolling();
        
        // Restart polling after a longer delay
        setTimeout(() => {
          if (mountedRef.current && enabled) {
            console.log('🔄 [useDAGPolling] Restarting polling after delay');
            retryCountRef.current = 0;
            startPolling();
          }
        }, 30000); // 30 seconds
      }
    }
  }, [filter, onError, checkConnection, isPolling, enabled]);

  const startPolling = useCallback(() => {
    console.log('🚀 [useDAGPolling] Starting polling...');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsPolling(true);
    
    // Initial fetch
    fetchDags();
    
    // Set up polling interval
    intervalRef.current = setInterval(() => {
      console.log('⏰ [useDAGPolling] Interval tick, checking mount status:', mountedRef.current);
      if (mountedRef.current) {
        fetchDags();
      } else {
        console.log('⚠️ [useDAGPolling] Component unmounted, clearing interval');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, interval);
    
    console.log('✅ [useDAGPolling] Polling started with interval:', interval);
  }, [fetchDags, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const refetch = useCallback(async (silent: boolean = false): Promise<void> => {
    if (!silent) {
      setLoading(true);
    }
    await fetchDags();
  }, [fetchDags]);

  const silentRefetch = useCallback(async (): Promise<void> => {
    await fetchDags();
  }, [fetchDags]);

  // Simple initial fetch effect - runs only once on mount
  useEffect(() => {
    if (!initialFetchDoneRef.current) {
      console.log('🎯 [useDAGPolling] Doing initial fetch (no polling)');
      initialFetchDoneRef.current = true;
      
      // Inline fetch to avoid dependency issues
      const doInitialFetch = async () => {
        try {
          setError(null);
          setLoading(true);
          
          // Check connection first
          try {
            const status = await airflowService.getConnectionStatus();
            if (mountedRef.current) {
              setConnectionStatus(status);
              onConnectionChange?.(status);
            }
          } catch (err) {
            const connectionError: AirflowConnectionStatus = {
              isConnected: false,
              lastChecked: new Date().toISOString(),
              error: err instanceof Error ? err.message : 'Connection check failed'
            };
            if (mountedRef.current) {
              setConnectionStatus(connectionError);
              onConnectionChange?.(connectionError);
            }
          }

          // Fetch DAGs
          const dagsData = await airflowService.getDags(filter);
          
          if (mountedRef.current) {
            setDags(dagsData);
            setLoading(false);
            console.log('✅ [useDAGPolling] Initial fetch completed successfully');
          }
        } catch (err) {
          const fetchError = err instanceof Error ? err : new Error('Failed to fetch DAGs');
          console.error('❌ [useDAGPolling] Initial fetch failed:', fetchError.message);
          
          if (mountedRef.current) {
            setError(fetchError);
            setLoading(false);
            setDags([]); // Ensure empty array on error
            onError?.(fetchError);
          }
        }
      };
      
      doInitialFetch();
    }
  }, []); // Empty dependency array - runs only once

  // Handle enabled/disabled state changes
  useEffect(() => {
    if (enabled && !isPolling) {
      startPolling();
    } else if (!enabled && isPolling) {
      stopPolling();
    }
  }, [enabled, isPolling, startPolling, stopPolling]);

  // Handle filter changes
  useEffect(() => {
    console.log('🔄 [useDAGPolling] Filter changed:', filter);
    console.log('🔄 [useDAGPolling] Is polling:', isPolling);
    
    if (isPolling) {
      // Don't restart polling, just let the next interval pick up the new filter
      console.log('🔄 [useDAGPolling] Filter changed during polling, will use new filter on next fetch');
    }
  }, [filter]);

  return {
    dags,
    loading,
    error,
    connectionStatus,
    refetch,
    silentRefetch,
    startPolling,
    stopPolling,
    isPolling
  };
}

// Additional hook for managing DAG state transitions
export function useDAGStateTransitions() {
  const [transitioningDags, setTransitioningDags] = useState<Set<string>>(new Set());

  const addTransition = useCallback((dagId: string) => {
    setTransitioningDags(prev => new Set(prev).add(dagId));
  }, []);

  const removeTransition = useCallback((dagId: string) => {
    setTransitioningDags(prev => {
      const newSet = new Set(prev);
      newSet.delete(dagId);
      return newSet;
    });
  }, []);

  const isTransitioning = useCallback((dagId: string) => {
    return transitioningDags.has(dagId);
  }, [transitioningDags]);

  return {
    addTransition,
    removeTransition,
    isTransitioning
  };
}