import { useState, useMemo } from 'react';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Plus,
  FileText,
  Trash2,
  Play
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Job, JobStatus } from '../../types/airflow';
import { JobStatusBadge } from './JobStatusBadge';
import { airflowService } from '../../services/airflowService';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface JobHistoryTableProps {
  jobs: Job[];
  loading?: boolean;
  onRetryJob?: (jobId: string) => void;
  onCancelJob?: (jobId: string) => void;
  onDeleteJob?: (jobId: string) => void;
  onCreateJob?: () => void;
  onRefresh?: () => void;
  onTriggerJob?: (job: Job) => void;
}

type SortField = 'name' | 'status' | 'createdAt' | 'startedAt' | 'completedAt' | 'duration';
type SortDirection = 'asc' | 'desc';

interface JobFilter {
  search: string;
  statuses: JobStatus[];
  dateRange: {
    start: string;
    end: string;
  } | null;
}

export function JobHistoryTable({ 
  jobs, 
  loading = false, 
  onRetryJob, 
  onCancelJob,
  onDeleteJob,
  onCreateJob,
  onRefresh,
  onTriggerJob
}: JobHistoryTableProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [loadingReports, setLoadingReports] = useState<Record<string, boolean>>({});
  const [triggeringJobs, setTriggeringJobs] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<JobFilter>({
    search: '',
    statuses: [],
    dateRange: null
  });

  const statusOptions: JobStatus[] = ['created', 'scheduled', 'running', 'completed', 'failed', 'cancelled', 'paused'];

  // Helper function to handle view report
  const handleViewReport = async (job: Job) => {
    if (!job.dagId) {
      showToast('No DAG associated with this job', 'info');
      return;
    }

    setLoadingReports(prev => ({ ...prev, [job.jobId]: true }));
    try {
      const response = await fetch(`/api/airflow/reports/${job.dagId}/blob/latest`);
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
        showToast('No report available for this job yet', 'info');
      }
    } catch (error) {
      showToast('Failed to fetch report', 'error');
    } finally {
      setLoadingReports(prev => ({ ...prev, [job.jobId]: false }));
    }
  };

  // Helper function to handle trigger job (re-run)
  const handleTriggerJob = async (job: Job) => {
    // Use parent's handler if provided (for optimistic updates and polling)
    if (onTriggerJob) {
      onTriggerJob(job);
      return;
    }

    // Fallback to local handler
    if (!job.dagId) {
      showToast('No DAG associated with this job', 'error');
      return;
    }

    setTriggeringJobs(prev => ({ ...prev, [job.jobId]: true }));
    try {
      const dagConf = {
        job_id: job.jobId,
        job_name: job.name,
        start_date: job.startDate,
        end_date: job.endDate,
        created_by: job.createdBy,
        created_at: new Date().toISOString(),
        ...job.parameters
      };

      await airflowService.triggerDag(job.dagId, dagConf);
      showToast(`Job "${job.name}" triggered successfully`, 'success');
      
      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger job';
      showToast(`Failed to trigger job: ${message}`, 'error');
    } finally {
      setTriggeringJobs(prev => ({ ...prev, [job.jobId]: false }));
    }
  };

  // Helper function to extract phases from parameters
  const getPhases = (job: Job): string[] => {
    if (job.parameters?.selectedPhases && Array.isArray(job.parameters.selectedPhases)) {
      return job.parameters.selectedPhases;
    }
    return ['All'];
  };

  // Helper function to extract sorted unique dates from parameters
  const getDates = (job: Job): string[] => {
    let dates: string[] = [];
    if (job.parameters?.selectedDates && Array.isArray(job.parameters.selectedDates)) {
      dates = job.parameters.selectedDates
        .flatMap((pd: any) => pd.dates || [])
        .filter((d: string, i: number, self: string[]) => self.indexOf(d) === i);
    }
    if (dates.length === 0) dates = [job.startDate];
    return dates
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }));
  };

  // Helper function to get status color for circles
  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'scheduled':
        return 'bg-orange-500';
      case 'created':
        return 'bg-gray-400';
      case 'cancelled':
        return 'bg-gray-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  // Helper function to get status label for tooltip
  const getStatusLabel = (status: JobStatus): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Filtering logic
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesSearch = 
          job.name.toLowerCase().includes(searchLower) ||
          job.jobId.toLowerCase().includes(searchLower) ||
          job.scriptName.toLowerCase().includes(searchLower) ||
          (job.description && job.description.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filter.statuses.length > 0 && !filter.statuses.includes(job.status)) {
        return false;
      }

      // Date range filter
      if (filter.dateRange) {
        const jobDate = new Date(job.createdAt);
        const startDate = new Date(filter.dateRange.start);
        const endDate = new Date(filter.dateRange.end);
        
        if (jobDate < startDate || jobDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [jobs, filter]);

  // Sorting logic
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (['createdAt', 'startedAt', 'completedAt'].includes(sortField)) {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      // Handle duration (convert to number)
      if (sortField === 'duration') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredJobs, sortField, sortDirection]);

  // Pagination logic
  const totalPages = Math.ceil(sortedJobs.length / pageSize);
  const paginatedJobs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedJobs.slice(startIndex, startIndex + pageSize);
  }, [sortedJobs, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (newFilter: Partial<JobFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  const toggleDatesExpanded = (jobId: string) => {
    setExpandedDates(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  const togglePhasesExpanded = (jobId: string) => {
    setExpandedPhases(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  return (
    <>
      {/* KPI Cards - Clickable filters - Negative margin to align with DAG workflows */}
      {jobs.length > 0 && (
        <div className="-mt-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Jobs - Not filterable */}
          <div className={`border rounded-lg p-3 sm:p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-[#3EC1C5]" />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Total
              </p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {jobs.length}
            </p>
          </div>

          {/* Scheduled - Clickable filter */}
          <button
            onClick={() => {
              const hasScheduled = filter.statuses.includes('scheduled');
              const newStatuses = hasScheduled
                ? filter.statuses.filter(s => s !== 'scheduled')
                : [...filter.statuses, 'scheduled'] as JobStatus[];
              handleFilterChange({ statuses: newStatuses });
            }}
            className={`border rounded-lg p-3 sm:p-4 text-left transition ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } ${
              theme === 'dark'
                ? 'cursor-pointer hover:border-[#3EC1C5]'
                : 'cursor-pointer hover:border-gray-900'
            } ${
              filter.statuses.includes('scheduled')
                ? theme === 'dark'
                  ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                  : 'border-gray-900 ring-2 ring-gray-900/50'
                : theme === 'dark'
                  ? 'border-gray-700'
                  : 'border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-5 h-5 text-orange-500" />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Scheduled
              </p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {jobs.filter(job => job.status === 'scheduled').length}
            </p>
          </button>

          {/* Running - Clickable filter */}
          <button
            onClick={() => {
              const hasRunning = filter.statuses.includes('running');
              const newStatuses = hasRunning
                ? filter.statuses.filter(s => s !== 'running')
                : [...filter.statuses, 'running'] as JobStatus[];
              handleFilterChange({ statuses: newStatuses });
            }}
            className={`border rounded-lg p-3 sm:p-4 text-left transition ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } ${
              theme === 'dark'
                ? 'cursor-pointer hover:border-[#3EC1C5]'
                : 'cursor-pointer hover:border-gray-900'
            } ${
              filter.statuses.includes('running')
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
              {jobs.filter(job => job.status === 'running').length}
            </p>
          </button>

          {/* Completed - Clickable filter */}
          <button
            onClick={() => {
              const hasCompleted = filter.statuses.includes('completed');
              const newStatuses = hasCompleted
                ? filter.statuses.filter(s => s !== 'completed')
                : [...filter.statuses, 'completed'] as JobStatus[];
              handleFilterChange({ statuses: newStatuses });
            }}
            className={`border rounded-lg p-3 sm:p-4 text-left transition ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } ${
              theme === 'dark'
                ? 'cursor-pointer hover:border-[#3EC1C5]'
                : 'cursor-pointer hover:border-gray-900'
            } ${
              filter.statuses.includes('completed')
                ? theme === 'dark'
                  ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                  : 'border-gray-900 ring-2 ring-gray-900/50'
                : theme === 'dark'
                  ? 'border-gray-700'
                  : 'border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-5 h-5 text-green-500" />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Completed
              </p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {jobs.filter(job => job.status === 'completed').length}
            </p>
          </button>

          {/* Failed - Clickable filter */}
          <button
            onClick={() => {
              const hasFailed = filter.statuses.includes('failed');
              const newStatuses = hasFailed
                ? filter.statuses.filter(s => s !== 'failed')
                : [...filter.statuses, 'failed'] as JobStatus[];
              handleFilterChange({ statuses: newStatuses });
            }}
            className={`border rounded-lg p-3 sm:p-4 text-left transition ${
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } ${
              theme === 'dark'
                ? 'cursor-pointer hover:border-[#3EC1C5]'
                : 'cursor-pointer hover:border-gray-900'
            } ${
              filter.statuses.includes('failed')
                ? theme === 'dark'
                  ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                  : 'border-gray-900 ring-2 ring-gray-900/50'
                : theme === 'dark'
                  ? 'border-gray-700'
                  : 'border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Play className="w-5 h-5 text-red-500" />
              <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Failed
              </p>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {jobs.filter(job => job.status === 'failed').length}
            </p>
          </button>
        </div>
      )}

      {/* Header - Outside table */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Empty or additional controls */}
          <div className="flex items-center gap-3">
          </div>

          {/* Right side: Search and Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative w-64">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                type="text"
                placeholder="Search jobs by name, ID or script..."
                value={filter.search}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
                className={`
                  w-full pl-9 pr-3 py-2 rounded-lg border text-sm
                  ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                  }
                  focus:outline-none focus:ring-2 focus:ring-blue-500/20
                `}
              />
            </div>

            {/* Create New Job Button */}
            {onCreateJob && (
              <button
                onClick={onCreateJob}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors duration-200
                  bg-[#3EC1C5] hover:bg-[#35adb1] text-white
                  focus:outline-none focus:ring-2 focus:ring-[#3EC1C5]/20
                `}
              >
                <Plus className="w-4 h-4" />
                Create New Job
              </button>
            )}

            
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`
        rounded-lg border
        ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
      `}>
        <div className="overflow-x-auto">
          <table className="w-full">
          <thead className={`
            ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}
          `}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                S.No
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer max-w-[120px]
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `} onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  Job Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `}>
                Script
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider min-w-[220px] max-w-[220px]
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `}>
                Phases
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider min-w-[280px]
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `}>
                Dates
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer w-[90px]
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `} onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `}>
                Runs
              </th>
              <th className={`
                px-4 py-3 text-left text-xs font-medium uppercase tracking-wider
                ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}
              `}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`
            divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}
          `}>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                      Loading jobs...
                    </span>
                  </div>
                </td>
              </tr>
            ) : paginatedJobs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {filter.search || filter.statuses.length > 0 ? 'No jobs match your filters' : 'No jobs found'}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedJobs.map((job) => (
                <tr key={job.jobId} className={`
                  ${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}
                  transition-colors duration-150
                `}>
                  <td className="px-4 py-4">
                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(currentPage - 1) * pageSize + paginatedJobs.indexOf(job) + 1}
                    </div>
                  </td>

                  {/* Job Name */}
                  <td className="px-4 py-4 max-w-[120px]">
                    <div className={`font-medium text-sm break-words ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {job.name}
                    </div>
                  </td>

                  {/* Script */}
                  <td className="px-4 py-4">
                    <div className={`text-sm ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {job.scriptName}
                    </div>
                  </td>

                  {/* Phases */}
                  <td className="px-4 py-3 min-w-[220px] max-w-[220px] align-top">
                    {(() => {
                      const phases = getPhases(job);
                      const expanded = !!expandedPhases[job.jobId];
                      const visible = expanded ? phases : phases.slice(0, 5);
                      return (
                        <div className="grid grid-cols-2 gap-1 mt-0.2">
                          {visible.map((p, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded text-center truncate ${
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            }`} title={p}>{p}</span>
                          ))}
                          {!expanded && phases.length > 5 && (
                            <button type="button" onClick={() => togglePhasesExpanded(job.jobId)} className="text-xs font-medium text-[#3EC1C5]">
                              +{phases.length - 5} more
                            </button>
                          )}
                          {expanded && (
                            <button type="button" onClick={() => togglePhasesExpanded(job.jobId)} className="text-xs font-medium text-[#3EC1C5]">
                              less
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Dates */}
                  <td className="px-4 py-3 align-top">
                    {(() => {
                      const dates = getDates(job);
                      const expanded = !!expandedDates[job.jobId];
                      const visible = expanded ? dates : dates.slice(0, 5);
                      return (
                        <div className="grid grid-cols-3 gap-1">
                          {visible.map((d, i) => (
                            <span key={i} className={`text-xs px-1.5 py-0.5 rounded text-center block w-full ${
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            }`}>{d}</span>
                          ))}
                          {!expanded && dates.length > 5 && (
                            <button type="button" onClick={() => toggleDatesExpanded(job.jobId)} className="text-xs px-1.5 py-0.5 text-center font-medium text-[#3EC1C5]">
                              +{dates.length - 5} more
                            </button>
                          )}
                          {expanded && (
                            <button type="button" onClick={() => toggleDatesExpanded(job.jobId)} className="text-xs px-1.5 py-0.5 text-center font-medium text-[#3EC1C5]">
                              Show Less
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-4">
                    <JobStatusBadge status={job.status} size="sm" />
                  </td>

                  {/* Runs - Show last 5 as circles */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      {job.recentRuns && job.recentRuns.length > 0 ? (
                        // Show actual recent runs from Airflow
                        <>
                          {job.recentRuns.slice(0, 5).map((run, index) => (
                            <div
                              key={run.dagRunId || index}
                              className={`w-3 h-3 rounded-full ${getStatusColor(
                                run.state === 'success' ? 'completed' :
                                run.state === 'failed' ? 'failed' :
                                run.state === 'running' ? 'running' :
                                run.state === 'queued' ? 'scheduled' :
                                'created'
                              )}`}
                              title={`${run.state} - ${new Date(run.executionDate).toLocaleString()}`}
                            />
                          ))}
                          {/* Fill remaining slots with empty circles */}
                          {Array.from({ length: Math.max(0, 5 - job.recentRuns.length) }).map((_, index) => (
                            <div
                              key={`empty-${index}`}
                              className={`w-3 h-3 rounded-full ${
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              }`}
                              title="No run"
                            />
                          ))}
                        </>
                      ) : (
                        // Show current job status as first circle if no recent runs
                        <>
                          <div
                            className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`}
                            title={`${getStatusLabel(job.status)} - ${new Date(job.createdAt).toLocaleString()}`}
                          />
                          {/* Show 4 empty circles */}
                          {Array.from({ length: 4 }).map((_, index) => (
                            <div
                              key={index}
                              className={`w-3 h-3 rounded-full ${
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              }`}
                              title="No run"
                            />
                          ))}
                        </>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {/* Trigger Job */}
                      <button
                        onClick={() => handleTriggerJob(job)}
                        disabled={triggeringJobs[job.jobId] || !job.dagId}
                        className={`
                          p-1.5 rounded-lg transition-colors
                          ${theme === 'dark'
                            ? 'hover:bg-blue-600 text-blue-400 hover:text-white'
                            : 'hover:bg-blue-100 text-blue-600 hover:text-blue-700'
                          }
                          ${(triggeringJobs[job.jobId] || !job.dagId) ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        title="Trigger Job (Re-run)"
                      >
                        <Play className={`w-4 h-4 ${triggeringJobs[job.jobId] ? 'animate-pulse' : ''}`} />
                      </button>

                      {/* View Report */}
                      <button
                        onClick={() => handleViewReport(job)}
                        disabled={loadingReports[job.jobId] || !job.dagId}
                        className={`
                          p-1.5 rounded-lg transition-colors
                          ${theme === 'dark'
                            ? 'hover:bg-gray-600 text-green-400 hover:text-green-300'
                            : 'hover:bg-gray-100 text-green-600 hover:text-green-700'
                          }
                          ${(loadingReports[job.jobId] || !job.dagId) ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        title="View Report"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      {onDeleteJob && (
                        <button
                          onClick={() => setJobToDelete(job)}
                          className={`
                            p-1.5 rounded-lg transition-colors
                            ${theme === 'dark'
                              ? 'hover:bg-red-600 text-red-400 hover:text-white'
                              : 'hover:bg-red-100 text-red-600 hover:text-red-700'
                            }
                          `}
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedJobs.length)} of {sortedJobs.length} jobs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`
                px-3 py-1 rounded border text-sm font-medium transition-colors
                ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}
                ${theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              Previous
            </button>
            <span className={`px-3 py-1 text-sm ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`
                px-3 py-1 rounded border text-sm font-medium transition-colors
                ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                ${theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              Next
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Delete Confirmation Dialog */}
      {jobToDelete && (
        <ConfirmDialog
          isOpen={!!jobToDelete}
          onClose={() => setJobToDelete(null)}
          onConfirm={() => {
            if (onDeleteJob && jobToDelete) {
              onDeleteJob(jobToDelete.jobId);
              setJobToDelete(null);
            }
          }}
          title="Delete Job"
          message={`Are you sure you want to delete "${jobToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete Job"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </>
  );
}