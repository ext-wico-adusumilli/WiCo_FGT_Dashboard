import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Plus, Search, Columns3, X, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../ConfirmDialog';
import { ExcelExport } from '../ExcelExport';
import { normalizeSerialNumber } from '../../utils/serialNumberUtils';
import { useTheme } from '../../contexts/ThemeContext';
import { calculateDensityAltitude, formatDensityAltitude } from '../../utils/densityAltitudeUtils';

interface WeatherEntry {
  _id: string;
  pressure: number | null;
  humidity: number | null;
  rain: string;
  temperature: number | null;
  uaSN: string;
  flightLog: string;
  location: string;
  amslMaxWind: number | null;
  amsl: number | null;
  maxGust: number | null;
  lowWindChill: number | null;
  thwIndex: number | null;
  wetBulb: number | null;
  windChill: number | null;
  windRun: number | null;
  cloud: number | null;
}

type SortField = 'uaSN' | 'flightLog' | 'location' | 'temperature' | 'pressure' | 'humidity' | 'rain' | 'amslMaxWind' | 'amsl' | 'densityAltitude' | 'maxGust' | 'lowWindChill' | 'thwIndex' | 'wetBulb' | 'windChill' | 'cloud';
type SortOrder = 'asc' | 'desc';

interface WeatherDataTableProps {
  initialFilterFlightLog?: string;
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  weatherFilter?: { type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null;
  onClearWeatherFilter?: () => void;
}

export function WeatherDataTable({ 
  initialFilterFlightLog = '',
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null },
  weatherFilter = null,
  onClearWeatherFilter
}: WeatherDataTableProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [entries, setEntries] = useState<WeatherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialFilterFlightLog);
  const [sortField, setSortField] = useState<SortField>('uaSN');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({
    show: false,
    id: null
  });
  const { showToast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200); // Increased default from 50 to 200

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    uaSN: true,
    flightLog: true,
    location: true,
    pressure: true,
    humidity: true,
    rain: true,
    temperature: true,
    amsl: true,
    densityAltitude: true,
    maxWind: true,
    maxGust: true,
    lowWindChill: true,
    thwIndex: true,
    wetBulb: true,
    windChill: true,
    cloud: true,
  });

  const [formData, setFormData] = useState({
    pressure: '' as string | number,
    humidity: '' as string | number,
    rain: '',
    temperature: '' as string | number,
    uaSN: '',
    flightLog: '',
    location: '',
    amslMaxWind: '' as string | number,
    amsl: '' as string | number,
    maxGust: '' as string | number,
    lowWindChill: '' as string | number,
    thwIndex: '' as string | number,
    wetBulb: '' as string | number,
    windChill: '' as string | number,
    windRun: '' as string | number,
    cloud: '' as string | number,
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  // Update search query when initialFilterFlightLog changes
  useEffect(() => {
    if (initialFilterFlightLog) {
      setSearchQuery(initialFilterFlightLog);
    }
  }, [initialFilterFlightLog]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const BATCH_SIZE = 2000; // Match table batch size
      let allEntries: any[] = [];
      let currentBatch = 1;
      let hasMoreData = true;

      // Load all data in batches to match table behavior
      while (hasMoreData) {
        const response = await fetch(
          `${API_BASE_URL}/weather-data?limit=${BATCH_SIZE}&page=${currentBatch}`,
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
          showToast('Failed to fetch entries', 'error');
          hasMoreData = false;
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      showToast('Error fetching entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const url = editingId
        ? `${API_BASE_URL}/weather-data/${editingId}`
        : `${API_BASE_URL}/weather-data`;

      const submitData = {
        pressure: formData.pressure === '' ? null : Number(formData.pressure),
        humidity: formData.humidity === '' ? null : Number(formData.humidity),
        rain: formData.rain === '' ? '' : formData.rain,
        temperature: formData.temperature === '' ? null : Number(formData.temperature),
        uaSN: normalizeSerialNumber(formData.uaSN),
        flightLog: formData.flightLog,
        location: formData.location,
        amslMaxWind: formData.amslMaxWind === '' ? null : Number(formData.amslMaxWind),
        amsl: formData.amsl === '' ? null : Number(formData.amsl),
        maxGust: formData.maxGust === '' ? null : Number(formData.maxGust),
        lowWindChill: formData.lowWindChill === '' ? null : Number(formData.lowWindChill),
        thwIndex: formData.thwIndex === '' ? null : Number(formData.thwIndex),
        wetBulb: formData.wetBulb === '' ? null : Number(formData.wetBulb),
        windChill: formData.windChill === '' ? null : Number(formData.windChill),
        windRun: formData.windRun === '' ? null : Number(formData.windRun),
        cloud: formData.cloud === '' ? null : Number(formData.cloud),
      };

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        showToast(editingId ? 'Updated successfully' : 'Added successfully', 'success');
        setShowAddModal(false);
        setEditingId(null);
        resetForm();
        fetchEntries();
      } else {
        const error = await response.json();
        showToast(error.message || 'Operation failed', 'error');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      showToast('Error saving entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      pressure: '',
      humidity: '',
      rain: '',
      temperature: '',
      uaSN: '',
      flightLog: '',
      location: '',
      amslMaxWind: '',
      amsl: '',
      maxGust: '',
      lowWindChill: '',
      thwIndex: '',
      wetBulb: '',
      windChill: '',
      windRun: '',
      cloud: '',
    });
  };

  const handleEdit = (entry: WeatherEntry) => {
    setEditingId(entry._id);
    setFormData({
      pressure: entry.pressure !== null ? entry.pressure : '',
      humidity: entry.humidity !== null ? entry.humidity : '',
      rain: entry.rain || '',
      temperature: entry.temperature !== null ? entry.temperature : '',
      uaSN: entry.uaSN,
      flightLog: entry.flightLog,
      location: entry.location,
      amslMaxWind: entry.amslMaxWind !== null ? entry.amslMaxWind : '',
      amsl: entry.amsl !== null ? entry.amsl : '',
      maxGust: entry.maxGust !== null ? entry.maxGust : '',
      lowWindChill: entry.lowWindChill !== null ? entry.lowWindChill : '',
      thwIndex: entry.thwIndex !== null ? entry.thwIndex : '',
      wetBulb: entry.wetBulb !== null ? entry.wetBulb : '',
      windChill: entry.windChill !== null ? entry.windChill : '',
      windRun: entry.windRun !== null ? entry.windRun : '',
      cloud: entry.cloud !== null ? entry.cloud : '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/weather-data/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        showToast('Entry deleted successfully', 'success');
        fetchEntries();
      } else {
        showToast('Failed to delete entry', 'error');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      showToast('Error deleting entry', 'error');
    }
    setDeleteConfirm({ show: false, id: null });
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

  // Extract date from flight log filename (format: UASN.YYMMDD_HH-MM-SS.XXX.ulg)
  const extractDateFromFlightLog = (flightLog: string): string => {
    try {
      const match = flightLog.match(/\.(\d{6})_/);
      if (match) {
        const dateStr = match[1];
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.error('Error parsing date from flight log:', error);
    }
    return 'Unknown';
  };

  const filteredAndSortedEntries = entries
    .filter(entry => {
      // Search filter
      const matchesSearch = normalizeSerialNumber(entry.uaSN).toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.flightLog.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.location.toLowerCase().includes(searchQuery.toLowerCase());

      // UA SN filter (multi-select)
      const matchesUASN = selectedUASNs.length === 0 || selectedUASNs.includes(normalizeSerialNumber(entry.uaSN));

      // Weather condition filter (from chart clicks)
      let matchesWeather = true;
      if (weatherFilter) {
        // If filter has matching flight logs (from Flight Hours or Weather Conditions charts)
        if (weatherFilter.matchingFlightLogs && weatherFilter.matchingFlightLogs.length > 0) {
          matchesWeather = weatherFilter.matchingFlightLogs.includes(entry.flightLog);
        } else {
          // Fallback to regular weather filter
          const value = weatherFilter.type === 'temperature' ? entry.temperature :
                       weatherFilter.type === 'humidity' ? entry.humidity :
                       weatherFilter.type === 'pressure' ? entry.pressure : null;
          
          if (value !== null && value !== undefined) {
            const min = weatherFilter.range.min === -Infinity ? -Infinity : weatherFilter.range.min;
            const max = weatherFilter.range.max === Infinity ? Infinity : weatherFilter.range.max;
            matchesWeather = value >= min && value < max;
          } else {
            matchesWeather = false;
          }
        }
      }

      // Location filter (multi-select)
      const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(entry.location);

      // Date range filter
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = extractDateFromFlightLog(entry.flightLog);
        if (entryDate !== 'Unknown') {
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

      return matchesSearch && matchesUASN && matchesLocation && matchesDate && matchesWeather;
    })
    .sort((a, b) => {
      let aVal, bVal;
      
      if (sortField === 'densityAltitude') {
        aVal = calculateDensityAltitude(a);
        bVal = calculateDensityAltitude(b);
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }
      
      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      return aVal > bVal ? modifier : -modifier;
    });

  // Pagination calculations
  const totalItems = filteredAndSortedEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = filteredAndSortedEntries.slice(startIndex, endIndex);

  // Reset to page 1 when search, filters, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUASNs, selectedLocations, dateRange, sortField, sortOrder]);

  if (loading) {
    return (
      <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-12 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 w-full ${isDark ? 'custom-select-dark' : 'custom-select-light'}`}>
      {/* Search and Actions - Aligned Right */}
      <div className="flex justify-between items-center gap-2">
        {/* Active Weather Filter Display */}
        {weatherFilter && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
            isDark ? 'bg-gray-700 border-[#3EC1C5]' : 'bg-teal-50 border-teal-200'
          }`}>
            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {weatherFilter.source === 'flightHours' ? (
                <>
                  <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-teal-700'} font-medium`}>Flight Hours vs Weather Conditions</span>
                  {' - '}
                  <span className="capitalize">{weatherFilter.type}</span> = {weatherFilter.label}
                </>
              ) : weatherFilter.source === 'weatherConditions' ? (
                <>
                  <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-teal-700'} font-medium`}>Weather Conditions Analysis</span>
                  {' - '}
                  <span className="capitalize">{weatherFilter.type}</span> = {weatherFilter.label}
                </>
              ) : (
                <>
                  Filter: <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-teal-700'} font-medium capitalize`}>{weatherFilter.type}</span> = {weatherFilter.label}
                </>
              )}
            </span>
            {onClearWeatherFilter && (
              <button
                onClick={onClearWeatherFilter}
                className={`transition ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        
        {!weatherFilter && <div></div>}

        <div className="flex items-center gap-2">
        {/* Search Bar */}
        <div className="relative">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className={`pl-7 pr-7 py-1.5 h-[30px] border rounded transition text-xs w-40 focus:outline-none ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${
                isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Excel Export */}
        <ExcelExport
          data={filteredAndSortedEntries.map(entry => ({
            'UA SN': normalizeSerialNumber(entry.uaSN) || '',
            'Flight Log': entry.flightLog || '',
            'Location': entry.location || '',
            'Pressure (hPa)': entry.pressure !== null && entry.pressure !== undefined ? entry.pressure.toFixed(2) : '',
            'Humidity (%)': entry.humidity !== null && entry.humidity !== undefined ? entry.humidity.toFixed(1) : '',
            'Rain (mm)': entry.rain || '',
            'Temperature (°C)': entry.temperature !== null && entry.temperature !== undefined ? entry.temperature.toFixed(1) : '',
            'AMSL': entry.amsl !== null && entry.amsl !== undefined ? entry.amsl.toFixed(2) : '',
            'Density Altitude': formatDensityAltitude(calculateDensityAltitude(entry)),
            'Max Wind (m/s)': entry.windRun !== null && entry.windRun !== undefined ? entry.windRun.toFixed(2) : '',
            'Max Gust (m/s)': entry.maxGust !== null && entry.maxGust !== undefined ? entry.maxGust.toFixed(2) : '',
            'Low Wind Chill (°C)': entry.lowWindChill !== null && entry.lowWindChill !== undefined ? entry.lowWindChill.toFixed(1) : '',
            'THW Index (°C)': entry.thwIndex !== null && entry.thwIndex !== undefined ? entry.thwIndex.toFixed(1) : '',
            'Wet Bulb (°C)': entry.wetBulb !== null && entry.wetBulb !== undefined ? entry.wetBulb.toFixed(1) : '',
            'Wind Chill (°C)': entry.windChill !== null && entry.windChill !== undefined ? entry.windChill.toFixed(1) : '',
            'Cloud (%)': entry.cloud !== null && entry.cloud !== undefined ? entry.cloud.toFixed(1) : '',
          }))}
          filename="weather_data"
        />

        {/* Column Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumnToggle(!showColumnToggle)}
            className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            <Columns3 className="w-3 h-3" />
            <span className="text-xs">Columns</span>
          </button>
          {showColumnToggle && (
            <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg p-2 z-50 max-h-64 overflow-y-auto border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            }`}>
              <h4 className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Columns</h4>
              <div className="space-y-1">
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${
                    isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                  }`}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                      className={`rounded w-3 h-3 ${
                        isDark
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

          {/* Add Entry Button */}
          <button
            onClick={() => {
              setEditingId(null);
              resetForm();
              setShowAddModal(true);
            }}
          className="flex items-center gap-1 px-2 py-1.5 h-[30px] bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900 font-semibold rounded transition text-xs"
          >
            <Plus className="w-3 h-3" />
            <span className="text-xs">Add Entry</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
        isDark ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            isDark ? 'text-gray-400 bg-gray-700' : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16">S. No</th>
              {visibleColumns.uaSN && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('uaSN')}>
                  <div className="flex items-center justify-center gap-1">
                    UA SN
                    {sortField === 'uaSN' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.flightLog && (
                <th className={`px-3 py-2 min-w-[200px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('flightLog')}>
                  <div className="flex items-center justify-center gap-1">
                    Flight Log (.ulg)
                    {sortField === 'flightLog' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.location && (
                <th className={`px-3 py-2 min-w-[150px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('location')}>
                  <div className="flex items-center justify-center gap-1">
                    Location
                    {sortField === 'location' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.pressure && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('pressure')}>
                  <div className="flex items-center justify-center gap-1">
                    Pressure (hPa)
                    {sortField === 'pressure' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.humidity && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('humidity')}>
                  <div className="flex items-center justify-center gap-1">
                    Humidity (%)
                    {sortField === 'humidity' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.rain && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('rain')}>
                  <div className="flex items-center justify-center gap-1">
                    Rain (mm)
                    {sortField === 'rain' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.temperature && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('temperature')}>
                  <div className="flex items-center justify-center gap-1">
                    Temp (°C)
                    {sortField === 'temperature' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.amsl && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('amsl')}>
                  <div className="flex items-center justify-center gap-1">
                    AMSL
                    {sortField === 'amsl' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.densityAltitude && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('densityAltitude')}>
                  <div className="flex items-center justify-center gap-1">
                    Density Altitude
                    {sortField === 'densityAltitude' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.maxWind && (
                <th className={`px-3 py-2 min-w-[250px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('maxGust')}>
                  <div className="flex items-center justify-center gap-1">
                    Maximum Wind during the flight(m/s)
                    {sortField === 'maxGust' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.maxGust && (
                <th className={`px-3 py-2 min-w-[250px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('maxGust')}>
                  <div className="flex items-center justify-center gap-1">
                    Max Gust during the flight(m/s)
                    {sortField === 'maxGust' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.lowWindChill && (
                <th className={`px-3 py-2 min-w-[150px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('lowWindChill')}>
                  <div className="flex items-center justify-center gap-1">
                    Low Wind Chill (°C)
                    {sortField === 'lowWindChill' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.thwIndex && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('thwIndex')}>
                  <div className="flex items-center justify-center gap-1">
                    THW Index (°C)
                    {sortField === 'thwIndex' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.wetBulb && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('wetBulb')}>
                  <div className="flex items-center justify-center gap-1">
                    Wet Bulb (°C)
                    {sortField === 'wetBulb' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.windChill && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('windChill')}>
                  <div className="flex items-center justify-center gap-1">
                    Wind Chill (°C)
                    {sortField === 'windChill' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.cloud && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('cloud')}>
                  <div className="flex items-center justify-center gap-1">
                    Cloud (%)
                    {sortField === 'cloud' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              <th className="px-3 py-2 min-w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
            {paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={16} className={`px-3 py-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {loading ? 'Loading...' : 'No entries found'}
                </td>
              </tr>
            ) : (
              paginatedEntries.map((entry, index) => (
                <tr key={entry._id} className={`border-t transition ${
                  isDark ? 'border-gray-700 hover:bg-gray-700/30' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className={`px-3 py-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{startIndex + index + 1}</td>
                  {visibleColumns.uaSN && <td className={`px-3 py-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{normalizeSerialNumber(entry.uaSN)}</td>}
                  {visibleColumns.flightLog && <td className={`px-3 py-2 font-mono text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{entry.flightLog}</td>}
                  {visibleColumns.location && <td className="px-3 py-2">{entry.location}</td>}
                  {visibleColumns.pressure && <td className="px-3 py-2">{entry.pressure !== null && entry.pressure !== undefined ? entry.pressure.toFixed(2) : '-'}</td>}
                  {visibleColumns.humidity && <td className="px-3 py-2">{entry.humidity !== null && entry.humidity !== undefined ? entry.humidity.toFixed(1) : '-'}</td>}
                  {visibleColumns.rain && <td className="px-3 py-2">{entry.rain || '-'}</td>}
                  {visibleColumns.temperature && <td className="px-3 py-2">{entry.temperature !== null && entry.temperature !== undefined ? entry.temperature.toFixed(1) : '-'}</td>}
                  {visibleColumns.amsl && <td className="px-3 py-2">{entry.amsl !== null && entry.amsl !== undefined ? entry.amsl.toFixed(2) : '-'}</td>}
                  {visibleColumns.densityAltitude && <td className="px-3 py-2">{formatDensityAltitude(calculateDensityAltitude(entry))}</td>}
                  {visibleColumns.maxWind && <td className="px-3 py-2">{entry.windRun !== null && entry.windRun !== undefined ? entry.windRun.toFixed(2) : '-'}</td>}
                  {visibleColumns.maxGust && <td className="px-3 py-2">{entry.maxGust !== null && entry.maxGust !== undefined ? entry.maxGust.toFixed(2) : '-'}</td>}
                  {visibleColumns.lowWindChill && <td className="px-3 py-2">{entry.lowWindChill !== null && entry.lowWindChill !== undefined ? entry.lowWindChill.toFixed(1) : '-'}</td>}
                  {visibleColumns.thwIndex && <td className="px-3 py-2">{entry.thwIndex !== null && entry.thwIndex !== undefined ? entry.thwIndex.toFixed(1) : '-'}</td>}
                  {visibleColumns.wetBulb && <td className="px-3 py-2">{entry.wetBulb !== null && entry.wetBulb !== undefined ? entry.wetBulb.toFixed(1) : '-'}</td>}
                  {visibleColumns.windChill && <td className="px-3 py-2">{entry.windChill !== null && entry.windChill !== undefined ? entry.windChill.toFixed(1) : '-'}</td>}
                  {visibleColumns.cloud && <td className="px-3 py-2">{entry.cloud !== null && entry.cloud !== undefined ? entry.cloud.toFixed(1) : '-'}</td>}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEdit(entry)}
                        className={`p-1 rounded transition ${
                          isDark ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-400/10' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-100'
                        }`}
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, id: entry._id })}
                        className={`p-1 rounded transition ${
                          isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10' : 'text-red-600 hover:text-red-700 hover:bg-red-100'
                        }`}
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
                isDark
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
              <option value={totalItems}>Show All ({totalItems})</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                        ? isDark ? 'bg-[#3EC1C5] text-gray-900 font-semibold' : 'bg-gray-900 text-white font-semibold'
                        : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg p-5 w-full max-w-4xl max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingId ? 'Edit Weather Entry' : 'Add New Weather Entry'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Required Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>UA SN *</label>
                  <input
                    type="text"
                    value={formData.uaSN}
                    onChange={(e) => setFormData({ ...formData, uaSN: e.target.value })}
                    required
                    placeholder="e.g., 120"
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                      isDark
                        ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                        : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Flight Log (.ulg) *</label>
                  <input
                    type="text"
                    value={formData.flightLog}
                    onChange={(e) => setFormData({ ...formData, flightLog: e.target.value })}
                    required
                    placeholder="e.g., 120.250506_13-35-22.001.ulg"
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                      isDark
                        ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                        : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Test Site A"
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                      isDark
                        ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                        : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                    }`}
                  />
                </div>
              </div>

              {/* Weather Measurements */}
              <div className={`border-t pt-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Weather Measurements</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Pressure (hPa)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pressure}
                      onChange={(e) => setFormData({ ...formData, pressure: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Humidity (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.humidity}
                      onChange={(e) => setFormData({ ...formData, humidity: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Rain (mm)</label>
                    <input
                      type="text"
                      value={formData.rain}
                      onChange={(e) => setFormData({ ...formData, rain: e.target.value })}
                      placeholder="e.g., 0,0"
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Cloud (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.cloud}
                      onChange={(e) => setFormData({ ...formData, cloud: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Wind Measurements */}
              <div className={`border-t pt-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Wind Measurements</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>AMSL</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amslMaxWind}
                      onChange={(e) => setFormData({ ...formData, amslMaxWind: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Maximum Wind during the flight(m/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.windRun}
                      onChange={(e) => setFormData({ ...formData, windRun: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Max Gust during the flight(m/s)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.maxGust}
                      onChange={(e) => setFormData({ ...formData, maxGust: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>

                </div>
              </div>

              {/* Temperature Indices */}
              <div className={`border-t pt-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Temperature Indices</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Low Wind Chill (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.lowWindChill}
                      onChange={(e) => setFormData({ ...formData, lowWindChill: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>THW Index (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.thwIndex}
                      onChange={(e) => setFormData({ ...formData, thwIndex: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Wet Bulb (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.wetBulb}
                      onChange={(e) => setFormData({ ...formData, wetBulb: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Wind Chill (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.windChill}
                      onChange={(e) => setFormData({ ...formData, windChill: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 ${
                        isDark
                          ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-gray-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-[#3EC1C5] hover:bg-[#35a9ad] text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                    isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={() => deleteConfirm.id && handleDelete(deleteConfirm.id)}
        title="Delete Entry"
        message="Are you sure you want to delete this weather entry? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}


