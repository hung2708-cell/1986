import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  QrCode,
  ScanLine,
  Undo2,
  X,
} from 'lucide-react';
import {
  buildAthleteQrPayload,
  downloadAthleteQrCardPng,
  formatCheckInTime,
  generateAthleteQrDataUrl,
} from '../lib/athleteQr';
import { BRAND_LOGO_IMAGE } from '../lib/seedData';
import type {
  AthleteProfile,
  Language,
  Tournament,
  TournamentCheckIn,
} from '../lib/types';
import { MotionModal } from './MotionModal';

interface AthleteQrModalProps {
  athlete: AthleteProfile;
  tournaments: Tournament[];
  initialTournamentId?: string;
  checkIns: TournamentCheckIn[];
  language: Language;
  isAdmin: boolean;
  onClose: () => void;
  onManualCheckIn?: (tournamentId: string, athleteId: string) => Promise<void>;
  onUndoCheckIn?: (checkInId: string) => Promise<void>;
  onOpenScanner?: (tournamentId: string) => void;
}

export const AthleteQrModal: React.FC<AthleteQrModalProps> = ({
  athlete,
  tournaments,
  initialTournamentId,
  checkIns,
  language,
  isAdmin,
  onClose,
  onManualCheckIn,
  onUndoCheckIn,
  onOpenScanner,
}) => {
  const isVi = language === 'vi';
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    initialTournamentId || tournaments[0]?.id || ''
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) || tournaments[0] || null,
    [tournaments, selectedTournamentId]
  );

  // Permanent athlete QR payload (can be scanned into whichever tournament Admin selects at venue)
  const qrPayload = useMemo(() => buildAthleteQrPayload(athlete.id), [athlete.id]);

  const activeCheckIn = useMemo(
    () =>
      selectedTournament
        ? checkIns.find(
            (c) =>
              c.tournamentId === selectedTournament.id &&
              c.athleteId === athlete.id &&
              c.status === 'checked_in'
          ) || null
        : null,
    [checkIns, selectedTournament, athlete.id]
  );

  useEffect(() => {
    let active = true;
    generateAthleteQrDataUrl(qrPayload)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [qrPayload]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAthleteQrCardPng({
        athlete,
        qrPayload,
        tournamentTitle: selectedTournament?.title,
        language,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleAdminToggleCheckIn = async () => {
    if (!isAdmin || !selectedTournament) return;
    setBusy(true);
    try {
      if (activeCheckIn && onUndoCheckIn) {
        await onUndoCheckIn(activeCheckIn.id);
      } else if (!activeCheckIn && onManualCheckIn) {
        await onManualCheckIn(selectedTournament.id, athlete.id);
      }
    } finally {
      setBusy(false);
    }
  };

  const genderLabel =
    athlete.gender === 'female' ? (isVi ? 'Nữ' : 'Female') : isVi ? 'Nam' : 'Male';
  const tierLabel = isVi ? `Trình ${athlete.skillTier || 'B'}` : `Tier ${athlete.skillTier || 'B'}`;

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={isVi ? 'Thẻ QR Check-in VĐV' : 'Athlete QR Check-in Pass'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      panelClassName="w-full sm:max-w-md bg-white dark:bg-stone-900 border-t sm:border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden my-auto"
    >
        {/* Top Brand Bar */}
        <div className="bg-[#120D0A] text-white px-5 py-4 flex items-center justify-between border-b border-orange-500/30">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={BRAND_LOGO_IMAGE}
              alt="1986"
              className="w-8 h-8 rounded-lg object-cover border border-orange-500/40 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-extrabold font-display tracking-tight leading-none">1986</p>
              <p className="text-[11px] text-amber-300 font-medium mt-0.5 truncate">
                {isVi ? 'Thẻ QR Check-in Vận động viên' : 'Athlete Venue QR Pass'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] rounded-lg inline-flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Athlete Identity */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-extrabold text-stone-900 dark:text-white font-display">
              {athlete.displayName}
            </h2>
            <p className="text-xs font-mono font-semibold text-accent">
              {tierLabel} · {genderLabel} · DUPR {athlete.duprRating.toFixed(2)}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {athlete.club || '1986 Club'} · {athlete.city || 'Việt Nam'}
            </p>
          </div>

          {/* QR Image Container */}
          <div className="flex flex-col items-center justify-center bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 space-y-3">
            {qrDataUrl ? (
              <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs">
                <img
                  src={qrDataUrl}
                  alt={`QR ${athlete.displayName}`}
                  className="w-52 h-52 sm:w-56 sm:h-56 object-contain"
                />
              </div>
            ) : (
              <div className="w-52 h-52 rounded-xl bg-stone-100 dark:bg-stone-900 flex items-center justify-center text-stone-400">
                <QrCode className="w-10 h-10 animate-pulse" />
              </div>
            )}

            <div className="w-full flex items-center justify-between gap-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2">
              <code className="text-[11px] font-mono text-stone-700 dark:text-stone-300 truncate">
                {qrPayload}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isVi ? 'Đã chép' : 'Copied') : isVi ? 'Sao chép' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Tournament Check-in Status */}
          {tournaments.length > 0 && (
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-3.5 space-y-2.5 bg-stone-50/70 dark:bg-stone-950/60">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  {isVi ? 'Trạng thái Check-in theo giải' : 'Tournament Check-in Status'}
                </label>
                {activeCheckIn ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isVi ? 'Đã có mặt' : 'Checked-in'} ·{' '}
                      {formatCheckInTime(activeCheckIn.checkedInAtIso, language)}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                    {isVi ? 'Chưa check-in tại sân' : 'Not checked-in yet'}
                  </span>
                )}
              </div>

              <select
                value={selectedTournament?.id || ''}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-semibold text-stone-800 dark:text-stone-200"
              >
                {tournaments.map((trn) => (
                  <option key={trn.id} value={trn.id}>
                    {trn.title} ({trn.startDate})
                  </option>
                ))}
              </select>

              {isAdmin && selectedTournament && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAdminToggleCheckIn()}
                    className={`flex-1 min-h-[40px] px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                      activeCheckIn
                        ? 'border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {activeCheckIn ? (
                      <>
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Hủy trạng thái có mặt' : 'Undo Check-in'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Xác nhận Có mặt ngay' : 'Mark Checked-in'}</span>
                      </>
                    )}
                  </button>
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenScanner(selectedTournament.id);
                      }}
                      className="min-h-[40px] px-3 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent-soft inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Mở máy quét' : 'Scanner'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Primary Actions */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={downloading || !qrDataUrl}
              onClick={() => void handleDownload()}
              className="flex-1 min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold btn-accent inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloading
                  ? isVi
                    ? 'Đang tạo thẻ...'
                    : 'Generating...'
                  : isVi
                    ? 'Tải thẻ QR (PNG)'
                    : 'Download QR Pass'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {isVi ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
    </MotionModal>
  );
};
