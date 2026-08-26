import { useAuth } from './useAuth';

export function usePrivileges() {
  const { user } = useAuth();

  const hasPrivilege = (module: string, subModule?: string): boolean => {
    // Admin has all privileges
    if (user?.role === 'admin') {
      return true;
    }

    if (!user?.privileges) {
      return false;
    }

    const privileges = user.privileges as any;

    if (subModule) {
      return privileges[module]?.[subModule] ?? false;
    }

    return privileges[module] ?? false;
  };

  const canAccessGeneralOverview = (subModule?: string): boolean => {
    if (!subModule) {
      // Check if user has access to any general overview sub-module
      return (
        hasPrivilege('generalOverview', 'snOverview') ||
        hasPrivilege('generalOverview', 'batteryOverview') ||
        hasPrivilege('generalOverview', 'transitionDistance') ||
        hasPrivilege('generalOverview', 'fcVersion') ||
        hasPrivilege('generalOverview', 'csVersion') ||
        hasPrivilege('generalOverview', 'vlosBvlos')
      );
    }
    return hasPrivilege('generalOverview', subModule);
  };

  const canAccessMTTFDashboard = (subModule?: string): boolean => {
    if (!subModule) {
      // Check if user has access to any MTTF dashboard sub-module
      return (
        hasPrivilege('mttfDashboard', 'dashboard') ||
        hasPrivilege('mttfDashboard', 'data') ||
        hasPrivilege('mttfDashboard', 'jiraTickets') ||
        hasPrivilege('mttfDashboard', 'naturalLanguageQuery') ||
        hasPrivilege('mttfDashboard', 'flightTimeAnalysis') ||
        hasPrivilege('mttfDashboard', 'filters')
      );
    }
    return hasPrivilege('mttfDashboard', subModule);
  };

  const canAccessAdministration = (subModule?: string): boolean => {
    if (!subModule) {
      // Check if user has access to any administration sub-module
      return (
        hasPrivilege('administration', 'userManagement') ||
        hasPrivilege('administration', 'privilegeManagement')
      );
    }
    return hasPrivilege('administration', subModule);
  };

  return {
    hasPrivilege,
    canAccessGeneralOverview,
    canAccessMTTFDashboard,
    canAccessAdministration,
    canAccessWeatherStation: () => hasPrivilege('weatherStation'),
    canAccessLogDetails: () => hasPrivilege('logDetails'),
    canAccessLTEConnectivity: () => hasPrivilege('lteConnectivity'),
    canAccessUserManagement: () => hasPrivilege('administration', 'userManagement'),
    canAccessPrivilegeManagement: () => hasPrivilege('administration', 'privilegeManagement'),
    canAccessSNGeoLocations: () => hasPrivilege('snGeoLocations'),
    canAccessAnalysisManager: () => {
      if (user?.role === 'admin') return true;
      if (!user?.privileges) return false;
      const val = (user.privileges as any)['analysisManager'];
      return val === undefined ? true : !!val;
    },
    canAccessDataIngestion: () => {
      if (user?.role === 'admin') return true;
      if (!user?.privileges) return false;
      const val = (user.privileges as any)['dataIngestion'];
      return val === undefined ? true : !!val;
    },
  };
}
