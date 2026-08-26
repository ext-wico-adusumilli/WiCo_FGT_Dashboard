import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Search, Columns3, X } from 'lucide-react';
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

interface PaginatedResponse {
  data: WeatherEntry[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  source?: string;
}

type SortField = 'uaSN' | 'flightLog' | 'location' | 'temperature' | 'pressure' | 'humidity' | 'rain' | 'amslMaxWind' | 'amsl' | 'densityAltitude' | 'maxGust' | 'lowWindChill' | 'thwIndex' | 'wetBulb' | 'windChill' | 'windRun' | 'cloud';
type SortOrder = 'asc' | 'desc';

interface WeatherDataTableOptimizedProps {
  initialFilterFlightLog?: string;
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  weatherFilter?: { type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null;
  onClearWeatherFilter?: () => void;
}

export function WeatherDataTableOptimized({ 
  initialFilterFlightLog = '',
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null },
  weatherFilter = null,
  onClearWeatherFilter
}: WeatherDataTableOptimizedProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [entries, setEntries] = useState<WeatherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortLoading, setSortLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialFilterFlightLog);
  const [sortField, setSortField] = useState<SortField>('uaSN');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

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

  useEffect(() => {
    fetchEntries();
  }, [currentPage, itemsPerPage, sortField, sortOrder, searchQuery, selectedUASNs, selectedLocations, dateRange, weatherFilter]);

