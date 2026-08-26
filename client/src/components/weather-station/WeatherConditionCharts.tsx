import { useMemo } from 'react';
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
  amslMaxWind: number | null;
  amsl: number | null;
  maxGust: number | null;
  lowWindChill: number | null;
  thwIndex: number | null;
  wetBulb: number | null;
  windChill: number | null;
  windRun: number | null;
}

interface WeatherConditionChartsProps {
  entries: WeatherEntry[];
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string } | null) => void;
  expandedMetric?: 'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | null;
}

export function WeatherConditionCharts({
  entries,
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null },
  onFilterChange,
  expandedMetric
}: WeatherConditionChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#9CA3AF' : '#4B5563';
  const gridColor = isDark ? '#374151' : '#E5E7EB';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#111827' : '#111827';
  
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

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesUASN = selectedUASNs.length === 0 || selectedUASNs.includes(normalizeSerialNumber(entry.uaSN));
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
  }, [entries, selectedUASNs, selectedLocations, dateRange]);

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
    // console.log('Weather Conditions Bar clicked - Full data:', JSON.stringify(data, null, 2));
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
        // Get the flight logs that match this weather condition
        const matchingFlightLogs = filteredEntries
          .filter(entry => {
            const value = type === 'temperature' ? entry.temperature :
                         type === 'humidity' ? entry.humidity :
                         type === 'pressure' ? entry.pressure :
                         type === 'densityAltitude' ? calculateDensityAltitude(entry) :
                         type === 'wind' ? entry.windRun :
                         type === 'rain' ? parseRainValue(entry.rain) : null;
            return value !== null && value >= payload.min && value < payload.max;
          })
          .map(entry => entry.flightLog);
        
        const filterData = {
          type,
          range: { min: payload.min, max: payload.max },
          label: payload.label,
          source: 'weatherConditions',
          matchingFlightLogs
        };
        console.log('✅ Setting weather filter:', filterData);
        onFilterChange(filterData);
      } else {
        console.log('❌ Payload missing min/max. Available keys:', Object.keys(payload || {}));
      }
    }
  };

  // Group data by ranges for each metric (5°C intervals)
  const temperatureData = useMemo(() => {
    const ranges = [
      { label: '0-5°C', min: 0, max: 5, count: 0 },
      { label: '5-10°C', min: 5, max: 10, count: 0 },
      { label: '10-15°C', min: 10, max: 15, count: 0 },
      { label: '15-20°C', min: 15, max: 20, count: 0 },
      { label: '20-25°C', min: 20, max: 25, count: 0 },
      { label: '25-30°C', min: 25, max: 30, count: 0 },
      { label: '30-35°C', min: 30, max: 35, count: 0 },
      { label: '35-40°C', min: 35, max: 40, count: 0 },
    ];

    filteredEntries.forEach(entry => {
      if (entry.temperature !== null && entry.temperature !== undefined) {
        const range = ranges.find(r => entry.temperature! >= r.min && entry.temperature! < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  const humidityData = useMemo(() => {
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = 0; i < 100; i += 5) {
      ranges.push({
        label: `${i}-${i + 5}%`,
        min: i,
        max: i + 5,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      if (entry.humidity !== null && entry.humidity !== undefined) {
        const range = ranges.find(r => entry.humidity! >= r.min && entry.humidity! < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  const pressureData = useMemo(() => {
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = 1006; i < 1032; i += 2) {
      ranges.push({
        label: `${i}-${i + 2} hPa`,
        min: i,
        max: i + 2,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      if (entry.pressure !== null && entry.pressure !== undefined) {
        const range = ranges.find(r => entry.pressure! >= r.min && entry.pressure! < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Group density altitude data by ranges (500 unit intervals)
  const densityAltitudeData = useMemo(() => {
    // Calculate density altitude for all entries and get the range
    const densityAltitudes = filteredEntries
      .map(entry => calculateDensityAltitude(entry))
      .filter(da => da !== null) as number[];
    
    if (densityAltitudes.length === 0) return [];
    
    const minDA = Math.floor(Math.min(...densityAltitudes) / 500) * 500;
    const maxDA = Math.ceil(Math.max(...densityAltitudes) / 500) * 500;
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = minDA; i < maxDA; i += 500) {
      ranges.push({
        label: `${i}-${i + 500}`,
        min: i,
        max: i + 500,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      const densityAltitude = calculateDensityAltitude(entry);
      if (densityAltitude !== null && densityAltitude !== undefined) {
        const range = ranges.find(r => densityAltitude >= r.min && densityAltitude < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Group wind speed data by ranges (1 m/s intervals)
  const windData = useMemo(() => {
    // Find the actual wind speed range in the data
    const windSpeeds = filteredEntries
      .map(e => e.windRun)
      .filter(w => w !== null && w !== undefined) as number[];
    
    if (windSpeeds.length === 0) return [];
    
    const minWind = Math.floor(Math.min(...windSpeeds));
    const maxWind = Math.ceil(Math.max(...windSpeeds));
    
    // Create dynamic ranges based on actual data
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = minWind; i < maxWind; i += 1) {
      ranges.push({
        label: `${i}-${i + 1} m/s`,
        min: i,
        max: i + 1,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      if (entry.windRun !== null && entry.windRun !== undefined) {
        const range = ranges.find(r => entry.windRun! >= r.min && entry.windRun! < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Group rain data by ranges (0.5 mm intervals)
  const rainData = useMemo(() => {
    // Find the actual rain range in the data
    const rainValues = filteredEntries
      .map(e => parseRainValue(e.rain))
      .filter(r => r !== null && r !== undefined) as number[];
    
    if (rainValues.length === 0) return [];
    
    const minRain = Math.floor(Math.min(...rainValues) * 2) / 2; // Round to nearest 0.5
    const maxRain = Math.ceil(Math.max(...rainValues) * 2) / 2;
    
    // Create dynamic ranges based on actual data (0.5 mm intervals)
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = minRain; i < maxRain; i += 0.5) {
      ranges.push({
        label: `${i.toFixed(1)}-${(i + 0.5).toFixed(1)} mm`,
        min: i,
        max: i + 0.5,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      const rainValue = parseRainValue(entry.rain);
      if (rainValue !== null && rainValue !== undefined) {
        const range = ranges.find(r => rainValue >= r.min && rainValue < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Calculate min/max values
  const stats = useMemo(() => {
    const temps = filteredEntries.map(e => e.temperature).filter(v => v !== null) as number[];
    const humids = filteredEntries.map(e => e.humidity).filter(v => v !== null) as number[];
    const pressures = filteredEntries.map(e => e.pressure).filter(v => v !== null) as number[];
    const densityAltitudes = filteredEntries.map(e => calculateDensityAltitude(e)).filter(v => v !== null) as number[];
    const windSpeeds = filteredEntries.map(e => e.windRun).filter(v => v !== null) as number[];
    const rainValues = filteredEntries.map(e => parseRainValue(e.rain)).filter(v => v !== null) as number[];

    return {
      temperature: {
        min: temps.length > 0 ? Math.min(...temps).toFixed(1) : 'N/A',
        max: temps.length > 0 ? Math.max(...temps).toFixed(1) : 'N/A',
      },
      humidity: {
        min: humids.length > 0 ? Math.min(...humids).toFixed(1) : 'N/A',
        max: humids.length > 0 ? Math.max(...humids).toFixed(1) : 'N/A',
      },
      pressure: {
        min: pressures.length > 0 ? Math.min(...pressures).toFixed(1) : 'N/A',
        max: pressures.length > 0 ? Math.max(...pressures).toFixed(1) : 'N/A',
      },
      densityAltitude: {
        min: densityAltitudes.length > 0 ? Math.min(...densityAltitudes).toFixed(0) : 'N/A',
        max: densityAltitudes.length > 0 ? Math.max(...densityAltitudes).toFixed(0) : 'N/A',
      },
      wind: {
        min: windSpeeds.length > 0 ? Math.min(...windSpeeds).toFixed(1) : 'N/A',
        max: windSpeeds.length > 0 ? Math.max(...windSpeeds).toFixed(1) : 'N/A',
      },
      rain: {
        min: rainValues.length > 0 ? Math.min(...rainValues).toFixed(1) : 'N/A',
        max: rainValues.length > 0 ? Math.max(...rainValues).toFixed(1) : 'N/A',
      },
    };
  }, [filteredEntries]);

  if (filteredEntries.length === 0) {
    return null; // Don't show anything if no data
  }

  // Determine which charts to show based on expandedMetric - only show when specifically selected
  const showTemperature = expandedMetric === 'temperature';
  const showHumidity = expandedMetric === 'humidity';
  const showPressure = expandedMetric === 'pressure';
  const showDensityAltitude = expandedMetric === 'densityAltitude';
  const showWind = expandedMetric === 'wind';
  const showRain = expandedMetric === 'rain';

  // Don't show anything if no metric is selected
  if (!expandedMetric) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Weather Conditions Analysis</h3>
      
      <div className={`grid grid-cols-1 gap-4 ${expandedMetric ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Temperature Chart */}
        {showTemperature && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Temperature Distribution | Min: {stats.temperature.min}°C | Max: {stats.temperature.max}°C
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={temperatureData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(251, 146, 60, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#FB923C" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'temperature')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Humidity Chart */}
        {showHumidity && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Humidity Distribution | Min: {stats.humidity.min}% | Max: {stats.humidity.max}%
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={humidityData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(96, 165, 250, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#60A5FA" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'humidity')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Pressure Chart */}
        {showPressure && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Pressure Distribution | Min: {stats.pressure.min} hPa | Max: {stats.pressure.max} hPa
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={pressureData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(167, 139, 250, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#A78BFA" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'pressure')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Density Altitude Chart */}
        {showDensityAltitude && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Density Altitude Distribution | Min: {stats.densityAltitude.min} | Max: {stats.densityAltitude.max}
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={densityAltitudeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(34, 197, 94, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#22C55E" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'densityAltitude')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Wind Speed Chart */}
        {showWind && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Maximum Wind Speed Distribution | Min: {stats.wind.min} m/s | Max: {stats.wind.max} m/s
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={windData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(239, 68, 68, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#EF4444" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'wind')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Rain Chart */}
        {showRain && (
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Rain Distribution | Min: {stats.rain.min} mm | Max: {stats.rain.max} mm
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rainData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis 
                dataKey="label" 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
              />
              <YAxis 
                stroke={axisColor}
                tick={{ fill: axisColor, fontSize: 11 }}
                label={{ value: 'Flight Count', angle: -90, position: 'insideLeft', fill: axisColor }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.5rem',
                  color: tooltipText,
                }}
                cursor={{ fill: 'rgba(6, 182, 212, 0.2)' }}
              />
              <Bar 
                dataKey="count" 
                fill="#06B6D4" 
                name="Flights" 
                cursor="pointer"
                onClick={(data) => handleBarClick(data, 'rain')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  );
}

