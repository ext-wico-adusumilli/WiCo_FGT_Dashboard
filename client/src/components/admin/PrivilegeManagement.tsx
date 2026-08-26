import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { Search, Save, X, ChevronDown, User, Shield, Home, CloudRain, FileText, Wifi, MapPin, Users, UploadCloud } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';

interface Privileges {
  generalOverview: {
    snOverview: boolean;
    batteryOverview: boolean;
    transitionDistance: boolean;
    fcVersion: boolean;
    csVersion: boolean;
    vlosBvlos: boolean;
  };
  // mttfDashboard: {
  //   dashboard: boolean;
  //   data: boolean;
  //   jiraTickets: boolean;
  //   naturalLanguageQuery: boolean;
  //   flightTimeAnalysis: boolean;
  //   filters: boolean;
  // };
  administration: {
    userManagement: boolean;
    privilegeManagement: boolean;
  };
  weatherStation: boolean;
  logDetails: boolean;
  lteConnectivity: boolean;
  snGeoLocations: boolean;
  // analysisManager: boolean;
  dataIngestion: boolean;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  privileges?: Privileges;
}

const defaultPrivileges: Privileges = {
  generalOverview: {
    snOverview: true,
    batteryOverview: true,
    transitionDistance: true,
    fcVersion: true,
    csVersion: true,
    vlosBvlos: true
  },
  // mttfDashboard: {
  //   dashboard: true,
  //   data: true,
  //   jiraTickets: true,
  //   naturalLanguageQuery: true,
  //   flightTimeAnalysis: true,
  //   filters: true
  // },
  administration: {
    userManagement: false,
    privilegeManagement: false
  },
  weatherStation: true,
  logDetails: true,
  lteConnectivity: true,
  snGeoLocations: true,
  // analysisManager: true,
  dataIngestion: true
};

const categoryConfig = {
  generalOverview: { 
    icon: Home, 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    label: 'General Overview'
  },
  // mttfDashboard: { 
  //   icon: Plane, 
  //   color: 'text-purple-600', 
  //   bg: 'bg-purple-50', 
  //   border: 'border-purple-200',
  //   badge: 'bg-purple-100 text-purple-700 border-purple-300',
  //   label: 'MTTF Dashboard'
  // },
  administration: { 
    icon: Users, 
    color: 'text-green-600', 
    bg: 'bg-green-50', 
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700 border-green-300',
    label: 'Administration'
  },
  other: { 
    icon: Shield, 
    color: 'text-gray-600', 
    bg: 'bg-gray-50', 
    border: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    label: 'Other Modules'
  }
};

