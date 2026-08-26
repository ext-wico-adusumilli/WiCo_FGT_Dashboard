import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Monitor, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface DashboardStats {
  uniqueCSVersions: number;
  totalFlightTime: number;
}

interface CSVersionDashboardOptimizedProps {
  dateRange?: { start: string | null; end: string | null };
}

export function CSVersionDashboardOptimized({
  dateRange = { start: null, end: null }
}: CSVersionDashboardOptimizedProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    uniqueCSVersions: 0,
    totalFlightTime: 0
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [dateRange]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const response = await fetch(
        `${API_BASE_URL}/general-overview/cs-version-stats?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching CS version dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const statCards = [
    {
      icon: <Monitor className="w-6 h-6" />,
      label: 'Unique CS Versions',
      value: stats.uniqueCSVersions.toString(),
      color: 'text-green-400',
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Total Flight Time [HH:MM:SS]',
      value: formatTime(stats.totalFlightTime),
      color: 'text-orange-400',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {[1, 2].map((i) => (
            <div key={i} className={`rounded-lg p-3 sm:p-4 h-24 border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-3 sm:p-4 text-left relative transition ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}
          >
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


