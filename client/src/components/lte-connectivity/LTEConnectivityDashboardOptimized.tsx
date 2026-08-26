import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Wifi, Signal, Database, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LTEConnectivityDashboardOptimizedProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  onMetricClick?: (metric: 'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null) => void;
  expandedMetric?: 'pingTimeAbove0' | 'pingTimeAbove1' | 'pingTime2_5to5' | 'pingTime5to10' | 'pingTimeAbove10' | 'connectivity' | null;
  loading?: boolean;
}

export function LTEConnectivityDashboardOptimized({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  onMetricClick,
  expandedMetric,
  loading: externalLoading = false
}: LTEConnectivityDashboardOptimizedProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFlights: 0,
    uniqueDrones: 0,
    avgLTELoss: 0,
    avgRTHLoss: 0,
    connectivityReliability: 0,
    excellentConnectivity: 0,
    totalPingTimeAbove0: 0,
    totalPingTimeAbove1: 0,
    totalPingTime2_5to5: 0,
    totalPingTime5to10: 0,
    totalPingTimeAbove10: 0,
    avgPingTimeAbove0: 0,
    avgPingTimeAbove1: 0,
    avgPingTime2_5to5: 0,
    avgPingTime5to10: 0,
    avgPingTimeAbove10: 0,
    minPingTimeAbove0: 0,
    maxPingTimeAbove0: 0,
    minPingTimeAbove1: 0,
    maxPingTimeAbove1: 0,
    minPingTime2_5to5: 0,
    maxPingTime2_5to5: 0,
    minPingTime5to10: 0,
    maxPingTime5to10: 0,
    minPingTimeAbove10: 0,
    maxPingTimeAbove10: 0,
  });

  // Convert seconds to HH:MM:SS format
  const formatTime = (seconds: number): string => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedSNs, dateRange]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (selectedSNs.length > 0) {
        params.append('sn', selectedSNs.join(','));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      
      const response = await fetch(
        `${API_BASE_URL}/lte-analysis/dashboard-stats?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch LTE dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching LTE dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
      value: stats.uniqueDrones.toString(),
      color: 'text-yellow-400',
      clickable: false,
    },
    {
      icon: <Wifi className="w-6 h-6" />,
      label: 'Excellent Connectivity',
      value: `${stats.connectivityReliability.toFixed(2)}%`,
      color: 'text-green-400',
      clickable: false,
      metricType: 'connectivity' as const,
      subtitle: `${stats.excellentConnectivity} flights with no ping delays`,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Ping Time >0 sec',
      value: formatTime(stats.totalPingTimeAbove0),
      color: 'text-blue-400',
      clickable: false,
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
      clickable: false,
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
      clickable: false,
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
      clickable: false,
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
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${formatTime(stats.minPingTimeAbove10)}`,
      maxValue: `Max: ${formatTime(stats.maxPingTimeAbove10)}`,
      metricType: 'pingTimeAbove10' as const,
      subtitle: `Avg: ${formatTime(stats.avgPingTimeAbove10)} per flight`,
    },
  ];

  if (loading || externalLoading) {
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
              {stat.showMinMax && (
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <div className={`px-2 py-0.5 border text-[10px] font-semibold rounded text-center ${theme === 'dark'
                      ? 'bg-gray-600/30 border-gray-500/40 text-gray-200'
                      : 'bg-gray-100 border-gray-200 text-gray-700'
                    }`}>
                    Range :
                  </div>
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${theme === 'dark'
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-blue-100 border-blue-200 text-blue-700'
                    }`}>
                    {stat.minValue}
                  </div>
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded text-center ${theme === 'dark'
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-red-100 border-red-200 text-red-700'
                    }`}>
                    {stat.maxValue}
                  </div>
                </div>
              )}
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
              {stat.value && (
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              )}
              {stat.subtitle && !stat.showMinMax && (
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{stat.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


