import { API_BASE_URL } from '../../config/api';
import { useState, useEffect, useMemo } from 'react';
import { Search, Columns3, X, Plus, Edit2, Trash2, Eye } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ExcelExport } from '../ExcelExport';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../ConfirmDialog';
import { CustomSelect } from '../CustomSelect';
import { normalizeSerialNumber } from '../../utils/serialNumberUtils';

interface LogEntry {
  _id: string;
  key: string;
  sn: string;
  date: string;
  total_time: number;
  flight_time: number;
  filtered_flight_time: number;
  mc_time: number;
  fw_time: number;
  fc_version: string;
  cs_version: string;
  fwd_transitions: number;
  bwd_transitions: number;
  lte_loss: number;
  rth_loss: number;
  rth_logs: number;
  distance: number;
  fwd_distance: number;
  bwd_distance: number;
  max_mc_xy_deviation: number;
  max_mc_altitude_deviation: number;
  max_fw_xy_deviation: number | null;
  max_fw_altitude_deviation: number | null;
  battery_0_sn: string;
  battery_0_cycle: number;
  battery_0_max_temp: number;
  battery_0_remaining: number;
  battery_1_sn: string;
  battery_1_cycle: number;
  battery_1_max_temp: number;
  battery_1_remaining: number;
  calculated_groundspeed: number;
  last_usage: string;
  flight: boolean;
}

type SortField = keyof LogEntry;
type SortOrder = 'asc' | 'desc';

interface LogDetailsTableProps {
  selectedSNs?: string[];
  dateRange?: { start: string | null; end: string | null };
  flightFilter?: { type: string; range: { min: number; max: number }; label: string; source: string; matchingKeys: string[] } | null;
  onClearFlightFilter?: () => void;
}

