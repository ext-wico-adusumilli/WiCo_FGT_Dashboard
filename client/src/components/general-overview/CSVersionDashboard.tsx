import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Monitor, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  flight_time: number;
  flight: boolean;
  cs_version: string;
}

interface CSVersionDashboardProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  selectedCSVersions?: string[];
  csVersionDateRange?: { start: string | null; end: string | null };
}

export function CSVersionDashboard({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  selectedCSVersions = [],
  csVersionDateRange = { start: null, end: null }
}: CSVersionDashboardProps) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

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
      
      setLogEntries(allEntries);
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

  // Filter log entries based on provided filters
  const filteredLogEntries = useMemo(() => {
    const activeDateRange = dateRange.start || dateRange.end ? dateRange : csVersionDateRange;
    const activeSNs = selectedSNs.length > 0 ? selectedSNs : [];

    return logEntries.filter(entry => {
      // SN filter (filter by UA SN)
      const matchesSN = activeSNs.length === 0 || activeSNs.includes(entry.sn);
      
      // Date range filter
      let matchesDate = true;
      if (activeDateRange.start || activeDateRange.end) {
        const entryDate = parseDateForComparison(entry.date);
        if (entryDate) {
          if (activeDateRange.start && activeDateRange.end) {
            matchesDate = entryDate >= activeDateRange.start && entryDate <= activeDateRange.end;
          } else if (activeDateRange.start) {
            matchesDate = entryDate >= activeDateRange.start;
          } else if (activeDateRange.end) {
            matchesDate = entryDate <= activeDateRange.end;
          }
        } else {
          matchesDate = false;
        }
      }
      
      // Only include entries with valid CS version
      const hasValidCSVersion = entry.cs_version && entry.cs_version.trim() !== '';
      
      return matchesSN && matchesDate && hasValidCSVersion;
    });
  }, [logEntries, selectedSNs, dateRange, csVersionDateRange]);

  // Filter by CS versions if provided
  const finalEntries = useMemo(() => {
    if (selectedCSVersions.length === 0) return filteredLogEntries;
    return filteredLogEntries.filter(entry => selectedCSVersions.includes(entry.cs_version));
  }, [filteredLogEntries, selectedCSVersions]);

  const stats = useMemo(() => {
    const uniqueCSVersions = new Set(finalEntries.map(e => e.cs_version)).size;
    
    // Calculate total flight time
    const totalFlightTime = finalEntries.reduce((sum, entry) => sum + entry.flight_time, 0);

    return {
      uniqueCSVersions,
      totalFlightTime,
    };
  }, [finalEntries]);

  // Format time from seconds to HH:MM:SS
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
      clickable: false,
    },
    {
      icon: <Clock className="w-6 h-6" />,
      label: 'Total Flight Time [HH:MM:SS]',
      value: formatTime(stats.totalFlightTime),
      color: 'text-orange-400',
      clickable: false,
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


