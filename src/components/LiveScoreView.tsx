import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BellRing,
  CheckCircle2,
  Minus,
  Play,
  Plus,
  Share2,
  ShieldCheck,
  Swords,
  Trophy,
} from 'lucide-react';
import { t } from '../lib/i18n';
import type { ShareCardPayload } from '../lib/shareCard';
import type { Language, MatchRecord } from '../lib/types';

interface LiveScoreViewProps {
  matches: MatchRecord[];
  language: Language;
  canShare?: boolean;
  onUpdateMatchScore: (match: MatchRecord, next: Partial<MatchRecord>) => Promise<void>;
  onCompleteMatch: (match: MatchRecord, winnerSide: 'A' | 'B') => Promise<void>;
  onScheduleMatchAlert: (match: MatchRecord) => Promise<void>;
  onOpenShare: (payload: ShareCardPayload) => void;
  onOpenRefereeApp: (match: MatchRecord) => void;
  onInspectMatchH2H?: (match: MatchRecord) => void;
}

export const LiveScoreView: React.FC<LiveScoreViewProps> = ({
  matches,
  language,
  canShare = true,
  onUpdateMatchScore,
  onCompleteMatch,
  onScheduleMatchAlert,
  onOpenShare,
  onOpenRefereeApp,
  onInspectMatchH2H,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matches.find((m) => m.status === 'live')?.id || matches[0]?.id || ''
  );

  const filteredMatches = useMemo(() => {
    if (statusFilter === 'all') return matches;
    return matches.filter((m) => m.status === statusFilter);
  }, [matches, statusFilter]);

  const activeMatch =
    matches.find((m) => m.id === selectedMatchId) || filteredMatches[0] || matches[0];

  const handlePoint = async (side: 'A' | 'B', delta: number) => {
    if (!activeMatch || activeMatch.status === 'completed') return;
    const scoreA = side === 'A' ? Math.max(0, Math.min(50, activeMatch.scoreA + delta)) : activeMatch.scoreA;
    const scoreB = side === 'B' ? Math.max(0, Math.min(50, activeMatch.scoreB + delta)) : activeMatch.scoreB;
    await onUpdateMatchScore(activeMatch, {
      scoreA,
      scoreB,
      status: 'live',
      servingSide: delta > 0 ? side : activeMatch.servingSide,
    });
  };

  const handleSwitchServe = async () => {
    if (!activeMatch || activeMatch.status === 'completed') return;
    await onUpdateMatchScore(activeMatch, {
      servingSide: activeMatch.servingSide === 'A' ? 'B' : 'A',
    });
  };

  const handleCompleteSet = async () => {
    if (!activeMatch || activeMatch.status === 'completed') return;
    if (activeMatch.scoreA === activeMatch.scoreB) return;
    const setWinner = activeMatch.scoreA > activeMatch.scoreB ? 'A' : 'B';
    const nextHistory = [...(activeMatch.setHistory || []), `${activeMatch.scoreA}-${activeMatch.scoreB}`];
    const nextSetsA = activeMatch.setsA + (setWinner === 'A' ? 1 : 0);
    const nextSetsB = activeMatch.setsB + (setWinner === 'B' ? 1 : 0);
    await onUpdateMatchScore(activeMatch, {
      setsA: nextSetsA,
      setsB: nextSetsB,
      scoreA: 0,
      scoreB: 0,
      setHistory: nextHistory.slice(0, 5),
      status: 'live',
    });
  };

  const handleFinalize = async () => {
    if (!activeMatch || activeMatch.status === 'completed') return;
    let winner: 'A' | 'B' = 'A';
    if (activeMatch.setsA !== activeMatch.setsB) {
      winner = activeMatch.setsA > activeMatch.setsB ? 'A' : 'B';
    } else {
      winner = activeMatch.scoreA >= activeMatch.scoreB ? 'A' : 'B';
    }
    await onCompleteMatch(activeMatch, winner);
  };

  const shareActiveMatch = (match: MatchRecord) => {
    const scoreLine =
      match.setHistory.length > 0
        ? `Sets: ${match.setHistory.join(' · ')}`
        : `Court score: ${match.scoreA} - ${match.scoreB}`;
    onOpenShare({
      title: match.tournamentTitle || '1986 Match',
      subtitle: `${match.roundLabel} · ${match.courtName}`,
      leftName: match.teamAName,
      rightName: match.teamBName,
      leftScore: match.status === 'completed' ? String(match.setsA) : String(match.scoreA),
      rightScore: match.status === 'completed' ? String(match.setsB) : String(match.scoreB),
      detailLine: `${scoreLine}${match.ratingDelta ? ` · DUPR +${match.ratingDelta.toFixed(2)}` : ''}`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {t(language, 'liveTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(language, 'liveSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg self-start overflow-x-auto touch-scroll-x no-scrollbar max-w-full">
          {(
            [
              ['all', t(language, 'filterAll')],
              ['live', t(language, 'statusLive')],
              ['upcoming', t(language, 'statusUpcoming')],
              ['completed', t(language, 'statusCompleted')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Court Match List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredMatches.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {language === 'vi' ? 'Không có trận đấu nào trong mục này.' : 'No matches in this filter.'}
              </p>
            </div>
          ) : (
            filteredMatches.map((m) => {
              const selected = activeMatch?.id === m.id;
              return (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedMatchId(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMatchId(m.id);
                    }
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-white dark:bg-slate-900 border-accent ring-1 ring-orange-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                    <span className="truncate">
                      {m.courtName} · {m.roundLabel}
                    </span>
                    <span
                      className={`font-semibold whitespace-nowrap ${
                        m.status === 'live'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : m.status === 'upcoming'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {m.status === 'live'
                        ? t(language, 'statusLive')
                        : m.status === 'upcoming'
                        ? m.scheduledTime || t(language, 'statusUpcoming')
                        : t(language, 'statusCompleted')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          m.winnerSide === 'A'
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {m.teamAName}
                        {m.status === 'live' && m.servingSide === 'A' ? ' •' : ''}
                      </span>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-xs text-slate-400">Set {m.setsA}</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white w-6 text-right">
                          {m.scoreA}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${
                          m.winnerSide === 'B'
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {m.teamBName}
                        {m.status === 'live' && m.servingSide === 'B' ? ' •' : ''}
                      </span>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-xs text-slate-400">Set {m.setsB}</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white w-6 text-right">
                          {m.scoreB}
                        </span>
                      </div>
                    </div>
                  </div>

                  {onInspectMatchH2H && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectMatchH2H(m);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                      >
                        <Swords className="w-3 h-3" />
                        <span>{language === 'vi' ? 'Lịch sử đối đầu H2H' : 'Head-to-Head'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Referee & Live Scoreboard Console */}
        {activeMatch && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeMatch.tournamentTitle || '1986'} · {activeMatch.courtName} · {activeMatch.roundLabel}
                </p>
                {onInspectMatchH2H ? (
                  <button
                    type="button"
                    onClick={() => onInspectMatchH2H(activeMatch)}
                    className="text-left group mt-0.5"
                    title={language === 'vi' ? 'Nhấn xem lịch sử đối đầu H2H' : 'Click to inspect Head-to-Head'}
                  >
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-accent transition-colors">
                      {activeMatch.teamAName} vs {activeMatch.teamBName}
                    </h2>
                  </button>
                ) : (
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeMatch.teamAName} vs {activeMatch.teamBName}
                  </h2>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onInspectMatchH2H && (
                  <button
                    type="button"
                    onClick={() => onInspectMatchH2H(activeMatch)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-orange-300/70 dark:border-orange-800/80 bg-accent-soft text-accent hover:opacity-90 whitespace-nowrap"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Đối đầu H2H' : 'H2H'}</span>
                  </button>
                )}
                {activeMatch.status !== 'completed' && (
                  <button
                    onClick={() => onOpenRefereeApp(activeMatch)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t(language, 'refereeApp')}</span>
                  </button>
                )}
                {activeMatch.status === 'upcoming' && (
                  <button
                    onClick={() => void onScheduleMatchAlert(activeMatch)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <BellRing className="w-3.5 h-3.5 text-accent" />
                    <span>{t(language, 'remindMe')}</span>
                  </button>
                )}
                {canShare && (
                  <button
                    onClick={() => shareActiveMatch(activeMatch)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{t(language, 'shareResult')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* High-Contrast Court Scoreboard */}
            <div className="rounded-xl bg-slate-950 text-white p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-400">
                <span className="truncate">
                  {language === 'vi'
                    ? `Luật ${activeMatch.targetPoints} điểm · Cách biệt 2`
                    : `Play to ${activeMatch.targetPoints} · Win by 2`}
                </span>
                <span className="font-mono shrink-0">
                  {activeMatch.setHistory.length > 0
                    ? activeMatch.setHistory.join(' / ')
                    : 'Set 1'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-6 items-center">
                {/* Team A */}
                <div className="space-y-2.5 sm:space-y-3 text-center min-w-0">
                  <div className="min-h-[40px] sm:min-h-[44px] flex flex-col items-center justify-center">
                    <p className="text-xs sm:text-base font-bold text-white truncate max-w-full">
                      {activeMatch.teamAName}
                    </p>
                    <span className="text-[11px] text-amber-400 font-medium h-4">
                      {activeMatch.status === 'live' && activeMatch.servingSide === 'A'
                        ? t(language, 'serving')
                        : activeMatch.winnerSide === 'A'
                        ? 'Winner'
                        : ''}
                    </span>
                  </div>
                  <div className="text-[clamp(2.75rem,12vw,3.75rem)] font-extrabold font-mono tabular-nums tracking-tight leading-none text-white">
                    {activeMatch.scoreA}
                  </div>
                  <p className="text-xs font-mono text-slate-400 tabular-nums">
                    Sets: <span className="text-white font-semibold">{activeMatch.setsA}</span>
                  </p>
                </div>

                {/* Team B */}
                <div className="space-y-2.5 sm:space-y-3 text-center border-l border-slate-800 pl-3 sm:pl-4 min-w-0">
                  <div className="min-h-[40px] sm:min-h-[44px] flex flex-col items-center justify-center">
                    <p className="text-xs sm:text-base font-bold text-white truncate max-w-full">
                      {activeMatch.teamBName}
                    </p>
                    <span className="text-[11px] text-amber-400 font-medium h-4">
                      {activeMatch.status === 'live' && activeMatch.servingSide === 'B'
                        ? t(language, 'serving')
                        : activeMatch.winnerSide === 'B'
                        ? 'Winner'
                        : ''}
                    </span>
                  </div>
                  <div className="text-[clamp(2.75rem,12vw,3.75rem)] font-extrabold font-mono tabular-nums tracking-tight leading-none text-white">
                    {activeMatch.scoreB}
                  </div>
                  <p className="text-xs font-mono text-slate-400 tabular-nums">
                    Sets: <span className="text-white font-semibold">{activeMatch.setsB}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Courtside Referee Controls (Large touch targets >= 44px) */}
            {activeMatch.status === 'completed' ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                  <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {language === 'vi' ? 'Chiến thắng:' : 'Winner:'}{' '}
                    <strong>
                      {activeMatch.winnerSide === 'A'
                        ? activeMatch.teamAName
                        : activeMatch.teamBName}
                    </strong>
                    {activeMatch.ratingDelta
                      ? ` · DUPR +${activeMatch.ratingDelta.toFixed(2)}`
                      : ''}
                  </span>
                </div>
                <button
                  onClick={() => shareActiveMatch(activeMatch)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
                >
                  {t(language, 'shareResult')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeMatch.status === 'upcoming' && (
                  <button
                    onClick={() => void onUpdateMatchScore(activeMatch, { status: 'live' })}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold btn-accent"
                  >
                    <Play className="w-4 h-4" />
                    <span>{t(language, 'startMatch')}</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handlePoint('A', -1)}
                      aria-label="Subtract Team A point"
                      className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handlePoint('A', 1)}
                      className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold btn-accent"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="truncate">{activeMatch.teamAName.split(' ')[0]}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handlePoint('B', -1)}
                      aria-label="Subtract Team B point"
                      className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void handlePoint('B', 1)}
                      className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold btn-accent"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="truncate">{activeMatch.teamBName.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => void handleSwitchServe()}
                    className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>{t(language, 'switchServe')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={activeMatch.scoreA === activeMatch.scoreB}
                      onClick={() => void handleCompleteSet()}
                      className="min-h-[42px] px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap disabled:opacity-40"
                    >
                      {t(language, 'completeSet')}
                    </button>

                    <button
                      onClick={() => void handleFinalize()}
                      className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t(language, 'finishMatch')}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
