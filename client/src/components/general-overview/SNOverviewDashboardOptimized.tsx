import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Plane, Clock, FileText, Route } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface SNOverviewStats {
  totalEntries: number;
  uniqueCopters: number;
  totalFlightTime: number;
  totalDistance: number;
  totalUlogFiles: number;
  maxFlightTime: number;
  minFlightTime: number;
  avgFlightTime: number;
  maxDistance: number;
  minDistance: number;
  avgDistance: number;
  snList: string[];
  source?: string;
}

interface SNOverviewDashboardOptimizedProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

export function SNOverviewDashboardOptimized({
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: SNOverviewDashboardOptimizedProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SNOverviewStats>({
    totalEntries: 0,
    uniqueCopters: 0,
    totalFlightTime: 0,
    totalDistance: 0,
    totalUlogFiles: 0,
    maxFlightTime: 0,
    minFlightTime: 0,
    avgFlightTime: 0,
    maxDistance: 0,
    minDistance: 0,
    avgDistance: 0,
    snList: []
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedSNs, dateRange]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (selectedSNs.length > 0) {
        params.append('sns', selectedSNs.join(','));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }

      const response = await fetch(
        `${API_BASE_URL}/sn-overview/dashboard-stats?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to fetch dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format time from seconds to HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const statCards = [
    {
      icon: <Plane className="w-6 h-6" />,
      label: 'Total Copters',
      value: stats.uniqueCopters.toString(),
      color: 'text-[#3EC1C5]',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Total Flight Time [HH:MM:SS]',
      value: formatTime(stats.totalFlightTime),
      color: 'text-orange-400',
    },
    {
      icon: <Route className="w-6 h-6" />,
      label: 'Total Distance',
      value: `${(stats.totalDistance / 1000).toFixed(1)} km`,
      color: 'text-blue-400',
    },
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'Total Flight Log Count',
      value: stats.totalUlogFiles.toString(),
      color: 'text-purple-400',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`rounded-lg p-3 sm:p-4 h-24 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
              <div className={`w-6 h-6 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              <div className={`w-20 h-3 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              <div className={`w-24 h-6 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-3 sm:p-4 text-left relative transition ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            }`}
          >
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


