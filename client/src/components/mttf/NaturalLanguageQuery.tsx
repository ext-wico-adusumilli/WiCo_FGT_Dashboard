import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from '../../config/api';
import { Search, Sparkles, AlertCircle, ExternalLink, Lightbulb, Code, Ticket, Wrench, Tag, X } from 'lucide-react';
import { ExcelExport } from '../ExcelExport';

interface JiraIssue {
  key: string;
  id: string;
  issueType: string;
  summary: string;
  status: string;
  priority: string;
  assignee: string;
  created: string;
  updated: string;
  dueDate: string | null;
  url: string;
  // Custom fields
  componentTask: string | null;
  completionDate: string | null;
  affectedComponent: string | null;
  offComponentPN: string | null;
  offComponentSN: string | null;
  onComponentPN: string | null;
  onComponentSN: string | null;
}

interface QueryResult {
  query: string;
  entities: {
    parentTicket: string | null;
    componentType: string | null;
    taskType: string | null;
    componentNumber: number | null;
  };
  validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  jql: string;
  confidence: number;
  suggestions: string[];
  results: {
    total: number;
    issues: JiraIssue[];
  };
}

interface NaturalLanguageQueryProps {
  // Props for state persistence
  persistedState?: {
    query: string;
    result: QueryResult | null;
    showJQL: boolean;
    currentPage: number;
    itemsPerPage: number;
    queryMode: 'natural' | 'jql';
  };
  onStateChange?: (state: {
    query: string;
    result: QueryResult | null;
    showJQL: boolean;
    currentPage: number;
    itemsPerPage: number;
    queryMode: 'natural' | 'jql';
  }) => void;
}

const EXAMPLE_QUERIES = [
  'show ESC replacements under MTSP-52',
  'motor replacements in MTSP-52',
  'find all motor 3 replacements under MTSP-52',
  'show battery repairs under MTSP-45',
  'propeller maintenance in MTSP-52',
];

