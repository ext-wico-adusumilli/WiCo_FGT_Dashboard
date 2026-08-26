import { API_BASE_URL } from '../config/api';
import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, LayoutDashboard, Database, Settings, Ticket, Sparkles, Plane } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivileges } from '../hooks/usePrivileges';
import {
  MTTFFilters,
  MTTFCategoryNav,
  StructureAirframeTable,
  PropulsionSystemTable,
  ActuatorsTable,
  ControllerSensorTable,
  CommunicationUnitTable,
  JiraTicketsTable,
  NaturalLanguageQuery,
  FlightTimeAnalysis,
  type FilterValues,
  type MTTFCategory,
} from '../components/mttf';
import { cookieHelpers, COOKIE_KEYS } from '../utils/cookies';
import { MTTFDashboardSkeleton } from '../components/MTTFDashboardSkeleton';
import { MttfFilterManagementPage } from './MttfFilterManagementPage';

type MTTFTab = 'dashboard' | 'data' | 'filters' | 'jira' | 'nlquery' | 'flighttime';

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

export function MTTFPage() {
  const { theme } = useTheme();
  const { canAccessMTTFDashboard } = usePrivileges();
  const isDark = theme === 'dark';
  
  // Define tabs with privilege checks
  const tabs = [
    { 
      id: 'dashboard' as MTTFTab, 
      label: 'Dashboard', 
      icon: LayoutDashboard,
      show: canAccessMTTFDashboard('dashboard')
    },
    { 
      id: 'data' as MTTFTab, 
      label: 'Data', 
      icon: Database,
      show: canAccessMTTFDashboard('data')
    },
    { 
      id: 'jira' as MTTFTab, 
      label: 'JIRA Tickets', 
      icon: Ticket,
      show: canAccessMTTFDashboard('jiraTickets')
    },
    { 
      id: 'nlquery' as MTTFTab, 
      label: 'NL Query', 
      icon: Sparkles,
      show: canAccessMTTFDashboard('naturalLanguageQuery')
    },
    { 
      id: 'flighttime' as MTTFTab, 
      label: 'Flight Time', 
      icon: Plane,
      show: canAccessMTTFDashboard('flightTimeAnalysis')
    },
    { 
      id: 'filters' as MTTFTab, 
      label: 'Filters', 
      icon: Settings,
      show: canAccessMTTFDashboard('filters')
    },
  ].filter(tab => tab.show);

  const [activeTab, setActiveTab] = useState<MTTFTab>(() => {
    const saved = cookieHelpers.getFilterState<MTTFTab>(COOKIE_KEYS.MTTF_ACTIVE_TAB);
    const savedTab = saved || 'dashboard';
    
    // Check if saved tab is accessible
    if (tabs.find(t => t.id === savedTab)) {
      return savedTab;
    }
    
    // Return first accessible tab or default to first tab
    return tabs.length > 0 ? tabs[0].id : 'dashboard';
  });

  const [activeCategory, setActiveCategory] = useState<MTTFCategory>(() => {
    const saved = cookieHelpers.getFilterState<MTTFCategory>(COOKIE_KEYS.MTTF_ACTIVE_CATEGORY);
    return saved || 'structure';
  });

  const [filters, setFilters] = useState<FilterValues>(() => {
    const saved = cookieHelpers.getFilterState<FilterValues>(COOKIE_KEYS.MTTF_FILTERS);
    return saved || { uaName: '', ticket: '' };
  });

  const [loading, setLoading] = useState(true);
  const [mttfData, setMttfData] = useState<MTTFData[]>([]);
  const [stats, setStats] = useState({
    totalEntries: 0,
    totalFlightHours: 0,
    componentsNearLifetime: 0,
    recentMaintenance: 0,
  });

  // NLQ state management
  const [nlqState, setNlqState] = useState({
    query: '',
    result: null as any,
    showJQL: false,
    currentPage: 1,
    itemsPerPage: 50,
    queryMode: 'natural' as 'natural' | 'jql',
  });

  // Auto-switch to first accessible tab if current tab becomes inaccessible
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
      cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_ACTIVE_TAB, tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const sanitizedFilters = {
      uaName: filters.uaName || '',
      ticket: filters.ticket || ''
    };
    cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_FILTERS, sanitizedFilters);
  }, [filters]);

  useEffect(() => {
    const validCategories: MTTFCategory[] = ['structure', 'propulsion', 'actuators', 'controller', 'communication'];
    if (validCategories.includes(activeCategory)) {
      cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_ACTIVE_CATEGORY, activeCategory);
    }
  }, [activeCategory]);

  useEffect(() => {
    cookieHelpers.setFilterState(COOKIE_KEYS.MTTF_ACTIVE_TAB, activeTab);
  }, [activeTab]);

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
    
    const componentsNearLifetime = data.filter(item => {
      if (item.totalFlightHours && item.componentLifetime) {
        return (item.totalFlightHours / item.componentLifetime) > 0.8;
      }
      return false;
    }).length;

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

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const handleCategoryChange = (category: MTTFCategory) => {
    setActiveCategory(category);
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'structure':
        return <StructureAirframeTable filters={filters} />;
      case 'propulsion':
        return <PropulsionSystemTable filters={filters} />;
      case 'actuators':
        return <ActuatorsTable filters={filters} />;
      case 'controller':
        return <ControllerSensorTable filters={filters} />;
      case 'communication':
        return <CommunicationUnitTable filters={filters} />;
      default:
        return <p className="text-gray-300">Select a category to view data.</p>;
    }
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

  return (
    <div className="space-y-2 sm:space-y-3 w-full">
      {/* MTTF Navigation Tabs */}
      <div className="w-full overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 lg:mx-0 lg:px-0 lg:overflow-x-visible scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <div className={`rounded-md p-0.5 inline-flex min-w-max border ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex gap-0.5 whitespace-nowrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? isDark 
                        ? 'bg-[#3EC1C5] text-white'
                        : 'bg-gray-900 text-white'
                      : isDark 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && canAccessMTTFDashboard('dashboard') ? (
        loading ? (
          <MTTFDashboardSkeleton />
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {statCards.map((stat, idx) => (
                <div key={idx} className={`border rounded-lg p-3 sm:p-4 transition ${
                  isDark 
                    ? 'bg-gray-800 border-gray-700 hover:border-[#3EC1C5]' 
                    : 'bg-white border-gray-300 hover:border-gray-900'
                }`}>
                  <div className={`${stat.color} mb-2`}>{stat.icon}</div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className={`border rounded-lg p-3 sm:p-4 ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <h2 className={`text-base sm:text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Entries</h2>
                <div className="space-y-2">
                  {getRecentEntries().length > 0 ? (
                    getRecentEntries().map((item, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.uaName}</p>
                          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {item.frameSection || item.component || item.category}
                          </p>
                        </div>
                        <div className="flex flex-col items-end ml-2">
                          {item.mtsbTicketId && (
                            <span className="text-xs font-semibold px-2 py-0.5 bg-[#3EC1C5]/20 text-[#3EC1C5] rounded mb-1">
                              {item.mtsbTicketId}
                            </span>
                          )}
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {new Date(item.lastRepairDate!).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No recent entries</p>
                  )}
                </div>
              </div>

              <div className={`border rounded-lg p-3 sm:p-4 ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <h2 className={`text-base sm:text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Category Distribution</h2>
                <div className="space-y-2">
                  {getCategoryStats().map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.label}</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-24 rounded-full h-2 overflow-hidden ${
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          <div 
                            className="bg-[#3EC1C5] h-full rounded-full transition-all"
                            style={{ width: `${stats.totalEntries > 0 ? (item.value / stats.totalEntries) * 100 : 0}%` }}
                          />
                        </div>
                        <span className={`font-semibold text-sm w-8 text-right ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      ) : activeTab === 'data' && canAccessMTTFDashboard('data') ? (
        <>
          <MTTFFilters onFilterChange={handleFilterChange} initialFilters={filters} />
          <MTTFCategoryNav 
            activeCategory={activeCategory} 
            onCategoryChange={handleCategoryChange} 
          />
          <div className={`border rounded-lg p-2 sm:p-3 w-full ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            {renderCategoryContent()}
          </div>
        </>
      ) : activeTab === 'jira' && canAccessMTTFDashboard('jiraTickets') ? (
        <JiraTicketsTable />
      ) : activeTab === 'nlquery' && canAccessMTTFDashboard('naturalLanguageQuery') ? (
        <NaturalLanguageQuery 
          persistedState={nlqState}
          onStateChange={setNlqState}
        />
      ) : activeTab === 'flighttime' && canAccessMTTFDashboard('flightTimeAnalysis') ? (
        <FlightTimeAnalysis />
      ) : activeTab === 'filters' && canAccessMTTFDashboard('filters') ? (
        <MttfFilterManagementPage />
      ) : null}
    </div>
  );
}


