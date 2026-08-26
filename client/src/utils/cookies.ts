// Cookie utility functions for secure storage
// 
// SECURITY POLICY:
// Only use this for NON-SENSITIVE data such as:
// - UI preferences (theme, layout)
// - Filter selections
// - View settings
// 
// DO NOT store:
// - Authentication tokens
// - Passwords or credentials
// - Personal identifiable information (PII)
// - Session identifiers
// - Account details
// - Any data that could compromise security

interface CookieOptions {
  days?: number;
  path?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export const cookies = {
  // Set a cookie
  set(name: string, value: string, options: CookieOptions = {}): void {
    const {
      days = 30,
      path = '/',
      secure = window.location.protocol === 'https:',
      sameSite = 'lax'
    } = options;

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      cookieString += `; expires=${date.toUTCString()}`;
    }
    
    cookieString += `; path=${path}`;
    
    if (secure) {
      cookieString += '; secure';
    }
    
    cookieString += `; SameSite=${sameSite}`;
    
    document.cookie = cookieString;
  },

  // Get a cookie value
  get(name: string): string | null {
    const nameEQ = encodeURIComponent(name) + '=';
    const cookies = document.cookie.split(';');
    
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    
    return null;
  },

  // Remove a cookie
  remove(name: string, path: string = '/'): void {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
  },

  // Check if a cookie exists
  exists(name: string): boolean {
    return this.get(name) !== null;
  },

