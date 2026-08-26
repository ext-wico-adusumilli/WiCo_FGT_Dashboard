import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ExternalLink, Columns3, Search, X } from 'lucide-react';
import { useToast } from '../Toast';
import { ConfirmDialog } from '../ConfirmDialog';
import { ExcelExport } from '../ExcelExport';
import { useTheme } from '../../contexts/ThemeContext';

interface ComponentData {
  _id: string;
  component: string;
  ataChapter: string;
  componentVersionNo?: string;
  componentLifetime: number;
  partNo?: string;
  dateOfInstallation?: string;
  totalFlightHours: number;
  mcFlightHours: number;
  fwFlightHours: number;
  mtsbTicketId?: string;
  mtsbTicketLink?: string;
}

interface GenericComponentTableProps {
  category: 'propulsion' | 'actuators' | 'controller' | 'communication';
  categoryLabel: string;
  filters: {
    uaName: string;
    ticket: string;
  };
}

export function GenericComponentTable({ category, categoryLabel, filters }: GenericComponentTableProps) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [data, setData] = useState<ComponentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showColumnToggle, setShowColumnToggle] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string | null }>({ show: false, id: null });
  const [sortConfig, setSortConfig] = useState<{ key: keyof ComponentData | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [visibleColumns, setVisibleColumns] = useState({
    component: true,
    ataChapter: true,
    componentVersionNo: true,
    componentLifetime: true,
    partNo: true,
    dateOfInstallation: true,
    totalFlightHours: true,
    mcFlightHours: true,
    fwFlightHours: true,
    mtsbTicketId: true,
  });

  const [formData, setFormData] = useState({
    component: '',
    ataChapter: '',
    componentVersionNo: '',
    componentLifetime: '',
    partNo: '',
    dateOfInstallation: '',
    totalFlightHours: '',
    mcFlightHours: '',
    fwFlightHours: '',
    mtsbTicketId: '',
    mtsbTicketLink: '',
  });

  useEffect(() => {
    fetchData();
  }, [filters, category]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const queryParams = new URLSearchParams({
        category,
        ...filters
      });

      const response = await fetch(
        `${API_BASE_URL}/api/mttf/data?${queryParams}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 404) {
        console.error('API endpoint not found. Make sure backend server is running.');
        showToast('Backend server not responding. Please start the server.', 'error');
      } else if (response.status === 401) {
        showToast('Session expired. Please login again.', 'error');
      } else {
        showToast('Error loading data', 'error');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Cannot connect to server. Make sure backend is running on port 3000.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const url = editingId
        ? `${API_BASE_URL}/api/mttf/data/${editingId}`
        : `${API_BASE_URL}/api/mttf/data`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category,
          ...formData,
          ...filters,
          componentLifetime: Number(formData.componentLifetime),
          totalFlightHours: Number(formData.totalFlightHours),
          mcFlightHours: Number(formData.mcFlightHours),
          fwFlightHours: Number(formData.fwFlightHours),
        })
      });

      if (response.ok) {
        showToast(editingId ? 'Updated successfully' : 'Added successfully', 'success');
        setShowAddModal(false);
        setEditingId(null);
        resetForm();
        fetchData();
      } else {
        showToast('Operation failed', 'error');
      }
    } catch (error) {
      console.error('Error saving data:', error);
      showToast('Error saving data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: ComponentData) => {
    setEditingId(item._id);
    setFormData({
      component: item.component,
      ataChapter: item.ataChapter,
      componentVersionNo: item.componentVersionNo || '',
      componentLifetime: item.componentLifetime.toString(),
      partNo: item.partNo || '',
      dateOfInstallation: item.dateOfInstallation ? item.dateOfInstallation.split('T')[0] : '',
      totalFlightHours: item.totalFlightHours.toString(),
      mcFlightHours: item.mcFlightHours.toString(),
      fwFlightHours: item.fwFlightHours.toString(),
      mtsbTicketId: item.mtsbTicketId || '',
      mtsbTicketLink: item.mtsbTicketLink || '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.id) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/api/mttf/data/${deleteConfirm.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        showToast('Deleted successfully', 'success');
        fetchData();
      } else {
        showToast('Delete failed', 'error');
      }
    } catch (error) {
      console.error('Error deleting data:', error);
      showToast('Error deleting data', 'error');
    } finally {
      setLoading(false);
      setDeleteConfirm({ show: false, id: null });
    }
  };

  const resetForm = () => {
    setFormData({
      component: '',
      ataChapter: '',
      componentVersionNo: '',
      componentLifetime: '',
      partNo: '',
      dateOfInstallation: '',
      totalFlightHours: '',
      mcFlightHours: '',
      fwFlightHours: '',
      mtsbTicketId: '',
      mtsbTicketLink: '',
    });
  };

  const getJiraLink = (item: ComponentData) => {
    if (!item.mtsbTicketId) return null;
    // Use custom link if provided, otherwise use default Jira link
    if (item.mtsbTicketLink) return item.mtsbTicketLink;
    return `https://your-jira-instance.atlassian.net/browse/${item.mtsbTicketId.replace(/\s+/g, '')}`;
  };

  const handleSort = (key: keyof ComponentData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getFilteredAndSortedData = () => {
    let filteredData = data.filter(item => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        item.component?.toLowerCase().includes(search) ||
        item.ataChapter?.toLowerCase().includes(search) ||
        item.componentVersionNo?.toLowerCase().includes(search) ||
        item.componentLifetime?.toString().includes(search) ||
        item.partNo?.toLowerCase().includes(search) ||
        item.totalFlightHours?.toString().includes(search) ||
        item.mcFlightHours?.toString().includes(search) ||
        item.fwFlightHours?.toString().includes(search) ||
        item.mtsbTicketId?.toLowerCase().includes(search)
      );
    });
    
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filteredData;
  };

  // Pagination calculations
  const filteredAndSortedData = getFilteredAndSortedData();
  const totalItems = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, endIndex);

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig]);

  return (
    <div className="space-y-2 w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={`text-xs sm:text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{categoryLabel} Data</h3>
          {(filters.uaName || filters.ticket) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {filters.uaName && (
                <span className="px-1.5 py-0.5 bg-[#3EC1C5]/20 text-[#3EC1C5] rounded text-xs">
                  Name: {filters.uaName}
                </span>
              )}
              {filters.ticket && (
                <span className="px-1.5 py-0.5 bg-[#3EC1C5]/20 text-[#3EC1C5] rounded text-xs">
                  Ticket: {filters.ticket}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {/* Search Bar */}
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className={`pl-7 pr-7 py-1.5 h-[30px] border rounded focus:outline-none focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5] transition text-xs w-40 ${
                isDark 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Excel Export */}
          <ExcelExport
            data={filteredAndSortedData.map(entry => ({
              'Component': entry.component ?? '-',
              'ATA Chapter': entry.ataChapter ?? '-',
              'Component Version No.': entry.componentVersionNo ?? '-',
              'Component Lifetime (Hrs)': entry.componentLifetime ?? '-',
              'Part No.': entry.partNo ?? '-',
              'Date of Installation': entry.dateOfInstallation ? new Date(entry.dateOfInstallation).toLocaleDateString() : '-',
              'Total Flight Hours': entry.totalFlightHours ?? '-',
              'MC Flight Hours': entry.mcFlightHours ?? '-',
              'FW Flight Hours': entry.fwFlightHours ?? '-',
              'MTSB Ticket ID': entry.mtsbTicketId ?? '-',
            }))}
            filename={`${category}_data`}
          />

          <div className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className={`flex items-center gap-1 px-2 py-1.5 h-[30px] rounded transition text-xs ${
                isDark 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Columns3 className="w-3 h-3" />
              <span className="text-xs">Columns</span>
            </button>
            {showColumnToggle && (
              <div className={`absolute right-0 mt-1 w-48 border rounded-lg shadow-lg p-2 z-50 max-h-64 overflow-y-auto ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <h4 className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Columns</h4>
                <div className="space-y-1">
                  {Object.entries(visibleColumns).map(([key, value]) => (
                    <label key={key} className={`flex items-center gap-1 text-xs cursor-pointer ${
                      isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'
                    }`}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                        className={`rounded w-3 h-3 ${
                          isDark 
                            ? 'border-gray-600 text-[#3EC1C5] focus:ring-[#3EC1C5]'
                            : 'border-gray-300 text-[#3EC1C5] focus:ring-[#3EC1C5]'
                        }`}
                      />
                      <span className="text-xs">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              resetForm();
              setShowAddModal(true);
            }}
            disabled={!filters.uaName}
            className="flex items-center gap-1 px-2 py-1.5 h-[30px] bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900 font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            title={!filters.uaName ? 'Please select UA Name filter first' : 'Add new entry'}
          >
            <Plus className="w-3 h-3" />
            <span className="text-xs">Add Entry</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[300px] border rounded-lg ${
        isDark ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs text-center min-w-max">
          <thead className={`text-xs uppercase sticky top-0 z-10 ${
            isDark 
              ? 'text-gray-400 bg-gray-700' 
              : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-3 py-2 w-16">S No.</th>
              {visibleColumns.component && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('component')}>
                  <div className="flex items-center justify-center gap-1">
                    Component
                    {sortConfig.key === 'component' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.ataChapter && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('ataChapter')}>
                  <div className="flex items-center justify-center gap-1">
                    ATA Chapter
                    {sortConfig.key === 'ataChapter' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.componentVersionNo && (
                <th className={`px-3 py-2 min-w-[150px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('componentVersionNo')}>
                  <div className="flex items-center justify-center gap-1">
                    Component Version No.
                    {sortConfig.key === 'componentVersionNo' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.componentLifetime && (
                <th className={`px-3 py-2 min-w-[150px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('componentLifetime')}>
                  <div className="flex items-center justify-center gap-1">
                    Component Lifetime (Hrs)
                    {sortConfig.key === 'componentLifetime' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.partNo && (
                <th className={`px-3 py-2 min-w-[100px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('partNo')}>
                  <div className="flex items-center justify-center gap-1">
                    Part No.
                    {sortConfig.key === 'partNo' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.dateOfInstallation && (
                <th className={`px-3 py-2 min-w-[130px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('dateOfInstallation')}>
                  <div className="flex items-center justify-center gap-1">
                    Date of Installation
                    {sortConfig.key === 'dateOfInstallation' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.totalFlightHours && (
                <th className={`px-3 py-2 min-w-[130px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('totalFlightHours')}>
                  <div className="flex items-center justify-center gap-1">
                    Total Flight Hours
                    {sortConfig.key === 'totalFlightHours' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.mcFlightHours && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('mcFlightHours')}>
                  <div className="flex items-center justify-center gap-1">
                    MC Flight Hours
                    {sortConfig.key === 'mcFlightHours' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.fwFlightHours && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('fwFlightHours')}>
                  <div className="flex items-center justify-center gap-1">
                    FW Flight Hours
                    {sortConfig.key === 'fwFlightHours' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              {visibleColumns.mtsbTicketId && (
                <th className={`px-3 py-2 min-w-[120px] cursor-pointer transition ${
                  isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
                }`} onClick={() => handleSort('mtsbTicketId')}>
                  <div className="flex items-center justify-center gap-1">
                    MTSB Ticket ID
                    {sortConfig.key === 'mtsbTicketId' && (
                      <span className={`${isDark ? 'text-[#3EC1C5]' : 'text-gray-900'}`}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              )}
              <th className="px-3 py-2 min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody className={`${isDark ? 'text-white' : 'text-gray-900'}`}>
            {loading ? (
              <tr>
                <td colSpan={11} className={`px-4 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading...
                </td>
              </tr>
            ) : !filters.uaName ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center">
                  <div className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <p className="mb-2">Please select UA Name filter to view data</p>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={11} className={`px-4 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No data available for the selected filters. Click "Add Entry" to create one.
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr key={item._id} className={`border-b transition ${
                  isDark ? 'border-gray-700 hover:bg-gray-700/30' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <td className={`px-3 py-2 font-medium text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{startIndex + index + 1}</td>
                  {visibleColumns.component && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.component}</td>}
                  {visibleColumns.ataChapter && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.ataChapter}</td>}
                  {visibleColumns.componentVersionNo && <td className={`px-3 py-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.componentVersionNo || '-'}</td>}
                  {visibleColumns.componentLifetime && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.componentLifetime}</td>}
                  {visibleColumns.partNo && <td className={`px-3 py-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.partNo || '-'}</td>}
                  {visibleColumns.dateOfInstallation && (
                    <td className={`px-3 py-2 text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.dateOfInstallation ? new Date(item.dateOfInstallation).toLocaleDateString() : '-'}
                    </td>
                  )}
                  {visibleColumns.totalFlightHours && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.totalFlightHours}</td>}
                  {visibleColumns.mcFlightHours && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.mcFlightHours}</td>}
                  {visibleColumns.fwFlightHours && <td className={`px-3 py-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.fwFlightHours}</td>}
                  {visibleColumns.mtsbTicketId && (
                    <td className="px-3 py-2 text-center">
                      {item.mtsbTicketId ? (
                        <a
                          href={getJiraLink(item) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#3EC1C5] hover:underline inline-flex items-center gap-1 justify-center"
                        >
                          {item.mtsbTicketId}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>-</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleEdit(item)}
                        className={`transition ${
                          isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ show: true, id: item._id })}
                        className={`transition ${
                          isDark ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                        }`}
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
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded text-xs focus:outline-none ${
                isDark
                  ? 'bg-gray-700 border border-gray-600 text-white focus:border-[#3EC1C5]'
                  : 'bg-white border border-gray-300 text-gray-900 focus:border-gray-900'
              }`}
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
              <option value={200}>200 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                    className={`px-2 py-1 text-xs rounded transition ${
                      currentPage === pageNum
                        ? isDark ? 'bg-[#3EC1C5] text-gray-900 font-semibold' : 'bg-gray-900 text-white font-semibold'
                        : isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
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
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <h3 className={`text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {editingId ? 'Edit Entry' : `New Entry in ${categoryLabel}`}
            </h3>

            {/* Display Filter Context */}
            {!editingId && (
              <div className={`mb-4 p-4 rounded-lg border ${
                isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>This entry will be created for:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className={`${isDark ? 'text-gray-500' : 'text-gray-600'}`}>UA Name:</span>
                    <span className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{filters.uaName || 'Not selected'}</span>
                  </div>
                  <div>
                    <span className={`${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Ticket:</span>
                    <span className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{filters.ticket || 'Not selected'}</span>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Component *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.component}
                    onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    ATA Chapter *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ataChapter}
                    onChange={(e) => setFormData({ ...formData, ataChapter: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Component Version No.
                  </label>
                  <input
                    type="text"
                    value={formData.componentVersionNo}
                    onChange={(e) => setFormData({ ...formData, componentVersionNo: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Component Lifetime (Hrs) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.componentLifetime}
                    onChange={(e) => setFormData({ ...formData, componentLifetime: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Part No.
                  </label>
                  <input
                    type="text"
                    value={formData.partNo}
                    onChange={(e) => setFormData({ ...formData, partNo: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Date of Installation
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfInstallation}
                    onChange={(e) => setFormData({ ...formData, dateOfInstallation: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Total Flight Hours *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.totalFlightHours}
                    onChange={(e) => setFormData({ ...formData, totalFlightHours: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    MC Flight Hours *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.mcFlightHours}
                    onChange={(e) => setFormData({ ...formData, mcFlightHours: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    FW Flight Hours *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.fwFlightHours}
                    onChange={(e) => setFormData({ ...formData, fwFlightHours: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    MTSB Ticket ID
                  </label>
                  <input
                    type="text"
                    value={formData.mtsbTicketId}
                    onChange={(e) => setFormData({ ...formData, mtsbTicketId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    MTSB Ticket Link
                  </label>
                  <input
                    type="url"
                    value={formData.mtsbTicketLink}
                    onChange={(e) => setFormData({ ...formData, mtsbTicketLink: e.target.value })}
                    placeholder="https://your-jira-instance.atlassian.net/browse/TICKET-123"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-[#3EC1C5] ${
                      isDark 
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Optional: Custom URL for the MTSB ticket. If not provided, will use default Jira link.</p>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                    resetForm();
                  }}
                  className={`px-4 py-2 rounded-lg transition ${
                    isDark 
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}


