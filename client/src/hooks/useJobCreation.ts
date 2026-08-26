import { useState, useCallback } from 'react';
import { airflowService } from '../services/airflowService';
import { Job } from '../types/airflow';
import { useToast } from '../components/Toast';

interface JobCreationData {
  name: string;
  description?: string;
  scriptId: string;
  startDate: string;
  endDate: string;
  parameters?: Record<string, any>;
}

interface UseJobCreationReturn {
  createJob: (jobData: JobCreationData) => Promise<Job>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useJobCreation(): UseJobCreationReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const generateJobId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `job_${timestamp}_${random}`;
  };

  const validateJobData = (jobData: JobCreationData): string[] => {
    const errors: string[] = [];

    // Required field validation
    if (!jobData.name?.trim()) {
      errors.push('Job name is required');
    }

    if (!jobData.scriptId) {
      errors.push('Script selection is required');
    }

    if (!jobData.startDate) {
      errors.push('Start date is required');
    }

    if (!jobData.endDate) {
      errors.push('End date is required');
    }

    // Date range validation
    if (jobData.startDate && jobData.endDate) {
      const startDate = new Date(jobData.startDate);
      const endDate = new Date(jobData.endDate);
      
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      }
      
      if (isNaN(endDate.getTime())) {
        errors.push('Invalid end date format');
      }
      
      if (startDate > endDate) {
        errors.push('Start date must be before or equal to end date');
      }

      // Check if dates are too far in the future (optional business rule)
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
      
      if (endDate > maxFutureDate) {
        errors.push('End date cannot be more than 1 year in the future');
      }
    }

    // Job name validation
    if (jobData.name && jobData.name.length > 100) {
      errors.push('Job name cannot exceed 100 characters');
    }

    if (jobData.name && !/^[a-zA-Z0-9\s\-_\.]+$/.test(jobData.name)) {
      errors.push('Job name can only contain letters, numbers, spaces, hyphens, underscores, and periods');
    }

    // Description validation
    if (jobData.description && jobData.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    return errors;
  };

  const createJob = useCallback(async (jobData: JobCreationData): Promise<Job> => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate job data
      const validationErrors = validateJobData(jobData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      // Prepare job data with generated ID
      const jobPayload = {
        ...jobData,
        name: jobData.name.trim(),
        description: jobData.description?.trim(),
        // Ensure dates are in ISO format
        startDate: new Date(jobData.startDate).toISOString().split('T')[0],
        endDate: new Date(jobData.endDate).toISOString().split('T')[0],
      };

      // Create the job via API
      const createdJob = await airflowService.createJob(jobPayload);

      // Show success notification
      showToast(
        `Job "${createdJob.name}" created successfully with ID: ${createdJob.jobId}`,
        'success'
      );

      return createdJob;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create job';
      setError(errorMessage);
      
      // Show error notification
      showToast(`Failed to create job: ${errorMessage}`, 'error');
      
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [showToast]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createJob,
    isSubmitting,
    error,
    clearError
  };
}