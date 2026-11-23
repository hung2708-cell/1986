import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Flag,
  Flame,
  MapPin,
  Share2,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import {
  computeH2H,
  getInitials,
  listOpponentsForEntity,
  type H2HContext,
  type H2HEntity,
} from '../lib/h2h';
import type { ShareCardPayload } from '../lib/shareCard';
import { MotionModal } from './MotionModal';
import type {
  AthleteProfile,
  Language,
  MatchRecord,
  TeamEntry,
  TeamTie,
} from '../lib/types';

interface HeadToHeadModalProps {
  context: H2HContext;
  matches: MatchRecord[];
  ties: TeamTie[];
  teams: TeamEntry[];
  athletes: AthleteProfile[];
  language: Language;
  canShare?: boolean;
  onOpenShare?: (payload: ShareCardPayload) => void;
  onClose: () => void;
}

type EncounterFilter = 'all' | 'completed' | 'active';

export const HeadToHeadModal: React.FC<HeadToHeadModalProps> = ({
  context,
  matches,
  ties,
  teams,
  athletes,
  language,
  canShare = true,
  onOpenShare,
  onClose,
}) => {
  const isVi = language === 'vi';
  const [swapped, setSwapped] = useState(false);
  const [expandedTieIds, setExpandedTieIds] = useState<Record<string, boolean>>({});
  const [encounterFilter, setEncounterFilter] = useState<EncounterFilter>('all');

  const opponentOptions = useMemo(
    () => listOpponentsForEntity(context.sideA, athletes, teams, matches, ties, language),
    [context.sideA, athletes, teams, matches, ties, language]
  );

  const [selectedOpponentKey, setSelectedOpponentKey] = useState<string>(() => {
    if (context.sideB) return context.sideB.name.toLowerCase();
    return opponentOptions[0]?.entity.name.toLowerCase() || '';
  });

  useEffect(() => {
    setSwapped(false);
    setEncounterFilter('all');
    if (context.sideB) {
      setSelectedOpponentKey(context.sideB.name.toLowerCase());
    } else {
      setSelectedOpponentKey(opponentOptions[0]?.entity.name.toLowerCase() || '');
    }
  }, [context, opponentOptions]);

  const resolvedSideB: H2HEntity | null = useMemo(() => {
    if (
      context.sideB &&
      context.sideB.name.toLowerCase() === selectedOpponentKey
    ) {
      return context.sideB;
    }
    const found = opponentOptions.find(
      (opt) => opt.entity.name.toLowerCase() === selectedOpponentKey
    );
    return found?.entity || context.sideB || opponentOptions[0]?.entity || null;
  }, [context.sideB, opponentOptions, selectedOpponentKey]);

  const sideA: H2HEntity = swapped && resolvedSideB ? resolvedSideB : context.sideA;
  const sideB: H2HEntity | null = swapped && resolvedSideB ? context.sideA : resolvedSideB;

  const stats = useMemo(
    () => computeH2H(sideA, sideB, matches, ties, teams),
    [sideA, sideB, matches, ties, teams]
  );

  const filteredEncounters = useMemo(() => {
    if (encounterFilter === 'completed') {
      return stats.encounters.filter((e) => e.status === 'completed');
    }
    if (encounterFilter === 'active') {
      return stats.encounters.filter((e) => e.status !== 'completed');
    }
    return stats.encounters;
  }, [stats.encounters, encounterFilter]);

  const toggleTieExpanded = (id: string) => {
    setExpandedTieIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleShareH2H = () => {
    if (!onOpenShare || !sideB) return;
    onOpenShare({
      title: isVi ? 'Phân tích Đối đầu Chi tiết (H2H)' : 'Detailed Head-to-Head Analytics',
      subtitle: context.contextLabel || '1986 Pickleball',
      leftName: sideA.name,
      rightName: sideB.name,
      leftScore: String(stats.winsA),
      rightScore: String(stats.winsB),
      detailLine: `${stats.completedCount} ${isVi ? 'trận hoàn tất' : 'completed'} · ${
        isVi ? 'Tổng điểm' : 'Points'
      } ${stats.pointsA}-${stats.pointsB} · ${isVi ? 'TB' : 'Avg'} ${stats.avgPointsA}-${stats.avgPointsB}`,
    });
  };

  const drawPct =
    stats.completedCount > 0 ? Math.max(0, 100 - stats.winRateA - stats.winRateB) : 0;

  const maxTrendAbs = useMemo(() => {
    if (stats.marginTrendA.length === 0) return 1;
    return Math.max(2, ...stats.marginTrendA.map((m) => Math.abs(m.marginA)));
  }, [stats.marginTrendA]);

  const shortNameA = sideA.name.split(' ').slice(-1)[0] || sideA.name;
  const shortNameB = sideB ? sideB.name.split(' ').slice(-1)[0] || sideB.name : '';

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={isVi ? 'Dữ liệu đối đầu chi tiết H2H' : 'Detailed Head-to-Head Analytics'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      panelClassName="w-full sm:max-w-3xl bg-white dark:bg-[#19120E] border-t sm:border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
    >
        {/* Mobile grab handle */}
        <div className="sm:hidden bg-[#120D0A] pt-2.5 pb-0.5 flex justify-center shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-600" />
        </div>

        {/* Header */}
        <div className="bg-[#120D0A] text-white px-5 py-4 flex items-center justify-between gap-3 border-b border-orange-500/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold font-display tracking-tight truncate">
                {isVi ? 'Dữ liệu Đối đầu Chi tiết (H2H)' : 'Detailed Head-to-Head Analytics'}
              </h2>
              <p className="text-xs text-stone-300 truncate">
                {context.contextLabel
                  ? context.contextLabel
                  : sideA.kind === 'team'
                    ? isVi
                      ? 'Phân tích đối kháng chuyên sâu giữa hai đội tuyển'
                      : 'In-depth team-to-team matchup analytics'
                    : isVi
                      ? 'Phân tích đối kháng, hiệu suất sân và bản lĩnh điểm quyết định'
                      : 'Matchup breakdown, court splits, and clutch performance'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/10 shrink-0"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {/* Opponent Switcher Bar */}
          {opponentOptions.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <label className="block text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1">
                  {sideA.kind === 'team'
                    ? isVi
                      ? `Chọn đội đối thủ so sánh với ${context.sideA.name}`
                      : `Compare ${context.sideA.name} against team`
                    : isVi
                      ? `Chọn đối thủ so sánh với ${context.sideA.name}`
                      : `Compare ${context.sideA.name} against opponent`}
                </label>
                <select
                  value={selectedOpponentKey}
                  onChange={(e) => {
                    setSwapped(false);
                    setSelectedOpponentKey(e.target.value);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-950 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  {context.sideB &&
                    !opponentOptions.some(
                      (o) => o.entity.name.toLowerCase() === context.sideB!.name.toLowerCase()
                    ) && (
                      <option value={context.sideB.name.toLowerCase()}>
                        {context.sideB.name}
                      </option>
                    )}
                  {opponentOptions.map((opt) => (
                    <option
                      key={opt.entity.name.toLowerCase()}
                      value={opt.entity.name.toLowerCase()}
                    >
                      {opt.entity.name}
                      {opt.meetings > 0
                        ? isVi
                          ? ` (${opt.meetings} trận · ${opt.winsForBase}-${opt.lossesForBase}${
                              opt.draws > 0 ? `-${opt.draws}` : ''
                            })`
                          : ` (${opt.meetings} matches · ${opt.winsForBase}-${opt.lossesForBase})`
                        : isVi
                          ? ' (Chưa gặp)'
                          : ' (Unplayed)'}
                    </option>
                  ))}
                </select>
              </div>
              {sideB && (
                <button
                  type="button"
                  onClick={() => setSwapped((prev) => !prev)}
                  className="sm:self-end min-h-[42px] px-3.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  title={isVi ? 'Đổi vị trí A / B' : 'Swap sides'}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-accent" />
                  <span>{isVi ? 'Đổi bên' : 'Swap'}</span>
                </button>
              )}
            </div>
          )}

          {!sideB ? (
            <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center space-y-2">
              <Swords className="w-7 h-7 text-stone-400 mx-auto" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                {isVi
                  ? 'Chưa có đối thủ thứ hai để so sánh đối đầu.'
                  : 'No second opponent available to compare yet.'}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isVi
                  ? 'Hãy thêm thêm VĐV hoặc đội tuyển để xem thống kê đối đầu H2H.'
                  : 'Add another athlete or team to inspect Head-to-Head statistics.'}
              </p>
            </div>
          ) : (
            <>
              {/* Hero Matchup Comparison Scoreboard */}
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-950/80 p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-11 items-center gap-2 text-center">
                  {/* Side A */}
                  <div className="col-span-4 space-y-1.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-accent-soft border border-orange-500/35 text-accent font-extrabold text-xs flex items-center justify-center mx-auto">
                      {sideA.initials || getInitials(sideA.name)}
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-white leading-snug line-clamp-2">
                      {sideA.name}
                    </p>
                    {sideA.subtitle && (
                      <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                        {sideA.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Center Scoreline */}
                  <div className="col-span-3 space-y-1">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 font-mono font-extrabold text-2xl sm:text-4xl tabular-nums leading-none">
                      <span
                        className={
                          stats.winsA >= stats.winsB
                            ? 'text-accent'
                            : 'text-stone-700 dark:text-stone-300'
                        }
                      >
                        {stats.winsA}
                      </span>
                      <span className="text-stone-400 text-lg sm:text-2xl">-</span>
                      <span
                        className={
                          stats.winsB > stats.winsA
                            ? 'text-accent'
                            : 'text-stone-700 dark:text-stone-300'
                        }
                      >
                        {stats.winsB}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                      {stats.completedCount} {isVi ? 'trận xong' : 'played'}
                      {stats.draws > 0 ? ` · ${stats.draws} ${isVi ? 'hòa' : 'D'}` : ''}
                    </p>
                    {stats.currentStreak && stats.currentStreak.count >= 2 && (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {stats.currentStreak.side === 'draw'
                          ? isVi
                            ? `Chuỗi ${stats.currentStreak.count} hòa`
                            : `${stats.currentStreak.count} draw streak`
                          : isVi
                            ? `${
                                stats.currentStreak.side === 'A' ? shortNameA : shortNameB
                              } thắng ${stats.currentStreak.count} liên tiếp`
                            : `${stats.currentStreak.count}W streak`}
                      </p>
                    )}
                  </div>

                  {/* Side B */}
                  <div className="col-span-4 space-y-1.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-stone-200/80 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-100 font-extrabold text-xs flex items-center justify-center mx-auto">
                      {sideB.initials || getInitials(sideB.name)}
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-stone-900 dark:text-white leading-snug line-clamp-2">
                      {sideB.name}
                    </p>
                    {sideB.subtitle && (
                      <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                        {sideB.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Proportional Win-Rate & Point-Share Bars */}
                <div className="space-y-2.5 pt-2.5 border-t border-stone-200/80 dark:border-stone-800">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-600 dark:text-stone-300">
                      <span className="font-bold text-accent">
                        {isVi ? 'Tỷ lệ thắng' : 'Win %'}: {stats.winRateA}%
                      </span>
                      {stats.draws > 0 && (
                        <span className="text-stone-500">
                          {isVi ? 'Hòa' : 'Draw'}: {drawPct}%
                        </span>
                      )}
                      <span className="font-bold">
                        {stats.winRateB}% :{isVi ? 'Tỷ lệ thắng' : 'Win %'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full overflow-hidden bg-stone-200 dark:bg-stone-800 flex">
                      {stats.completedCount > 0 ? (
                        <>
                          <div
                            className="h-full bg-[#EA580C] transition-all duration-300"
                            style={{ width: `${stats.winRateA}%` }}
                          />
                          {drawPct > 0 && (
                            <div
                              className="h-full bg-amber-400 transition-all duration-300"
                              style={{ width: `${drawPct}%` }}
                            />
                          )}
                          <div
                            className="h-full bg-stone-700 dark:bg-stone-400 transition-all duration-300"
                            style={{ width: `${stats.winRateB}%` }}
                          />
                        </>
                      ) : (
                        <div className="h-full w-full bg-stone-300/70 dark:bg-stone-700/70" />
                      )}
                    </div>
                  </div>

                  {stats.completedCount > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-stone-500 dark:text-stone-400">
                        <span>
                          {isVi ? 'Thị phần điểm' : 'Point share'}: {stats.pointShareA}% ({stats.pointsA})
                        </span>
                        <span>
                          ({stats.pointsB}) {100 - stats.pointShareA}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden bg-stone-200 dark:bg-stone-800 flex">
                        <div
                          className="h-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${stats.pointShareA}%` }}
                        />
                        <div
                          className="h-full bg-stone-500 dark:bg-stone-500 transition-all duration-300"
                          style={{ width: `${100 - stats.pointShareA}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 6-Metric Detailed Quantitative Analytics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden divide-x divide-y divide-stone-200 dark:divide-stone-800 text-center bg-white dark:bg-stone-950/40">
                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {isVi ? 'Điểm TB / trận' : 'Avg Points / Match'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-0.5">
                    {stats.avgPointsA} - {stats.avgPointsB}
                  </p>
                  <p
                    className={`text-[11px] font-mono tabular-nums ${
                      stats.avgMarginA > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : stats.avgMarginA < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-stone-500'
                    }`}
                  >
                    {isVi ? 'TB chênh:' : 'Avg margin:'}{' '}
                    {stats.avgMarginA > 0 ? `+${stats.avgMarginA}` : stats.avgMarginA}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {sideA.kind === 'team'
                      ? isVi
                        ? 'Tổng trận con (Đôi/Đơn)'
                        : 'Sub-matches Won'
                      : isVi
                        ? 'Tổng ván thắng'
                        : 'Games / Sets Won'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-0.5">
                    {stats.setsWonA} - {stats.setsWonB}
                  </p>
                  <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                    {isVi ? 'Hiệu số điểm:' : 'Pt diff:'}{' '}
                    {stats.pointDiffA > 0 ? `+${stats.pointDiffA}` : stats.pointDiffA}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {isVi ? 'Bản lĩnh trận sát nút' : 'Clutch Record'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-accent mt-0.5">
                    {stats.closeWinsA} - {stats.closeWinsB}
                  </p>
                  <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                    {stats.deciderTotal > 0
                      ? `${isVi ? 'Tie-break:' : 'Deciders:'} ${stats.deciderWinsA}-${stats.deciderWinsB}`
                      : isVi
                        ? `${stats.closeGamesTotal} trận căng thẳng`
                        : `${stats.closeGamesTotal} tight games`}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {isVi ? 'Phong độ 5 trận gần nhất' : 'Last 5 Form'}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1.5 font-mono text-xs font-extrabold">
                    {stats.recentFormA.length === 0 ? (
                      <span className="text-stone-400 font-normal">—</span>
                    ) : (
                      stats.recentFormA.map((code, idx) => (
                        <span
                          key={`${code}_${idx}`}
                          className={`w-5 h-5 rounded flex items-center justify-center ${
                            code === 'W'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : code === 'D'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {isVi
                            ? code === 'W'
                              ? 'T'
                              : code === 'D'
                                ? 'H'
                                : 'B'
                            : code}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {isVi ? 'Chuỗi thắng dài nhất' : 'Longest Win Streak'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-stone-900 dark:text-white mt-0.5">
                    {stats.longestStreakA} - {stats.longestStreakB}
                  </p>
                  <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                    {shortNameA} / {shortNameB}
                  </p>
                </div>

                <div className="p-3">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {stats.duprExpectedWinA !== null
                      ? isVi
                        ? 'Xác suất DUPR'
                        : 'DUPR Win Odds'
                      : isVi
                        ? 'Tổng lần gặp'
                        : 'Total Meetings'}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold font-mono tabular-nums text-accent mt-0.5">
                    {stats.duprExpectedWinA !== null
                      ? `${stats.duprExpectedWinA}% - ${100 - stats.duprExpectedWinA}%`
                      : stats.encounters.length}
                  </p>
                  <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                    {sideA.duprRating !== undefined && sideB.duprRating !== undefined
                      ? `DUPR ${sideA.duprRating.toFixed(2)} vs ${sideB.duprRating.toFixed(2)}`
                      : isVi
                        ? `${stats.upcomingOrLiveCount} sắp / đang đấu`
                        : `${stats.upcomingOrLiveCount} live / next`}
                  </p>
                </div>
              </div>

              {/* Matchup Highlights (Biggest Wins & Closest Thriller) */}
              {(stats.biggestWinA || stats.biggestWinB || stats.closestMatch) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {stats.biggestWinA && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-950/60 p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span className="truncate font-semibold text-accent">
                          {isVi ? `Thắng đậm nhất · ${shortNameA}` : `Biggest Win · ${shortNameA}`}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{stats.biggestWinA.margin}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-white">
                        {stats.biggestWinA.scoreLabel}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          ({stats.biggestWinA.pointsLabel})
                        </span>
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {stats.biggestWinA.roundLabel} · {stats.biggestWinA.courtName}
                      </p>
                    </div>
                  )}

                  {stats.biggestWinB && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-950/60 p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span className="truncate font-semibold text-stone-700 dark:text-stone-200">
                          {isVi ? `Thắng đậm nhất · ${shortNameB}` : `Biggest Win · ${shortNameB}`}
                        </span>
                        <span className="font-mono font-bold text-stone-700 dark:text-stone-300 tabular-nums">
                          +{stats.biggestWinB.margin}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-white">
                        {stats.biggestWinB.scoreLabel}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          ({stats.biggestWinB.pointsLabel})
                        </span>
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {stats.biggestWinB.roundLabel} · {stats.biggestWinB.courtName}
                      </p>
                    </div>
                  )}

                  {stats.closestMatch && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-950/60 p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                          <Flame className="w-3 h-3 shrink-0" />
                          <span>{isVi ? 'Trận kịch tính nhất' : 'Closest Thriller'}</span>
                        </span>
                        <span className="font-mono font-bold tabular-nums">
                          ±{stats.closestMatch.margin}
                        </span>
                      </div>
                      <p className="text-sm font-extrabold font-mono tabular-nums text-stone-900 dark:text-white">
                        {stats.closestMatch.scoreLabel}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          ({stats.closestMatch.pointsLabel})
                        </span>
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {stats.closestMatch.roundLabel} · {stats.closestMatch.courtName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Point Margin Momentum Chart */}
              {stats.marginTrendA.length >= 2 && (
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950/40 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-stone-900 dark:text-white inline-flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-accent" />
                      <span>
                        {isVi
                          ? `Biểu đồ chênh lệch điểm (${shortNameA} vs ${shortNameB})`
                          : `Point Margin Momentum (${shortNameA} vs ${shortNameB})`}
                      </span>
                    </h3>
                    <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                      {stats.marginTrendA.length} {isVi ? 'trận gần nhất' : 'recent'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 items-end pt-2">
                    {stats.marginTrendA.map((pt, idx) => {
                      const heightPct = Math.max(
                        18,
                        Math.round((Math.abs(pt.marginA) / maxTrendAbs) * 100)
                      );
                      const isPositive = pt.marginA > 0;
                      const isZero = pt.marginA === 0;
                      return (
                        <div
                          key={`${pt.id}_${idx}`}
                          className="flex flex-col items-center gap-1"
                          title={`${pt.label}: ${pt.scoreLabel} (${pt.marginA > 0 ? '+' : ''}${pt.marginA})`}
                        >
                          <span
                            className={`text-[10px] font-mono font-bold tabular-nums ${
                              isPositive
                                ? 'text-accent'
                                : isZero
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-stone-500 dark:text-stone-400'
                            }`}
                          >
                            {pt.marginA > 0 ? `+${pt.marginA}` : pt.marginA}
                          </span>
                          <div className="w-full h-14 flex items-end justify-center bg-stone-100/80 dark:bg-stone-900 rounded-md p-1">
                            <div
                              className={`w-full rounded-sm transition-all duration-300 ${
                                isPositive
                                  ? 'bg-[#EA580C]'
                                  : isZero
                                    ? 'bg-amber-400'
                                    : 'bg-stone-500 dark:bg-stone-500'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 truncate max-w-full">
                            #{idx + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Breakdown by Event Category & Court */}
              {(stats.categoryBreakdown.length > 0 || stats.courtBreakdown.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {stats.categoryBreakdown.length > 0 && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-950/40">
                      <div className="px-3.5 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-900/70 flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-white">
                          {isVi ? 'Phân tích theo Nội dung / Vòng' : 'By Event / Stage'}
                        </span>
                        <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                          {isVi ? 'Tỷ số · Điểm' : 'W-L · Pts'}
                        </span>
                      </div>
                      <div className="divide-y divide-stone-100 dark:divide-stone-800">
                        {stats.categoryBreakdown.map((cat) => (
                          <div
                            key={cat.key}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                              {isVi ? cat.labelVi : cat.labelEn}
                            </span>
                            <span className="font-mono tabular-nums shrink-0 text-right">
                              <span className="font-extrabold text-accent">
                                {cat.winsA}-{cat.winsB}
                                {cat.draws > 0 ? `-${cat.draws}` : ''}
                              </span>
                              <span className="text-stone-400 mx-1.5">·</span>
                              <span className="text-stone-600 dark:text-stone-400">
                                {cat.pointsA}-{cat.pointsB}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.courtBreakdown.length > 0 && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-950/40">
                      <div className="px-3.5 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-900/70 flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-white inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-accent" />
                          <span>{isVi ? 'Hiệu suất theo Mặt sân' : 'Record by Court'}</span>
                        </span>
                        <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                          {isVi ? 'T-B · +/-' : 'W-L · +/-'}
                        </span>
                      </div>
                      <div className="divide-y divide-stone-100 dark:divide-stone-800">
                        {stats.courtBreakdown.map((crt) => (
                          <div
                            key={crt.courtName}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                              {crt.courtName}
                              <span className="text-[11px] text-stone-400 ml-1.5">
                                ({crt.played} {isVi ? 'trận' : 'g'})
                              </span>
                            </span>
                            <span className="font-mono tabular-nums shrink-0">
                              <span className="font-extrabold text-stone-900 dark:text-white">
                                {crt.winsA}-{crt.winsB}
                                {crt.draws > 0 ? `-${crt.draws}` : ''}
                              </span>
                              <span className="text-stone-400 mx-1.5">·</span>
                              <span
                                className={
                                  crt.pointDiffA > 0
                                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                    : crt.pointDiffA < 0
                                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                                      : 'text-stone-500'
                                }
                              >
                                {crt.pointDiffA > 0 ? `+${crt.pointDiffA}` : crt.pointDiffA}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chronological Encounter List with Filter */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-accent" />
                    <span>
                      {isVi
                        ? `Chi tiết từng lần đối đầu (${filteredEncounters.length}/${stats.encounters.length})`
                        : `Match-by-Match History (${filteredEncounters.length}/${stats.encounters.length})`}
                    </span>
                  </h3>

                  {stats.encounters.length > 0 && (
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-[11px]">
                      {(
                        [
                          { id: 'all', vi: 'Tất cả', en: 'All' },
                          { id: 'completed', vi: 'Hoàn tất', en: 'Completed' },
                          { id: 'active', vi: 'Sắp / Live', en: 'Live / Next' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setEncounterFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                            encounterFilter === tab.id
                              ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs'
                              : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                          }`}
                        >
                          {isVi ? tab.vi : tab.en}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filteredEncounters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 p-6 text-center space-y-1.5">
                    <Trophy className="w-6 h-6 text-accent/70 mx-auto" />
                    <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
                      {stats.encounters.length === 0
                        ? isVi
                          ? 'Lần đầu chạm trán'
                          : 'First-Time Matchup'
                        : isVi
                          ? 'Không có trận đấu trong mục lọc này'
                          : 'No meetings in this filter'}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
                      {stats.encounters.length === 0
                        ? isVi
                          ? `${sideA.name} và ${sideB.name} chưa có lịch sử đối đầu nào được ghi nhận trước đây. Kết quả trận đấu sau khi hoàn tất sẽ tự động cập nhật vào bảng H2H.`
                          : `${sideA.name} and ${sideB.name} have no prior recorded meetings. Completed results will automatically appear here.`
                        : isVi
                          ? 'Chuyển sang bộ lọc "Tất cả" để xem toàn bộ lịch sử chạm trán.'
                          : 'Switch to "All" to view all scheduled and completed meetings.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-stone-200/80 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
                    {filteredEncounters.map((enc) => {
                      const isHighlighted = context.highlightMatchId === enc.id;
                      const hasSubs = Boolean(enc.subMatches && enc.subMatches.length > 0);
                      const isExpanded = Boolean(expandedTieIds[enc.id]);

                      const outcomeText =
                        enc.status === 'live'
                          ? isVi
                            ? 'ĐANG ĐẤU'
                            : 'LIVE'
                          : enc.status === 'upcoming'
                            ? isVi
                              ? 'SẮP ĐẤU'
                              : 'UPCOMING'
                            : enc.outcomeForA === 'win'
                              ? isVi
                                ? `${shortNameA} THẮNG`
                                : 'SIDE A WIN'
                              : enc.outcomeForA === 'loss'
                                ? isVi
                                  ? `${shortNameB} THẮNG`
                                  : 'SIDE B WIN'
                                : isVi
                                  ? 'HÒA 2-2'
                                  : 'DRAW';

                      const outcomeColor =
                        enc.status === 'live'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : enc.status === 'upcoming'
                            ? 'text-amber-600 dark:text-amber-400'
                            : enc.outcomeForA === 'win'
                              ? 'text-accent'
                              : 'text-stone-700 dark:text-stone-300';

                      return (
                        <div
                          key={enc.id}
                          className={`p-3.5 sm:p-4 space-y-2 transition-colors ${
                            isHighlighted
                              ? 'bg-orange-50/70 dark:bg-orange-950/25'
                              : 'bg-white dark:bg-stone-950/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-stone-400">
                            <span className="truncate">
                              {enc.tournamentTitle} · {enc.roundLabel} · {enc.courtName}
                              {enc.scheduledTime ? ` · ${enc.scheduledTime}` : ''}
                            </span>
                            <span className={`font-mono font-bold shrink-0 ${outcomeColor}`}>
                              {isHighlighted ? `${isVi ? 'Trận đang xem · ' : 'Selected · '}` : ''}
                              {outcomeText}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 text-xs sm:text-sm leading-snug">
                              <span
                                className={
                                  enc.outcomeForA === 'win'
                                    ? 'font-extrabold text-stone-900 dark:text-white'
                                    : 'font-medium text-stone-700 dark:text-stone-300'
                                }
                              >
                                {enc.nameA}
                              </span>
                              <span className="mx-1.5 text-stone-400 font-normal">vs</span>
                              <span
                                className={
                                  enc.outcomeForA === 'loss'
                                    ? 'font-extrabold text-stone-900 dark:text-white'
                                    : 'font-medium text-stone-700 dark:text-stone-300'
                                }
                              >
                                {enc.nameB}
                              </span>
                            </div>

                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white">
                                {enc.scoreLabel}
                              </div>
                              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                                {enc.setBreakdown ? `${enc.setBreakdown}` : ''}
                                {enc.status === 'completed'
                                  ? `${enc.setBreakdown ? ' · ' : ''}${
                                      enc.marginA > 0 ? `+${enc.marginA}` : enc.marginA
                                    }đ`
                                  : ''}
                              </div>
                            </div>
                          </div>

                          {(enc.isForfeit || enc.ratingDelta || enc.isCloseGame || enc.isDecider || hasSubs) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-stone-500 dark:text-stone-400">
                                {enc.isForfeit && (
                                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                    <Flag className="w-3 h-3" />
                                    <span>{isVi ? 'Xử bỏ cuộc (15-0)' : 'Forfeit (15-0)'}</span>
                                  </span>
                                )}
                                {enc.isDecider && (
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    {isVi ? 'Quyết định bằng Tie-break / Set 3' : 'Decided in Tie-break'}
                                  </span>
                                )}
                                {!enc.isDecider && enc.isCloseGame && (
                                  <span className="font-semibold text-stone-600 dark:text-stone-300">
                                    {isVi ? 'Trận đấu sát nút' : 'Close finish'}
                                  </span>
                                )}
                                {enc.ratingDelta ? (
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                    DUPR ±{enc.ratingDelta.toFixed(2)}
                                  </span>
                                ) : null}
                              </div>

                              {hasSubs && (
                                <button
                                  type="button"
                                  onClick={() => toggleTieExpanded(enc.id)}
                                  className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                                >
                                  <span>
                                    {isExpanded
                                      ? isVi
                                        ? 'Ẩn chi tiết trận con'
                                        : 'Hide sub-matches'
                                      : isVi
                                        ? `Xem đội hình & tỷ số ${enc.subMatches!.length} trận con`
                                        : `View lineups & ${enc.subMatches!.length} sub-matches`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          {hasSubs && isExpanded && (
                            <div className="mt-2 pt-2.5 border-t border-stone-200/70 dark:border-stone-800 space-y-2">
                              {enc.subMatches!.map((sm) => (
                                <div
                                  key={sm.id}
                                  className="flex items-start justify-between gap-3 text-[11px] sm:text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                                      {isVi ? sm.labelVi : sm.labelEn}
                                      {sm.forfeitSide ? (isVi ? ' (Bỏ cuộc)' : ' (FF)') : ''}
                                    </p>
                                    {(sm.teamAPlayers || sm.teamBPlayers) && (
                                      <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                                        {sm.teamAPlayers || 'TBD'} <span className="opacity-60">vs</span>{' '}
                                        {sm.teamBPlayers || 'TBD'}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`font-mono font-bold tabular-nums shrink-0 ${
                                      sm.winnerSide === 'A'
                                        ? 'text-accent'
                                        : 'text-stone-900 dark:text-white'
                                    }`}
                                  >
                                    {sm.scoreA} - {sm.scoreB}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 pb-safe border-t border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#120D0A] flex items-center justify-between gap-3 shrink-0">
          {canShare && onOpenShare && sideB ? (
            <button
              type="button"
              onClick={handleShareH2H}
              className="min-h-[42px] px-4 rounded-lg text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5 text-accent" />
              <span>{isVi ? 'Chia sẻ thẻ H2H' : 'Share H2H Card'}</span>
            </button>
          ) : (
            <span className="text-xs text-stone-500 dark:text-stone-400">
              1986 · Head-to-Head Analytics
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 rounded-lg text-xs font-bold btn-accent whitespace-nowrap"
          >
            {isVi ? 'Đóng' : 'Close'}
          </button>
        </div>
    </MotionModal>
  );
};
