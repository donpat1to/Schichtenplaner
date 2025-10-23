// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee } from '../models/Employee';

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthContextType {
  user: Employee | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  loading: boolean;
  refreshUser: () => void;
  needsSetup: boolean;
  checkSetupStatus: () => Promise<void>;
  updateUser: (userData: Employee) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Token aus localStorage laden
  const getStoredToken = (): string | null => {
    return localStorage.getItem('token');
  };

  // Token in localStorage speichern
  const setStoredToken = (token: string) => {
    localStorage.setItem('token', token);
  };

  // Token aus localStorage entfernen
  const removeStoredToken = () => {
    localStorage.removeItem('token');
  };

  const checkSetupStatus = async (): Promise<void> => {
    try {
      console.log('🔍 Checking setup status...');
      const response = await fetch(`${API_BASE_URL}/setup/status`);
      if (!response.ok) {
        throw new Error('Setup status check failed');
      }
      const data = await response.json();
      console.log('✅ Setup status response:', data);
      setNeedsSetup(data.needsSetup === true);
    } catch (error) {
      console.error('❌ Error checking setup status:', error);
      setNeedsSetup(true);
    }
  };

  const refreshUser = async () => {
    try {
      const token = getStoredToken();
      console.log('🔄 Refreshing user, token exists:', !!token);
      
      if (!token) {
        console.log('ℹ️ No token found, user not logged in');
        setUser(null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ User refreshed:', data.user);
        setUser(data.user);
      } else {
        console.log('❌ Token invalid, removing from storage');
        removeStoredToken();
        setUser(null);
      }
    } catch (error) {
      console.error('❌ Error refreshing user:', error);
      removeStoredToken();
      setUser(null);
    }
  };

  // Add the updateUser function
  const updateUser = (userData: Employee) => {
    console.log('🔄 Updating user in auth context:', userData);
    setUser(userData);
  };

  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      console.log('🔐 Attempting login for:', credentials.email);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      console.log('✅ Login successful, storing token');
      
      setStoredToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    removeStoredToken();
    setUser(null);
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user || !user.roles || user.roles.length === 0) return false;
    
    // Check if user has at least one of the required roles
    return roles.some(requiredRole => 
      user.roles!.includes(requiredRole)
    );
  };
  
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication...');
      try {
        await checkSetupStatus();
        await refreshUser();
      } catch (error) {
        console.error('❌ Error during auth initialization:', error);
      } finally {
        setLoading(false);
        console.log('✅ Auth initialization complete - needsSetup:', needsSetup, 'user:', user);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    user,
    login,
    logout,
    hasRole,
    loading,
    refreshUser,
    needsSetup: needsSetup === null ? true : needsSetup,
    checkSetupStatus,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};