import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Clock, Route, Plane, TrendingUp, Database } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  battery_0_remaining: number;
  battery_1_remaining: number;
  fwd_transitions: number;
  bwd_transitions: number;
  flight: boolean;
}

interface LogDetailsDashboardProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  onMetricClick?: (metric: 'flightTime' | 'distance' | 'battery' | null) => void;
  expandedMetric?: 'flightTime' | 'distance' | 'battery' | null;
}

export function LogDetailsDashboard({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  onMetricClick,
  expandedMetric
}: LogDetailsDashboardProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchLogData();
  }, []);

  const fetchLogData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const BATCH_SIZE = 2000; // Match table batch size
      let allEntries: LogEntry[] = [];
      let currentBatch = 1;
      let hasMoreData = true;

      // Load all data in batches to match table behavior
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
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching log data:', error);
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

  // Calculate stats
  const stats = useMemo(() => {
    const totalFlights = filteredEntries.length;
    const totalFlightTime = filteredEntries.reduce((sum, e) => sum + (e.flight_time || 0), 0);
    const totalDistance = filteredEntries.reduce((sum, e) => sum + (e.distance || 0), 0);
    const avgFlightTime = totalFlights > 0 ? totalFlightTime / totalFlights : 0;
    const avgDistance = totalFlights > 0 ? totalDistance / totalFlights : 0;
    
    const uniqueSNs = new Set(filteredEntries.map(e => e.sn)).size;
    
    const totalTransitions = filteredEntries.reduce((sum, e) => 
      sum + (e.fwd_transitions || 0) + (e.bwd_transitions || 0), 0
    );

    // Calculate min/max for flight time and distance
    const flightTimes = filteredEntries.map(e => e.flight_time || 0);
    const distances = filteredEntries.map(e => e.distance || 0);
    
    const minFlightTime = flightTimes.length > 0 ? Math.min(...flightTimes) / 60 : 0; // minutes
    const maxFlightTime = flightTimes.length > 0 ? Math.max(...flightTimes) / 60 : 0; // minutes
    const minDistance = distances.length > 0 ? Math.min(...distances) / 1000 : 0; // km
    const maxDistance = distances.length > 0 ? Math.max(...distances) / 1000 : 0; // km

    return {
      totalFlights,
      totalFlightTime: totalFlightTime / 3600, // Convert to hours
      totalDistance: totalDistance / 1000, // Convert to km
      avgFlightTime: avgFlightTime / 60, // Convert to minutes
      avgDistance: avgDistance / 1000, // Convert to km
      minFlightTime,
      maxFlightTime,
      minDistance,
      maxDistance,
      uniqueSNs,
      totalTransitions,
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
      icon: <Plane className="w-6 h-6" />,
      label: 'Unique Drones',
      value: stats.uniqueSNs.toString(),
      color: 'text-yellow-400',
      clickable: false,
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      label: 'Transitions (Fwd + Bwd)',
      value: stats.totalTransitions.toString(),
      color: 'text-purple-400',
      clickable: false,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Flight Time',
      color: 'text-orange-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${stats.minFlightTime.toFixed(1)} min`,
      maxValue: `Max: ${stats.maxFlightTime.toFixed(1)} min`,
      metricType: 'flightTime' as const,
    },
    {
      icon: <Route className="w-6 h-6" />,
      label: 'Distance',
      color: 'text-blue-400',
      clickable: true,
      showMinMax: true,
      minValue: `Min: ${stats.minDistance.toFixed(1)} km`,
      maxValue: `Max: ${stats.maxDistance.toFixed(1)} km`,
      metricType: 'distance' as const,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`border rounded-lg p-3 sm:p-4 h-24 ${
              theme === 'dark' 
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
              className={`border rounded-lg p-3 sm:p-4 text-left relative transition ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              } ${
                stat.clickable 
                  ? theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-400'
                  : ''
              } ${
                isExpanded 
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
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${
                    theme === 'dark'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-blue-100 border-blue-200 text-blue-700'
                  }`}>
                    {stat.minValue}
                  </div>
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${
                    theme === 'dark'
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-red-100 border-red-200 text-red-700'
                  }`}>
                    {stat.maxValue}
                  </div>
                </div>
              )}
              
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}>{stat.label}</p>
              {!stat.showMinMax && (
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>{stat.value}</p>
              )}
              {stat.showMinMax && (
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


