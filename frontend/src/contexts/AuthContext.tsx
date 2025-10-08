// frontend/src/contexts/AuthContext.tsx - KORRIGIERT
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, User, LoginRequest } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  loading: boolean;
  refreshUser: () => void; // NEU: Force refresh
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // NEU: Refresh trigger

  // User beim Start laden
  useEffect(() => {
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
      console.log('✅ User from localStorage:', savedUser.email);
    }
    setLoading(false);
  }, []);

  // NEU: User vom Server laden wenn nötig
  useEffect(() => {
    if (refreshTrigger > 0) {
      const loadUserFromServer = async () => {
        const serverUser = await authService.fetchCurrentUser();
        if (serverUser) {
          setUser(serverUser);
          console.log('✅ User from server:', serverUser.email);
        }
      };
      loadUserFromServer();
    }
  }, [refreshTrigger]);

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
    refreshUser // NEU
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