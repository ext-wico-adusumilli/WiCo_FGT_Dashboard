import React from 'react';
import { CheckCircle, Calendar, FileText, Settings, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Job } from '../../types/airflow';

interface JobConfirmationModalProps {
  job: Job;
  onClose: () => void;
  onViewJob?: (jobId: string) => void;
}

export function JobConfirmationModal({ job, onClose, onViewJob }: JobConfirmationModalProps) {
  const { theme } = useTheme();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`
        w-full max-w-md rounded-lg shadow-xl
        ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Job Created Successfully
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Your analysis job has been scheduled
              </p>
            </div>
          </div>
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

        {/* Job Details */}
        <div className="p-6 space-y-4">
          {/* Job ID */}
          <div className={`
            p-3 rounded-lg border
            ${theme === 'dark'
              ? 'bg-gray-700/50 border-gray-600'
              : 'bg-gray-50 border-gray-200'
            }
          `}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Job ID
              </span>
              <code className={`text-sm font-mono px-2 py-1 rounded ${
                theme === 'dark'
                  ? 'bg-gray-600 text-green-400'
                  : 'bg-gray-200 text-green-700'
              }`}>
                {job.jobId}
              </code>
            </div>
          </div>

          {/* Job Name */}
          <div className="flex items-start gap-3">
            <FileText className={`w-5 h-5 mt-0.5 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <div className="flex-1">
              <h4 className={`font-medium ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {job.name}
              </h4>
              {job.description && (
                <p className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {job.description}
                </p>
              )}
            </div>
          </div>

          {/* Script Info */}
          <div className="flex items-center gap-3">
            <Settings className={`w-5 h-5 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Script: 
              </span>
              <span className={`text-sm font-medium ml-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {job.scriptName}
              </span>
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-3">
            <Calendar className={`w-5 h-5 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Analysis Period: 
              </span>
              <span className={`text-sm font-medium ml-1 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {formatDate(job.startDate)} - {formatDate(job.endDate)}
              </span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <div className={`
              w-2 h-2 rounded-full
              ${job.status === 'created' ? 'bg-blue-500' : 
                job.status === 'scheduled' ? 'bg-orange-500' :
                job.status === 'running' ? 'bg-green-500' :
                job.status === 'completed' ? 'bg-green-600' :
                job.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}
            `} />
            <div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Status: 
              </span>
              <span className={`text-sm font-medium ml-1 capitalize ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {job.status}
              </span>
            </div>
          </div>

          {/* Parameters (if any) */}
          {job.parameters && Object.keys(job.parameters).length > 0 && (
            <div>
              <h5 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Parameters
              </h5>
              <div className={`
                p-3 rounded-lg border text-xs font-mono
                ${theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-gray-300'
                  : 'bg-gray-50 border-gray-200 text-gray-700'
                }
              `}>
                {JSON.stringify(job.parameters, null, 2)}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className={`
            p-4 rounded-lg border
            ${theme === 'dark'
              ? 'bg-blue-500/10 border-blue-500/30'
              : 'bg-blue-50 border-blue-200'
            }
          `}>
            <h5 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              What's Next?
            </h5>
            <ul className={`text-sm space-y-1 ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
            }`}>
              <li>• Your job has been queued for execution</li>
              <li>• You can monitor progress in the Job History table</li>
              <li>• You'll receive notifications when the job completes</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {onViewJob && (
            <button
              onClick={() => onViewJob(job.jobId)}
              className={`
                flex-1 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                ${theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
            >
              View Job Details
            </button>
          )}
          <button
            onClick={onClose}
            className={`
              ${onViewJob ? '' : 'flex-1'} px-4 py-2 rounded-lg text-sm font-medium
              transition-colors duration-200
              ${theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
              focus:outline-none focus:ring-2 focus:ring-gray-500/20
            `}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}