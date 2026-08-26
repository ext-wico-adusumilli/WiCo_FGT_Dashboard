import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { LogDetailsDashboard } from '../components/log-details/LogDetailsDashboard';
import { FlightAnalysisCharts } from '../components/log-details/FlightAnalysisCharts';
import { LogDetailsTable } from '../components/log-details/LogDetailsTable';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  total_time: number;
  flight_time: number;
  filtered_flight_time: number;
  mc_time: number;
  fw_time: number;
  fc_version: string;
  cs_version: string;
  fwd_transitions: number;
  bwd_transitions: number;
  lte_loss: number;
  rth_loss: number;
  rth_logs: number;
  distance: number;
  fwd_distance: number;
  bwd_distance: number;
  max_mc_xy_deviation: number;
  max_mc_altitude_deviation: number;
  max_fw_xy_deviation: number | null;
  max_fw_altitude_deviation: number | null;
  battery_0_sn: string;
  battery_0_cycle: number;
  battery_0_max_temp: number;
  battery_0_remaining: number;
  battery_1_sn: string;
  battery_1_cycle: number;
  battery_1_max_temp: number;
  battery_1_remaining: number;
  calculated_groundspeed: number;
  last_usage: string;
  flight: boolean;
}

export function LogDetailsPage() {
  const { theme } = useTheme();
  const [selectedSNs, setSelectedSNs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [expandedMetric, setExpandedMetric] = useState<'flightTime' | 'distance' | 'battery' | null>(null);
  const [flightFilter, setFlightFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null>(null);
  
  // Visible sections state
  const [visibleSections, setVisibleSections] = useState<string[]>([
    'flightAnalysis'
  ]);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const BATCH_SIZE = 2000; // Match table batch size
      let allEntries: LogEntry[] = [];
      let currentBatch = 1;
      let hasMoreData = true;

      // Load all data in batches to match table behavior
      while (hasMoreData) {
        const response = await fetch(
          `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=${currentBatch}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const response_data = await response.json();
          // Handle both old format (direct array) and new format (with pagination)
          const data = Array.isArray(response_data) ? response_data : response_data.data || [];
          
          if (data.length === 0) {
            hasMoreData = false;
          } else {
            allEntries = [...allEntries, ...data];
            currentBatch++;
            
            // If we got less than the batch size, we've reached the end
            if (data.length < BATCH_SIZE) {
              hasMoreData = false;
            }
          }
        } else {
          hasMoreData = false;
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching log details:', error);
    }
  };

  // Get unique values for filters
  const uniqueSNs = useMemo(() => {
    const sns = new Set(entries.map(e => e.sn).filter(s => s));
    return Array.from(sns).sort();
  }, [entries]);

  // Prepare filter options
  const snOptions = useMemo(() => 
    uniqueSNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueSNs]);

  // Section visibility options
  const sectionOptions = [
    { value: 'flightAnalysis', label: 'Flight Analysis' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 w-full">
      {/* Global Filters and Section Visibility */}
      <div className="flex flex-wrap items-start gap-2">
        <span className={`text-xs mt-1.5 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>Filters:</span>
        <div className="w-48">
          <MultiSelect
            value={selectedSNs}
            onChange={setSelectedSNs}
            options={snOptions}
            placeholder="All SNs"
          />
        </div>
        <div className="w-48">
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
            className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <X className="w-3 h-3" />
            Clear Filters
          </button>
        )}
        <div className="flex-1"></div>
        <span className={`text-xs mt-1.5 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>Show Sections:</span>
        <div className="w-64">
          <MultiSelect
            value={visibleSections}
            onChange={setVisibleSections}
            options={sectionOptions}
            placeholder="Select sections to display"
          />
        </div>
      </div>

      {/* Dashboard with Stats */}
      <LogDetailsDashboard 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
      />

      {/* Flight Analysis Charts */}
      {visibleSections.includes('flightAnalysis') && (
        <FlightAnalysisCharts
          entries={entries}
          selectedSNs={selectedSNs}
          dateRange={dateRange}
          expandedMetric={expandedMetric}
          onFilterChange={setFlightFilter}
        />
      )}

      {/* Log Details Table */}
      <LogDetailsTable 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        flightFilter={flightFilter}
        onClearFlightFilter={() => setFlightFilter(null)}
      />
    </div>
  );
}


