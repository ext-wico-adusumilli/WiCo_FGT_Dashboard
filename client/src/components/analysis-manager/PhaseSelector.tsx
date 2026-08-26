import { useState, useEffect } from 'react';
import { Calendar, Database, CheckCircle, Folder } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Phase, DataSelectionSummary } from '../../types/phase';
import { phaseService } from '../../services/phaseService';

interface PhaseSelectorProps {
  selectedPhases: string[];
  onSelectionChange: (phaseIds: string[]) => void;
  className?: string;
}

export function PhaseSelector({ selectedPhases, onSelectionChange, className = '' }: PhaseSelectorProps) {
  const { theme } = useTheme();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available phases
  useEffect(() => {
    const loadPhases = async () => {
      try {
        setLoading(true);
        const availablePhases = await phaseService.getPhases();
        setPhases(availablePhases);
      } catch (error) {
        console.error('Failed to load phases:', error);
        setPhases([]);
      } finally {
        setLoading(false);
      }
    };

    loadPhases();
  }, []);

  const handlePhaseToggle = (phaseId: string) => {
    const newSelection = selectedPhases.includes(phaseId)
      ? selectedPhases.filter(id => id !== phaseId)
      : [...selectedPhases, phaseId];
    
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedPhases.length === phases.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(phases.map(p => p.id));
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center p-8`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3EC1C5]" />
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className={`${className} p-6 rounded-lg border ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="text-center">
          <Folder className={`w-12 h-12 mx-auto mb-3 ${
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          }`} />
          <p className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            No phases available. Please configure phases in the system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with Select All */}
      <div className="flex items-center justify-between mb-3">
        <label className={`text-sm font-medium ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Available Phases ({selectedPhases.length} selected)
        </label>
        <button
          type="button"
          onClick={handleSelectAll}
          className={`text-xs font-medium ${
            theme === 'dark' ? 'text-[#3EC1C5] hover:text-[#35adb1]' : 'text-[#3EC1C5] hover:text-[#35adb1]'
          }`}
        >
          {selectedPhases.length === phases.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Phase List */}
      <div className={`space-y-2 max-h-80 overflow-y-auto rounded-lg border p-2 ${
        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
      }`}>
        {phases.map((phase) => {
          const isSelected = selectedPhases.includes(phase.id);
          
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => handlePhaseToggle(phase.id)}
              className={`
                w-full p-3 text-left transition-colors
                ${isSelected
                  ? theme === 'dark'
                    ? 'bg-[#3EC1C5]/20 border-l-4 border-[#3EC1C5]'
                    : 'bg-[#3EC1C5]/10 border-l-4 border-[#3EC1C5]'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 border-l-4 border-transparent'
                    : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'
                }
              `}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5
                  ${isSelected
                    ? 'bg-[#3EC1C5] border-[#3EC1C5]'
                    : theme === 'dark'
                      ? 'border-gray-600'
                      : 'border-gray-300'
                  }
                `}>
                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                </div>

                {/* Phase Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-medium text-sm ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {phase.name}
                    </h4>
                    {phase.tags && phase.tags.length > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {phase.tags[0]}
                      </span>
                    )}
                  </div>
                  
                  {phase.description && (
                    <p className={`text-xs mb-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {phase.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <Calendar className={`w-3 h-3 ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {formatDate(phase.startDate)} - {formatDate(phase.endDate)}
                      </span>
                    </div>
                    
                    {phase.fileCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <Database className={`w-3 h-3 ${
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        }`} />
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          {phase.fileCount} files
                        </span>
                      </div>
                    )}

                    {phase.sizeBytes !== undefined && (
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        {formatBytes(phase.sizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