  const fetchAllDataForExport = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        page: '1',
        limit: '10000', // Large limit to get all data
        sortField,
        sortOrder,
        search: searchQuery
      });
      
      if (selectedUASNs.length > 0) {
        params.append('uaSNs', selectedUASNs.join(','));
      }
      if (selectedLocations.length > 0) {
        // Use ||| as delimiter to handle locations with commas
        params.append('locations', selectedLocations.join('|||'));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }

      // Only send weather filter to server if it's not density altitude
      if (weatherFilter && weatherFilter.type !== 'densityAltitude') {
        params.append('weatherFilter', JSON.stringify(weatherFilter));
      }

      const response = await fetch(
        `${API_BASE_URL}/weather-data/paginated?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        let allData = data.data || [];
        
        // Apply client-side density altitude filtering if needed
        if (weatherFilter && weatherFilter.type === 'densityAltitude') {
          allData = allData.filter((entry: WeatherEntry) => {
            const densityAltitude = calculateDensityAltitude(entry);
            if (densityAltitude === null) return false;
            return densityAltitude >= weatherFilter.range.min && densityAltitude < weatherFilter.range.max;
          });
        }
        
        return allData;
      }
      return [];
    } catch (error) {
      console.error('Error fetching all data for export:', error);
      return [];
    }
  };

  // Update search query when initialFilterFlightLog changes
  useEffect(() => {
    if (initialFilterFlightLog) {
      setSearchQuery(initialFilterFlightLog);
    }
  }, [initialFilterFlightLog]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedUASNs, selectedLocations, dateRange, sortField, sortOrder, weatherFilter]);

  const fetchEntries = async () => {
    // Don't show full loading for sort operations
    const isSortOperation = !loading && (sortLoading || entries.length > 0);
    if (!isSortOperation) {
      setLoading(true);
    } else {
      setSortLoading(true);
    }
    
    try {
      const token = localStorage.getItem('auth_token');
      
      // For density altitude filtering, we need to fetch ALL data since we filter client-side
      const fetchLimit = weatherFilter && weatherFilter.type === 'densityAltitude' ? '50000' : itemsPerPage.toString();
      
      const params = new URLSearchParams({
        page: weatherFilter && weatherFilter.type === 'densityAltitude' ? '1' : currentPage.toString(),
        limit: fetchLimit,
        sortField,
        sortOrder,
        search: searchQuery
      });

      if (selectedUASNs.length > 0) {
        params.append('uaSNs', selectedUASNs.join(','));
      }
      if (selectedLocations.length > 0) {
        // Use ||| as delimiter to handle locations with commas
        params.append('locations', selectedLocations.join('|||'));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      
      // Only send weather filter to server if it's not density altitude
      if (weatherFilter && weatherFilter.type !== 'densityAltitude') {
        params.append('weatherFilter', JSON.stringify(weatherFilter));
      }

      // Add a cache buster for density altitude to avoid cached results
      if (weatherFilter && weatherFilter.type === 'densityAltitude') {
        params.append('densityAltitudeFilter', JSON.stringify(weatherFilter));
      }

      // console.log('Fetching entries with params:', Object.fromEntries(params));
      // console.log('Weather filter:', weatherFilter);

      const response = await fetch(
        `${API_BASE_URL}/weather-data/paginated?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data: PaginatedResponse = await response.json();
        let filteredData = data.data;
        let totalFiltered = data.totalCount;
        let totalPagesFiltered = data.totalPages;
        
        // Apply client-side density altitude filtering if needed
        if (weatherFilter && weatherFilter.type === 'densityAltitude') {
          console.log('Applying client-side density altitude filtering');
          console.log('Filter range:', weatherFilter.range);
          console.log('Original data count:', filteredData.length);
          
          // First, let's see what density altitude values we actually have
          const sampleDensityAltitudes = data.data.slice(0, 10).map((entry: WeatherEntry) => {
            const da = calculateDensityAltitude(entry);
            return {
              uaSN: entry.uaSN,
              temp: entry.temperature,
              pressure: entry.pressure,
              humidity: entry.humidity,
              amsl: entry.amsl,
              densityAltitude: da
            };
          });
          console.log('Sample density altitude calculations:', sampleDensityAltitudes);
          
          const allFilteredData = data.data.filter((entry: WeatherEntry) => {
            const densityAltitude = calculateDensityAltitude(entry);
            if (densityAltitude === null) return false;
            const inRange = densityAltitude >= weatherFilter.range.min && densityAltitude < weatherFilter.range.max;
            return inRange;
          });
          
          console.log('All filtered data count:', allFilteredData.length);
          
          // If no matches, let's see the actual range of density altitudes
          if (allFilteredData.length === 0) {
            const allDensityAltitudes = data.data
              .map((entry: WeatherEntry) => calculateDensityAltitude(entry))
              .filter(da => da !== null)
              .sort((a, b) => a - b);
            
            console.log('Actual density altitude range in data:');
            console.log('Min:', allDensityAltitudes[0]);
            console.log('Max:', allDensityAltitudes[allDensityAltitudes.length - 1]);
            console.log('Sample values:', allDensityAltitudes.slice(0, 10));
            console.log('Looking for range:', weatherFilter.range.min, 'to', weatherFilter.range.max);
          }
          
          // Apply pagination to filtered results
          const startIndex = (currentPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          filteredData = allFilteredData.slice(startIndex, endIndex);
          
          console.log('Page filtered data count:', filteredData.length);
          
          totalFiltered = allFilteredData.length;
          totalPagesFiltered = Math.ceil(allFilteredData.length / itemsPerPage);
        }
        
        setEntries(filteredData);
        setTotalCount(totalFiltered);
        setTotalPages(totalPagesFiltered);
      } else {
        console.error('Failed to fetch entries');
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
    } finally {
      setLoading(false);
      setSortLoading(false);
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
      {/* Performance indicator and filters */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
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
        </div>

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
            fetchData={fetchAllDataForExport}
            dataTransform={(allEntries: WeatherEntry[]) => allEntries.map((entry: WeatherEntry) => ({
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
                }`} onClick={() => handleSort('windRun')}>
                  <div className="flex items-center justify-center gap-1">
                    Average Wind Speed Over 6 Minutes (m/s)
                    {sortField === 'windRun' && (
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
            </tr>
          </thead>
          <tbody className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-800'} ${sortLoading ? 'opacity-50' : ''}`}>
            {sortLoading && (
              <tr>
                <td colSpan={16} className="text-center py-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3EC1C5]"></div>
                    <span>Sorting...</span>
                  </div>
                </td>
              </tr>
            )}
            {!sortLoading && entries.length === 0 ? (
              <tr>
                <td colSpan={8} className={`px-3 py-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {loading ? 'Loading...' : 'No entries found'}
                </td>
              </tr>
            ) : (
              !sortLoading && entries.map((entry: WeatherEntry, index) => (
                <tr key={entry._id} className={`border-t transition ${
                  isDark ? 'border-gray-700 hover:bg-gray-700/30' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className={`px-3 py-2 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {((currentPage - 1) * itemsPerPage) + index + 1}
                  </td>
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
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} entries
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
              <option value={totalCount}>Show All ({totalCount})</option>
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
    </div>
  );
}


