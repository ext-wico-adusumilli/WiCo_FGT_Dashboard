import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { BatteryOverviewDashboard } from './BatteryOverviewDashboard';
import { BatteryChart } from './BatteryChart';
import { ExcelExport } from '../ExcelExport';
import { MultiSelect } from '../MultiSelect';
import { DateRangePicker } from '../DateRangePicker';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';

interface LogEntry {
  _id: string;
  batterySN: string;
  recentCycleCount: number;
  totalFlightTime: number;
  lastUsage: string;
  lastUaSN: string;
  flights: number;
  maxCycleCount: number;
  maxTemp: number;
}

interface AggregatedBatteryEntry {
  batterySN: string;
  recentCycleCount: number;
  totalFlightTime: number;
  lastUsage: string;
  lastUaSN: string;
  avgCycleCount: number;
  avgMaxTemp: number;
  avgRemaining: number;
}

interface BatteryChartEntry {
  _id: string;
  batterySN: string;
  flights: number;
  cycleCount: number;
  peakTemperature: number;
}

type SortField = 'batterySN' | 'recentCycleCount' | 'totalFlightTime' | 'lastUsage' | 'lastUaSN';
type SortOrder = 'asc' | 'desc';

export function BatteryOverviewTableOptimized() {
  const { theme } = useTheme();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => 
    cookieHelpers.getFilterState<string>(COOKIE_KEYS.BATTERY_OVERVIEW_SEARCH) || ''
  );
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.BATTERY_OVERVIEW_SORT);
    return (saved?.key as SortField) || 'batterySN';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.BATTERY_OVERVIEW_SORT);
    return saved?.direction || 'asc';
  });
  const [expandedMetric, setExpandedMetric] = useState<'cycleCount' | 'temperature' | 'flightTimeRange' | null>(null);
  const [selectedBatterySNs, setSelectedBatterySNs] = useState<string[]>(() =>
    cookieHelpers.getSelectedItems(COOKIE_KEYS.BATTERY_OVERVIEW_SELECTED_SNS)
  );
  const [batteryDateRange, setBatteryDateRange] = useState<{ start: string | null; end: string | null }>(() =>
    cookieHelpers.getDateRange(COOKIE_KEYS.BATTERY_OVERVIEW_DATE_RANGE) || { start: null, end: null }
  );
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    cookieHelpers.getVisibleColumns(COOKIE_KEYS.BATTERY_OVERVIEW_VISIBLE_COLUMNS) || {
      batterySN: true,
      recentCycleCount: true,
      totalFlightTime: false,
      lastUsage: true,
      lastUaSN: true,
    }
  );
  const { showToast } = useToast();

  useEffect(() => {
    fetchEntries();
  }, []);

  // Save state to cookies
  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.BATTERY_OVERVIEW_SEARCH, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    cookieHelpers.setSortState(COOKIE_KEYS.BATTERY_OVERVIEW_SORT, { key: sortField, direction: sortOrder });
  }, [sortField, sortOrder]);

  useEffect(() => {
    cookieHelpers.setSelectedItems(COOKIE_KEYS.BATTERY_OVERVIEW_SELECTED_SNS, selectedBatterySNs);
  }, [selectedBatterySNs]);

  useEffect(() => {
    cookieHelpers.setDateRange(COOKIE_KEYS.BATTERY_OVERVIEW_DATE_RANGE, batteryDateRange);
  }, [batteryDateRange]);

  useEffect(() => {
    cookieHelpers.setVisibleColumns(COOKIE_KEYS.BATTERY_OVERVIEW_VISIBLE_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      // Build URL with date range parameters
      const params = new URLSearchParams();
      if (batteryDateRange.start) {
        params.append('startDate', batteryDateRange.start);
      }
      if (batteryDateRange.end) {
        params.append('endDate', batteryDateRange.end);
      }
      
      const response = await fetch(`${API_BASE_URL}/general-overview/battery-overview?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Transform to match expected format
        const transformedData = data.map((item: any) => ({
          _id: item.batterySN,
          batterySN: item.batterySN,
          recentCycleCount: item.recentCycleCount,
          totalFlightTime: item.totalFlightTime,
          lastUsage: item.lastUsage,
          lastUaSN: item.lastUaSN,
          flights: item.flights,
          maxCycleCount: item.maxCycleCount,
          maxTemp: item.maxTemp,
        }));
        setLogEntries(transformedData);
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

  // Aggregate battery data directly from server response
  const aggregatedBatteries = useMemo((): AggregatedBatteryEntry[] => {
    return logEntries.map(entry => ({
      batterySN: entry.batterySN,
      recentCycleCount: entry.recentCycleCount,
      totalFlightTime: entry.totalFlightTime,
      lastUsage: entry.lastUsage,
      lastUaSN: entry.lastUaSN,
      avgCycleCount: entry.recentCycleCount,
      avgMaxTemp: entry.maxTemp,
      avgRemaining: 0,
    }));
  }, [logEntries]);

  // Get unique battery SNs for filter
  const uniqueBatterySNs = useMemo(() => {
    const sns = new Set(aggregatedBatteries.map(e => e.batterySN));
    return Array.from(sns).sort();
  }, [aggregatedBatteries]);

  const batterySnOptions = useMemo(() => 
    uniqueBatterySNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueBatterySNs]);

  // Prepare chart data from aggregated batteries
  const chartData = useMemo((): BatteryChartEntry[] => {
    return aggregatedBatteries.map(battery => ({
      _id: battery.batterySN,
      batterySN: battery.batterySN,
      flights: logEntries.find(e => e.batterySN === battery.batterySN)?.flights || 0,
      cycleCount: battery.recentCycleCount,
      peakTemperature: battery.avgMaxTemp,
    }));
  }, [aggregatedBatteries, logEntries]);

  // Filter and sort aggregated batteries
  const filteredAndSortedAggregated = useMemo(() => {
    return aggregatedBatteries
      .filter(entry => {
        const matchesSearch = entry.batterySN.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.lastUaSN.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBatterySN = selectedBatterySNs.length === 0 || selectedBatterySNs.includes(entry.batterySN);
        return matchesSearch && matchesBatterySN;
      })
      .sort((a, b) => {
        let aVal: any = a[sortField as keyof AggregatedBatteryEntry];
        let bVal: any = b[sortField as keyof AggregatedBatteryEntry];
        
        const modifier = sortOrder === 'asc' ? 1 : -1;
        
        if (sortField === 'batterySN') {
          const aNum = parseInt(String(aVal));
          const bNum = parseInt(String(bVal));
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return (aNum - bNum) * modifier;
          }
          return String(aVal).localeCompare(String(bVal)) * modifier;
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * modifier;
        }
        
        return (aVal > bVal ? 1 : -1) * modifier;
      });
  }, [aggregatedBatteries, searchQuery, sortField, sortOrder, selectedBatterySNs]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
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

  // Format sheet title
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

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedBatterySNs([]);
    setBatteryDateRange({ start: null, end: null });
    setSearchQuery('');
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
      {/* Filters */}
      <div className="space-y-1">
        <span className="text-xs text-gray-400">Filters:</span>
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
              onClick={clearAllFilters}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
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
      <BatteryOverviewDashboard 
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
        selectedBatterySNs={selectedBatterySNs}
        batteryDateRange={batteryDateRange}
        batteryData={logEntries}
        loading={loading}
      />

      {/* Battery Chart - Always show */}
      <div className="space-y-2">
        <BatteryChart entries={chartData} />
      </div>

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
                  {
                    'S. No': getSheetTitle(),
                    'Battery SN': '',
                    'Cycle Count': '',
                    'Total Flight Time': '',
                    'Last Usage': '',
                    'Last UA SN': '',
                  },
                  {
                    'S. No': '',
                    'Battery SN': '',
                    'Cycle Count': '',
                    'Total Flight Time': '',
                    'Last Usage': '',
                    'Last UA SN': '',
                  },
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
          <div className="relative">
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
                  onClick={() => handleSort('batterySN')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-left"
                >
                  <div className="flex items-center justify-start gap-1">
                    Battery SN
                    {sortField === 'batterySN' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.recentCycleCount && (
                <th 
                  onClick={() => handleSort('recentCycleCount')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Cycle Count
                    {sortField === 'recentCycleCount' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.totalFlightTime && (
                <th 
                  onClick={() => handleSort('totalFlightTime')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Total Flight Time
                    {sortField === 'totalFlightTime' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.lastUsage && (
                <th 
                  onClick={() => handleSort('lastUsage')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Last Usage
                    {sortField === 'lastUsage' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.lastUaSN && (
                <th 
                  onClick={() => handleSort('lastUaSN')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Last UA SN
                    {sortField === 'lastUaSN' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
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



