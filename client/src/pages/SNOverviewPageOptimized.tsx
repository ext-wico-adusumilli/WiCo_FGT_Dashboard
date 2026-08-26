import { useState, useEffect } from 'react';
import { Plane, Battery, ArrowLeftRight, Cpu, Monitor, Eye } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { usePrivileges } from '../hooks/usePrivileges';
import { cookies } from '../utils/cookies';
import { SNOverviewTableOptimized } from '../components/general-overview/SNOverviewTableOptimized';
import { BatteryOverviewTableOptimized } from '../components/general-overview/BatteryOverviewTableOptimized';
import { TransitionDistanceTableOptimized } from '../components/general-overview/TransitionDistanceTableOptimized';
import { FCVersionTableOptimized } from '../components/general-overview/FCVersionTableOptimized';
import { CSVersionTableOptimized } from '../components/general-overview/CSVersionTableOptimized';
import { OperationTypeTab } from '../components/operation-type/OperationTypeTab';

const GENERAL_TAB_KEY = 'general_overview_optimised_tab';

type GeneralTab = 'sn-overview' | 'battery-overview' | 'transition-distance' | 'fc-version' | 'cs-version' | 'operation-type';

export function SNOverviewPageOptimized() {
  const { theme } = useTheme();
  const { canAccessGeneralOverview } = usePrivileges();
  
  // Define tabs with privilege checks
  const tabs = [
    { 
      id: 'sn-overview' as GeneralTab, 
      label: 'SN Overview', 
      icon: Plane,
      show: canAccessGeneralOverview('snOverview')
    },
    { 
      id: 'battery-overview' as GeneralTab, 
      label: 'Battery Overview', 
      icon: Battery,
      show: canAccessGeneralOverview('batteryOverview')
    },
    { 
      id: 'transition-distance' as GeneralTab, 
      label: 'Transition Distance', 
      icon: ArrowLeftRight,
      show: canAccessGeneralOverview('transitionDistance')
    },
    { 
      id: 'fc-version' as GeneralTab, 
      label: 'FC Version', 
      icon: Cpu,
      show: canAccessGeneralOverview('fcVersion')
    },
    { 
      id: 'cs-version' as GeneralTab, 
      label: 'CS Version', 
      icon: Monitor,
      show: canAccessGeneralOverview('csVersion')
    },
    { 
      id: 'operation-type' as GeneralTab, 
      label: 'VLOS & BVLOS', 
      icon: Eye,
      show: canAccessGeneralOverview('vlosBvlos')
    },
  ].filter(tab => tab.show);

  const [activeTab, setActiveTab] = useState<GeneralTab>(() => {
    const saved = cookies.get(GENERAL_TAB_KEY);
    const savedTab = saved as GeneralTab;
    
    // Check if saved tab is accessible
    if (savedTab && tabs.find(t => t.id === savedTab)) {
      return savedTab;
    }
    
    // Return first accessible tab or default to first tab
    return tabs.length > 0 ? tabs[0].id : 'sn-overview';
  });
  
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  // Ensure active tab is always accessible
  useState(() => {
    if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  });

  // Save active tab to cookies
  const handleTabChange = (tab: GeneralTab) => {
    setActiveTab(tab);
    cookies.set(GENERAL_TAB_KEY, tab, { days: 30 });
  };

  // Auto-switch to first accessible tab if current tab becomes inaccessible
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
      cookies.set(GENERAL_TAB_KEY, tabs[0].id, { days: 30 });
    }
  }, [tabs, activeTab]);

  return (
    <div className="space-y-2 sm:space-y-3 w-full">
      {/* Header with Navigation Tabs */}
      <div className="w-full overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 lg:mx-0 lg:px-0 lg:overflow-x-visible scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <div className={`rounded-md p-0.5 inline-flex min-w-max border ${
          theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex gap-0.5 whitespace-nowrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? theme === 'dark' 
                        ? 'bg-[#3EC1C5] text-white' 
                        : 'bg-gray-900 text-white'
                      : theme === 'dark'
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
      <div className="w-full">
        {activeTab === 'sn-overview' && canAccessGeneralOverview('snOverview') ? (
          <SNOverviewTableOptimized />
        ) : activeTab === 'battery-overview' && canAccessGeneralOverview('batteryOverview') ? (
          <BatteryOverviewTableOptimized />
        ) : activeTab === 'transition-distance' && canAccessGeneralOverview('transitionDistance') ? (
          <TransitionDistanceTableOptimized 
            dateRange={dateRange} 
            onDateRangeChange={(start, end) => setDateRange({ start, end })}
          />
        ) : activeTab === 'fc-version' && canAccessGeneralOverview('fcVersion') ? (
          <FCVersionTableOptimized 
            dateRange={dateRange}
            onDateRangeChange={(start, end) => setDateRange({ start, end })}
          />
        ) : activeTab === 'cs-version' && canAccessGeneralOverview('csVersion') ? (
          <CSVersionTableOptimized 
            dateRange={dateRange}
            onDateRangeChange={(start: string | null, end: string | null) => setDateRange({ start, end })}
          />
        ) : (
          <OperationTypeTab />
        )}
      </div>
    </div>
  );
}

