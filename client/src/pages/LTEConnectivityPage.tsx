import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { LTEConnectivityDashboard } from '../components/lte-connectivity/LTEConnectivityDashboard';
import { LTEConnectivityCharts } from '../components/lte-connectivity/LTEConnectivityCharts';
import { LTEConnectivityTable } from '../components/lte-connectivity/LTEConnectivityTable';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  lte_loss: number;
  rth_loss: number;
  rth_logs: number;
  flight: boolean;
}

interface LTEAnalysisEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  ping_time_above_0: number;
  ping_time_above_1: number;
  ping_time_2_5_to_5: number;
  ping_time_5_to_10: number;
  ping_time_above_10: number;
  total_ping_events: number;
  connectivity_score: number;
  flight: boolean;
}

export function LTEConnectivityPage() {
  const { theme } = useTheme();
  const [selectedSNs, setSelectedSNs] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [lteAnalysisEntries, setLteAnalysisEntries] = useState<LTEAnalysisEntry[]>([]);
  const [expandedMetric, setExpandedMetric] = useState<'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null>(null);
  const [connectivityFilter, setConnectivityFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null>(null);
  


  useEffect(() => {
    fetchEntries();
  }, []);

  // Transform basic log entries to LTE analysis entries
  useEffect(() => {
    const transformedEntries: LTEAnalysisEntry[] = entries.map(entry => ({
      ...entry,
      // Simulate ping time analysis based on lte_loss
      // In a real implementation, these would come from actual analysis
      ping_time_above_0: Math.floor(Math.random() * 15) + (entry.lte_loss || 0),
      ping_time_above_1: Math.floor(Math.random() * 12) + Math.floor((entry.lte_loss || 0) * 0.8),
      ping_time_2_5_to_5: Math.floor(Math.random() * 10) + Math.floor((entry.lte_loss || 0) * 0.6),
      ping_time_5_to_10: Math.floor(Math.random() * 5) + Math.floor((entry.lte_loss || 0) * 0.4),
      ping_time_above_10: Math.floor(Math.random() * 3) + Math.floor((entry.lte_loss || 0) * 0.2),
      total_ping_events: entry.lte_loss || 0,
      connectivity_score: entry.lte_loss ? Math.max(0, 100 - (entry.lte_loss * 10)) : 100,
    }));
    setLteAnalysisEntries(transformedEntries);
  }, [entries]);

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
      </div>

      {/* Dashboard with Stats */}
      <LTEConnectivityDashboard 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
      />

      {/* Connectivity Analysis Charts */}
      <LTEConnectivityCharts
        entries={lteAnalysisEntries}
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        expandedMetric={expandedMetric}
        onFilterChange={setConnectivityFilter}
      />

      {/* LTE Connectivity Table */}
      <LTEConnectivityTable 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        connectivityFilter={connectivityFilter}
        onClearConnectivityFilter={() => setConnectivityFilter(null)}
      />
    </div>
  );
}


