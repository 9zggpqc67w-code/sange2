import React, { useState, useEffect } from 'react';
import { ApplicationStep } from '../types';
import { useAuth } from '../auth/AuthContext';
import { ThemeSwitcher } from './ThemeSwitcher';
import {
  ArrowRight,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Compass,
  FileText,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react';

interface NavbarProps {
  currentStep: ApplicationStep;
  onNavigate: (step: ApplicationStep) => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  onNavigate,
  onOpenAuth,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut, openAuthModal } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAuthClick = (mode: 'login' | 'signup') => {
    if (onOpenAuth) {
      onOpenAuth(mode);
    } else {
      openAuthModal(mode);
    }
    setMobileMenuOpen(false);
  };

  const handleStartApplication = () => {
    if (!isAuthenticated) {
      handleAuthClick('login');
    } else {
      onNavigate('details');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'theme-bg-main/95 backdrop-blur-md border-b theme-border py-3 shadow-md'
          : 'theme-bg-main/80 backdrop-blur-sm border-b theme-border py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: SIEG.AI branding with German Flag micro accent */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 text-left group cursor-pointer"
          >
            {/* SIEG.AI Monogram with German Flag Micro-Tab */}
            <div className="relative flex items-center">
              <div className="w-1.5 self-stretch rounded-l-xs flag-stripe-vertical mr-0.5 opacity-90" />
              <span className="px-2.5 py-1 rounded-r-md bg-[#E30613] text-white font-mono font-extrabold text-xs tracking-widest border border-red-500/30 shadow-[0_0_12px_rgba(201,0,22,0.4)] group-hover:bg-[#E00018] transition-colors">
                SIEG.AI
              </span>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight theme-text-main group-hover:text-[#E30613] transition-colors">
                  AI Applicant Copilot
                </span>
                <span className="hidden lg:inline text-[10px] font-mono px-2 py-0.5 rounded theme-bg-subtle text-[#FFD21C] border theme-border">
                  GERMANY
                </span>
              </div>
              <span className="text-[10px] theme-text-muted -mt-0.5 font-medium hidden sm:block">
                Germany Application Intelligence 🇩🇪
              </span>
            </div>
          </button>
        </div>

        {/* Center/right navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-semibold theme-text-muted">
          <button
            onClick={() => onNavigate('home')}
            className={`transition-all cursor-pointer py-1 ${
              currentStep === 'home'
                ? 'text-[#E30613] font-bold border-b-2 border-[#E30613]'
                : 'hover:theme-text-main'
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => onNavigate('dashboard')}
            className={`transition-all cursor-pointer py-1 ${
              currentStep === 'dashboard'
                ? 'text-[#E30613] font-bold border-b-2 border-[#E30613]'
                : 'hover:theme-text-main'
            }`}
          >
            My Journey
          </button>

          <button
            onClick={() => onNavigate('documents')}
            className={`transition-all cursor-pointer py-1 ${
              currentStep === 'documents'
                ? 'text-[#E30613] font-bold border-b-2 border-[#E30613]'
                : 'hover:theme-text-main'
            }`}
          >
            Documents
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className={`transition-all cursor-pointer py-1 ${
              currentStep === 'profile'
                ? 'text-[#E30613] font-bold border-b-2 border-[#E30613]'
                : 'hover:theme-text-main'
            }`}
          >
            Profile
          </button>
        </nav>

        {/* Right Action Cluster: Theme Switcher, Sign In / User Profile & CTA */}
        <div className="hidden md:flex items-center gap-3">
          {/* Theme Switcher: Dark 🌙, Light ☀️, System 🖥 */}
          <ThemeSwitcher compact />

          {/* Authentication State Button */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 theme-bg-surface theme-border border py-1 px-2.5 rounded-xl text-xs font-mono">
              <div className="w-6 h-6 rounded-lg bg-[#E30613] text-white flex items-center justify-center font-bold text-[10px]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold theme-text-main max-w-[100px] truncate">
                {user.name}
              </span>
              <button
                onClick={signOut}
                title="Sign Out"
                aria-label="Sign Out"
                className="p-1 hover:text-[#E30613] theme-text-muted cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleAuthClick('login')}
              className="px-3.5 py-2 rounded-xl theme-bg-card hover:theme-bg-surface theme-border border text-xs font-mono font-bold theme-text-main transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>Sign In</span>
            </button>
          )}

          {/* Primary CTA Button: [ Start Application ] in German Red */}
          <button
            onClick={handleStartApplication}
            className="px-4 py-2 sm:py-2.5 bg-[#E30613] hover:bg-[#E00018] active:bg-[#A00012] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-[0_4px_16px_rgba(201,0,22,0.4)] transition-all duration-200 cursor-pointer flex items-center gap-1.5 transform hover:-translate-y-0.5 border border-red-400/40"
          >
            <span>Start Application</span>
            <ArrowRight className="w-3.5 h-3.5 hidden sm:inline stroke-[2.5]" />
          </button>
        </div>

        {/* Mobile Hamburger & Quick Theme Switcher */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeSwitcher compact />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl theme-bg-card theme-text-main theme-border border cursor-pointer"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t theme-border theme-bg-card px-4 py-6 space-y-4 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          {/* Mobile Theme Switcher */}
          <div className="flex items-center justify-between pb-3 border-b theme-border">
            <span className="text-xs font-mono font-bold theme-text-muted">
              Interface Theme:
            </span>
            <ThemeSwitcher />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                onNavigate('home');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm font-bold theme-text-main hover:theme-bg-surface flex items-center gap-2.5"
            >
              <Compass className="w-4 h-4 text-[#FFD21C]" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => {
                onNavigate('dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm font-bold theme-text-main hover:theme-bg-surface flex items-center gap-2.5"
            >
              <LayoutDashboard className="w-4 h-4 text-[#FFD21C]" />
              <span>My Journey</span>
            </button>
            <button
              onClick={() => {
                onNavigate('documents');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm font-bold theme-text-main hover:theme-bg-surface flex items-center gap-2.5"
            >
              <FileText className="w-4 h-4 text-[#FFD21C]" />
              <span>Documents</span>
            </button>
            <button
              onClick={() => {
                onNavigate('profile');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm font-bold theme-text-main hover:theme-bg-surface flex items-center gap-2.5"
            >
              <UserCheck className="w-4 h-4 text-[#FFD21C]" />
              <span>Profile</span>
            </button>
          </div>

          <div className="pt-3 border-t theme-border space-y-3">
            {isAuthenticated && user ? (
              <div className="flex items-center justify-between p-3 rounded-xl theme-bg-surface">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#E30613] text-white flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold theme-text-main">
                      {user.name}
                    </div>
                    <div className="text-[10px] theme-text-muted">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-mono text-[#E30613] font-bold"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAuthClick('login')}
                className="w-full py-2.5 rounded-xl theme-bg-card theme-border border text-xs font-mono font-bold theme-text-main flex items-center justify-center gap-2"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#FFD21C]" />
                <span>Sign In to Your Workspace</span>
              </button>
            )}

            <button
              onClick={handleStartApplication}
              className="w-full py-3 bg-[#E30613] text-white font-black text-sm rounded-xl flex items-center justify-center gap-2"
            >
              <span>Start Application</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