export function PrivilegeManagement() {
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPrivileges, setEditingPrivileges] = useState<Privileges>(defaultPrivileges);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  // central list of the "other" module keys (used in logic)
  const otherModuleKeys = ['weatherStation', 'logDetails', 'lteConnectivity', 'snGeoLocations', /*'analysisManager',*/ 'dataIngestion'] as const;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
        
        // If a user is currently selected, update the selectedUser with fresh data
        if (selectedUser) {
          const updatedSelectedUser = data.find((u: User) => u._id === selectedUser._id);
          if (updatedSelectedUser) {
            setSelectedUser(updatedSelectedUser);
            // Only update editing privileges if we're in edit mode
            if (editingUserId === selectedUser._id) {
              setEditingPrivileges(updatedSelectedUser.privileges || defaultPrivileges);
            }
          }
        }
      } else {
        showToast('Failed to fetch users', 'error');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Error fetching users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrivileges = (user: User) => {
    setEditingUserId(user._id);
    setEditingPrivileges(user.privileges || defaultPrivileges);
    setSelectedUser(user);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'user': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPrivilegeCount = (user: User) => {
    if (!user.privileges) return 0;
    let count = 0;
    
    // Count nested privileges
    if (user.privileges.generalOverview) {
      count += Object.values(user.privileges.generalOverview).filter(Boolean).length;
    }
    // if (user.privileges.mttfDashboard) {
    //   count += Object.values(user.privileges.mttfDashboard).filter(Boolean).length;
    // }
    if (user.privileges.administration) {
      count += Object.values(user.privileges.administration).filter(Boolean).length;
    }
    
    // Count top-level privileges using the central list
    otherModuleKeys.forEach(key => {
      if (user.privileges && (user.privileges as any)[key]) count++;
    });
    
    return count;
  };

  const handleSavePrivileges = async (userId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/privileges`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ privileges: editingPrivileges }),
      });

      if (response.ok) {
        // Show success toast
        showToast('Privileges updated successfully!', 'success', 3000);
        
        // Show important notice toast with 20 second duration
        setTimeout(() => {
          showToast('⚠️ Important: Users must log out and log back in for privilege changes to take effect.', 'info', 20000);
        }, 500);
        
        // Refresh users list (this will also update selectedUser automatically)
        await fetchUsers();
        
        // If editing current user, show additional warning
        const currentUser = JSON.parse(localStorage.getItem('auth_user') || '{}');
        if (currentUser.id === userId) {
          setTimeout(() => {
            showToast('You edited your own privileges. Please log out now to apply changes.', 'error', 15000);
          }, 1000);
        }
      } else {
        showToast('Failed to update privileges', 'error');
      }
    } catch (error) {
      console.error('Error updating privileges:', error);
      showToast('Error updating privileges', 'error');
    }
  };

  const togglePrivilege = (section: keyof Privileges, subsection?: string) => {
    setEditingPrivileges(prev => {
      // Create a deep copy of the privileges
      const newPrivileges = JSON.parse(JSON.stringify(prev)) as Privileges;
      
      if (subsection && typeof newPrivileges[section] === 'object') {
        // Toggle nested property
        (newPrivileges[section] as any)[subsection] = !(newPrivileges[section] as any)[subsection];
      } else {
        // Toggle top-level property
        (newPrivileges[section] as any) = !(newPrivileges[section] as any);
      }
      
      return newPrivileges;
    });
  };

  // now supports 'other' and 'administration' as well
  // const toggleAllInSection = (section: 'generalOverview' | 'mttfDashboard' | 'administration' | 'other', enable: boolean) => {
  const toggleAllInSection = (section: 'generalOverview' | 'administration' | 'other', enable: boolean) => {
    setEditingPrivileges(prev => {
      const newPrivileges = JSON.parse(JSON.stringify(prev)) as Privileges;
      
      if (section === 'other') {
        // set each top-level other module to enable/disable
        otherModuleKeys.forEach((k) => {
          (newPrivileges as any)[k] = enable;
        });
      } else {
        // Set all sub-modules to the specified value for nested sections
        Object.keys(newPrivileges[section]).forEach(key => {
          (newPrivileges[section] as any)[key] = enable;
        });
      }
      
      return newPrivileges;
    });
  };

  // const areAllEnabled = (section: 'generalOverview' | 'mttfDashboard' | 'administration' | 'other'): boolean => {
  const areAllEnabled = (section: 'generalOverview' | 'administration' | 'other'): boolean => {
    if (!editingPrivileges) return false;
    if (section === 'other') {
      return otherModuleKeys.every(k => !!(editingPrivileges as any)[k]);
    }
    return Object.values(editingPrivileges[section]).every(value => value === true);
  };

  const filteredUsers = users
    .filter((user) => user.role !== 'admin') // Exclude admin users
    .filter((user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (loading) {
    return (
      <div className={`rounded-lg p-4 border ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
      }`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-12 rounded ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{/* User List */}
        <div className="lg:col-span-1">
          <div className={`rounded-lg shadow-md border overflow-hidden transition-all duration-200 hover:shadow-lg ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <div className={`p-4 border-b ${
              theme === 'dark' ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750' : 'border-gray-200 bg-gradient-to-r from-gray-50 to-white'
            }`}>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-sm border rounded-lg transition-all duration-200 ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-2 focus:ring-[#3EC1C5]/20'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/20'
                  } focus:outline-none`}
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className={`absolute inset-0 rounded-full border-4 ${
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  }`}></div>
                  <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                    theme === 'dark' ? 'border-[#3EC1C5]' : 'border-gray-900'
                  }`}></div>
                </div>
                <p className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Loading users...</p>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Please wait</p>
              </div>
            ) : (
              <div className={`divide-y max-h-[600px] overflow-y-auto ${
                theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
              }`}>
                {filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => {
                      handleEditPrivileges(user);
                    }}
                    className={`w-full text-left p-4 transition-all duration-200 border-l-4 ${
                      selectedUser?._id === user._id
                        ? theme === 'dark'
                          ? 'bg-[#3EC1C5]/10'
                          : 'bg-blue-50'
                        : theme === 'dark'
                          ? 'hover:bg-gray-700/50'
                          : 'hover:bg-gray-50'
                    }`}
                    style={{
                      borderLeftColor: selectedUser?._id === user._id
                        ? (theme === 'dark' ? '#3EC1C5' : '#111827')
                        : 'transparent'
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                        selectedUser?._id === user._id
                          ? theme === 'dark'
                            ? 'bg-[#3EC1C5]/20 shadow-sm'
                            : 'bg-blue-100 shadow-sm'
                          : theme === 'dark'
                            ? 'bg-gray-700'
                            : 'bg-gray-100'
                      }`}>
                        <User className={`w-5 h-5 transition-colors duration-200 ${
                          selectedUser?._id === user._id
                            ? theme === 'dark'
                              ? 'text-[#3EC1C5]'
                              : 'text-gray-900'
                            : theme === 'dark'
                              ? 'text-gray-400'
                              : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm truncate ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{user.name}</div>
                        <div className={`text-xs truncate mt-0.5 ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>{user.email}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border shadow-sm ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shadow-sm ${
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 border-gray-600'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            {getPrivilegeCount(user)} privileges
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-12 text-center">
                    <User className={`w-12 h-12 mx-auto mb-3 ${
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                    }`} />
                    <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>No users found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Privilege Editor */}
        <div className="lg:col-span-2">
          {selectedUser && editingUserId === selectedUser._id ? (
            <div className={`rounded-lg shadow-md border transition-all duration-200 hover:shadow-lg ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              {/* User Header */}
              <div className={`p-5 border-b ${
                theme === 'dark' ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750' : 'border-gray-200 bg-gradient-to-r from-blue-50 to-white'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md ${
                    theme === 'dark' ? 'bg-gradient-to-br from-[#3EC1C5] to-[#2a9a9d]' : 'bg-gradient-to-br from-gray-900 to-gray-700'
                  }`}>
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {selectedUser.name}
                    </h3>
                    <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedUser.email}
                    </p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border shadow-sm ${getRoleBadgeColor(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-md border shadow-sm ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 border-gray-600'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {getPrivilegeCount(selectedUser)} privileges
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSavePrivileges(selectedUser._id)}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg flex items-center gap-2 ${
                        theme === 'dark'
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                      title="Save changes"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingUserId(null);
                        setSelectedUser(null);
                      }}
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Privileges */}
              <div className="p-5 space-y-4 max-h-[600px] overflow-y-auto">
                {/* General Overview Category */}
                {(() => {
                  const isExpanded = expandedCategories.has('generalOverview');
                  const config = categoryConfig.generalOverview;
                  const CategoryIcon = config.icon;
                  const privCount = Object.values(editingPrivileges.generalOverview).filter(Boolean).length;
                  const totalPriv = Object.keys(editingPrivileges.generalOverview).length;

                  return (
                    <div className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleCategory('generalOverview')}
                        className={`w-full p-4 flex items-center justify-between transition-all duration-200 group ${
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-md`}>
                            <CategoryIcon className={`w-5 h-5 ${config.color} transition-transform duration-200 group-hover:scale-110`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {config.label}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shadow-sm ${config.badge}`}>
                                {privCount} of {totalPriv} enabled
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-all duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      {isExpanded && (
                        <div className={`p-4 border-t-2 space-y-2 ${
                          theme === 'dark' ? 'border-gray-700 bg-gradient-to-b from-gray-700/30 to-transparent' : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                        }`}>
                          {/* Select All/Deselect All Button */}
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => toggleAllInSection('generalOverview', !areAllEnabled('generalOverview'))}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              {areAllEnabled('generalOverview') ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {Object.entries(editingPrivileges.generalOverview).map(([key, value]) => {
                            const isEnabled = value;
                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 group ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  </div>
                                </div>
                                <button
                                  onClick={() => togglePrivilege('generalOverview', key)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isEnabled
                                      ? theme === 'dark'
                                        ? 'bg-[#3EC1C5] focus:ring-[#3EC1C5]'
                                        : 'bg-gray-900 focus:ring-gray-900'
                                      : theme === 'dark'
                                        ? 'bg-gray-600 focus:ring-gray-500'
                                        : 'bg-gray-300 focus:ring-gray-400'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* MTTF Dashboard Category — commented out
                {(() => {
                  const isExpanded = expandedCategories.has('mttfDashboard');
                  const config = categoryConfig.mttfDashboard;
                  const CategoryIcon = config.icon;
                  const privCount = Object.values(editingPrivileges.mttfDashboard).filter(Boolean).length;
                  const totalPriv = Object.keys(editingPrivileges.mttfDashboard).length;

                  return (
                    <div className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleCategory('mttfDashboard')}
                        className={`w-full p-4 flex items-center justify-between transition-all duration-200 group ${
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-md`}>
                            <CategoryIcon className={`w-5 h-5 ${config.color} transition-transform duration-200 group-hover:scale-110`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {config.label}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shadow-sm ${config.badge}`}>
                                {privCount} of {totalPriv} enabled
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-all duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      {isExpanded && (
                        <div className={`p-4 border-t-2 space-y-2 ${
                          theme === 'dark' ? 'border-gray-700 bg-gradient-to-b from-gray-700/30 to-transparent' : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                        }`}>
                          Select All/Deselect All Button
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => toggleAllInSection('mttfDashboard', !areAllEnabled('mttfDashboard'))}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              {areAllEnabled('mttfDashboard') ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {Object.entries(editingPrivileges.mttfDashboard).map(([key, value]) => {
                            const isEnabled = value;
                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 group ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  </div>
                                </div>
                                <button
                                  onClick={() => togglePrivilege('mttfDashboard', key)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isEnabled
                                      ? theme === 'dark'
                                        ? 'bg-[#3EC1C5] focus:ring-[#3EC1C5]'
                                        : 'bg-gray-900 focus:ring-gray-900'
                                      : theme === 'dark'
                                        ? 'bg-gray-600 focus:ring-gray-500'
                                        : 'bg-gray-300 focus:ring-gray-400'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
                */}

                {/* Administration Category */}
                {(() => {
                  const isExpanded = expandedCategories.has('administration');
                  const config = categoryConfig.administration;
                  const CategoryIcon = config.icon;
                  const privCount = Object.values(editingPrivileges.administration).filter(Boolean).length;
                  const totalPriv = Object.keys(editingPrivileges.administration).length;

                  return (
                    <div className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleCategory('administration')}
                        className={`w-full p-4 flex items-center justify-between transition-all duration-200 group ${
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-md`}>
                            <CategoryIcon className={`w-5 h-5 ${config.color} transition-transform duration-200 group-hover:scale-110`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {config.label}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shadow-sm ${config.badge}`}>
                                {privCount} of {totalPriv} enabled
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-all duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      {isExpanded && (
                        <div className={`p-4 border-t-2 space-y-2 ${
                          theme === 'dark' ? 'border-gray-700 bg-gradient-to-b from-gray-700/30 to-transparent' : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                        }`}>
                          {/* Select All/Deselect All Button */}
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => toggleAllInSection('administration', !areAllEnabled('administration'))}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              {areAllEnabled('administration') ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                          {Object.entries(editingPrivileges.administration).map(([key, value]) => {
                            const isEnabled = value;
                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 group ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  </div>
                                </div>
                                <button
                                  onClick={() => togglePrivilege('administration', key)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isEnabled
                                      ? theme === 'dark'
                                        ? 'bg-[#3EC1C5] focus:ring-[#3EC1C5]'
                                        : 'bg-gray-900 focus:ring-gray-900'
                                      : theme === 'dark'
                                        ? 'bg-gray-600 focus:ring-gray-500'
                                        : 'bg-gray-300 focus:ring-gray-400'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Other Modules Category */}
                {(() => {
                  const isExpanded = expandedCategories.has('other');
                  const config = categoryConfig.other;
                  const CategoryIcon = config.icon;
                  const otherModules = otherModuleKeys;
                  const privCount = otherModules.filter((key) => (editingPrivileges as any)[key]).length;
                  const totalPriv = otherModules.length;

                  const moduleIcons: Record<string, any> = {
                    weatherStation: CloudRain,
                    logDetails: FileText,
                    lteConnectivity: Wifi,
                    userManagement: Users,
                    snGeoLocations: MapPin,
                    // analysisManager: Workflow,
                    dataIngestion: UploadCloud
                  };

                  return (
                    <div className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <button
                        onClick={() => toggleCategory('other')}
                        className={`w-full p-4 flex items-center justify-between transition-all duration-200 group ${
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center shadow-sm transition-all duration-200 group-hover:shadow-md`}>
                            <CategoryIcon className={`w-5 h-5 ${config.color} transition-transform duration-200 group-hover:scale-110`} />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {config.label}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shadow-sm ${config.badge}`}>
                                {privCount} of {totalPriv} enabled
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`w-5 h-5 transition-all duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        } ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                      </button>
                      {isExpanded && (
                        <div className={`p-4 border-t-2 space-y-2 ${
                          theme === 'dark' ? 'border-gray-700 bg-gradient-to-b from-gray-700/30 to-transparent' : 'border-gray-200 bg-gradient-to-b from-gray-50 to-white'
                        }`}>
                          {/* Select All/Deselect All Button for Other */}
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => toggleAllInSection('other', !areAllEnabled('other'))}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                                theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                            >
                              {areAllEnabled('other') ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          {otherModules.map((key) => {
                            const isEnabled = (editingPrivileges as any)[key] as boolean;
                            const ModuleIcon = moduleIcons[key];
                            return (
                              <div
                                key={key}
                                className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all duration-200 group ${
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  }`}>
                                    <ModuleIcon className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                                  </div>
                                  <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  </div>
                                </div>
                                <button
                                  onClick={() => togglePrivilege(key as keyof Privileges)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                    isEnabled
                                      ? theme === 'dark'
                                        ? 'bg-[#3EC1C5] focus:ring-[#3EC1C5]'
                                        : 'bg-gray-900 focus:ring-gray-900'
                                      : theme === 'dark'
                                        ? 'bg-gray-600 focus:ring-gray-500'
                                        : 'bg-gray-300 focus:ring-gray-400'
                                  }`}
                                  role="switch"
                                  aria-checked={isEnabled}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                                      isEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className={`rounded-lg shadow-md border-2 p-16 transition-all duration-200 hover:shadow-lg ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <div className="text-center">
                <div className={`w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-md ${
                  theme === 'dark' ? 'bg-gradient-to-br from-gray-700 to-gray-800' : 'bg-gradient-to-br from-gray-100 to-gray-200'
                }`}>
                  <Shield className={`w-10 h-10 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  No User Selected
                </h3>
                <p className={`text-sm max-w-sm mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Select a user from the list to view and manage their privileges
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}