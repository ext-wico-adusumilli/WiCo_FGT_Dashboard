import { ReactNode, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  Plane as AircraftIcon,
  User,
  Home,
  CloudRain,
  FileText,
  MapPin,
  Sun,
  Moon,
  Wifi,
  Workflow,
  UploadCloud,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePrivileges } from '../hooks/usePrivileges';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { cookies } from '../utils/cookies';
import logo from '../assets/logo.png';
import lightlogo from '../assets/lightlogo.png';

interface MainLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  show: boolean;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const privileges = usePrivileges();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const ACCENT = theme === 'dark' ? '#3EC1C5' : '#000000';

  const navItems: NavItem[] = [
    {
      label: 'General Overview',
      path: '/general-overview-optimised',
      icon: <Home />,
      show: privileges.canAccessGeneralOverview()
    },
    // {
    //   label: 'MTTF Dashboard',
    //   path: '/mttf-dashboard',
    //   icon: <AircraftIcon />,
    //   show: privileges.canAccessMTTFDashboard()
    // },
    {
      label: 'Weather Station',
      path: '/weather-station-optimized',
      icon: <CloudRain />,
      show: privileges.canAccessWeatherStation()
    },
    {
      label: 'Log Details',
      path: '/log-details-optimized',
      icon: <FileText />,
      show: privileges.canAccessLogDetails()
    },
    {
      label: 'LTE Connectivity',
      path: '/lte-connectivity-optimized',
      icon: <Wifi />,
      show: privileges.canAccessLTEConnectivity()
    },
    {
      label: 'SN Geo Locations',
      path: '/sn-branch-management',
      icon: <MapPin />,
      show: privileges.canAccessSNGeoLocations()
    },
    {
      label: 'User Management',
      path: '/user-management',
      icon: <User />,
      show: privileges.canAccessAdministration()
    },
    // {
    //   label: 'Analysis Manager',
    //   path: '/analysis-manager',
    //   icon: <Workflow />,
    //   show: privileges.canAccessAnalysisManager()
    // },
    {
      label: 'Data Ingestion',
      path: '/data-ingestion',
      icon: <UploadCloud />,
      show: privileges.canAccessDataIngestion()
    },
  ].filter(item => item.show);

  // Auto-redirect to first accessible page if current route is not accessible
  useEffect(() => {
    // Skip redirect for profile, login, register, and unauthorized pages
    const skipRedirectPaths = ['/profile', '/login', '/register', '/unauthorized', '/privilege-management'];
    if (skipRedirectPaths.includes(location.pathname)) {
      return;
    }

    // Check if current path is in the accessible nav items
    const currentPathAccessible = navItems.some(item => item.path === location.pathname);

    // if (!currentPathAccessible && navItems.length > 0) {
    //   // Clear any saved tab cookies for inaccessible pages
    //   cookies.remove('general_overview_optimised_tab');
    //   cookies.remove('mttf_dashboard_tab');

    //   // Redirect to first accessible page
    //   showToast('Redirecting to accessible page...', 'info');
    //   navigate(navItems[0].path, { replace: true });
    // }
  }, [location.pathname]); // Remove navItems, navigate, showToast from dependencies

  const isActive = (path: string) => {
    // Both /user-management and /privilege-management should highlight User Management
    if (path === '/user-management') {
      return location.pathname === '/user-management' || location.pathname === '/privilege-management';
    }
    return location.pathname === path;
  };

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'success');
    navigate('/login');
  };

  return (
    <div className={`min-h-screen flex overflow-x-hidden w-full ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed w-56 h-screen z-40 transition-transform duration-300`}
        aria-label="Main Sidebar"
      >
        {/* vertical background gradient */}
        <div
          className="flex flex-col h-full border-r"
          style={{
            background: theme === 'dark'
              ? 'linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(17,24,39,0.94) 100%)'
              : 'linear-gradient(180deg, rgba(249,250,251,0.95) 0%, rgba(243,244,246,0.94) 100%)',
            borderColor: theme === 'dark' ? 'rgba(55,65,81,1)' : 'rgba(209,213,219,1)',
          }}
        >
          <div
            className={`flex items-center gap-2 px-4 py-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
              }`}
          >
            <img
              src={theme === 'dark' ? logo : lightlogo}
              alt="WINGCOPTER Logo"
              className="w-8 h-8 object-contain"
            />

            <h1
              className={`font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
            >
              WINGCOPTER
            </h1>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.path);

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group`}
                  // active styles via inline style for guaranteed color control
                  style={
                    active
                      ? {
                        // soft left->right accent tint
                        background: theme === 'dark'
                          ? 'linear-gradient(90deg, rgba(62,193,197,0.10) 0%, rgba(62,193,197,0.03) 60%)'
                          : 'linear-gradient(90deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.03) 60%)',
                        color: ACCENT,
                        fontWeight: 600,
                        // bold right accent
                        borderRight: `4px solid ${ACCENT}`,
                        // keep the rounded look while showing the border inside
                        boxShadow: theme === 'dark'
                          ? 'inset -6px 0 12px rgba(62,193,197,0.03)'
                          : 'inset -6px 0 12px rgba(0,0,0,0.03)',
                        paddingRight: '0.75rem',
                      }
                      : {
                        color: theme === 'dark' ? 'rgba(203,213,225,1)' : 'rgba(75,85,99,1)', // text-gray-300 or text-gray-600
                        paddingRight: '0.75rem',
                      }
                  }
                >
                  <span
                    // icon color controlled by inline style so it becomes teal when active
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      color: active ? ACCENT : (theme === 'dark' ? 'rgba(156,163,175,1)' : 'rgba(107,114,128,1)'), // gray-400 or gray-500
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>

                  <span className="truncate text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t px-3 py-3 space-y-2" style={{ borderColor: theme === 'dark' ? 'rgba(55,65,81,1)' : 'rgba(209,213,219,1)' }}>
            {/* Profile button - shows active when location is /profile */}
            <button
              onClick={() => {
                navigate('/profile');
                setSidebarOpen(false);
              }}
              className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-all duration-200"
              style={
                isActive('/profile')
                  ? {
                    background: theme === 'dark'
                      ? 'linear-gradient(90deg, rgba(62,193,197,0.10) 0%, rgba(62,193,197,0.03) 60%)'
                      : 'linear-gradient(90deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.03) 60%)',
                    color: ACCENT,
                    fontWeight: 600,
                    borderRight: `4px solid ${ACCENT}`,
                    boxShadow: theme === 'dark'
                      ? 'inset -6px 0 12px rgba(62,193,197,0.03)'
                      : 'inset -6px 0 12px rgba(0,0,0,0.03)',
                  }
                  : { color: theme === 'dark' ? 'rgba(203,213,225,1)' : 'rgba(75,85,99,1)' }
              }
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: ACCENT,
                  color: theme === 'dark' ? '#062023' : '#FFFFFF'
                }}
              >
                {user?.name?.charAt(0).toUpperCase() ||
                  user?.email?.charAt(0).toUpperCase() ||
                  'U'}
              </div>

              <div className="flex-1 text-left overflow-hidden">
                <p className="text-xs uppercase tracking-wider" style={{ color: theme === 'dark' ? 'rgba(148,163,184,1)' : 'rgba(107,114,128,1)' }}>
                  Signed in as
                </p>
                <p className="text-xs font-medium truncate" style={{ color: isActive('/profile') ? ACCENT : (theme === 'dark' ? '#FFFFFF' : '#000000') }}>
                  {user?.name || user?.email}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm"
                style={{
                  background: 'rgba(220,38,38,0.06)',
                  color: 'rgba(248,113,113,1)',
                }}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              <button
                onClick={toggleTheme}
                className="relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 text-sm group hover:scale-105"
                style={{
                  background: theme === 'dark' ? 'rgba(156,163,175,0.15)' : 'rgba(107,114,128,0.15)',
                  color: theme === 'dark' ? 'rgba(203,213,225,1)' : 'rgba(75,85,99,1)',
                  border: theme === 'dark' ? '1px solid rgba(156,163,175,0.2)' : '1px solid rgba(107,114,128,0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(156,163,175,0.25)' : 'rgba(107,114,128,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(156,163,175,0.15)' : 'rgba(107,114,128,0.15)';
                }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}

                {/* Professional Tooltip */}
                <div
                  className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs font-medium rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
                  style={{
                    background: theme === 'dark' ? 'rgba(17,24,39,0.95)' : 'rgba(255,255,255,0.95)',
                    color: theme === 'dark' ? 'rgba(243,244,246,1)' : 'rgba(17,24,39,1)',
                    border: theme === 'dark' ? '1px solid rgba(55,65,81,0.5)' : '1px solid rgba(209,213,219,0.5)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                  {/* Tooltip Arrow */}
                  <div
                    className="absolute top-full right-3 w-0 h-0"
                    style={{
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: theme === 'dark' ? '4px solid rgba(17,24,39,0.95)' : '4px solid rgba(255,255,255,0.95)',
                    }}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Page content */}
      <div className="flex-1 flex flex-col lg:ml-56 w-full overflow-x-hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`lg:hidden fixed top-2 left-2 z-30 p-1.5 rounded-lg transition border ${theme === 'dark'
              ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
              : 'bg-white hover:bg-gray-100 border-gray-300'
            }`}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <X className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
          ) : (
            <Menu className={`w-5 h-5 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} />
          )}
        </button>

        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4 pt-12 lg:pt-4 w-full box-border">{children}</div>
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout? You will need to sign in again to access your account."
        confirmText="Logout"
        cancelText="Cancel"
        type="warning"
      />


    </div>
  );
}

