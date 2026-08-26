import { API_BASE_URL } from '../config/api';
import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { MTTFDashboardSkeleton } from '../components/MTTFDashboardSkeleton';

interface MTTFData {
  _id: string;
  category: string;
  uaName: string;
  totalFlightHours?: number;
  componentLifetime?: number;
  lastRepairDate?: string;
  mtsbTicketId?: string;
  frameSection?: string;
  component?: string;
}

export function MTTFDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [mttfData, setMttfData] = useState<MTTFData[]>([]);
  const [stats, setStats] = useState({
    totalEntries: 0,
    totalFlightHours: 0,
    componentsNearLifetime: 0,
    recentMaintenance: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const categories = ['structure', 'propulsion', 'actuators', 'controller', 'communication'];
      
      const allData: MTTFData[] = [];
      
      for (const category of categories) {
        const response = await fetch(
          `${API_BASE_URL}/api/mttf/data?category=${category}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          allData.push(...data);
        }
      }

      setMttfData(allData);
      calculateStats(allData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: MTTFData[]) => {
    const totalFlightHours = data.reduce((sum, item) => sum + (item.totalFlightHours || 0), 0);
    
    // Components near lifetime (>80% of component lifetime)
    const componentsNearLifetime = data.filter(item => {
      if (item.totalFlightHours && item.componentLifetime) {
        return (item.totalFlightHours / item.componentLifetime) > 0.8;
      }
      return false;
    }).length;

    // Recent maintenance (entries with repair dates in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMaintenance = data.filter(item => {
      if (item.lastRepairDate) {
        return new Date(item.lastRepairDate) > thirtyDaysAgo;
      }
      return false;
    }).length;

    setStats({
      totalEntries: data.length,
      totalFlightHours,
      componentsNearLifetime,
      recentMaintenance,
    });
  };

  const getRecentEntries = () => {
    return mttfData
      .filter(item => item.lastRepairDate)
      .sort((a, b) => {
        const dateA = new Date(a.lastRepairDate!).getTime();
        const dateB = new Date(b.lastRepairDate!).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  };

  const getCategoryStats = () => {
    const categories = ['structure', 'propulsion', 'actuators', 'controller', 'communication'];
    return categories.map(cat => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: mttfData.filter(item => item.category === cat).length,
    }));
  };

  const statCards = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      label: 'Total Entries',
      value: stats.totalEntries.toString(),
      color: 'text-[#3EC1C5]',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      label: 'Total Flight Hours',
      value: stats.totalFlightHours.toLocaleString(),
      color: 'text-blue-400',
    },
    {
      icon: <AlertTriangle className="w-6 h-6" />,
      label: 'Near Lifetime',
      value: stats.componentsNearLifetime.toString(),
      color: 'text-yellow-400',
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      label: 'Recent Maintenance',
      value: stats.recentMaintenance.toString(),
      color: 'text-green-400',
    },
  ];

  if (loading) {
    return <MTTFDashboardSkeleton />;
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-2 sm:p-3 md:p-4 hover:border-[#3EC1C5] transition">
            <div className={`${stat.color} mb-1 sm:mb-2`}>{stat.icon}</div>
            <p className="text-gray-400 text-[10px] sm:text-xs">{stat.label}</p>
            <p className="text-base sm:text-xl md:text-2xl font-bold text-white mt-0.5 sm:mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 sm:p-3 md:p-4">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold text-white mb-2 sm:mb-3">Recent Entries</h2>
          <div className="space-y-1.5 sm:space-y-2">
            {getRecentEntries().length > 0 ? (
              getRecentEntries().map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-1.5 sm:p-2 bg-gray-700/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-xs sm:text-sm truncate">{item.uaName}</p>
                    <p className="text-gray-400 text-[10px] sm:text-xs truncate">
                      {item.frameSection || item.component || item.category}
                    </p>
                  </div>
                  <div className="flex flex-col items-end ml-2">
                    {item.mtsbTicketId && (
                      <span className="text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 bg-[#3EC1C5]/20 text-[#3EC1C5] rounded mb-0.5 sm:mb-1">
                        {item.mtsbTicketId}
                      </span>
                    )}
                    <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.lastRepairDate!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-xs sm:text-sm text-center py-3 sm:py-4">No recent entries</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 sm:p-3 md:p-4">
          <h2 className="text-sm sm:text-base md:text-lg font-semibold text-white mb-2 sm:mb-3">Category Distribution</h2>
          <div className="space-y-1.5 sm:space-y-2">
            {getCategoryStats().map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <p className="text-gray-300 text-xs sm:text-sm flex-shrink-0">{item.label}</p>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-[60px] sm:min-w-[80px] max-w-[120px] bg-gray-700 rounded-full h-1.5 sm:h-2 overflow-hidden">
                    <div 
                      className="bg-[#3EC1C5] h-full rounded-full transition-all"
                      style={{ width: `${stats.totalEntries > 0 ? (item.value / stats.totalEntries) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-white font-semibold text-xs sm:text-sm w-6 sm:w-8 text-right flex-shrink-0">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


