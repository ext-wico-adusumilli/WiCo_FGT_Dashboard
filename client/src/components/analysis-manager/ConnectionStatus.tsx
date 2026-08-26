import { useState } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, HelpCircle, ExternalLink } from 'lucide-react';
import { AirflowConnectionStatus } from '../../types/airflow';
import { useTheme } from '../../contexts/ThemeContext';

interface ConnectionStatusProps {
  status: AirflowConnectionStatus | null;
  onRetry?: () => void;
  className?: string;
  showTroubleshooting?: boolean;
}

export function ConnectionStatus({ 
  status, 
  onRetry, 
  className = '', 
  showTroubleshooting = false 
}: ConnectionStatusProps) {
  const { theme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);

  if (!status) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
        }`} />
        <span className={`text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Checking connection...
        </span>
      </div>
    );
  }

  const getStatusColor = () => {
    if (status.isConnected) {
      return theme === 'dark' ? 'text-green-400' : 'text-green-600';
    }
    return theme === 'dark' ? 'text-red-400' : 'text-red-600';
  };

  const getStatusIcon = () => {
    if (status.isConnected) {
      return <Wifi className="w-4 h-4" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (status.isConnected) {
      const responseTime = status.responseTime ? ` (${status.responseTime}ms)` : '';
      return `Connected${responseTime}`;
    }
    // Show short error message - just "Offline" or simple reason
    if (status.error) {
      // Extract simple error reason
      if (status.error.includes('ECONNREFUSED') || status.error.includes('failed, reason:')) {
        return 'Connection refused';
      } else if (status.error.includes('timeout')) {
        return 'Connection timeout';
      } else if (status.error.includes('401') || status.error.includes('Authentication')) {
        return 'Authentication failed';
      } else if (status.error.includes('404')) {
        return 'Service not found';
      } else if (status.error.includes('500')) {
        return 'Server error';
      }
      return 'Connection failed';
    }
    return 'Disconnected';
  };

  const formatLastChecked = () => {
    const date = new Date(status.lastChecked);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status indicator */}
      <div className={`flex items-center gap-2 ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">
          {status.isConnected ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Status details */}
      {/* <div className={`text-xs ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      }`}>
        {getStatusText()}
      </div> */}

      {/* Last checked */}
      {/* <div className={`text-xs ${
        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
      }`}>
        • {formatLastChecked()}
      </div> */}

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Retry button for failed connections */}
        {!status.isConnected && onRetry && (
          <button
            onClick={onRetry}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
              transition-colors duration-200
              ${theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
            title="Retry connection"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}

        {/* Help button for troubleshooting */}
        {!status.isConnected && showTroubleshooting && (
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
              transition-colors duration-200
              ${theme === 'dark'
                ? 'bg-blue-700 hover:bg-blue-600 text-blue-300'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
              }
            `}
            title="Show troubleshooting help"
          >
            <HelpCircle className="w-3 h-3" />
            Help
          </button>
        )}
      </div>

      {/* Warning for poor connection */}
      {/* {status.isConnected && status.responseTime && status.responseTime > 5000 && (
        <div className={`flex items-center gap-1 ${
          theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
        }`} title="Slow connection detected">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-xs">Slow</span>
        </div>
      )} */}

      {/* Troubleshooting panel */}
      {showHelp && !status.isConnected && (
        <TroubleshootingPanel 
          error={status.error}
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
}

// Compact version for use in headers
export function ConnectionStatusCompact({ status, onRetry }: ConnectionStatusProps) {
  const { theme } = useTheme();

  if (!status) {
    return (
      <div className={`w-2 h-2 rounded-full animate-pulse ${
        theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
      }`} title="Checking connection..." />
    );
  }

  return (
    <div
      className={`
        flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer
        ${status.isConnected
          ? theme === 'dark'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-green-50 text-green-700 border border-green-200'
          : theme === 'dark'
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-red-50 text-red-700 border border-red-200'
        }
      `}
      onClick={onRetry}
      title={status.isConnected ? 'Airflow Connected' : `Airflow Offline: ${status.error}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${
        status.isConnected
          ? 'bg-green-500 animate-pulse'
          : 'bg-red-500'
      }`} />
      {status.isConnected ? 'Online' : 'Offline'}
    </div>
  );
}

// Troubleshooting panel for connection issues
interface TroubleshootingPanelProps {
  error?: string;
  onClose: () => void;
}

function TroubleshootingPanel({ error, onClose }: TroubleshootingPanelProps) {
  const { theme } = useTheme();

  const getTroubleshootingSteps = () => {
    const commonSteps = [
      {
        title: 'Check Airflow Service',
        description: 'Ensure Apache Airflow is running and accessible',
        action: 'Verify Airflow webserver is started'
      },
      {
        title: 'Verify Network Connection',
        description: 'Check if the Airflow API endpoint is reachable',
        action: 'Test network connectivity to Airflow server'
      },
      {
        title: 'Check Configuration',
        description: 'Verify API URL and authentication settings',
        action: 'Review environment variables and config'
      }
    ];

    // Add specific steps based on error type
    if (error?.includes('timeout')) {
      commonSteps.unshift({
        title: 'Connection Timeout',
        description: 'The request to Airflow timed out',
        action: 'Check if Airflow is overloaded or network is slow'
      });
    } else if (error?.includes('404') || error?.includes('Not Found')) {
      commonSteps.unshift({
        title: 'API Endpoint Not Found',
        description: 'The Airflow API endpoint was not found',
        action: 'Verify the API URL is correct and Airflow version is compatible'
      });
    } else if (error?.includes('401') || error?.includes('403')) {
      commonSteps.unshift({
        title: 'Authentication Error',
        description: 'Invalid credentials or insufficient permissions',
        action: 'Check username, password, and API permissions'
      });
    }

    return commonSteps;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Panel */}
        <div className={`
          inline-block w-full max-w-lg my-8 overflow-hidden text-left align-middle transition-all transform
          rounded-lg shadow-xl
          ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
        `}>
          {/* Header */}
          <div className={`
            flex items-center justify-between p-4 border-b
            ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                ${theme === 'dark' ? 'bg-red-500/20' : 'bg-red-50'}
              `}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  Connection Troubleshooting
                </h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Steps to resolve Airflow connection issues
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
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Error details */}
          {error && (
            <div className={`
              p-4 border-b
              ${theme === 'dark' ? 'border-gray-700 bg-red-500/10' : 'border-gray-200 bg-red-50'}
            `}>
              <h4 className={`text-sm font-medium mb-1 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-700'
              }`}>
                Error Details
              </h4>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-red-300' : 'text-red-600'
              }`}>
                {error}
              </p>
            </div>
          )}

          {/* Troubleshooting steps */}
          <div className="p-4 space-y-4">
            <h4 className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Troubleshooting Steps
            </h4>

            <div className="space-y-3">
              {getTroubleshootingSteps().map((step, index) => (
                <div key={index} className={`
                  p-3 rounded-lg border
                  ${theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}
                `}>
                  <div className="flex items-start gap-3">
                    <div className={`
                      flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                      ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'}
                    `}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h5 className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </h5>
                      <p className={`text-xs mt-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {step.description}
                      </p>
                      <p className={`text-xs mt-1 font-medium ${
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        → {step.action}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional resources */}
            <div className={`
              p-3 rounded-lg border
              ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}
            `}>
              <h5 className={`text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
              }`}>
                Additional Resources
              </h5>
              <div className="space-y-2">
                <button
                  onClick={() => window.open('https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/logging-monitoring/check-health.html', '_blank')}
                  className={`
                    flex items-center gap-2 text-xs
                    ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}
                  `}
                >
                  <ExternalLink className="w-3 h-3" />
                  Airflow Health Check Documentation
                </button>
                <button
                  onClick={() => window.open('https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html', '_blank')}
                  className={`
                    flex items-center gap-2 text-xs
                    ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}
                  `}
                >
                  <ExternalLink className="w-3 h-3" />
                  Airflow REST API Reference
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={`
            flex items-center justify-end gap-2 p-4 border-t
            ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}
          `}>
            <button
              onClick={onClose}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }
              `}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}