import { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  privileges?: {
    generalOverview?: {
      snOverview?: boolean;
      batteryOverview?: boolean;
      transitionDistance?: boolean;
      fcVersion?: boolean;
      csVersion?: boolean;
      vlosBvlos?: boolean;
    };
    mttfDashboard?: {
      dashboard?: boolean;
      data?: boolean;
      jiraTickets?: boolean;
      filters?: boolean;
    };
    weatherStation?: boolean;
    logDetails?: boolean;
    lteConnectivity?: boolean;
    userManagement?: boolean;
    snGeoLocations?: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  updateUser: (userData: Partial<User>) => void;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }, []);

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        const tokenExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

        if (storedToken && storedUser) {
          const expiryTime = tokenExpiry ? parseInt(tokenExpiry) : null;
          const now = Date.now();

          if (!expiryTime || now < expiryTime) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          } else {
            clearAuth();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [clearAuth]);

  const persistAuth = useCallback((userData: User, authToken: string, expiresIn?: number) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, authToken);

    if (expiresIn) {
      const expiryTime = Date.now() + expiresIn * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }
  }, []);

  const login = async (email: string, password: string) => {
    // Dummy credentials for testing
    const DUMMY_EMAIL = 'admin@wingcopter.com';
    const DUMMY_PASSWORD = 'admin123';

    try {
      // Check for dummy credentials first
      if (email === DUMMY_EMAIL && password === DUMMY_PASSWORD) {
        const userData = { 
          id: 'dummy-user-123', 
          email: DUMMY_EMAIL, 
          name: 'Admin User', 
          role: 'admin' as const,
          privileges: {
            generalOverview: {
              snOverview: true,
              batteryOverview: true,
              transitionDistance: true,
              fcVersion: true,
              csVersion: true,
              vlosBvlos: true
            },
            mttfDashboard: {
              dashboard: true,
              data: true,
              jiraTickets: true,
              filters: true
            },
            weatherStation: true,
            logDetails: true,
            lteConnectivity: true,
            userManagement: true,
            snGeoLocations: true
          }
        };
        const dummyToken = 'dummy-token-' + Date.now();
        persistAuth(userData, dummyToken, 3600); // 1 hour expiry
        return;
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      const userData = { 
        id: data.user.id, 
        email: data.user.email, 
        name: data.user.name, 
        role: data.user.role,
        privileges: data.user.privileges
      };
      persistAuth(userData, data.token, data.expiresIn);
    } catch (error) {
      clearAuth();
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, role?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Registration failed');
      }

      const data = await response.json();
      const userData = { 
        id: data.user.id, 
        email: data.user.email, 
        name: data.user.name, 
        role: data.user.role,
        privileges: data.user.privileges
      };
      persistAuth(userData, data.token, data.expiresIn);
    } catch (error) {
      clearAuth();
      throw error;
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      const data = await response.json();
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);

      if (data.expiresIn) {
        const expiryTime = Date.now() + data.expiresIn * 1000;
        localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      }

      return true;
    } catch (error) {
      console.error('Session refresh error:', error);
      clearAuth();
      return false;
    }
  };

  const logout = () => {
    clearAuth();
  };

  const updateUser = useCallback((userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  }, [user]);

  const refreshUserData = async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          privileges: data.user.privileges
        };
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, token, login, register, logout, refreshSession, updateUser, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

