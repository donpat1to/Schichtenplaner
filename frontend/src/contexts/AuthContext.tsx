// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, User, LoginRequest } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  loading: boolean;
  refreshUser: () => void;
  needsSetup: boolean;
  checkSetupStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/setup/status');
      if (!response.ok) {
        throw new Error('Failed to check setup status');
      }
      const data = await response.json();
      setNeedsSetup(data.needsSetup);
    } catch (error) {
      console.error('Error checking setup status:', error);
      // If we can't reach the server, assume setup is needed
      setNeedsSetup(true);
    }
  };

  // Check setup status and load user on mount
  useEffect(() => {
    const initializeApp = async () => {
      await checkSetupStatus();
      
      // Only try to load user if setup is not needed
      if (!needsSetup) {
        const savedUser = authService.getCurrentUser();
        if (savedUser) {
          setUser(savedUser);
          console.log('✅ User from localStorage:', savedUser.email);
        }
      }
      
      setLoading(false);
    };
    initializeApp();
  }, []);

  // Update needsSetup when it changes
  useEffect(() => {
    if (!needsSetup && !user) {
      // If setup is complete but no user is loaded, try to load from localStorage
      const savedUser = authService.getCurrentUser();
      if (savedUser) {
        setUser(savedUser);
      }
    }
  }, [needsSetup, user]);

  // User vom Server laden wenn nötig
  useEffect(() => {
    if (refreshTrigger > 0 && !needsSetup) {
      const loadUserFromServer = async () => {
        const serverUser = await authService.fetchCurrentUser();
        if (serverUser) {
          setUser(serverUser);
          console.log('✅ User from server:', serverUser.email);
        }
      };
      loadUserFromServer();
    }
  }, [refreshTrigger, needsSetup]);

  const login = async (credentials: LoginRequest) => {
    try {
      console.log('🔄 Attempting login...');
      const response = await authService.login(credentials);
      setUser(response.user);
      console.log('✅ Login successful, user set:', response.user.email);
      
      // Force refresh der App
      setRefreshTrigger(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    console.log('✅ Logout completed');
  };

  const refreshUser = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const hasRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };

  const value = {
    user,
    login,
    logout,
    hasRole,
    loading,
    refreshUser,
    needsSetup,
    checkSetupStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};