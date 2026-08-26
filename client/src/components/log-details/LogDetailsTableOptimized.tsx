import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, Columns3, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ExcelExport } from '../ExcelExport';
import { useToast } from '../Toast';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  total_time: number;
  flight_time: number;
  distance: number;
  fc_version: string;
  cs_version: string;
  fwd_transitions: number;
  bwd_transitions: number;
  flight: boolean;
}

type SortField = keyof LogEntry;
type SortOrder = 'asc' | 'desc';

interface LogDetailsTableOptimizedProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  flightFilter?: { type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null;
  onClearFlightFilter?: () => void;
}

export function LogDetailsTableOptimized({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  flightFilter = null,
  onClearFlightFilter
}: LogDetailsTableOptimizedProps) {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const { showToast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalRecords, setTotalRecords] = useState(0);

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    key: true,
    sn: true,
    date: true,
    flight_time: true,
    distance: true,
    fc_version: true,
    cs_version: true,
    fwd_transitions: true,
    bwd_transitions: true,
    flight: true,
  });

  useEffect(() => {
    fetchEntries();
  }, [currentPage, itemsPerPage, sortField, sortOrder, selectedSNs, dateRange, searchQuery]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());
      params.append('sortBy', sortField);
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
      
      if (searchQuery) {
        // Note: Backend doesn't support search yet, we'll filter client-side for now
      }

      const response = await fetch(
        `${API_BASE_URL}/log-details?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.data || []);
        setTotalRecords(data.pagination?.total || 0);
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

  // Parse date from YYMMDD format to display format
  const parseDateFromField = (dateStr: string): string => {
    try {
      if (dateStr.length === 6) {
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        return `${day}/${month}/${year}`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return dateStr;
  };

  // Filter entries by search query (client-side for now)
  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    
    return entries.filter(entry => {
      const matchesSearch = 
        entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.sn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.fc_version?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.cs_version?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [entries, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const formatTime = (seconds: number): string => {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDistance = (meters: number): string => {
    if (!meters) return '0.00 km';
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  if (loading && entries.length === 0) {
    return (
      <div className={`rounded-lg p-8 border ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`text-center ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          Loading log details...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Actions */}
      <div className="flex justify-between items-center gap-2 mb-3">
        {/* Active Flight Filter Display */}
        {flightFilter && (
          <div className={`flex items-center gap-2 px-3 py-1.5 border border-[#3EC1C5] rounded-lg ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
          }`}>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <span className="text-[#3EC1C5] font-medium">Flight Analysis</span>
              {' - '}
              <span className="capitalize">{flightFilter.type === 'flightTime' ? 'Flight Time' : 'Distance'}</span> = {flightFilter.label}
            </span>
            {onClearFlightFilter && (
              <button
                onClick={onClearFlightFilter}
                className={`transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {!flightFilter && <div></div>}

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
              placeholder="Search..."
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
            data={filteredEntries}
            filename="log_details"
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
                <h4 className={`text-xs font-semibold mb-1.5 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>Columns</h4>
                <div className="space-y-1">
                  {Object.entries(visibleColumns).map(([key, value]) => (
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
                      <span className="text-xs">
                        {key === 'key' ? 'Key (.ulg)' : 
                         key === 'distance' ? 'Distance (km)' :
                         key.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            theme === 'dark' 
              ? 'text-gray-400 bg-gray-700' 
              : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16">S. No</th>
              {visibleColumns.key && (
                <th 
                  onClick={() => handleSort('key')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition"
                >
                  Key (.ulg) {sortField === 'key' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns.sn && (
                <th 
                  onClick={() => handleSort('sn')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition"
                >
                  SN {sortField === 'sn' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns.date && (
                <th 
                  onClick={() => handleSort('date')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition"
                >
                  Date {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns.flight_time && (
                <th 
                  onClick={() => handleSort('flight_time')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition"
                >
                  Flight Time {sortField === 'flight_time' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns.distance && (
                <th 
                  onClick={() => handleSort('distance')}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-600 transition"
                >
                  Distance {sortField === 'distance' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns.fc_version && <th className="px-3 py-2">FC Version</th>}
              {visibleColumns.cs_version && <th className="px-3 py-2">CS Version</th>}
              {visibleColumns.fwd_transitions && <th className="px-3 py-2">Fwd Trans</th>}
              {visibleColumns.bwd_transitions && <th className="px-3 py-2">Bwd Trans</th>}
              {visibleColumns.flight && <th className="px-3 py-2">Flight</th>}
            </tr>
          </thead>
          <tbody className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry, idx) => (
                <tr key={entry._id} className={`border-b transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className="px-3 py-2">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  {visibleColumns.key && <td className="px-3 py-2 font-mono text-xs">{entry.key}</td>}
                  {visibleColumns.sn && <td className="px-3 py-2 font-medium">{entry.sn}</td>}
                  {visibleColumns.date && <td className="px-3 py-2">{parseDateFromField(entry.date)}</td>}
                  {visibleColumns.flight_time && <td className="px-3 py-2 font-mono">{formatTime(entry.flight_time)}</td>}
                  {visibleColumns.distance && <td className="px-3 py-2">{formatDistance(entry.distance)}</td>}
                  {visibleColumns.fc_version && <td className="px-3 py-2">{entry.fc_version || '-'}</td>}
                  {visibleColumns.cs_version && <td className="px-3 py-2">{entry.cs_version || '-'}</td>}
                  {visibleColumns.fwd_transitions && <td className="px-3 py-2">{entry.fwd_transitions || 0}</td>}
                  {visibleColumns.bwd_transitions && <td className="px-3 py-2">{entry.bwd_transitions || 0}</td>}
                  {visibleColumns.flight && (
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        entry.flight 
                          ? theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                          : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {entry.flight ? 'Yes' : 'No'}
                      </span>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Object.values(visibleColumns).filter(v => v).length + 1} className={`px-3 py-8 text-center ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  No log details found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords.toLocaleString()} entries
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
              <option value={500}>500 per page</option>
              <option value={1000}>1000 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                        ? theme === 'dark' ? 'bg-[#3EC1C5] text-gray-900 font-semibold' : 'bg-gray-900 text-white font-semibold'
                        : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


