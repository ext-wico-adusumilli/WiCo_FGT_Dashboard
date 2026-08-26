import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { normalizeSerialNumber } from '../../utils/serialNumberUtils';
import { calculateDensityAltitude } from '../../utils/densityAltitudeUtils';

interface WeatherEntry {
  _id: string;
  pressure: number | null;
  humidity: number | null;
  rain: string;
  temperature: number | null;
  uaSN: string;
  flightLog: string;
  location: string;
  amsl: number | null;
  amslMaxWind: number | null;
  maxGust: number | null;
  lowWindChill: number | null;
  thwIndex: number | null;
  wetBulb: number | null;
  windChill: number | null;
  windRun: number | null;
  cloud: number | null;
}

interface LogEntry {
  key: string;
  sn: string;
  flight_time: number;
}

interface WeatherFlightHoursChartsOptimizedProps {
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null) => void;
  expandedMetric?: 'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | 'gust' | null;
}

export function WeatherFlightHoursChartsOptimized({
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null },
  onFilterChange,
  expandedMetric
}: WeatherFlightHoursChartsOptimizedProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [weatherEntries, setWeatherEntries] = useState<WeatherEntry[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse rain string to number (convert "0,2" to 0.2) - SAME AS ORIGINAL
  const parseRainValue = (rainStr: string): number | null => {
    if (!rainStr || rainStr.trim() === '') return null;
    try {
      // Replace comma with dot and parse as float
      const normalizedStr = rainStr.replace(',', '.');
      const value = parseFloat(normalizedStr);
      return isNaN(value) ? null : value;
    } catch {
      return null;
    }
  };

  // Extract date from flight log filename - SAME AS ORIGINAL
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

  // Fetch weather entries - SAME AS ORIGINAL
  useEffect(() => {
    const fetchWeatherEntries = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const BATCH_SIZE = 2000; // Match original batch size
        let allEntries: WeatherEntry[] = [];
        let currentBatch = 1;
        let hasMoreData = true;

        // Load all data in batches to match original behavior
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
        
        console.log('Fetched', allEntries.length, 'weather entries for optimized charts');
        setWeatherEntries(allEntries);
      } catch (error) {
        console.error('Error fetching weather data:', error);
        setError('Failed to fetch weather data');
      }
    };

    fetchWeatherEntries();
  }, []);

  // Fetch log details data - SAME AS ORIGINAL
  useEffect(() => {
    const fetchLogDetails = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const BATCH_SIZE = 2000; // Match original batch size
        let allEntries: LogEntry[] = [];
        let currentBatch = 1;
        let hasMoreData = true;

        // Load all data in batches to match original behavior
        while (hasMoreData) {
          const response = await fetch(
            `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=${currentBatch}`,
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
        
        console.log('Fetched', allEntries.length, 'log entries for optimized charts');
        setLogEntries(allEntries);
      } catch (error) {
        console.error('Error fetching log details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogDetails();
  }, []);

  // Filter weather entries - SAME AS ORIGINAL
  const filteredWeatherEntries = useMemo(() => {
    return weatherEntries.filter(entry => {
      const matchesUASN = selectedUASNs.length === 0 || selectedUASNs.some(selectedSN => 
        normalizeSerialNumber(selectedSN) === normalizeSerialNumber(entry.uaSN)
      );
      const matchesLocation = selectedLocations.length === 0 || selectedLocations.includes(entry.location);
      
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
      
      return matchesUASN && matchesLocation && matchesDate;
    });
  }, [weatherEntries, selectedUASNs, selectedLocations, dateRange]);

  // Merge weather and log data - SAME AS ORIGINAL
  const mergedData = useMemo(() => {
    return filteredWeatherEntries.map(weather => {
      // Find matching log entry by flight log name and SN (using normalized serial numbers)
      const logEntry = logEntries.find(log => 
        log.key === weather.flightLog && normalizeSerialNumber(log.sn) === normalizeSerialNumber(weather.uaSN)
      );
      
      return {
        ...weather,
        flightHours: logEntry ? logEntry.flight_time / 3600 : 0, // Convert seconds to hours
        densityAltitude: calculateDensityAltitude(weather)
      };
    }).filter(entry => entry.flightHours > 0); // Only include entries with flight time
  }, [filteredWeatherEntries, logEntries]);

  // Group flight hours by temperature ranges (5°C intervals) - SAME AS ORIGINAL
  const temperatureHoursData = useMemo(() => {
    if (expandedMetric !== 'temperature') return [];
    
    // Find the actual temperature range in the data
    const temps = mergedData
      .map(e => e.temperature)
      .filter(t => t !== null && t !== undefined) as number[];
    
    if (temps.length === 0) return [];
    
    const minTemp = Math.floor(Math.min(...temps) / 5) * 5;
    const maxTemp = Math.ceil(Math.max(...temps) / 5) * 5;
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = minTemp; i < maxTemp; i += 5) {
      ranges.push({
        label: `${i}-${i + 5}°C`,
        min: i,
        max: i + 5,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.temperature !== null && entry.temperature !== undefined) {
        const range = ranges.find(r => entry.temperature! >= r.min && entry.temperature! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by humidity ranges (5% intervals) - SAME AS ORIGINAL
  const humidityHoursData = useMemo(() => {
    if (expandedMetric !== 'humidity') return [];
    
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = 0; i < 100; i += 5) {
      ranges.push({
        label: `${i}-${i + 5}%`,
        min: i,
        max: i + 5,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.humidity !== null && entry.humidity !== undefined) {
        const range = ranges.find(r => entry.humidity! >= r.min && entry.humidity! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by pressure ranges (2 hPa intervals for 1006-1032 range) - SAME AS ORIGINAL
  const pressureHoursData = useMemo(() => {
    if (expandedMetric !== 'pressure') return [];
    
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = 1006; i < 1032; i += 2) {
      ranges.push({
        label: `${i}-${i + 2} hPa`,
        min: i,
        max: i + 2,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.pressure !== null && entry.pressure !== undefined) {
        const range = ranges.find(r => entry.pressure! >= r.min && entry.pressure! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by density altitude ranges (500 intervals) - SAME AS ORIGINAL
  const densityAltitudeHoursData = useMemo(() => {
    if (expandedMetric !== 'densityAltitude') return [];
    
    // Find the actual density altitude range in the data
    const densityAltitudes = mergedData
      .map(e => e.densityAltitude)
      .filter(d => d !== null && d !== undefined) as number[];
    
    if (densityAltitudes.length === 0) return [];
    
    const minDA = Math.floor(Math.min(...densityAltitudes) / 500) * 500;
    const maxDA = Math.ceil(Math.max(...densityAltitudes) / 500) * 500;
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = minDA; i < maxDA; i += 500) {
      ranges.push({
        label: `${i}-${i + 500}`,
        min: i,
        max: i + 500,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.densityAltitude !== null && entry.densityAltitude !== undefined) {
        const range = ranges.find(r => entry.densityAltitude! >= r.min && entry.densityAltitude! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by wind speed ranges (1 m/s intervals) - SAME AS ORIGINAL
  const windHoursData = useMemo(() => {
    if (expandedMetric !== 'wind') return [];
    
    // Find the actual wind speed range in the data
    const windSpeeds = mergedData
      .map(e => e.windRun)
      .filter(w => w !== null && w !== undefined) as number[];
    
    if (windSpeeds.length === 0) return [];
    
    const minWind = Math.floor(Math.min(...windSpeeds));
    const maxWind = Math.ceil(Math.max(...windSpeeds));
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = minWind; i < maxWind; i += 1) {
      ranges.push({
        label: `${i}-${i + 1} m/s`,
        min: i,
        max: i + 1,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.windRun !== null && entry.windRun !== undefined) {
        const range = ranges.find(r => entry.windRun! >= r.min && entry.windRun! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by rain ranges (0.5 mm intervals) - SAME AS ORIGINAL
  const rainHoursData = useMemo(() => {
    if (expandedMetric !== 'rain') return [];
    
    // Find the actual rain range in the data
    const rainValues = mergedData
      .map(e => parseRainValue(e.rain))
      .filter(r => r !== null && r !== undefined) as number[];
    
    if (rainValues.length === 0) return [];
    
    const minRain = Math.floor(Math.min(...rainValues) * 2) / 2; // Round to nearest 0.5
    const maxRain = Math.ceil(Math.max(...rainValues) * 2) / 2;
    
    // Create dynamic ranges based on actual data (0.5 mm intervals)
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = minRain; i < maxRain; i += 0.5) {
      ranges.push({
        label: `${i.toFixed(1)}-${(i + 0.5).toFixed(1)} mm`,
        min: i,
        max: i + 0.5,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      const rainValue = parseRainValue(entry.rain);
      if (rainValue !== null && rainValue !== undefined) {
        const range = ranges.find(r => rainValue >= r.min && rainValue < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by cloud ranges (5% intervals) - SAME AS ORIGINAL
  const cloudHoursData = useMemo(() => {
    if (expandedMetric !== 'cloud') return [];
    
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = 0; i < 100; i += 5) {
      ranges.push({
        label: `${i}-${i + 5}%`,
        min: i,
        max: i + 5,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.cloud !== null && entry.cloud !== undefined) {
        const range = ranges.find(r => entry.cloud! >= r.min && entry.cloud! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Group flight hours by gust ranges (1 m/s intervals) - SAME AS ORIGINAL
  const gustHoursData = useMemo(() => {
    if (expandedMetric !== 'gust') return [];
    
    // Find the actual gust range in the data
    const gustValues = mergedData
      .map(e => e.maxGust)
      .filter(g => g !== null && g !== undefined) as number[];
    
    if (gustValues.length === 0) return [];
    
    const minGust = Math.floor(Math.min(...gustValues));
    const maxGust = Math.ceil(Math.max(...gustValues));
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; hours: number }> = [];
    for (let i = minGust; i < maxGust; i += 1) {
      ranges.push({
        label: `${i}-${i + 1} m/s`,
        min: i,
        max: i + 1,
        hours: 0
      });
    }

    mergedData.forEach(entry => {
      if (entry.maxGust !== null && entry.maxGust !== undefined) {
        const range = ranges.find(r => entry.maxGust! >= r.min && entry.maxGust! < r.max);
        if (range) range.hours += entry.flightHours;
      }
    });

    return ranges.filter(r => r.hours > 0);
  }, [mergedData, expandedMetric]);

  // Get the appropriate chart data based on expanded metric
  const chartData = useMemo(() => {
    switch (expandedMetric) {
      case 'temperature': return temperatureHoursData;
      case 'humidity': return humidityHoursData;
      case 'pressure': return pressureHoursData;
      case 'densityAltitude': return densityAltitudeHoursData;
      case 'wind': return windHoursData;
      case 'rain': return rainHoursData;
      case 'cloud': return cloudHoursData;
      case 'gust': return gustHoursData;
      default: return [];
    }
  }, [expandedMetric, temperatureHoursData, humidityHoursData, pressureHoursData, densityAltitudeHoursData, windHoursData, rainHoursData, cloudHoursData, gustHoursData]);

  // Handle bar click - SAME AS ORIGINAL
  const handleBarClick = (data: any) => {
    // console.log('Bar clicked:', data);
    if (onFilterChange && expandedMetric && data) {
      // Handle different data structures from recharts
      let payload = data;
      if (data.activePayload && data.activePayload.length > 0) {
        payload = data.activePayload[0].payload;
      } else if (data.payload) {
        payload = data.payload;
      }
      
      // console.log('Bar click payload:', payload);
      
      if (payload && payload.min !== undefined && payload.max !== undefined) {
        // Get the flight logs that match this weather condition AND have flight hours
        const matchingFlightLogs = mergedData
          .filter(entry => {
            const value = expandedMetric === 'temperature' ? entry.temperature :
                         expandedMetric === 'humidity' ? entry.humidity :
                         expandedMetric === 'pressure' ? entry.pressure :
                         expandedMetric === 'densityAltitude' ? entry.densityAltitude :
                         expandedMetric === 'wind' ? entry.windRun :
                         expandedMetric === 'rain' ? parseRainValue(entry.rain) :
                         expandedMetric === 'cloud' ? entry.cloud :
                         expandedMetric === 'gust' ? entry.maxGust : null;
            return value !== null && value >= payload.min && value < payload.max;
          })
          .map(entry => entry.flightLog);
        
        const filter = {
          type: expandedMetric,
          range: { min: payload.min, max: payload.max },
          label: payload.label,
          source: 'flightHours',
          matchingFlightLogs
        };
        // console.log('Setting filter:', filter);
        onFilterChange(filter);
      }
    }
  };

  const metricLabels = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    pressure: 'Pressure',
    densityAltitude: 'Density Altitude',
    wind: 'Wind Speed',
    rain: 'Rain',
    cloud: 'Cloud Coverage',
    gust: 'Wind Gust'
  };

  const metricColors = {
    temperature: '#FB923C',
    humidity: '#60A5FA',
    pressure: '#A78BFA',
    densityAltitude: '#22C55E',
    wind: '#EF4444',
    rain: '#06B6D4',
    cloud: '#9CA3AF',
    gust: '#FBB024'
  };

  const axisColor = isDark ? '#9CA3AF' : '#4B5563';
  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#F3F4F6' : '#111827';

  // Show loading state while data is being fetched
  if (loading || weatherEntries.length === 0 || logEntries.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Flight Hours vs Weather Conditions
        </h3>
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          Loading flight data...
        </div>
      </div>
    );
  }

  // Don't show anything if no metric is selected
  if (!expandedMetric) {
    return null;
  }

  // Don't show anything if no merged data
  if (mergedData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Flight Hours vs Weather Conditions</h3>
      
      <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours vs Weather Conditions - {metricLabels[expandedMetric]}
          </h4>
          <div className="flex items-center gap-2">
            {chartData.length > 0 && (
              <div className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                {chartData.length} ranges
              </div>
            )}
          </div>
        </div>

        {error ? (
          <div className="h-64 flex items-center justify-center" style={{ minHeight: '256px' }}>
            <div className={`text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              <p>{error}</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center" style={{ minHeight: '256px' }}>
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <p>No chart data available</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          </div>
        ) : (
          <div className="w-full" style={{ height: '256px', minWidth: '400px', minHeight: '256px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={400} minHeight={256}>
              <BarChart 
                data={chartData} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                barCategoryGap={chartData.length === 1 ? '40%' : '20%'}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis 
                  dataKey="label" 
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                />
                <YAxis 
                  stroke={axisColor}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  label={{ value: 'Hours (log scale)', angle: -90, position: 'insideLeft', fill: axisColor }}
                  scale="log"
                  domain={[0.001, 'auto']}
                  allowDataOverflow={false}
                  tickFormatter={(value) => value >= 1 ? value.toFixed(0) : value.toFixed(2)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '0.5rem',
                    color: tooltipText,
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}h`, 'Flight Hours']}
                  cursor={{ fill: `${metricColors[expandedMetric]}33` }}
                />
                <Bar 
                  dataKey="hours" 
                  fill={metricColors[expandedMetric] || '#3EC1C5'}
                  name="Flight Hours" 
                  cursor="pointer"
                  onClick={handleBarClick}
                  maxBarSize={chartData.length === 1 ? 100 : undefined}
                  minPointSize={5}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Click on bars to filter the table by that range
        </div>
      </div>
    </div>
  );
}


