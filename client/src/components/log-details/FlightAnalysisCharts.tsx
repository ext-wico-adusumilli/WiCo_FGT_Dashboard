import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  flight: boolean;
}

interface FlightAnalysisChartsProps {
  entries: LogEntry[];
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  expandedMetric?: 'flightTime' | 'distance' | 'battery' | null;
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null) => void;
}

const COLORS = ['#3EC1C5', '#FB923C', '#60A5FA', '#A78BFA', '#F472B6', '#34D399'];

export function FlightAnalysisCharts({
  entries,
  selectedSNs = [],
  dateRange = { start: null, end: null },
  expandedMetric,
  onFilterChange
}: FlightAnalysisChartsProps) {
  const { theme } = useTheme();
  
  const handleBarClick = (data: any, type: string) => {
    if (onFilterChange && data) {
      let payload = data;
      
      if (data.activePayload && data.activePayload.length > 0) {
        payload = data.activePayload[0].payload;
      } else if (data.payload) {
        payload = data.payload;
      }
      
      if (payload && payload.min !== undefined && payload.max !== undefined) {
        // Get the keys that match this range
        const matchingKeys = filteredEntries
          .filter(entry => {
            const value = type === 'flightTime' ? entry.flight_time : entry.distance;
            return value >= payload.min && value < payload.max;
          })
          .map(entry => entry.key);
        
        const filterData = {
          type,
          range: { min: payload.min, max: payload.max },
          label: payload.label,
          source: 'flightAnalysis',
          matchingKeys
        };
        onFilterChange(filterData);
      }
    }
  };
  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSN = selectedSNs.length === 0 || selectedSNs.includes(entry.sn);
      
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = entry.date;
        if (dateRange.start && dateRange.end) {
          matchesDate = entryDate >= dateRange.start && entryDate <= dateRange.end;
        } else if (dateRange.start) {
          matchesDate = entryDate >= dateRange.start;
        } else if (dateRange.end) {
          matchesDate = entryDate <= dateRange.end;
        }
      }
      
      return matchesSN && matchesDate && entry.flight;
    });
  }, [entries, selectedSNs, dateRange]);

  // Flight Time Distribution (in minutes)
  const flightTimeData = useMemo(() => {
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = 0; i < 60; i += 5) {
      ranges.push({
        label: `${i}-${i + 5} min`,
        min: i * 60,
        max: (i + 5) * 60,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      if (entry.flight_time) {
        const range = ranges.find(r => entry.flight_time >= r.min && entry.flight_time < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Distance Distribution (in km)
  const distanceData = useMemo(() => {
    const ranges: Array<{ label: string; min: number; max: number; count: number }> = [];
    for (let i = 0; i < 100; i += 10) {
      ranges.push({
        label: `${i}-${i + 10} km`,
        min: i * 1000,
        max: (i + 10) * 1000,
        count: 0
      });
    }

    filteredEntries.forEach(entry => {
      if (entry.distance) {
        const range = ranges.find(r => entry.distance >= r.min && entry.distance < r.max);
        if (range) range.count++;
      }
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredEntries]);

  // Flights by SN
  const flightsBySN = useMemo(() => {
    const snMap = new Map<string, { flights: number; totalTime: number; totalDistance: number }>();
    
    filteredEntries.forEach(entry => {
      if (!snMap.has(entry.sn)) {
        snMap.set(entry.sn, { flights: 0, totalTime: 0, totalDistance: 0 });
      }
      const data = snMap.get(entry.sn)!;
      data.flights++;
      data.totalTime += entry.flight_time || 0;
      data.totalDistance += entry.distance || 0;
    });

    return Array.from(snMap.entries())
      .map(([sn, data]) => ({
        sn,
        flights: data.flights,
        totalTime: data.totalTime / 3600, // hours
        totalDistance: data.totalDistance / 1000, // km
      }))
      .sort((a, b) => b.flights - a.flights);
  }, [filteredEntries]);

  if (filteredEntries.length === 0) {
    return null;
  }

  const showFlightTime = !expandedMetric || expandedMetric === 'flightTime';
  const showDistance = !expandedMetric || expandedMetric === 'distance';

  return (
    <div className="space-y-4">
      <h3 className={`text-lg font-semibold ${
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      }`}>Flight Analysis</h3>
      
      <div className={`grid grid-cols-1 gap-4 ${expandedMetric ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
        {/* Flight Time Distribution */}
        {showFlightTime && (
          <div className={`border rounded-lg p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h4 className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Flight Time Distribution
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={flightTimeData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} 
                />
                <XAxis 
                  dataKey="label" 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Flight Count', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  cursor={{ fill: theme === 'dark' ? 'rgba(251, 146, 60, 0.2)' : 'rgba(107, 114, 128, 0.1)' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#FB923C" 
                  name="Flights" 
                  cursor="pointer"
                  onClick={(data) => handleBarClick(data, 'flightTime')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distance Distribution */}
        {showDistance && (
          <div className={`border rounded-lg p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h4 className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Distance Distribution
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distanceData}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} 
                />
                <XAxis 
                  dataKey="label" 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Flight Count', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  cursor={{ fill: theme === 'dark' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(107, 114, 128, 0.1)' }}
                />
                <Bar 
                  dataKey="count" 
                  fill="#60A5FA" 
                  name="Flights" 
                  cursor="pointer"
                  onClick={(data) => handleBarClick(data, 'distance')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Flights by Drone (SN) - Pie Chart */}
        {!expandedMetric && (
          <div className={`border rounded-lg p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h4 className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Flights by Drone (SN)
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={flightsBySN.slice(0, 6)}
                  dataKey="flights"
                  nameKey="sn"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: any) => `${entry.sn}: ${entry.flights}`}
                  labelLine={false}
                >
                  {flightsBySN.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  itemStyle={{
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  labelStyle={{
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  formatter={(value: number, name: string) => [`${value} flights`, `Drone ${name}`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Total Flight Time by SN */}
        {!expandedMetric && (
          <div className={`border rounded-lg p-4 ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <h4 className={`text-sm font-semibold mb-3 ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>
              Total Flight Time by Drone
            </h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={flightsBySN.slice(0, 10)}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} 
                />
                <XAxis 
                  dataKey="sn" 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Drone SN', 
                    position: 'insideBottom', 
                    offset: -5, 
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <YAxis 
                  stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
                  tick={{ fill: theme === 'dark' ? '#9CA3AF' : '#6B7280', fontSize: 11 }}
                  label={{ 
                    value: 'Hours', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: theme === 'dark' ? '#9CA3AF' : '#6B7280' 
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}`,
                    borderRadius: '0.5rem',
                    color: theme === 'dark' ? '#F3F4F6' : '#111827',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}h`, 'Flight Time']}
                />
                <Bar 
                  dataKey="totalTime" 
                  fill="#3EC1C5" 
                  name="Flight Time" 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

