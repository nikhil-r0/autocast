import React from 'react';
import { Sun, Moon, Search, RotateCcw } from 'lucide-react';
import { DEMO_CLOCK } from '../data/seed.ts';

interface NavbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenCommandPalette: () => void;
  onResetData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isDark,
  onToggleTheme,
  onOpenCommandPalette,
  onResetData,
}) => {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 flex items-center justify-between transition-colors">
      {/* Brand & Navigation */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5 cursor-pointer" data-testid="brand-logo">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
              Ledgerly
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase -mt-0.5">
              Invoice OS
            </span>
          </div>
        </div>

        {/* Global Search / Command Bar Trigger */}
        <button
          onClick={onOpenCommandPalette}
          data-testid="search-trigger"
          className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium transition-all shadow-sm"
          aria-label="Open command palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search invoices, vendors, commands...</span>
          <kbd className="ml-4 px-1.5 py-0.5 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Deterministic Demo Clock Indicator */}
        <div
          data-testid="system-status"
          className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-medium border border-slate-200/80 dark:border-slate-700/80"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Clock: {DEMO_CLOCK}</span>
        </div>

        {/* Reset State Button */}
        <button
          onClick={onResetData}
          data-testid="btn-reset-data"
          title="Restore seed data"
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Reset seed data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Light/Dark Toggle */}
        <button
          onClick={onToggleTheme}
          data-testid="theme-toggle"
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile */}
        <div
          data-testid="user-profile"
          className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-semibold text-xs text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
            JD
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
              Jane Doe
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Finance Director
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
