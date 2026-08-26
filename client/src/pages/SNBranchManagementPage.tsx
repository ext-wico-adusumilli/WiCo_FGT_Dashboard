import { API_BASE_URL } from '../config/api';
import { useState, useEffect, useMemo } from 'react';
import { MapPin, Edit2, Users, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/Toast';
import { MultiSelect } from '../components/MultiSelect';
import { normalizeSerialNumber } from '../utils/serialNumberUtils';
import branchesData from '../data/branches.json';

interface SNBranchMapping {
  _id: string;
  sn: string;
  branchName: string | null;
  status: 'assigned' | 'unassigned';
  assignedAt: string | null;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

interface EditingBranch {
  branchName: string;
  assignedSNs: string[];
}

interface CardPopupData {
  metricType?: 'totalSNs' | 'assignedSNs' | 'unassignedSNs';
  label?: string;
  value?: string;
  isVisible: boolean;
}

export function SNBranchManagementPage() {
  const { theme } = useTheme();
  const [mappings, setMappings] = useState<SNBranchMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [editingBranch, setEditingBranch] = useState<EditingBranch | null>(null);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [cardPopup, setCardPopup] = useState<CardPopupData>({ isVisible: false });
  const { showToast } = useToast();

  // Memoized statistics for better performance
  const statistics = useMemo(() => {
    const assignedMappings = mappings.filter(m => m.status === 'assigned');
    const unassignedMappings = mappings.filter(m => m.status === 'unassigned');
    
    return {
      totalSNs: mappings.length,
      assignedSNs: assignedMappings.length,
      unassignedSNs: unassignedMappings.length
    };
  }, [mappings]);

  // Create optimized table data with branch mappings using Map for O(1) lookups
  const tableData = useMemo(() => {
    // Group mappings by branch name for efficient lookup
    const branchMappingsMap = new Map<string, string[]>();
    
    // Initialize all branches with empty arrays
    branchesData.branches.forEach(branch => {
      branchMappingsMap.set(branch.name, []);
    });
    
    // Populate mappings efficiently (only assigned ones)
    mappings.filter(m => m.status === 'assigned' && m.branchName).forEach(mapping => {
      const existingMappings = branchMappingsMap.get(mapping.branchName!);
      if (existingMappings) {
        existingMappings.push(normalizeSerialNumber(mapping.sn));
      }
    });
    
    // Build table data
    return branchesData.branches.map(branch => {
      const assignedSNs = branchMappingsMap.get(branch.name) || [];
      // Sort for consistent display
      assignedSNs.sort();
      
      return {
        branchName: branch.name,
        branchCode: branch.code,
        assignedSNs,
        count: assignedSNs.length
      };
    });
  }, [mappings]);

  useEffect(() => {
    loadExistingData();
  }, []);

  // Load existing data without auto-assignment
  const loadExistingData = async () => {
    setLoading(true);
    try {
      await fetchMappings();
    } catch (error) {
      console.error('Error loading existing data:', error);
      showToast('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data and perform auto-assignments
  const refreshData = async () => {
    setRefreshing(true);
    try {
      await fetchMappings();
      await fetchAndStoreSNs();
      setLastRefreshed(new Date());
      showToast('Data refreshed and SNs updated', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      showToast('Error refreshing data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const processAutoAssignments = async (snToBranchMap: Map<string, string>) => {
    if (snToBranchMap.size === 0) return;

    try {
      const token = localStorage.getItem('auth_token');
      let assignedCount = 0;

      // Process assignments in batches
      const assignments = Array.from(snToBranchMap.entries());
      const batchSize = 10;

      for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async ([sn, branchName]) => {
          try {
            const response = await fetch(
              `${API_BASE_URL}/sn-branch-assignments`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ sn, branchName }),
              }
            );

            if (response.ok) {
              console.log(`Auto-assigned ${sn} to ${branchName}`);
              return true;
            } else {
              const error = await response.json();
              console.log(`Failed to assign ${sn}: ${error.message}`);
              return false;
            }
          } catch (error) {
            console.error(`Error assigning ${sn}:`, error);
            return false;
          }
        });

        const results = await Promise.all(batchPromises);
        assignedCount += results.filter(Boolean).length;
      }

      if (assignedCount > 0) {
        showToast(`Auto-assigned ${assignedCount} serial numbers based on location data`, 'success');
        // Refresh mappings to reflect the new assignments
        await fetchMappings();
      }
    } catch (error) {
      console.error('Error processing auto-assignments:', error);
    }
  };

  const fetchMappings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${API_BASE_URL}/sn-branch-assignments`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMappings(data);
      } else {
        showToast('Failed to fetch SN-Branch mappings', 'error');
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      showToast('Error fetching mappings', 'error');
    }
  };

  // Fetch all serial numbers and store them in the database
  const fetchAndStoreSNs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // Collect all unique SNs from both log details and weather data
      const uniqueSNs = new Set<string>();
      const snToBranchMap = new Map<string, string>();
      const locationToBranchMap = new Map<string, string>([
        ['malawi', 'Malawi'],
        ['spain', 'Spain'], 
        ['germany', 'Germany']
      ]);

      // Fetch both data sources in parallel with batch loading
      const BATCH_SIZE = 2000;
      
      // Fetch log details in batches
      let allLogData: any[] = [];
      let currentLogBatch = 1;
      let hasMoreLogData = true;

      while (hasMoreLogData) {
        const logDetailsResponse = await fetch(
          `${API_BASE_URL}/log-details?limit=${BATCH_SIZE}&page=${currentLogBatch}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (logDetailsResponse.ok) {
          const response_data = await logDetailsResponse.json();
          const logData = Array.isArray(response_data) ? response_data : response_data.data || [];
          
          if (logData.length === 0) {
            hasMoreLogData = false;
          } else {
            allLogData = [...allLogData, ...logData];
            currentLogBatch++;
            
            if (logData.length < BATCH_SIZE) {
              hasMoreLogData = false;
            }
          }
        } else {
          hasMoreLogData = false;
        }
      }

      // Fetch weather data in batches
      let allWeatherData: any[] = [];
      let currentWeatherBatch = 1;
      let hasMoreWeatherData = true;

      while (hasMoreWeatherData) {
        const weatherResponse = await fetch(
          `${API_BASE_URL}/weather-data?limit=${BATCH_SIZE}&page=${currentWeatherBatch}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (weatherResponse.ok) {
          const response_data = await weatherResponse.json();
          const weatherData = Array.isArray(response_data) ? response_data : response_data.data || [];
          
          if (weatherData.length === 0) {
            hasMoreWeatherData = false;
          } else {
            allWeatherData = [...allWeatherData, ...weatherData];
            currentWeatherBatch++;
            
            if (weatherData.length < BATCH_SIZE) {
              hasMoreWeatherData = false;
            }
          }
        } else {
          hasMoreWeatherData = false;
        }
      }

      // Process log details - extract unique SNs
      allLogData.forEach((entry: any) => {
        if (entry.sn) {
          const normalizedSN = normalizeSerialNumber(entry.sn);
          if (normalizedSN) {
            uniqueSNs.add(normalizedSN);
          }
        }
      });

      // Process weather data - extract unique UA SNs and location mappings
      allWeatherData.forEach((entry: any) => {
        if (entry.uaSN) {
          const normalizedSN = normalizeSerialNumber(entry.uaSN);
          if (normalizedSN) {
            uniqueSNs.add(normalizedSN);
            
            // Map SN to branch based on location
            if (entry.location && entry.location.trim() && !snToBranchMap.has(normalizedSN)) {
              const location = entry.location.trim().toLowerCase();
              for (const [locationKey, branchName] of locationToBranchMap) {
                if (location.includes(locationKey)) {
                  snToBranchMap.set(normalizedSN, branchName);
                  break;
                }
              }
            }
          }
        }
      });

      const uniqueSerialNumbers = Array.from(uniqueSNs).sort();
      
      // Bulk upsert all SNs to the database (creates unassigned entries for new SNs)
      if (uniqueSerialNumbers.length > 0) {
        const bulkResponse = await fetch(
          `${API_BASE_URL}/sn-branch-assignments/bulk-upsert`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ serialNumbers: uniqueSerialNumbers }),
          }
        );

        if (bulkResponse.ok) {
          const bulkResult = await bulkResponse.json();
          console.log('Bulk upsert result:', bulkResult);
          
          // Now process auto-assignments for SNs with location data
          await processAutoAssignments(snToBranchMap);
        }
      }
    } catch (error) {
      console.error('Error fetching and storing serial numbers:', error);
      showToast('Error fetching serial numbers', 'error');
    }
  };

  const handleEditBranch = (branchName: string, assignedSNs: string[]) => {
    setEditingBranch({ branchName, assignedSNs });
    setShowEditPopup(true);
  };

  const handleCardClick = (cardData: { metricType: 'totalSNs' | 'assignedSNs' | 'unassignedSNs'; label: string; value: string }) => {
    setCardPopup({ ...cardData, isVisible: true });
  };

  const handleCloseCardPopup = () => {
    setCardPopup({ isVisible: false });
  };

  const handleSaveEdit = async () => {
    if (!editingBranch) return;

    try {
      const token = localStorage.getItem('auth_token');
      
      // Get current mappings for this branch
      const currentMappings = mappings.filter(m => m.branchName === editingBranch.branchName);
      const currentSNs = new Set(currentMappings.map(m => m.sn));
      const newSNs = new Set(editingBranch.assignedSNs);
      
      // SNs to add
      const toAdd = editingBranch.assignedSNs.filter(sn => !currentSNs.has(sn));
      
      // SNs to remove
      const toRemove = currentMappings.filter(m => !newSNs.has(m.sn));
      
      // Add new mappings
      for (const sn of toAdd) {
        await fetch(
          `${API_BASE_URL}/sn-branch-assignments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              sn: normalizeSerialNumber(sn),
              branchName: editingBranch.branchName,
            }),
          }
        );
      }
      
      // Remove old mappings
      for (const mapping of toRemove) {
        await fetch(
          `${API_BASE_URL}/sn-branch-assignments/${mapping._id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }
      
      showToast('Branch assignments updated successfully', 'success');
      setShowEditPopup(false);
      setEditingBranch(null);
      loadExistingData(); // Use loadExistingData instead of fetchData
    } catch (error) {
      console.error('Error updating branch assignments:', error);
      showToast('Error updating assignments', 'error');
    }
  };

  const handleCancelEdit = () => {
    setShowEditPopup(false);
    setEditingBranch(null);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Loading Header */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className={`text-3xl font-bold tracking-tight ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>SN Geo locations</h1>
          </div>
        </div>
        
        {/* Loading Skeleton */}
        <div className="space-y-6">
          {/* Statistics Cards Loading */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`rounded-lg p-4 h-24 border ${
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
                <div className={`h-4 rounded w-20 mb-2 ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                }`}></div>
                <div className={`h-6 rounded w-12 ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                }`}></div>
              </div>
            ))}
          </div>
          
          {/* Table Loading */}
          <div className={`rounded-lg p-6 border ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-12 rounded ${
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                }`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div>
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}>SN Geo locations</h1>
            <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {lastRefreshed && (
                <span className="sm:ml-2">
                  • Last refreshed: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        
        <button
          onClick={refreshData}
          disabled={refreshing}
          title="Refresh data from all sources and automatically assign serial numbers to branches based on location data"
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
            refreshing
              ? theme === 'dark'
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : theme === 'dark'
                ? 'bg-[#3EC1C5]/20 hover:bg-[#3EC1C5]/30 text-[#3EC1C5] border border-[#3EC1C5]/40'
                : 'bg-[#3EC1C5] hover:bg-[#3EC1C5]/90 text-white'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh & Reassign'}</span>
          <span className="sm:hidden">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          {[
            {
              icon: <Users className="w-6 h-6" />,
              label: 'Total Unique Serial Numbers',
              value: statistics.totalSNs.toString(),
              color: 'text-[#3EC1C5]',
              clickable: true,
              metricType: 'totalSNs' as const,
            },
            {
              icon: <CheckCircle className="w-6 h-6" />,
              label: 'Assigned',
              value: statistics.assignedSNs.toString(),
              color: 'text-green-400',
              clickable: true,
              metricType: 'assignedSNs' as const,
            },
            {
              icon: <AlertCircle className="w-6 h-6" />,
              label: 'Unassigned',
              value: statistics.unassignedSNs.toString(),
              color: 'text-yellow-400',
              clickable: true,
              metricType: 'unassignedSNs' as const,
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (stat.clickable && stat.metricType) {
                  handleCardClick({ metricType: stat.metricType, label: stat.label, value: stat.value });
                }
              }}
              className={`border rounded-lg p-2 sm:p-3 md:p-4 text-left relative transition ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700' 
                  : 'bg-white border-gray-300'
              } ${
                stat.clickable 
                  ? theme === 'dark'
                    ? 'cursor-pointer hover:border-[#3EC1C5]'
                    : 'cursor-pointer hover:border-gray-900'
                  : ''
              }`}
            >
              <div className={`${stat.color} mb-1 sm:mb-2`}>{stat.icon}</div>
              <p className={`text-[10px] sm:text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</p>
              <p className={`text-base sm:text-xl md:text-2xl font-bold mt-0.5 sm:mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Branch Assignments Table */}
      <div className={`w-full overflow-x-auto overflow-y-auto custom-scrollbar max-h-[400px] sm:max-h-[500px] border rounded-lg ${
        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
      }`}>
        <table className="w-full text-xs sm:text-sm">
          <thead className={`text-[10px] sm:text-xs uppercase sticky top-0 ${
            theme === 'dark' 
              ? 'text-gray-400 bg-gray-700' 
              : 'text-gray-700 bg-gray-100'
          }`}>
            <tr>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 w-12 sm:w-16 text-center">S. No</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Branch</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">Assigned SNs</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left hidden md:table-cell">Serial Numbers</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-center w-16 sm:w-24">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${
            theme === 'dark' ? 'divide-gray-700/50 text-white' : 'divide-gray-200 text-gray-900'
          }`}>
            {tableData.map((row, idx) => (
              <tr key={row.branchName} className={`border-b transition ${
                theme === 'dark' 
                  ? 'border-gray-700 hover:bg-gray-700/50' 
                  : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center text-xs sm:text-sm">{idx + 1}</td>
                <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-[#3EC1C5] flex-shrink-0" />
                    <div className="min-w-0">
                      <div className={`text-xs sm:text-sm font-semibold truncate ${
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      }`}>{row.branchName}</div>
                      <div className={`text-[10px] sm:text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>({row.branchCode})</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">
                  {row.count > 0 ? (
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full ${
                      theme === 'dark'
                        ? 'bg-[#3EC1C5]/20 border border-[#3EC1C5]/40 text-[#3EC1C5]'
                        : 'bg-gray-900 text-white'
                    }`}>
                      {row.count}
                    </span>
                  ) : (
                    <span className={`text-[10px] sm:text-xs ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}>0</span>
                  )}
                </td>
                <td className="px-2 sm:px-3 py-1.5 sm:py-2 hidden md:table-cell">
                  {row.assignedSNs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {row.assignedSNs.slice(0, 3).map((sn) => (
                        <span
                          key={sn}
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition ${
                            theme === 'dark' 
                              ? 'bg-gray-700/50 border-gray-600/50 text-gray-200 hover:bg-gray-700' 
                              : 'bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100'
                          }`}
                        >
                          {sn}
                        </span>
                      ))}
                      {row.count > 3 && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          +{row.count - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className={`text-[10px] italic ${
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    }`}>No assignments</span>
                  )}
                </td>
                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">
                  <button
                    onClick={() => handleEditBranch(row.branchName, row.assignedSNs)}
                    className={`p-1.5 sm:p-2 rounded-lg transition ${
                      theme === 'dark' 
                        ? 'text-gray-400 hover:text-[#3EC1C5] hover:bg-gray-700/50' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    title="Edit assignments"
                  >
                    <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className={`border-t-2 font-semibold text-xs sm:text-sm ${
              theme === 'dark' 
                ? 'border-[#3EC1C5] bg-gray-700/50 text-[#3EC1C5]' 
                : 'border-gray-900 bg-gray-100 text-gray-900'
            }`}>
              <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">-</td>
              <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">TOTAL</td>
              <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">{statistics.assignedSNs}</td>
              <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-left hidden md:table-cell">
                {statistics.assignedSNs} assigned, {statistics.unassignedSNs} unassigned
              </td>
              <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center">-</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Card Popup */}
      {cardPopup.isVisible && (
        <div 
          className="fixed top-[-2.5rem] h-[calc(100vh+2.5rem)] left-0 right-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseCardPopup}
        >
          <div 
            className={`max-w-4xl w-full max-h-[80vh] overflow-y-auto rounded-lg border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
              theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {cardPopup.label} ({cardPopup.value})
              </h3>
              <button
                onClick={handleCloseCardPopup}
                className={`p-2 rounded-lg transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {cardPopup.metricType === 'totalSNs' && (
                <div className="space-y-4">
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    All unique serial numbers in the system:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg border ${
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          Assigned
                        </span>
                      </div>
                      <p className={`text-2xl font-bold text-green-500`}>{statistics.assignedSNs}</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                        <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          Unassigned
                        </span>
                      </div>
                      <p className={`text-2xl font-bold text-yellow-500`}>{statistics.unassignedSNs}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {cardPopup.metricType === 'assignedSNs' && (
                <div className="space-y-4">
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Serial numbers assigned to branches:
                  </p>
                  <div className="space-y-3">
                    {tableData.filter(row => row.count > 0).map((row) => (
                      <div key={row.branchName} className={`p-3 rounded-lg border ${
                        theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#3EC1C5]" />
                            <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {row.branchName}
                            </span>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            theme === 'dark'
                              ? 'bg-[#3EC1C5]/20 border border-[#3EC1C5]/40 text-[#3EC1C5]'
                              : 'bg-gray-900 text-white'
                          }`}>
                            {row.count}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {row.assignedSNs.map((sn) => (
                            <span
                              key={sn}
                              className={`px-2 py-1 text-xs font-mono rounded border ${
                                theme === 'dark' 
                                  ? 'bg-gray-600/50 border-gray-500/50 text-gray-200' 
                                  : 'bg-white border-gray-300 text-gray-800'
                              }`}
                            >
                              {sn}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {cardPopup.metricType === 'unassignedSNs' && (
                <div className="space-y-4">
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    Serial numbers not yet assigned to any branch:
                  </p>
                  <div className={`p-4 rounded-lg border ${
                    theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex flex-wrap gap-1">
                      {mappings
                        .filter(m => m.status === 'unassigned')
                        .map((mapping) => (
                          <span
                            key={mapping._id}
                            className={`px-2 py-1 text-xs font-mono rounded border ${
                              theme === 'dark' 
                                ? 'bg-gray-600/50 border-gray-500/50 text-gray-200' 
                                : 'bg-white border-yellow-300 text-gray-800'
                            }`}
                          >
                            {normalizeSerialNumber(mapping.sn)}
                          </span>
                        ))}
                    </div>
                    {statistics.unassignedSNs === 0 && (
                      <p className={`text-sm italic ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        All serial numbers are assigned to branches.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Branch Popup */}
      {showEditPopup && editingBranch && (
        <div 
          className="fixed top-[-2.5rem] h-[calc(100vh+2.5rem)] left-0 right-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCancelEdit}
        >
          <div 
            className={`max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-lg border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 flex items-center justify-between p-4 border-b ${
              theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                Edit Branch: {editingBranch.branchName}
              </h3>
              <button
                onClick={handleCancelEdit}
                className={`p-2 rounded-lg transition ${
                  theme === 'dark' 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Assigned Serial Numbers
                </label>
                <MultiSelect
                  options={mappings
                    .filter(m => m.status === 'unassigned' || editingBranch.assignedSNs.includes(m.sn))
                    .map(m => ({ value: m.sn, label: normalizeSerialNumber(m.sn) }))
                  }
                  value={editingBranch.assignedSNs}
                  onChange={(selectedSNs) => 
                    setEditingBranch(prev => prev ? { ...prev, assignedSNs: selectedSNs } : null)
                  }
                  placeholder="Select serial numbers..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCancelEdit}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    theme === 'dark'
                      ? 'bg-[#3EC1C5] hover:bg-[#3EC1C5]/90 text-white'
                      : 'bg-[#3EC1C5] hover:bg-[#3EC1C5]/90 text-white'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


