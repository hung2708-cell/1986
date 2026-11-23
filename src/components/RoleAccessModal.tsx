import React, { useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { CourtPinConfig, Language, StaffRoleSession } from '../lib/types';
import { MotionModal } from './MotionModal';

interface RoleAccessModalProps {
  language: Language;
  roleSession: StaffRoleSession;
  userName: string | null;
  userEmail: string | null;
  courtPins: CourtPinConfig[];
  onClose: () => void;
  onSignInGoogleOrganizer: () => Promise<void> | void;
  onSignOutGoogle: () => Promise<void> | void;
  onActivateOrganizerRole: () => void;
  onActivateRefereeRole: (payload: { refereeName: string; assignedCourt: string }) => void;
  onSwitchToViewerRole: () => void;
  onRegenerateCourtPin: (courtName: string) => void;
}

export const RoleAccessModal: React.FC<RoleAccessModalProps> = ({
  language,
  roleSession,
  userName,
  userEmail,
  courtPins,
  onClose,
  onSignInGoogleOrganizer,
  onSignOutGoogle,
  onActivateOrganizerRole,
  onActivateRefereeRole,
  onSwitchToViewerRole,
  onRegenerateCourtPin,
}) => {
  const isVi = language === 'vi';
  const [activeTab, setActiveTab] = useState<'organizer' | 'referee'>(
    roleSession.role === 'referee' ? 'referee' : 'organizer'
  );
  const [selectedCourt, setSelectedCourt] = useState<string>(
    roleSession.assignedCourt || courtPins[0]?.courtName || 'Sân 1'
  );
  const [pinInput, setPinInput] = useState('');
  const [refereeName, setRefereeName] = useState(roleSession.refereeName || '');
  const [pinError, setPinError] = useState('');
  const [copiedCourt, setCopiedCourt] = useState<string | null>(null);

  const handleVerifyRefereePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPin = pinInput.trim();
    const matchedConfig =
      selectedCourt === 'all'
        ? courtPins.find((c) => c.pin === cleanedPin)
        : courtPins.find((c) => c.courtName === selectedCourt && c.pin === cleanedPin);

    if (!matchedConfig) {
      setPinError(
        isVi
          ? `Mã PIN không khớp cho ${selectedCourt === 'all' ? 'các sân đang hoạt động' : selectedCourt}. Vui lòng kiểm tra mã PIN do BTC cấp.`
          : `Invalid PIN for ${selectedCourt}. Please check the PIN issued by the Organizer.`
      );
      return;
    }

    setPinError('');
    onActivateRefereeRole({
      refereeName:
        refereeName.trim() ||
        (selectedCourt === 'all'
          ? isVi
            ? 'Trọng tài Điều phối'
            : 'Head Referee'
          : matchedConfig.refereeLabel),
      assignedCourt: selectedCourt,
    });
    onClose();
  };

  const handleCopyPin = async (court: string, pin: string) => {
    try {
      await navigator.clipboard.writeText(`${court} - PIN Trọng tài: ${pin}`);
      setCopiedCourt(court);
      window.setTimeout(() => setCopiedCourt(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={isVi ? 'Đăng nhập Phân quyền BTC & Trọng tài' : 'Organizer & Referee Access Portal'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      panelClassName="w-full sm:max-w-lg max-h-[92dvh] bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden pb-safe"
    >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
              {isVi ? 'Đăng nhập Phân quyền BTC & Trọng tài' : 'Organizer & Referee Access Portal'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isVi
                ? 'Tách riêng tài khoản Ban Tổ Chức (Google) và Trọng tài sân (Mã PIN nhanh)'
                : 'Separate Organizer (Google Auth) and Court Referee (Quick PIN) workspaces'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close role access modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Mode Segmented Tabs */}
        <div className="px-5 pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('organizer');
                setPinError('');
              }}
              className={`min-h-[42px] px-3 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'organizer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Users className="w-4 h-4 text-accent" />
              <span>{isVi ? 'Ban Tổ Chức (BTC)' : 'Organizer (BTC)'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('referee');
                setPinError('');
              }}
              className={`min-h-[42px] px-3 rounded-lg text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'referee'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isVi ? 'Trọng tài (Mã PIN)' : 'Referee (Court PIN)'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'organizer' ? (
            <div className="space-y-4">
              {userName ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                        {isVi ? 'Tài khoản Google Ban Tổ Chức' : 'Organizer Google Account'}
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                        {userName}
                      </div>
                      {userEmail && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {userEmail}
                        </div>
                      )}
                    </div>
                    <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {roleSession.role !== 'organizer' ? (
                      <button
                        type="button"
                        onClick={() => {
                          onActivateOrganizerRole();
                          onClose();
                        }}
                        className="flex-1 min-h-[42px] px-4 rounded-xl btn-accent text-xs font-bold"
                      >
                        {isVi ? 'Chuyển sang quyền Ban Tổ Chức' : 'Switch to Organizer Mode'}
                      </button>
                    ) : (
                      <div className="flex-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {isVi
                          ? 'Đang hoạt động với toàn quyền Ban Tổ Chức.'
                          : 'Currently active in full Organizer mode.'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void onSignOutGoogle()}
                      className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đăng xuất' : 'Sign Out'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isVi
                      ? 'Ban Tổ Chức đăng nhập bằng tài khoản Google để tạo giải, xếp đội hình 4 nội dung, điều phối lịch 2 sân chống trùng đội và quản lý Mã PIN cấp cho Trọng tài.'
                      : 'Organizers sign in with Google to create tournaments, manage 4-event lineups, run conflict-free 2-court schedules, and issue Referee Court PINs.'}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await onSignInGoogleOrganizer();
                      onActivateOrganizerRole();
                      onClose();
                    }}
                    className="w-full min-h-[46px] px-4 rounded-xl btn-accent text-sm font-bold inline-flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{isVi ? 'Đăng nhập Google (Ban Tổ Chức)' : 'Sign in with Google (Organizer)'}</span>
                  </button>
                </div>
              )}

              {/* BTC Court PIN Manager */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-accent" />
                      <span>{isVi ? 'Mã PIN cấp cho Trọng tài từng sân' : 'Referee Court PIN Codes'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isVi
                        ? 'Gửi mã PIN này cho Trọng tài cầm điện thoại ngoài sân đăng nhập nhanh.'
                        : 'Share these 6-digit PINs with court referees for instant court sign-in.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {courtPins.map((cp) => (
                    <div
                      key={cp.courtName}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {cp.courtName}
                        </div>
                        <div className="font-mono text-sm font-extrabold tracking-widest text-accent tabular-nums">
                          {cp.pin}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleCopyPin(cp.courtName, cp.pin)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                        >
                          {copiedCourt === cp.courtName ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{isVi ? 'Đã chép' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isVi ? 'Chép' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRegenerateCourtPin(cp.courtName)}
                          title={isVi ? 'Tạo mã PIN mới' : 'Regenerate PIN'}
                          className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-accent inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">{isVi ? 'Đổi mã' : 'Reset'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: REFEREE FAST COURT PIN LOGIN */
            <form onSubmit={handleVerifyRefereePin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isVi ? '1. Chọn sân phụ trách' : '1. Select Assigned Court'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ...courtPins.map((cp) => ({ id: cp.courtName, label: cp.courtName })),
                    { id: 'all', label: isVi ? 'Tất cả sân' : 'All Courts' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedCourt(opt.id);
                        setPinError('');
                      }}
                      className={`min-h-[42px] px-2.5 rounded-xl border text-xs font-bold transition-colors ${
                        selectedCourt === opt.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isVi ? '2. Tên Trọng tài (hiển thị trên nhật ký sân)' : '2. Referee Name'}
                </label>
                <input
                  type="text"
                  value={refereeName}
                  onChange={(e) => setRefereeName(e.target.value)}
                  placeholder={isVi ? 'VD: Trọng tài Minh Tuấn' : 'e.g. Referee Alex'}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isVi ? '3. Nhập Mã PIN 6 số do BTC cấp' : '3. Enter 6-Digit Court PIN'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setPinError('');
                  }}
                  placeholder="• • • • • •"
                  className="w-full min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xl font-extrabold tracking-[0.3em] text-center text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                {pinError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{pinError}</p>
                )}

                {/* Quick Fill Helper for Instant Court Testing */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{isVi ? 'Mã thử nhanh:' : 'Demo PINs:'}</span>
                  {courtPins.map((cp) => (
                    <button
                      key={cp.courtName}
                      type="button"
                      onClick={() => {
                        setSelectedCourt(cp.courtName);
                        setPinInput(cp.pin);
                        setPinError('');
                      }}
                      className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500"
                    >
                      {cp.courtName}: {cp.pin}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={pinInput.length < 6}
                className="w-full min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isVi
                    ? `Vào khu vực Trọng tài (${selectedCourt === 'all' ? 'Tất cả sân' : selectedCourt})`
                    : `Enter Referee Workspace (${selectedCourt})`}
                </span>
              </button>
            </form>
          )}
        </div>

        {/* Footer: Viewer Mode Option */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400">
            {isVi ? 'Chỉ xem sơ đồ & tỷ số?' : 'Just browsing brackets & scores?'}
          </span>
          <button
            type="button"
            onClick={() => {
              onSwitchToViewerRole();
              onClose();
            }}
            className="font-semibold text-accent hover:underline"
          >
            {isVi ? 'Chế độ VĐV / Khán giả' : 'Viewer Mode'}
          </button>
        </div>
    </MotionModal>
  );
};
