import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { CloudRain, Thermometer, Droplets, Gauge, MapPin, Database, X, Wind, Cloud, CloudRainWind, Zap, Plane  } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface WeatherDashboardStats {
  totalEntries: number;
  maxTemperature: number;
  minTemperature: number;
  avgTemperature: number;
  maxHumidity: number;
  minHumidity: number;
  avgHumidity: number;
  maxPressure: number;
  minPressure: number;
  avgPressure: number;
  maxDensityAltitude: number;
  minDensityAltitude: number;
  avgDensityAltitude: number;
  maxWind: number;
  minWind: number;
  avgWind: number;
  maxGust: number;
  minGust: number;
  avgGust: number;
  maxCloud: number;
  minCloud: number;
  avgCloud: number;
  maxRain: number;
  minRain: number;
  avgRain: number;
  uniqueLocations: number;
  uniqueUASNs: number;
  totalRainfall: number;
  locationsList: string[];
  uasnList: string[];
  source?: string;
}

interface WeatherDashboardOptimizedProps {
  selectedUASNs?: string[];
  selectedLocations?: string[];
  dateRange?: { start: string | null; end: string | null };
  weatherFilter?: { type: string; range: { min: number; max: number }; label: string; source?: string; matchingFlightLogs?: string[] } | null;
  onMetricClick?: (metric: 'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | 'gust' | null) => void;
  expandedMetric?: 'temperature' | 'humidity' | 'pressure' | 'densityAltitude' | 'wind' | 'rain' | 'cloud' | 'gust' | null;
}

export function WeatherDashboardOptimized({ 
  selectedUASNs = [], 
  selectedLocations = [], 
  dateRange = { start: null, end: null },
  weatherFilter = null,
  onMetricClick,
  expandedMetric
}: WeatherDashboardOptimizedProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [showUASNPopup, setShowUASNPopup] = useState(false);
  const [stats, setStats] = useState<WeatherDashboardStats>({
    totalEntries: 0,
    maxTemperature: 0,
    minTemperature: 0,
    avgTemperature: 0,
    maxHumidity: 0,
    minHumidity: 0,
    avgHumidity: 0,
    maxPressure: 0,
    minPressure: 0,
    avgPressure: 0,
    maxDensityAltitude: 0,
    minDensityAltitude: 0,
    avgDensityAltitude: 0,
    maxWind: 0,
    minWind: 0,
    avgWind: 0,
    maxGust: 0,
    minGust: 0,
    avgGust: 0,
    maxCloud: 0,
    minCloud: 0,
    avgCloud: 0,
    maxRain: 0,
    minRain: 0,
    avgRain: 0,
    uniqueLocations: 0,
    uniqueUASNs: 0,
    totalRainfall: 0,
    locationsList: [],
    uasnList: []
  });

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedUASNs, selectedLocations, dateRange, weatherFilter]);

  // Lock body scroll when popup is open
  useEffect(() => {
    if (showLocationPopup || showUASNPopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showLocationPopup, showUASNPopup]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams();
      
      if (selectedUASNs.length > 0) {
        params.append('uaSNs', selectedUASNs.join(','));
      }
      if (selectedLocations.length > 0) {
        // Use ||| as delimiter to handle locations with commas
        params.append('locations', selectedLocations.join('|||'));
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }
      if (weatherFilter && weatherFilter.type !== 'densityAltitude') {
        params.append('weatherFilter', JSON.stringify(weatherFilter));
      }

      const response = await fetch(
        `${API_BASE_URL}/weather-data/dashboard-stats?${params}`,
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

  const statCards = [
    {
      icon: <Database className="w-6 h-6" />,
      label: 'Total Entries',
      value: stats.totalEntries.toString(),
      color: 'text-[#3EC1C5]',
      clickable: false,
      showMinMax: false,
    },
    {
      icon: <MapPin className="w-6 h-6" />,
      label: 'Unique Locations',
      value: stats.uniqueLocations.toString(),
      color: 'text-pink-400',
      clickable: true,
      showMinMax: false,
    },
    {
      icon: <CloudRain className="w-6 h-6" />,
      label: 'Unique UA SNs',
      value: stats.uniqueUASNs.toString(),
      color: 'text-yellow-400',
      clickable: true,
      isUASN: true,
      showMinMax: false,
    },
    {
      icon: <Thermometer className="w-6 h-6" />,
      label: 'Temperature',
      color: 'text-orange-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minTemperature || 0).toFixed(1)}°C`,
      maxValue: `${(stats.maxTemperature || 0).toFixed(1)}°C`,
      metricType: 'temperature' as const,
    },
    {
      icon: <Droplets className="w-6 h-6" />,
      label: 'Humidity',
      color: 'text-blue-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minHumidity || 0).toFixed(1)}%`,
      maxValue: `${(stats.maxHumidity || 0).toFixed(1)}%`,
      metricType: 'humidity' as const,
    },
    {
      icon: <Gauge className="w-6 h-6" />,
      label: 'Pressure',
      color: 'text-purple-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minPressure || 0).toFixed(1)} hPa`,
      maxValue: `${(stats.maxPressure || 0).toFixed(1)} hPa`,
      metricType: 'pressure' as const,
    },
    {
      icon: <Plane className="w-6 h-6" />,
      label: 'Density Altitude',
      color: 'text-green-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minDensityAltitude || 0).toFixed(0)}`,
      maxValue: `${(stats.maxDensityAltitude || 0).toFixed(0)}`,
      metricType: 'densityAltitude' as const,
    },
    {
      icon: <Wind className="w-6 h-6" />,
      label: 'Average Wind Speed Over 6 Minutes',
      color: 'text-red-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minWind || 0).toFixed(1)} m/s`,
      maxValue: `${(stats.maxWind || 0).toFixed(1)} m/s`,
      metricType: 'wind' as const,
    },
    {
      icon: <Zap className="w-6 h-6" />,
      label: 'Gust',
      color: 'text-amber-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minGust || 0).toFixed(1)} m/s`,
      maxValue: `${(stats.maxGust || 0).toFixed(1)} m/s`,
      metricType: 'gust' as const,
    },
    {
      icon: <CloudRainWind className="w-6 h-6" />,
      label: 'Rain',
      color: 'text-cyan-400',
      clickable: true,
      showMinMax: true,
      minValue: `${(stats.minRain || 0).toFixed(1)} mm`,
      maxValue: `${(stats.maxRain || 0).toFixed(1)} mm`,
      metricType: 'rain' as const,
    },
    // {
    //   icon: <Cloud className="w-6 h-6" />,
    //   label: 'Cloud',
    //   color: 'text-gray-400',
    //   clickable: true,
    //   showMinMax: true,
    //   minValue: `${(stats.minCloud || 0).toFixed(1)}%`,
    //   maxValue: `${(stats.maxCloud || 0).toFixed(1)}%`,
    //   metricType: 'cloud' as const,
    // },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className={`rounded-lg p-3 sm:p-4 h-24 border relative ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
              {/* Skeleton for chips */}
              {i > 3 && (
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  <div className={`w-16 h-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                </div>
              )}
              {/* Skeleton for icon */}
              <div className={`w-6 h-6 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              {/* Skeleton for label */}
              <div className={`w-20 h-3 rounded mb-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              {/* Skeleton for content */}
              {i <= 3 ? (
                <div className={`w-12 h-6 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              ) : (
                <div className={`w-24 h-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Performance indicator */}
      {/* {stats.source && (
        <div className={`text-xs px-2 py-1 rounded inline-block ${
          stats.source === 'cache' 
            ? isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'
            : isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-100 text-blue-700'
        }`}>
          Data source: {stats.source} {stats.source === 'cache' ? '⚡' : '🔄'}
        </div>
      )} */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat, idx) => {
          const isExpanded = stat.metricType && expandedMetric === stat.metricType;
          return (
          <div
            key={idx}
            onClick={() => {
              if (stat.clickable) {
                if (stat.isUASN) {
                  setShowUASNPopup(true);
                } else if (stat.metricType) {
                  // Toggle metric expansion
                  if (onMetricClick) {
                    onMetricClick(isExpanded ? null : stat.metricType);
                  }
                } else {
                  setShowLocationPopup(true);
                }
              }
            }}
            className={`border rounded-lg p-3 sm:p-4 text-left relative transition-all duration-200 ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } ${
              stat.clickable
                ? isDark ? 'cursor-pointer hover:border-[#3EC1C5] hover:shadow-lg hover:scale-[1.02]' : 'cursor-pointer hover:border-gray-900 hover:shadow-lg hover:scale-[1.02]'
                : ''
            } ${
              isExpanded
                ? isDark ? 'border-[#3EC1C5] ring-2 ring-[#3EC1C5]/50 shadow-lg' : 'border-gray-900 ring-2 ring-gray-900/50 shadow-lg'
                : isDark ? 'border-gray-700' : 'border-gray-300'
            }`}
          >
            {/* Top right chips */}
            <div className="absolute top-1 right-2 flex flex-col gap-1">
              {/* Show Charts chip at the very top */}
              {stat.metricType && (
                <div className={`px-1.5 py-0.5 border text-[9px] font-medium rounded transition ${
                  isExpanded
                    ? isDark ? 'bg-[#3EC1C5]/20 border-[#3EC1C5]/40 text-[#3EC1C5]' : 'bg-teal-100 border-teal-200 text-teal-700'
                    : isDark ? 'bg-gray-600/20 border-gray-600/40 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}>
                  {isExpanded ? 'Hide Charts' : 'Show Charts'}
                </div>
              )}

              {/* Min/Max Chips below */}
              {/* {stat.showMinMax && (
                <div className="flex gap-1">
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded ${
                    isDark ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-blue-100 border-blue-200 text-blue-700'
                  }`}>
                    Min: {stat.minValue}
                  </div>
                  <div className={`px-2 py-0.5 border text-[10px] font-medium rounded ${
                    isDark ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-red-100 border-red-200 text-red-700'
                  }`}>
                    Max: {stat.maxValue}
                  </div>
                </div>
              )} */}
            </div>
            
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            
            {/* Label */}
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>

            {!stat.showMinMax && (
              <p className={`text-xl sm:text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
            )}
            
            {stat.showMinMax && (
              <div className="mt-1 space-y-1">
                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Range: <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>{stat.minValue}</span> - <span className={`${isDark ? 'text-white' : 'text-gray-900'} font-semibold`}>{stat.maxValue}</span>
                </p>
              </div>
            )}
          </div>
        );
        })}
      </div>

      {/* Locations Popup */}
      {showLocationPopup && (
        <div 
          className="fixed flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
          onClick={() => setShowLocationPopup(false)}
          style={{ 
            top: '-100px', 
            left: '-100px', 
            right: '-100px', 
            bottom: '-100px', 
            zIndex: 10000,
            width: 'calc(100vw + 200px)',
            height: 'calc(100vh + 200px)',
            margin: 0,
            padding: '100px'
          }}
        >
          <div 
            className={`rounded-lg max-w-md w-full max-h-[70vh] shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Unique Locations</h3>
              <button
                onClick={() => setShowLocationPopup(false)}
                className={`transition ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-3 max-h-[calc(70vh-60px)]">
              <div className="space-y-1.5">
                {stats.locationsList.length > 0 ? (
                  stats.locationsList.map((location, idx) => (
                    <div 
                      key={idx}
                      className={`px-3 py-2 rounded text-sm ${
                        isDark ? 'bg-gray-700/50 text-white' : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {location}
                    </div>
                  ))
                ) : (
                  <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No locations found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UA SNs Popup */}
      {showUASNPopup && (
        <div 
          className="fixed flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
          onClick={() => setShowUASNPopup(false)}
          style={{ 
            top: '-100px', 
            left: '-100px', 
            right: '-100px', 
            bottom: '-100px', 
            zIndex: 10000,
            width: 'calc(100vw + 200px)',
            height: 'calc(100vh + 200px)',
            margin: 0,
            padding: '100px'
          }}
        >
          <div 
            className={`rounded-lg max-w-md w-full max-h-[70vh] shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Unique UA SNs</h3>
              <button
                onClick={() => setShowUASNPopup(false)}
                className={`transition ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-3 max-h-[calc(70vh-60px)]">
              <div className="space-y-1.5">
                {stats.uasnList.length > 0 ? (
                  stats.uasnList.map((uasn, idx) => (
                    <div 
                      key={idx}
                      className={`px-3 py-2 rounded text-sm ${
                        isDark ? 'bg-gray-700/50 text-white' : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {uasn}
                    </div>
                  ))
                ) : (
                  <p className={`text-sm text-center py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No UA SNs found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


