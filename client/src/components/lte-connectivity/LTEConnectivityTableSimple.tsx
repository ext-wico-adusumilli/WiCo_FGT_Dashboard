import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, Columns3, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ExcelExport } from '../ExcelExport';
import { CustomSelect } from '../CustomSelect';

interface LTEAnalysisData {
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
  lte_loss: number;
  rth_loss: number;
  rth_logs: number;
}

type SortField = keyof LTEAnalysisData;
type SortOrder = 'asc' | 'desc';

interface LTEConnectivityTableSimpleProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  connectivityFilter?: { type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null;
  onClearConnectivityFilter?: () => void;
}

export function LTEConnectivityTableSimple({ 
  selectedSNs = [],
  dateRange = { start: null, end: null },
  connectivityFilter = null,
  onClearConnectivityFilter
}: LTEConnectivityTableSimpleProps) {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<LTEAnalysisData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200);
  const [totalItems, setTotalItems] = useState(0);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    key: true,
    sn: true,
    date: true,
    flight_time: true,
    distance: true,
    lte_loss: true,
    rth_loss: true,
    rth_logs: true,
    flight: true,
  });

  // Fetch data when filters, pagination, or sorting changes
  useEffect(() => {
    fetchEntries();
  }, [selectedSNs, dateRange, currentPage, itemsPerPage, sortField, sortOrder]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      params.append('sortField', sortField);
      params.append('sortOrder', sortOrder);
      
      if (selectedSNs.length > 0) {
        params.append('sn', selectedSNs.join(','));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      
      const response = await fetch(`${API_BASE_URL}/lte-analysis/paginated?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setEntries(result.data);
        setTotalItems(result.pagination.total);
      } else {
        console.error('Failed to fetch LTE data');
      }
    } catch (error) {
      console.error('Error fetching LTE data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format date from YYMMDD to DD MMM YYYY
  const formatDate = (dateStr: string): string => {
    try {
      if (dateStr.length === 6) {
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        const date = new Date(`${year}-${month}-${day}`);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${monthNames[date.getMonth()]} ${year}`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return 'Unknown';
  };

  // Convert seconds to HH:MM:SS
  const formatFlightTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Convert meters to kilometers
  const formatDistance = (meters: number): string => {
    if (typeof meters !== 'number' || isNaN(meters)) return '0.00';
    return (meters / 1000).toFixed(2);
  };

  // Client-side filtering for search and connectivity filter only
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesConnectivity = !connectivityFilter || connectivityFilter.matchingKeys.includes(entry.key);
      const matchesSearch = !searchQuery || 
        entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.sn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesConnectivity && matchesSearch;
    });
  }, [entries, connectivityFilter, searchQuery]);

  // No need to sort - already sorted by server
  const sortedEntries = filteredEntries;

  // Pagination is handled by server, so we display all returned entries
  const paginatedEntries = sortedEntries;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + paginatedEntries.length, totalItems);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-8 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          <div className="animate-pulse">Loading LTE connectivity data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Actions */}
      <div className="flex justify-between items-center gap-2 mb-3">
        {connectivityFilter && (
          <div className={`flex items-center gap-2 px-3 py-1.5 border border-[#3EC1C5] rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <span className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
              <span className="text-[#3EC1C5] font-medium">LTE Analysis</span> - <span className="capitalize">{connectivityFilter.type === 'lteLoss' ? 'LTE Loss' : connectivityFilter.type === 'rthLoss' ? 'RTH Loss' : 'Connectivity'}</span> = {connectivityFilter.label}
            </span>
            {onClearConnectivityFilter && (
              <button onClick={onClearConnectivityFilter} className={`transition ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`} title="Clear filter">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        {!connectivityFilter && <div></div>}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search..."
              className={`pl-7 pr-7 py-1.5 h-[30px] border rounded transition text-xs w-40 focus:outline-none ${
                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
              }`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <ExcelExport data={sortedEntries} filename="lte_connectivity_analysis" />

          <div className="relative">
            <button onClick={() => setShowColumnToggle(!showColumnToggle)} className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>
              <Columns3 className="w-3 h-3" />
              <span className="text-xs">Columns</span>
            </button>
            {showColumnToggle && (
              <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg p-2 z-50 max-h-64 overflow-y-auto border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                <h4 className={`text-xs font-semibold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Columns</h4>
                <div className="space-y-1">
                  {Object.entries(visibleColumns).map(([key, value]) => (
                    <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}>
                      <input type="checkbox" checked={value} onChange={() => toggleColumn(key as keyof typeof visibleColumns)} className={`rounded w-3 h-3 ${theme === 'dark' ? 'border-gray-600 text-[#3EC1C5] focus:ring-[#3EC1C5]' : 'border-gray-300 text-gray-900 focus:ring-gray-900'}`} />
                      <span className="text-xs">{key === 'key' ? 'Key (.ulg)' : key === 'date' ? 'Date' : key === 'flight_time' ? 'Flight Time (HH:MM:SS)' : key === 'distance' ? 'Distance (km)' : key.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${theme === 'dark' ? 'text-gray-400 bg-gray-700' : 'text-gray-700 bg-gray-100'}`}>
            <tr>
              <th className="px-3 py-2 w-16">S. No</th>
              {Object.keys(visibleColumns).map((col) => {
                const column = col as keyof typeof visibleColumns;
                if (!visibleColumns[column]) return null;
                return (
                  <th key={column} onClick={() => handleSort(column as SortField)} className="px-3 py-2 min-w-[100px] cursor-pointer hover:bg-gray-600 transition">
                    <div className="flex items-center justify-center gap-1">
                      {column === 'key' ? 'Key (.ulg)' : column === 'date' ? 'Date' : column === 'flight_time' ? 'Flight Time (HH:MM:SS)' : column === 'distance' ? 'Distance (km)' : column.replace(/_/g, ' ')}
                      {sortField === column && (<span className="text-[#3EC1C5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={Object.keys(visibleColumns).length + 1} className="px-4 py-8 text-center text-gray-400">No LTE connectivity data found</td>
              </tr>
            ) : (
              paginatedEntries.map((entry, index) => (
                <tr key={entry._id} className={`transition ${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}`}>
                  <td className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{startIndex + index + 1}</td>
                  {Object.keys(visibleColumns).map((col) => {
                    const column = col as keyof typeof visibleColumns;
                    if (!visibleColumns[column]) return null;
                    const value = entry[column as keyof LTEAnalysisData];
                    
                    if (column === 'flight') {
                      return (
                        <td key={column} className="px-3 py-2 text-xs">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${value ? theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : theme === 'dark' ? 'bg-gray-600/50 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                            {value ? 'TRUE' : 'FALSE'}
                          </span>
                        </td>
                      );
                    }
                    if (column === 'date') {
                      return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatDate(String(value || ''))}</td>;
                    }
                    if (column === 'flight_time') {
                      return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatFlightTime(typeof value === 'number' ? value : 0)}</td>;
                    }
                    if (column === 'distance') {
                      return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{formatDistance(typeof value === 'number' ? value : 0)}</td>;
                    }
                    if (column === 'lte_loss' || column === 'rth_loss') {
                      return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{typeof value === 'number' ? value.toFixed(2) : String(value || '')}</td>;
                    }
                    if (typeof value === 'number') {
                      const integerColumns = ['rth_logs'];
                      const shouldShowAsInteger = integerColumns.includes(column) || column === 'key';
                      return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{shouldShowAsInteger ? value : value.toFixed(2)}</td>;
                    }
                    return <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{String(value || '')}</td>;
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            <span>Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries</span>
            <div className="w-24">
              <CustomSelect value={itemsPerPage.toString()} onChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }} options={[{ value: '25', label: '25 per page' }, { value: '50', label: '50 per page' }, { value: '100', label: '100 per page' }, { value: '200', label: '200 per page' }, { value: totalItems.toString(), label: 'All' }]} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {totalPages > 1 && (
              <>
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>First</button>
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>Previous</button>
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
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-2 py-1 text-xs rounded transition ${currentPage === pageNum ? theme === 'dark' ? 'bg-[#3EC1C5] text-gray-900' : 'bg-gray-900 text-white' : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>{pageNum}</button>
                    );
                  })}
                </div>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>Next</button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>Last</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


