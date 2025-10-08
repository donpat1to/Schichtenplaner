// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, User, LoginRequest, RegisterRequest } from '../services/authService';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // User aus localStorage laden beim Start
    const initAuth = async () => {
      const savedUser = authService.getCurrentUser();
      if (savedUser) {
        setUser(savedUser);
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user); // ← WICHTIG: User State updaten!
      console.log('AuthContext: User nach Login gesetzt', response.user);
    } catch (error) {
      console.error('AuthContext: Login fehlgeschlagen', error);
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      const response = await authService.register(userData);
      setUser(response.user);
      console.log('AuthContext: User nach Registrierung gesetzt', response.user);
    } catch (error) {
      console.error('AuthContext: Registrierung fehlgeschlagen', error);
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    console.log('AuthContext: User nach Logout entfernt');
  };

  const hasRole = (roles: string[]) => {
    return user ? roles.includes(user.role) : false;
  };

  const value = {
    user,
    login,
    register,
    logout,
    hasRole,
    loading
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