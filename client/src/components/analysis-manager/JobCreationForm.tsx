import React, { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { CustomSelect } from '../CustomSelect';
import { DataSelector } from './DataSelector';
import { airflowService } from '../../services/airflowService';
import { useJobCreation } from '../../hooks/useJobCreation';
import { AirflowScript, Job } from '../../types/airflow';

interface JobCreationFormProps {
  onSuccess: (job: Job) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function JobCreationForm({ onSuccess, onCancel, isOpen }: JobCreationFormProps) {
  const { theme } = useTheme();
  const { createJob, isSubmitting, error, clearError } = useJobCreation();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scriptId: '',
    startDate: '',
    endDate: '',
    dataSourceType: 'date_range' as 'date_range' | 'phase_date',
    selectedPhases: [] as string[],
    selectedDates: [] as { phaseId: string; dates: string[] }[],
    parameters: {} as Record<string, any>
  });
  const [scripts, setScripts] = useState<AirflowScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<AirflowScript | null>(null);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        scriptId: '',
        startDate: '',
        endDate: '',
        dataSourceType: 'phase_date', // Always use phase_date mode
        selectedPhases: [],
        selectedDates: [],
        parameters: {}
      });
      setSelectedScript(null);
      setErrors({});
      clearError();
    }
  }, [isOpen, clearError]);

  // Load available scripts on component mount
  useEffect(() => {
    const loadScripts = async () => {
      try {
        setLoadingScripts(true);
        const availableScripts = await airflowService.getScripts();
        setScripts(availableScripts);
      } catch (error) {
        console.error('Failed to load scripts:', error);
        setScripts([]);
      } finally {
        setLoadingScripts(false);
      }
    };

    loadScripts();
  }, []);

  // Update selected script when scriptId changes
  useEffect(() => {
    if (formData.scriptId) {
      const script = scripts.find(s => s.scriptId === formData.scriptId);
      setSelectedScript(script || null);

      // Initialize parameters with default values
      if (script) {
        const defaultParams: Record<string, any> = {};
        script.parameters.forEach(param => {
          if (param.defaultValue !== undefined) {
            defaultParams[param.name] = param.defaultValue;
          }
        });
        setFormData(prev => ({ ...prev, parameters: defaultParams }));
      }
    } else {
      setSelectedScript(null);
      setFormData(prev => ({ ...prev, parameters: {} }));
    }
  }, [formData.scriptId, scripts]);

  // Auto-populate start_date and end_date parameters from selected dates
  useEffect(() => {
    if (formData.selectedDates.length > 0) {
      // Get all selected dates and find min/max
      const allDates: string[] = [];
      formData.selectedDates.forEach(item => {
        allDates.push(...item.dates);
      });

      if (allDates.length > 0) {
        const sortedDates = allDates.sort();
        const startDate = sortedDates[0];
        const endDate = sortedDates[sortedDates.length - 1];

        // Update parameters if script has start_date/end_date parameters
        setFormData(prev => ({
          ...prev,
          parameters: {
            ...prev.parameters,
            start_date: startDate,
            end_date: endDate
          }
        }));
      }
    }
  }, [formData.selectedDates]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDataSelectionChange = (phases: string[], dates: { phaseId: string; dates: string[] }[]) => {
    setFormData(prev => ({
      ...prev,
      selectedPhases: phases,
      selectedDates: dates
    }));
    
    // Clear error when selection changes
    if (errors.phases) {
      setErrors(prev => ({ ...prev, phases: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required field validation
    if (!formData.name.trim()) {
      newErrors.name = 'Job name is required';
    }

    if (!formData.scriptId) {
      newErrors.scriptId = 'Please select a script';
    }

    // Phase and date validation (now required)
    if (formData.selectedPhases.length === 0) {
      newErrors.phases = 'Please select at least one phase';
    } else {
      // Check if at least one date is selected
      const hasSelectedDates = formData.selectedDates.some(item => item.dates.length > 0);
      if (!hasSelectedDates) {
        newErrors.phases = 'Please select at least one date for the selected phases';
      }
    }

    // Script parameter validation (skip start_date and end_date as they're auto-populated)
    if (selectedScript) {
      selectedScript.parameters.forEach(param => {
        // Skip start_date and end_date validation as they're auto-populated from selected dates
        if (param.name === 'start_date' || param.name === 'end_date') {
          return;
        }
        
        if (param.required && !formData.parameters[param.name]) {
          newErrors[`param_${param.name}`] = `${param.name} is required`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🚀 Form submitted');
    console.log('📋 Form data:', formData);

    if (!validateForm()) {
      console.log('❌ Validation failed:', errors);
      return;
    }

    console.log('✅ Validation passed');

    // Clear any previous errors
    clearError();

    try {
      // Calculate date range from selected dates
      let startDate = new Date().toISOString().split('T')[0];
      let endDate = new Date().toISOString().split('T')[0];

      // Get all selected dates and find min/max
      const allDates: string[] = [];
      formData.selectedDates.forEach(item => {
        allDates.push(...item.dates);
      });

      if (allDates.length > 0) {
        const sortedDates = allDates.sort();
        startDate = sortedDates[0];
        endDate = sortedDates[sortedDates.length - 1];
      }

      console.log('📅 Calculated date range:', { startDate, endDate });

      // Prepare job parameters with phase and date data
      const jobParameters: Record<string, any> = {
        ...formData.parameters,
        dataSourceType: 'phase_date',
        selectedPhases: formData.selectedPhases,
        selectedDates: formData.selectedDates
      };

      console.log('📦 Job parameters:', jobParameters);

      const jobPayload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        scriptId: formData.scriptId,
        startDate,
        endDate,
        parameters: Object.keys(jobParameters).length > 0 ? jobParameters : undefined
      };

      console.log('🎯 Creating job with payload:', jobPayload);

      const createdJob = await createJob(jobPayload);

      console.log('✅ Job created successfully:', createdJob);

      // Call success callback with the created job
      onSuccess(createdJob);
    } catch (error) {
      // Error handling is done in the hook
      console.error('❌ Job creation failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Background overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onCancel}
      />

      {/* Modal panel - Made wider */}
      <div className={`
        relative w-full max-w-4xl max-h-[90vh] flex flex-col z-[9999]
        rounded-lg shadow-xl
        ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}
      `}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-1">
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                Create New Analysis Job
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
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

        {/* Form Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <form id="job-creation-form" onSubmit={handleSubmit} className="space-y-6 overflow-visible">
            {/* Global Error Display */}
            {error && (
              <div className={`
            p-4 rounded-lg border
            ${theme === 'dark'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-700'
                }
          `}>
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 mt-0.5" />
                  <div>
                    <h4 className="font-medium mb-1">Job Creation Failed</h4>
                    <p className="text-sm">{error}</p>
                    <button
                      type="button"
                      onClick={clearError}
                      className={`mt-2 text-xs underline hover:no-underline ${theme === 'dark' ? 'text-red-300' : 'text-red-600'
                        }`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Job Details - Job Name and Script on Same Line */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Job Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`
                w-full px-3 py-2.5 border rounded-lg text-sm resize-none ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white focus:border-[#3EC1C5]'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-[#3EC1C5]'
                    }
                ${errors.name ? 'border-red-500' : ''}
                focus:outline-none focus:ring-2 focus:ring-[#3EC1C5]/20
              `}
                  placeholder="Enter job name"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                  Script *
                </label>
                <CustomSelect
                  value={formData.scriptId}
                  onChange={(value) => handleInputChange('scriptId', value)}
                  options={scripts.map(script => ({
                    value: script.scriptId,
                    label: script.name
                  }))}
                  placeholder={loadingScripts ? 'Loading scripts...' : 'Select a script'}
                  className={errors.scriptId ? 'border-red-500' : ''}
                  searchable={true}
                />
                {errors.scriptId && (
                  <p className="mt-1 text-xs text-red-500">{errors.scriptId}</p>
                )}
              </div>
            </div>

            {/* Date Range - Commented out for now */}
            {/* <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Analysis Date Range *
              </label>
              <DateRangePicker
                onApply={handleDateRangeChange}
                initialStart={formData.startDate || null}
                initialEnd={formData.endDate || null}
                className="w-full"
              />
              {(errors.startDate || errors.endDate || errors.dateRange) && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.dateRange || errors.startDate || errors.endDate}
                </p>
              )}
            </div> */}

            {/* Phase and Date Selection */}
            <div className={`rounded-lg border ${
              errors.phases
                ? 'border-red-500'
                : theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${
                theme === 'dark' ? 'border-gray-700 bg-gray-700/40' : 'border-gray-200 bg-gray-50'
              } rounded-t-lg`}>
                <label className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Phase & Date Selection <span className="text-red-500">*</span>
                </label>
                {formData.selectedPhases.length > 0 && (() => {
                  const totalDates = formData.selectedDates.reduce((sum, item) => sum + item.dates.length, 0);
                  return (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#3EC1C5]/15 text-[#3EC1C5] font-medium">
                      {formData.selectedPhases.length} phase{formData.selectedPhases.length > 1 ? 's' : ''}
                      {totalDates > 0 && ` · ${totalDates} date${totalDates > 1 ? 's' : ''}`}
                    </span>
                  );
                })()}
              </div>
              <div className="p-4">
                <DataSelector
                  selectedPhases={formData.selectedPhases}
                  selectedDates={formData.selectedDates}
                  onSelectionChange={handleDataSelectionChange}
                  twoColumnLayout={true}
                />
              </div>
              {errors.phases && (
                <p className="px-4 pb-3 text-xs text-red-500">{errors.phases}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`
              w-full px-3 py-2.5 border rounded-lg text-sm resize-none ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-[#3EC1C5]'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-[#3EC1C5]'
                  }
              focus:outline-none focus:ring-2 focus:ring-[#3EC1C5]/20
            `}
                placeholder="Optional description for this job"
              />
            </div>

            {/* Script Parameters
        {selectedScript && selectedScript.parameters.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Settings className={`w-4 h-4 ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`} />
              <label className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Script Parameters
              </label>
            </div>
            <div className={`
              p-4 rounded-lg border space-y-4
              ${theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600'
                : 'bg-gray-50 border-gray-200'
              }
            `}>
              {selectedScript.parameters.map(param => (
                <div key={param.name}>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {param.name}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {param.description && (
                    <p className={`text-xs mb-2 ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {param.description}
                    </p>
                  )}
                  {renderParameterInput(param)}
                  {errors[`param_${param.name}`] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors[`param_${param.name}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )} */}

            {/* Script Info */}
            {selectedScript && (
              <div className={`
            p-4 rounded-lg border
            ${theme === 'dark'
                  ? 'bg-[#3EC1C5]/10 border-[#3EC1C5]/30'
                  : 'bg-[#3EC1C5]/10 border-[#3EC1C5]/30'
                }
          `}>
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#3EC1C5] mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-[#3EC1C5] mb-1">
                      {selectedScript.name}
                    </h4>
                    {selectedScript.description && (
                      <p className={`text-sm resize-none ${theme === 'dark' ? 'text-[#3EC1C5]/80' : 'text-[#3EC1C5]/90'
                        }`}>
                        {selectedScript.description}
                      </p>
                    )}
                    {/* Show auto-populated parameters */}
                    {formData.parameters.start_date && formData.parameters.end_date && (
                      <div className={`mt-3 pt-3 border-t ${theme === 'dark' ? 'border-[#3EC1C5]/20' : 'border-[#3EC1C5]/20'}`}>
                        <p className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-[#3EC1C5]/70' : 'text-[#3EC1C5]/80'}`}>
                          Auto-populated from selected dates:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className={`${theme === 'dark' ? 'text-[#3EC1C5]/60' : 'text-[#3EC1C5]/70'}`}>Start Date:</span>
                            <span className={`ml-1 font-medium ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-[#3EC1C5]'}`}>
                              {formData.parameters.start_date}
                            </span>
                          </div>
                          <div>
                            <span className={`${theme === 'dark' ? 'text-[#3EC1C5]/60' : 'text-[#3EC1C5]/70'}`}>End Date:</span>
                            <span className={`ml-1 font-medium ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-[#3EC1C5]'}`}>
                              {formData.parameters.end_date}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Sticky Footer */}
          </form>
        </div>

        {/* Sticky Footer */}
        <div className={`flex gap-3 p-4 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <button
            type="submit"
            form="job-creation-form"
            disabled={isSubmitting}
            className={`
                w-[60%] px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                bg-[#3EC1C5] hover:bg-[#35adb1] text-white
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                focus:outline-none focus:ring-2 focus:ring-[#3EC1C5]/20
              `}
          >
            {isSubmitting ? 'Creating Job...' : 'Create Job'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={`
                w-[40%] px-4 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                ${theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }
                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
                focus:outline-none focus:ring-2 focus:ring-gray-500/20
              `}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

