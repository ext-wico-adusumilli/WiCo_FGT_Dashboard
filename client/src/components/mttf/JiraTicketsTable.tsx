import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from '../../config/api';
import { ExternalLink, RefreshCw, AlertCircle, Ticket, Search, X, User, Flag, CheckCircle, FileText, Edit } from 'lucide-react';
import { MultiSelect } from '../MultiSelect';
import { CustomSelect } from '../CustomSelect';
import { EditTicketKeyModal } from './EditTicketKeyModal';
import { ExcelExport } from '../ExcelExport';

interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string;
  created: string;
  updated: string;
  url: string;
}

interface JiraData {
  parent: JiraIssue;
  children: {
    total: number;
    issues: JiraIssue[];
  };
}

// Cache for JIRA data to avoid refetching on tab switches
let cachedJiraData: JiraData | null = null;
let cachedLastUpdated: Date | null = null;
let cachedTicketKey: string | null = null;

export function JiraTicketsTable() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [loading, setLoading] = useState(!cachedJiraData);
  const [error, setError] = useState<string | null>(null);
  const [jiraData, setJiraData] = useState<JiraData | null>(cachedJiraData);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(cachedLastUpdated);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchJiraTickets = async (forceRefresh = false) => {
    // If we have cached data and not forcing refresh, use cache
    if (!forceRefresh && cachedJiraData && cachedTicketKey) {
      setJiraData(cachedJiraData);
      setLastUpdated(cachedLastUpdated);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/jira/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limited by JIRA API. Please wait a moment and try again.');
        }
        throw new Error(`Failed to fetch JIRA tickets: ${response.statusText}`);
      }

      const data = await response.json();
      const now = new Date();
      
      // Update state
      setJiraData(data);
      setLastUpdated(now);
      
      // Update cache
      cachedJiraData = data;
      cachedLastUpdated = now;
      cachedTicketKey = data.parent.key;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch JIRA tickets');
      console.error('Error fetching JIRA tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTicketKey = async (newKey: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/jira/parent-key`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parentTicketKey: newKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update ticket key');
      }

      // Show success message
      setToast({ message: 'Ticket key updated successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);

      // Clear cache and force refresh with new ticket key
      cachedJiraData = null;
      cachedLastUpdated = null;
      cachedTicketKey = null;
      
      await fetchJiraTickets(true);
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    fetchJiraTickets();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'highest':
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-blue-500';
      case 'lowest':
        return 'text-gray-500';
      default:
        return isDark ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'done':
      case 'closed':
      case 'resolved':
        return 'text-green-500';
      case 'in progress':
      case 'in review':
        return 'text-blue-500';
      case 'to do':
      case 'open':
      case 'backlog':
        return 'text-gray-500';
      default:
        return isDark ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Filter and search logic
  const filteredIssues = useMemo(() => {
    if (!jiraData?.children.issues) return [];
    
    return jiraData.children.issues.filter(issue => {
      const matchesSearch = 
        issue.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.priority.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.assignee.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(issue.status);
      const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.includes(issue.priority);
      const matchesAssignee = selectedAssignees.length === 0 || selectedAssignees.includes(issue.assignee);
      
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
  }, [jiraData?.children.issues, searchQuery, selectedStatuses, selectedPriorities, selectedAssignees]);

  // Get unique values for filters
  const uniqueStatuses = useMemo(() => {
    if (!jiraData?.children.issues) return [];
    const statuses = new Set(jiraData.children.issues.map(issue => issue.status));
    return Array.from(statuses).sort();
  }, [jiraData?.children.issues]);

  const uniquePriorities = useMemo(() => {
    if (!jiraData?.children.issues) return [];
    const priorities = new Set(jiraData.children.issues.map(issue => issue.priority));
    return Array.from(priorities).sort();
  }, [jiraData?.children.issues]);

  const uniqueAssignees = useMemo(() => {
    if (!jiraData?.children.issues) return [];
    const assignees = new Set(jiraData.children.issues.map(issue => issue.assignee));
    return Array.from(assignees).sort();
  }, [jiraData?.children.issues]);

  // Create options for MultiSelect components
  const statusOptions = useMemo(() => 
    uniqueStatuses.map(status => ({ value: status, label: status }))
  , [uniqueStatuses]);

  const priorityOptions = useMemo(() => 
    uniquePriorities.map(priority => ({ value: priority, label: priority }))
  , [uniquePriorities]);

  const assigneeOptions = useMemo(() => 
    uniqueAssignees.map(assignee => ({ value: assignee, label: assignee }))
  , [uniqueAssignees]);

  // Pagination logic
  const totalItems = filteredIssues.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIssues = filteredIssues.slice(startIndex, endIndex);

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatuses, selectedPriorities, selectedAssignees]);

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedAssignees([]);
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Check if any filters are active
  const hasActiveFilters = selectedStatuses.length > 0 || selectedPriorities.length > 0 || selectedAssignees.length > 0 || searchQuery.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Filters and refresh button loading */}
        <div className="space-y-1">
          <div className={`w-12 h-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`}></div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`w-48 h-8 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`}></div>
            ))}
            <div className={`w-48 h-8 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`}></div>
          </div>
        </div>

        {/* Cards Loading */}
        <div className="space-y-2">
          <div className={`w-32 h-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`}></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`rounded-lg p-3 h-20 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} animate-pulse`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className={`w-16 h-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                </div>
                <div className={`w-20 h-4 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Loading */}
        <div className={`rounded-lg p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={`h-12 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border rounded-lg p-8 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="flex items-center justify-center text-red-500">
          <AlertCircle className="w-6 h-6" />
          <span className="ml-3">{error}</span>
        </div>
        <button
          onClick={() => fetchJiraTickets(true)}
          className={`mt-4 mx-auto block px-4 py-2 rounded-lg transition ${
            isDark
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
          }`}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!jiraData) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Filters and refresh button */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Filters:</span>
          {lastUpdated && (
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2 justify-between">
          <div className="flex flex-wrap items-start gap-2">
            <div className="w-48">
              <MultiSelect
                value={selectedStatuses}
                onChange={setSelectedStatuses}
                options={statusOptions}
                placeholder="All Statuses"
              />
            </div>
            <div className="w-48">
              <MultiSelect
                value={selectedPriorities}
                onChange={setSelectedPriorities}
                options={priorityOptions}
                placeholder="All Priorities"
              />
            </div>
            <div className="w-48">
              <MultiSelect
                value={selectedAssignees}
                onChange={setSelectedAssignees}
                options={assigneeOptions}
                placeholder="All Assignees"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className={`flex items-center gap-1 px-2 py-1 text-xs transition mt-1 ${
                  isDark 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <X className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
          <button
            onClick={() => fetchJiraTickets(true)}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition text-xs ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-300'
            } disabled:opacity-50`}
            title={`Last updated: ${lastUpdated ? lastUpdated.toLocaleString() : 'Never'}`}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Parent Issue Cards */}
      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Parent Ticket Details
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Ticket Key Card */}
          <div 
            className={`border rounded-lg p-3 text-left relative transition cursor-pointer ${
              isDark 
                ? 'bg-gray-800 border-gray-700 hover:border-[#3EC1C5]' 
                : 'bg-white border-gray-300 hover:border-gray-900'
            }`}
            onClick={() => setIsEditModalOpen(true)}
            title="Click to edit parent ticket key"
          >
            <div className="flex items-center gap-2 mb-2">
              <Ticket className="w-4 h-4 text-[#3EC1C5]" />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ticket Key</p>
              <Edit className="w-3 h-3 text-[#3EC1C5] ml-auto" />
            </div>
            <p className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {jiraData.parent.key}
            </p>
            <a
              href={jiraData.parent.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 right-2 text-[#3EC1C5] hover:text-[#35a8ac] transition"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Status Card */}
          <div className={`border rounded-lg p-3 text-left relative transition ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Status</p>
            </div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {jiraData.parent.status}
            </p>
          </div>

          {/* Priority Card */}
          <div className={`border rounded-lg p-3 text-left relative transition ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Flag className={`w-4 h-4 ${getPriorityColor(jiraData.parent.priority)}`} />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Priority</p>
            </div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {jiraData.parent.priority}
            </p>
          </div>

          {/* Assignee Card */}
          <div className={`border rounded-lg p-3 text-left relative transition ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-400" />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Assignee</p>
            </div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {jiraData.parent.assignee}
            </p>
          </div>

          {/* Summary Card */}
          <div className={`border rounded-lg p-3 text-left relative transition ${
            isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Summary</p>
            </div>
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'} overflow-hidden`} 
               style={{ 
                 display: '-webkit-box',
                 WebkitLineClamp: 2,
                 WebkitBoxOrient: 'vertical',
                 lineHeight: '1.2em',
                 maxHeight: '2.4em'
               }}
               title={jiraData.parent.summary}>
              {jiraData.parent.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Child Issues Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Child Work Items ({jiraData.children.total})
          </h3>
          
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <ExcelExport
              data={[]}
              filename={`jira_tickets_${jiraData.parent.key}`}
              sheets={[
                {
                  name: 'Parent Ticket',
                  data: [
                    {
                      'Field': 'Ticket Key',
                      'Value': jiraData.parent.key,
                    },
                    {
                      'Field': 'Summary',
                      'Value': jiraData.parent.summary,
                    },
                    {
                      'Field': 'Status',
                      'Value': jiraData.parent.status,
                    },
                    {
                      'Field': 'Priority',
                      'Value': jiraData.parent.priority,
                    },
                    {
                      'Field': 'Assignee',
                      'Value': jiraData.parent.assignee,
                    },
                    {
                      'Field': 'Created',
                      'Value': formatDate(jiraData.parent.created),
                    },
                    {
                      'Field': 'Updated',
                      'Value': formatDate(jiraData.parent.updated),
                    },
                  ],
                  columns: [
                    { key: 'Field', label: 'Field' },
                    { key: 'Value', label: 'Value' },
                  ]
                },
                {
                  name: 'Child Work Items',
                  data: filteredIssues.map((issue, idx) => ({
                    'S. No': idx + 1,
                    'Key': issue.key,
                    'Summary': issue.summary,
                    'Status': issue.status,
                    'Priority': issue.priority,
                    'Assignee': issue.assignee,
                    'Created': formatDate(issue.created),
                    'Updated': formatDate(issue.updated),
                    'URL': issue.url,
                  })),
                  columns: [
                    { key: 'S. No', label: 'S. No' },
                    { key: 'Key', label: 'Key' },
                    { key: 'Summary', label: 'Summary' },
                    { key: 'Status', label: 'Status' },
                    { key: 'Priority', label: 'Priority' },
                    { key: 'Assignee', label: 'Assignee' },
                    { key: 'Created', label: 'Created' },
                    { key: 'Updated', label: 'Updated' },
                    { key: 'URL', label: 'URL' },
                  ]
                }
              ]}
              className={isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'}
            />
            
            {/* Search Bar */}
            <div className="relative">
              <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                className={`pl-7 pr-7 py-1.5 h-[30px] border rounded transition text-xs w-48 focus:outline-none ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 transition ${
                    isDark 
                      ? 'text-gray-400 hover:text-white' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
          isDark ? 'border-gray-700' : 'border-gray-300'
        }`}>
          <table className="w-full text-xs">
            <thead className={`text-xs uppercase sticky top-0 ${
              isDark 
                ? 'text-gray-400 bg-gray-700' 
                : 'text-gray-700 bg-gray-100'
            }`}>
              <tr>
                <th className="px-3 py-2 w-16 text-center">S. No</th>
                <th className="px-3 py-2 w-32 text-left">Key</th>
                <th className="px-3 py-2 text-left">Summary</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Priority</th>
                <th className="px-3 py-2 text-center">Assignee</th>
                <th className="px-3 py-2 w-32 text-center">Updated</th>
                <th className="px-3 py-2 text-center">Link</th>
              </tr>
            </thead>
            <tbody className={isDark ? 'text-white' : 'text-gray-900'}>
              {paginatedIssues.length > 0 ? (
                paginatedIssues.map((issue, index) => (
                  <tr 
                    key={`${issue.key}-${index}`}
                    className={`border-b transition ${
                      isDark 
                        ? 'border-gray-700 hover:bg-gray-700/50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-2 text-center">{startIndex + index + 1}</td>
                    <td className="px-3 py-2 text-left font-mono">
                      {issue.key}
                    </td>
                    <td className="px-3 py-2 text-left">{issue.summary}</td>
                    <td className={`px-3 py-2 text-center ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </td>
                    <td className={`px-3 py-2 text-center ${getPriorityColor(issue.priority)}`}>
                      {issue.priority}
                    </td>
                    <td className="px-3 py-2 text-center">{issue.assignee}</td>
                    <td className={`px-3 py-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatDate(issue.updated)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <a
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-[#3EC1C5] hover:text-[#35a8ac] transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={8} 
                    className={`px-3 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {hasActiveFilters ? 'No tickets match your filters' : 'No child work items found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
          <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>
              Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} entries
              {hasActiveFilters && ` (filtered from ${jiraData?.children.total || 0} total)`}
            </span>
            <div className="w-32">
              <CustomSelect
                value={itemsPerPage.toString()}
                onChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
                options={[
                  { value: '10', label: '10 per page' },
                  { value: '25', label: '25 per page' },
                  { value: '50', label: '50 per page' },
                  { value: '100', label: '100 per page' }
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
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
                isDark
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
                    className={`px-2 py-1 text-xs rounded transition ${
                      currentPage === pageNum
                        ? isDark
                          ? 'bg-[#3EC1C5] text-gray-900 font-semibold'
                          : 'bg-gray-900 text-white font-semibold'
                        : isDark
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
                isDark
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
                isDark
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-xs text-gray-400 text-right">
        {hasActiveFilters 
          ? `Showing ${filteredIssues.length} of ${jiraData?.children.total || 0} child work items (filtered)`
          : `Showing ${jiraData?.children.issues.length || 0} child work items from parent ticket ${jiraData?.parent.key || ''}`
        }
      </div>

      {/* Edit Ticket Key Modal */}
      <EditTicketKeyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentKey={jiraData.parent.key}
        onSave={handleSaveTicketKey}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 ${
          toast.type === 'success'
            ? isDark
              ? 'bg-green-900/90 border-green-700 text-green-100'
              : 'bg-green-50 border-green-300 text-green-900'
            : isDark
              ? 'bg-red-900/90 border-red-700 text-red-100'
              : 'bg-red-50 border-red-300 text-red-900'
        }`}>
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
