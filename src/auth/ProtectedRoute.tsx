import React from 'react';
import { useAuth } from './AuthContext';
import { LoginScreen } from '../components/LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  onSuccess?: () => void;
}

/**
 * ProtectedRoute component: Ensures an applicant account is active
 * before rendering sensitive application workspace views.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallbackMessage = 'Please sign in to access your private Germany application workspace.',
  onSuccess,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-300 text-center">
          {fallbackMessage}
        </div>
        <LoginScreen onAuthSuccess={onSuccess} isInline />
      </div>
    );
  }

  return <>{children}</>;
};
