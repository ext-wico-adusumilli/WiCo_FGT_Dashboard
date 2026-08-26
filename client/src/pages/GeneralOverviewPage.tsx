import { useState } from 'react';
import { Plane, Battery, ArrowLeftRight, Cpu, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { cookies } from '../utils/cookies';
import { SNOverviewTable } from '../components/general-overview/SNOverviewTable';
import { BatteryOverviewTable } from '../components/general-overview/BatteryOverviewTable';
import { TransitionDistanceTable } from '../components/general-overview/TransitionDistanceTable';
import { FCVersionTable } from '../components/general-overview/FCVersionTable';
import { CSVersionTable } from '../components/general-overview/CSVersionTable';
import { DateRangePicker } from '../components/DateRangePicker';

const GENERAL_TAB_KEY = 'general_overview_tab';

type GeneralTab = 'sn-overview' | 'battery-overview' | 'transition-distance' | 'fc-version' | 'cs-version';

export function GeneralOverviewPage() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<GeneralTab>(() => {
    const saved = cookies.get(GENERAL_TAB_KEY);
    return (saved as GeneralTab) || 'sn-overview';
  });
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  // Save active tab to cookies
  const handleTabChange = (tab: GeneralTab) => {
    setActiveTab(tab);
    cookies.set(GENERAL_TAB_KEY, tab, { days: 30 });
  };

  return (
    <div className="space-y-2 sm:space-y-3 w-full">
      {/* Header with Navigation Tabs and Date Filter */}
      <div className="flex items-center justify-between">
        <div className={`rounded-md p-0.5 w-fit border ${
          theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-gray-100 border-gray-300'
        }`}>
        <div className="flex gap-0.5">
          <button
            onClick={() => handleTabChange('sn-overview')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition w-32 ${
              activeTab === 'sn-overview'
                ? theme === 'dark' 
                  ? 'bg-[#3EC1C5] text-white' 
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Plane className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">SN Overview</span>
          </button>
          <button
            onClick={() => handleTabChange('battery-overview')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition w-36 ${
              activeTab === 'battery-overview'
                ? theme === 'dark' 
                  ? 'bg-[#3EC1C5] text-white' 
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Battery className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Battery Overview</span>
          </button>
          <button
            onClick={() => handleTabChange('transition-distance')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition w-40 ${
              activeTab === 'transition-distance'
                ? theme === 'dark' 
                  ? 'bg-[#3EC1C5] text-white' 
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Transition Distance</span>
          </button>
          <button
            onClick={() => handleTabChange('fc-version')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition w-32 ${
              activeTab === 'fc-version'
                ? theme === 'dark' 
                  ? 'bg-[#3EC1C5] text-white' 
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">FC Version</span>
          </button>
          <button
            onClick={() => handleTabChange('cs-version')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition w-32 ${
              activeTab === 'cs-version'
                ? theme === 'dark' 
                  ? 'bg-[#3EC1C5] text-white' 
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">CS Version</span>
          </button>
          </div>
        </div>
        
        {/* Date Range Filter - Only show for Transition Distance */}
        {activeTab === 'transition-distance' && (
          <div className="w-48">
            <DateRangePicker
              onApply={(start, end) => setDateRange({ start, end })}
              initialStart={dateRange.start}
              initialEnd={dateRange.end}
            />
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === 'sn-overview' ? (
          <SNOverviewTable />
        ) : activeTab === 'battery-overview' ? (
          <BatteryOverviewTable />
        ) : activeTab === 'transition-distance' ? (
          <TransitionDistanceTable 
            dateRange={dateRange} 
            onDateRangeChange={(start, end) => setDateRange({ start, end })}
          />
        ) : activeTab === 'fc-version' ? (
          <FCVersionTable />
        ) : (
          <CSVersionTable />
        )}
      </div>
    </div>
  );
}

