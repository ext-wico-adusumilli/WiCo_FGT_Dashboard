import { useState, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceArea,
} from 'recharts';
import { formatDateDisplay } from '../../utils/dateUtils';
import { useTheme } from '../../contexts/ThemeContext';

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
  maxGust: number | null;
  lowWindChill: number | null;
  thwIndex: number | null;
  wetBulb: number | null;
  windChill: number | null;
  windRun: number | null;
}

type ChartGroupBy = 'logs' | 'date' | 'sn';

interface WeatherBarChartProps {
  entries: WeatherEntry[];
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
}

export function WeatherBarChart({ 
  entries,
  selectedUASNs = [],
  selectedLocations = [],
  dateRange = { start: null, end: null }
}: WeatherBarChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [chartGroupBy, setChartGroupBy] = useState<ChartGroupBy>('sn'); // Default to SN for better performance
  const [visibleMetrics, setVisibleMetrics] = useState({
    pressure: true,
    humidity: true,
    temperature: true,
  });
  
  // Zoom and pan state
  const [refAreaLeft, setRefAreaLeft] = useState<string | number>('');
  const [refAreaRight, setRefAreaRight] = useState<string | number>('');
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  const zoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === '') {
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    const leftIndex = chartData.findIndex(d => d.label === refAreaLeft);
    const rightIndex = chartData.findIndex(d => d.label === refAreaRight);

    if (leftIndex === -1 || rightIndex === -1) {
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    const start = Math.min(leftIndex, rightIndex);
    const end = Math.max(leftIndex, rightIndex);

    setStartIndex(start);
    setEndIndex(end);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const resetZoom = () => {
    setStartIndex(0);
    setEndIndex(0);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  // Reset zoom when grouping changes to prevent NaN errors
  useMemo(() => {
    resetZoom();
  }, [chartGroupBy]);

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

  // Filter entries by UA SN, location, and date range
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // UA SN filter (multi-select)
      const matchesUASN = selectedUASNs.length === 0 || selectedUASNs.includes(entry.uaSN);
      
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
      
      return matchesUASN && matchesLocation && matchesDate;
    });
  }, [entries, selectedUASNs, selectedLocations, dateRange]);

  // Calculate actual date range from filtered data
  const actualDateRange = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) {
      return { start: null, end: null };
    }

    const dates = filteredEntries
      .map(entry => extractDateFromFlightLog(entry.flightLog))
      .filter(date => date !== 'Unknown')
      .sort();

    if (dates.length === 0) {
      return { start: null, end: null };
    }

    return {
      start: dates[0],
      end: dates[dates.length - 1]
    };
  }, [filteredEntries]);

  // Memoize chart data calculation for performance
  const chartData = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) {
      return [];
    }

    if (chartGroupBy === 'sn') {
      // Group by UA SN and calculate averages (FASTEST - fewer data points)
      const groupedBySN = filteredEntries.reduce((acc, entry) => {
        const sn = entry.uaSN;
        
        if (!acc[sn]) {
          acc[sn] = {
            sn,
            pressureValues: [],
            humidityValues: [],
            temperatureValues: [],
          };
        }
        
        if (entry.pressure !== null && !isNaN(entry.pressure)) acc[sn].pressureValues.push(entry.pressure);
        if (entry.humidity !== null && !isNaN(entry.humidity)) acc[sn].humidityValues.push(entry.humidity);
        if (entry.temperature !== null && !isNaN(entry.temperature)) acc[sn].temperatureValues.push(entry.temperature);
        
        return acc;
      }, {} as Record<string, { sn: string; pressureValues: number[]; humidityValues: number[]; temperatureValues: number[] }>);

      return Object.values(groupedBySN)
        .map(group => ({
          label: group.sn,
          fullLabel: `UA SN: ${group.sn}`,
          pressure: group.pressureValues.length > 0
            ? group.pressureValues.reduce((sum, v) => sum + v, 0) / group.pressureValues.length
            : 0,
          humidity: group.humidityValues.length > 0
            ? group.humidityValues.reduce((sum, v) => sum + v, 0) / group.humidityValues.length
            : 0,
          temperature: group.temperatureValues.length > 0
            ? group.temperatureValues.reduce((sum, v) => sum + v, 0) / group.temperatureValues.length
            : 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else if (chartGroupBy === 'date') {
      // Group by date and calculate averages (MEDIUM - moderate data points)
      const groupedByDate = filteredEntries.reduce((acc, entry) => {
        const date = extractDateFromFlightLog(entry.flightLog);
        
        if (!acc[date]) {
          acc[date] = {
            date,
            pressureValues: [],
            humidityValues: [],
            temperatureValues: [],
          };
        }
        
        if (entry.pressure !== null && !isNaN(entry.pressure)) acc[date].pressureValues.push(entry.pressure);
        if (entry.humidity !== null && !isNaN(entry.humidity)) acc[date].humidityValues.push(entry.humidity);
        if (entry.temperature !== null && !isNaN(entry.temperature)) acc[date].temperatureValues.push(entry.temperature);
        
        return acc;
      }, {} as Record<string, { date: string; pressureValues: number[]; humidityValues: number[]; temperatureValues: number[] }>);

      return Object.values(groupedByDate)
        .map(group => ({
          label: group.date,
          fullLabel: group.date,
          pressure: group.pressureValues.length > 0
            ? group.pressureValues.reduce((sum, v) => sum + v, 0) / group.pressureValues.length
            : 0,
          humidity: group.humidityValues.length > 0
            ? group.humidityValues.reduce((sum, v) => sum + v, 0) / group.humidityValues.length
            : 0,
          temperature: group.temperatureValues.length > 0
            ? group.temperatureValues.reduce((sum, v) => sum + v, 0) / group.temperatureValues.length
            : 0,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    } else {
      // Group by individual flight logs (SLOWEST - most data points)
      return filteredEntries.map(entry => ({
        label: entry.flightLog.substring(0, 20) + '...',
        fullLabel: entry.flightLog,
        pressure: entry.pressure ?? 0,
        humidity: entry.humidity ?? 0,
        temperature: entry.temperature ?? 0,
      })).reverse();
    }
  }, [filteredEntries, chartGroupBy]);

  // Show empty state if no data
  if (!chartData || chartData.length === 0) {
    return (
      <div className={`border rounded-lg p-3 sm:p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
        <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          No weather data available to display
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 sm:p-4 space-y-4 ${isDark ? 'bg-gray-800 border-gray-700 custom-select-dark' : 'bg-white border-gray-300 custom-select-light'}`}>
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        {/* Group By Toggle */}
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Group by:</span>
          <div className={`flex gap-1 rounded-md p-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
          <button
            onClick={() => setChartGroupBy('sn')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              chartGroupBy === 'sn'
                ? isDark ? 'bg-[#3EC1C5] text-white' : 'bg-gray-900 text-white'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            UA SN
          </button>
          <button
            onClick={() => setChartGroupBy('date')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              chartGroupBy === 'date'
                ? isDark ? 'bg-[#3EC1C5] text-white' : 'bg-gray-900 text-white'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Date
          </button>
          <button
            onClick={() => setChartGroupBy('logs')}
            className={`px-3 py-1 text-xs font-medium rounded transition ${
              chartGroupBy === 'logs'
                ? isDark ? 'bg-[#3EC1C5] text-white' : 'bg-gray-900 text-white'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Flight Logs
          </button>
        </div>
        </div>

        {/* Date Range Display */}
        <div className="flex-1"></div>
        {actualDateRange.start && actualDateRange.end && (
          <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>Date Range:</span>
            <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'} font-medium`}>
              {actualDateRange.start === actualDateRange.end
                ? formatDateDisplay(actualDateRange.start)
                : `${formatDateDisplay(actualDateRange.start)} to ${formatDateDisplay(actualDateRange.end)}`
              }
            </span>
          </div>
        )}
      </div>

      {/* Metric Visibility Toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Show metrics:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setVisibleMetrics(prev => ({ ...prev, pressure: !prev.pressure }))}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition ${
              visibleMetrics.pressure
                ? isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-purple-100 text-purple-700 border border-purple-200'
                : isDark ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <div className={`w-3 h-3 rounded ${visibleMetrics.pressure ? 'bg-purple-500' : isDark ? 'bg-gray-500' : 'bg-gray-400'}`}></div>
            Pressure
          </button>
          <button
            onClick={() => setVisibleMetrics(prev => ({ ...prev, humidity: !prev.humidity }))}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition ${
              visibleMetrics.humidity
                ? isDark ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-blue-100 text-blue-700 border border-blue-200'
                : isDark ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <div className={`w-3 h-3 rounded ${visibleMetrics.humidity ? 'bg-blue-500' : isDark ? 'bg-gray-500' : 'bg-gray-400'}`}></div>
            Humidity
          </button>
          <button
            onClick={() => setVisibleMetrics(prev => ({ ...prev, temperature: !prev.temperature }))}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition ${
              visibleMetrics.temperature
                ? isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-orange-100 text-orange-700 border border-orange-200'
                : isDark ? 'bg-gray-700 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            <div className={`w-3 h-3 rounded ${visibleMetrics.temperature ? 'bg-orange-500' : isDark ? 'bg-gray-500' : 'bg-gray-400'}`}></div>
            Temperature
          </button>
        </div>
      </div>

      {/* Combined Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Weather Data by {chartGroupBy === 'logs' ? 'Flight Log' : chartGroupBy === 'date' ? 'Date' : 'UA SN'}
          </h3>
          {(startIndex !== 0 || endIndex !== 0) && (
            <button
              onClick={resetZoom}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              Reset Zoom
            </button>
          )}
        </div>
        <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Tip: Click and drag on the chart to zoom in. Use the brush below to pan.
        </div>
        <ResponsiveContainer width="100%" height={400} key={chartGroupBy}>
          <BarChart 
            data={chartData}
            onMouseDown={(e: any) => e && e.activeLabel && setRefAreaLeft(e.activeLabel)}
            onMouseMove={(e: any) => refAreaLeft && e && e.activeLabel && setRefAreaRight(e.activeLabel)}
            onMouseUp={zoom}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
            <XAxis 
              dataKey="label" 
              stroke={isDark ? '#9CA3AF' : '#4B5563'}
              tick={{ fill: isDark ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            {(visibleMetrics.pressure || visibleMetrics.humidity) && (
              <YAxis 
                yAxisId="left"
                stroke={isDark ? '#9CA3AF' : '#4B5563'}
                tick={{ fill: isDark ? '#9CA3AF' : '#4B5563', fontSize: 12 }}
                // label={{ value: 'Pressure (hPa) / Humidity (%)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
            )}
            {visibleMetrics.temperature && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke={isDark ? '#9CA3AF' : '#4B5563'}
                tick={{ fill: isDark ? '#9CA3AF' : '#4B5563', fontSize: 12 }}
                // label={{ value: 'Temperature (°C)', angle: 90, position: 'insideRight', fill: '#9CA3AF' }}
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                border: `1px solid ${isDark ? '#374151' : '#E5E7EB'}`,
                borderRadius: '0.5rem',
                color: isDark ? '#F3F4F6' : '#111827',
              }}
              formatter={(value: number, name: string) => {
                // Show "Mean" prefix for aggregated data (SN and Date)
                const isAggregated = chartGroupBy === 'sn' || chartGroupBy === 'date';
                const prefix = isAggregated ? 'Mean ' : '';
                
                if (name === 'Pressure') return [value?.toFixed(2) + ' hPa', prefix + 'Pressure'];
                if (name === 'Humidity') return [value?.toFixed(1) + '%', prefix + 'Humidity'];
                if (name === 'Temperature') return [value?.toFixed(1) + '°C', prefix + 'Temperature'];
                return [value, name];
              }}
              labelFormatter={(label) => chartData.find(d => d.label === label)?.fullLabel || label}
            />
            {chartData.length > 1 && chartData.every(d => d.label) && (
              <Brush
                dataKey="label"
                height={30}
                stroke="#3EC1C5"
                fill={isDark ? '#1F2937' : '#F3F4F6'}
                startIndex={Math.min(startIndex || 0, chartData.length - 1)}
                endIndex={Math.min(endIndex > 0 ? endIndex : chartData.length - 1, chartData.length - 1)}
                onChange={(e: any) => {
                  if (e && typeof e.startIndex === 'number' && typeof e.endIndex === 'number') {
                    setStartIndex(Math.max(0, e.startIndex));
                    setEndIndex(Math.min(e.endIndex, chartData.length - 1));
                  }
                }}
              />
            )}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                yAxisId="left"
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="#3EC1C5"
                fillOpacity={0.3}
              />
            )}
            {visibleMetrics.pressure && <Bar yAxisId="left" dataKey="pressure" fill="#A78BFA" name="Pressure" />}
            {visibleMetrics.humidity && <Bar yAxisId="left" dataKey="humidity" fill="#60A5FA" name="Humidity" />}
            {visibleMetrics.temperature && <Bar yAxisId="right" dataKey="temperature" fill="#FB923C" name="Temperature" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

