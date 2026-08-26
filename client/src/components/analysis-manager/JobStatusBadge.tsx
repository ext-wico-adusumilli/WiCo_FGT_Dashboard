import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { JobStatus } from '../../types/airflow';

interface JobStatusBadgeProps {
  status: JobStatus;
  progress?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showProgress?: boolean;
}

export function JobStatusBadge({ 
  status, 
  progress, 
  size = 'md', 
  showIcon = true,
  showProgress = false 
}: JobStatusBadgeProps) {
  const getStatusConfig = (status: JobStatus) => {
    switch (status) {
      case 'created':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          darkColor: 'dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
          icon: Clock,
          label: 'Created'
        };
      case 'scheduled':
        return {
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          darkColor: 'dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30',
          icon: Clock,
          label: 'Scheduled'
        };
      case 'running':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          darkColor: 'dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
          icon: Loader2,
          label: 'Running'
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          darkColor: 'dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30',
          icon: CheckCircle,
          label: 'Completed'
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          darkColor: 'dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30',
          icon: XCircle,
          label: 'Failed'
        };
      case 'cancelled':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          darkColor: 'dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
          icon: XCircle,
          label: 'Cancelled'
        };
      case 'paused':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          darkColor: 'dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30',
          icon: Pause,
          label: 'Paused'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          darkColor: 'dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600',
          icon: AlertCircle,
          label: 'Unknown'
        };
    }
  };

  const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-1.5 py-0.5 text-[10px]',
          icon: 'w-2.5 h-2.5',
          progress: 'h-1'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-sm',
          icon: 'w-5 h-5',
          progress: 'h-2'
        };
      default:
        return {
          container: 'px-3 py-1.5 text-xs',
          icon: 'w-4 h-4',
          progress: 'h-1.5'
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeClasses = getSizeClasses(size);
  const IconComponent = config.icon;

  return (
    <div className="inline-flex flex-col gap-1">
      <div className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap
        ${config.color} ${config.darkColor} ${sizeClasses.container}
      `}>
        {showIcon && (
          <IconComponent 
            className={`
              ${sizeClasses.icon}
              ${status === 'running' ? 'animate-spin' : ''}
            `} 
          />
        )}
        <span>{config.label}</span>
      </div>
      
      {showProgress && status === 'running' && progress !== undefined && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`bg-blue-500 ${sizeClasses.progress} transition-all duration-300 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}