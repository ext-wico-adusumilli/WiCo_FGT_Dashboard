import { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Play, 
  Pause, 
  RotateCcw, 
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Activity,
  Settings
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { Job, TaskInstance } from '../../types/airflow';
import { JobStatusBadge } from './JobStatusBadge';
import { airflowService } from '../../services/airflowService';

interface JobDetailModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export function JobDetailModal({ 
  job, 
  isOpen, 
  onClose, 
  onRetry, 
  onCancel 
}: JobDetailModalProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'tasks' | 'parameters'>('overview');
  const [logs] = useState<string>('');
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && job) {
      loadJobDetails();
    }
  }, [isOpen, job, activeTab]);

  const loadJobDetails = async () => {
    if (!job.dagId || !job.dagRunId) return;
    
    setLoading(true);
    try {
      if (activeTab === 'tasks') {
        const taskInstances = await airflowService.getTaskInstances(job.dagId, job.dagRunId);
        setTasks(taskInstances);
      }
      // Note: Log loading would be implemented when backend supports it
    } catch (error) {
      showToast('Failed to load job details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (onRetry) {
      try {
        await onRetry(job.jobId);
        onClose();
      } catch (error) {
        // Error handling is done in parent component
      }
    }
  };

  const handleCancel = async () => {
    if (onCancel) {
      try {
        await onCancel(job.jobId);
        onClose();
      } catch (error) {
        // Error handling is done in parent component
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not started';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className={`
          inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform
          rounded-lg shadow-xl
          ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
        `}>
          {/* Header */}
          <div className={`
            flex items-center justify-between p-6 border-b
            ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <div className="flex items-center gap-4">
              {getStatusIcon(job.status)}
              <div>
                <h2 className={`text-xl font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {job.name}
                </h2>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Job ID: {job.jobId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <JobStatusBadge 
                status={job.status} 
                progress={job.progress}
                showProgress={job.status === 'running'}
              />
              <button
                onClick={onClose}
                className={`
                  p-2 rounded-lg transition-colors
                  ${theme === 'dark'
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }
                `}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`
            flex items-center gap-2 px-6 py-3 border-b
            ${theme === 'dark' ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}
          `}>
            {onRetry && job.status === 'failed' && (
              <button
                onClick={handleRetry}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  ${theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }
                `}
              >
                <RotateCcw className="w-4 h-4" />
                Retry Job
              </button>
            )}
            {onCancel && ['created', 'scheduled', 'running'].includes(job.status) && (
              <button
                onClick={handleCancel}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  ${theme === 'dark'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                  }
                `}
              >
                <Pause className="w-4 h-4" />
                Cancel Job
              </button>
            )}
            {job.logUrl && (
              <button
                onClick={() => window.open(job.logUrl, '_blank')}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  ${theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }
                `}
              >
                <ExternalLink className="w-4 h-4" />
                View in Airflow
              </button>
            )}
          </div> 
         {/* Tab Navigation */}
          <div className={`
            flex border-b
            ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}
          `}>
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'tasks', label: 'Tasks', icon: Activity },
              { id: 'logs', label: 'Logs', icon: FileText },
              { id: 'parameters', label: 'Parameters', icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? theme === 'dark'
                      ? 'border-blue-500 text-blue-400 bg-gray-700/50'
                      : 'border-blue-500 text-blue-600 bg-blue-50'
                    : theme === 'dark'
                      ? 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Job Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className={`text-lg font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Job Information
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className={`w-4 h-4 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Created
                          </div>
                          <div className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {formatDate(job.createdAt)}
                          </div>
                        </div>
                      </div>

                      {job.startedAt && (
                        <div className="flex items-center gap-3">
                          <Play className={`w-4 h-4 ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`} />
                          <div>
                            <div className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Started
                            </div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {formatDate(job.startedAt)}
                            </div>
                          </div>
                        </div>
                      )}

                      {job.completedAt && (
                        <div className="flex items-center gap-3">
                          <CheckCircle className={`w-4 h-4 ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          }`} />
                          <div>
                            <div className={`text-sm font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Completed
                            </div>
                            <div className={`text-sm ${
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {formatDate(job.completedAt)}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <Clock className={`w-4 h-4 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Duration
                          </div>
                          <div className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {formatDuration(job.duration)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <User className={`w-4 h-4 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Created By
                          </div>
                          <div className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {job.createdBy}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className={`text-lg font-medium ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      Execution Details
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Script
                        </div>
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {job.scriptName}
                        </div>
                      </div>

                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Date Range
                        </div>
                        <div className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {new Date(job.startDate).toLocaleDateString()} - {new Date(job.endDate).toLocaleDateString()}
                        </div>
                      </div>

                      {job.description && (
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Description
                          </div>
                          <div className={`text-sm ${
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {job.description}
                          </div>
                        </div>
                      )}

                      {job.progress !== undefined && job.status === 'running' && (
                        <div>
                          <div className={`text-sm font-medium mb-2 ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Progress: {job.progress}%
                          </div>
                          <div className={`w-full bg-gray-200 rounded-full h-2 ${
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {job.errorMessage && (
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-red-400' : 'text-red-700'
                          }`}>
                            Error Message
                          </div>
                          <div className={`text-sm p-3 rounded-lg ${
                            theme === 'dark' 
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {job.errorMessage}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}   
         {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Task Breakdown
                  </h3>
                  {loading && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Loading tasks...
                      </span>
                    </div>
                  )}
                </div>

                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.taskId} className={`
                        p-4 rounded-lg border
                        ${theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}
                      `}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(task.state)}
                            <div>
                              <div className={`font-medium ${
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              }`}>
                                {task.taskDisplayName || task.taskId}
                              </div>
                              <div className={`text-sm ${
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {task.operator}
                              </div>
                            </div>
                          </div>
                          <JobStatusBadge status={task.state as any} />
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Started
                            </div>
                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              {formatDate(task.startDate)}
                            </div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Duration
                            </div>
                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              {formatDuration(task.duration)}
                            </div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Try Number
                            </div>
                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              {task.tryNumber} / {task.maxTries}
                            </div>
                          </div>
                          <div>
                            <div className={`font-medium ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Pool
                            </div>
                            <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              {task.pool}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !loading && (
                  <div className={`text-center py-8 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    No task information available
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    Execution Logs
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Implement log refresh
                        showToast('Log refresh not yet implemented', 'info');
                      }}
                      className={`
                        flex items-center gap-2 px-3 py-1 rounded text-sm
                        ${theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }
                      `}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Refresh
                    </button>
                    <button
                      onClick={() => {
                        // Implement log download
                        showToast('Log download not yet implemented', 'info');
                      }}
                      className={`
                        flex items-center gap-2 px-3 py-1 rounded text-sm
                        ${theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }
                      `}
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>

                <div className={`
                  p-4 rounded-lg border font-mono text-sm h-64 overflow-y-auto
                  ${theme === 'dark' 
                    ? 'bg-gray-900 border-gray-600 text-gray-300' 
                    : 'bg-gray-50 border-gray-200 text-gray-800'
                  }
                `}>
                  {logs || (
                    <div className={`text-center py-8 ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {job.logUrl ? (
                        <div className="space-y-2">
                          <p>Logs are available in Airflow</p>
                          <button
                            onClick={() => window.open(job.logUrl, '_blank')}
                            className={`
                              inline-flex items-center gap-2 px-3 py-2 rounded text-sm
                              ${theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                              }
                            `}
                          >
                            <ExternalLink className="w-4 h-4" />
                            View in Airflow
                          </button>
                        </div>
                      ) : (
                        'No logs available yet'
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'parameters' && (
              <div className="space-y-4">
                <h3 className={`text-lg font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Job Parameters
                </h3>

                {job.parameters && Object.keys(job.parameters).length > 0 ? (
                  <div className={`
                    p-4 rounded-lg border
                    ${theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}
                  `}>
                    <pre className={`text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-800'
                    }`}>
                      {JSON.stringify(job.parameters, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className={`text-center py-8 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    No parameters configured for this job
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}