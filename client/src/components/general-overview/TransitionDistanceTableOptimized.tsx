import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, Columns3, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { TransitionDistanceDashboard } from './TransitionDistanceDashboard';
import { TransitionDistanceChart } from './TransitionDistanceChart';
import { ExcelExport } from '../ExcelExport';
import { cookieHelpers, COOKIE_KEYS } from '../../utils/cookies';
import { DateRangePicker } from '../DateRangePicker';

interface TransitionEntry {
  _id: string;
  branch: string;
  forwardMin: number | null;
  forwardMean: number | null;
  forwardMax: number | null;
  backwardMin: number | null;
  backwardMean: number | null;
  backwardMax: number | null;
  totalForward: number | null;
  totalBackward: number | null;
}

type SortField = 'branch' | 'totalForward' | 'totalBackward';
type SortOrder = 'asc' | 'desc';

interface TransitionDistanceTableOptimizedProps {
  dateRange?: { start: string | null; end: string | null };
  onDateRangeChange?: (start: string | null, end: string | null) => void;
}

export function TransitionDistanceTableOptimized({ 
  dateRange = { start: null, end: null },
  onDateRangeChange 
}: TransitionDistanceTableOptimizedProps) {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<TransitionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => 
    cookieHelpers.getFilterState<string>(COOKIE_KEYS.TRANSITION_SEARCH) || ''
  );
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.TRANSITION_SORT);
    return (saved?.key as SortField) || 'branch';
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    const saved = cookieHelpers.getSortState(COOKIE_KEYS.TRANSITION_SORT);
    return saved?.direction || 'asc';
  });
  const [expandedMetric, setExpandedMetric] = useState<'forward' | 'backward' | null>(null);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() =>
    cookieHelpers.getVisibleColumns(COOKIE_KEYS.TRANSITION_VISIBLE_COLUMNS) || {
      branch: true,
      forwardDistance: true,
      backwardDistance: true,
      totalForward: true,
      totalBackward: true,
    }
  );
  const { showToast } = useToast();

  useEffect(() => {
    fetchEntries();
  }, [dateRange]);

  // Save state to cookies
  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.TRANSITION_SEARCH, searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    cookieHelpers.setSortState(COOKIE_KEYS.TRANSITION_SORT, { key: sortField, direction: sortOrder });
  }, [sortField, sortOrder]);

  useEffect(() => {
    cookieHelpers.setVisibleColumns(COOKIE_KEYS.TRANSITION_VISIBLE_COLUMNS, visibleColumns);
  }, [visibleColumns]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const params = new URLSearchParams();
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      
      const response = await fetch(`${API_BASE_URL}/transition-distance?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      } else {
        showToast('Failed to fetch entries', 'error');
      }
    } catch (error) {
      console.error('Error fetching transition distance data:', error);
      showToast('Error fetching entries', 'error');
    } finally {
      setLoading(false);
    }
  };

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

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    return entries
      .filter(entry => entry.branch.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        const modifier = sortOrder === 'asc' ? 1 : -1;
        
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        
        return aVal > bVal ? modifier : -modifier;
      });
  }, [entries, searchQuery, sortField, sortOrder]);

  // Calculate overall statistics
  const overall = useMemo(() => {
    if (filteredAndSortedEntries.length === 0) {
      return {
        forwardMin: null,
        forwardMean: null,
        forwardMax: null,
        backwardMin: null,
        backwardMean: null,
        backwardMax: null,
        totalForward: null,
        totalBackward: null,
      };
    }

    const forwardMinValues = filteredAndSortedEntries.filter(e => e.forwardMin !== null).map(e => e.forwardMin!);
    const forwardMeanValues = filteredAndSortedEntries.filter(e => e.forwardMean !== null).map(e => e.forwardMean!);
    const forwardMaxValues = filteredAndSortedEntries.filter(e => e.forwardMax !== null).map(e => e.forwardMax!);
    const backwardMinValues = filteredAndSortedEntries.filter(e => e.backwardMin !== null).map(e => e.backwardMin!);
    const backwardMeanValues = filteredAndSortedEntries.filter(e => e.backwardMean !== null).map(e => e.backwardMean!);
    const backwardMaxValues = filteredAndSortedEntries.filter(e => e.backwardMax !== null).map(e => e.backwardMax!);
    const totalForwardValues = filteredAndSortedEntries.filter(e => e.totalForward !== null).map(e => e.totalForward!);
    const totalBackwardValues = filteredAndSortedEntries.filter(e => e.totalBackward !== null).map(e => e.totalBackward!);

    return {
      forwardMin: forwardMinValues.length > 0 ? Math.min(...forwardMinValues) : null,
      forwardMean: forwardMeanValues.length > 0 ? forwardMeanValues.reduce((sum, v) => sum + v, 0) / forwardMeanValues.length : null,
      forwardMax: forwardMaxValues.length > 0 ? Math.max(...forwardMaxValues) : null,
      backwardMin: backwardMinValues.length > 0 ? Math.min(...backwardMinValues) : null,
      backwardMean: backwardMeanValues.length > 0 ? backwardMeanValues.reduce((sum, v) => sum + v, 0) / backwardMeanValues.length : null,
      backwardMax: backwardMaxValues.length > 0 ? Math.max(...backwardMaxValues) : null,
      totalForward: totalForwardValues.length > 0 ? totalForwardValues.reduce((sum, v) => sum + v, 0) : null,
      totalBackward: totalBackwardValues.length > 0 ? totalBackwardValues.reduce((sum, v) => sum + v, 0) : null,
    };
  }, [filteredAndSortedEntries]);

  // Format export filename
  const getExportFilename = () => {
    let filename = 'transition_distance';
    if (dateRange.start || dateRange.end) {
      const start = dateRange.start || 'start';
      const end = dateRange.end || 'end';
      filename += `_${start}_to_${end}`;
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
    
    const parts = [`Transition Distance - Report Generated: ${reportDate}`];
    
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

      {/* Dashboard */}
      <TransitionDistanceDashboard 
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
        dateRange={dateRange}
        transitionData={entries}
        loading={loading}
      />

      {/* Transition Distance Chart */}
      <TransitionDistanceChart 
        entries={entries} 
        dateRange={dateRange}
        onClearFilters={() => onDateRangeChange && onDateRangeChange(null, null)}
        onQuickFilterChange={(start, end) => onDateRangeChange && onDateRangeChange(start, end)}
      />

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={`text-xs sm:text-sm font-semibold truncate ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            Transition Distance Data
          </h3>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
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
                  theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

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
                  {Object.entries(visibleColumns).map(([key, value]) => (
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
                      <span className="text-xs">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Excel Export */}
          <ExcelExport
            data={[]}
            filename={getExportFilename()}
            sheets={[
              {
                name: 'Transition Distance',
                data: [
                  {
                    'Branch': getSheetTitle(),
                    'Forward Min (m)': '',
                    'Forward Mean (m)': '',
                    'Forward Max (m)': '',
                    'Backward Min (m)': '',
                    'Backward Mean (m)': '',
                    'Backward Max (m)': '',
                    'Total Forward': '',
                    'Total Backward': '',
                  },
                  {
                    'Branch': '',
                    'Forward Min (m)': '',
                    'Forward Mean (m)': '',
                    'Forward Max (m)': '',
                    'Backward Min (m)': '',
                    'Backward Mean (m)': '',
                    'Backward Max (m)': '',
                    'Total Forward': '',
                    'Total Backward': '',
                  },
                  ...filteredAndSortedEntries.map(entry => ({
                    'Branch': entry.branch,
                    'Forward Min (m)': entry.forwardMin !== null ? entry.forwardMin.toFixed(2) : '-',
                    'Forward Mean (m)': entry.forwardMean !== null ? entry.forwardMean.toFixed(2) : '-',
                    'Forward Max (m)': entry.forwardMax !== null ? entry.forwardMax.toFixed(2) : '-',
                    'Backward Min (m)': entry.backwardMin !== null ? entry.backwardMin.toFixed(2) : '-',
                    'Backward Mean (m)': entry.backwardMean !== null ? entry.backwardMean.toFixed(2) : '-',
                    'Backward Max (m)': entry.backwardMax !== null ? entry.backwardMax.toFixed(2) : '-',
                    'Total Forward': entry.totalForward !== null ? entry.totalForward : '-',
                    'Total Backward': entry.totalBackward !== null ? entry.totalBackward : '-'
                  })),
                  {
                    'Branch': '',
                    'Forward Min (m)': '',
                    'Forward Mean (m)': '',
                    'Forward Max (m)': '',
                    'Backward Min (m)': '',
                    'Backward Mean (m)': '',
                    'Backward Max (m)': '',
                    'Total Forward': '',
                    'Total Backward': '',
                  },
                  {
                    'Branch': 'Overall',
                    'Forward Min (m)': overall.forwardMin !== null ? overall.forwardMin.toFixed(2) : '-',
                    'Forward Mean (m)': overall.forwardMean !== null ? overall.forwardMean.toFixed(2) : '-',
                    'Forward Max (m)': overall.forwardMax !== null ? overall.forwardMax.toFixed(2) : '-',
                    'Backward Min (m)': overall.backwardMin !== null ? overall.backwardMin.toFixed(2) : '-',
                    'Backward Mean (m)': overall.backwardMean !== null ? overall.backwardMean.toFixed(2) : '-',
                    'Backward Max (m)': overall.backwardMax !== null ? overall.backwardMax.toFixed(2) : '-',
                    'Total Forward': overall.totalForward !== null ? overall.totalForward : '-',
                    'Total Backward': overall.totalBackward !== null ? overall.totalBackward : '-'
                  }
                ],
                columns: [
                  { key: 'Branch', label: 'Branch' },
                  { key: 'Forward Min (m)', label: 'Forward Min (m)' },
                  { key: 'Forward Mean (m)', label: 'Forward Mean (m)' },
                  { key: 'Forward Max (m)', label: 'Forward Max (m)' },
                  { key: 'Backward Min (m)', label: 'Backward Min (m)' },
                  { key: 'Backward Mean (m)', label: 'Backward Mean (m)' },
                  { key: 'Backward Max (m)', label: 'Backward Max (m)' },
                  { key: 'Total Forward', label: 'Total Forward Transitions' },
                  { key: 'Total Backward', label: 'Total Backward Transitions' },
                ]
              }
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[300px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            theme === 'dark' ? 'text-gray-400 bg-gray-700' : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16">S. No</th>
              {visibleColumns.branch && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('branch')}>
                  <div className="flex items-center justify-center gap-1">
                    Branch
                    {sortField === 'branch' && (
                      <span className={`${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.forwardDistance && (
                <th className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`} colSpan={3}>
                  Forward Transition Distance (m)
                </th>
              )}
              {visibleColumns.backwardDistance && (
                <th className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`} colSpan={3}>
                  Backward Transition Distance (m)
                </th>
              )}
              {visibleColumns.totalForward && (
                <th className={`px-3 py-2 min-w-[100px] border-l cursor-pointer transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-600' : 'border-gray-300 hover:bg-gray-200'
                }`} onClick={() => handleSort('totalForward')}>
                  <div className="flex items-center justify-center gap-1">
                    Total Forward
                    {sortField === 'totalForward' && (
                      <span className={`${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.totalBackward && (
                <th className={`px-3 py-2 min-w-[100px] border-l cursor-pointer transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-600' : 'border-gray-300 hover:bg-gray-200'
                }`} onClick={() => handleSort('totalBackward')}>
                  <div className="flex items-center justify-center gap-1">
                    Total Backward
                    {sortField === 'totalBackward' && (
                      <span className={`${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
            </tr>
            {(visibleColumns.forwardDistance || visibleColumns.backwardDistance) && (
              <tr className={`border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
                <th></th>
                {visibleColumns.branch && <th></th>}
                {visibleColumns.forwardDistance && (
                  <>
                    <th className={`px-2 py-1 text-xs border-l ${theme === 'dark' ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>Min</th>
                    <th className={`px-2 py-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Mean</th>
                    <th className={`px-2 py-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Max</th>
                  </>
                )}
                {visibleColumns.backwardDistance && (
                  <>
                    <th className={`px-2 py-1 text-xs border-l ${theme === 'dark' ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-300'}`}>Min</th>
                    <th className={`px-2 py-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Mean</th>
                    <th className={`px-2 py-1 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Max</th>
                  </>
                )}
                {visibleColumns.totalForward && <th></th>}
                {visibleColumns.totalBackward && <th></th>}
              </tr>
            )}
          </thead>
          <tbody className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>
            {filteredAndSortedEntries.length === 0 ? (
              <tr>
                <td colSpan={11} className={`px-3 py-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  No entries found
                </td>
              </tr>
            ) : (
              filteredAndSortedEntries.map((entry, index) => (
                <tr key={entry._id} className={`border-t transition ${
                  theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/30' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className={`px-3 py-2 font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{index + 1}</td>
                  {visibleColumns.branch && <td className={`px-3 py-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{entry.branch}</td>}
                  {visibleColumns.forwardDistance && (
                    <>
                      <td className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>{entry.forwardMin !== null ? entry.forwardMin.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2">{entry.forwardMean !== null ? entry.forwardMean.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2">{entry.forwardMax !== null ? entry.forwardMax.toFixed(2) : '-'}</td>
                    </>
                  )}
                  {visibleColumns.backwardDistance && (
                    <>
                      <td className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>{entry.backwardMin !== null ? entry.backwardMin.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2">{entry.backwardMean !== null ? entry.backwardMean.toFixed(2) : '-'}</td>
                      <td className="px-3 py-2">{entry.backwardMax !== null ? entry.backwardMax.toFixed(2) : '-'}</td>
                    </>
                  )}
                  {visibleColumns.totalForward && <td className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>{entry.totalForward !== null ? entry.totalForward : '-'}</td>}
                  {visibleColumns.totalBackward && <td className={`px-3 py-2 border-l ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>{entry.totalBackward !== null ? entry.totalBackward : '-'}</td>}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className={`sticky bottom-0 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
            <tr className={`border-t-2 font-semibold ${
              theme === 'dark' ? 'border-[#3EC1C5]' : 'border-gray-900'
            }`}>
              <td className={`px-3 py-2 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`} colSpan={visibleColumns.branch ? 2 : 1}>
                Overall
              </td>
              {visibleColumns.forwardDistance && (
                <>
                  <td className={`px-3 py-2 text-center border-l ${theme === 'dark' ? 'text-white border-gray-700' : 'text-gray-900 border-gray-300'}`}>
                    {overall.forwardMin !== null ? overall.forwardMin.toFixed(2) : '-'}
                  </td>
                  <td className={`px-3 py-2 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {overall.forwardMean !== null ? overall.forwardMean.toFixed(2) : '-'}
                  </td>
                  <td className={`px-3 py-2 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {overall.forwardMax !== null ? overall.forwardMax.toFixed(2) : '-'}
                  </td>
                </>
              )}
              {visibleColumns.backwardDistance && (
                <>
                  <td className={`px-3 py-2 text-center border-l ${theme === 'dark' ? 'text-white border-gray-700' : 'text-gray-900 border-gray-300'}`}>
                    {overall.backwardMin !== null ? overall.backwardMin.toFixed(2) : '-'}
                  </td>
                  <td className={`px-3 py-2 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {overall.backwardMean !== null ? overall.backwardMean.toFixed(2) : '-'}
                  </td>
                  <td className={`px-3 py-2 text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {overall.backwardMax !== null ? overall.backwardMax.toFixed(2) : '-'}
                  </td>
                </>
              )}
              {visibleColumns.totalForward && (
                <td className={`px-3 py-2 text-center border-l ${theme === 'dark' ? 'text-white border-gray-700' : 'text-gray-900 border-gray-300'}`}>
                  {overall.totalForward !== null ? overall.totalForward : '-'}
                </td>
              )}
              {visibleColumns.totalBackward && (
                <td className={`px-3 py-2 text-center border-l ${theme === 'dark' ? 'text-white border-gray-700' : 'text-gray-900 border-gray-300'}`}>
                  {overall.totalBackward !== null ? overall.totalBackward : '-'}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}