  // Get and parse JSON cookie
  getJSON<T>(name: string): T | null {
    const value = this.get(name);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  // Set JSON cookie
  setJSON<T>(name: string, value: T, options: CookieOptions = {}): void {
    this.set(name, JSON.stringify(value), options);
  }
};

// Application-specific cookie keys and management
export const COOKIE_KEYS = {
  // Theme and UI preferences
  THEME: 'app_theme',
  
  // Navigation and active sections
  ACTIVE_SECTION: 'active_section',
  LAST_VISITED_PAGE: 'last_visited_page',
  
  // General Overview filters and state
  GENERAL_OVERVIEW_FILTERS: 'general_overview_filters',
  GENERAL_OVERVIEW_DATE_RANGE: 'general_overview_date_range',
  GENERAL_OVERVIEW_SELECTED_SNS: 'general_overview_selected_sns',
  GENERAL_OVERVIEW_SHOW_ALL_DATA: 'general_overview_show_all_data',
  GENERAL_OVERVIEW_VISIBLE_COLUMNS: 'general_overview_visible_columns',
  GENERAL_OVERVIEW_SORT: 'general_overview_sort',
  GENERAL_OVERVIEW_PAGINATION: 'general_overview_pagination',
  GENERAL_OVERVIEW_SEARCH: 'general_overview_search',
  GENERAL_OVERVIEW_CHART_DATE_FILTER: 'general_overview_chart_date_filter',
  TRANSITION_DISTANCE_CHART_DATE_FILTER: 'transition_distance_chart_date_filter',
  
  // SN Overview filters and state
  SN_OVERVIEW_FILTERS: 'sn_overview_filters',
  SN_OVERVIEW_SELECTED_SN: 'sn_overview_selected_sn',
  SN_OVERVIEW_DATE_RANGE: 'sn_overview_date_range',
  
  // Battery Overview filters and state
  BATTERY_OVERVIEW_FILTERS: 'battery_overview_filters',
  BATTERY_OVERVIEW_SELECTED_SNS: 'battery_overview_selected_sns',
  BATTERY_OVERVIEW_DATE_RANGE: 'battery_overview_date_range',
  BATTERY_OVERVIEW_SEARCH: 'battery_overview_search',
  BATTERY_OVERVIEW_SORT: 'battery_overview_sort',
  BATTERY_OVERVIEW_VISIBLE_COLUMNS: 'battery_overview_visible_columns',
  
  // Transition filters and state
  TRANSITION_FILTERS: 'transition_filters',
  TRANSITION_SELECTED_SNS: 'transition_selected_sns',
  TRANSITION_DATE_RANGE: 'transition_date_range',
  TRANSITION_SEARCH: 'transition_search',
  TRANSITION_SORT: 'transition_sort',
  TRANSITION_VISIBLE_COLUMNS: 'transition_visible_columns',
  
  // Distance filters and state
  DISTANCE_FILTERS: 'distance_filters',
  DISTANCE_SELECTED_SNS: 'distance_selected_sns',
  DISTANCE_DATE_RANGE: 'distance_date_range',
  
  // MTTF Dashboard and Data filters
  MTTF_ACTIVE_TAB: 'mttf_active_tab', // 'dashboard' | 'data'
  MTTF_ACTIVE_CATEGORY: 'mttf_active_category', // 'structure' | 'propulsion' | etc.
  MTTF_FILTERS: 'mttf_filters', // uaName, ticket
  MTTF_DASHBOARD_EXPANDED_METRIC: 'mttf_dashboard_expanded_metric',
  
  // MTTF Data section filters (per category)
  MTTF_STRUCTURE_FILTERS: 'mttf_structure_filters',
  MTTF_STRUCTURE_SEARCH: 'mttf_structure_search',
  MTTF_STRUCTURE_VISIBLE_COLUMNS: 'mttf_structure_visible_columns',
  MTTF_STRUCTURE_SORT: 'mttf_structure_sort',
  MTTF_STRUCTURE_PAGINATION: 'mttf_structure_pagination',
  
  MTTF_PROPULSION_FILTERS: 'mttf_propulsion_filters',
  MTTF_PROPULSION_SEARCH: 'mttf_propulsion_search',
  MTTF_PROPULSION_VISIBLE_COLUMNS: 'mttf_propulsion_visible_columns',
  MTTF_PROPULSION_SORT: 'mttf_propulsion_sort',
  MTTF_PROPULSION_PAGINATION: 'mttf_propulsion_pagination',
  
  MTTF_ACTUATORS_FILTERS: 'mttf_actuators_filters',
  MTTF_ACTUATORS_SEARCH: 'mttf_actuators_search',
  MTTF_ACTUATORS_VISIBLE_COLUMNS: 'mttf_actuators_visible_columns',
  MTTF_ACTUATORS_SORT: 'mttf_actuators_sort',
  MTTF_ACTUATORS_PAGINATION: 'mttf_actuators_pagination',
  
  MTTF_CONTROLLER_FILTERS: 'mttf_controller_filters',
  MTTF_CONTROLLER_SEARCH: 'mttf_controller_search',
  MTTF_CONTROLLER_VISIBLE_COLUMNS: 'mttf_controller_visible_columns',
  MTTF_CONTROLLER_SORT: 'mttf_controller_sort',
  MTTF_CONTROLLER_PAGINATION: 'mttf_controller_pagination',
  
  MTTF_COMMUNICATION_FILTERS: 'mttf_communication_filters',
  MTTF_COMMUNICATION_SEARCH: 'mttf_communication_search',
  MTTF_COMMUNICATION_VISIBLE_COLUMNS: 'mttf_communication_visible_columns',
  MTTF_COMMUNICATION_SORT: 'mttf_communication_sort',
  MTTF_COMMUNICATION_PAGINATION: 'mttf_communication_pagination',
  
  // Weather Station filters and state
  WEATHER_STATION_FILTERS: 'weather_station_filters',
  WEATHER_STATION_SELECTED_UASNS: 'weather_station_selected_uasns',
  WEATHER_STATION_SELECTED_LOCATIONS: 'weather_station_selected_locations',
  WEATHER_STATION_DATE_RANGE: 'weather_station_date_range',
  WEATHER_STATION_EXPANDED_METRIC: 'weather_station_expanded_metric',
  WEATHER_STATION_VISIBLE_SECTIONS: 'weather_station_visible_sections',
  
  // Log Details filters and state
  LOG_DETAILS_SELECTED_SNS: 'log_details_selected_sns',
  LOG_DETAILS_DATE_RANGE: 'log_details_date_range',
  LOG_DETAILS_EXPANDED_METRIC: 'log_details_expanded_metric',
  LOG_DETAILS_VISIBLE_SECTIONS: 'log_details_visible_sections',
  LOG_DETAILS_FLIGHT_FILTER: 'log_details_flight_filter',
  
  // User Management filters and state
  USER_MANAGEMENT_SEARCH: 'user_management_search',
  USER_MANAGEMENT_ROLE_FILTER: 'user_management_role_filter',
  USER_MANAGEMENT_STATUS_FILTER: 'user_management_status_filter',
  USER_MANAGEMENT_SORT: 'user_management_sort',
  USER_MANAGEMENT_PAGINATION: 'user_management_pagination',
  
  //SN Geo locations filters and state
  SN_BRANCH_MANAGEMENT_SEARCH: 'sn_branch_management_search',
  SN_BRANCH_MANAGEMENT_BRANCH_FILTER: 'sn_branch_management_branch_filter',
  SN_BRANCH_MANAGEMENT_STATUS_FILTER: 'sn_branch_management_status_filter',
  SN_BRANCH_MANAGEMENT_SORT: 'sn_branch_management_sort',
  SN_BRANCH_MANAGEMENT_PAGINATION: 'sn_branch_management_pagination',
  
  // Filter Management state
  FILTER_MANAGEMENT_SEARCH: 'filter_management_search',
  FILTER_MANAGEMENT_TYPE_FILTER: 'filter_management_type_filter',
  FILTER_MANAGEMENT_SORT: 'filter_management_sort',
  FILTER_MANAGEMENT_PAGINATION: 'filter_management_pagination',
  
  // Profile preferences
  PROFILE_PREFERENCES: 'profile_preferences',
  PROFILE_NOTIFICATION_SETTINGS: 'profile_notification_settings',
} as const;

// Helper functions for common cookie operations
export const cookieHelpers = {
  // Theme management
  getTheme(): 'light' | 'dark' | null {
    return cookies.get(COOKIE_KEYS.THEME) as 'light' | 'dark' | null;
  },
  
  setTheme(theme: 'light' | 'dark'): void {
    cookies.set(COOKIE_KEYS.THEME, theme, { days: 365 });
  },
  
  // Active section management
  getActiveSection(): string | null {
    return cookies.get(COOKIE_KEYS.ACTIVE_SECTION);
  },
  
  setActiveSection(section: string): void {
    cookies.set(COOKIE_KEYS.ACTIVE_SECTION, section, { days: 30 });
  },
  
  // Date range management (generic helper)
  getDateRange(key: string): { start: string | null; end: string | null } | null {
    return cookies.getJSON(key);
  },
  
  setDateRange(key: string, dateRange: { start: string | null; end: string | null }): void {
    cookies.setJSON(key, dateRange, { days: 30 });
  },
  
  // Selected items management (generic helper for arrays)
  getSelectedItems(key: string): string[] {
    return cookies.getJSON(key) || [];
  },
  
  setSelectedItems(key: string, items: string[]): void {
    cookies.setJSON(key, items, { days: 30 });
  },
  
  // Filter state management (generic helper for objects)
  getFilterState<T>(key: string): T | null {
    return cookies.getJSON<T>(key);
  },
  
  setFilterState<T>(key: string, state: T): void {
    cookies.setJSON(key, state, { days: 30 });
  },
  
  // Pagination state management
  getPaginationState(key: string): { currentPage: number; itemsPerPage: number } | null {
    return cookies.getJSON(key);
  },
  
  setPaginationState(key: string, state: { currentPage: number; itemsPerPage: number }): void {
    cookies.setJSON(key, state, { days: 30 });
  },
  
  // Sort state management
  getSortState(key: string): { key: string | null; direction: 'asc' | 'desc' } | null {
    return cookies.getJSON(key);
  },
  
  setSortState(key: string, state: { key: string | null; direction: 'asc' | 'desc' }): void {
    cookies.setJSON(key, state, { days: 30 });
  },
  
  // Visible columns management
  getVisibleColumns(key: string): Record<string, boolean> | null {
    return cookies.getJSON(key);
  },
  
  setVisibleColumns(key: string, columns: Record<string, boolean>): void {
    cookies.setJSON(key, columns, { days: 30 });
  },
  
  // Clear all application cookies (useful for logout or reset)
  clearAllAppCookies(): void {
    Object.values(COOKIE_KEYS).forEach(key => {
      cookies.remove(key);
    });
  },
  
  // Clear cookies for a specific section
  clearSectionCookies(sectionPrefix: string): void {
    Object.values(COOKIE_KEYS)
      .filter(key => key.startsWith(sectionPrefix.toUpperCase()))
      .forEach(key => {
        cookies.remove(key);
      });
  }
};