export function LogDetailsTable({
  selectedSNs = [],
  dateRange = { start: null, end: null },
  flightFilter = null,
  onClearFlightFilter
}: LogDetailsTableProps) {
  const { theme } = useTheme();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('sn');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({
    show: false,
    id: null
  });
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    key: '',
    sn: '',
    date: '',
    total_time: '' as string | number,
    flight_time: '' as string | number,
    filtered_flight_time: '' as string | number,
    mc_time: '' as string | number,
    fw_time: '' as string | number,
    fc_version: '',
    cs_version: '',
    fwd_transitions: '' as string | number,
    bwd_transitions: '' as string | number,
    lte_loss: '' as string | number,
    rth_loss: '' as string | number,
    rth_logs: '' as string | number,
    distance: '' as string | number,
    fwd_distance: '' as string | number,
    bwd_distance: '' as string | number,
    max_mc_xy_deviation: '' as string | number,
    max_mc_altitude_deviation: '' as string | number,
    max_fw_xy_deviation: '' as string | number,
    max_fw_altitude_deviation: '' as string | number,
    battery_0_sn: '',
    battery_0_cycle: '' as string | number,
    battery_0_max_temp: '' as string | number,
    battery_0_remaining: '' as string | number,
    battery_1_sn: '',
    battery_1_cycle: '' as string | number,
    battery_1_max_temp: '' as string | number,
    battery_1_remaining: '' as string | number,
    calculated_groundspeed: '' as string | number,
    last_usage: '',
    flight: false,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    key: true,
    sn: true,
    date: true,
    total_time: true,
    flight_time: true,
    filtered_flight_time: true,
    mc_time: true,
    fw_time: true,
    fc_version: true,
    cs_version: true,
    fwd_transitions: true,
    bwd_transitions: true,
    lte_loss: true,
    rth_loss: true,
    rth_logs: true,
    distance: true,
    fwd_distance: true,
    bwd_distance: true,
    max_mc_xy_deviation: true,
    max_mc_altitude_deviation: true,
    max_fw_xy_deviation: true,
    max_fw_altitude_deviation: true,
    battery_0_sn: true,
    battery_0_cycle: true,
    battery_0_max_temp: true,
    battery_0_remaining: true,
    battery_1_sn: true,
    battery_1_cycle: true,
    battery_1_max_temp: true,
    battery_1_remaining: true,
    calculated_groundspeed: true,
    last_usage: true,
    flight: true,
  });

  useEffect(() => {
    fetchEntriesProgressively();
  }, []);

  const fetchEntriesProgressively = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const BATCH_SIZE = 2000; // Load 2000 records per batch
      let allEntries: LogEntry[] = [];
      let currentBatch = 1;
      let hasMoreData = true;

      // First, get total count quickly
      const countResponse = await fetch(
        `${API_BASE_URL}/log-details?limit=1&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (countResponse.ok) {
        const countData = await countResponse.json();
        const totalCount = countData.pagination?.total || 0;
        setLoadingProgress({ loaded: 0, total: totalCount });
        console.log(`📊 Total records: ${totalCount}`);
      }

      // Load first batch immediately
      console.log(`⏳ Loading batch 1...`);
      const firstResponse = await fetch(
        `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (firstResponse.ok) {
        const firstData = await firstResponse.json();
        const firstBatch = Array.isArray(firstData) ? firstData : firstData.data || [];
        allEntries = firstBatch;
        setEntries(allEntries);
        setLoadingProgress({ loaded: allEntries.length, total: firstData.pagination?.total || allEntries.length });
        console.log(`✅ Loaded ${allEntries.length} records - Page is now interactive!`);
        setLoading(false); // Page is now usable!

        hasMoreData = firstData.pagination?.hasMore || false;
        currentBatch = 2;
      }

      // Load remaining batches in background
      while (hasMoreData) {
        console.log(`⏳ Loading batch ${currentBatch} in background...`);
        const response = await fetch(
          `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=${currentBatch}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.ok) {
          const data = await response.json();
          const batch = Array.isArray(data) ? data : data.data || [];

          if (batch.length > 0) {
            allEntries = [...allEntries, ...batch];
            setEntries(allEntries);
            setLoadingProgress({ loaded: allEntries.length, total: data.pagination?.total || allEntries.length });
            console.log(`✅ Loaded ${allEntries.length} total records`);
          }

          hasMoreData = data.pagination?.hasMore || false;
          currentBatch++;
        } else {
          break;
        }
      }

      console.log(`🎉 All ${allEntries.length} records loaded!`);
    } catch (error) {
      console.error('Error fetching log details:', error);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      key: '',
      sn: '',
      date: '',
      total_time: '',
      flight_time: '',
      filtered_flight_time: '',
      mc_time: '',
      fw_time: '',
      fc_version: '',
      cs_version: '',
      fwd_transitions: '',
      bwd_transitions: '',
      lte_loss: '',
      rth_loss: '',
      rth_logs: '',
      distance: '',
      fwd_distance: '',
      bwd_distance: '',
      max_mc_xy_deviation: '',
      max_mc_altitude_deviation: '',
      max_fw_xy_deviation: '',
      max_fw_altitude_deviation: '',
      battery_0_sn: '',
      battery_0_cycle: '',
      battery_0_max_temp: '',
      battery_0_remaining: '',
      battery_1_sn: '',
      battery_1_cycle: '',
      battery_1_max_temp: '',
      battery_1_remaining: '',
      calculated_groundspeed: '',
      last_usage: '',
      flight: false,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/log-details`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            sn: normalizeSerialNumber(formData.sn),
            total_time: formData.total_time === '' ? 0 : Number(formData.total_time),
            flight_time: formData.flight_time === '' ? 0 : Number(formData.flight_time),
            filtered_flight_time: formData.filtered_flight_time === '' ? 0 : Number(formData.filtered_flight_time),
            mc_time: formData.mc_time === '' ? 0 : Number(formData.mc_time),
            fw_time: formData.fw_time === '' ? 0 : Number(formData.fw_time),
            fwd_transitions: formData.fwd_transitions === '' ? 0 : Number(formData.fwd_transitions),
            bwd_transitions: formData.bwd_transitions === '' ? 0 : Number(formData.bwd_transitions),
            lte_loss: formData.lte_loss === '' ? 0 : Number(formData.lte_loss),
            rth_loss: formData.rth_loss === '' ? 0 : Number(formData.rth_loss),
            rth_logs: formData.rth_logs === '' ? 0 : Number(formData.rth_logs),
            distance: formData.distance === '' ? 0 : Number(formData.distance),
            fwd_distance: formData.fwd_distance === '' ? 0 : Number(formData.fwd_distance),
            bwd_distance: formData.bwd_distance === '' ? 0 : Number(formData.bwd_distance),
            max_mc_xy_deviation: formData.max_mc_xy_deviation === '' ? 0 : Number(formData.max_mc_xy_deviation),
            max_mc_altitude_deviation: formData.max_mc_altitude_deviation === '' ? 0 : Number(formData.max_mc_altitude_deviation),
            max_fw_xy_deviation: formData.max_fw_xy_deviation === '' ? null : Number(formData.max_fw_xy_deviation),
            max_fw_altitude_deviation: formData.max_fw_altitude_deviation === '' ? null : Number(formData.max_fw_altitude_deviation),
            battery_0_cycle: formData.battery_0_cycle === '' ? 0 : Number(formData.battery_0_cycle),
            battery_0_max_temp: formData.battery_0_max_temp === '' ? 0 : Number(formData.battery_0_max_temp),
            battery_0_remaining: formData.battery_0_remaining === '' ? 0 : Number(formData.battery_0_remaining),
            battery_1_cycle: formData.battery_1_cycle === '' ? 0 : Number(formData.battery_1_cycle),
            battery_1_max_temp: formData.battery_1_max_temp === '' ? 0 : Number(formData.battery_1_max_temp),
            battery_1_remaining: formData.battery_1_remaining === '' ? 0 : Number(formData.battery_1_remaining),
            calculated_groundspeed: formData.calculated_groundspeed === '' ? 0 : Number(formData.calculated_groundspeed),
          }),
        }
      );

      if (response.ok) {
        showToast('Log detail added successfully', 'success');
        setShowAddModal(false);
        resetForm();
        fetchEntriesProgressively();
      } else {
        const error = await response.json();
        showToast(error.message || 'Failed to add log detail', 'error');
      }
    } catch (error) {
      console.error('Error adding log detail:', error);
      showToast('Error adding log detail', 'error');
    }
  };

  const handleEdit = (entry: LogEntry) => {
    setEditingId(entry._id);
    setFormData({
      key: entry.key,
      sn: entry.sn,
      date: entry.date,
      total_time: entry.total_time,
      flight_time: entry.flight_time,
      filtered_flight_time: entry.filtered_flight_time,
      mc_time: entry.mc_time,
      fw_time: entry.fw_time,
      fc_version: entry.fc_version,
      cs_version: entry.cs_version,
      fwd_transitions: entry.fwd_transitions,
      bwd_transitions: entry.bwd_transitions,
      lte_loss: entry.lte_loss,
      rth_loss: entry.rth_loss,
      rth_logs: entry.rth_logs,
      distance: entry.distance,
      fwd_distance: entry.fwd_distance,
      bwd_distance: entry.bwd_distance,
      max_mc_xy_deviation: entry.max_mc_xy_deviation,
      max_mc_altitude_deviation: entry.max_mc_altitude_deviation,
      max_fw_xy_deviation: entry.max_fw_xy_deviation ?? '',
      max_fw_altitude_deviation: entry.max_fw_altitude_deviation ?? '',
      battery_0_sn: entry.battery_0_sn,
      battery_0_cycle: entry.battery_0_cycle,
      battery_0_max_temp: entry.battery_0_max_temp,
      battery_0_remaining: entry.battery_0_remaining,
      battery_1_sn: entry.battery_1_sn,
      battery_1_cycle: entry.battery_1_cycle,
      battery_1_max_temp: entry.battery_1_max_temp,
      battery_1_remaining: entry.battery_1_remaining,
      calculated_groundspeed: entry.calculated_groundspeed,
      last_usage: entry.last_usage,
      flight: entry.flight,
    });
    setShowAddModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/log-details/${editingId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            sn: normalizeSerialNumber(formData.sn),
            total_time: formData.total_time === '' ? 0 : Number(formData.total_time),
            flight_time: formData.flight_time === '' ? 0 : Number(formData.flight_time),
            filtered_flight_time: formData.filtered_flight_time === '' ? 0 : Number(formData.filtered_flight_time),
            mc_time: formData.mc_time === '' ? 0 : Number(formData.mc_time),
            fw_time: formData.fw_time === '' ? 0 : Number(formData.fw_time),
            fwd_transitions: formData.fwd_transitions === '' ? 0 : Number(formData.fwd_transitions),
            bwd_transitions: formData.bwd_transitions === '' ? 0 : Number(formData.bwd_transitions),
            lte_loss: formData.lte_loss === '' ? 0 : Number(formData.lte_loss),
            rth_loss: formData.rth_loss === '' ? 0 : Number(formData.rth_loss),
            rth_logs: formData.rth_logs === '' ? 0 : Number(formData.rth_logs),
            distance: formData.distance === '' ? 0 : Number(formData.distance),
            fwd_distance: formData.fwd_distance === '' ? 0 : Number(formData.fwd_distance),
            bwd_distance: formData.bwd_distance === '' ? 0 : Number(formData.bwd_distance),
            max_mc_xy_deviation: formData.max_mc_xy_deviation === '' ? 0 : Number(formData.max_mc_xy_deviation),
            max_mc_altitude_deviation: formData.max_mc_altitude_deviation === '' ? 0 : Number(formData.max_mc_altitude_deviation),
            max_fw_xy_deviation: formData.max_fw_xy_deviation === '' ? null : Number(formData.max_fw_xy_deviation),
            max_fw_altitude_deviation: formData.max_fw_altitude_deviation === '' ? null : Number(formData.max_fw_altitude_deviation),
            battery_0_cycle: formData.battery_0_cycle === '' ? 0 : Number(formData.battery_0_cycle),
            battery_0_max_temp: formData.battery_0_max_temp === '' ? 0 : Number(formData.battery_0_max_temp),
            battery_0_remaining: formData.battery_0_remaining === '' ? 0 : Number(formData.battery_0_remaining),
            battery_1_cycle: formData.battery_1_cycle === '' ? 0 : Number(formData.battery_1_cycle),
            battery_1_max_temp: formData.battery_1_max_temp === '' ? 0 : Number(formData.battery_1_max_temp),
            battery_1_remaining: formData.battery_1_remaining === '' ? 0 : Number(formData.battery_1_remaining),
            calculated_groundspeed: formData.calculated_groundspeed === '' ? 0 : Number(formData.calculated_groundspeed),
          }),
        }
      );

      if (response.ok) {
        showToast('Log detail updated successfully', 'success');
        setShowAddModal(false);
        setEditingId(null);
        resetForm();
        fetchEntriesProgressively();
      } else {
        const error = await response.json();
        showToast(error.message || 'Failed to update log detail', 'error');
      }
    } catch (error) {
      console.error('Error updating log detail:', error);
      showToast('Error updating log detail', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/log-details/${deleteConfirm.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        showToast('Log detail deleted successfully', 'success');
        setDeleteConfirm({ show: false, id: null });
        fetchEntriesProgressively();
      } else {
        const error = await response.json();
        showToast(error.message || 'Failed to delete log detail', 'error');
      }
    } catch (error) {
      console.error('Error deleting log detail:', error);
      showToast('Error deleting log detail', 'error');
    }
  };

  // Parse date from date field (YYMMDD format)
  const parseDateFromField = (dateStr: string): string => {
    try {
      if (dateStr.length === 6) {
        const year = '20' + dateStr.substring(0, 2);
        const month = dateStr.substring(2, 4);
        const day = dateStr.substring(4, 6);
        return `${year}-${month}-${day}`;
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return 'Unknown';
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // SN filter
      const matchesSN = selectedSNs.length === 0 || selectedSNs.includes(entry.sn);
      
      // Date range filter
      let matchesDate = true;
      if (dateRange.start || dateRange.end) {
        const entryDate = parseDateFromField(entry.date);
        if (entryDate !== 'Unknown') {
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

      // Flight filter (from chart clicks)
      let matchesFlight = true;
      if (flightFilter && flightFilter.matchingKeys && flightFilter.matchingKeys.length > 0) {
        matchesFlight = flightFilter.matchingKeys.includes(entry.key);
      }

      // Search query filter
      const matchesSearch = !searchQuery || 
        entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.sn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.fc_version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.cs_version.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSN && matchesDate && matchesFlight && matchesSearch;
    });
  }, [entries, selectedSNs, dateRange, flightFilter, searchQuery]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filteredEntries, sortField, sortOrder]);

  // Pagination calculations
  const totalItems = sortedEntries.length;
  const effectiveItemsPerPage = itemsPerPage >= totalItems ? totalItems : itemsPerPage;
  const totalPages = Math.ceil(totalItems / effectiveItemsPerPage);
  const startIndex = (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = startIndex + effectiveItemsPerPage;
  const paginatedEntries = sortedEntries.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  // Helper function to convert meters to kilometers
  const formatDistance = (meters: number): string => {
    if (meters === null || meters === undefined) return '-';
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(2)} km`;
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-8 border ${
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      }`}>
        <div className={`text-center ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <div className="mb-2">Loading initial data...</div>
          {loadingProgress.total > 0 && (
            <div className="text-xs">
              Loading first batch of {loadingProgress.total.toLocaleString()} records
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Actions - Aligned Right */}
      <div className="flex justify-between items-center gap-2 mb-3">
        {/* Active Flight Filter Display */}
        {flightFilter && (
          <div className={`flex items-center gap-2 px-3 py-1.5 border border-[#3EC1C5] rounded-lg ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
          }`}>
            <span className={`text-xs ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <span className="text-[#3EC1C5] font-medium">Flight Analysis</span>
              {' - '}
              <span className="capitalize">{flightFilter.type === 'flightTime' ? 'Flight Time' : 'Distance'}</span> = {flightFilter.label}
            </span>
            {onClearFlightFilter && (
              <button
                onClick={onClearFlightFilter}
                className={`transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {!flightFilter && <div></div>}

        <div className="flex items-center gap-2">
        {/* Loading Progress */}
        {loadingProgress.loaded > 0 && loadingProgress.loaded < loadingProgress.total && (
          <div className={`text-xs px-2 py-1 rounded ${
            theme === 'dark' ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'
          }`}>
            Loading: {loadingProgress.loaded.toLocaleString()} / {loadingProgress.total.toLocaleString()}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search..."
            className={`pl-7 pr-7 py-1.5 h-[30px] border rounded transition text-xs w-40 focus:outline-none ${
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${
                theme === 'dark' 
                  ? 'text-gray-400 hover:text-white' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Excel Export */}
        <ExcelExport
          data={sortedEntries}
          filename="log_details"
        />

        {/* Column Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumnToggle(!showColumnToggle)}
            className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            <Columns3 className="w-3 h-3" />
            <span className="text-xs">Columns</span>
          </button>
          {showColumnToggle && (
            <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-lg p-2 z-50 max-h-64 overflow-y-auto border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-300'
            }`}>
              <h4 className={`text-xs font-semibold mb-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Columns</h4>
              <div className="space-y-1">
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${
                    theme === 'dark' 
                      ? 'text-gray-300 hover:text-white' 
                      : 'text-gray-700 hover:text-gray-900'
                  }`}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                      className={`rounded w-3 h-3 ${
                        theme === 'dark'
                          ? 'border-gray-600 text-[#3EC1C5] focus:ring-[#3EC1C5]'
                          : 'border-gray-300 text-gray-900 focus:ring-gray-900'
                      }`}
                    />
                    <span className="text-xs">
                      {key === 'key' ? 'Key (.ulg)' : 
                       key === 'distance' ? 'Distance (km)' :
                       key === 'fwd_distance' ? 'Fwd Distance (km)' :
                       key === 'bwd_distance' ? 'Bwd Distance (km)' :
                       key.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add Entry Button */}
        <button
          onClick={() => {
            setEditingId(null);
            resetForm();
            setShowAddModal(true);
          }}
          className={`flex items-center gap-1 px-2 py-1.5 h-[30px] font-semibold rounded transition text-xs ${
            theme === 'dark'
              ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          <Plus className="w-3 h-3" />
          <span className="text-xs">Add Entry</span>
        </button>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            theme === 'dark' 
              ? 'text-gray-400 bg-gray-700' 
              : 'text-gray-700 bg-gray-100'
          }`}>
              <tr>
                <th className="px-3 py-2 w-16">S. No</th>
                {Object.keys(visibleColumns).map((col) => {
                  const column = col as keyof typeof visibleColumns;
                  if (!visibleColumns[column]) return null;
                  
                  return (
                    <th 
                      key={column}
                      onClick={() => handleSort(column as SortField)}
                      className="px-3 py-2 min-w-[100px] cursor-pointer hover:bg-gray-600 transition"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {column === 'key' ? 'Key (.ulg)' : 
                         column === 'distance' ? 'Distance (km)' :
                         column === 'fwd_distance' ? 'Fwd Distance (km)' :
                         column === 'bwd_distance' ? 'Bwd Distance (km)' :
                         column.replace(/_/g, ' ')}
                        {sortField === column && (
                          <span className="text-[#3EC1C5]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 min-w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={Object.keys(visibleColumns).length + 1} className="px-4 py-8 text-center text-gray-400">
                    No log details found
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry, index) => (
                  <tr key={entry._id} className={`transition ${
                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                  }`}>
                    <td className={`px-3 py-2 text-xs ${
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    }`}>{startIndex + index + 1}</td>
                    {Object.keys(visibleColumns).map((col) => {
                      const column = col as keyof typeof visibleColumns;
                      if (!visibleColumns[column]) return null;
                      
                      const value = entry[column as keyof LogEntry];
                      
                      // Special rendering for flight column
                      if (column === 'flight') {
                        return (
                          <td key={column} className="px-3 py-2 text-xs">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              value 
                                ? theme === 'dark'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-green-100 text-green-700'
                                : theme === 'dark'
                                  ? 'bg-gray-600/50 text-gray-400'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>
                              {value ? 'TRUE' : 'FALSE'}
                            </span>
                          </td>
                        );
                      }
                      
                      // Render numeric values with special formatting for distance fields
                      if (typeof value === 'number') {
                        // Convert distance fields from meters to kilometers
                        if (column === 'distance' || column === 'fwd_distance' || column === 'bwd_distance') {
                          return (
                            <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {formatDistance(value)}
                            </td>
                          );
                        }
                        
                        // Render other numeric values as-is
                        return (
                          <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {value}
                          </td>
                        );
                      }
                      
                      // Render null/empty values
                      if (value === null || value === undefined || value === '') {
                        return (
                          <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            -
                          </td>
                        );
                      }
                      
                      // Special rendering for key column (flight log file)
                      if (column === 'key') {
                        return (
                          <td key={column} className={`px-3 py-2 font-mono text-xs whitespace-nowrap ${
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          }`}>
                            {String(value)}
                          </td>
                        );
                      }
                      
                      // Default string rendering
                      return (
                        <td key={column} className={`px-3 py-2 text-xs whitespace-nowrap ${
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {String(value)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className={`transition ${
                            theme === 'dark'
                              ? 'text-blue-400 hover:text-blue-300'
                              : 'text-gray-600 hover:text-gray-700'
                          }`}
                          title="View Details"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleEdit(entry)}
                          className={`transition ${
                            theme === 'dark'
                              ? 'text-[#3EC1C5] hover:text-[#35a9ad]'
                              : 'text-gray-600 hover:text-gray-700'
                          }`}
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ show: true, id: entry._id })}
                          className={`transition ${
                            theme === 'dark'
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-red-500 hover:text-red-600'
                          }`}
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-2">
            <div className={`flex items-center gap-2 text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <span>
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
              </span>
              <div className="w-24">
                <CustomSelect
                  value={itemsPerPage.toString()}
                  onChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: '25', label: '25 per page' },
                    { value: '50', label: '50 per page' },
                    { value: '100', label: '100 per page' },
                    { value: '200', label: '200 per page' },
                    { value: totalItems.toString(), label: 'All' }
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              {totalPages > 1 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-2 py-1 text-xs rounded transition ${currentPage === pageNum
                              ? theme === 'dark'
                                ? 'bg-[#3EC1C5] text-gray-900'
                                : 'bg-gray-900 text-white'
                              : theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                  >
                    Last
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`rounded-lg max-w-4xl w-full my-8 border ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`sticky top-0 px-6 py-4 flex items-center justify-between border-b ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {editingId ? 'Edit Log Entry' : 'Add Log Entry'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingId(null);
                  resetForm();
                }}
                className={`transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editingId ? handleUpdate : handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                {/* Key */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Key (.ulg) *</label>
                  <input
                    type="text"
                    required
                    placeholder="058.250820_10-19-00.001.ulg"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* SN */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>SN *</label>
                  <input
                    type="text"
                    required
                    value={formData.sn}
                    onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Date */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Date (YYMMDD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="250820"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Total Time */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Total Time</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.total_time}
                    onChange={(e) => setFormData({ ...formData, total_time: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Flight Time */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Flight Time</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.flight_time}
                    onChange={(e) => setFormData({ ...formData, flight_time: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Filtered Flight Time */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Filtered Flight Time</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.filtered_flight_time}
                    onChange={(e) => setFormData({ ...formData, filtered_flight_time: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* MC Time */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>MC Time</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.mc_time}
                    onChange={(e) => setFormData({ ...formData, mc_time: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* FW Time */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>FW Time</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.fw_time}
                    onChange={(e) => setFormData({ ...formData, fw_time: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* FC Version */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>FC Version</label>
                  <input
                    type="text"
                    value={formData.fc_version}
                    onChange={(e) => setFormData({ ...formData, fc_version: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* CS Version */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>CS Version</label>
                  <input
                    type="text"
                    value={formData.cs_version}
                    onChange={(e) => setFormData({ ...formData, cs_version: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Fwd Transitions */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Fwd Transitions</label>
                  <input
                    type="number"
                    value={formData.fwd_transitions}
                    onChange={(e) => setFormData({ ...formData, fwd_transitions: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Bwd Transitions */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Bwd Transitions</label>
                  <input
                    type="number"
                    value={formData.bwd_transitions}
                    onChange={(e) => setFormData({ ...formData, bwd_transitions: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* LTE Loss */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>LTE Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lte_loss}
                    onChange={(e) => setFormData({ ...formData, lte_loss: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* RTH Loss */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>RTH Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.rth_loss}
                    onChange={(e) => setFormData({ ...formData, rth_loss: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* RTH Logs */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>RTH Logs</label>
                  <input
                    type="number"
                    value={formData.rth_logs}
                    onChange={(e) => setFormData({ ...formData, rth_logs: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Distance */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Distance (meters)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.distance}
                    onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Fwd Distance */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Fwd Distance (meters)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.fwd_distance}
                    onChange={(e) => setFormData({ ...formData, fwd_distance: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Bwd Distance */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Bwd Distance (meters)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.bwd_distance}
                    onChange={(e) => setFormData({ ...formData, bwd_distance: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Max MC XY Deviation */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Max MC XY Deviation</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.max_mc_xy_deviation}
                    onChange={(e) => setFormData({ ...formData, max_mc_xy_deviation: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Max MC Altitude Deviation */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Max MC Altitude Deviation</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.max_mc_altitude_deviation}
                    onChange={(e) => setFormData({ ...formData, max_mc_altitude_deviation: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Max FW XY Deviation */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Max FW XY Deviation</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.max_fw_xy_deviation}
                    onChange={(e) => setFormData({ ...formData, max_fw_xy_deviation: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Max FW Altitude Deviation */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Max FW Altitude Deviation</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.max_fw_altitude_deviation}
                    onChange={(e) => setFormData({ ...formData, max_fw_altitude_deviation: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 0 SN */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 0 SN</label>
                  <input
                    type="text"
                    value={formData.battery_0_sn}
                    onChange={(e) => setFormData({ ...formData, battery_0_sn: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 0 Cycle */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 0 Cycle</label>
                  <input
                    type="number"
                    value={formData.battery_0_cycle}
                    onChange={(e) => setFormData({ ...formData, battery_0_cycle: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 0 Max Temp */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 0 Max Temp</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.battery_0_max_temp}
                    onChange={(e) => setFormData({ ...formData, battery_0_max_temp: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 0 Remaining */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 0 Remaining</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.battery_0_remaining}
                    onChange={(e) => setFormData({ ...formData, battery_0_remaining: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 1 SN */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 1 SN</label>
                  <input
                    type="text"
                    value={formData.battery_1_sn}
                    onChange={(e) => setFormData({ ...formData, battery_1_sn: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 1 Cycle */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 1 Cycle</label>
                  <input
                    type="number"
                    value={formData.battery_1_cycle}
                    onChange={(e) => setFormData({ ...formData, battery_1_cycle: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 1 Max Temp */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 1 Max Temp</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.battery_1_max_temp}
                    onChange={(e) => setFormData({ ...formData, battery_1_max_temp: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Battery 1 Remaining */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Battery 1 Remaining</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.battery_1_remaining}
                    onChange={(e) => setFormData({ ...formData, battery_1_remaining: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Calculated Groundspeed */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Calculated Groundspeed</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.calculated_groundspeed}
                    onChange={(e) => setFormData({ ...formData, calculated_groundspeed: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Last Usage */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Last Usage</label>
                  <input
                    type="text"
                    placeholder="2025-08-20 08:19:00"
                    value={formData.last_usage}
                    onChange={(e) => setFormData({ ...formData, last_usage: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:outline-none ${
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white focus:ring-[#3EC1C5] focus:border-[#3EC1C5]'
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-gray-900 focus:border-gray-900'
                    }`}
                  />
                </div>

                {/* Flight */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Flight</label>
                  <CustomSelect
                    value={formData.flight ? 'true' : 'false'}
                    onChange={(value) => setFormData({ ...formData, flight: value === 'true' })}
                    options={[
                      { value: 'true', label: 'TRUE' },
                      { value: 'false', label: 'FALSE' }
                    ]}
                    placeholder="Select..."
                  />
                </div>
              </div>

              <div className={`flex gap-3 mt-6 pt-4 border-t ${
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                    theme === 'dark'
                      ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {editingId ? 'Update Entry' : 'Add Entry'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className={`px-4 py-2 rounded-lg transition text-sm font-medium ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${
            theme === 'dark' 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className={`sticky top-0 px-6 py-4 flex items-center justify-between border-b ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Log Details</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className={`transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(selectedEntry).map(([key, value]) => {
                  if (key === '_id') return null;
                  return (
                    <div key={key} className="flex flex-col">
                      <span className={`text-xs uppercase mb-1 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>
                        {value === null || value === undefined || value === '' 
                          ? '(empty)' 
                          : typeof value === 'boolean'
                          ? value ? 'TRUE' : 'FALSE'
                          : typeof value === 'number'
                          ? value.toFixed(6)
                          : String(value)
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete Log Entry"
        message="Are you sure you want to delete this log entry? This action cannot be undone."
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}


