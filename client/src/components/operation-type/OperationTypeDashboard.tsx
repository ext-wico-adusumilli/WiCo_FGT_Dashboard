import { useState, useEffect } from 'react';
import { Plane, Eye, EyeOff, Users } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from '../../config/api';

interface OperationTypeDashboardProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

interface SummaryStats {
  totalFlights: number;
  vlosFlights: number;
  bvlosFlights: number;
  uniqueSNs: number;
}

export function OperationTypeDashboard({
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: OperationTypeDashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats>({
    totalFlights: 0,
    vlosFlights: 0,
    bvlosFlights: 0,
    uniqueSNs: 0
  });

  useEffect(() => {
    fetchSummary();
  }, [selectedSNs, dateRange]);

  const fetchSummary = async () => {
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
        `${API_BASE_URL}/operation-type/summary?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      icon: <Plane className="w-6 h-6" />,
      label: 'Total Flights',
      value: stats.totalFlights.toString(),
      color: 'text-[#3EC1C5]'
    },
    {
      icon: <Eye className="w-6 h-6" />,
      label: 'VLOS Flights',
      value: stats.vlosFlights.toString(),
      color: 'text-blue-400'
    },
    {
      icon: <EyeOff className="w-6 h-6" />,
      label: 'BVLOS Flights',
      value: stats.bvlosFlights.toString(),
      color: 'text-purple-400'
    },
    {
      icon: <Users className="w-6 h-6" />,
      label: 'Unique Copters',
      value: stats.uniqueSNs.toString(),
      color: 'text-green-400'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`rounded-lg p-3 sm:p-4 h-24 border ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className={`w-6 h-6 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`w-20 h-3 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
            <div className={`w-12 h-6 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {statCards.map((stat, idx) => (
        <div
          key={idx}
          className={`border rounded-lg p-3 sm:p-4 text-left transition ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}
        >
          <div className={`${stat.color} mb-2`}>{stat.icon}</div>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
