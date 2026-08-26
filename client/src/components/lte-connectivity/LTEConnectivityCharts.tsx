import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  ping_time_above_0: number;
  ping_time_above_1: number;
  ping_time_2_5_to_5: number;
  ping_time_5_to_10: number;
  ping_time_above_10: number;
  total_ping_events: number;
  connectivity_score: number;
  flight: boolean;
}

interface LTEConnectivityChartsProps {
  entries: LogEntry[];
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  expandedMetric?: 'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null;
  onFilterChange?: (filter: { type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null) => void;
}

export function LTEConnectivityCharts({
  entries,
  selectedSNs = [],
  dateRange = { start: null, end: null },
  expandedMetric,
  onFilterChange
}: LTEConnectivityChartsProps) {
  const { theme } = useTheme();

  // Parse date from date field (YYMMDD format)
  const parseDateFromField = (dateStr: string): string => {
    try {
      if (dateStr.length === 6) {
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return 'Unknown';
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSN = selectedSNs.length === 0 || selectedSNs.includes(entry.sn);
      
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = parseDateFromField(entry.date);
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
      
      return matchesSN && matchesDate && entry.flight;
    });
  }, [entries, selectedSNs, dateRange]);

  // Ping Time >0s Distribution Chart Data
  const pingTimeAbove0Distribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    filteredEntries.forEach(entry => {
      const pingCount = entry.ping_time_above_0 || 0;
      let category: string;
      
      if (pingCount === 0) category = '0 (Perfect)';
      else if (pingCount <= 5) category = '1-5 (Good)';
      else if (pingCount <= 10) category = '6-10 (Fair)';
      else if (pingCount <= 20) category = '11-20 (Poor)';
      else category = '20+ (Critical)';
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count]) => ({
      category,
      count,
      percentage: ((count / filteredEntries.length) * 100).toFixed(2)
    }));
  }, [filteredEntries]);

  // Ping Time >1s Distribution Chart Data
  const pingTimeAbove1Distribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    filteredEntries.forEach(entry => {
      const pingCount = entry.ping_time_above_1 || 0;
      let category: string;
      
      if (pingCount === 0) category = '0 (Perfect)';
      else if (pingCount <= 3) category = '1-3 (Good)';
      else if (pingCount <= 8) category = '4-8 (Fair)';
      else if (pingCount <= 15) category = '9-15 (Poor)';
      else category = '15+ (Critical)';
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count]) => ({
      category,
      count,
      percentage: ((count / filteredEntries.length) * 100).toFixed(2)
    }));
  }, [filteredEntries]);

  // Ping Time 2.5-5s Distribution Chart Data
  const pingTime2_5to5Distribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    filteredEntries.forEach(entry => {
      const pingCount = entry.ping_time_2_5_to_5 || 0;
      let category: string;
      
      if (pingCount === 0) category = '0 (Excellent)';
      else if (pingCount <= 2) category = '1-2 (Good)';
      else if (pingCount <= 5) category = '3-5 (Fair)';
      else if (pingCount <= 10) category = '6-10 (Poor)';
      else category = '10+ (Critical)';
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count]) => ({
      category,
      count,
      percentage: ((count / filteredEntries.length) * 100).toFixed(2)
    }));
  }, [filteredEntries]);

  // Ping Time 5-10s Distribution Chart Data
  const pingTime5to10Distribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    filteredEntries.forEach(entry => {
      const pingCount = entry.ping_time_5_to_10 || 0;
      let category: string;
      
      if (pingCount === 0) category = '0 (Excellent)';
      else if (pingCount <= 1) category = '1 (Good)';
      else if (pingCount <= 3) category = '2-3 (Fair)';
      else if (pingCount <= 5) category = '4-5 (Poor)';
      else category = '5+ (Critical)';
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count]) => ({
      category,
      count,
      percentage: ((count / filteredEntries.length) * 100).toFixed(2)
    }));
  }, [filteredEntries]);

  // Ping Time >10s Distribution Chart Data
  const pingTimeAbove10Distribution = useMemo(() => {
    const distribution: { [key: string]: number } = {};
    
    filteredEntries.forEach(entry => {
      const pingCount = entry.ping_time_above_10 || 0;
      let category: string;
      
      if (pingCount === 0) category = '0 (Excellent)';
      else if (pingCount === 1) category = '1 (Concerning)';
      else if (pingCount <= 2) category = '2 (Poor)';
      else if (pingCount <= 3) category = '3 (Bad)';
      else category = '4+ (Critical)';
      
      distribution[category] = (distribution[category] || 0) + 1;
    });

    return Object.entries(distribution).map(([category, count]) => ({
      category,
      count,
      percentage: ((count / filteredEntries.length) * 100).toFixed(2)
    }));
  }, [filteredEntries]);

  // Connectivity Trend Over Time
  const connectivityTrend = useMemo(() => {
    const dateGroups: { [key: string]: { 
      total: number; 
      ping_above_0: number;
      ping_above_1: number;
      ping_2_5_to_5: number; 
      ping_5_to_10: number; 
      ping_above_10: number;
      connectivity_scores: number[];
    } } = {};
    
    filteredEntries.forEach(entry => {
      const date = parseDateFromField(entry.date);
      if (date !== 'Unknown') {
        if (!dateGroups[date]) {
          dateGroups[date] = { 
            total: 0, 
            ping_above_0: 0,
            ping_above_1: 0,
            ping_2_5_to_5: 0, 
            ping_5_to_10: 0, 
            ping_above_10: 0,
            connectivity_scores: []
          };
        }
        dateGroups[date].total += 1;
        dateGroups[date].ping_above_0 += entry.ping_time_above_0 || 0;
        dateGroups[date].ping_above_1 += entry.ping_time_above_1 || 0;
        dateGroups[date].ping_2_5_to_5 += entry.ping_time_2_5_to_5 || 0;
        dateGroups[date].ping_5_to_10 += entry.ping_time_5_to_10 || 0;
        dateGroups[date].ping_above_10 += entry.ping_time_above_10 || 0;
        dateGroups[date].connectivity_scores.push(entry.connectivity_score || 100);
      }
    });

    return Object.entries(dateGroups)
      .map(([date, data]) => ({
        date,
        // Keep full precision for calculations, but round for display
        avgPingAbove0: data.total > 0 ? (data.ping_above_0 / data.total) : 0,
        avgPingAbove1: data.total > 0 ? (data.ping_above_1 / data.total) : 0,
        avgPing2_5to5: data.total > 0 ? (data.ping_2_5_to_5 / data.total) : 0,
        avgPing5to10: data.total > 0 ? (data.ping_5_to_10 / data.total) : 0,
        avgPingAbove10: data.total > 0 ? (data.ping_above_10 / data.total) : 0,
        avgConnectivityScore: data.connectivity_scores.length > 0 ? 
          (data.connectivity_scores.reduce((sum, score) => sum + score, 0) / data.connectivity_scores.length) : 100,
        flights: data.total,
        // Display values rounded to 2 decimal places
        displayAvgPingAbove0: data.total > 0 ? ((data.ping_above_0 / data.total).toFixed(2)) : '0.00',
        displayAvgPingAbove1: data.total > 0 ? ((data.ping_above_1 / data.total).toFixed(2)) : '0.00',
        displayAvgPing2_5to5: data.total > 0 ? ((data.ping_2_5_to_5 / data.total).toFixed(2)) : '0.00',
        displayAvgPing5to10: data.total > 0 ? ((data.ping_5_to_10 / data.total).toFixed(2)) : '0.00',
        displayAvgPingAbove10: data.total > 0 ? ((data.ping_above_10 / data.total).toFixed(2)) : '0.00',
        displayAvgConnectivityScore: data.connectivity_scores.length > 0 ? 
          ((data.connectivity_scores.reduce((sum, score) => sum + score, 0) / data.connectivity_scores.length).toFixed(2)) : '100.00'
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEntries]);

  // SN Performance Analysis
  const snPerformance = useMemo(() => {
    const snGroups: { [key: string]: { 
      total: number; 
      ping_above_0: number;
      ping_above_1: number;
      ping_2_5_to_5: number; 
      ping_5_to_10: number; 
      ping_above_10: number;
      connectivity_scores: number[];
    } } = {};
    
    filteredEntries.forEach(entry => {
      if (!snGroups[entry.sn]) {
        snGroups[entry.sn] = { 
          total: 0, 
          ping_above_0: 0,
          ping_above_1: 0,
          ping_2_5_to_5: 0, 
          ping_5_to_10: 0, 
          ping_above_10: 0,
          connectivity_scores: []
        };
      }
      snGroups[entry.sn].total += 1;
      snGroups[entry.sn].ping_above_0 += entry.ping_time_above_0 || 0;
      snGroups[entry.sn].ping_above_1 += entry.ping_time_above_1 || 0;
      snGroups[entry.sn].ping_2_5_to_5 += entry.ping_time_2_5_to_5 || 0;
      snGroups[entry.sn].ping_5_to_10 += entry.ping_time_5_to_10 || 0;
      snGroups[entry.sn].ping_above_10 += entry.ping_time_above_10 || 0;
      snGroups[entry.sn].connectivity_scores.push(entry.connectivity_score || 100);
    });

    return Object.entries(snGroups)
      .map(([sn, data]) => ({
        sn,
        // Keep full precision for calculations, but round for display
        avgPingAbove0: data.total > 0 ? (data.ping_above_0 / data.total) : 0,
        avgPingAbove1: data.total > 0 ? (data.ping_above_1 / data.total) : 0,
        avgPing2_5to5: data.total > 0 ? (data.ping_2_5_to_5 / data.total) : 0,
        avgPing5to10: data.total > 0 ? (data.ping_5_to_10 / data.total) : 0,
        avgPingAbove10: data.total > 0 ? (data.ping_above_10 / data.total) : 0,
        flights: data.total,
        avgConnectivityScore: data.connectivity_scores.length > 0 ? 
          (data.connectivity_scores.reduce((sum, score) => sum + score, 0) / data.connectivity_scores.length) : 100,
        // Display values rounded to 2 decimal places
        displayAvgPingAbove0: data.total > 0 ? ((data.ping_above_0 / data.total).toFixed(2)) : '0.00',
        displayAvgPingAbove1: data.total > 0 ? ((data.ping_above_1 / data.total).toFixed(2)) : '0.00',
        displayAvgPing2_5to5: data.total > 0 ? ((data.ping_2_5_to_5 / data.total).toFixed(2)) : '0.00',
        displayAvgPing5to10: data.total > 0 ? ((data.ping_5_to_10 / data.total).toFixed(2)) : '0.00',
        displayAvgPingAbove10: data.total > 0 ? ((data.ping_above_10 / data.total).toFixed(2)) : '0.00',
        displayAvgConnectivityScore: data.connectivity_scores.length > 0 ? 
          ((data.connectivity_scores.reduce((sum, score) => sum + score, 0) / data.connectivity_scores.length).toFixed(2)) : '100.00'
      }))
      .sort((a, b) => b.avgConnectivityScore - a.avgConnectivityScore)
      .slice(0, 10); // Top 10 performers
  }, [filteredEntries]);

  const colors = {
    primary: theme === 'dark' ? '#3EC1C5' : '#000000',
    secondary: theme === 'dark' ? '#60A5FA' : '#3B82F6',
    success: theme === 'dark' ? '#34D399' : '#10B981',
    warning: theme === 'dark' ? '#FBBF24' : '#F59E0B',
    danger: theme === 'dark' ? '#F87171' : '#EF4444',
    text: theme === 'dark' ? '#F3F4F6' : '#1F2937',
    grid: theme === 'dark' ? '#374151' : '#E5E7EB'
  };

  const handleBarClick = (data: any, chartType: string) => {
    if (!onFilterChange) return;

    let matchingKeys: string[] = [];
    
    if (chartType === 'pingTimeAbove0') {
      const category = data.category;
      matchingKeys = filteredEntries
        .filter(entry => {
          const pingCount = entry.ping_time_above_0 || 0;
          if (category === '0 (Perfect)') return pingCount === 0;
          if (category === '1-5 (Good)') return pingCount >= 1 && pingCount <= 5;
          if (category === '6-10 (Fair)') return pingCount >= 6 && pingCount <= 10;
          if (category === '11-20 (Poor)') return pingCount >= 11 && pingCount <= 20;
          if (category === '20+ (Critical)') return pingCount > 20;
          return false;
        })
        .map(entry => entry.key);
    } else if (chartType === 'pingTimeAbove1') {
      const category = data.category;
      matchingKeys = filteredEntries
        .filter(entry => {
          const pingCount = entry.ping_time_above_1 || 0;
          if (category === '0 (Perfect)') return pingCount === 0;
          if (category === '1-3 (Good)') return pingCount >= 1 && pingCount <= 3;
          if (category === '4-8 (Fair)') return pingCount >= 4 && pingCount <= 8;
          if (category === '9-15 (Poor)') return pingCount >= 9 && pingCount <= 15;
          if (category === '15+ (Critical)') return pingCount > 15;
          return false;
        })
        .map(entry => entry.key);
    } else if (chartType === 'pingTime2_5to5') {
      const category = data.category;
      matchingKeys = filteredEntries
        .filter(entry => {
          const pingCount = entry.ping_time_2_5_to_5 || 0;
          if (category === '0 (Excellent)') return pingCount === 0;
          if (category === '1-2 (Good)') return pingCount >= 1 && pingCount <= 2;
          if (category === '3-5 (Fair)') return pingCount >= 3 && pingCount <= 5;
          if (category === '6-10 (Poor)') return pingCount >= 6 && pingCount <= 10;
          if (category === '10+ (Critical)') return pingCount > 10;
          return false;
        })
        .map(entry => entry.key);
    } else if (chartType === 'pingTime5to10') {
      const category = data.category;
      matchingKeys = filteredEntries
        .filter(entry => {
          const pingCount = entry.ping_time_5_to_10 || 0;
          if (category === '0 (Excellent)') return pingCount === 0;
          if (category === '1 (Good)') return pingCount === 1;
          if (category === '2-3 (Fair)') return pingCount >= 2 && pingCount <= 3;
          if (category === '4-5 (Poor)') return pingCount >= 4 && pingCount <= 5;
          if (category === '5+ (Critical)') return pingCount > 5;
          return false;
        })
        .map(entry => entry.key);
    } else if (chartType === 'pingTimeAbove10') {
      const category = data.category;
      matchingKeys = filteredEntries
        .filter(entry => {
          const pingCount = entry.ping_time_above_10 || 0;
          if (category === '0 (Excellent)') return pingCount === 0;
          if (category === '1 (Concerning)') return pingCount === 1;
          if (category === '2 (Poor)') return pingCount === 2;
          if (category === '3 (Bad)') return pingCount === 3;
          if (category === '4+ (Critical)') return pingCount > 3;
          return false;
        })
        .map(entry => entry.key);
    }

    onFilterChange({
      type: chartType,
      range: { min: 0, max: 100 },
      label: data.category,
      source: 'chart',
      matchingKeys
    });
  };

  if (!expandedMetric) return null;

  return (
    <div className="space-y-4">
      {/* Ping Time >0s Analysis */}
      {expandedMetric === 'pingTimeAbove0' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Ping Time &gt;0 Seconds Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pingTimeAbove0Distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'count' ? `${value} flights` : `${value}%`,
                    name === 'count' ? 'Flights' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.primary}
                  onClick={(data) => handleBarClick(data, 'pingTimeAbove0')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ping Time >1s Analysis */}
      {expandedMetric === 'pingTimeAbove1' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Ping Time &gt;1 Second Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pingTimeAbove1Distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'count' ? `${value} flights` : `${value}%`,
                    name === 'count' ? 'Flights' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.secondary}
                  onClick={(data) => handleBarClick(data, 'pingTimeAbove1')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ping Time 2.5-5s Analysis */}
      {expandedMetric === 'pingTime2_5to5' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Ping Time 2.5-5 Seconds Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pingTime2_5to5Distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'count' ? `${value} flights` : `${value}%`,
                    name === 'count' ? 'Flights' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.warning}
                  onClick={(data) => handleBarClick(data, 'pingTime2_5to5')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ping Time 5-10s Analysis */}
      {expandedMetric === 'pingTime5to10' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Ping Time 5-10 Seconds Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pingTime5to10Distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'count' ? `${value} flights` : `${value}%`,
                    name === 'count' ? 'Flights' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.secondary}
                  onClick={(data) => handleBarClick(data, 'pingTime5to10')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ping Time &gt;10s Analysis */}
      {expandedMetric === 'pingTimeAbove10' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Ping Time &gt;10 Seconds Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pingTimeAbove10Distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="category" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'count' ? `${value} flights` : `${value}%`,
                    name === 'count' ? 'Flights' : 'Percentage'
                  ]}
                />
                <Bar 
                  dataKey="count" 
                  fill={colors.danger}
                  onClick={(data) => handleBarClick(data, 'pingTimeAbove10')}
                  style={{ cursor: 'pointer' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Connectivity Trend Over Time - Only for Excellent Connectivity */}
      {expandedMetric === 'connectivity' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>LTE Connectivity Trend Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={connectivityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgConnectivityScore') return [`${Number(value).toFixed(2)}%`, 'Connectivity Score'];
                    return [`${Number(value).toFixed(2)}`, name.replace('avg', 'Avg ').replace('&gt;', '>')];
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgConnectivityScore" 
                  stroke={colors.success} 
                  strokeWidth={3}
                  name="Connectivity Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SN Performance Analysis - Only for Excellent Connectivity */}
      {expandedMetric === 'connectivity' && (
        <div className={`border rounded-lg p-4 ${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>Top Performing Drones (LTE Connectivity Score)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis 
                  dataKey="sn" 
                  tick={{ fill: colors.text, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${colors.grid}`,
                    borderRadius: '6px',
                    color: colors.text
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgConnectivityScore') return [`${Number(value).toFixed(2)}`, 'Connectivity Score'];
                    if (name === 'flights') return [`${value}`, 'Total Flights'];
                    if (name === 'avgPingAbove0') return [`${Number(value).toFixed(2)}`, 'Avg Ping >0s'];
                    if (name === 'avgPingAbove1') return [`${Number(value).toFixed(2)}`, 'Avg Ping >1s'];
                    if (name === 'avgPing2_5to5') return [`${Number(value).toFixed(2)}`, 'Avg Ping 2.5-5s'];
                    if (name === 'avgPing5to10') return [`${Number(value).toFixed(2)}`, 'Avg Ping 5-10s'];
                    if (name === 'avgPingAbove10') return [`${Number(value).toFixed(2)}`, 'Avg Ping >10s'];
                    return [Number(value).toFixed(2), name];
                  }}
                />
                <Bar dataKey="avgConnectivityScore" fill={colors.success} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
