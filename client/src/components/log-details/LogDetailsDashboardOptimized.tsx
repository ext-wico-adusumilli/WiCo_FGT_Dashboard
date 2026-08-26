import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Clock, Route, Plane, TrendingUp, Database } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface DashboardStats {
  totalFlights: number;
  uniqueSNs: number;
  totalFlightTime: number;
  totalDistance: number;
  totalTransitions: number;
  minFlightTime: number;
  maxFlightTime: number;
  minDistance: number;
  maxDistance: number;
}

interface LogDetailsDashboardOptimizedProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  onMetricClick?: (metric: 'flightTime' | 'distance' | 'battery' | null) => void;
  expandedMetric?: 'flightTime' | 'distance' | 'battery' | null;
}

export function LogDetailsDashboardOptimized({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  onMetricClick,
  expandedMetric
}: LogDetailsDashboardOptimizedProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalFlights: 0,
    uniqueSNs: 0,
    totalFlightTime: 0,
    totalDistance: 0,
    totalTransitions: 0,
    minFlightTime: 0,
    maxFlightTime: 0,
    minDistance: 0,
    maxDistance: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedSNs, dateRange]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (selectedSNs.length > 0) params.append('sns', selectedSNs.join(','));
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const response = await fetch(
        `${API_BASE_URL}/log-details/dashboard-stats?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching log details dashboard stats:', error);
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
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${(stats.minFlightTime / 60).toFixed(1)} min`,
      maxValue: `Max: ${(stats.maxFlightTime / 60).toFixed(1)} min`,
      metricType: 'flightTime' as const,
    },
    {
      icon: <Route className="w-6 h-6" />,
      label: 'Distance',
      color: 'text-blue-400',
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${(stats.minDistance / 1000).toFixed(1)} km`,
      maxValue: `Max: ${(stats.maxDistance / 1000).toFixed(1)} km`,
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


