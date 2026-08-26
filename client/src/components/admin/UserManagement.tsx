import { API_BASE_URL } from '../../config/api';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2, X, Check, Search, Users, Shield } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../Toast';
import { CustomSelect } from '../CustomSelect';
import { PrivilegeManagement } from './PrivilegeManagement';
import { usePrivileges } from '../../hooks/usePrivileges';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export function UserManagement() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const privileges = usePrivileges();

  // Determine active tab from URL
  const activeTab = location.pathname === '/privilege-management' ? 'privileges' : 'users';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
  });

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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast('User added successfully', 'success');
        setShowAddModal(false);
        setFormData({ name: '', email: '', password: '', role: 'user' });
        fetchUsers();
      } else {
        const error = await response.json();
        showToast(error.message || 'Failed to add user', 'error');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      showToast('Error adding user', 'error');
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        showToast('User updated successfully', 'success');
        setEditingUser(null);
        fetchUsers();
      } else {
        showToast('Failed to update user', 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Error updating user', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        showToast('User deleted successfully', 'success');
        fetchUsers();
      } else {
        showToast('Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Error deleting user', 'error');
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className={`rounded-lg p-4 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
        }`}>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-12 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* Navigation Tabs - Matching General Overview Style */}
      <div className="w-full overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 lg:mx-0 lg:px-0 lg:overflow-x-visible">
        <div className={`rounded-md p-0.5 inline-flex min-w-max border ${theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-gray-100 border-gray-300'
          }`}>
          <div className="flex gap-0.5 whitespace-nowrap">
            <button
              onClick={() => navigate('/user-management')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition whitespace-nowrap ${activeTab === 'users'
                ? theme === 'dark'
                  ? 'bg-[#3EC1C5] text-white'
                  : 'bg-gray-900 text-white'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
            >
              <Users className="w-3.5 h-3.5 flex-shrink-0" />
              <span>User Management</span>
            </button>
            {/* Only show Privilege Management tab if user has the privilege */}
            {privileges.canAccessPrivilegeManagement() && (
              <button
                onClick={() => navigate('/privilege-management')}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition whitespace-nowrap ${activeTab === 'privileges'
                  ? theme === 'dark'
                    ? 'bg-[#3EC1C5] text-white'
                    : 'bg-gray-900 text-white'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
              >
                <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Privilege Management</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'privileges' ? (
        <PrivilegeManagement />
      ) : (
        <>


          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative w-full sm:flex-1 sm:max-w-xs">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-1.5 border rounded text-xs transition ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                    } focus:outline-none`}
                />
              </div>

              <div className={`rounded-md p-0.5 inline-flex border ${theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-gray-100 border-gray-300'
                }`}>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition ${roleFilter === 'all'
                      ? theme === 'dark'
                        ? 'bg-[#3EC1C5] text-white'
                        : 'bg-gray-900 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setRoleFilter('user')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition ${roleFilter === 'user'
                      ? theme === 'dark'
                        ? 'bg-[#3EC1C5] text-white'
                        : 'bg-gray-900 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      }`}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => setRoleFilter('admin')}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition ${roleFilter === 'admin'
                      ? theme === 'dark'
                        ? 'bg-[#3EC1C5] text-white'
                        : 'bg-gray-900 text-white'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                      }`}
                  >
                    Admins
                  </button>
                </div>
              </div>
            </div>

            {/* Add User Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition ${theme === 'dark'
                ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-white'
                : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add User
            </button>
          </div>

          {/* Users Table */}
          <div className={`${editingUser ? 'overflow-visible' : 'overflow-x-auto'}`}>
            <table className={`w-full border rounded-lg min-w-[600px] ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
              }`}>
              <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}>
                <tr>
                  <th className={`px-3 py-2 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Name</th>
                  <th className={`px-3 py-2 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Email</th>
                  <th className={`px-3 py-2 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Role</th>
                  <th className={`px-3 py-2 text-left text-xs font-medium uppercase hidden sm:table-cell ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Created</th>
                  <th className={`px-3 py-2 text-right text-xs font-medium uppercase ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`px-3 py-6 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user._id} className={`transition ${theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      }`}>
                      <td className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>{user.name}</td>
                      <td className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                        }`}>{user.email}</td>
                      <td className="px-3 py-2">
                        {editingUser?._id === user._id ? (
                          <div className="inline-block min-w-[100px]">
                            <CustomSelect
                              value={editingUser.role}
                              onChange={(value) =>
                                setEditingUser({ ...editingUser, role: value as 'user' | 'admin' })
                              }
                              options={[
                                { value: 'user', label: 'User' },
                                { value: 'admin', label: 'Admin' }
                              ]}
                            />
                          </div>
                        ) : (
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${user.role === 'admin'
                              ? theme === 'dark'
                                ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-gray-900 text-white'
                              : theme === 'dark'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}
                          >
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-xs hidden sm:table-cell ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {editingUser?._id === user._id ? (
                            <>
                              <button
                                onClick={() => handleUpdateUser(user._id, { role: editingUser.role })}
                                className={`p-1 transition ${theme === 'dark'
                                  ? 'text-green-400 hover:text-green-300'
                                  : 'text-green-600 hover:text-green-700'
                                  }`}
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingUser(null)}
                                className={`p-1 transition ${theme === 'dark'
                                  ? 'text-gray-400 hover:text-gray-300'
                                  : 'text-gray-500 hover:text-gray-600'
                                  }`}
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingUser(user)}
                                className={`p-1 transition ${theme === 'dark'
                                  ? 'text-blue-400 hover:text-blue-300'
                                  : 'text-gray-600 hover:text-gray-700'
                                  }`}
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user._id)}
                                className={`p-1 transition ${theme === 'dark'
                                  ? 'text-red-400 hover:text-red-300'
                                  : 'text-red-500 hover:text-red-600'
                                  }`}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
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
        ><div className={`rounded-lg p-5 w-full max-w-md border ${theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>Add New User</h3>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={`w-full px-3 py-1.5 border rounded text-xs transition focus:outline-none ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className={`w-full px-3 py-1.5 border rounded text-xs transition focus:outline-none ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className={`w-full px-3 py-1.5 border rounded text-xs transition focus:outline-none ${theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-1 focus:ring-[#3EC1C5]'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                    }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}>Role</label>
                <CustomSelect
                  value={formData.role}
                  onChange={(value) => setFormData({ ...formData, role: value as 'user' | 'admin' })}
                  options={[
                    { value: 'user', label: 'User' },
                    { value: 'admin', label: 'Admin' }
                  ]}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className={`flex-1 px-4 py-1.5 text-xs font-medium rounded transition ${theme === 'dark'
                    ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: '', email: '', password: '', role: 'user' });
                  }}
                  className={`flex-1 px-4 py-1.5 text-xs font-medium rounded transition ${theme === 'dark'
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
    </div>
  );
}
