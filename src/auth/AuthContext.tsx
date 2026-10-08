import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserApplicationData, AuthResponse } from './types';
import { authService, DEMO_USER } from './authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  userData: UserApplicationData | null;
  signIn: (email: string, pass: string) => AuthResponse;
  signUp: (name: string, email: string, pass: string) => AuthResponse;
  signOut: () => void;
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  quickDemoLogin: () => void;
  saveCurrentUserData: (data: UserApplicationData) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [userData, setUserData] = useState<UserApplicationData | null>(null);

  // Initialize session on mount
  useEffect(() => {
    const existing = authService.getCurrentUser();
    if (existing) {
      setUser(existing);
      setUserData(authService.getUserData(existing));
    }
    setIsLoading(false);
  }, []);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const signIn = (email: string, pass: string): AuthResponse => {
    const res = authService.signIn(email, pass);
    if (res.success && res.user) {
      setUser(res.user);
      const data = authService.getUserData(res.user);
      setUserData(data);
      setAuthModalOpen(false);
    }
    return res;
  };

  const signUp = (name: string, email: string, pass: string): AuthResponse => {
    const res = authService.signUp(name, email, pass);
    if (res.success && res.user) {
      setUser(res.user);
      const data = authService.getUserData(res.user);
      setUserData(data);
      setAuthModalOpen(false);
    }
    return res;
  };

  const signOut = () => {
    authService.signOut();
    setUser(null);
    setUserData(null);
  };

  const quickDemoLogin = () => {
    signIn(DEMO_USER.email, 'germany2025');
  };

  const saveCurrentUserData = (data: UserApplicationData) => {
    if (user) {
      setUserData(data);
      authService.saveUserData(user.id, data);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authModalOpen,
        authModalMode,
        userData,
        signIn,
        signUp,
        signOut,
        openAuthModal,
        closeAuthModal,
        quickDemoLogin,
        saveCurrentUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
