import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { SNOverviewDashboard } from './SNOverviewDashboard';
import { FlightHoursChart } from './FlightHoursChart';
import { ExcelExport } from '../ExcelExport';
import { MultiSelect } from '../MultiSelect';
import { DateRangePicker } from '../DateRangePicker';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  flight: boolean;
}

interface AggregatedSNEntry {
  sn: string;
  ulogFiles: number;
  totalFlightTime: number; // in seconds
  lastUsage: string;
}

type SortField = 'sn' | 'key' | 'date' | 'flight_time' | 'ulogFiles' | 'totalFlightTime' | 'lastUsage';
type SortOrder = 'asc' | 'desc';

export function SNOverviewTable() {
  const { theme } = useTheme();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => 
    cookieHelpers.getFilterState<string>(COOKIE_KEYS.GENERAL_OVERVIEW_SEARCH) || ''
  );
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.GENERAL_OVERVIEW_SORT);
    return (saved?.key as SortField) || 'date';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.GENERAL_OVERVIEW_SORT);
    return saved?.direction || 'desc';
  });
  const [expandedMetric, setExpandedMetric] = useState<'flightTime' | null>(null);
  const [selectedSNs, setSelectedSNs] = useState<string[]>(() =>
    cookieHelpers.getSelectedItems(COOKIE_KEYS.GENERAL_OVERVIEW_SELECTED_SNS)
  );
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>(() =>
    cookieHelpers.getDateRange(COOKIE_KEYS.GENERAL_OVERVIEW_DATE_RANGE) || { start: null, end: null }
  );
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    cookieHelpers.getVisibleColumns(COOKIE_KEYS.GENERAL_OVERVIEW_VISIBLE_COLUMNS) || {
      key: true,
      sn: true,
      date: true,
      flight_time: true,
    }
  );
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = cookieHelpers.getPaginationState(COOKIE_KEYS.GENERAL_OVERVIEW_PAGINATION);
    return saved?.currentPage || 1;
  });
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = cookieHelpers.getPaginationState(COOKIE_KEYS.GENERAL_OVERVIEW_PAGINATION);
    return saved?.itemsPerPage || 50;
  });
  const [showAllData, setShowAllData] = useState(() =>
    cookieHelpers.getFilterState<boolean>(COOKIE_KEYS.GENERAL_OVERVIEW_SHOW_ALL_DATA) || false
  );
  const { showToast } = useToast();

  // Check if any filters are active OR if "See All Data" is enabled
  const hasActiveFilters = selectedSNs.length > 0 || dateRange.start !== null || dateRange.end !== null || showAllData;

  // Format date range for export filename
  const getExportFilename = () => {
    let filename = 'sn_overview';
    if (hasActiveFilters) {
      const parts = [];
      if (selectedSNs.length > 0) {
        parts.push(`SN_${selectedSNs.join('_')}`);
      }
      if (dateRange.start || dateRange.end) {
        const start = dateRange.start || 'start';
        const end = dateRange.end || 'end';
        parts.push(`${start}_to_${end}`);
      }
      if (parts.length > 0) {
        filename += '_' + parts.join('_');
      }
    }
    return filename;
  };

  // Format date range for sheet title
  const getSheetTitle = () => {
    const today = new Date();
    const reportDate = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    const parts = [`SN Overview - Report Generated: ${reportDate}`];
    
    if (hasActiveFilters) {
      if (selectedSNs.length > 0) {
        parts.push(`SN: ${selectedSNs.join(', ')}`);
      }
      if (dateRange.start || dateRange.end) {
        const start = dateRange.start || 'Start';
        const end = dateRange.end || 'End';
        parts.push(`Date Range: ${start} to ${end}`);
      }
      if (showAllData && selectedSNs.length === 0 && !dateRange.start && !dateRange.end) {
        parts.push('All Data View');
      }
    }
    
    return parts.join(' | ');
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Save state to cookies
  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.GENERAL_OVERVIEW_SEARCH, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    cookieHelpers.setSortState(COOKIE_KEYS.GENERAL_OVERVIEW_SORT, { key: sortField, direction: sortOrder });
  }, [sortField, sortOrder]);

  useEffect(() => {
    cookieHelpers.setSelectedItems(COOKIE_KEYS.GENERAL_OVERVIEW_SELECTED_SNS, selectedSNs);
  }, [selectedSNs]);

  useEffect(() => {
    cookieHelpers.setDateRange(COOKIE_KEYS.GENERAL_OVERVIEW_DATE_RANGE, dateRange);
  }, [dateRange]);

  useEffect(() => {
    cookieHelpers.setVisibleColumns(COOKIE_KEYS.GENERAL_OVERVIEW_VISIBLE_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  useEffect(() => {
    cookieHelpers.setPaginationState(COOKIE_KEYS.GENERAL_OVERVIEW_PAGINATION, { currentPage, itemsPerPage });
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.GENERAL_OVERVIEW_SHOW_ALL_DATA, showAllData);
  }, [showAllData]);

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

  // Get unique SNs for filter
  const uniqueSNs = useMemo(() => {
    const sns = new Set(logEntries.map(e => e.sn));
    return Array.from(sns).sort();
  }, [logEntries]);

  const snOptions = useMemo(() => 
    uniqueSNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueSNs]);

  // Parse date from YYMMDD format to YYYY-MM-DD for comparison
  const parseDateForComparison = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 6) return '';
    
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    
    return `${year}-${month}-${day}`;
  };

  // Filter log entries by SN and date range
  const filteredLogEntries = useMemo(() => {
    return logEntries.filter(entry => {
      // SN filter
      const matchesSN = selectedSNs.length === 0 || selectedSNs.includes(entry.sn);
      
      // Date range filter
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = parseDateForComparison(entry.date);
        if (entryDate) {
          if (dateRange.start && dateRange.end) {
            matchesDate = entryDate >= dateRange.start && entryDate <= dateRange.end;
          } else if (dateRange.start) {
            matchesDate = entryDate >= dateRange.start;
          } else if (dateRange.end) {
            matchesDate = entryDate <= dateRange.end;
          }
        } else {
          matchesDate = false;
        }
      }
      
      return matchesSN && matchesDate;
    });
  }, [logEntries, selectedSNs, dateRange]);

  // Aggregate filtered log entries by SN
  const aggregatedEntries = useMemo((): AggregatedSNEntry[] => {
    const snMap = new Map<string, AggregatedSNEntry>();
    
    filteredLogEntries.forEach(entry => {
      if (snMap.has(entry.sn)) {
        const existing = snMap.get(entry.sn)!;
        const existingDate = parseDateForComparison(existing.lastUsage);
        const entryDate = parseDateForComparison(entry.date);
        
        snMap.set(entry.sn, {
          sn: entry.sn,
          ulogFiles: existing.ulogFiles + 1,
          totalFlightTime: existing.totalFlightTime + entry.flight_time,
          lastUsage: entryDate > existingDate ? entry.date : existing.lastUsage,
        });
      } else {
        snMap.set(entry.sn, {
          sn: entry.sn,
          ulogFiles: 1,
          totalFlightTime: entry.flight_time,
          lastUsage: entry.date,
        });
      }
    });
    
    return Array.from(snMap.values());
  }, [filteredLogEntries]);

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

  // Filter and sort aggregated entries (for no-filter view)
  const filteredAndSortedAggregated = useMemo(() => {
    return aggregatedEntries
      .filter(entry => {
        const matchesSearch = entry.sn.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        let aVal: any;
        let bVal: any;
        
        // Handle aggregated entry fields
        switch (sortField) {
          case 'sn':
            aVal = a.sn;
            bVal = b.sn;
            break;
          case 'ulogFiles':
            aVal = a.ulogFiles;
            bVal = b.ulogFiles;
            break;
          case 'totalFlightTime':
            aVal = a.totalFlightTime;
            bVal = b.totalFlightTime;
            break;
          case 'lastUsage':
            aVal = a.lastUsage;
            bVal = b.lastUsage;
            break;
          default:
            aVal = a.sn;
            bVal = b.sn;
        }
        
        const modifier = sortOrder === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * modifier;
        }
        
        return (aVal > bVal ? 1 : -1) * modifier;
      });
  }, [aggregatedEntries, searchQuery, sortField, sortOrder]);

  // Filter and sort individual log entries (for filtered view)
  const filteredAndSortedDetailed = useMemo(() => {
    return filteredLogEntries
      .filter(entry => {
        const matchesSearch = entry.sn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.key.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        let aVal: any;
        let bVal: any;
        
        // Handle log entry fields
        switch (sortField) {
          case 'sn':
            aVal = a.sn;
            bVal = b.sn;
            break;
          case 'key':
            aVal = a.key;
            bVal = b.key;
            break;
          case 'date':
            aVal = a.date;
            bVal = b.date;
            break;
          case 'flight_time':
            aVal = a.flight_time;
            bVal = b.flight_time;
            break;
          default:
            aVal = a.date;
            bVal = b.date;
        }
        
        const modifier = sortOrder === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * modifier;
        }
        
        return (aVal > bVal ? 1 : -1) * modifier;
      });
  }, [filteredLogEntries, searchQuery, sortField, sortOrder]);

  // Pagination for detailed view
  const totalItems = filteredAndSortedDetailed.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDetailedEntries = filteredAndSortedDetailed.slice(startIndex, endIndex);

  // Calculate summary totals
  const summaryTotals = useMemo(() => {
    if (hasActiveFilters) {
      const uniqueSNs = new Set(filteredAndSortedDetailed.map((e: LogEntry) => e.sn)).size;
      const totalFiles = filteredAndSortedDetailed.length;
      const totalFlightTime = filteredAndSortedDetailed.reduce((sum: number, e: LogEntry) => sum + e.flight_time, 0);
      return { uniqueSNs, totalFiles, totalFlightTime };
    } else {
      const uniqueSNs = filteredAndSortedAggregated.length;
      const totalFiles = filteredAndSortedAggregated.reduce((sum: number, e: AggregatedSNEntry) => sum + e.ulogFiles, 0);
      const totalFlightTime = filteredAndSortedAggregated.reduce((sum: number, e: AggregatedSNEntry) => sum + e.totalFlightTime, 0);
      return { uniqueSNs, totalFiles, totalFlightTime };
    }
  }, [hasActiveFilters, filteredAndSortedDetailed, filteredAndSortedAggregated]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSNs, dateRange, searchQuery]);

  // Handle chart bar click for filtering
  const handleChartBarClick = (date: string, sn: string) => {
    // Parse the date format from chart (DD-MMM-YYYY) to YYYY-MM-DD
    const parseChartDate = (dateStr: string): string => {
      const [day, month, year] = dateStr.split('-');
      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      return `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
    };

    const formattedDate = parseChartDate(date);
    
    // Check if the same bar is clicked (toggle behavior)
    const isSameSN = selectedSNs.length === 1 && selectedSNs[0] === sn;
    const isSameDate = dateRange.start === formattedDate && dateRange.end === formattedDate;
    
    if (isSameSN && isSameDate) {
      // If same bar clicked, clear all filters
      clearAllFilters();
    } else {
      // Apply new filters
      setSelectedSNs([sn]);
      setDateRange({ start: formattedDate, end: formattedDate });
      setShowAllData(true); // Show detailed view when filtering from chart
    }
  };

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedSNs([]);
    setDateRange({ start: null, end: null });
    setShowAllData(false);
    setSearchQuery('');
    setCurrentPage(1);
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
          <div className="w-48">
            <button
              onClick={() => setShowAllData(!showAllData)}
              className={`w-full px-3 py-2 text-xs rounded transition ${
                showAllData 
                  ? theme === 'dark'
                    ? 'bg-[#3EC1C5] text-gray-900 font-semibold' 
                    : 'bg-gray-900 text-white font-semibold'
                  : theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-300'
              }`}
            >
              {showAllData ? 'Hide Details' : 'See All Data'}
            </button>
          </div>
          {(selectedSNs.length > 0 || dateRange.start !== null || showAllData) && (
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

      {/* Dashboard - Always show, updates based on filters */}
      <SNOverviewDashboard 
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
        selectedSNs={selectedSNs}
        dateRange={dateRange}
      />

      {/* Flight Hours Chart - Always show */}
      <div className="space-y-2">
        <FlightHoursChart 
            entries={filteredLogEntries} 
          onBarClick={handleChartBarClick}
          selectedFilters={{
            date: dateRange.start === dateRange.end && dateRange.start ? dateRange.start : undefined,
            sn: selectedSNs.length === 1 ? selectedSNs[0] : undefined,
            dateRange: (dateRange.start || dateRange.end) ? dateRange : undefined
          }}
          onClearFilters={clearAllFilters}
        />
      </div>

      {/* Aggregated Summary Table - Only show when filters are active */}
      {hasActiveFilters && filteredAndSortedAggregated.length > 0 && (
        <div className="space-y-2">
          <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Summary by SN</h3>
          <div className={`w-full overflow-x-auto border rounded-lg ${
            theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
          }`}>
            <table className="w-full text-xs">
              <thead className={`text-xs uppercase ${
                theme === 'dark' 
                  ? 'text-gray-400 bg-gray-700' 
                  : 'text-gray-700 bg-gray-100'
              }`}>
                <tr>
                  <th className="px-3 py-2 w-16 text-center">S. No</th>
                  <th className="px-3 py-2 text-left">SN</th>
                  <th className="px-3 py-2 text-center">ULOG Files</th>
                  <th className="px-3 py-2 text-center">Total Flight Time</th>
                  <th className="px-3 py-2 text-center">Last Usage</th>
                </tr>
              </thead>
              <tbody className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                {filteredAndSortedAggregated.map((entry, idx) => (
                  <tr key={entry.sn} className={`border-b transition ${
                    theme === 'dark' 
                      ? 'border-gray-700 hover:bg-gray-700/50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <td className="px-3 py-2 text-center">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-left">{entry.sn}</td>
                    <td className="px-3 py-2 text-center">{entry.ulogFiles}</td>
                    <td className="px-3 py-2 text-center font-mono">{formatTime(entry.totalFlightTime)}</td>
                    <td className="px-3 py-2 text-center">{formatDate(entry.lastUsage)}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className={`border-t-2 font-semibold ${
                  theme === 'dark' 
                    ? 'border-[#3EC1C5] bg-gray-700/50 text-[#3EC1C5]' 
                    : 'border-gray-900 bg-gray-100 text-gray-900'
                }`}>
                  <td className="px-3 py-2 text-center">-</td>
                  <td className="px-3 py-2 text-left">TOTAL</td>
                  <td className="px-3 py-2 text-center">{summaryTotals.totalFiles}</td>
                  <td className="px-3 py-2 text-center font-mono">{formatTime(summaryTotals.totalFlightTime)}</td>
                  <td className="px-3 py-2 text-center">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex justify-end items-center gap-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SN..."
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
                theme === 'dark' 
                  ? 'text-gray-400 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
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
          sheets={hasActiveFilters 
            ? [
                {
                  name: 'Dashboard Cards',
                  data: [
                    {
                      'Report Info': getSheetTitle(),
                      'Value': '',
                    },
                    {
                      'Report Info': '',
                      'Value': '',
                    },
                    {
                      'Report Info': 'Total Copters',
                      'Value': summaryTotals.uniqueSNs,
                    },
                    {
                      'Report Info': 'Total Flight Time',
                      'Value': formatTime(summaryTotals.totalFlightTime),
                    },
                    {
                      'Report Info': 'ULOG Files',
                      'Value': summaryTotals.totalFiles,
                    },
                  ],
                  columns: [
                    { key: 'Report Info', label: 'Metric' },
                    { key: 'Value', label: 'Value' },
                  ]
                },
                {
                  name: 'Chart Data',
                  data: (() => {
                    // Process chart data for export
                    const parseDate = (dateStr: string): Date => {
                      if (!dateStr || dateStr.length !== 6) return new Date();
                      const year = '20' + dateStr.substring(0, 2);
                      const month = dateStr.substring(2, 4);
                      const day = dateStr.substring(4, 6);
                      return new Date(`${year}-${month}-${day}`);
                    };

                    const grouped = new Map<string, { date: Date; dateStr: string; data: Map<string, number> }>();
                    
                    filteredLogEntries.forEach(entry => {
                      const date = parseDate(entry.date);
                      const dateStr = `${String(date.getDate()).padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;
                      const totalHours = entry.flight_time / 3600;
                      
                      if (!grouped.has(dateStr)) {
                        grouped.set(dateStr, { date, dateStr, data: new Map() });
                      }
                      
                      const entry_data = grouped.get(dateStr)!;
                      const currentHours = entry_data.data.get(entry.sn) || 0;
                      entry_data.data.set(entry.sn, currentHours + totalHours);
                    });

                    const uniqueSNs = Array.from(new Set(filteredLogEntries.map(e => e.sn)));
                    const sortedEntries = Array.from(grouped.values())
                      .sort((a, b) => a.date.getTime() - b.date.getTime());

                    return [
                      {
                        'Date': getSheetTitle(),
                        ...uniqueSNs.reduce((acc, sn) => ({ ...acc, [sn]: '' }), {}),
                      },
                      {
                        'Date': '',
                        ...uniqueSNs.reduce((acc, sn) => ({ ...acc, [sn]: '' }), {}),
                      },
                      ...sortedEntries.map(entry => {
                        const dataPoint: any = { 'Date': entry.dateStr };
                        uniqueSNs.forEach(sn => {
                          dataPoint[sn] = Number((entry.data.get(sn) || 0).toFixed(2)) + 'h';
                        });
                        return dataPoint;
                      })
                    ];
                  })(),
                  columns: [
                    { key: 'Date', label: 'Date' },
                    ...Array.from(new Set(filteredLogEntries.map(e => e.sn))).map(sn => ({
                      key: sn,
                      label: `${sn} (Hours)`
                    }))
                  ]
                },
                {
                  name: 'Summary by SN',
                  data: [
                    // Add header row with filter info
                    {
                      'S. No': getSheetTitle(),
                      'SN': '',
                      'ULOG Files': '',
                      'Total Flight Time': '',
                      'Last Usage': '',
                    },
                    {
                      'S. No': '',
                      'SN': '',
                      'ULOG Files': '',
                      'Total Flight Time': '',
                      'Last Usage': '',
                    },
                    ...filteredAndSortedAggregated.map((entry, idx) => ({
                      'S. No': idx + 1,
                      'SN': entry.sn,
                      'ULOG Files': entry.ulogFiles,
                      'Total Flight Time': formatTime(entry.totalFlightTime),
                      'Last Usage': formatDate(entry.lastUsage),
                    })),
                    // Add totals row
                    {
                      'S. No': '',
                      'SN': '',
                      'ULOG Files': '',
                      'Total Flight Time': '',
                      'Last Usage': '',
                    },
                    {
                      'S. No': '-',
                      'SN': 'TOTAL',
                      'ULOG Files': summaryTotals.totalFiles,
                      'Total Flight Time': formatTime(summaryTotals.totalFlightTime),
                      'Last Usage': '-',
                    }
                  ],
                  columns: [
                    { key: 'S. No', label: 'S. No' },
                    { key: 'SN', label: 'SN' },
                    { key: 'ULOG Files', label: 'ULOG Files' },
                    { key: 'Total Flight Time', label: 'Total Flight Time' },
                    { key: 'Last Usage', label: 'Last Usage' },
                  ]
                },
                {
                  name: 'Detailed Entries',
                  data: [
                    // Add header row with filter info
                    {
                      'S. No': getSheetTitle(),
                      'Key (.ulg)': '',
                      'SN': '',
                      'Date': '',
                      'Flight Time': '',
                    },
                    {
                      'S. No': '',
                      'Key (.ulg)': '',
                      'SN': '',
                      'Date': '',
                      'Flight Time': '',
                    },
                    ...filteredAndSortedDetailed.map((entry, idx) => ({
                      'S. No': idx + 1,
                      'Key (.ulg)': entry.key,
                      'SN': entry.sn,
                      'Date': formatDate(entry.date),
                      'Flight Time': formatTime(entry.flight_time),
                    }))
                  ],
                  columns: [
                    { key: 'S. No', label: 'S. No' },
                    { key: 'Key (.ulg)', label: 'Key (.ulg)' },
                    { key: 'SN', label: 'SN' },
                    { key: 'Date', label: 'Date' },
                    { key: 'Flight Time', label: 'Flight Time' },
                  ]
                }
              ]
            : [
                {
                  name: 'Dashboard Cards',
                  data: [
                    {
                      'Metric': 'Total Copters',
                      'Value': summaryTotals.uniqueSNs,
                    },
                    {
                      'Metric': 'Total Flight Time',
                      'Value': formatTime(summaryTotals.totalFlightTime),
                    },
                    {
                      'Metric': 'ULOG Files',
                      'Value': summaryTotals.totalFiles,
                    },
                  ],
                  columns: [
                    { key: 'Metric', label: 'Metric' },
                    { key: 'Value', label: 'Value' },
                  ]
                },
                {
                  name: 'Chart Data',
                  data: (() => {
                    // Process chart data for export (no filters)
                    const parseDate = (dateStr: string): Date => {
                      if (!dateStr || dateStr.length !== 6) return new Date();
                      const year = '20' + dateStr.substring(0, 2);
                      const month = dateStr.substring(2, 4);
                      const day = dateStr.substring(4, 6);
                      return new Date(`${year}-${month}-${day}`);
                    };

                    const grouped = new Map<string, { date: Date; dateStr: string; data: Map<string, number> }>();
                    
                    filteredLogEntries.forEach(entry => {
                      const date = parseDate(entry.date);
                      const dateStr = `${String(date.getDate()).padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;
                      const totalHours = entry.flight_time / 3600;
                      
                      if (!grouped.has(dateStr)) {
                        grouped.set(dateStr, { date, dateStr, data: new Map() });
                      }
                      
                      const entry_data = grouped.get(dateStr)!;
                      const currentHours = entry_data.data.get(entry.sn) || 0;
                      entry_data.data.set(entry.sn, currentHours + totalHours);
                    });

                    const uniqueSNs = Array.from(new Set(filteredLogEntries.map(e => e.sn)));
                    const sortedEntries = Array.from(grouped.values())
                      .sort((a, b) => a.date.getTime() - b.date.getTime());

                    return sortedEntries.map(entry => {
                      const dataPoint: any = { 'Date': entry.dateStr };
                      uniqueSNs.forEach(sn => {
                        dataPoint[sn] = Number((entry.data.get(sn) || 0).toFixed(2)) + 'h';
                      });
                      return dataPoint;
                    });
                  })(),
                  columns: [
                    { key: 'Date', label: 'Date' },
                    ...Array.from(new Set(filteredLogEntries.map(e => e.sn))).map(sn => ({
                      key: sn,
                      label: `${sn} (Hours)`
                    }))
                  ]
                },
                {
                  name: 'SN Overview',
                  data: [
                    ...filteredAndSortedAggregated.map((entry, idx) => ({
                      'S. No': idx + 1,
                      'SN': entry.sn,
                      'ULOG Files': entry.ulogFiles,
                      'Total Flight Time': formatTime(entry.totalFlightTime),
                      'Last Usage': formatDate(entry.lastUsage),
                    })),
                    // Add totals row
                    {
                      'S. No': '',
                      'SN': '',
                      'ULOG Files': '',
                      'Total Flight Time': '',
                      'Last Usage': '',
                    },
                    {
                      'S. No': '-',
                      'SN': 'TOTAL',
                      'ULOG Files': summaryTotals.totalFiles,
                      'Total Flight Time': formatTime(summaryTotals.totalFlightTime),
                      'Last Usage': '-',
                    }
                  ],
                  columns: [
                    { key: 'S. No', label: 'S. No' },
                    { key: 'SN', label: 'SN' },
                    { key: 'ULOG Files', label: 'ULOG Files' },
                    { key: 'Total Flight Time', label: 'Total Flight Time' },
                    { key: 'Last Usage', label: 'Last Usage' },
                  ]
                }
              ]
          }
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
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}>
              <h4 className={`text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Columns</h4>
              <div className="space-y-1">
                {Object.entries(visibleColumns).map(([key, value]) => {
                  const label = key === 'key' ? 'Key (.ulg)' :
                               key === 'sn' ? 'SN' :
                               key === 'date' ? 'Date' :
                               key === 'flight_time' ? 'Flight Time' :
                               key.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${
                      theme === 'dark' 
                        ? 'text-gray-300 hover:text-white' 
                        : 'text-gray-700 hover:text-gray-900'
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

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs">
          <thead className={`text-xs uppercase sticky top-0 ${
            theme === 'dark' 
              ? 'text-gray-400 bg-gray-700' 
              : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16 text-center">S. No</th>
              {hasActiveFilters ? (
                <>
                  {visibleColumns.key && (
                    <th 
                      onClick={() => handleSort('key')}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-left"
                    >
                      <div className="flex items-center justify-start gap-1">
                        Key (.ulg)
                        {sortField === 'key' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.sn && (
                    <th 
                      onClick={() => handleSort('sn')}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        SN
                        {sortField === 'sn' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.date && (
                    <th 
                      onClick={() => handleSort('date')}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Date
                        {sortField === 'date' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )}
                  {visibleColumns.flight_time && (
                    <th 
                      onClick={() => handleSort('flight_time')}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Flight Time
                        {sortField === 'flight_time' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  )}
                </>
              ) : (
                <>
                  <th 
                    onClick={() => handleSort('sn')}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-left"
                  >
                    <div className="flex items-center justify-start gap-1">
                      SN
                      {sortField === 'sn' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('ulogFiles')}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      ULOG Files
                      {sortField === 'ulogFiles' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
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
                </>
              )}
            </tr>
          </thead>
          <tbody className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
            {hasActiveFilters ? (
              // Detailed view with pagination
              paginatedDetailedEntries.length > 0 ? (
                paginatedDetailedEntries.map((entry, idx) => (
                  <tr key={entry._id} className={`border-b transition ${
                    theme === 'dark' 
                      ? 'border-gray-700 hover:bg-gray-700/50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <td className="px-3 py-2 text-center">{startIndex + idx + 1}</td>
                    {visibleColumns.key && <td className="px-3 py-2 font-mono text-left text-xs">{entry.key}</td>}
                    {visibleColumns.sn && <td className="px-3 py-2 font-medium text-center">{entry.sn}</td>}
                    {visibleColumns.date && <td className="px-3 py-2 text-center">{formatDate(entry.date)}</td>}
                    {visibleColumns.flight_time && <td className="px-3 py-2 text-center font-mono">{formatTime(entry.flight_time)}</td>}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length + 1} className={`px-3 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    No entries found
                  </td>
                </tr>
              )
            ) : (
              // Aggregated view (no filters)
              filteredAndSortedAggregated.length > 0 ? (
                <>
                  {filteredAndSortedAggregated.map((entry, idx) => (
                    <tr key={entry.sn} className={`border-b transition ${
                      theme === 'dark' 
                        ? 'border-gray-700 hover:bg-gray-700/50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                      <td className="px-3 py-2 text-center">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-left">{entry.sn}</td>
                      <td className="px-3 py-2 text-center">{entry.ulogFiles}</td>
                      <td className="px-3 py-2 text-center font-mono">{formatTime(entry.totalFlightTime)}</td>
                      <td className="px-3 py-2 text-center">{formatDate(entry.lastUsage)}</td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className={`border-t-2 font-semibold ${
                    theme === 'dark' 
                      ? 'border-[#3EC1C5] bg-gray-700/50 text-[#3EC1C5]' 
                      : 'border-gray-900 bg-gray-100 text-gray-900'
                  }`}>
                    <td className="px-3 py-2 text-center">-</td>
                    <td className="px-3 py-2 text-left">TOTAL</td>
                    <td className="px-3 py-2 text-center">{summaryTotals.totalFiles}</td>
                    <td className="px-3 py-2 text-center font-mono">{formatTime(summaryTotals.totalFlightTime)}</td>
                    <td className="px-3 py-2 text-center">-</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    No entries found
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - Only show when filters are active */}
      {hasActiveFilters && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-xs focus:outline-none ${
                theme === 'dark'
                  ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5]'
                  : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900'
              }`}
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 py-1 text-xs rounded transition ${
                      currentPage === pageNum
                        ? theme === 'dark'
                          ? 'bg-[#3EC1C5] text-gray-900 font-semibold'
                          : 'bg-gray-900 text-white font-semibold'
                        : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-400 text-right">
        {hasActiveFilters 
          ? `Showing ${paginatedDetailedEntries.length} of ${totalItems} log files from ${summaryTotals.uniqueSNs} copters`
          : `Showing ${filteredAndSortedAggregated.length} copters with ${summaryTotals.totalFiles} total log files`
        }
      </div>
    </div>
  );
}


