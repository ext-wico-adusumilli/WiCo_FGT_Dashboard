import { API_BASE_URL } from '../config/api';
import { useState, useEffect } from 'react';
import { LTEConnectivityDashboardOptimized } from '../components/lte-connectivity/LTEConnectivityDashboardOptimized';
import { LTEConnectivityTableSimple } from '../components/lte-connectivity/LTEConnectivityTableSimple';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export function LTEConnectivityPageOptimized() {
  const { theme } = useTheme();
  const [selectedSNs, setSelectedSNs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [expandedMetric, setExpandedMetric] = useState<'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null>(null);
  const [connectivityFilter, setConnectivityFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null>(null);

  // Get unique SNs for filter - fetch from API
  const [snOptions, setSNOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchSNOptions();
  }, []);

  const fetchSNOptions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/lte-analysis/dashboard-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        // We'll get SNs from the table data instead
        // For now, leave empty and let user type
      }
    } catch (error) {
      console.error('Error fetching SN options:', error);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedSNs([]);
    setDateRange({ start: null, end: null });
    setConnectivityFilter(null);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
        {/* Filters */}
        <div className="space-y-1.5 sm:space-y-2">
          <span className="text-xs text-gray-400">Filters:</span>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-2">
            <div className="w-full sm:w-48">
              <MultiSelect
                value={selectedSNs}
                onChange={setSelectedSNs}
                options={snOptions}
                placeholder="All SNs"
              />
            </div>
            <div className="w-full sm:w-48">
              <DateRangePicker
                key={`${dateRange.start}-${dateRange.end}`}
                onApply={(start, end) => setDateRange({ start, end })}
                onCancel={() => {}}
                initialStart={dateRange.start}
                initialEnd={dateRange.end}
              />
            </div>
            {(selectedSNs.length > 0 || dateRange.start !== null || connectivityFilter !== null) && (
              <button
                onClick={clearAllFilters}
                className={`flex items-center justify-center sm:justify-start gap-1 px-2 py-1 text-xs transition sm:mt-1 ${
                  theme === 'dark' 
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

        {/* Dashboard */}
        <LTEConnectivityDashboardOptimized 
          selectedSNs={selectedSNs}
          dateRange={dateRange}
          onMetricClick={setExpandedMetric}
          expandedMetric={expandedMetric}
        />

        {/* Table */}
        <LTEConnectivityTableSimple 
          selectedSNs={selectedSNs}
          dateRange={dateRange}
          connectivityFilter={connectivityFilter}
          onClearConnectivityFilter={() => setConnectivityFilter(null)}
        />
      </div>
  );
}


