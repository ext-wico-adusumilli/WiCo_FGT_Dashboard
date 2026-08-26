import { useMemo } from 'react';
import { Zap, Thermometer, Database } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface BatteryEntry {
  batterySN: string;
  batteryType: 'Battery 0' | 'Battery 1';
  ulogFiles: number;
  totalFlightTime: number;
  avgCycleCount: number;
  maxCycleCount: number;
  minCycleCount: number;
  avgMaxTemp: number;
  maxMaxTemp: number;
  minMaxTemp: number;
  avgRemaining: number;
  lastUsage: string;
  uaSN: string;
}

interface BatteryOverviewDashboardProps {
  onMetricClick?: (metric: 'cycleCount' | 'temperature' | 'flightTimeRange' | null) => void;
  expandedMetric?: 'cycleCount' | 'temperature' | 'flightTimeRange' | null;
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  selectedBatterySNs?: string[];
  batteryDateRange?: { start: string | null; end: string | null };
  batteryData?: Array<{
    batterySN: string;
    recentCycleCount: number;
    totalFlightTime: number;
    lastUsage: string;
    lastUaSN: string;
    flights: number;
    maxCycleCount: number;
    maxTemp: number;
  }>;
  loading?: boolean;
}

export function BatteryOverviewDashboard({
  onMetricClick,
  expandedMetric,
  selectedSNs = [],
  selectedBatterySNs = [],
  batteryData = [],
  loading = false
}: BatteryOverviewDashboardProps) {
  const { theme } = useTheme();

  // Convert batteryData to LogEntry format for compatibility
  const logEntries = useMemo(() => {
    return batteryData.map((item) => ({
      _id: item.batterySN,
      key: '',
      sn: item.lastUaSN,
      date: item.lastUsage,
      flight_time: item.totalFlightTime,
      flight: true,
      battery_0_sn: item.batterySN,
      battery_0_cycle: item.recentCycleCount,
      battery_0_max_temp: item.maxTemp,
      battery_0_remaining: 0,
      battery_1_sn: '',
      battery_1_cycle: 0,
      battery_1_max_temp: 0,
      battery_1_remaining: 0,
    }));
  }, [batteryData]);

  // Filter log entries based on provided filters
  const filteredLogEntries = useMemo(() => {
    const activeSNs = selectedSNs.length > 0 ? selectedSNs : [];

    return logEntries.filter(entry => {
      // SN filter (filter by UA SN)
      const matchesSN = activeSNs.length === 0 || activeSNs.includes(entry.sn);
      return matchesSN;
    });
  }, [logEntries, selectedSNs]);

  // Aggregate battery data from filtered log entries (already pre-aggregated from server)
  const aggregatedBatteries = useMemo((): BatteryEntry[] => {
    const batteryMap = new Map<string, BatteryEntry>();
    
    filteredLogEntries.forEach(entry => {
      // Process Battery 0 (main battery from server data)
      if (entry.battery_0_sn && entry.battery_0_sn.trim() !== '') {
        const key = entry.battery_0_sn;
        if (!batteryMap.has(key)) {
          batteryMap.set(key, {
            batterySN: entry.battery_0_sn,
            batteryType: 'Battery 0',
            ulogFiles: 1,
            totalFlightTime: entry.flight_time,
            avgCycleCount: entry.battery_0_cycle,
            maxCycleCount: entry.battery_0_cycle,
            minCycleCount: entry.battery_0_cycle,
            avgMaxTemp: entry.battery_0_max_temp,
            maxMaxTemp: entry.battery_0_max_temp,
            minMaxTemp: entry.battery_0_max_temp,
            avgRemaining: entry.battery_0_remaining,
            lastUsage: entry.date,
            uaSN: entry.sn,
          });
        }
      }
    });
    
    return Array.from(batteryMap.values());
  }, [filteredLogEntries]);

  // Filter by battery SNs if provided
  const finalBatteries = useMemo(() => {
    if (selectedBatterySNs.length === 0) return aggregatedBatteries;
    return aggregatedBatteries.filter(battery => selectedBatterySNs.includes(battery.batterySN));
  }, [aggregatedBatteries, selectedBatterySNs]);

  const stats = useMemo(() => {
    const totalBatteries = finalBatteries.length;
    const uniqueBatterySNs = new Set(finalBatteries.map(e => e.batterySN)).size;
    
    const cycleCounts = finalBatteries.map(e => e.maxCycleCount);
    const minCycleCount = cycleCounts.length > 0 ? Math.min(...cycleCounts) : 0;
    const maxCycleCount = cycleCounts.length > 0 ? Math.max(...cycleCounts) : 0;
    const totalCycleCount = finalBatteries.reduce((sum, e) => sum + e.maxCycleCount, 0);
    
    const temps = finalBatteries.map(e => e.maxMaxTemp);
    const minTemp = temps.length > 0 ? Math.min(...temps) : 0;
    const maxTemp = temps.length > 0 ? Math.max(...temps) : 0;

    const totalFlightTime = finalBatteries.reduce((sum, e) => sum + e.totalFlightTime, 0);
    const totalFlights = finalBatteries.reduce((sum, e) => sum + e.ulogFiles, 0);

    return {
      totalBatteries,
      uniqueBatterySNs,
      minCycleCount,
      maxCycleCount,
      totalCycleCount,
      minTemp,
      maxTemp,
      totalFlightTime,
      totalFlights,
      minFlightTime: 0,
      maxFlightTime: 0,
    };
  }, [finalBatteries]);

  const statCards = [
    {
      icon: <Database className="w-6 h-6" />,
      label: 'Unique Battery SNs',
      value: stats.uniqueBatterySNs.toString(),
      color: 'text-yellow-400',
      clickable: false,
    },
    {
      icon: <Zap className="w-6 h-6" />,
      label: 'Cycle Count Range',
      color: 'text-cyan-400',
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${stats.minCycleCount}`,
      maxValue: `Max: ${stats.maxCycleCount}`,
      metricType: 'cycleCount' as const,
    },
    {
      icon: <Thermometer className="w-6 h-6" />,
      label: 'Temperature Range',
      color: 'text-red-400',
      clickable: false,
      showMinMax: true,
      minValue: `Min: ${stats.minTemp.toFixed(2)}°C`,
      maxValue: `Max: ${stats.maxTemp.toFixed(2)}°C`,
      metricType: 'temperature' as const,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
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
                theme === 'dark' 
                  ? 'bg-gray-800' 
                  : 'bg-white'
              } ${
                stat.clickable 
                  ? 'cursor-pointer'
                  : ''
              } ${
                isExpanded 
                  ? theme === 'dark'
                    ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50'
                    : 'border-gray-900 ring-2 ring-gray-900/50'
                  : theme === 'dark'
                    ? 'border-gray-700'
                    : 'border-gray-300'
              }`}
            >

              
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
              {!stat.showMinMax && (
                <p className={`text-xl sm:text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              )}
              {stat.showMinMax && (
                <div className="mt-2 space-y-1">
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Range: <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.minValue}</span> - <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.maxValue}</span>
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

