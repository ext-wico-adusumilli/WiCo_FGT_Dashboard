import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, X, Columns3 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { FCVersionDashboardOptimized } from './FCVersionDashboardOptimized';
import { ExcelExport } from '../ExcelExport';
import { cookies } from '../../utils/cookies';
import { DateRangePicker } from '../DateRangePicker';

interface AggregatedFCVersionEntry {
  fcVersion: string;
  totalFlightTime: number;
  oldestLogDate: string;
  newestLogDate: string;
  newestSN: string;
  newestLogFile: string;
}

interface FCVersionTableOptimizedProps {
  dateRange?: { start: string | null; end: string | null };
  onDateRangeChange?: (start: string | null, end: string | null) => void;
}

const COOKIE_KEYS = {
  SEARCH: 'FC_VERSION_SEARCH',
  SORT_FIELD: 'FC_VERSION_SORT_FIELD',
  SORT_ORDER: 'FC_VERSION_SORT_ORDER',
  VISIBLE_COLUMNS: 'FC_VERSION_VISIBLE_COLUMNS'
};

export function FCVersionTableOptimized({ 
  dateRange = { start: null, end: null },
  onDateRangeChange
}: FCVersionTableOptimizedProps) {
  const { theme } = useTheme();
  const [aggregatedData, setAggregatedData] = useState<AggregatedFCVersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(cookies.get(COOKIE_KEYS.SEARCH) || '');
  const [summarySortField, setSummarySortField] = useState<keyof AggregatedFCVersionEntry>(
    (cookies.get(COOKIE_KEYS.SORT_FIELD) as keyof AggregatedFCVersionEntry) || 'newestSN'
  );
  const [summarySortOrder, setSummarySortOrder] = useState<'asc' | 'desc'>(
    (cookies.get(COOKIE_KEYS.SORT_ORDER) as 'asc' | 'desc') || 'asc'
  );
  
  const defaultVisibleColumns = {
    newestSN: true,
    fcVersion: true,
    totalFlightTime: true,
    oldestLogDate: true,
    newestLogDate: true,
    newestLogFile: true,
  };
  
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = cookies.get(COOKIE_KEYS.VISIBLE_COLUMNS);
    return saved ? JSON.parse(saved) : defaultVisibleColumns;
  });
  
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAggregatedData();
  }, [dateRange]);

  useEffect(() => {
    cookies.set(COOKIE_KEYS.SEARCH, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    cookies.set(COOKIE_KEYS.SORT_FIELD, summarySortField);
  }, [summarySortField]);

  useEffect(() => {
    cookies.set(COOKIE_KEYS.SORT_ORDER, summarySortOrder);
  }, [summarySortOrder]);

  useEffect(() => {
    cookies.set(COOKIE_KEYS.VISIBLE_COLUMNS, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

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

  const fetchAggregatedData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const response = await fetch(
        `${API_BASE_URL}/general-overview/fc-version?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAggregatedData(data);
      } else {
        showToast('Failed to fetch FC version data', 'error');
      }
    } catch (error) {
      console.error('Error fetching FC version data:', error);
      showToast('Error fetching FC version data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const parseDateForComparison = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 6) return '';
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    return `${year}-${month}-${day}`;
  };

  const filteredAndSortedAggregated = useMemo(() => {
    return aggregatedData
      .filter(entry => {
        const matchesSearch = entry.fcVersion.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.newestSN.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            entry.newestLogFile.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        let aVal: any = a[summarySortField];
        let bVal: any = b[summarySortField];
        
        const modifier = summarySortOrder === 'asc' ? 1 : -1;
        
        if (summarySortField === 'oldestLogDate' || summarySortField === 'newestLogDate') {
          const aDate = parseDateForComparison(String(aVal));
          const bDate = parseDateForComparison(String(bVal));
          return aDate.localeCompare(bDate) * modifier;
        }
        
        if (summarySortField === 'newestSN') {
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
  }, [aggregatedData, searchQuery, summarySortField, summarySortOrder]);

  const handleSummarySort = (field: keyof AggregatedFCVersionEntry) => {
    if (summarySortField === field) {
      setSummarySortOrder(summarySortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSummarySortField(field);
      setSummarySortOrder('asc');
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev: typeof visibleColumns) => ({ ...prev, [column]: !prev[column] }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

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

  const getExportFilename = () => {
    let filename = 'fc_version_overview';
    if (dateRange.start || dateRange.end) {
      const start = dateRange.start || 'start';
      const end = dateRange.end || 'end';
      filename += `_${start}_to_${end}`;
    }
    return filename;
  };

  const getSheetTitle = () => {
    const today = new Date();
    const reportDate = today.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
    
    const parts = [`FC Version Overview - Report Generated: ${reportDate}`];
    
    if (dateRange.start || dateRange.end) {
      const start = dateRange.start || 'Start';
      const end = dateRange.end || 'End';
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
      {/* Filters Section */}
      <div className="space-y-2">
        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Filters:</span>
        <div className="flex flex-wrap items-start gap-2">
          <div className="w-48">
            <DateRangePicker
              onApply={(start, end) => {
                if (onDateRangeChange) {
                  onDateRangeChange(start, end);
                }
              }}
              initialStart={dateRange.start}
              initialEnd={dateRange.end}
            />
          </div>
          {(dateRange.start !== null || dateRange.end !== null) && (
            <button
              onClick={() => {
                if (onDateRangeChange) {
                  onDateRangeChange(null, null);
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
                theme === 'dark'
                  ? 'text-gray-400 hover:text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <FCVersionDashboardOptimized dateRange={dateRange} />

      <div className="flex justify-between items-center gap-2">
        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Summary by FC Version</h3>
        <div className="flex items-center gap-2">
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

          <ExcelExport
            data={[]}
            filename={getExportFilename()}
            sheets={[
              {
                name: 'FC Version Overview',
                data: [
                  {
                    'S. No': getSheetTitle(),
                    'Newest SN': '',
                    'FC Version': '',
                    'Total Flight Time': '',
                    'Oldest Log Date': '',
                    'Newest Log Date': '',
                    'Newest Log File': '',
                  },
                  {
                    'S. No': '',
                    'Newest SN': '',
                    'FC Version': '',
                    'Total Flight Time': '',
                    'Oldest Log Date': '',
                    'Newest Log Date': '',
                    'Newest Log File': '',
                  },
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
                          checked={value as boolean}
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

      <div className={`text-xs text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
        Showing {filteredAndSortedAggregated.length} unique FC versions
      </div>
    </div>
  );
}


