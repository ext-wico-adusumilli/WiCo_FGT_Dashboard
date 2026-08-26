import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { LogDetailsDashboardOptimized } from '../components/log-details/LogDetailsDashboardOptimized';
import { FlightAnalysisCharts } from '../components/log-details/FlightAnalysisCharts';
import { LogDetailsTableOptimized } from '../components/log-details/LogDetailsTableOptimized';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';

export function LogDetailsPageOptimized() {
  const { theme } = useTheme();
  const [selectedSNs, setSelectedSNs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [expandedMetric, setExpandedMetric] = useState<'flightTime' | 'distance' | 'battery' | null>(null);
  const [flightFilter, setFlightFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null>(null);
  
  // Visible sections state
  const [visibleSections, setVisibleSections] = useState<string[]>([
    'flightAnalysis'
  ]);

  // Get unique SNs from cookies or fetch from API
  const [uniqueSNs, setUniqueSNs] = useState<string[]>([]);

  // Fetch unique SNs on mount
  useEffect(() => {
    const fetchUniqueSNs = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(
          `${API_BASE_URL}/log-details/serial-numbers`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setUniqueSNs(data.sort());
        }
      } catch (error) {
        console.error('Error fetching unique SNs:', error);
      }
    };
    fetchUniqueSNs();
  }, []);

  // Prepare filter options
  const snOptions = useMemo(() => 
    uniqueSNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueSNs]);

  // Section visibility options
  const sectionOptions = [
    { value: 'flightAnalysis', label: 'Flight Analysis' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 w-full">
      {/* Global Filters and Section Visibility */}
      <div className="space-y-1.5 sm:space-y-2">
        <span className={`text-xs ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>Filters:</span>
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
          {(selectedSNs.length > 0 || dateRange.start !== null) && (
            <button
              onClick={() => {
                setSelectedSNs([]);
                setDateRange({ start: null, end: null });
              }}
              className={`flex items-center justify-center sm:justify-start gap-1 px-2 py-1 text-xs transition sm:mt-1 ${
                theme === 'dark' 
                  ? 'text-gray-400 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <X className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Dashboard with Stats - OPTIMIZED */}
      <LogDetailsDashboardOptimized 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
      />

      {/* Flight Analysis Charts - Note: This still loads all data, could be optimized further */}
      {visibleSections.includes('flightAnalysis') && (
        <FlightAnalysisCharts
          entries={[]} // Empty array - charts will need to fetch their own data
          selectedSNs={selectedSNs}
          dateRange={dateRange}
          expandedMetric={expandedMetric}
          onFilterChange={setFlightFilter}
        />
      )}

      {/* Log Details Table - OPTIMIZED with server-side pagination */}
      <LogDetailsTableOptimized 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        flightFilter={flightFilter}
        onClearFlightFilter={() => setFlightFilter(null)}
      />
    </div>
  );
}


