import { API_BASE_URL } from '../config/api';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';
import { User, Mail, Lock, Save, Eye, EyeOff, Sun, Moon, MapPin, Briefcase, Calendar, Star, Settings, Shield } from 'lucide-react';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Profile updated successfully', 'success');
        // Update user in context and local storage
        updateUser(data.user);
        // Update local form state
        setName(data.user.name || '');
        setEmail(data.user.email || '');
      } else {
        showToast(data.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      showToast('Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/user/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Password changed successfully', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast(data.message || 'Failed to change password', 'error');
      }
    } catch (err) {
      console.error('Password change error:', err);
      showToast('Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Profile Header */}
      <div className={`relative rounded-xl overflow-hidden mb-6 ${
        theme === 'dark' 
          ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800' 
          : 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50'
      }`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${theme === 'dark' ? '#3EC1C5' : '#000'} 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>

        <div className="relative px-6 py-8 md:px-10 md:py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
            {/* Avatar */}
            <div className="relative">
              <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center font-bold text-5xl md:text-6xl shadow-2xl border-4 ${
                theme === 'dark' 
                  ? 'bg-gradient-to-br from-[#3EC1C5] to-[#2a8a8d] text-gray-900 border-gray-700' 
                  : 'bg-gradient-to-br from-gray-900 to-gray-700 text-white border-white'
              }`}>
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={`absolute bottom-2 right-2 w-6 h-6 rounded-full border-4 ${
                theme === 'dark' ? 'bg-green-500 border-gray-900' : 'bg-green-500 border-white'
              }`} title="Active" />
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h1 className={`text-3xl md:text-4xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {user?.name || 'User'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium w-fit ${
                  theme === 'dark' 
                    ? 'bg-[#3EC1C5] text-gray-900' 
                    : 'bg-gray-900 text-white'
                }`}>
                  <Shield className="w-3.5 h-3.5" />
                  {user?.role || 'Member'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Mail className={`w-4 h-4 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-700'}`} />
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    {user?.email}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-700'}`} />
                  <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    Joined {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
                    : 'bg-white/70 backdrop-blur-sm border border-gray-200'
                }`}>
                  <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Role
                  </div>
                  <div className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {user?.role === 'admin' ? 'Administrator' : 'Team Member'}
                  </div>
                </div>
                <div className={`p-4 rounded-lg ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
                    : 'bg-white/70 backdrop-blur-sm border border-gray-200'
                }`}>
                  <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Status
                  </div>
                  <div className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Active
                  </div>
                </div>
                <div className={`p-4 rounded-lg col-span-2 md:col-span-1 ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 backdrop-blur-sm border border-gray-700' 
                    : 'bg-white/70 backdrop-blur-sm border border-gray-200'
                }`}>
                  <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    Theme
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-2 text-lg font-bold transition ${
                      theme === 'dark' ? 'text-white hover:text-[#3EC1C5]' : 'text-gray-900 hover:text-gray-700'
                    }`}
                  >
                    {theme === 'dark' ? (
                      <>
                        <Moon className="w-5 h-5" />
                        Dark
                      </>
                    ) : (
                      <>
                        <Sun className="w-5 h-5" />
                        Light
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`flex gap-2 mb-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition border-b-2 ${
            activeTab === 'overview'
              ? theme === 'dark'
                ? 'border-[#3EC1C5] text-[#3EC1C5]'
                : 'border-gray-900 text-gray-900'
              : theme === 'dark'
                ? 'border-transparent text-gray-400 hover:text-gray-300'
                : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <User className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition border-b-2 ${
            activeTab === 'settings'
              ? theme === 'dark'
                ? 'border-[#3EC1C5] text-[#3EC1C5]'
                : 'border-gray-900 text-gray-900'
              : theme === 'dark'
                ? 'border-transparent text-gray-400 hover:text-gray-300'
                : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Privileges & Access */}
          {user?.privileges && Object.entries(user.privileges).some(([_, value]) => value) && (
            <div className={`rounded-xl p-6 ${
              theme === 'dark' 
                ? 'bg-gray-800 border border-gray-700' 
                : 'bg-white border border-gray-200 shadow-sm'
            }`}>
              <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <Star className={`w-5 h-5 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`} />
                Access & Privileges
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(user.privileges)
                  .filter(([_, value]) => value)
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className={`p-4 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-[#3EC1C5]/10 border-[#3EC1C5]/30'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          theme === 'dark' ? 'text-[#3EC1C5]' : 'text-green-700'
                        }`}>
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          theme === 'dark' ? 'bg-[#3EC1C5]' : 'bg-green-500'
                        }`} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Change Password */}
          <div className={`rounded-xl p-6 ${
            theme === 'dark' 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <Lock className={`w-5 h-5 ${theme === 'dark' ? 'text-[#3EC1C5]' : 'text-gray-900'}`} />
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label htmlFor="currentPassword" className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 pr-12 rounded-lg transition focus:outline-none text-base ${
                      theme === 'dark'
                        ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-2 focus:ring-[#3EC1C5]/20'
                        : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${
                      theme === 'dark' 
                        ? 'text-gray-400 hover:text-gray-300' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 pr-12 rounded-lg transition focus:outline-none text-base ${
                      theme === 'dark'
                        ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-2 focus:ring-[#3EC1C5]/20'
                        : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${
                      theme === 'dark' 
                        ? 'text-gray-400 hover:text-gray-300' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 pr-12 rounded-lg transition focus:outline-none text-base ${
                      theme === 'dark'
                        ? 'bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:border-[#3EC1C5] focus:ring-2 focus:ring-[#3EC1C5]/20'
                        : 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${
                      theme === 'dark' 
                        ? 'text-gray-400 hover:text-gray-300' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                  theme === 'dark'
                    ? 'bg-[#3EC1C5] hover:bg-[#35a9ad] text-gray-900 shadow-[#3EC1C5]/20'
                    : 'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/20'
                }`}
              >
                <Lock className="w-4 h-4" />
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


