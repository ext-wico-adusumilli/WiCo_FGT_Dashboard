import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Plane, Clock, FileText, Route } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  distance: number;
  flight: boolean;
}

interface SNOverviewDashboardProps {
  onMetricClick?: (metric: 'flightTime' | 'distance' | null) => void;
  expandedMetric?: 'flightTime' | 'distance' | null;
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
}

export function SNOverviewDashboard({
  onMetricClick,
  expandedMetric,
  selectedSNs = [],
  dateRange = { start: null, end: null }
}: SNOverviewDashboardProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedSNs]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const BATCH_SIZE = 2000; // Match table batch size
      let allEntries: LogEntry[] = [];
      let currentBatch = 1;
      let hasMoreData = true;

      // Load all data in batches to match table behavior
      while (hasMoreData) {
        // Build query parameters for server-side filtering
        const params = new URLSearchParams();
        params.append('limit', BATCH_SIZE.toString());
        params.append('page', currentBatch.toString());
        params.append('flight', 'true'); // Only fetch flight entries

        const response = await fetch(
          `${API_BASE_URL}/log-details?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const response_data = await response.json();
          // Handle both old format (direct array) and new format (with pagination)
          const data = Array.isArray(response_data) ? response_data : response_data.data || [];
          
          if (data.length === 0) {
            hasMoreData = false;
          } else {
            allEntries = [...allEntries, ...data];
            currentBatch++;
            
            // If we got less than the batch size, we've reached the end
            if (data.length < BATCH_SIZE) {
              hasMoreData = false;
            }
          }
        } else {
          hasMoreData = false;
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Error fetching log details data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Parse date from YYMMDD format to YYYY-MM-DD for comparison
  const parseDateForComparison = (dateStr: string): string => {
    if (!dateStr || dateStr.length !== 6) return '';
    
    const year = '20' + dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    
    return `${year}-${month}-${day}`;
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // SN filter
      const matchesSN = selectedSNs.length === 0 || selectedSNs.includes(entry.sn);
      
      // Date range filter
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = parseDateForComparison(entry.date);
        if (entryDate) {
          if (dateRange.start && dateRange.end) {
            matchesDate = entryDate >= dateRange.start && entryDate <= dateRange.end;
          } else if (dateRange.start) {
            matchesDate = entryDate >= dateRange.start;
          } else if (dateRange.end) {
            matchesDate = entryDate <= dateRange.end;
          }
        } else {
          matchesDate = false;
        }
      }
      
      return matchesSN && matchesDate;
    });
  }, [entries, selectedSNs, dateRange]);

  const stats = useMemo(() => {
    const uniqueCopters = new Set(filteredEntries.map(e => e.sn)).size;
    
    // Get flight times in seconds and calculate total
    const flightTimesInSeconds = filteredEntries.map(entry => entry.flight_time);
    const totalFlightTime = flightTimesInSeconds.reduce((sum, time) => sum + time, 0);
    
    // Get distances and calculate total
    const distances = filteredEntries.map(entry => entry.distance || 0);
    const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);
    
    // Convert to HH:MM:SS format for display
    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    
    const totalFlightTimeFormatted = formatTime(totalFlightTime);
    
    // Count total ULOG files (unique keys)
    const totalUlogFiles = filteredEntries.length;

    return {
      uniqueCopters,
      totalFlightTimeFormatted,
      totalUlogFiles,
      totalDistance: totalDistance / 1000, // Convert to km
    };
  }, [filteredEntries]);

  const statCards = [
    {
      icon: <Plane className="w-6 h-6" />,
      label: 'Total Copters',
      value: stats.uniqueCopters.toString(),
      color: 'text-[#3EC1C5]',
      clickable: false,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Total Flight Time [HH:MM:SS]',
      value: stats.totalFlightTimeFormatted,
      color: 'text-orange-400',
      clickable: false,
    },
    {
      icon: <Route className="w-6 h-6" />,
      label: 'Total Distance',
      value: `${stats.totalDistance.toFixed(1)} km`,
      color: 'text-blue-400',
      clickable: false,
    },
    {
      icon: <FileText className="w-6 h-6" />,
      label: 'Total Flight Log Count',
      value: stats.totalUlogFiles.toString(),
      color: 'text-purple-400',
      clickable: false,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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


