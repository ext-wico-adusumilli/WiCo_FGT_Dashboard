import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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

interface WeatherChartsProps {
  entries: WeatherEntry[];
}

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

export function WeatherCharts({ entries }: WeatherChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300';
  const headingText = isDark ? 'text-white' : 'text-gray-900';
  const subText = isDark ? 'text-gray-400' : 'text-gray-600';
  const axisStroke = isDark ? '#9CA3AF' : '#4B5563';
  const gridStroke = isDark ? '#374151' : '#E5E7EB';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#0EA5E9' : '#111827';
  const legendColor = isDark ? '#9CA3AF' : '#4B5563';

  const chartData = useMemo(() => {
    // Group entries by date
    const groupedByDate = entries.reduce((acc, entry) => {
      const date = extractDateFromFlightLog(entry.flightLog);
      
      if (!acc[date]) {
        acc[date] = {
          date,
          pressureValues: [],
          humidityValues: [],
          temperatureValues: [],
        };
      }
      
      if (entry.pressure !== null) acc[date].pressureValues.push(entry.pressure);
      if (entry.humidity !== null) acc[date].humidityValues.push(entry.humidity);
      if (entry.temperature !== null) acc[date].temperatureValues.push(entry.temperature);
      
      return acc;
    }, {} as Record<string, { date: string; pressureValues: number[]; humidityValues: number[]; temperatureValues: number[] }>);

    // Calculate averages for each date
    return Object.values(groupedByDate)
      .map(group => ({
        date: group.date,
        pressure: group.pressureValues.length > 0
          ? group.pressureValues.reduce((sum, v) => sum + v, 0) / group.pressureValues.length
          : null,
        humidity: group.humidityValues.length > 0
          ? group.humidityValues.reduce((sum, v) => sum + v, 0) / group.humidityValues.length
          : null,
        temperature: group.temperatureValues.length > 0
          ? group.temperatureValues.reduce((sum, v) => sum + v, 0) / group.temperatureValues.length
          : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  if (chartData.length === 0) {
    return (
      <div className={`text-center py-8 ${subText}`}>
        No weather data available for charts
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pressure Chart */}
      <div className={`${cardBg} border rounded-lg p-4`}>
        <h3 className={`text-lg font-semibold mb-4 ${headingText}`}>Pressure by Date</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis 
              dataKey="date" 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
            />
            <YAxis 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
              label={{ value: 'Pressure (hPa)', angle: -90, position: 'insideLeft', fill: axisStroke }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '0.5rem',
                color: tooltipText,
              }}
              formatter={(value: number) => [value.toFixed(2) + ' hPa', 'Pressure']}
            />
            <Legend wrapperStyle={{ color: legendColor }} />
            <Bar dataKey="pressure" fill="#A78BFA" name="Pressure" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Humidity Chart */}
      <div className={`${cardBg} border rounded-lg p-4`}>
        <h3 className={`text-lg font-semibold mb-4 ${headingText}`}>Humidity by Date</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis 
              dataKey="date" 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
            />
            <YAxis 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
              label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fill: axisStroke }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '0.5rem',
                color: tooltipText,
              }}
              formatter={(value: number) => [value.toFixed(1) + '%', 'Humidity']}
            />
            <Legend wrapperStyle={{ color: legendColor }} />
            <Bar dataKey="humidity" fill="#60A5FA" name="Humidity" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Temperature Chart */}
      <div className={`${cardBg} border rounded-lg p-4`}>
        <h3 className={`text-lg font-semibold mb-4 ${headingText}`}>Temperature by Date</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
            <XAxis 
              dataKey="date" 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
            />
            <YAxis 
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 12 }}
              label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: axisStroke }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '0.5rem',
                color: tooltipText,
              }}
              formatter={(value: number) => [value.toFixed(1) + '°C', 'Temperature']}
            />
            <Legend wrapperStyle={{ color: legendColor }} />
            <Bar dataKey="temperature" fill="#FB923C" name="Temperature" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

