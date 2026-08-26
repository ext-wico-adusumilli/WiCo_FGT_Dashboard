import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { FCVersionDashboard } from './FCVersionDashboard';
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
  fc_version: string;
}

interface AggregatedFCVersionEntry {
  fcVersion: string;
  totalFlightTime: number; // in seconds
  oldestLogDate: string;
  newestLogDate: string;
  newestSN: string;
  newestLogFile: string; // the key in the db
}

interface FCVersionTableProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

export function FCVersionTable({ 
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: FCVersionTableProps) {
  const { theme } = useTheme();
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [summarySortField, setSummarySortField] = useState<'fcVersion' | 'totalFlightTime' | 'oldestLogDate' | 'newestLogDate' | 'newestSN'>('newestSN');
  const [summarySortOrder, setSummarySortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedFCVersions, setSelectedFCVersions] = useState<string[]>([]);
  const [fcVersionDateRange, setFCVersionDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [visibleColumns, setVisibleColumns] = useState({
    newestSN: true,
    fcVersion: true,
    totalFlightTime: true,
    oldestLogDate: true,
    newestLogDate: true,
    newestLogFile: true,
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
    const activeDateRange = dateRange.start || dateRange.end ? dateRange : fcVersionDateRange;
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
  }, [logEntries, selectedSNs, dateRange, fcVersionDateRange]);

  // Aggregate FC version data directly from filtered log entries
  const aggregatedFCVersions = useMemo((): AggregatedFCVersionEntry[] => {
    const fcVersionMap = new Map<string, AggregatedFCVersionEntry>();
    
    filteredLogEntries.forEach(entry => {
      // Only process entries with valid FC version
      if (entry.fc_version && entry.fc_version.trim() !== '') {
        const fcVersion = entry.fc_version;
        if (fcVersionMap.has(fcVersion)) {
          const existing = fcVersionMap.get(fcVersion)!;
          const existingNewestDate = parseDateForComparison(existing.newestLogDate);
          const existingOldestDate = parseDateForComparison(existing.oldestLogDate);
          const entryDate = parseDateForComparison(entry.date);
          
          fcVersionMap.set(fcVersion, {
            fcVersion,
            totalFlightTime: existing.totalFlightTime + entry.flight_time,
            oldestLogDate: entryDate < existingOldestDate ? entry.date : existing.oldestLogDate,
            newestLogDate: entryDate > existingNewestDate ? entry.date : existing.newestLogDate,
            newestSN: entryDate > existingNewestDate ? entry.sn : existing.newestSN,
            newestLogFile: entryDate > existingNewestDate ? entry.key : existing.newestLogFile,
          });
        } else {
          fcVersionMap.set(fcVersion, {
            fcVersion,
            totalFlightTime: entry.flight_time,
            oldestLogDate: entry.date,
            newestLogDate: entry.date,
            newestSN: entry.sn,
            newestLogFile: entry.key,
          });
        }
      }
    });
    
    return Array.from(fcVersionMap.values());
  }, [filteredLogEntries]);

  // Get unique FC versions for filter
  const uniqueFCVersions = useMemo(() => {
    const versions = new Set(aggregatedFCVersions.map(e => e.fcVersion));
    return Array.from(versions).sort();
  }, [aggregatedFCVersions]);

  const fcVersionOptions = useMemo(() => 
    uniqueFCVersions.map(version => ({ value: version, label: version }))
  , [uniqueFCVersions]);

  // Filter and sort aggregated FC versions for the summary table
  const filteredAndSortedAggregated = useMemo(() => {
    return aggregatedFCVersions
      .filter(entry => {
        const matchesSearch = entry.fcVersion.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.newestSN.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.newestLogFile.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFCVersion = selectedFCVersions.length === 0 || selectedFCVersions.includes(entry.fcVersion);
        return matchesSearch && matchesFCVersion;
      })
      .sort((a, b) => {
        let aVal: any = a[summarySortField as keyof AggregatedFCVersionEntry];
        let bVal: any = b[summarySortField as keyof AggregatedFCVersionEntry];
        
        const modifier = summarySortOrder === 'asc' ? 1 : -1;
        
        // Special handling for date fields
        if (summarySortField === 'oldestLogDate' || summarySortField === 'newestLogDate') {
          const aDate = parseDateForComparison(String(aVal));
          const bDate = parseDateForComparison(String(bVal));
          return aDate.localeCompare(bDate) * modifier;
        }
        
        // Special handling for Newest SN - treat as numeric if possible
        if (summarySortField === 'newestSN') {
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
  }, [aggregatedFCVersions, searchQuery, summarySortField, summarySortOrder, selectedFCVersions]);

  const handleSummarySort = (field: 'fcVersion' | 'totalFlightTime' | 'oldestLogDate' | 'newestLogDate' | 'newestSN') => {
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
    let filename = 'fc_version_overview';
    const parts = [];
    if (selectedFCVersions.length > 0) {
      parts.push(`FC_${selectedFCVersions.join('_')}`);
    }
    if (fcVersionDateRange.start || fcVersionDateRange.end) {
      const start = fcVersionDateRange.start || 'start';
      const end = fcVersionDateRange.end || 'end';
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
    
    const parts = [`FC Version Overview - Report Generated: ${reportDate}`];
    
    if (selectedFCVersions.length > 0) {
      parts.push(`FC Version: ${selectedFCVersions.join(', ')}`);
    }
    if (fcVersionDateRange.start || fcVersionDateRange.end) {
      const start = fcVersionDateRange.start || 'Start';
      const end = fcVersionDateRange.end || 'End';
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
                value={selectedFCVersions}
                onChange={setSelectedFCVersions}
                options={fcVersionOptions}
                placeholder="All FC Versions"
              />
            </div>
            <div className="w-48">
              <DateRangePicker
                key={`${fcVersionDateRange.start}-${fcVersionDateRange.end}`}
                onApply={(start, end) => setFCVersionDateRange({ start, end })}
                onCancel={() => {}}
                initialStart={fcVersionDateRange.start}
                initialEnd={fcVersionDateRange.end}
              />
            </div>
            {(selectedFCVersions.length > 0 || fcVersionDateRange.start !== null) && (
              <button
                onClick={() => {
                  setSelectedFCVersions([]);
                  setFCVersionDateRange({ start: null, end: null });
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
      <FCVersionDashboard 
        selectedSNs={selectedSNs}
        dateRange={dateRange}
        selectedFCVersions={selectedFCVersions}
        fcVersionDateRange={fcVersionDateRange}
      />

      {/* Search and Actions */}
      <div className="flex justify-between items-center gap-2">
        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Summary by FC Version</h3>
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
              placeholder="Search FC Version..."
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
                name: 'FC Version Overview',
                data: [
                  // Add title row at the top
                  {
                    'S. No': getSheetTitle(),
                    'Newest SN': '',
                    'FC Version': '',
                    'Total Flight Time': '',
                    'Oldest Log Date': '',
                    'Newest Log Date': '',
                    'Newest Log File': '',
                  },
                  // Add empty row for spacing
                  {
                    'S. No': '',
                    'Newest SN': '',
                    'FC Version': '',
                    'Total Flight Time': '',
                    'Oldest Log Date': '',
                    'Newest Log Date': '',
                    'Newest Log File': '',
                  },
                  // Add actual data
                  ...filteredAndSortedAggregated.map((entry, idx) => ({
                    'S. No': idx + 1,
                    'Newest SN': entry.newestSN,
                    'FC Version': entry.fcVersion,
                    'Total Flight Time': formatTime(entry.totalFlightTime),
                    'Oldest Log Date': formatDate(entry.oldestLogDate),
                    'Newest Log Date': formatDate(entry.newestLogDate),
                    'Newest Log File': entry.newestLogFile,
                  }))
                ],
                columns: [
                  { key: 'S. No', label: 'S. No' },
                  { key: 'Newest SN', label: 'Newest SN' },
                  { key: 'FC Version', label: 'FC Version' },
                  { key: 'Total Flight Time', label: 'Total Flight Time' },
                  { key: 'Oldest Log Date', label: 'Oldest Log Date' },
                  { key: 'Newest Log Date', label: 'Newest Log Date' },
                  { key: 'Newest Log File', label: 'Newest Log File' },
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
                    const label = key === 'newestSN' ? 'Newest SN' :
                                 key === 'fcVersion' ? 'FC Version' :
                                 key === 'totalFlightTime' ? 'Total Flight Time' :
                                 key === 'oldestLogDate' ? 'Oldest Log Date' :
                                 key === 'newestLogDate' ? 'Newest Log Date' :
                                 key === 'newestLogFile' ? 'Newest Log File' :
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
              {visibleColumns.newestSN && (
                <th 
                  onClick={() => handleSummarySort('newestSN')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Newest SN
                    {summarySortField === 'newestSN' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.fcVersion && (
                <th 
                  onClick={() => handleSummarySort('fcVersion')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-left"
                >
                  <div className="flex items-center justify-start gap-1">
                    FC Version
                    {summarySortField === 'fcVersion' && (
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
              {visibleColumns.oldestLogDate && (
                <th 
                  onClick={() => handleSummarySort('oldestLogDate')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Oldest Log Date
                    {summarySortField === 'oldestLogDate' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.newestLogDate && (
                <th 
                  onClick={() => handleSummarySort('newestLogDate')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    Newest Log Date
                    {summarySortField === 'newestLogDate' && (
                      <span>{summarySortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.newestLogFile && (
                <th className="px-3 py-2 text-center">
                  Newest Log File
                </th>
              )}
            </tr>
          </thead>
          <tbody className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
            {filteredAndSortedAggregated.length > 0 ? (
              filteredAndSortedAggregated.map((entry, idx) => (
                <tr key={entry.fcVersion} className={`border-b transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className="px-3 py-2 text-center">{idx + 1}</td>
                  {visibleColumns.newestSN && <td className="px-3 py-2 text-center font-medium">{entry.newestSN}</td>}
                  {visibleColumns.fcVersion && <td className="px-3 py-2 font-medium text-left">{entry.fcVersion}</td>}
                  {visibleColumns.totalFlightTime && <td className="px-3 py-2 text-center font-mono">{formatTime(entry.totalFlightTime)}</td>}
                  {visibleColumns.oldestLogDate && <td className="px-3 py-2 text-center">{formatDate(entry.oldestLogDate)}</td>}
                  {visibleColumns.newestLogDate && <td className="px-3 py-2 text-center">{formatDate(entry.newestLogDate)}</td>}
                  {visibleColumns.newestLogFile && <td className="px-3 py-2 text-center font-mono text-xs">{entry.newestLogFile}</td>}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length + 1} className={`px-3 py-8 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  No FC versions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className={`text-xs text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Showing {filteredAndSortedAggregated.length} unique FC versions
      </div>
    </div>
  );
}


