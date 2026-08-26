import { API_BASE_URL } from '../../config/api';
import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { normalizeSerialNumber } from '../../utils/serialNumberUtils';
import { useTheme } from '../../contexts/ThemeContext';
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

interface WeatherFlightHoursChartsProps {
  weatherEntries: WeatherEntry[];
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string } | null) => void;
  expandedMetric?: 'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | 'gust' | null;
}

export function WeatherFlightHoursCharts({
  weatherEntries,
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null },
  onFilterChange,
  expandedMetric
}: WeatherFlightHoursChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#9CA3AF' : '#4B5563';
  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#F3F4F6' : '#111827';
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);



  // Parse rain string to number (convert "0,2" to 0.2)
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

  const handleBarClick = (data: any, type: string) => {
    console.log('Flight Hours Bar clicked - Full data:', JSON.stringify(data, null, 2));
    if (onFilterChange && data) {
      // Try multiple ways to access the payload
      let payload = data;
      
      // If data has activePayload (from tooltip/hover)
      if (data.activePayload && data.activePayload.length > 0) {
        payload = data.activePayload[0].payload;
      }
      // If data has payload directly
      else if (data.payload) {
        payload = data.payload;
      }
      
      console.log('Extracted payload:', payload);
      console.log('Payload properties - min:', payload?.min, 'max:', payload?.max, 'label:', payload?.label);
      
      if (payload && payload.min !== undefined && payload.max !== undefined) {
        // Get the flight logs that match this weather condition AND have flight hours
        const matchingFlightLogs = mergedData
          .filter(entry => {
            const value = type === 'temperature' ? entry.temperature :
                         type === 'humidity' ? entry.humidity :
                         type === 'pressure' ? entry.pressure :
                         type === 'densityAltitude' ? calculateDensityAltitude(entry) :
                         type === 'wind' ? entry.windRun :
                         type === 'rain' ? parseRainValue(entry.rain) :
                         type === 'cloud' ? entry.cloud :
                         type === 'gust' ? entry.maxGust : null;
            return value !== null && value >= payload.min && value < payload.max;
          })
          .map(entry => entry.flightLog);
        
        const filterData = {
          type,
          range: { min: payload.min, max: payload.max },
          label: payload.label,
          source: 'flightHours',
          matchingFlightLogs
        };
        console.log('✅ Setting weather filter with flight logs:', filterData);
        onFilterChange(filterData);
      } else {
        console.log('❌ Payload missing min/max. Available keys:', Object.keys(payload || {}));
      }
    }
  };

  // Fetch log details data
  useEffect(() => {
    const fetchLogDetails = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const BATCH_SIZE = 2000; // Match table batch size
        let allEntries: LogEntry[] = [];
        let currentBatch = 1;
        let hasMoreData = true;

        // Load all data in batches to match table behavior
        while (hasMoreData) {
          const response = await fetch(
            `${API_BASE_URL}/weather-data/log-details?limit=${BATCH_SIZE}&page=${currentBatch}`,
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
        
        setLogEntries(allEntries);
      } catch (error) {
        console.error('Error fetching log details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogDetails();
  }, []);

  // Extract date from flight log filename
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

  // Filter weather entries
  const filteredWeatherEntries = useMemo(() => {
    return weatherEntries.filter(entry => {
      const matchesUASN = selectedUASNs.length === 0 || selectedUASNs.includes(entry.uaSN);
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

  // Merge weather and log data, then group by ranges
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

  // Calculate stats for merged data
  const stats = useMemo(() => {
    const temps = mergedData.map(e => e.temperature).filter(v => v !== null) as number[];
    const humids = mergedData.map(e => e.humidity).filter(v => v !== null) as number[];
    const pressures = mergedData.map(e => e.pressure).filter(v => v !== null) as number[];
    const densityAltitudes = mergedData.map(e => e.densityAltitude).filter(v => v !== null) as number[];
    const windSpeeds = mergedData.map(e => e.windRun).filter(v => v !== null) as number[];
    const rainValues = mergedData.map(e => parseRainValue(e.rain)).filter(v => v !== null) as number[];
    const cloudValues = mergedData.map(e => e.cloud).filter(v => v !== null) as number[];
    const gustValues = mergedData.map(e => e.maxGust).filter(v => v !== null) as number[];

    return {
      temperature: {
        min: temps.length > 0 ? Math.min(...temps).toFixed(1) : 'N/A',
        max: temps.length > 0 ? Math.max(...temps).toFixed(1) : 'N/A',
        avg: temps.length > 0 ? (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1) : 'N/A',
      },
      humidity: {
        min: humids.length > 0 ? Math.min(...humids).toFixed(1) : 'N/A',
        max: humids.length > 0 ? Math.max(...humids).toFixed(1) : 'N/A',
        avg: humids.length > 0 ? (humids.reduce((sum, h) => sum + h, 0) / humids.length).toFixed(1) : 'N/A',
      },
      pressure: {
        min: pressures.length > 0 ? Math.min(...pressures).toFixed(1) : 'N/A',
        max: pressures.length > 0 ? Math.max(...pressures).toFixed(1) : 'N/A',
        avg: pressures.length > 0 ? (pressures.reduce((sum, p) => sum + p, 0) / pressures.length).toFixed(1) : 'N/A',
      },
      densityAltitude: {
        min: densityAltitudes.length > 0 ? Math.min(...densityAltitudes).toFixed(0) : 'N/A',
        max: densityAltitudes.length > 0 ? Math.max(...densityAltitudes).toFixed(0) : 'N/A',
        avg: densityAltitudes.length > 0 ? (densityAltitudes.reduce((sum, d) => sum + d, 0) / densityAltitudes.length).toFixed(0) : 'N/A',
      },
      wind: {
        min: windSpeeds.length > 0 ? Math.min(...windSpeeds).toFixed(1) : 'N/A',
        max: windSpeeds.length > 0 ? Math.max(...windSpeeds).toFixed(1) : 'N/A',
        avg: windSpeeds.length > 0 ? (windSpeeds.reduce((sum, w) => sum + w, 0) / windSpeeds.length).toFixed(1) : 'N/A',
      },
      rain: {
        min: rainValues.length > 0 ? Math.min(...rainValues).toFixed(1) : 'N/A',
        max: rainValues.length > 0 ? Math.max(...rainValues).toFixed(1) : 'N/A',
        avg: rainValues.length > 0 ? (rainValues.reduce((sum, r) => sum + r, 0) / rainValues.length).toFixed(1) : 'N/A',
      },
      cloud: {
        min: cloudValues.length > 0 ? Math.min(...cloudValues).toFixed(1) : 'N/A',
        max: cloudValues.length > 0 ? Math.max(...cloudValues).toFixed(1) : 'N/A',
        avg: cloudValues.length > 0 ? (cloudValues.reduce((sum, c) => sum + c, 0) / cloudValues.length).toFixed(1) : 'N/A',
      },
      gust: {
        min: gustValues.length > 0 ? Math.min(...gustValues).toFixed(1) : 'N/A',
        max: gustValues.length > 0 ? Math.max(...gustValues).toFixed(1) : 'N/A',
        avg: gustValues.length > 0 ? (gustValues.reduce((sum, g) => sum + g, 0) / gustValues.length).toFixed(1) : 'N/A',
      },
    };
  }, [mergedData]);

  // Group flight hours by temperature ranges (5°C intervals)
  const temperatureHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by humidity ranges (5% intervals)
  const humidityHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by pressure ranges (2 hPa intervals for 1006-1032 range)
  const pressureHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by density altitude ranges (500 intervals)
  const densityAltitudeHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by wind speed ranges (1 m/s intervals)
  const windHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by rain ranges (0.5 mm intervals)
  const rainHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by cloud ranges (5% intervals)
  const cloudHoursData = useMemo(() => {
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
  }, [mergedData]);

  // Group flight hours by gust ranges (1 m/s intervals)
  const gustHoursData = useMemo(() => {
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
  }, [mergedData]);

  if (loading) {
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

  if (mergedData.length === 0) {
    return null; // Don't show anything if no data
  }

  // Determine which charts to show based on expandedMetric - only show when specifically selected
  const showTemperature = expandedMetric === 'temperature';
  const showHumidity = expandedMetric === 'humidity';
  const showPressure = expandedMetric === 'pressure';
  const showDensityAltitude = expandedMetric === 'densityAltitude';
  const showWind = expandedMetric === 'wind';
  const showRain = expandedMetric === 'rain';
  const showCloud = expandedMetric === 'cloud';
  const showGust = expandedMetric === 'gust';

  // Don't show anything if no metric is selected
  if (!expandedMetric) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Flight Hours vs Weather Conditions</h3>
      
      <div className={`grid grid-cols-1 gap-4 ${expandedMetric ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Temperature vs Flight Hours */}
        {showTemperature && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Temperature | Min: {stats.temperature.min}°C | Max: {stats.temperature.max}°C
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={temperatureHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={temperatureHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(251, 146, 60, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#FB923C" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'temperature')}
                maxBarSize={temperatureHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Humidity vs Flight Hours */}
        {showHumidity && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Humidity | Min: {stats.humidity.min}% | Max: {stats.humidity.max}%
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={humidityHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={humidityHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(96, 165, 250, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#60A5FA" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'humidity')}
                maxBarSize={humidityHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Pressure vs Flight Hours */}
        {showPressure && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Pressure | Min: {stats.pressure.min} hPa | Max: {stats.pressure.max} hPa
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={pressureHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={pressureHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(167, 139, 250, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#A78BFA" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'pressure')}
                maxBarSize={pressureHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Density Altitude vs Flight Hours */}
        {showDensityAltitude && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Density Altitude | Min: {stats.densityAltitude.min} | Max: {stats.densityAltitude.max}
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={densityAltitudeHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={densityAltitudeHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(34, 197, 94, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#22C55E" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'densityAltitude')}
                maxBarSize={densityAltitudeHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Wind Speed vs Flight Hours */}
        {showWind && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Maximum Wind Speed | Min: {stats.wind.min} m/s | Max: {stats.wind.max} m/s
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={windHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={windHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(239, 68, 68, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#EF4444" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'wind')}
                maxBarSize={windHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Rain vs Flight Hours */}
        {showRain && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Rain | Min: {stats.rain.min} mm | Max: {stats.rain.max} mm
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={rainHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={rainHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(6, 182, 212, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#06B6D4" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'rain')}
                maxBarSize={rainHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Cloud vs Flight Hours */}
        {showCloud && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Cloud Coverage | Min: {stats.cloud.min}% | Max: {stats.cloud.max}%
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={cloudHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={cloudHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(156, 163, 175, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#9CA3AF" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'cloud')}
                maxBarSize={cloudHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Max Gust vs Flight Hours */}
        {showGust && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Flight Hours by Max Gust | Min: {stats.gust.min} m/s | Max: {stats.gust.max} m/s
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={gustHoursData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              barCategoryGap={gustHoursData.length === 1 ? '40%' : '20%'}
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
                cursor={{ fill: 'rgba(251, 191, 36, 0.2)' }}
              />
              <Bar 
                dataKey="hours" 
                fill="#FBB024" 
                name="Hours" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'gust')}
                maxBarSize={gustHoursData.length === 1 ? 100 : undefined}
                minPointSize={5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  );
}


