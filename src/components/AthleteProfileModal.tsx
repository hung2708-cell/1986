import React, { useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  QrCode,
  Swords,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react';
import { formatCheckInTime } from '../lib/athleteQr';
import { buildEntityFromAthlete, listOpponentsForEntity } from '../lib/h2h';
import type {
  AthleteProfile,
  Language,
  MatchRecord,
  TeamEntry,
  TeamTie,
  TournamentCheckIn,
} from '../lib/types';
import { MotionModal } from './MotionModal';

interface AthleteProfileModalProps {
  athlete: AthleteProfile;
  athletes?: AthleteProfile[];
  teams?: TeamEntry[];
  ties?: TeamTie[];
  matches: MatchRecord[];
  checkIns: TournamentCheckIn[];
  language: Language;
  onOpenQr: () => void;
  onInspectH2H?: (opponentName?: string, highlightMatchId?: string) => void;
  onClose: () => void;
}

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  athlete,
  athletes = [],
  teams = [],
  ties = [],
  matches,
  checkIns,
  language,
  onOpenQr,
  onInspectH2H,
  onClose,
}) => {
  const isVi = language === 'vi';

  const rivalSummary = useMemo(() => {
    const baseEntity = buildEntityFromAthlete(athlete, language);
    return listOpponentsForEntity(baseEntity, athletes, teams, matches, ties, language)
      .filter((opt) => opt.meetings > 0)
      .slice(0, 5);
  }, [athlete, athletes, teams, matches, ties, language]);

  const athleteHistory = useMemo(() => {
    const lowName = athlete.displayName.toLowerCase();
    return matches
      .filter((m) => {
        if (m.status !== 'completed') return false;
        return (
          m.playerAUid === athlete.ownerUid ||
          m.playerBUid === athlete.ownerUid ||
          m.teamAName.toLowerCase().includes(lowName) ||
          m.teamBName.toLowerCase().includes(lowName)
        );
      })
      .map((m) => {
        const isSideA =
          m.playerAUid === athlete.ownerUid ||
          m.teamAName.toLowerCase().includes(lowName);
        const won = (isSideA && m.winnerSide === 'A') || (!isSideA && m.winnerSide === 'B');
        const opponent = isSideA ? m.teamBName : m.teamAName;
        const delta = m.ratingDelta ? (won ? +m.ratingDelta : -m.ratingDelta) : 0;
        const scoreDisplay =
          m.setHistory && m.setHistory.length > 0
            ? m.setHistory.join(' · ')
            : `${m.scoreA}-${m.scoreB}`;
        return { match: m, won, opponent, delta, scoreDisplay };
      });
  }, [athlete, matches]);

  const athleteCheckIns = useMemo(
    () =>
      checkIns
        .filter((c) => c.athleteId === athlete.id && c.status === 'checked_in')
        .sort((a, b) => (b.checkedInAtIso || '').localeCompare(a.checkedInAtIso || '')),
    [checkIns, athlete.id]
  );

  const totalMatches = athlete.wins + athlete.losses;
  const winRate = totalMatches > 0 ? Math.round((athlete.wins / totalMatches) * 100) : 0;
  const pointDiff = (athlete.pointsFor || 0) - (athlete.pointsAgainst || 0);

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={isVi ? 'Hồ sơ Vận động viên' : 'Athlete Profile'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      panelClassName="w-full sm:max-w-2xl bg-white dark:bg-stone-900 border-t sm:border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90dvh] flex flex-col"
    >
        {/* Header */}
        <div className="bg-[#120D0A] text-white px-5 py-4 flex items-center justify-between border-b border-orange-500/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-orange-600/25 border border-orange-500/40 text-amber-300 font-extrabold text-sm flex items-center justify-center shrink-0">
              {athlete.avatarInitials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold font-display truncate">
                  {athlete.displayName}
                </h2>
                {athleteCheckIns.length > 0 && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </div>
              <p className="text-xs text-stone-300 font-mono truncate">
                {isVi ? `Trình ${athlete.skillTier || 'B'}` : `Tier ${athlete.skillTier || 'B'}`} ·{' '}
                {athlete.gender === 'female' ? (isVi ? 'Nữ' : 'Female') : isVi ? 'Nam' : 'Male'} ·{' '}
                {athlete.club || '1986 Club'} · {athlete.city || 'Việt Nam'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] rounded-lg inline-flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/10"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* SportConnect Rating & Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isVi ? 'Điểm trình DUPR' : 'DUPR Rating'}
              </p>
              <p className="text-2xl font-extrabold font-mono text-accent tabular-nums mt-1">
                {athlete.duprRating.toFixed(2)}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isVi ? 'Tỷ lệ thắng' : 'Win Rate'}
              </p>
              <p className="text-2xl font-extrabold font-mono text-stone-900 dark:text-white tabular-nums mt-1">
                {winRate}%
              </p>
              <p className="text-[11px] font-mono text-stone-500 tabular-nums">
                {athlete.wins}W - {athlete.losses}L
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isVi ? 'Hiệu số điểm' : 'Point Diff'}
              </p>
              <p
                className={`text-2xl font-extrabold font-mono tabular-nums mt-1 ${
                  pointDiff >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {pointDiff > 0 ? `+${pointDiff}` : pointDiff}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isVi ? 'Check-in giải' : 'Check-ins'}
              </p>
              <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {athleteCheckIns.length}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenQr();
              }}
              className="min-h-[40px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              <span>{isVi ? 'Mở Thẻ QR Check-in' : 'Open QR Pass'}</span>
            </button>
            {onInspectH2H && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onInspectH2H();
                }}
                className="min-h-[40px] px-4 rounded-lg text-xs font-semibold border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 inline-flex items-center gap-1.5"
              >
                <Swords className="w-4 h-4 text-accent" />
                <span>{isVi ? 'Xem lịch sử đối đầu (H2H)' : 'View Head-to-Head (H2H)'}</span>
              </button>
            )}
          </div>

          {/* Direct Head-to-Head Rivals Summary */}
          {rivalSummary.length > 0 && onInspectH2H && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 inline-flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-accent" />
                <span>
                  {isVi
                    ? 'Đối đầu trực tiếp (nhấn để xem chi tiết H2H)'
                    : 'Head-to-Head Rivals (click for details)'}
                </span>
              </h3>
              <div className="divide-y divide-stone-100 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                {rivalSummary.map((opt) => (
                  <button
                    key={opt.entity.name}
                    type="button"
                    onClick={() => {
                      onClose();
                      onInspectH2H(opt.entity.name);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left text-xs bg-white dark:bg-stone-950/50 hover:bg-orange-50/60 dark:hover:bg-stone-800/70 transition-colors"
                  >
                    <span className="font-semibold text-stone-900 dark:text-white truncate">
                      vs {opt.entity.name}
                    </span>
                    <span className="inline-flex items-center gap-2 font-mono tabular-nums shrink-0">
                      <span className="font-bold text-accent">
                        {opt.winsForBase}-{opt.lossesForBase}
                        {opt.draws > 0 ? `-${opt.draws}` : ''}
                      </span>
                      <span className="text-stone-400">
                        ({opt.meetings} {isVi ? 'trận' : 'm'})
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tournament Check-ins */}
          {athleteCheckIns.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isVi ? 'Lịch sử Check-in tại sân' : 'Verified Venue Check-ins'}</span>
              </h3>
              <div className="divide-y divide-stone-100 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                {athleteCheckIns.map((ci) => (
                  <div
                    key={ci.id}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs bg-stone-50/50 dark:bg-stone-950/50"
                  >
                    <span className="font-semibold text-stone-900 dark:text-white truncate">
                      {ci.tournamentTitle}
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                      ✓ {formatCheckInTime(ci.checkedInAtIso, language)}
                      {ci.kitIssued ? (isVi ? ' · Đã nhận áo' : ' · Kit') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Match & Rating Delta History */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-stone-600 dark:text-stone-400 inline-flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              <span>
                {isVi ? 'Lịch sử thi đấu & Biến động điểm trình' : 'Match & Rating History'}
              </span>
            </h3>

            {athleteHistory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-6 text-center space-y-1.5">
                <Trophy className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {isVi
                    ? 'Chưa có trận đấu hoàn tất nào được ghi nhận cho VĐV này.'
                    : 'No completed matches logged for this athlete yet.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                {athleteHistory.map(({ match, won, opponent, delta, scoreDisplay }) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => {
                      if (!onInspectH2H) return;
                      onClose();
                      onInspectH2H(opponent, match.id);
                    }}
                    className="w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-stone-950/40 hover:bg-orange-50/50 dark:hover:bg-stone-800/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                        <span
                          className={`mr-2 font-mono text-xs ${
                            won
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {won ? (isVi ? 'THẮNG' : 'WIN') : isVi ? 'THUA' : 'LOSS'}
                        </span>
                        vs {opponent}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {match.tournamentTitle || '1986'} · {match.roundLabel} · {match.courtName}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs tabular-nums shrink-0">
                      <span className="font-semibold text-stone-700 dark:text-stone-300">
                        {scoreDisplay}
                      </span>
                      {delta !== 0 && (
                        <span
                          className={`font-bold ${
                            delta > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                        </span>
                      )}
                      {onInspectH2H && (
                        <span className="text-[11px] font-sans font-semibold text-accent inline-flex items-center gap-0.5">
                          <Swords className="w-3 h-3" />
                          <span>H2H</span>
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
    </MotionModal>
  );
};
