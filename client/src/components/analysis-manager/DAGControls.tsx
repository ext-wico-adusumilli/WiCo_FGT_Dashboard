import React, { useState } from 'react';
import { Play, Pause, Square, RefreshCw, Settings, MoreHorizontal } from 'lucide-react';
import { DagStatus } from '../../types/airflow';
import { useTheme } from '../../contexts/ThemeContext';
import { ConfirmDialog } from '../ConfirmDialog';
import { useToast } from '../Toast';

interface DAGControlsProps {
  dag: DagStatus;
  onTrigger: (dagId: string, config?: Record<string, any>) => Promise<void>;
  onPause: (dagId: string) => Promise<void>;
  onUnpause: (dagId: string) => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
}

interface ConfirmAction {
  type: 'trigger' | 'pause' | 'unpause';
  title: string;
  message: string;
  confirmText: string;
  action: () => Promise<void>;
}

export function DAGControls({ 
  dag, 
  onTrigger, 
  onPause, 
  onUnpause, 
  loading = false, 
  disabled = false 
}: DAGControlsProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [showTriggerConfig, setShowTriggerConfig] = useState(false);

  const isActionLoading = (action: string) => actionLoading === action || loading;
  const isDisabled = disabled || !dag.isActive || loading;

  const handleAction = async (actionType: string, action: () => Promise<void>) => {
    try {
      setActionLoading(actionType);
      await action();
      setActionLoading(null);
    } catch (error) {
      setActionLoading(null);
      showToast(
        error instanceof Error ? error.message : 'Action failed',
        'error'
      );
    }
  };

  const handleTrigger = () => {
    const action: ConfirmAction = {
      type: 'trigger',
      title: 'Trigger DAG Run',
      message: `Are you sure you want to trigger a new run of "${dag.displayName || dag.dagId}"? This will start the DAG with its default configuration.`,
      confirmText: 'Trigger DAG',
      action: async () => {
        await handleAction('trigger', () => onTrigger(dag.dagId));
        showToast(`DAG "${dag.displayName || dag.dagId}" triggered successfully`, 'success');
      }
    };
    setConfirmAction(action);
  };

  const handlePause = () => {
    const action: ConfirmAction = {
      type: 'pause',
      title: 'Pause DAG',
      message: `Are you sure you want to pause "${dag.displayName || dag.dagId}"? This will prevent new runs from being scheduled.`,
      confirmText: 'Pause DAG',
      action: async () => {
        await handleAction('pause', () => onPause(dag.dagId));
        showToast(`DAG "${dag.displayName || dag.dagId}" paused successfully`, 'success');
      }
    };
    setConfirmAction(action);
  };

  const handleUnpause = () => {
    const action: ConfirmAction = {
      type: 'unpause',
      title: 'Unpause DAG',
      message: `Are you sure you want to unpause "${dag.displayName || dag.dagId}"? This will resume normal scheduling.`,
      confirmText: 'Unpause DAG',
      action: async () => {
        await handleAction('unpause', () => onUnpause(dag.dagId));
        showToast(`DAG "${dag.displayName || dag.dagId}" unpaused successfully`, 'success');
      }
    };
    setConfirmAction(action);
  };

  return (
    <>
      <div className="flex gap-2">
        {/* Trigger Button */}
        <button
          onClick={handleTrigger}
          disabled={isDisabled}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
            transition-all duration-200 min-w-0
            ${isDisabled
              ? theme === 'dark'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
            }
            ${isActionLoading('trigger') ? 'opacity-75' : ''}
          `}
        >
          {isActionLoading('trigger') ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span className="truncate">
            {isActionLoading('trigger') ? 'Triggering...' : 'Trigger'}
          </span>
        </button>

        {/* Pause/Unpause Button */}
        <button
          onClick={dag.isPaused ? handleUnpause : handlePause}
          disabled={isDisabled}
          className={`
            flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
            transition-all duration-200 min-w-[80px]
            ${isDisabled
              ? theme === 'dark'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : dag.isPaused
                ? theme === 'dark'
                  ? 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg'
                  : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg'
                : theme === 'dark'
                  ? 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow-lg'
                  : 'bg-orange-600 hover:bg-orange-700 text-white hover:shadow-lg'
            }
            ${(isActionLoading('pause') || isActionLoading('unpause')) ? 'opacity-75' : ''}
          `}
        >
          {isActionLoading('pause') || isActionLoading('unpause') ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : dag.isPaused ? (
            <Play className="w-4 h-4" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isActionLoading('pause') || isActionLoading('unpause') 
              ? 'Loading...' 
              : dag.isPaused 
                ? 'Resume' 
                : 'Pause'
            }
          </span>
        </button>

        {/* More Actions Button */}
        <button
          className={`
            flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium
            transition-all duration-200
            ${theme === 'dark'
              ? 'bg-gray-600 hover:bg-gray-700 text-white hover:shadow-lg'
              : 'bg-gray-600 hover:bg-gray-700 text-white hover:shadow-lg'
            }
          `}
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2 mt-2">
        {/* Active Status */}
        <div className={`flex items-center gap-1 text-xs ${
          dag.isActive
            ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
            : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${
            dag.isActive ? 'bg-green-500' : 'bg-gray-400'
          }`} />
          {dag.isActive ? 'Active' : 'Inactive'}
        </div>

        {/* Paused Status */}
        {dag.isPaused && (
          <div className={`flex items-center gap-1 text-xs ${
            theme === 'dark' ? 'text-orange-400' : 'text-orange-600'
          }`}>
            <Pause className="w-3 h-3" />
            Paused
          </div>
        )}

        {/* Running Status */}
        {dag.runningCount > 0 && (
          <div className={`flex items-center gap-1 text-xs ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`}>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {dag.runningCount} running
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.action}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          type={confirmAction.type === 'trigger' ? 'info' : 'warning'}
        />
      )}

      {/* Trigger Configuration Modal */}
      {showTriggerConfig && (
        <TriggerConfigModal
          dag={dag}
          onClose={() => setShowTriggerConfig(false)}
          onTrigger={async (config) => {
            await handleAction('trigger', () => onTrigger(dag.dagId, config));
            showToast(`DAG "${dag.displayName || dag.dagId}" triggered with custom config`, 'success');
            setShowTriggerConfig(false);
          }}
        />
      )}
    </>
  );
}

// Compact version for use in grid cards
export function DAGControlsCompact({ dag, onTrigger, onPause, onUnpause, loading = false }: DAGControlsProps) {
  const { theme } = useTheme();
  const { showToast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isActionLoading = (action: string) => actionLoading === action || loading;
  const isDisabled = !dag.isActive || loading;

  const handleAction = async (actionType: string, action: () => Promise<void>) => {
    try {
      setActionLoading(actionType);
      await action();
      setActionLoading(null);
    } catch (error) {
      setActionLoading(null);
      showToast(
        error instanceof Error ? error.message : 'Action failed',
        'error'
      );
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleAction('trigger', () => onTrigger(dag.dagId))}
        disabled={isDisabled}
        className={`
          flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
          transition-colors duration-200
          ${isDisabled
            ? theme === 'dark'
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : theme === 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
      >
        {isActionLoading('trigger') ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        Trigger
      </button>

      <button
        onClick={() => handleAction(
          dag.isPaused ? 'unpause' : 'pause',
          dag.isPaused ? () => onUnpause(dag.dagId) : () => onPause(dag.dagId)
        )}
        disabled={isDisabled}
        className={`
          flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium
          transition-colors duration-200
          ${isDisabled
            ? theme === 'dark'
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : theme === 'dark'
              ? 'bg-gray-600 hover:bg-gray-700 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          }
        `}
      >
        {isActionLoading('pause') || isActionLoading('unpause') ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : dag.isPaused ? (
          <Play className="w-4 h-4" />
        ) : (
          <Pause className="w-4 h-4" />
        )}
      </button>

      <button
        className={`
          flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium
          transition-colors duration-200
          ${theme === 'dark'
            ? 'bg-gray-600 hover:bg-gray-700 text-white'
            : 'bg-gray-600 hover:bg-gray-700 text-white'
          }
        `}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}

// Trigger Configuration Modal (placeholder for future implementation)
interface TriggerConfigModalProps {
  dag: DagStatus;
  onClose: () => void;
  onTrigger: (config?: Record<string, any>) => Promise<void>;
}

function TriggerConfigModal({ dag, onClose, onTrigger }: TriggerConfigModalProps) {
  const { theme } = useTheme();
  const [config, setConfig] = useState('{}');

  const handleSubmit = async () => {
    try {
      const parsedConfig = JSON.parse(config);
      await onTrigger(parsedConfig);
    } catch (error) {
      // Handle JSON parse error
      await onTrigger();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative rounded-xl p-6 max-w-md w-full shadow-2xl ${
        theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          Trigger DAG: {dag.displayName || dag.dagId}
        </h3>
        
        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Configuration (JSON)
          </label>
          <textarea
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            className={`w-full px-3 py-2 rounded-md border text-sm font-mono ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            rows={4}
            placeholder='{"key": "value"}'
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg transition text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            Trigger DAG
          </button>
        </div>
      </div>
    </div>
  );
}