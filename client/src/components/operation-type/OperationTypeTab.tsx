import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { OperationTypeDashboard } from './OperationTypeDashboard';
import { OperationTypeCharts } from './OperationTypeCharts';
import { DateRangePicker } from '../DateRangePicker';
import { MultiSelect } from '../MultiSelect';
import { API_BASE_URL } from '../../config/api';
import { cookieHelpers } from '../../utils/cookies';

export function OperationTypeTab() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedSNs, setSelectedSNs] = useState<string[]>(() => {
    return cookieHelpers.getSelectedItems('operation_type_selected_sns') || [];
  });

  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() => {
    return cookieHelpers.getDateRange('operation_type_date_range') || { start: null, end: null };
  });

  const [availableSNs, setAvailableSNs] = useState<string[]>([]);

  useEffect(() => {
    fetchAvailableSNs();
  }, []);

  useEffect(() => {
    cookieHelpers.setSelectedItems('operation_type_selected_sns', selectedSNs);
  }, [selectedSNs]);

  useEffect(() => {
    cookieHelpers.setDateRange('operation_type_date_range', dateRange);
  }, [dateRange]);

  const fetchAvailableSNs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/log-details/serial-numbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableSNs(data);
      }
    } catch (error) {
      console.error('Error fetching serial numbers:', error);
    }
  };

  const clearAllFilters = () => {
    setSelectedSNs([]);
    setDateRange({ start: null, end: null });
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Filters */}
      <div className="space-y-1">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Filters:</span>
        <div className="flex flex-wrap items-start gap-2">
          <div className="w-48">
            <MultiSelect
              options={availableSNs.map(sn => ({ value: sn, label: sn }))}
              value={selectedSNs}
              onChange={setSelectedSNs}
              placeholder="All Serial Numbers"
            />
          </div>
          <div className="w-48">
            <DateRangePicker
              key={`${dateRange.start}-${dateRange.end}`}
              initialStart={dateRange.start}
              initialEnd={dateRange.end}
              onApply={(start, end) => setDateRange({ start, end })}
            />
          </div>
          {(selectedSNs.length > 0 || dateRange.start !== null) && (
            <button
              onClick={clearAllFilters}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
                isDark 
                  ? 'text-gray-400 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Stats */}
      <OperationTypeDashboard
        selectedSNs={selectedSNs}
        dateRange={dateRange}
      />

      {/* Charts */}
      <OperationTypeCharts
        selectedSNs={selectedSNs}
        dateRange={dateRange}
      />
    </div>
  );
}
