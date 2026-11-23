import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Language } from '../lib/types';

interface QuickThemeToggleProps {
  darkMode: boolean;
  language: Language;
  onToggle: () => void;
}

export const QuickThemeToggle: React.FC<QuickThemeToggleProps> = ({
  darkMode,
  language,
  onToggle,
}) => {
  const isVi = language === 'vi';
  const actionLabel = darkMode
    ? isVi
      ? 'Chuyển sang chế độ Sáng'
      : 'Switch to Light mode'
    : isVi
      ? 'Chuyển sang chế độ Tối'
      : 'Switch to Dark mode';

  const compactLabel = darkMode
    ? isVi
      ? 'Sáng'
      : 'Light'
    : isVi
      ? 'Tối'
      : 'Dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={actionLabel}
      aria-pressed={darkMode}
      title={actionLabel}
      className="fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-3.5 sm:right-5 lg:right-6 z-40 inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-3.5 rounded-2xl ios27-glass-dock text-stone-800 dark:text-amber-100 hover:border-orange-500/70 dark:hover:border-orange-400/75 hover:text-orange-700 dark:hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-[#0D0907] transition-transform duration-150 active:scale-95 cursor-pointer select-none"
    >
      {darkMode ? (
        <Sun className="w-[18px] h-[18px] text-amber-400 shrink-0" aria-hidden="true" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-orange-600 shrink-0" aria-hidden="true" />
      )}
      <span className="hidden sm:inline text-xs font-semibold tracking-tight">
        {compactLabel}
      </span>
    </button>
  );
};
