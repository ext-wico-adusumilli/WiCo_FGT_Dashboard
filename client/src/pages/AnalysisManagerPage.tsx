import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Search, RefreshCw, AlertTriangle, Maximize, Minimize, Database, CheckCircle, Play, XCircle, PauseCircle, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { DAGGrid } from '../components/analysis-manager/DAGGrid';
import { JobManagementPanel, JobManagementPanelRef } from '../components/analysis-manager/JobManagementPanel';
import { ConnectionStatus } from '../components/analysis-manager/ConnectionStatus';
import { AnalysisManagerErrorBoundary } from '../components/analysis-manager/ErrorBoundary';
import { useDAGPolling } from '../hooks/useDAGPolling';
import { airflowService } from '../services/airflowService';
import { DagFilter } from '../types/airflow';

export function AnalysisManagerPage() {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<DagFilter>({});
  const [activeTab, setActiveTab] = useState<'dags' | 'jobs'>('dags');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Partial<any>>>({});
  const [shouldPoll, setShouldPoll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const jobPanelRef = useRef<JobManagementPanelRef>(null);

  // Memoize the filter to prevent unnecessary re-renders
  const memoizedFilter = useMemo(() => ({
    ...filter,
    searchTerm: searchTerm || undefined
  }), [filter, searchTerm]);

  // Automatic DAG polling - only enabled when there are running DAGs
  const {
    dags: fetchedDags,
    loading,
    error,
    connectionStatus,
    refetch,
    silentRefetch
  } = useDAGPolling({
    enabled: shouldPoll, // Only poll when there are running DAGs
    interval: 5000, // Poll every 5 seconds when enabled
    filter: memoizedFilter,
    onError: (error) => {
      showToast(`Failed to fetch DAGs: ${error.message}`, 'error');
    }
  });

  // Apply optimistic updates to DAGs
  const dags = useMemo(() => {
    return fetchedDags
      .map(dag => ({
        ...dag,
        ...(optimisticUpdates[dag.dagId] || {})
      }))
      .filter(dag => !(optimisticUpdates[dag.dagId]?._deleted));
  }, [fetchedDags, optimisticUpdates]);

  // Enable/disable polling based on running DAGs
  useEffect(() => {
    const runningCount = dags.reduce((sum, dag) => sum + dag.runningCount, 0);
    const hasRunning = runningCount > 0;
    
    if (hasRunning !== shouldPoll) {
      console.log(`🔄 Polling ${hasRunning ? 'enabled' : 'disabled'} - Running DAGs: ${runningCount}`);
      setShouldPoll(hasRunning);
    }
  }, [dags, shouldPoll]);

  // Client-side filtering of DAGs
  const filteredDags = useMemo(() => {
    let result = dags;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(dag => 
        dag.dagId.toLowerCase().includes(searchLower) ||
        dag.displayName?.toLowerCase().includes(searchLower) ||
        dag.description?.toLowerCase().includes(searchLower) ||
        dag.tags.some(tag => {
          // Handle both string tags and object tags
          if (typeof tag === 'string') {
            return tag.toLowerCase().includes(searchLower);
          } else if (tag && typeof tag === 'object') {
            const tagName = tag.name || JSON.stringify(tag);
            return tagName.toLowerCase().includes(searchLower);
          }
          return false;
        })
      );
    }

    // Apply active/paused filter
    if (filter.active === true) {
      result = result.filter(dag => !dag.isPaused && dag.isActive);
    }
    if (filter.paused === true) {
      result = result.filter(dag => dag.isPaused);
    }

    // Apply state filters (running, failed, etc.)
    if (filter.states && filter.states.length > 0) {
      result = result.filter(dag => {
        // Check if any of the DAG's recent runs match the selected states
        return dag.recentRuns.some(run => filter.states?.includes(run.state));
      });
    }

    return result;
  }, [dags, searchTerm, filter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredDags.length / pageSize);
  const paginatedDags = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredDags.slice(startIndex, endIndex);
  }, [filteredDags, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((newFilter: Partial<DagFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  // DAG control handlers with optimistic updates
  const handleTriggerDag = useCallback(async (dagId: string, config?: Record<string, any>) => {
    try {
      await airflowService.triggerDag(dagId, config);
      showToast(`DAG "${dagId}" triggered successfully`, 'success');
      // Silent refresh and enable polling to track the running DAG
      await silentRefetch();
      setShouldPoll(true);
    } catch (error) {
      throw error; // Let the component handle the error display
    }
  }, [silentRefetch, showToast]);

  const handlePauseDag = useCallback(async (dagId: string) => {
    // Optimistic update - update UI immediately
    setOptimisticUpdates(prev => ({
      ...prev,
      [dagId]: { isPaused: true }
    }));
    
    try {
      await airflowService.pauseDag(dagId);
      showToast(`DAG "${dagId}" paused successfully`, 'success');
      // Silent refresh in background - optimistic update will be cleared when new data arrives
      await silentRefetch();
      // Clear optimistic update after refresh completes
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
      showToast(`Failed to pause DAG "${dagId}"`, 'error');
      throw error;
    }
  }, [silentRefetch, showToast]);

  const handleUnpauseDag = useCallback(async (dagId: string) => {
    // Optimistic update
    setOptimisticUpdates(prev => ({
      ...prev,
      [dagId]: { isPaused: false }
    }));
    
    try {
      await airflowService.unpauseDag(dagId);
      showToast(`DAG "${dagId}" unpaused successfully`, 'success');
      // Silent refresh in background - optimistic update will be cleared when new data arrives
      await silentRefetch();
      // Clear optimistic update after refresh completes
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
      showToast(`Failed to unpause DAG "${dagId}"`, 'error');
      throw error;
    }
  }, [silentRefetch, showToast]);

  const handleDeleteDag = useCallback(async (dagId: string) => {
    // Optimistic update - remove from list immediately
    setOptimisticUpdates(prev => ({
      ...prev,
      [dagId]: { _deleted: true }
    }));
    
    try {
      await airflowService.deleteDag(dagId);
      showToast(`DAG "${dagId}" deleted successfully`, 'success');
      // Silent refresh in background to get updated list
      await silentRefetch();
      // Clear optimistic update after refresh completes
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      const error = err as Error;
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const { [dagId]: _, ...rest } = prev;
        return rest;
      });
      showToast(`Failed to delete DAG "${dagId}": ${error.message}`, 'error');
      throw error;
    }
  }, [silentRefetch, showToast]);

  const handleRetryConnection = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRefresh = useCallback(async (e?: React.MouseEvent) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsRefreshing(true);
    try {
      if (activeTab === 'dags') {
        await refetch();
        showToast('DAG status refreshed', 'success');
      } else {
        // Call job panel refetch via ref
        if (jobPanelRef.current) {
          jobPanelRef.current.refresh();
          showToast('Jobs refreshed', 'success');
        }
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      showToast('Failed to refresh', 'error');
    } finally {
      // Reset refreshing state after a short delay
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refetch, showToast, activeTab]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className={`${isFullscreen ? 'h-full flex flex-col' : 'max-w-7xl mx-auto'} px-4 py-2`}>
        {/* Header */}
        <div className="mb-8">
          {/* Single Line Header with all controls */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Left side: Tabs and Search */}
            <div className="flex items-center gap-2.5">
              {/* Tab Navigation */}
              <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setActiveTab('dags')}
                  className={`
                    px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${activeTab === 'dags'
                      ? theme === 'dark'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  DAG Workflows
                </button>
                <button
                  onClick={() => setActiveTab('jobs')}
                  className={`
                    px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${activeTab === 'jobs'
                      ? theme === 'dark'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }
                  `}
                >
                  Analysis Jobs
                </button>
              </div>

              {/* Search - Only show for DAGs tab */}
              {activeTab === 'dags' && (
                <div className="relative w-60">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search DAGs..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className={`
                      w-full pl-9 pr-3 py-1.5 rounded-lg border text-sm
                      ${theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                      }
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    `}
                  />
                </div>
              )}
            </div>

            {/* Right side: Action Buttons and Connection Status */}
            <div className="flex items-center gap-2.5">
              {/* Refresh and Fullscreen Buttons */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || isRefreshing}
                className={`
                  flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  ${theme === 'dark'
                    ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                  ${(loading || isRefreshing) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <RefreshCw className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
                {activeTab === 'dags' ? 'Refresh DAGs' : 'Refresh Jobs'}
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`
                  p-1.5 rounded-lg transition-colors
                  ${theme === 'dark'
                    ? 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              {/* Connection Status */}
              <ConnectionStatus 
                status={connectionStatus} 
                onRetry={handleRetryConnection}
                showTroubleshooting={true}
              />
            </div>
          </div>

          {/* Status Summary Cards - Clickable filters for DAGs tab when connected (no error) */}
          {activeTab === 'dags' && dags.length > 0 && !error && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {/* Total DAGs - Not filterable */}
              <div className={`border rounded-lg p-3 sm:p-4 ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-300'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-5 h-5 text-[#3EC1C5]" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total DAGs
                  </p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {dags.length}
                </p>
              </div>
              
              {/* Active - Clickable filter */}
              <button
                onClick={() => {
                  handleFilterChange({ 
                    active: filter.active === true ? undefined : true,
                    paused: undefined // Clear paused when active is selected
                  });
                }}
                className={`border rounded-lg p-3 sm:p-4 text-left transition ${
                  theme === 'dark' 
                    ? 'bg-gray-800' 
                    : 'bg-white'
                } ${
                  theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                } ${
                  filter.active === true 
                    ? theme === 'dark'
                      ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                      : 'border-gray-900 ring-2 ring-gray-900/50'
                    : theme === 'dark'
                      ? 'border-gray-700'
                      : 'border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Active
                  </p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {dags.filter(dag => !dag.isPaused && dag.isActive).length}
                </p>
              </button>
              
              {/* Running - Clickable filter */}
              <button
                onClick={() => {
                  const currentStates = filter.states || [];
                  const hasRunning = currentStates.includes('running');
                  const newStates = hasRunning
                    ? currentStates.filter(s => s !== 'running')
                    : [...currentStates, 'running'];
                  handleFilterChange({ 
                    states: newStates.length > 0 ? newStates as any : undefined 
                  });
                }}
                className={`border rounded-lg p-3 sm:p-4 text-left transition ${
                  theme === 'dark' 
                    ? 'bg-gray-800' 
                    : 'bg-white'
                } ${
                  theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                } ${
                  filter.states?.includes('running')
                    ? theme === 'dark'
                      ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                      : 'border-gray-900 ring-2 ring-gray-900/50'
                    : theme === 'dark'
                      ? 'border-gray-700'
                      : 'border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Play className="w-5 h-5 text-blue-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Running
                  </p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {dags.reduce((sum, dag) => sum + dag.runningCount, 0)}
                </p>
              </button>
              
              {/* Failed - Clickable filter */}
              <button
                onClick={() => {
                  const currentStates = filter.states || [];
                  const hasFailed = currentStates.includes('failed');
                  const newStates = hasFailed
                    ? currentStates.filter(s => s !== 'failed')
                    : [...currentStates, 'failed'];
                  handleFilterChange({ 
                    states: newStates.length > 0 ? newStates as any : undefined 
                  });
                }}
                className={`border rounded-lg p-3 sm:p-4 text-left transition ${
                  theme === 'dark' 
                    ? 'bg-gray-800' 
                    : 'bg-white'
                } ${
                  theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                } ${
                  filter.states?.includes('failed')
                    ? theme === 'dark'
                      ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                      : 'border-gray-900 ring-2 ring-gray-900/50'
                    : theme === 'dark'
                      ? 'border-gray-700'
                      : 'border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Failed
                  </p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {dags.reduce((sum, dag) => sum + dag.failedCount, 0)}
                </p>
              </button>
              
              {/* Paused - Clickable filter */}
              <button
                onClick={() => {
                  handleFilterChange({ 
                    paused: filter.paused === true ? undefined : true,
                    active: undefined // Clear active when paused is selected
                  });
                }}
                className={`border rounded-lg p-3 sm:p-4 text-left transition ${
                  theme === 'dark' 
                    ? 'bg-gray-800' 
                    : 'bg-white'
                } ${
                  theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                } ${
                  filter.paused === true
                    ? theme === 'dark'
                      ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                      : 'border-gray-900 ring-2 ring-gray-900/50'
                    : theme === 'dark'
                      ? 'border-gray-700'
                      : 'border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <PauseCircle className="w-5 h-5 text-orange-500" />
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Paused
                  </p>
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {dags.filter(dag => dag.isPaused).length}
                </p>
              </button>
            </div>
          )}
          
          {/* Clear Filters Button - Show when any filter is active */}
          {activeTab === 'dags' && (filter.active || filter.paused || filter.states?.length) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  setFilter({});
                  setCurrentPage(1);
                }}
                className={`
                  text-sm px-3 py-1.5 rounded-lg transition-colors
                  ${theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                `}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <AnalysisManagerErrorBoundary>
          <div className={isFullscreen ? 'flex-1 overflow-auto pt-4' : ''}>
            {/* DAG Workflows Tab */}
            <div className={activeTab === 'dags' ? 'block' : 'hidden'}>
            <>
              {/* Error State - Only show error, no DAGs */}
              {error && !loading ? (
                <div className={`p-6 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`
                      flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                      ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'}
                    `}>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold mb-2 ${
                        theme === 'dark' ? 'text-red-400' : 'text-red-700'
                      }`}>
                        Unable to Connect to Airflow
                      </h3>
                      <p className={`text-sm mb-3 ${
                        theme === 'dark' ? 'text-red-300' : 'text-red-600'
                      }`}>
                        {error.message}
                      </p>
                      
                      {/* Suggested actions */}
                      <div className={`text-sm mb-4 ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <p className="font-medium mb-2">Possible solutions:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Check if Apache Airflow is running and accessible</li>
                          <li>Verify the API URL configuration in environment settings</li>
                          <li>Ensure network connectivity to the Airflow server</li>
                          <li>Check authentication credentials and permissions</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleRefresh}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                            transition-colors duration-200
                            ${theme === 'dark'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                            }
                          `}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry Connection
                        </button>
                        
                        {/* <button
                          onClick={() => {
                            // Could open settings or configuration panel
                            showToast('Configuration panel not yet implemented', 'info');
                          }}
                          className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                            transition-colors duration-200
                            ${theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }
                          `}
                        >
                          <Settings className="w-4 h-4" />
                          Check Settings
                        </button> */}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Show DAGs only when connected (no error) */
                <>
                  <DAGGrid
                    dags={paginatedDags}
                    onTriggerDag={handleTriggerDag}
                    onPauseDag={handlePauseDag}
                    onUnpauseDag={handleUnpauseDag}
                    onDeleteDag={handleDeleteDag}
                    loading={loading}
                    hasFilters={!!searchTerm || !!filter.active || !!filter.paused || (filter.states?.length ?? 0) > 0}
                    pageOffset={(currentPage - 1) * pageSize}
                  />

                  {/* Pagination Controls - Bottom */}
                  {filteredDags.length > 0 && (
                    <div className={`flex items-center justify-between mt-4 px-2 py-3 rounded-lg ${
                      theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                    }`}>
                      {/* Left: info + per-page */}
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredDags.length)} of {filteredDags.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Per page:</span>
                          <CustomSelect
                            value={String(pageSize)}
                            onChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}
                            options={[
                              { value: '5', label: '5' },
                              { value: '10', label: '10' },
                              { value: '20', label: '20' },
                              { value: '50', label: '50' },
                              { value: '100', label: '100' },
                            ]}
                            className="w-20"
                          />
                        </div>
                      </div>

                      {/* Right: << < 1 2 3 … > >> */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          {/* First */}
                          <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentPage === 1
                                ? 'opacity-40 cursor-not-allowed'
                                : theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                            }`}
                            title="First page"
                          >
                            <ChevronsLeft className="w-4 h-4" />
                          </button>
                          {/* Prev */}
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentPage === 1
                                ? 'opacity-40 cursor-not-allowed'
                                : theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                            }`}
                            title="Previous page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          {/* Page number buttons */}
                          {(() => {
                            const delta = 2;
                            const pages: (number | '...')[] = [];
                            for (let i = 1; i <= totalPages; i++) {
                              if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                                pages.push(i);
                              } else if (pages[pages.length - 1] !== '...') {
                                pages.push('...');
                              }
                            }
                            return pages.map((p, idx) =>
                              p === '...' ? (
                                <span key={`ellipsis-${idx}`} className={`px-1.5 text-sm select-none ${
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                }`}>…</span>
                              ) : (
                                <button
                                  key={p}
                                  onClick={() => setCurrentPage(p as number)}
                                  className={`min-w-[2rem] h-8 px-2 rounded-lg text-sm font-medium transition-colors ${
                                    currentPage === p
                                      ? theme === 'dark'
                                        ? 'bg-[#3EC1C5] text-gray-900'
                                        : 'bg-gray-900 text-white'
                                      : theme === 'dark'
                                        ? 'text-gray-300 hover:bg-gray-700'
                                        : 'text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {p}
                                </button>
                              )
                            );
                          })()}

                          {/* Next */}
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentPage === totalPages
                                ? 'opacity-40 cursor-not-allowed'
                                : theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                            }`}
                            title="Next page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          {/* Last */}
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentPage === totalPages
                                ? 'opacity-40 cursor-not-allowed'
                                : theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                            }`}
                            title="Last page"
                          >
                            <ChevronsRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
            </div>

            {/* Analysis Jobs Tab */}
            <div className={activeTab === 'jobs' ? 'block' : 'hidden'}>
            <JobManagementPanel
              ref={jobPanelRef}
              onViewJobDetails={(jobId) => {
                showToast(`Viewing job details for ${jobId}`, 'info');
              }}
            />
            </div>
          </div>
        </AnalysisManagerErrorBoundary>
      </div>
    </div>
  );
}