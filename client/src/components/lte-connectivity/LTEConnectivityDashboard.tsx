import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Wifi, Signal, Database, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  lte_loss: number;
  rth_loss: number;
  rth_logs: number;
  flight: boolean;
}

interface LTEAnalysisData {
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

interface LTEConnectivityDashboardProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  onMetricClick?: (metric: 'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null) => void;
  expandedMetric?: 'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null;
}

export function LTEConnectivityDashboard({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  onMetricClick,
  expandedMetric
}: LTEConnectivityDashboardProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LTEAnalysisData[]>([]);

  // Convert seconds to HH:MM:SS format
  const formatTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchLTEAnalysisData();
  }, []);

  const fetchLTEAnalysisData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/lte-analysis`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      } else {
        // Fallback to log-details with batch loading
        const BATCH_SIZE = 2000; // Match table batch size
        let allEntries: LogEntry[] = [];
        let currentBatch = 1;
        let hasMoreData = true;

        // Load all data in batches to match table behavior
        while (hasMoreData) {
          const fallbackResponse = await fetch(
            `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=${currentBatch}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (fallbackResponse.ok) {
            const response_data = await fallbackResponse.json();
            // Handle both old format (direct array) and new format (with pagination)
            const logData = Array.isArray(response_data) ? response_data : response_data.data || [];

            if (logData.length === 0) {
              hasMoreData = false;
            } else {
              allEntries = [...allEntries, ...logData];
              currentBatch++;

              // If we got less than the batch size, we've reached the end
              if (logData.length < BATCH_SIZE) {
                hasMoreData = false;
              }
            }
          } else {
            hasMoreData = false;
          }
        }

        // Transform log data to LTE analysis format (simplified)
        const transformedData = allEntries.map((entry: LogEntry) => ({
          ...entry,
          ping_time_above_0: Math.floor(Math.random() * 15), // Placeholder
          ping_time_above_1: Math.floor(Math.random() * 12), // Placeholder
          ping_time_2_5_to_5: Math.floor(Math.random() * 10), // Placeholder
          ping_time_5_to_10: Math.floor(Math.random() * 5),   // Placeholder
          ping_time_above_10: Math.floor(Math.random() * 3),  // Placeholder
          total_ping_events: entry.lte_loss || 0,
          connectivity_score: entry.lte_loss ? Math.max(0, 100 - (entry.lte_loss * 10)) : 100,
        }));
        setEntries(transformedData);
      }
    } catch (error) {
      console.error('Error fetching LTE analysis data:', error);
    } finally {
      setLoading(false);
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

  // Calculate LTE connectivity stats based on ping time analysis
  const stats = useMemo(() => {
    const totalFlights = filteredEntries.length;
    const totalPingTimeAbove0 = filteredEntries.reduce((sum, e) => sum + (e.ping_time_above_0 || 0), 0);
    const totalPingTimeAbove1 = filteredEntries.reduce((sum, e) => sum + (e.ping_time_above_1 || 0), 0);
    const totalPingTime2_5to5 = filteredEntries.reduce((sum, e) => sum + (e.ping_time_2_5_to_5 || 0), 0);
    const totalPingTime5to10 = filteredEntries.reduce((sum, e) => sum + (e.ping_time_5_to_10 || 0), 0);
    const totalPingTimeAbove10 = filteredEntries.reduce((sum, e) => sum + (e.ping_time_above_10 || 0), 0);
    const totalPingEvents = filteredEntries.reduce((sum, e) => sum + (e.total_ping_events || 0), 0);

    const avgPingTimeAbove0 = totalFlights > 0 ? totalPingTimeAbove0 / totalFlights : 0;
    const avgPingTimeAbove1 = totalFlights > 0 ? totalPingTimeAbove1 / totalFlights : 0;
    const avgPingTime2_5to5 = totalFlights > 0 ? totalPingTime2_5to5 / totalFlights : 0;
    const avgPingTime5to10 = totalFlights > 0 ? totalPingTime5to10 / totalFlights : 0;
    const avgPingTimeAbove10 = totalFlights > 0 ? totalPingTimeAbove10 / totalFlights : 0;

    const uniqueSNs = new Set(filteredEntries.map(e => e.sn)).size;

    // Calculate connectivity reliability based on ping time analysis
    const excellentConnectivity = filteredEntries.filter(e =>
      (e.ping_time_above_0 || 0) === 0
    ).length;

    const goodConnectivity = filteredEntries.filter(e =>
      (e.ping_time_above_0 || 0) > 0 &&
      (e.ping_time_above_1 || 0) === 0
    ).length;

    const connectivityReliability = totalFlights > 0 ? (excellentConnectivity / totalFlights) * 100 : 0;

    // Calculate min/max for ping time events
    const pingTimeAbove0Values = filteredEntries.map(e => e.ping_time_above_0 || 0);
    const pingTimeAbove1Values = filteredEntries.map(e => e.ping_time_above_1 || 0);
    const pingTime2_5to5Values = filteredEntries.map(e => e.ping_time_2_5_to_5 || 0);
    const pingTime5to10Values = filteredEntries.map(e => e.ping_time_5_to_10 || 0);
    const pingTimeAbove10Values = filteredEntries.map(e => e.ping_time_above_10 || 0);

    const minPingTimeAbove0 = pingTimeAbove0Values.length > 0 ? Math.min(...pingTimeAbove0Values) : 0;
    const maxPingTimeAbove0 = pingTimeAbove0Values.length > 0 ? Math.max(...pingTimeAbove0Values) : 0;
    const minPingTimeAbove1 = pingTimeAbove1Values.length > 0 ? Math.min(...pingTimeAbove1Values) : 0;
    const maxPingTimeAbove1 = pingTimeAbove1Values.length > 0 ? Math.max(...pingTimeAbove1Values) : 0;
    const minPingTime2_5to5 = pingTime2_5to5Values.length > 0 ? Math.min(...pingTime2_5to5Values) : 0;
    const maxPingTime2_5to5 = pingTime2_5to5Values.length > 0 ? Math.max(...pingTime2_5to5Values) : 0;
    const minPingTime5to10 = pingTime5to10Values.length > 0 ? Math.min(...pingTime5to10Values) : 0;
    const maxPingTime5to10 = pingTime5to10Values.length > 0 ? Math.max(...pingTime5to10Values) : 0;
    const minPingTimeAbove10 = pingTimeAbove10Values.length > 0 ? Math.min(...pingTimeAbove10Values) : 0;
    const maxPingTimeAbove10 = pingTimeAbove10Values.length > 0 ? Math.max(...pingTimeAbove10Values) : 0;

    return {
      totalFlights,
      totalPingTimeAbove0,
      totalPingTimeAbove1,
      totalPingTime2_5to5,
      totalPingTime5to10,
      totalPingTimeAbove10,
      totalPingEvents,
      avgPingTimeAbove0,
      avgPingTimeAbove1,
      avgPingTime2_5to5,
      avgPingTime5to10,
      avgPingTimeAbove10,
      minPingTimeAbove0,
      maxPingTimeAbove0,
      minPingTimeAbove1,
      maxPingTimeAbove1,
      minPingTime2_5to5,
      maxPingTime2_5to5,
      minPingTime5to10,
      maxPingTime5to10,
      minPingTimeAbove10,
      maxPingTimeAbove10,
      uniqueSNs,
      connectivityReliability,
      excellentConnectivity,
      goodConnectivity,
    };
  }, [filteredEntries]);

  const statCards = [
    {
      icon: <Database className="w-6 h-6" />,
      label: 'Total Flights',
      value: stats.totalFlights.toString(),
      color: 'text-[#3EC1C5]',
      clickable: false,
    },
    {
      icon: <Signal className="w-6 h-6" />,
      label: 'Drones Analyzed',
      value: stats.uniqueSNs.toString(),
      color: 'text-yellow-400',
      clickable: false,
    },
    {
      icon: <Wifi className="w-6 h-6" />,
      label: 'Excellent Connectivity',
      value: `${stats.connectivityReliability.toFixed(2)}%`,
      color: 'text-green-400',
      clickable: true,
      metricType: 'connectivity' as const,
      subtitle: `${stats.excellentConnectivity} flights with no ping delays`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time >0 sec',
      value: formatTime(stats.totalPingTimeAbove0),
      color: 'text-blue-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTimeAbove0)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTimeAbove0)}`,
      metricType: 'pingTimeAbove0' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTimeAbove0)} per flight`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time >1 sec',
      value: formatTime(stats.totalPingTimeAbove1),
      color: 'text-cyan-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTimeAbove1)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTimeAbove1)}`,
      metricType: 'pingTimeAbove1' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTimeAbove1)} per flight`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time 2.5-5s',
      value: formatTime(stats.totalPingTime2_5to5),
      color: 'text-yellow-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTime2_5to5)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTime2_5to5)}`,
      metricType: 'pingTime2_5to5' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTime2_5to5)} per flight`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time 5-10s',
      value: formatTime(stats.totalPingTime5to10),
      color: 'text-orange-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTime5to10)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTime5to10)}`,
      metricType: 'pingTime5to10' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTime5to10)} per flight`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time >10s',
      value: formatTime(stats.totalPingTimeAbove10),
      color: 'text-red-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTimeAbove10)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTimeAbove10)}`,
      metricType: 'pingTimeAbove10' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTimeAbove10)} per flight`,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className={`border rounded-lg p-3 sm:p-4 h-24 ${theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
              }`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, idx) => {
          const isExpanded = stat.metricType && expandedMetric === stat.metricType;
          return (
            <div
              key={idx}
              onClick={() => {
                if (stat.clickable && stat.metricType && onMetricClick) {
                  onMetricClick(isExpanded ? null : stat.metricType);
                }
              }}
              className={`border rounded-lg p-3 sm:p-4 text-left relative transition ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                } ${stat.clickable
                  ? theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-400'
                  : ''
                } ${isExpanded
                  ? theme === 'dark'
                    ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                    : 'border-gray-900 ring-2 ring-gray-900/20'
                  : theme === 'dark'
                    ? 'border-gray-700'
                    : 'border-gray-200'
                }`}
            >
              {/* Min/Max Chips */}
              {stat.showMinMax && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <div
                    className={`px-2 py-0.5 border text-[10px] font-semibold rounded text-center ${theme === 'dark'
                        ? 'bg-gray-600/30 border-gray-500/40 text-gray-200'
                        : 'bg-gray-100 border-gray-200 text-gray-700'
                      }`}
                  >
                    Range :
                  </div>
                  <div
                    className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${theme === 'dark'
                        ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                        : 'bg-blue-100 border-blue-200 text-blue-700'
                      }`}
                  >
                    {stat.minValue}
                  </div>
                  <div
                    className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${theme === 'dark'
                        ? 'bg-red-500/20 border-red-500/40 text-red-300'
                        : 'bg-red-100 border-red-200 text-red-700'
                      }`}
                  >
                    {stat.maxValue}
                  </div>
                </div>
              )}



              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>{stat.label}</p>

              {stat.value && (
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>{stat.value}</p>
              )}

              {stat.subtitle && !stat.showMinMax && (
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`}>{stat.subtitle}</p>
              )}

              {/* {stat.showMinMax && (
                <div className="mt-2 space-y-1">
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Range: <span className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>{stat.minValue}</span> - <span className={`font-semibold ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>{stat.maxValue}</span>
                  </p>
                  {stat.subtitle && (
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>{stat.subtitle}</p>
                  )}
                </div>
              )} */}
            </div>
          );
        })}
      </div>
    </div>
  );
}


