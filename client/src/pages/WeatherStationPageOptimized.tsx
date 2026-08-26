import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { WeatherDashboardOptimized } from '../components/weather-station/WeatherDashboardOptimized';
import { WeatherDataTableOptimized } from '../components/weather-station/WeatherDataTableOptimized';
import { WeatherFlightHoursChartsOptimizedV2 } from '../components/weather-station/WeatherFlightHoursChartsOptimizedV2';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';

interface FilterOptions {
  uaSNs: string[];
  locations: string[];
  source?: string;
}

export function WeatherStationPageOptimized() {
  const [selectedUASNs, setSelectedUASNs] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    uaSNs: [],
    locations: []
  });
  const [weatherFilter, setWeatherFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null>(null);
  
  // Expanded metric state for dashboard charts
  const [expandedMetric, setExpandedMetric] = useState<'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | 'gust' | null>(null);

  // Chart preloading state
  const [preloadedChartData, setPreloadedChartData] = useState<Record<string, any[]>>({});
  const [preloadingStatus, setPreloadingStatus] = useState<'idle' | 'loading' | 'complete' | 'error'>('idle');

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Preload chart data when filters change
  useEffect(() => {
    preloadAllChartData();
  }, [selectedUASNs, selectedLocations, dateRange]);

  const fetchFilterOptions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/weather-data/filter-options`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Background preloading of all chart data
  const preloadAllChartData = async () => {
    // console.log('🔄 Starting background chart data preloading...');
    setPreloadingStatus('loading');
    
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
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

      const startTime = performance.now();
      const response = await fetch(
        `${API_BASE_URL}/weather-data/chart-data/bulk?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        const endTime = performance.now();
        const loadTime = Math.round(endTime - startTime);
        
        // console.log(`⚡ BULK CHART PRELOADING COMPLETE in ${loadTime}ms`);
        // console.log('📊 Preloaded metrics:', Object.keys(result.data));
        // console.log('📊 Total ranges preloaded:', Object.values(result.data).reduce((sum: number, data: any) => sum + data.length, 0));
        
        setPreloadedChartData(result.data);
        setPreloadingStatus('complete');
      } else {
        console.error('Failed to preload chart data');
        setPreloadingStatus('error');
      }
    } catch (error) {
      console.error('Error preloading chart data:', error);
      setPreloadingStatus('error');
    }
  };

  // Prepare filter options for MultiSelect
  const uasnOptions = useMemo(() => 
    filterOptions.uaSNs.map(sn => ({ value: sn, label: sn }))
  , [filterOptions.uaSNs]);

  const locationOptions = useMemo(() => 
    filterOptions.locations.map(loc => ({ value: loc, label: loc }))
  , [filterOptions.locations]);

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 w-full custom-select-dark">
      {/* Global Filters */}
      <div className="space-y-1.5 sm:space-y-2">
        <span className="text-xs text-gray-400">Filters:</span>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-2">
          <div className="w-full sm:w-48">
            <MultiSelect
              value={selectedUASNs}
              onChange={setSelectedUASNs}
              options={uasnOptions}
              placeholder="All UA SNs"
            />
          </div>
          <div className="w-full sm:w-48">
            <MultiSelect
              value={selectedLocations}
              onChange={setSelectedLocations}
              options={locationOptions}
              placeholder="All Locations"
            />
          </div>
          <div className="w-full sm:w-48">
            <DateRangePicker
              key={`${dateRange.start}-${dateRange.end}`}
              onApply={(start, end) => setDateRange({ start, end })}
              onCancel={() => {}}
              initialStart={dateRange.start}
              initialEnd={dateRange.end}
            />
          </div>
          {(selectedUASNs.length > 0 || selectedLocations.length > 0 || dateRange.start !== null) && (
            <button
              onClick={() => {
                setSelectedUASNs([]);
                setSelectedLocations([]);
                setDateRange({ start: null, end: null });
              }}
              className="flex items-center justify-center sm:justify-start gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition sm:mt-1"
            >
              <X className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Dashboard */}
      <WeatherDashboardOptimized 
        selectedUASNs={selectedUASNs} 
        selectedLocations={selectedLocations} 
        dateRange={dateRange}
        weatherFilter={weatherFilter}
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
      />

      {/* Optimized Charts - Show when metric is expanded */}
      {expandedMetric && (
        <WeatherFlightHoursChartsOptimizedV2
          selectedUASNs={selectedUASNs}
          selectedLocations={selectedLocations}
          dateRange={dateRange}
          onFilterChange={setWeatherFilter}
          expandedMetric={expandedMetric}
          preloadedChartData={preloadedChartData}
          preloadingStatus={preloadingStatus}
        />
      )}

      {/* Data Table */}
      <WeatherDataTableOptimized 
        selectedUASNs={selectedUASNs}
        selectedLocations={selectedLocations}
        dateRange={dateRange}
        weatherFilter={weatherFilter}
        onClearWeatherFilter={() => setWeatherFilter(null)}
      />
    </div>
  );
}


