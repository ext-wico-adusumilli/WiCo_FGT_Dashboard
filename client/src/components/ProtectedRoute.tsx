import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePrivileges } from '../hooks/usePrivileges';
import { cookies } from '../utils/cookies';

interface ProtectedRouteProps {
  children: React.ReactNode;
  checkPrivilege?: (privileges: ReturnType<typeof usePrivileges>) => boolean;
}

export function ProtectedRoute({ children, checkPrivilege }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const privileges = usePrivileges();
  const navigate = useNavigate();

  // Get first accessible page
  const getFirstAccessiblePage = () => {
    const routes = [
      { path: '/general-overview-optimised', check: () => privileges.canAccessGeneralOverview() },
      { path: '/mttf-dashboard', check: () => privileges.canAccessMTTFDashboard() },
      { path: '/weather-station-optimized', check: () => privileges.canAccessWeatherStation() },
      { path: '/log-details-optimized', check: () => privileges.canAccessLogDetails() },
      { path: '/lte-connectivity-optimized', check: () => privileges.canAccessLTEConnectivity() },
      { path: '/sn-branch-management', check: () => privileges.canAccessSNGeoLocations() },
      { path: '/user-management', check: () => privileges.canAccessUserManagement() },
    ];

    for (const route of routes) {
      if (route.check()) {
        return route.path;
      }
    }

    return '/profile'; // Fallback to profile if no other page is accessible
  };

  useEffect(() => {
    // If user is authenticated but doesn't have privilege for current page
    if (isAuthenticated && !loading && checkPrivilege && !checkPrivilege(privileges)) {
      // Clear saved tab cookies
      cookies.remove('general_overview_optimised_tab');
      cookies.remove('mttf_dashboard_tab');
      
      // Redirect to first accessible page
      const firstPage = getFirstAccessiblePage();
      navigate(firstPage, { replace: true });
    }
  }, [isAuthenticated, loading, checkPrivilege, privileges, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#3EC1C5] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check privilege if provided - now handled by useEffect above
  if (checkPrivilege && !checkPrivilege(privileges)) {
    // Return null while redirecting
    return null;
  }

  return <>{children}</>;
}

