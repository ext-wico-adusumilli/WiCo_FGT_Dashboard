import React, { useState, useEffect } from 'react';
import { Calendar, Check, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { AnalysisMultiSelect } from './AnalysisMultiSelect';
import { airflowService } from '../../services/airflowService';

interface Phase {
  phaseId: string;
  phaseName: string;
  displayName: string;
  path: string;
}

interface DateInfo {
  date: string;
  folderName: string;
  path: string;
  fileCount: number;
  displayName: string;
}

interface DataSelectorProps {
  selectedPhases: string[];
  selectedDates: { phaseId: string; dates: string[] }[];
  onSelectionChange: (phases: string[], dates: { phaseId: string; dates: string[] }[]) => void;
  twoColumnLayout?: boolean;
}

export function DataSelector({ selectedPhases, selectedDates, onSelectionChange, twoColumnLayout = false }: DataSelectorProps) {
  const { theme } = useTheme();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [datesByPhase, setDatesByPhase] = useState<Record<string, DateInfo[]>>({});
  const [loadingPhases, setLoadingPhases] = useState(true);
  const [loadingDates, setLoadingDates] = useState<Record<string, boolean>>({});
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Load available phases on mount
  useEffect(() => {
    loadPhases();
  }, []);

  const loadPhases = async () => {
    try {
      setLoadingPhases(true);
      const availablePhases = await airflowService.getAvailablePhases();
      setPhases(availablePhases);
    } catch (error) {
      console.error('Failed to load phases:', error);
    } finally {
      setLoadingPhases(false);
    }
  };

  const loadDatesForPhase = async (phaseId: string) => {
    if (datesByPhase[phaseId]) return; // Already loaded

    try {
      setLoadingDates(prev => ({ ...prev, [phaseId]: true }));
      const dates = await airflowService.getAvailableDates(phaseId);
      setDatesByPhase(prev => ({ ...prev, [phaseId]: dates }));
    } catch (error) {
      console.error(`Failed to load dates for phase ${phaseId}:`, error);
    } finally {
      setLoadingDates(prev => ({ ...prev, [phaseId]: false }));
    }
  };

  // Handle phase selection changes from MultiSelect
  const handlePhaseSelectionChange = (newSelectedPhases: string[]) => {
    // Update selected phases
    onSelectionChange(newSelectedPhases, selectedDates);

    // Load dates for newly selected phases and expand them
    newSelectedPhases.forEach(phaseId => {
      if (!selectedPhases.includes(phaseId)) {
        loadDatesForPhase(phaseId);
        setExpandedPhases(prev => new Set([...prev, phaseId]));
      }
    });

    // Remove dates for deselected phases
    const deselectedPhases = selectedPhases.filter(id => !newSelectedPhases.includes(id));
    if (deselectedPhases.length > 0) {
      const newSelectedDates = selectedDates.filter(item => !deselectedPhases.includes(item.phaseId));
      onSelectionChange(newSelectedPhases, newSelectedDates);
      
      // Collapse deselected phases
      setExpandedPhases(prev => {
        const newExpanded = new Set(prev);
        deselectedPhases.forEach(id => newExpanded.delete(id));
        return newExpanded;
      });
    }
  };

  const togglePhaseExpansion = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
      loadDatesForPhase(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const toggleDate = (phaseId: string, date: string) => {
    const phaseData = selectedDates.find(item => item.phaseId === phaseId);
    
    if (!phaseData) {
      // Add new phase with this date
      onSelectionChange(selectedPhases, [...selectedDates, { phaseId, dates: [date] }]);
    } else {
      // Toggle date in existing phase
      const newDates = phaseData.dates.includes(date)
        ? phaseData.dates.filter(d => d !== date)
        : [...phaseData.dates, date];

      const newSelectedDates = selectedDates.map(item =>
        item.phaseId === phaseId ? { ...item, dates: newDates } : item
      );

      onSelectionChange(selectedPhases, newSelectedDates);
    }
  };

  const selectAllDatesForPhase = (phaseId: string) => {
    const dates = datesByPhase[phaseId] || [];
    const allDates = dates.map(d => d.date);

    const phaseData = selectedDates.find(item => item.phaseId === phaseId);
    
    if (!phaseData) {
      onSelectionChange(selectedPhases, [...selectedDates, { phaseId, dates: allDates }]);
    } else {
      const newSelectedDates = selectedDates.map(item =>
        item.phaseId === phaseId ? { ...item, dates: allDates } : item
      );
      onSelectionChange(selectedPhases, newSelectedDates);
    }
  };

  const deselectAllDatesForPhase = (phaseId: string) => {
    const newSelectedDates = selectedDates.map(item =>
      item.phaseId === phaseId ? { ...item, dates: [] } : item
    );
    onSelectionChange(selectedPhases, newSelectedDates);
  };

  const getSelectedDatesForPhase = (phaseId: string): string[] => {
    const phaseData = selectedDates.find(item => item.phaseId === phaseId);
    return phaseData?.dates || [];
  };

  if (loadingPhases) {
    return (
      <div className={`flex items-center justify-center p-8 rounded-lg border ${
        theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
      }`}>
        <Loader2 className="w-6 h-6 animate-spin text-[#3EC1C5]" />
        <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Loading phases...
        </span>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className={`p-4 rounded-lg border text-center ${
        theme === 'dark' ? 'bg-gray-700/50 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <p className="text-sm">No phases found in input directory</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 relative z-10">
      {/* Phase Multi-Select Dropdown */}
      <div className="relative z-20">
        <AnalysisMultiSelect
          value={selectedPhases}
          onChange={handlePhaseSelectionChange}
          options={phases.map(phase => ({
            value: phase.phaseId,
            label: phase.displayName
          }))}
          placeholder="Select phases..."
        />
      </div>

      {/* Selected Phases List with Dates */}
      {selectedPhases.length > 0 && (
        twoColumnLayout ? (
          /* Two-Column Layout: Phase on left, dates on right at same height - All in one card */
          <div className={`p-3 rounded-lg border space-y-2 ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {selectedPhases.map(phaseId => {
              const phase = phases.find(p => p.phaseId === phaseId);
              if (!phase) return null;

              const phaseDates = datesByPhase[phaseId] || [];
              const selectedDatesForPhase = getSelectedDatesForPhase(phaseId);
              const isExpanded = expandedPhases.has(phaseId);

              return (
                <div
                  key={phaseId}
                  className="grid grid-cols-2 gap-3"
                >
                  {/* Left: Phase */}
                  <button
                    type="button"
                    onClick={() => togglePhaseExpansion(phaseId)}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      isExpanded
                        ? theme === 'dark'
                          ? 'bg-[#3EC1C5]/20 border-2 border-[#3EC1C5]'
                          : 'bg-[#3EC1C5]/10 border-2 border-[#3EC1C5]'
                        : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 border-2 border-transparent'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${
                        isExpanded ? 'text-[#3EC1C5]' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <div className="text-left">
                        <div className={`text-sm font-medium ${
                          isExpanded ? 'text-[#3EC1C5]' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>
                          {phase.displayName}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Right: Date Selection */}
                  <div className={`flex items-center ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  } rounded-lg p-3`}>
                    {!isExpanded ? (
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Click phase to select dates
                      </div>
                    ) : loadingDates[phaseId] ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#3EC1C5]" />
                        <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Loading...
                        </span>
                      </div>
                    ) : phaseDates.length === 0 ? (
                      <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        No dates found
                      </div>
                    ) : phaseDates.length === 1 ? (
                      /* Single Date: Show custom checkbox */
                      <button
                        type="button"
                        onClick={() => toggleDate(phaseId, phaseDates[0].date)}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <span className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          selectedDatesForPhase.includes(phaseDates[0].date)
                            ? 'bg-[#3EC1C5] border-[#3EC1C5]'
                            : theme === 'dark' ? 'border-gray-500 bg-gray-600' : 'border-gray-300 bg-white'
                        }`}>
                          {selectedDatesForPhase.includes(phaseDates[0].date) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                          {phaseDates[0].date}
                        </span>
                      </button>
                    ) : (
                      /* Multiple Dates: Show date range and controls */
                      <div className="flex items-center gap-2 w-full">
                        {/* Date Range Display */}
                        {selectedDatesForPhase.length > 0 && (
                          <div className={`text-xs px-2 py-1 rounded ${
                            theme === 'dark' ? 'bg-[#3EC1C5]/20 text-[#3EC1C5]' : 'bg-[#3EC1C5]/10 text-[#3EC1C5]'
                          }`}>
                            {selectedDatesForPhase.length === phaseDates.length ? (
                              'All dates'
                            ) : selectedDatesForPhase.length === 1 ? (
                              selectedDatesForPhase[0]
                            ) : (
                              (() => {
                                const sortedDates = [...selectedDatesForPhase].sort();
                                return `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
                              })()
                            )}
                          </div>
                        )}
                        
                        {/* Multi-select Dropdown */}
                        <div className="flex-1">
                          <AnalysisMultiSelect
                            value={selectedDatesForPhase}
                            onChange={(dates) => {
                              const newSelectedDates = selectedDates.map(item =>
                                item.phaseId === phaseId ? { ...item, dates } : item
                              );
                              if (!selectedDates.find(item => item.phaseId === phaseId)) {
                                newSelectedDates.push({ phaseId, dates });
                              }
                              onSelectionChange(selectedPhases, newSelectedDates);
                            }}
                            options={phaseDates.map(d => ({
                              value: d.date,
                              label: d.date
                            }))}
                            placeholder="Select dates..."
                          />
                        </div>

                        {/* Select All / Deselect All */}
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => selectAllDatesForPhase(phaseId)}
                            className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap ${
                              theme === 'dark'
                                ? 'bg-[#3EC1C5]/10 text-[#3EC1C5] hover:bg-[#3EC1C5]/20'
                                : 'bg-[#3EC1C5]/10 text-[#3EC1C5] hover:bg-[#3EC1C5]/20'
                            }`}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={() => deselectAllDatesForPhase(phaseId)}
                            className={`text-xs px-2 py-1 rounded transition-colors whitespace-nowrap ${
                              theme === 'dark'
                                ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            None
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Original Single-Column Layout */
          <div className="space-y-2">
            {selectedPhases.map(phaseId => {
              const phase = phases.find(p => p.phaseId === phaseId);
              if (!phase) return null;

              const isExpanded = expandedPhases.has(phaseId);
              const phaseDates = datesByPhase[phaseId] || [];
              const selectedDatesCount = getSelectedDatesForPhase(phaseId).length;

              return (
                <div
                  key={phaseId}
                  className={`rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Phase Header */}
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => togglePhaseExpansion(phaseId)}
                      className={`w-full flex items-center justify-between text-left p-2 rounded-lg transition-colors ${
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          theme === 'dark' ? 'bg-[#3EC1C5]/20' : 'bg-[#3EC1C5]/10'
                        }`}>
                          <Calendar className="w-4 h-4 text-[#3EC1C5]" />
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {phase.displayName}
                          </div>
                          {selectedDatesCount > 0 && (
                            <div className="text-xs text-[#3EC1C5] mt-0.5">
                              {selectedDatesCount} date{selectedDatesCount > 1 ? 's' : ''} selected
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''} ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Dates List */}
                  {isExpanded && (
                    <div className={`border-t ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="p-3 space-y-3">
                        {loadingDates[phaseId] ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-[#3EC1C5]" />
                            <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              Loading dates...
                            </span>
                          </div>
                        ) : phaseDates.length === 0 ? (
                          <div className={`py-6 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            No dates found for this phase
                          </div>
                        ) : (
                          <>
                            {/* Select All / Deselect All */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllDatesForPhase(phaseId)}
                                className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-[#3EC1C5]/10 text-[#3EC1C5] hover:bg-[#3EC1C5]/20'
                                    : 'bg-[#3EC1C5]/10 text-[#3EC1C5] hover:bg-[#3EC1C5]/20'
                                }`}
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => deselectAllDatesForPhase(phaseId)}
                                className={`flex-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                                  theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                Deselect All
                              </button>
                            </div>

                            {/* Date Checkboxes */}
                            <div className={`space-y-1 max-h-64 overflow-y-auto rounded-lg p-2 ${
                              theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            }`}>
                              {phaseDates.map(dateInfo => {
                                const isDateSelected = getSelectedDatesForPhase(phaseId).includes(dateInfo.date);
                                
                                return (
                                  <button
                                    key={dateInfo.date}
                                    type="button"
                                    onClick={() => toggleDate(phaseId, dateInfo.date)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                      isDateSelected
                                        ? theme === 'dark' ? 'bg-[#3EC1C5]/15' : 'bg-[#3EC1C5]/10'
                                        : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-white hover:shadow-sm'
                                    }`}
                                  >
                                    <span className={`flex-shrink-0 w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                                      isDateSelected
                                        ? 'bg-[#3EC1C5] border-[#3EC1C5]'
                                        : theme === 'dark' ? 'border-gray-500 bg-gray-600' : 'border-gray-300 bg-white'
                                    }`}>
                                      {isDateSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                    </span>
                                    <div className="flex items-center gap-2 flex-1">
                                      <Calendar className={`w-4 h-4 ${
                                        isDateSelected ? 'text-[#3EC1C5]' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      }`} />
                                      <span className={`text-sm ${
                                        isDateSelected
                                          ? 'text-[#3EC1C5] font-medium'
                                          : theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                                      }`}>
                                        {dateInfo.date}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
