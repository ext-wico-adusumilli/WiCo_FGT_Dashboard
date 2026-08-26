import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { BatteryOverviewDashboard } from './BatteryOverviewDashboard';
import { ExcelExport } from '../ExcelExport';
import { MultiSelect } from '../MultiSelect';
import { DateRangePicker } from '../DateRangePicker';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  flight: boolean;
  battery_0_sn: string;
  battery_0_cycle: number;
  battery_0_max_temp: number;
  battery_0_remaining: number;
  battery_1_sn: string;
  battery_1_cycle: number;
  battery_1_max_temp: number;
  battery_1_remaining: number;
}

interface AggregatedBatteryEntry {
  batterySN: string;
  recentCycleCount: number; // Most recent cycle count
  totalFlightTime: number; // in seconds
  lastUsage: string;
  lastUaSN: string; // Last UA SN this battery was used with
  avgCycleCount: number;
  avgMaxTemp: number;
  avgRemaining: number;
}

interface BatteryOverviewTableProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

export function BatteryOverviewTable({ 
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: BatteryOverviewTableProps) {
  const { theme } = useTheme();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [summarySortField, setSummarySortField] = useState<'batterySN' | 'recentCycleCount' | 'totalFlightTime' | 'lastUsage' | 'lastUaSN'>('batterySN');
  const [summarySortOrder, setSummarySortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedMetric, setExpandedMetric] = useState<'cycleCount' | 'temperature' | 'flightTimeRange' | null>(null);
  const [selectedBatterySNs, setSelectedBatterySNs] = useState<string[]>([]);
  const [batteryDateRange, setBatteryDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [visibleColumns, setVisibleColumns] = useState({
    batterySN: true,
    recentCycleCount: true,
    totalFlightTime: false,
    lastUsage: true,
    lastUaSN: true,
  });
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchEntries();
  }, []);

  // Close column toggle when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColumnToggle) {
        const target = event.target as Element;
        if (!target.closest('.column-toggle-container')) {
          setShowColumnToggle(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnToggle]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      // Build query parameters for server-side filtering
      const params = new URLSearchParams();
      params.append('all', 'true');
      params.append('flight', 'true'); // Only fetch flight entries
      
      const response = await fetch(
        `${API_BASE_URL}/log-details?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const response_data = await response.json();
        // Handle both old format (direct array) and new format (with pagination)
        const data = Array.isArray(response_data) ? response_data : response_data.data || [];
        setLogEntries(data);
      } else {
        showToast('Failed to fetch entries', 'error');
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      showToast('Error fetching entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Parse date from YYMMDD format to YYYY-MM-DD for comparison
  const parseDateForComparison = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 6) return '';
    
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    
    return `${year}-${month}-${day}`;
  };

  // Filter log entries by date range (use parent filters if provided, otherwise use local filters)
  const filteredLogEntries = useMemo(() => {
    const activeDateRange = dateRange.start || dateRange.end ? dateRange : batteryDateRange;
    const activeSNs = selectedSNs.length > 0 ? selectedSNs : [];

    return logEntries.filter(entry => {
      // SN filter (filter by UA SN)
      const matchesSN = activeSNs.length === 0 || activeSNs.includes(entry.sn);
      
      // Date range filter
      let matchesDate = true;
      if (activeDateRange.start || activeDateRange.end) {
        const entryDate = parseDateForComparison(entry.date);
        if (entryDate) {
          if (activeDateRange.start && activeDateRange.end) {
            matchesDate = entryDate >= activeDateRange.start && entryDate <= activeDateRange.end;
          } else if (activeDateRange.start) {
            matchesDate = entryDate >= activeDateRange.start;
          } else if (activeDateRange.end) {
            matchesDate = entryDate <= activeDateRange.end;
          }
        } else {
          matchesDate = false;
        }
      }
      
      return matchesSN && matchesDate;
    });
  }, [logEntries, selectedSNs, dateRange, batteryDateRange]);

  // Aggregate battery data directly from filtered log entries
  const aggregatedBatteries = useMemo((): AggregatedBatteryEntry[] => {
    const batteryMap = new Map<string, AggregatedBatteryEntry>();
    
    filteredLogEntries.forEach(entry => {
      // Process Battery 0
      if (entry.battery_0_sn && entry.battery_0_sn.trim() !== '') {
        const batterySN = entry.battery_0_sn;
        if (batteryMap.has(batterySN)) {
          const existing = batteryMap.get(batterySN)!;
          const existingDate = parseDateForComparison(existing.lastUsage);
          const entryDate = parseDateForComparison(entry.date);
          
          batteryMap.set(batterySN, {
            batterySN,
            recentCycleCount: entryDate > existingDate ? entry.battery_0_cycle : existing.recentCycleCount,
            totalFlightTime: existing.totalFlightTime + entry.flight_time,
            lastUsage: entryDate > existingDate ? entry.date : existing.lastUsage,
            lastUaSN: entryDate > existingDate ? entry.sn : existing.lastUaSN,
            avgCycleCount: Math.round((existing.avgCycleCount + entry.battery_0_cycle) / 2),
            avgMaxTemp: Math.round(((existing.avgMaxTemp + entry.battery_0_max_temp) / 2) * 10) / 10,
            avgRemaining: Math.round(((existing.avgRemaining + entry.battery_0_remaining) / 2) * 10) / 10,
          });
        } else {
          batteryMap.set(batterySN, {
            batterySN,
            recentCycleCount: entry.battery_0_cycle,
            totalFlightTime: entry.flight_time,
            lastUsage: entry.date,
            lastUaSN: entry.sn,
            avgCycleCount: entry.battery_0_cycle,
            avgMaxTemp: entry.battery_0_max_temp,
            avgRemaining: entry.battery_0_remaining,
          });
        }
      }

      // Process Battery 1
      if (entry.battery_1_sn && entry.battery_1_sn.trim() !== '') {
        const batterySN = entry.battery_1_sn;
        if (batteryMap.has(batterySN)) {
          const existing = batteryMap.get(batterySN)!;
          const existingDate = parseDateForComparison(existing.lastUsage);
          const entryDate = parseDateForComparison(entry.date);
          
          batteryMap.set(batterySN, {
            batterySN,
            recentCycleCount: entryDate > existingDate ? entry.battery_1_cycle : existing.recentCycleCount,
            totalFlightTime: existing.totalFlightTime + entry.flight_time,
            lastUsage: entryDate > existingDate ? entry.date : existing.lastUsage,
            lastUaSN: entryDate > existingDate ? entry.sn : existing.lastUaSN,
            avgCycleCount: Math.round((existing.avgCycleCount + entry.battery_1_cycle) / 2),
            avgMaxTemp: Math.round(((existing.avgMaxTemp + entry.battery_1_max_temp) / 2) * 10) / 10,
            avgRemaining: Math.round(((existing.avgRemaining + entry.battery_1_remaining) / 2) * 10) / 10,
          });
        } else {
          batteryMap.set(batterySN, {
            batterySN,
            recentCycleCount: entry.battery_1_cycle,
            totalFlightTime: entry.flight_time,
            lastUsage: entry.date,
            lastUaSN: entry.sn,
            avgCycleCount: entry.battery_1_cycle,
            avgMaxTemp: entry.battery_1_max_temp,
            avgRemaining: entry.battery_1_remaining,
          });
        }
      }
    });
    
    return Array.from(batteryMap.values());
  }, [filteredLogEntries]);

  // Get unique battery SNs for filter
  const uniqueBatterySNs = useMemo(() => {
    const sns = new Set(aggregatedBatteries.map(e => e.batterySN));
    return Array.from(sns).sort();
  }, [aggregatedBatteries]);

  const batterySnOptions = useMemo(() => 
    uniqueBatterySNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueBatterySNs]);

  // Filter and sort aggregated batteries for the summary table
  const filteredAndSortedAggregated = useMemo(() => {
    return aggregatedBatteries
      .filter(entry => {
        const matchesSearch = entry.batterySN.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.lastUaSN.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBatterySN = selectedBatterySNs.length === 0 || selectedBatterySNs.includes(entry.batterySN);
        return matchesSearch && matchesBatterySN;
      })
      .sort((a, b) => {
        let aVal: any = a[summarySortField as keyof AggregatedBatteryEntry];
        let bVal: any = b[summarySortField as keyof AggregatedBatteryEntry];
        
        const modifier = summarySortOrder === 'asc' ? 1 : -1;
        
        // Special handling for Battery SN - treat as numeric if possible
        if (summarySortField === 'batterySN') {
          const aNum = parseInt(String(aVal));
          const bNum = parseInt(String(bVal));
          
          // If both are valid numbers, sort numerically
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return (aNum - bNum) * modifier;
          }
          // Otherwise fall back to string comparison
          return String(aVal).localeCompare(String(bVal)) * modifier;
        }
        
        // For other string fields
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * modifier;
        }
        
        // For numeric fields
        return (aVal > bVal ? 1 : -1) * modifier;
      });
  }, [aggregatedBatteries, searchQuery, summarySortField, summarySortOrder, selectedBatterySNs]);

  const handleSummarySort = (field: 'batterySN' | 'recentCycleCount' | 'totalFlightTime' | 'lastUsage' | 'lastUaSN') => {
    if (summarySortField === field) {
      setSummarySortOrder(summarySortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSummarySortField(field);
      setSummarySortOrder('asc');
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  // Format time from seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Parse date from YYMMDD format and format as DD MMM YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 6) return 'Invalid Date';
    
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    
    const date = new Date(`${year}-${month}-${day}`);
    
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${monthNames[date.getMonth()]} ${year}`;
  };

  // Format export filename
  const getExportFilename = () => {
    let filename = 'battery_overview';
    const parts = [];
    if (selectedBatterySNs.length > 0) {
      parts.push(`Battery_${selectedBatterySNs.join('_')}`);
    }
    if (batteryDateRange.start || batteryDateRange.end) {
      const start = batteryDateRange.start || 'start';
      const end = batteryDateRange.end || 'end';
      parts.push(`${start}_to_${end}`);
    }
    if (parts.length > 0) {
      filename += '_' + parts.join('_');
    }
    return filename;
  };

  // Format sheet title with report generation date
  const getSheetTitle = () => {
    const today = new Date();
    const reportDate = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    const parts = [`Battery Overview - Report Generated: ${reportDate}`];
    
    if (selectedBatterySNs.length > 0) {
      parts.push(`Battery SN: ${selectedBatterySNs.join(', ')}`);
    }
    if (batteryDateRange.start || batteryDateRange.end) {
      const start = batteryDateRange.start || 'Start';
      const end = batteryDateRange.end || 'End';
      parts.push(`Date Range: ${start} to ${end}`);
    }
    
    return parts.join(' | ');
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-4 border ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`h-12 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      {/* Filters - Only show if not receiving filters from parent */}
      {selectedSNs.length === 0 && !dateRange.start && !dateRange.end && (
        <div className="space-y-1">
          <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Filters:</span>
          <div className="flex flex-wrap items-start gap-2">
            <div className="w-48">
              <MultiSelect
                value={selectedBatterySNs}
                onChange={setSelectedBatterySNs}
                options={batterySnOptions}
                placeholder="All Battery SNs"
              />
            </div>
            <div className="w-48">
              <DateRangePicker
                key={`${batteryDateRange.start}-${batteryDateRange.end}`}
                onApply={(start, end) => setBatteryDateRange({ start, end })}
                onCancel={() => {}}
                initialStart={batteryDateRange.start}
                initialEnd={batteryDateRange.end}
              />
            </div>
            {(selectedBatterySNs.length > 0 || batteryDateRange.start !== null) && (
              <button
                onClick={() => {
                  setSelectedBatterySNs([]);
                  setBatteryDateRange({ start: null, end: null });
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
                  theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard */}
      <BatteryOverviewDashboard 
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        selectedBatterySNs={selectedBatterySNs}
        batteryDateRange={batteryDateRange}
      />

      {/* Search and Actions */}
      <div className="flex justify-between items-center gap-2">
        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Summary by Battery SN</h3>
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Battery SN..."
              className={`pl-7 pr-7 py-1.5 h-[30px] border rounded transition text-xs w-40 focus:outline-none ${
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                  : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${
                  theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Excel Export */}
          <ExcelExport
            data={[]}
            filename={getExportFilename()}
            sheets={[
              {
                name: 'Battery Overview',
                data: [
                  // Add title row at the top
                  {
                    'S. No': getSheetTitle(),
                    'Battery SN': '',
                    'Cycle Count': '',
                    'Total Flight Time': '',
                    'Last Usage': '',
                    'Last UA SN': '',
                  },
                  // Add empty row for spacing
                  {
                    'S. No': '',
                    'Battery SN': '',
                    'Cycle Count': '',
                    'Total Flight Time': '',
                    'Last Usage': '',
                    'Last UA SN': '',
                  },
                  // Add actual data
                  ...filteredAndSortedAggregated.map((entry, idx) => ({
                    'S. No': idx + 1,
                    'Battery SN': entry.batterySN,
                    'Cycle Count': entry.recentCycleCount,
                    'Total Flight Time': formatTime(entry.totalFlightTime),
                    'Last Usage': formatDate(entry.lastUsage),
                    'Last UA SN': entry.lastUaSN,
                  }))
                ],
                columns: [
                  { key: 'S. No', label: 'S. No' },
                  { key: 'Battery SN', label: 'Battery SN' },
                  { key: 'Cycle Count', label: 'Cycle Count' },
                  { key: 'Total Flight Time', label: 'Total Flight Time' },
                  { key: 'Last Usage', label: 'Last Usage' },
                  { key: 'Last UA SN', label: 'Last UA SN' },
                ]
              }
            ]}
          />

          {/* Column Toggle */}
          <div className="relative column-toggle-container">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Columns3 className="w-3 h-3" />
              <span className="text-xs">Columns</span>
            </button>
            {showColumnToggle && (
              <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg p-2 z-50 max-h-64 overflow-y-auto border ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <h4 className={`text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Columns</h4>
                <div className="space-y-1">
                  {Object.entries(visibleColumns).map(([key, value]) => {
                    const label = key === 'batterySN' ? 'Battery SN' :
                                 key === 'recentCycleCount' ? 'Cycle Count' :
                                 key === 'totalFlightTime' ? 'Total Flight Time' :
                                 key === 'lastUsage' ? 'Last Usage' :
                                 key === 'lastUaSN' ? 'Last UA SN' :
                                 key.replace(/([A-Z])/g, ' $1').trim();
                    return (
                      <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${
                        theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                      }`}>
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                          className={`rounded w-3 h-3 ${
                            theme === 'dark'
                              ? 'border-gray-600 text-[#3EC1C5] focus:ring-[#3EC1C5]'
                              : 'border-gray-300 text-gray-900 focus:ring-gray-900'
                          }`}
                        />
                        <span className="text-xs">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300 bg-white'
      }`}>
        <table className="w-full text-xs">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            theme === 'dark' ? 'text-gray-400 bg-gray-700' : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16 text-center">S. No</th>
              {visibleColumns.batterySN && (
                <th 
                  onClick={() => handleSummarySort('batterySN')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-left"
                >
                  <div className="flex items-center justify-start gap-1">
                    Battery SN
                    {summarySortField === 'batterySN' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.recentCycleCount && (
                <th 
                  onClick={() => handleSummarySort('recentCycleCount')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Cycle Count
                    {summarySortField === 'recentCycleCount' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.totalFlightTime && (
                <th 
                  onClick={() => handleSummarySort('totalFlightTime')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Total Flight Time
                    {summarySortField === 'totalFlightTime' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.lastUsage && (
                <th 
                  onClick={() => handleSummarySort('lastUsage')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Last Usage
                    {summarySortField === 'lastUsage' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.lastUaSN && (
                <th 
                  onClick={() => handleSummarySort('lastUaSN')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Last UA SN
                    {summarySortField === 'lastUaSN' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
            {filteredAndSortedAggregated.length > 0 ? (
              filteredAndSortedAggregated.map((entry, idx) => (
                <tr key={entry.batterySN} className={`border-b transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className="px-3 py-2 text-center">{idx + 1}</td>
                  {visibleColumns.batterySN && <td className="px-3 py-2 font-medium text-left">{entry.batterySN}</td>}
                  {visibleColumns.recentCycleCount && <td className="px-3 py-2 text-center">{entry.recentCycleCount}</td>}
                  {visibleColumns.totalFlightTime && <td className="px-3 py-2 text-center font-mono">{formatTime(entry.totalFlightTime)}</td>}
                  {visibleColumns.lastUsage && <td className="px-3 py-2 text-center">{formatDate(entry.lastUsage)}</td>}
                  {visibleColumns.lastUaSN && <td className="px-3 py-2 text-center font-medium">{entry.lastUaSN}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length + 1} className={`px-3 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  No batteries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className={`text-xs text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Showing {filteredAndSortedAggregated.length} unique batteries
      </div>
    </div>
  );
}


