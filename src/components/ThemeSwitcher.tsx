import React from 'react';
import { useTheme, Theme } from '../theme/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';

interface ThemeSwitcherProps {
  compact?: boolean;
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  compact = false,
  className = '',
}) => {
  const { theme, setTheme } = useTheme();

  const options: { mode: Theme; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'dark',
      label: 'Dark',
      icon: <Moon className="w-3.5 h-3.5" />,
    },
    {
      mode: 'light',
      label: 'Light',
      icon: <Sun className="w-3.5 h-3.5" />,
    },
    {
      mode: 'system',
      label: 'System',
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
  ];

  if (compact) {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl theme-bg-card theme-border border backdrop-blur-md ${className}`}
        role="group"
        aria-label="Theme selection"
      >
        {options.map((opt) => {
          const isSelected = theme === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => setTheme(opt.mode)}
              title={`${opt.label} Theme`}
              aria-label={`Switch to ${opt.label} theme`}
              aria-pressed={isSelected}
              className={`p-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center ${
                isSelected
                  ? 'bg-[#E30613] text-white shadow-sm ring-1 ring-red-400/40'
                  : 'theme-text-muted hover:theme-text-main hover:theme-bg-surface'
              }`}
            >
              {opt.icon}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl theme-bg-card theme-border border shadow-md ${className}`}
      role="group"
      aria-label="Theme selection"
    >
      {options.map((opt) => {
        const isSelected = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            onClick={() => setTheme(opt.mode)}
            aria-pressed={isSelected}
            aria-label={`Switch to ${opt.label} theme`}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              isSelected
                ? 'bg-[#E30613] text-white shadow-[0_2px_10px_rgba(201,0,22,0.35)]'
                : 'theme-text-muted hover:theme-text-main hover:theme-bg-surface'
            }`}
          >
            {opt.icon}
            <span className="text-[11px]">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