export function NaturalLanguageQuery({ persistedState, onStateChange }: NaturalLanguageQueryProps = {}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [query, setQuery] = useState(persistedState?.query || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(persistedState?.result || null);
  const [showJQL, setShowJQL] = useState(persistedState?.showJQL || false);
  const [currentPage, setCurrentPage] = useState(persistedState?.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(persistedState?.itemsPerPage || 50);
  const [queryMode, setQueryMode] = useState<'natural' | 'jql'>(persistedState?.queryMode || 'natural');
  const [searchQuery, setSearchQuery] = useState('');

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange({
        query,
        result,
        showJQL,
        currentPage,
        itemsPerPage,
        queryMode,
      });
    }
  }, [query, result, showJQL, currentPage, itemsPerPage, queryMode, onStateChange]);

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentPage(1); // Reset to first page on new query

    try {
      const token = localStorage.getItem('auth_token');
      
      // Choose endpoint based on query mode
      const endpoint = queryMode === 'jql' 
        ? `${API_BASE_URL}/api/jira/query-jql`
        : `${API_BASE_URL}/api/jira/query`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryMode === 'jql' ? { jql: queryText } : { query: queryText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process query');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process query');
      console.error('Error processing query:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(query);
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    handleQuery(example);
  };

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

  // Filter issues based on search query
  const filteredIssues = useMemo(() => {
    if (!result?.results.issues) return [];
    
    if (!searchQuery.trim()) return result.results.issues;
    
    const query = searchQuery.toLowerCase();
    return result.results.issues.filter(issue => 
      issue.key.toLowerCase().includes(query) ||
      issue.summary.toLowerCase().includes(query) ||
      issue.status.toLowerCase().includes(query) ||
      issue.priority.toLowerCase().includes(query) ||
      issue.assignee.toLowerCase().includes(query) ||
      issue.issueType.toLowerCase().includes(query) ||
      (issue.componentTask && issue.componentTask.toLowerCase().includes(query)) ||
      (issue.affectedComponent && issue.affectedComponent.toLowerCase().includes(query))
    );
  }, [result?.results.issues, searchQuery]);

  // Pagination calculations
  const totalItems = filteredIssues.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIssues = filteredIssues.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`border rounded-lg p-4 ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3EC1C5]" />
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              JIRA Query Interface
            </h2>
          </div>
          {/* Query Mode Toggle */}
          <div className={`inline-flex rounded-lg p-0.5 border ${
            isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
          }`}>
            <button
              onClick={() => setQueryMode('natural')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                queryMode === 'natural'
                  ? isDark
                    ? 'bg-[#3EC1C5] text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Natural Language
            </button>
            <button
              onClick={() => setQueryMode('jql')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                queryMode === 'jql'
                  ? isDark
                    ? 'bg-[#3EC1C5] text-gray-900'
                    : 'bg-gray-900 text-white'
                  : isDark
                    ? 'text-gray-300 hover:text-white'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              JQL
            </button>
          </div>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {queryMode === 'natural' 
            ? 'Ask questions in plain English to search JIRA tickets. Try queries like "show ESC replacements under MTSP-52" or "motor 3 repairs in MTSP-45".'
            : 'Enter a JQL (JIRA Query Language) query directly. Example: "project = MTSP-52 AND component = ESC"'
          }
        </p>
      </div>

      {/* Query Input - Search bar and button on same line */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          {queryMode === 'natural' ? (
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`} />
          ) : (
            <Code className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`} />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={queryMode === 'natural' 
              ? 'e.g., show ESC replacements under MTSP-52'
              : 'e.g., project = MTSP-52 AND component = ESC'
            }
            className={`w-full pl-10 pr-4 py-3 border rounded-lg transition text-sm focus:outline-none ${
              queryMode === 'jql' ? 'font-mono' : ''
            } ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
            }`}
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className={`px-6 py-3 rounded-lg transition text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap ${
            isDark
              ? 'bg-[#3EC1C5] hover:bg-[#35a8ac] text-gray-900'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              <span>Search</span>
            </>
          )}
        </button>
      </form>

      {/* Example Queries - Only show for Natural Language mode */}
      {queryMode === 'natural' && (
        <div className={`border rounded-lg p-4 ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Example Queries
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`border rounded-lg p-4 ${
          isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Query Analysis - Card Layout (Only for Natural Language mode) */}
          {queryMode === 'natural' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Query Analysis
                </h3>
                <button
                  onClick={() => setShowJQL(!showJQL)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition ${
                    isDark
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  {showJQL ? 'Hide' : 'Show'} JQL
                </button>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className={`border rounded-lg p-3 sm:p-4 ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-blue-400">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Parent Ticket</p>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {result.entities?.parentTicket || 'N/A'}
                  </p>
                </div>
                
                <div className={`border rounded-lg p-3 sm:p-4 ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-purple-400">
                      <Tag className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Component</p>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {result.entities?.componentType ? 
                      `${result.entities.componentType.charAt(0).toUpperCase() + result.entities.componentType.slice(1)}${result.entities.componentNumber ? ` ${result.entities.componentNumber}` : ''}` 
                      : 'N/A'}
                  </p>
                </div>
                
                <div className={`border rounded-lg p-3 sm:p-4 ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-orange-400">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Task Type</p>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {result.entities?.taskType ? 
                      result.entities.taskType.charAt(0).toUpperCase() + result.entities.taskType.slice(1)
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {showJQL && (
                <div className={`border rounded-lg p-4 ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                }`}>
                  <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Generated JQL Query</p>
                  <div className={`p-3 rounded-lg font-mono text-xs ${
                    isDark ? 'bg-gray-900 text-green-400' : 'bg-gray-50 text-gray-900'
                  }`}>
                    {result.jql}
                  </div>
                </div>
              )}

              {result.suggestions && result.suggestions.length > 0 && (
                <div className={`border rounded-lg p-4 ${
                  result.validation && !result.validation.isValid
                    ? isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-300'
                    : isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'
                }`}>
                  <p className={`text-xs font-medium mb-2 ${
                    result.validation && !result.validation.isValid
                      ? isDark ? 'text-red-400' : 'text-red-800'
                      : isDark ? 'text-yellow-400' : 'text-yellow-800'
                  }`}>
                    {result.validation && !result.validation.isValid 
                      ? 'Validation Errors:' 
                      : 'Suggestions to improve your query:'}
                  </p>
                  <ul className={`text-xs space-y-1 ${
                    result.validation && !result.validation.isValid
                      ? isDark ? 'text-red-300' : 'text-red-700'
                      : isDark ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Results Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Results ({result.results.total})
                {searchQuery && ` - Filtered: ${filteredIssues.length}`}
              </h3>
              
              <div className="flex items-center gap-2">
                {/* Export Button */}
                {result.results.total > 0 && (
                  <ExcelExport
                    data={[]}
                    filename={`jira_query_results_${new Date().toISOString().split('T')[0]}`}
                    sheets={[
                      {
                        name: 'Query Results',
                        data: filteredIssues.map((issue, idx) => ({
                          'S. No': idx + 1,
                          'Issue Type': issue.issueType || '',
                          'Issue Key': issue.key || '',
                          'Issue ID': issue.id || '',
                          'Summary': issue.summary || '',
                          'Status': issue.status || '',
                          'Priority': issue.priority || '',
                          'Assignee': issue.assignee || '',
                          'Created': formatDate(issue.created),
                          'Updated': formatDate(issue.updated),
                          'Due Date': issue.dueDate ? formatDate(issue.dueDate) : '',
                          'Component Task': issue.componentTask || '',
                          'Completion Date': issue.completionDate ? formatDate(issue.completionDate) : '',
                          'Affected Component': issue.affectedComponent || '',
                          'OFF Component PN': issue.offComponentPN || '',
                          'OFF Component SN': issue.offComponentSN || '',
                          'ON Component PN': issue.onComponentPN || '',
                          'ON Component SN': issue.onComponentSN || '',
                          'URL': issue.url || '',
                        })),
                        columns: [
                          { key: 'S. No', label: 'S. No' },
                          { key: 'Issue Type', label: 'Issue Type' },
                          { key: 'Issue Key', label: 'Issue Key' },
                          { key: 'Issue ID', label: 'Issue ID' },
                          { key: 'Summary', label: 'Summary' },
                          { key: 'Status', label: 'Status' },
                          { key: 'Priority', label: 'Priority' },
                          { key: 'Assignee', label: 'Assignee' },
                          { key: 'Created', label: 'Created' },
                          { key: 'Updated', label: 'Updated' },
                          { key: 'Due Date', label: 'Due Date' },
                          { key: 'Component Task', label: 'Component Task' },
                          { key: 'Completion Date', label: 'Completion Date' },
                          { key: 'Affected Component', label: 'Affected Component' },
                          { key: 'OFF Component PN', label: 'OFF Component PN' },
                          { key: 'OFF Component SN', label: 'OFF Component SN' },
                          { key: 'ON Component PN', label: 'ON Component PN' },
                          { key: 'ON Component SN', label: 'ON Component SN' },
                          { key: 'URL', label: 'URL' },
                        ]
                      }
                    ]}
                    className={isDark ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'}
                  />
                )}
                
                {/* Search Bar */}
                {result.results.total > 0 && (
                  <div className="relative">
                    <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search results..."
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
                )}
              </div>
            </div>

            {result.results.total > 0 ? (
              <>
                <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[500px] border rounded-lg ${
                  isDark ? 'border-gray-700' : 'border-gray-300'
                }`}>
                  <table className="w-full text-xs">
                    <thead className={`text-xs uppercase sticky top-0 ${
                      isDark ? 'text-gray-400 bg-gray-700' : 'text-gray-700 bg-gray-100'
                    }`}>
                      <tr>
                        <th className="px-3 py-2 text-left whitespace-nowrap">S. No</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-28">Issue Type</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Key</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Summary</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Priority</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Assignee</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Created</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Updated</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Due Date</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Component Task</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Completion Date</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Affected Component</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">OFF PN</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">OFF SN</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">ON PN</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">ON SN</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Link</th>
                      </tr>
                    </thead>
                    <tbody className={isDark ? 'text-white' : 'text-gray-900'}>
                      {paginatedIssues.map((issue, index) => (
                        <tr 
                          key={`${issue.key}-${index}`}
                          className={`border-b transition ${
                            isDark 
                              ? 'border-gray-700 hover:bg-gray-700/50' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">{startIndex + index + 1}</td>
                          <td className="px-3 py-2">{issue.issueType || '-'}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{issue.key}</td>
                          <td className="px-3 py-2 max-w-xs truncate" title={issue.summary}>{issue.summary}</td>
                          <td className={`px-3 py-2 text-center whitespace-nowrap ${getStatusColor(issue.status)}`}>
                            {issue.status}
                          </td>
                          <td className={`px-3 py-2 text-center whitespace-nowrap ${getPriorityColor(issue.priority)}`}>
                            {issue.priority}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.assignee}</td>
                          <td className={`px-3 py-2 text-center whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatDate(issue.created)}
                          </td>
                          <td className={`px-3 py-2 text-center whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatDate(issue.updated)}
                          </td>
                          <td className={`px-3 py-2 text-center whitespace-nowrap ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {issue.dueDate ? formatDate(issue.dueDate) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.componentTask || '-'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {issue.completionDate ? formatDate(issue.completionDate) : '-'}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.affectedComponent || '-'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.offComponentPN || '-'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.offComponentSN || '-'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.onComponentPN || '-'}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">{issue.onComponentSN || '-'}</td>
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
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
              </>
            ) : (
              <div className={`border rounded-lg p-8 text-center ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  No tickets found matching your query
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
