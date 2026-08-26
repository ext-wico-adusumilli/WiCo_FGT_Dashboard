import { useState } from 'react';
import { Play, Calendar, Clock, Tag, Trash2, Eye, FileText } from 'lucide-react';
import { DagStatus, DagRunState } from '../../types/airflow';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { airflowService } from '../../services/airflowService';

interface DAGListViewProps {
  dags: DagStatus[];
  onTriggerDag: (dagId: string) => void;
  onPauseDag: (dagId: string) => void;
  onUnpauseDag: (dagId: string) => void;
  onDeleteDag: (dagId: string) => void;
  loading?: boolean;
  pageOffset?: number;
}

export function DAGListView({ dags, onTriggerDag, onPauseDag, onUnpauseDag, onDeleteDag, loading = false, pageOffset = 0 }: DAGListViewProps) {
  const { theme } = useTheme();

  if (loading) {
    return <DAGListSkeleton />;
  }

  if (dags.length === 0) {
    return (
      <div className={`text-center py-12 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        <p>No DAGs found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border overflow-hidden ${
      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
    }`}>
      {/* Table Header */}
      <div className={`hidden lg:flex items-center border-b font-semibold text-sm ${
        theme === 'dark' 
          ? 'bg-gray-800/80 border-gray-700 text-gray-300' 
          : 'bg-gray-50 border-gray-200 text-gray-700'
      }`}>
        <div className="w-12 flex-shrink-0 px-4 py-3">S.No</div>
        <div className="flex-[2.5] min-w-0 px-4 py-3">DAG</div>
        <div className="flex-[0.8] min-w-0 py-3">RUNS</div>
        <div className="flex-[0.8] min-w-0 pl-14 py-3">SCHEDULE</div>
        <div className="flex-[1.2] min-w-0 pl-12 py-3">LATEST RUN</div>
        <div className="flex-[1.2] min-w-0 pl-10 py-3">NEXT RUN</div>
        <div className="flex-[1.5] min-w-0 pl-10 py-3">LAST 10 RUNS</div>
        <div className="w-40 flex-shrink-0 pl-2 py-3">ACTIONS</div>
      </div>

      {/* Table Body */}
      <div className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
        {dags.map((dag, index) => (
          <DAGListItem
            key={dag.dagId}
            dag={dag}
            serialNo={pageOffset + index + 1}
            onTrigger={() => onTriggerDag(dag.dagId)}
            onPause={() => onPauseDag(dag.dagId)}
            onUnpause={() => onUnpauseDag(dag.dagId)}
            onDelete={() => onDeleteDag(dag.dagId)}
          />
        ))}
      </div>
    </div>
  );
}

interface DAGListItemProps {
  dag: DagStatus;
  serialNo: number;
  onTrigger: () => void;
  onPause: () => void;
  onUnpause: () => void;
  onDelete: () => void;
}

function DAGListItem({ dag, serialNo, onTrigger, onPause, onUnpause, onDelete }: DAGListItemProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const handleViewReport = async () => {
    setLoadingReport(true);
    try {
      const response = await fetch(`/api/airflow/reports/${dag.dagId}/blob/latest`);
      const data = await response.json();
      if (data.success && data.data?.url) {
        const isXlsx = data.data.filename?.endsWith('.xlsx');
        if (isXlsx) {
          const a = document.createElement('a');
          a.href = data.data.url;
          a.download = data.data.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          window.open(data.data.url, '_blank');
        }
      } else {
        showToast('No report available for this DAG yet', 'info');
      }
    } catch (error) {
      showToast('Failed to fetch report', 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  const getStatusColor = (status?: DagRunState) => {
    switch (status) {
      case 'success':
        return theme === 'dark' ? 'text-green-400' : 'text-green-600';
      case 'failed':
        return theme === 'dark' ? 'text-red-400' : 'text-red-600';
      case 'running':
        return theme === 'dark' ? 'text-blue-400' : 'text-blue-600';
      case 'queued':
        return theme === 'dark' ? 'text-orange-400' : 'text-orange-600';
      case 'up_for_retry':
        return theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
      case 'up_for_reschedule':
        return theme === 'dark' ? 'text-purple-400' : 'text-purple-600';
      case 'skipped':
        return theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
      default:
        return theme === 'dark' ? 'text-gray-500' : 'text-gray-400';
    }
  };

  const getStatusDot = (status?: DagRunState) => {
    const colorClass = getStatusColor(status);
    return (
      <div className={`w-2 h-2 rounded-full ${colorClass.replace('text-', 'bg-')} ${
        status === 'running' ? 'animate-pulse' : ''
      }`} />
    );
  };

  const formatDateTime = (dateTime?: string) => {
    if (!dateTime) return 'Never';
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getScheduleDisplay = (schedule?: any) => {
    if (!schedule) return 'None';
    if (typeof schedule === 'string') return schedule;
    if (schedule.value) return schedule.value;
    if (schedule.name) return schedule.name;
    if (typeof schedule === 'object') return JSON.stringify(schedule);
    return 'Custom';
  };

  // Get last 10 runs, sorted by execution date (most recent first)
  const lastTenRuns = [...dag.recentRuns]
    .sort((a, b) => new Date(b.executionDate).getTime() - new Date(a.executionDate).getTime())
    .slice(0, 10);

  return (
    <>
      {/* Large screens: Table row layout */}
      <div className={`hidden lg:flex items-center transition-colors ${
        theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
      }`}>
        {/* S.No */}
        <div className={`w-12 flex-shrink-0 px-4 py-3 text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {serialNo}
        </div>
        {/* DAG Name and Tags */}
        <div className="flex-[2.5] min-w-0 px-4 py-3">
          <h3 className={`font-medium text-sm mb-1 truncate ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {dag.dagId}
          </h3>
          {/* Tags */}
          {dag.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {dag.tags.slice(0, 4).map((tag, index) => (
                <span
                  key={typeof tag === 'string' ? tag : index}
                  className={`px-1.5 py-0.5 text-xs rounded ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {typeof tag === 'string' ? tag : (tag?.name || JSON.stringify(tag))}
                </span>
              ))}
              {dag.tags.length > 4 && (
                <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  +{dag.tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Run Statistics */}
        <div className={`flex-[0.8] min-w-0 py-3 flex items-center gap-1`}>
          {/* Success Circle */}
          <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-green-500"></div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dag.successCount}</span>
          </div>
          
          {/* Failed Circle */}
          <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-red-500"></div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dag.failedCount}</span>
          </div>
          
          {/* Running Circle */}
          <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-blue-500"></div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{dag.runningCount}</span>
          </div>
        </div>

        {/* Schedule */}
        <div className={`flex-[0.8] min-w-0 pl-14 py-3 text-sm truncate ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {getScheduleDisplay(dag.scheduleInterval)}
        </div>

        {/* Latest Run */}
        <div className={`flex-[1.2] min-w-0 pl-12 py-3 text-sm truncate ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {formatDateTime(dag.lastRunTime)}
        </div>

        {/* Next Run */}
        <div className={`flex-[1.2] min-w-0 pl-10 py-3 text-sm truncate ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          {dag.nextRunTime ? formatDateTime(dag.nextRunTime) : 'Not scheduled'}
        </div>

        {/* Last 10 Runs Chart */}
        <div className="flex-[1.5] min-w-0 pl-10 py-3">
          <div className="flex items-end gap-0.5 h-10">
            {lastTenRuns.length > 0 ? (
              lastTenRuns.map((run) => {
                const getBarColor = () => {
                  switch (run.state) {
                    case 'success':
                      return 'bg-green-500';
                    case 'failed':
                      return 'bg-red-500';
                    case 'running':
                      return 'bg-blue-500 animate-pulse';
                    case 'queued':
                      return 'bg-orange-500';
                    case 'up_for_retry':
                      return 'bg-yellow-500';
                    case 'up_for_reschedule':
                      return 'bg-purple-500';
                    case 'skipped':
                      return 'bg-gray-400';
                    default:
                      return 'bg-gray-300';
                  }
                };
                
                let height = 30;
                if (run.duration) {
                  const durations = lastTenRuns.filter(r => r.duration).map(r => r.duration || 0);
                  const maxDuration = Math.max(...durations, 1);
                  height = 30 + ((run.duration / maxDuration) * 70);
                } else if (run.endDate && run.startDate) {
                  const duration = (new Date(run.endDate).getTime() - new Date(run.startDate).getTime()) / 1000;
                  const durations = lastTenRuns
                    .filter(r => r.endDate && r.startDate)
                    .map(r => (new Date(r.endDate!).getTime() - new Date(r.startDate!).getTime()) / 1000);
                  const maxDuration = Math.max(...durations, 1);
                  height = 30 + ((duration / maxDuration) * 70);
                }
                
                return (
                  <div
                    key={run.dagRunId}
                    className={`w-2 transition-all rounded-t-sm ${getBarColor()}`}
                    style={{ height: `${height}%` }}
                    title={`${run.state} - ${new Date(run.executionDate).toLocaleString()}${run.duration ? ` - ${Math.round(run.duration)}s` : ''}`}
                  />
                );
              })
            ) : (
              <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                No runs
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="w-40 flex-shrink-0 pl-2 py-3 flex items-center gap-2">
          <button
            onClick={dag.isPaused ? onUnpause : onPause}
            disabled={!dag.isActive}
            className={`group relative flex items-center justify-center transition-all duration-150 ${!dag.isActive && 'cursor-not-allowed opacity-50'}`}
            title={dag.isPaused ? 'Unpause DAG' : 'Pause DAG'}
          >
            <div className={`relative w-9 h-5 rounded-full transition-all duration-200 ${dag.isPaused ? (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300') : 'bg-blue-500'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 transform ${dag.isPaused ? 'left-0.5' : 'left-4'}`} />
            </div>
          </button>
          <button 
            onClick={onTrigger} 
            disabled={!dag.isActive || dag.isPaused} 
            className={`flex items-center justify-center p-1.5 rounded transition-all duration-150 ${
              dag.isActive && !dag.isPaused 
                ? (theme === 'dark' ? 'hover:bg-gray-700 text-blue-400 hover:text-blue-300' : 'hover:bg-gray-100 text-blue-600 hover:text-blue-700') 
                : 'text-gray-400 cursor-not-allowed'
            }`} 
            title="Trigger DAG Run"
          >
            <Play className="w-4 h-4" />
          </button>
          <button 
            onClick={handleViewReport}
            disabled={loadingReport}
            className={`flex items-center justify-center p-1.5 rounded transition-all duration-150 ${
              theme === 'dark' ? 'hover:bg-gray-700 text-green-400 hover:text-green-300' : 'hover:bg-gray-100 text-green-600 hover:text-green-700'
            } ${loadingReport ? 'opacity-50 cursor-wait' : ''}`} 
            title="View Latest Report"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowDeleteDialog(true)} 
            className={`flex items-center justify-center p-1.5 rounded transition-all duration-150 ${
              theme === 'dark' ? 'hover:bg-gray-700 text-red-400 hover:text-red-300' : 'hover:bg-gray-100 text-red-600 hover:text-red-700'
            }`} 
            title="Delete DAG"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Small screens: Card layout */}
      <div className={`lg:hidden p-4 rounded-lg border ${
        theme === 'dark' 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Row 1: DAG Info and Actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className={`font-medium text-base truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {dag.dagId}
              </h3>
              <div className={`flex items-center gap-1.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{getScheduleDisplay(dag.scheduleInterval)}</span>
              </div>
              {dag.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className={`w-3 h-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                  {dag.tags.slice(0, 2).map((tag, index) => (
                    <span key={typeof tag === 'string' ? tag : index} className={`px-1.5 py-0.5 text-xs rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      {typeof tag === 'string' ? tag : (tag?.name || JSON.stringify(tag))}
                    </span>
                  ))}
                  {dag.tags.length > 2 && <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>+{dag.tags.length - 2}</span>}
                </div>
              )}
            </div>
            <div className={`flex items-center gap-3 text-xs flex-wrap ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Latest: {formatDateTime(dag.lastRunTime)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Next: {dag.nextRunTime ? formatDateTime(dag.nextRunTime) : 'Not scheduled'}</span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
            <button onClick={dag.isPaused ? onUnpause : onPause} disabled={!dag.isActive} className={`group relative flex items-center justify-center px-2 py-2 transition-all duration-150 ${!dag.isActive && 'cursor-not-allowed opacity-50'}`} title={dag.isPaused ? 'Unpause DAG' : 'Pause DAG'}>
              <div className={`relative w-10 h-5 rounded-full transition-all duration-200 ${dag.isPaused ? (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300') : 'bg-blue-500'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-200 transform ${dag.isPaused ? 'left-0.5' : 'left-5'}`} />
              </div>
            </button>
            <button onClick={onTrigger} disabled={!dag.isActive || dag.isPaused} className={`flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${dag.isActive && !dag.isPaused ? (theme === 'dark' ? 'hover:bg-gray-700 text-blue-400 hover:text-blue-300' : 'hover:bg-gray-100 text-blue-600 hover:text-blue-700') : 'text-gray-400 cursor-not-allowed'}`} title="Trigger DAG Run">
              <Play className="w-4 h-4" />
            </button>
            <button onClick={handleViewReport} disabled={loadingReport} className={`flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${theme === 'dark' ? 'hover:bg-gray-700 text-green-400 hover:text-green-300' : 'hover:bg-gray-100 text-green-600 hover:text-green-700'} ${loadingReport ? 'opacity-50 cursor-wait' : ''}`} title="View Latest Report">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={() => setShowDeleteDialog(true)} className={`flex items-center justify-center p-2 rounded-lg transition-all duration-150 ${theme === 'dark' ? 'hover:bg-gray-700 text-red-400 hover:text-red-300' : 'hover:bg-gray-100 text-red-600 hover:text-red-700'}`} title="Delete DAG">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Row 2: Chart and Statistics - Scrollable */}
        <div className="flex items-center gap-4 overflow-x-auto pb-1">
          <div className="flex-shrink-0">
            <div className="flex items-end justify-start gap-0.5 h-10 px-2">
              {lastTenRuns.length > 0 && lastTenRuns.map((run) => {
                const getBarColor = () => {
                  switch (run.state) {
                    case 'success': return 'bg-green-500';
                    case 'failed': return 'bg-red-500';
                    case 'running': return 'bg-blue-500 animate-pulse';
                    case 'queued': return 'bg-orange-500';
                    case 'up_for_retry': return 'bg-yellow-500';
                    case 'up_for_reschedule': return 'bg-purple-500';
                    case 'skipped': return 'bg-gray-400';
                    default: return 'bg-gray-300';
                  }
                };
                let height = 30;
                if (run.duration) {
                  const durations = lastTenRuns.filter(r => r.duration).map(r => r.duration || 0);
                  const maxDuration = Math.max(...durations, 1);
                  height = 30 + ((run.duration / maxDuration) * 70);
                } else if (run.endDate && run.startDate) {
                  const duration = (new Date(run.endDate).getTime() - new Date(run.startDate).getTime()) / 1000;
                  const durations = lastTenRuns.filter(r => r.endDate && r.startDate).map(r => (new Date(r.endDate!).getTime() - new Date(r.startDate!).getTime()) / 1000);
                  const maxDuration = Math.max(...durations, 1);
                  height = 30 + ((duration / maxDuration) * 70);
                }
                return <div key={run.dagRunId} className={`w-1.5 transition-all ${getBarColor()}`} style={{ height: `${height}%` }} title={`${run.state} - ${new Date(run.executionDate).toLocaleString()}${run.duration ? ` - ${Math.round(run.duration)}s` : ''}`} />;
              })}
            </div>
          </div>
          <div className={`flex-shrink-0 flex items-center gap-4 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <div className="text-center">
              <div className="text-green-500 font-semibold">{dag.successCount}</div>
              <div className="text-xs">Success</div>
            </div>
            <div className="text-center">
              <div className="text-red-500 font-semibold">{dag.failedCount}</div>
              <div className="text-xs">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-blue-500 font-semibold">{dag.runningCount}</div>
              <div className="text-xs">Running</div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={onDelete}
        title="Delete DAG"
        message={`Are you sure you want to delete "${dag.dagId}"? This action cannot be undone and will remove all associated run history.`}
        confirmText="Delete DAG"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}

function DAGListSkeleton() {
  const { theme } = useTheme();
  
  return (
    <div className="space-y-2">
      {Array.from({ length: 12 }).map((_, index) => (
        <div
          key={index}
          className={`
            rounded-lg border p-4 animate-pulse
            ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
          `}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className={`h-4 rounded mb-2 w-1/3 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`} />
              <div className={`h-3 rounded w-2/3 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`} />
            </div>
            <div className={`h-12 w-24 rounded ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`} />
            <div className={`h-8 w-32 rounded ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`} />
          </div>
        </div>
      ))}
    </div>
  );
}
