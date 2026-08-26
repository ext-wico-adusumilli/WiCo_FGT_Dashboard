import { useState, useCallback, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { JobCreationForm } from './JobCreationForm';
import { JobHistoryTable } from './JobHistoryTable';
import { useJobPolling } from '../../hooks/useJobPolling';
import { airflowService } from '../../services/airflowService';
import { Job } from '../../types/airflow';

interface JobManagementPanelProps {
  onViewJobDetails?: (jobId: string) => void;
  onRefresh?: () => void;
}

export interface JobManagementPanelRef {
  refresh: () => void;
}

export const JobManagementPanel = forwardRef<JobManagementPanelRef, JobManagementPanelProps>(
  (_props, ref) => {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [shouldPoll, setShouldPoll] = useState(false);

  // Job fetching with conditional polling
  const {
    jobs: fetchedJobs,
    loading,
    error,
    refetch,
    silentRefetch
  } = useJobPolling({
    enabled: shouldPoll, // Enable polling when there are running jobs
    pollInterval: 10000, // Poll every 10 seconds (like DAG workflows)
    onError: (error) => {
      showToast(`Failed to fetch jobs: ${error.message}`, 'error');
    }
  });

  // Apply optimistic updates to jobs
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Partial<Job>>>({});
  
  const jobs = useMemo(() => {
    return fetchedJobs.map(job => ({
      ...job,
      ...(optimisticUpdates[job.jobId] || {})
    }));
  }, [fetchedJobs, optimisticUpdates]);

  // Enable/disable polling based on running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(job => 
      job.status === 'running' || job.status === 'scheduled'
    );
    
    if (hasRunningJobs !== shouldPoll) {
      console.log(`🔄 [JobManagementPanel] Polling ${hasRunningJobs ? 'enabled' : 'disabled'} - Running/Scheduled jobs: ${jobs.filter(j => j.status === 'running' || j.status === 'scheduled').length}`);
      setShouldPoll(hasRunningJobs);
    }
  }, [jobs, shouldPoll]);

  // Expose refetch to parent via ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      refetch();
    }
  }), [refetch]);

  const handleCreateJob = useCallback((job: Job) => {
    console.log('✅ [JobManagementPanel] Job created:', job);
    setShowCreateForm(false);
    showToast(`Job "${job.name}" created successfully`, 'success');
    // Refresh job list to show the new job
    console.log('🔄 [JobManagementPanel] Refreshing job list in 1 second...');
    setTimeout(() => {
      console.log('🔄 [JobManagementPanel] Calling refetch now...');
      try {
        refetch();
      } catch (error) {
        console.error('Error during refetch:', error);
        // Silently fail - the job was created successfully
      }
    }, 1000);
  }, [refetch, showToast]);

  const handleRetryJob = useCallback(async (jobId: string) => {
    try {
      await airflowService.retryJob(jobId);
      showToast('Job retry initiated successfully', 'success');
      // Refresh to show updated status
      setTimeout(() => refetch(), 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry job';
      showToast(`Failed to retry job: ${message}`, 'error');
    }
  }, [refetch, showToast]);

  const handleCancelJob = useCallback(async (jobId: string) => {
    try {
      await airflowService.cancelJob(jobId);
      showToast('Job cancelled successfully', 'success');
      // Refresh to show updated status
      setTimeout(() => refetch(), 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel job';
      showToast(`Failed to cancel job: ${message}`, 'error');
    }
  }, [refetch, showToast]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      await airflowService.deleteJob(jobId);
      showToast('Job deleted successfully', 'success');
      // Refresh to remove from list
      setTimeout(() => refetch(), 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete job';
      showToast(`Failed to delete job: ${message}`, 'error');
    }
  }, [refetch, showToast]);

  const handleTriggerJob = useCallback(async (job: Job) => {
    if (!job.dagId) {
      showToast('No DAG associated with this job', 'error');
      return;
    }

    // Optimistic update - add a new "scheduled" run immediately
    setOptimisticUpdates(prev => ({
      ...prev,
      [job.jobId]: {
        status: 'scheduled',
        recentRuns: [
          {
            dagRunId: `manual_${Date.now()}`,
            state: 'queued',
            executionDate: new Date().toISOString(),
            startDate: undefined,
            endDate: undefined
          },
          ...(job.recentRuns || [])
        ].slice(0, 5) // Keep only last 5
      }
    }));

    try {
      // Trigger the DAG with the same configuration as the original job
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
      
      // Enable polling to track the new run
      setShouldPoll(true);
      
      // Clear optimistic update and do a silent refresh after a short delay
      setTimeout(async () => {
        setOptimisticUpdates(prev => {
          const { [job.jobId]: _, ...rest } = prev;
          return rest;
        });
        await silentRefetch();
      }, 2000);
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const { [job.jobId]: _, ...rest } = prev;
        return rest;
      });
      const message = error instanceof Error ? error.message : 'Failed to trigger job';
      showToast(`Failed to trigger job: ${message}`, 'error');
    }
  }, [refetch, showToast, silentRefetch]);

  return (
    <div className="space-y-6">
      {/* Job Creation Form Modal */}
      <JobCreationForm
        isOpen={showCreateForm}
        onSuccess={handleCreateJob}
        onCancel={() => setShowCreateForm(false)}
      />

      {/* Job History Table with integrated KPI cards */}
      <JobHistoryTable
        jobs={jobs}
        loading={loading}
        onRetryJob={handleRetryJob}
        onCancelJob={handleCancelJob}
        onDeleteJob={handleDeleteJob}
        onCreateJob={() => setShowCreateForm(true)}
        onRefresh={refetch}
        onTriggerJob={handleTriggerJob}
      />

      {/* Error State */}
      {error && !loading && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <h3 className="font-medium mb-2">Failed to Load Jobs</h3>
          <p className="text-sm">{error.message}</p>
          <button
            onClick={refetch}
            className={`mt-3 px-3 py-1 rounded text-sm font-medium ${
              theme === 'dark'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
});