import React, { useMemo, useRef, useState } from 'react';
import {
  Bell,
  Cloud,
  CloudOff,
  Crown,
  KeyRound,
  LogIn,
  LogOut,
  Moon,
  Radio,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Swords,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { t } from '../lib/i18n';
import { BRAND_LOGO_IMAGE } from '../lib/seedData';
import type { Language, StaffRoleSession, TabId } from '../lib/types';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  language: Language;
  onToggleLanguage: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  userName: string | null;
  userPhoto: string | null;
  isSignedIn: boolean;
  roleSession: StaffRoleSession;
  unreadCount: number;
  liveMatchCount: number;
  onOpenNotifications: () => void;
  onOpenRoleModal: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onPrimaryAction: () => void;
}

function rubberBandClamp(value: number, min: number, max: number): number {
  if (value < min) return min - Math.min(0.18, (min - value) * 0.25);
  if (value > max) return max + Math.min(0.18, (value - max) * 0.25);
  return value;
}

const DESKTOP_ROW_H = 44;
const DESKTOP_ROW_GAP = 4;
const DESKTOP_STRIDE = DESKTOP_ROW_H + DESKTOP_ROW_GAP;

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  language,
  onToggleLanguage,
  darkMode,
  onToggleDarkMode,
  userName,
  userPhoto,
  isSignedIn,
  roleSession,
  unreadCount,
  liveMatchCount,
  onOpenNotifications,
  onOpenRoleModal,
  onSignIn,
  onSignOut,
  onPrimaryAction,
}) => {
  const isOnline = useOnlineStatus();
  const isVi = language === 'vi';
  const displayName = userName || (isVi ? 'Tài khoản BTC' : 'Organizer');

  const roleBadgeLabel =
    roleSession.role === 'referee'
      ? isVi
        ? `Trọng tài · ${roleSession.assignedCourt === 'all' ? 'Tất cả sân' : roleSession.assignedCourt || 'Sân 1'}`
        : `Ref · ${roleSession.assignedCourt === 'all' ? 'All Courts' : roleSession.assignedCourt || 'Court 1'}`
      : roleSession.role === 'organizer'
        ? isVi
          ? isSignedIn
            ? 'Ban Tổ Chức (BTC)'
            : 'Chưa đăng nhập'
          : isSignedIn
            ? 'Organizer (BTC)'
            : 'Not signed in'
        : isVi
          ? 'VĐV / Khán giả'
          : 'Viewer Mode';

  const roleShortMobile =
    roleSession.role === 'referee'
      ? roleSession.assignedCourt === 'all'
        ? 'TT'
        : `TT·${(roleSession.assignedCourt || 'S1').replace('Sân ', 'S')}`
      : roleSession.role === 'organizer'
        ? 'BTC'
        : isVi
          ? 'Xem'
          : 'View';

  const navItems = useMemo<
    { id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[]
  >(
    () => [
      { id: 'tournaments', label: t(language, 'navTournaments'), icon: Crown },
      { id: 'teamcup', label: t(language, 'navTeamCup'), icon: Shield },
      { id: 'live', label: t(language, 'navLive'), icon: Radio, count: liveMatchCount },
      { id: 'rankings', label: t(language, 'navRankings'), icon: Swords },
      { id: 'settings', label: t(language, 'navSettings'), icon: SlidersHorizontal },
    ],
    [language, liveMatchCount]
  );

  const mobileNavItems = useMemo(
    () => navItems.filter((item) => item.id !== 'settings'),
    [navItems]
  );

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || t(language, 'appName');

  // =========================================================================
  // iOS 27 Liquid Glass Sliding State — Mobile Floating Dock (Horizontal)
  // =========================================================================
  const mobileRailRef = useRef<HTMLDivElement | null>(null);
  const mobileDragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    moved: boolean;
  }>({ active: false, pointerId: null, startX: 0, moved: false });
  const [mobileDragProgress, setMobileDragProgress] = useState<number | null>(null);

  const mobileActiveIndex = mobileNavItems.findIndex((item) => item.id === activeTab);
  const mobileCount = mobileNavItems.length;
  const mobileVisualIndex =
    mobileDragProgress !== null
      ? Math.max(0, Math.min(mobileCount - 1, Math.round(mobileDragProgress)))
      : mobileActiveIndex;

  const computeMobileProgress = (clientX: number): number => {
    const rail = mobileRailRef.current;
    if (!rail) return Math.max(0, mobileActiveIndex);
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return Math.max(0, mobileActiveIndex);
    const slotW = rect.width / mobileCount;
    const raw = (clientX - rect.left - slotW / 2) / slotW;
    return rubberBandClamp(raw, 0, mobileCount - 1);
  };

  const handleMobilePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    mobileDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unavailable
    }
  };

  const handleMobilePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mobileDragRef.current.active) return;
    const dx = Math.abs(e.clientX - mobileDragRef.current.startX);
    if (!mobileDragRef.current.moved && dx > 6) {
      mobileDragRef.current.moved = true;
    }
    if (mobileDragRef.current.moved) {
      const progress = computeMobileProgress(e.clientX);
      setMobileDragProgress(progress);
      const hoveredIdx = Math.max(0, Math.min(mobileCount - 1, Math.round(progress)));
      const hoveredTab = mobileNavItems[hoveredIdx]?.id;
      if (hoveredTab && hoveredTab !== activeTab) {
        onSelectTab(hoveredTab);
      }
    }
  };

  const finishMobileDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mobileDragRef.current.active) return;
    const wasMoved = mobileDragRef.current.moved;
    const pid = mobileDragRef.current.pointerId;
    mobileDragRef.current = { active: false, pointerId: null, startX: 0, moved: false };
    if (pid !== null) {
      try {
        e.currentTarget.releasePointerCapture(pid);
      } catch {
        // ignore
      }
    }
    const finalProgress = computeMobileProgress(e.clientX);
    const targetIdx = Math.max(0, Math.min(mobileCount - 1, Math.round(finalProgress)));
    const targetTab = mobileNavItems[targetIdx]?.id;
    setMobileDragProgress(null);
    if (targetTab && (wasMoved || targetTab !== activeTab)) {
      onSelectTab(targetTab);
    }
  };

  // =========================================================================
  // iOS 27 Liquid Glass Sliding State — Desktop Sidebar Rail (Vertical)
  // =========================================================================
  const desktopRailRef = useRef<HTMLDivElement | null>(null);
  const desktopDragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    moved: boolean;
  }>({ active: false, pointerId: null, startY: 0, moved: false });
  const [desktopDragProgress, setDesktopDragProgress] = useState<number | null>(null);

  const desktopActiveIndex = Math.max(
    0,
    navItems.findIndex((item) => item.id === activeTab)
  );
  const desktopCount = navItems.length;
  const desktopVisualIndex =
    desktopDragProgress !== null
      ? Math.max(0, Math.min(desktopCount - 1, Math.round(desktopDragProgress)))
      : desktopActiveIndex;

  const computeDesktopProgress = (clientY: number): number => {
    const rail = desktopRailRef.current;
    if (!rail) return desktopActiveIndex;
    const rect = rail.getBoundingClientRect();
    const raw = (clientY - rect.top - DESKTOP_ROW_H / 2) / DESKTOP_STRIDE;
    return rubberBandClamp(raw, 0, desktopCount - 1);
  };

  const handleDesktopPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    desktopDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleDesktopPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopDragRef.current.active) return;
    const dy = Math.abs(e.clientY - desktopDragRef.current.startY);
    if (!desktopDragRef.current.moved && dy > 6) {
      desktopDragRef.current.moved = true;
    }
    if (desktopDragRef.current.moved) {
      const progress = computeDesktopProgress(e.clientY);
      setDesktopDragProgress(progress);
      const hoveredIdx = Math.max(0, Math.min(desktopCount - 1, Math.round(progress)));
      const hoveredTab = navItems[hoveredIdx]?.id;
      if (hoveredTab && hoveredTab !== activeTab) {
        onSelectTab(hoveredTab);
      }
    }
  };

  const finishDesktopDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopDragRef.current.active) return;
    const pid = desktopDragRef.current.pointerId;
    desktopDragRef.current = { active: false, pointerId: null, startY: 0, moved: false };
    if (pid !== null) {
      try {
        e.currentTarget.releasePointerCapture(pid);
      } catch {
        // ignore
      }
    }
    const finalProgress = computeDesktopProgress(e.clientY);
    const targetIdx = Math.max(0, Math.min(desktopCount - 1, Math.round(finalProgress)));
    const targetTab = navItems[targetIdx]?.id;
    setDesktopDragProgress(null);
    if (targetTab && targetTab !== activeTab) {
      onSelectTab(targetTab);
    }
  };

  const desktopLensY =
    (desktopDragProgress !== null ? desktopDragProgress : desktopActiveIndex) * DESKTOP_STRIDE;

  const mobileLensPos =
    mobileDragProgress !== null ? mobileDragProgress : Math.max(0, mobileActiveIndex);

  return (
    <>
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-[#FFFDF9] dark:bg-[#19120E] border-r border-stone-200 dark:border-stone-800 z-30">
        <div
          aria-hidden="true"
          className="h-0.5 w-full bg-gradient-to-r from-[#9A3412] via-[#EA580C] to-[#F59E0B] shrink-0"
        />
        <div className="h-16 px-5 flex items-center border-b border-stone-200 dark:border-stone-800">
          <button
            onClick={() => onSelectTab('tournaments')}
            className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 group"
          >
            <img
              src={BRAND_LOGO_IMAGE}
              alt="1986"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-lg object-cover bg-black border border-orange-500/45 shadow-xs shrink-0"
            />
            <span className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-amber-50 font-display group-hover:text-accent transition-colors">
              1986
            </span>
          </button>
        </div>

        {/* Desktop Sliding Liquid Glass Navigation Rail */}
        <nav aria-label="Main Navigation" className="flex-1 px-3 py-5">
          <div
            ref={desktopRailRef}
            role="tablist"
            aria-orientation="vertical"
            onPointerDown={handleDesktopPointerDown}
            onPointerMove={handleDesktopPointerMove}
            onPointerUp={finishDesktopDrag}
            onPointerCancel={finishDesktopDrag}
            className="relative flex flex-col gap-1 select-none touch-none"
          >
            {/* Gliding Liquid Glass Pill */}
            <div
              aria-hidden="true"
              className={`ios27-glass-lens pointer-events-none absolute left-0 right-0 rounded-2xl z-0 ${
                desktopDragProgress !== null ? 'is-dragging' : ''
              }`}
              style={{
                height: DESKTOP_ROW_H,
                transform: `translate3d(0, ${desktopLensY}px, 0) scale(${
                  desktopDragProgress !== null ? 1.02 : 1
                })`,
              }}
            />

            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const active = desktopVisualIndex === idx;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  onClick={() => onSelectTab(item.id)}
                  style={{ height: DESKTOP_ROW_H }}
                  className={`relative z-10 w-full flex items-center justify-between gap-3 px-3.5 rounded-2xl text-sm transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'text-accent font-bold'
                      : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${
                        active ? 'scale-110' : 'scale-100'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="font-mono text-xs tabular-nums font-bold px-1.5 py-0.5 rounded-full bg-rose-600 text-white">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {/* Role Access Portal Switcher (BTC vs Court Referee PIN) */}
          <button
            type="button"
            onClick={onOpenRoleModal}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
              roleSession.role === 'referee'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                : roleSession.role === 'organizer'
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white hover:border-accent'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-accent'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {roleSession.role === 'referee' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <KeyRound className="w-4 h-4 text-accent shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-bold truncate">{roleBadgeLabel}</span>
                <span className="block text-[10px] opacity-75 truncate">
                  {isVi ? 'Đổi tài khoản BTC / Trọng tài' : 'Switch BTC / Referee'}
                </span>
              </span>
            </span>
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              {isOnline ? (
                <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{isOnline ? t(language, 'syncSynced') : t(language, 'syncOffline')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDarkMode}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
            <button
              onClick={onToggleLanguage}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {language === 'vi' ? 'VI / EN' : 'EN / VI'}
            </button>
          </div>

          <PWAInstallButton language={language} compact />

          {isSignedIn ? (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent-soft text-accent font-semibold text-xs flex items-center justify-center shrink-0">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {displayName}
                </span>
              </div>
              <button
                onClick={onSignOut}
                title={t(language, 'signOut')}
                className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignIn}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>{isVi ? 'Đăng nhập BTC (Google)' : 'BTC Sign In (Google)'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Top Header Bar (Strict 3-Zone Contract: Breadcrumb/Brand — Compact Utility — 1 Primary Action) */}
      <header className="sticky top-0 z-20 pt-safe bg-[#FFFDF9]/95 dark:bg-[#19120E]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 lg:pl-64">
        <div
          aria-hidden="true"
          className="lg:hidden h-0.5 w-full bg-gradient-to-r from-[#9A3412] via-[#EA580C] to-[#F59E0B]"
        />
        <div className="h-12 lg:h-16 max-w-7xl mx-auto px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Brand on mobile / Contextual Breadcrumb on desktop */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onSelectTab('tournaments')}
              className="lg:hidden inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <img
                src={BRAND_LOGO_IMAGE}
                alt="1986"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-md object-cover bg-black border border-orange-500/45 shrink-0"
              />
              <span className="text-lg font-extrabold tracking-tight text-stone-900 dark:text-amber-50 font-display">
                1986
              </span>
            </button>
            <div className="hidden lg:flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">
              <span className="font-bold text-accent">1986</span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">{activeLabel}</span>
            </div>
          </div>

          {/* Zone 2: Essential utility controls */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenRoleModal}
              className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                roleSession.role === 'referee'
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-accent'
              }`}
            >
              {roleSession.role === 'referee' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <KeyRound className="w-3.5 h-3.5 text-accent shrink-0" />
              )}
              <span className="sm:hidden">{roleShortMobile}</span>
              <span className="hidden sm:inline">{roleBadgeLabel}</span>
            </button>

            <button
              onClick={onToggleDarkMode}
              aria-label="Toggle dark mode"
              className="lg:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onOpenNotifications}
              aria-label="Notifications"
              className="relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              aria-label={t(language, 'navSettings')}
              className={`lg:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg transition-colors ${
                activeTab === 'settings'
                  ? 'bg-accent-soft text-accent'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            {!isSignedIn ? (
              <button
                type="button"
                onClick={onSignIn}
                className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold btn-accent inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="sm:hidden">{isVi ? 'Đăng nhập' : 'Sign In'}</span>
                <span className="hidden sm:inline">{isVi ? 'Đăng nhập (Google)' : 'Sign In (Google)'}</span>
              </button>
            ) : roleSession.role === 'organizer' ? (
              <button
                type="button"
                onClick={onPrimaryAction}
                className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold btn-accent whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">{language === 'vi' ? 'Tạo giải' : 'New'}</span>
                <span className="hidden sm:inline">{t(language, 'createTournament')}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenRoleModal}
                className="min-h-[36px] sm:min-h-[40px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold btn-accent whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">{language === 'vi' ? 'Đổi vai' : 'Role'}</span>
                <span className="hidden sm:inline">
                  {isVi ? 'Đăng nhập BTC / Trọng tài' : 'BTC / Referee Login'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Floating iOS 27 Liquid Glass Sliding Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      >
        <div className="pointer-events-auto max-w-md mx-auto h-[60px] rounded-[30px] p-1.5 ios27-glass-dock">
          <div
            ref={mobileRailRef}
            role="tablist"
            aria-orientation="horizontal"
            onPointerDown={handleMobilePointerDown}
            onPointerMove={handleMobilePointerMove}
            onPointerUp={finishMobileDrag}
            onPointerCancel={finishMobileDrag}
            className="relative h-full w-full grid grid-cols-4 items-stretch touch-none select-none"
          >
            {/* Gliding Liquid Glass Lens Indicator */}
            {(mobileActiveIndex >= 0 || mobileDragProgress !== null) && (
              <div
                aria-hidden="true"
                className={`ios27-glass-lens pointer-events-none absolute top-0 bottom-0 left-0 rounded-[24px] z-0 ${
                  mobileDragProgress !== null ? 'is-dragging' : ''
                }`}
                style={{
                  width: `${100 / mobileCount}%`,
                  transform: `translate3d(${mobileLensPos * 100}%, 0, 0) scale(${
                    mobileDragProgress !== null ? 1.05 : 1
                  })`,
                }}
              />
            )}

            {mobileNavItems.map((item, idx) => {
              const Icon = item.icon;
              const active = mobileVisualIndex === idx;
              const isDraggingThis = mobileDragProgress !== null && active;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`relative z-10 min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-1 rounded-[24px] transition-colors cursor-pointer ${
                    active
                      ? 'text-accent font-bold'
                      : 'text-stone-500 dark:text-stone-400 font-medium'
                  }`}
                >
                  <span
                    className={`relative transition-transform duration-200 ${
                      isDraggingThis ? 'scale-115 -translate-y-0.5' : active ? 'scale-108' : 'scale-100'
                    }`}
                  >
                    <Icon className="w-[19px] h-[19px]" />
                    {item.count !== undefined && item.count > 0 && (
                      <span className="absolute -top-1 -right-2.5 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-600 text-white text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                        {item.count}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] leading-tight tracking-tight truncate max-w-[82px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};
