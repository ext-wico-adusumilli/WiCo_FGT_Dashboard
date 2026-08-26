import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { WeatherDashboard } from '../components/weather-station/WeatherDashboard';
import { WeatherBarChart } from '../components/weather-station/WeatherBarChart';
import { WeatherDataTable } from '../components/weather-station/WeatherDataTable';
import { WeatherConditionCharts } from '../components/weather-station/WeatherConditionCharts';
import { WeatherFlightHoursCharts } from '../components/weather-station/WeatherFlightHoursCharts';
import { MultiSelect } from '../components/MultiSelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { normalizeSerialNumber } from '../utils/serialNumberUtils';

interface WeatherEntry {
  _id: string;
  uaSN: string;
  location: string;
  flightLog: string;
  pressure: number | null;
  humidity: number | null;
  temperature: number | null;
  rain: string;
  amslMaxWind: number | null;
  maxGust: number | null;
  lowWindChill: number | null;
  thwIndex: number | null;
  wetBulb: number | null;
  windChill: number | null;
  windRun: number | null;
  cloud: number | null;
}

export function WeatherStationPage() {
  const [selectedUASNs, setSelectedUASNs] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ 
    start: null, 
    end: null 
  });
  const [entries, setEntries] = useState<WeatherEntry[]>([]);
  const [weatherFilter, setWeatherFilter] = useState<{ type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null>(null);
  
  // Visible sections state - Only Flight Hours visible by default
  const [visibleSections, setVisibleSections] = useState<string[]>([
    'flightHours'
  ]);
  
  // Expanded metric state for dashboard charts
  const [expandedMetric, setExpandedMetric] = useState<'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
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
          hasMoreData = false;
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching weather data:', error);
    }
  };

  // Get unique values for filters
  const uniqueUASNs = useMemo(() => {
    const sns = new Set(
      entries
        .map(e => normalizeSerialNumber(e.uaSN))
        .filter(s => s && s.trim() !== '')
    );
    return Array.from(sns).sort();
  }, [entries]);

  const uniqueLocations = useMemo(() => {
    const locations = new Set(entries.map(e => e.location).filter(l => l && l.trim() !== ''));
    return Array.from(locations).sort();
  }, [entries]);

  // Prepare filter options
  const uasnOptions = useMemo(() => 
    uniqueUASNs.map(sn => ({ value: sn, label: sn }))
  , [uniqueUASNs]);

  const locationOptions = useMemo(() => 
    uniqueLocations.map(loc => ({ value: loc, label: loc }))
  , [uniqueLocations]);

  // Section visibility options
  const sectionOptions = [
    { value: 'flightHours', label: 'Flight Hours vs Weather Conditions' },
    { value: 'weatherConditions', label: 'Weather Conditions Analysis' },
    { value: 'weatherDataBySN', label: 'Weather Data by UA SN' },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 w-full custom-select-dark">
      {/* Global Filters and Section Visibility */}
      <div className="flex flex-wrap items-start gap-2">
        <span className="text-xs text-gray-400 mt-1.5">Filters:</span>
        <div className="w-48">
          <MultiSelect
            value={selectedUASNs}
            onChange={setSelectedUASNs}
            options={uasnOptions}
            placeholder="All UA SNs"
          />
        </div>
        <div className="w-48">
          <MultiSelect
            value={selectedLocations}
            onChange={setSelectedLocations}
            options={locationOptions}
            placeholder="All Locations"
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
        {(selectedUASNs.length > 0 || selectedLocations.length > 0 || dateRange.start !== null) && (
          <button
            onClick={() => {
              setSelectedUASNs([]);
              setSelectedLocations([]);
              setDateRange({ start: null, end: null });
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white transition mt-1"
          >
            <X className="w-3 h-3" />
            Clear Filters
          </button>
        )}
        <div className="flex-1"></div>
        <span className="text-xs text-gray-400 mt-1.5">Show Sections:</span>
        <div className="w-64">
          <MultiSelect
            value={visibleSections}
            onChange={setVisibleSections}
            options={sectionOptions}
            placeholder="Select sections to display"
          />
        </div>
      </div>

      {/* Dashboard with Stats */}
      <WeatherDashboard 
        selectedUASNs={selectedUASNs}
        selectedLocations={selectedLocations}
        dateRange={dateRange}
        onMetricClick={setExpandedMetric}
        expandedMetric={expandedMetric}
      />

      {/* Flight Hours vs Weather Conditions */}
      {visibleSections.includes('flightHours') && (
        <WeatherFlightHoursCharts
          weatherEntries={entries}
          selectedUASNs={selectedUASNs}
          selectedLocations={selectedLocations}
          dateRange={dateRange}
          onFilterChange={setWeatherFilter}
          expandedMetric={expandedMetric}
        />
      )}

      {/* Weather Condition Analysis Charts */}
      {visibleSections.includes('weatherConditions') && (
        <WeatherConditionCharts
          entries={entries}
          selectedUASNs={selectedUASNs}
          selectedLocations={selectedLocations}
          dateRange={dateRange}
          onFilterChange={setWeatherFilter}
          expandedMetric={expandedMetric}
        />
      )}

      {/* Weather Data by UA SN Chart */}
      {visibleSections.includes('weatherDataBySN') && (
        <WeatherBarChart 
          entries={entries}
          selectedUASNs={selectedUASNs}
          selectedLocations={selectedLocations}
          dateRange={dateRange}
        />
      )}
      
      {/* Weather Data Table - Always visible */}
      <WeatherDataTable 
        selectedUASNs={selectedUASNs}
        selectedLocations={selectedLocations}
        dateRange={dateRange}
        weatherFilter={weatherFilter}
        onClearWeatherFilter={() => setWeatherFilter(null)}
      />
    </div>
  );
}


