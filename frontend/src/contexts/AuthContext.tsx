// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee } from '../types/employee';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

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
      const response = await fetch('http://localhost:3002/api/setup/status');
      if (!response.ok) {
        throw new Error('Setup status check failed');
      }
      const data = await response.json();
      console.log('Setup status response:', data);
      setNeedsSetup(data.needsSetup === true);
    } catch (error) {
      console.error('Error checking setup status:', error);
      setNeedsSetup(false);
    }
  };

  const refreshUser = async () => {
    try {
      const token = getStoredToken();
      console.log('🔄 Refreshing user, token exists:', !!token);
      
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3002/api/auth/me', {
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
      console.error('Error refreshing user:', error);
      removeStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      console.log('🔐 Attempting login for:', credentials.email);
      
      const response = await fetch('http://localhost:3002/api/auth/login', {
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
      
      // Token persistent speichern
      setStoredToken(data.token);
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    removeStoredToken();
    setUser(null);
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing authentication...');
      await checkSetupStatus();
      await refreshUser();
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
    needsSetup,
    checkSetupStatus,
  };

  useEffect(() => {
    console.log('🔄 Auth state changed - user:', user, 'loading:', loading);
  }, [user, loading]);

  useEffect(() => {
    const token = getStoredToken();
    console.log('💾 Stored token on mount:', token ? 'Exists' : 'None');
  }, []);

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