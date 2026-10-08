import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';

interface LoginScreenProps {
  onAuthSuccess?: () => void;
  onClose?: () => void;
  isInline?: boolean;
  initialMode?: 'login' | 'signup';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthSuccess,
  onClose,
  isInline = false,
  initialMode = 'login',
}) => {
  const { signIn, signUp, quickDemoLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status / Feedback
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotPasswordNotice(false);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = signIn(email, password);
        if (res.success) {
          if (onAuthSuccess) onAuthSuccess();
          if (onClose) onClose();
        } else {
          setError(res.error || 'Authentication failed. Please verify credentials.');
        }
      } else {
        if (password !== confirmPassword) {
          setError('Passwords do not match. Please verify your entries.');
          setIsSubmitting(false);
          return;
        }
        const res = signUp(name, email, password);
        if (res.success) {
          if (onAuthSuccess) onAuthSuccess();
          if (onClose) onClose();
        } else {
          setError(res.error || 'Registration failed.');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    setError(null);
    quickDemoLogin();
    if (onAuthSuccess) onAuthSuccess();
    if (onClose) onClose();
  };

  const content = (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 rounded-3xl theme-bg-card theme-border border shadow-2xl theme-text-main relative">
      {/* Optional Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl theme-text-muted hover:theme-text-main hover:theme-bg-surface transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Brand Header */}
      <div className="space-y-2 text-center pb-6 border-b theme-border">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-surface border theme-border mb-1">
          <div className="w-4 h-2 rounded-xs flag-stripe" />
          <span className="text-[10px] font-mono font-bold text-[#FFD21C] uppercase tracking-wider">
            Applicant Portal
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <span className="px-2.5 py-1 rounded bg-[#E30613] text-white font-mono font-extrabold text-sm tracking-wider">
            SIEG.AI
          </span>
          <span className="text-xl font-black theme-text-main">
            Applicant Copilot
          </span>
        </div>

        <p className="text-xs theme-text-muted max-w-xs mx-auto">
          Secure, isolated session for your Germany university applications and document dossier.
        </p>
      </div>

      {/* Mode Tabs: [ Sign In ] vs [ Create Account ] */}
      <div className="grid grid-cols-2 p-1 rounded-2xl theme-bg-surface border theme-border my-6">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`py-2 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'login'
              ? 'bg-[#E30613] text-white shadow-md'
              : 'theme-text-muted hover:theme-text-main'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
          }}
          className={`py-2 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'signup'
              ? 'bg-[#E30613] text-white shadow-md'
              : 'theme-text-muted hover:theme-text-main'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-[#E30613] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#E30613] shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Password Reset Notice */}
      {forgotPasswordNotice && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-[#FFD21C] flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#FFD21C] shrink-0 mt-0.5" />
          <span>Password reset link simulated: Please use the 1-Click Demo Login to access instantly.</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold theme-text-muted uppercase tracking-wider block">
              Full Legal Name
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] font-mono font-bold theme-text-muted uppercase tracking-wider block">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rahul.sharma@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-mono font-bold theme-text-muted uppercase tracking-wider">
              Password
            </label>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setForgotPasswordNotice(true)}
                className="text-[11px] font-mono text-[#FFD21C] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
          </div>
        </div>

        {mode === 'signup' && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-bold theme-text-muted uppercase tracking-wider block">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-2 py-3.5 px-4 rounded-xl bg-[#E30613] hover:bg-[#E00018] active:bg-[#A00012] text-white font-black text-sm tracking-wide uppercase transition-all shadow-[0_4px_20px_rgba(201,0,22,0.4)] cursor-pointer flex items-center justify-center gap-2 border border-red-500/30 disabled:opacity-50"
        >
          <span>{mode === 'login' ? 'Sign In to Workspace' : 'Create Applicant Dossier'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Fast Demo Access for Evaluators */}
      <div className="mt-6 pt-6 border-t theme-border space-y-3">
        <div className="flex items-center justify-between text-xs font-mono theme-text-muted">
          <span>Instant Evaluator Access:</span>
          <span className="text-[#FFD21C] flex items-center gap-1 font-bold">
            <Sparkles className="w-3 h-3 text-[#FFD21C]" />
            1-Click Demo
          </span>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          className="w-full py-2.5 px-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:border-[#FFD21C]"
        >
          <span>Load Rahul Sharma (TUM Master's Candidate)</span>
        </button>
      </div>

      {/* Privacy Safeguard Note */}
      <div className="mt-5 flex items-center justify-center gap-2 text-[11px] font-mono theme-text-muted">
        <ShieldCheck className="w-3.5 h-3.5 text-[#FFD21C]" />
        <span>GDPR / DSGVO Compliant · Isolated per applicant</span>
      </div>
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {content}
    </div>
  );
};
