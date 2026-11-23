import React, { useMemo } from 'react';
import {
  BellRing,
  CheckCircle2,
  GitBranch,
  LayoutGrid,
  Play,
  Radio,
  ShieldCheck,
  Shuffle,
  Swords,
  Trophy,
} from 'lucide-react';
import type { Language, MatchRecord, Tournament } from '../lib/types';

interface LiveBracketCourtBoardProps {
  mode: 'bracket' | 'courts';
  tournament: Tournament;
  matches: MatchRecord[];
  language: Language;
  onRunDraw: () => void;
  onOpenReferee?: (match: MatchRecord) => void;
  onCallToCourt: (match: MatchRecord) => void;
  onStartMatch?: (match: MatchRecord) => void;
  onInspectMatchH2H?: (match: MatchRecord) => void;
}

export const LiveBracketCourtBoard: React.FC<LiveBracketCourtBoardProps> = ({
  mode,
  tournament,
  matches,
  language,
  onRunDraw,
  onOpenReferee,
  onCallToCourt,
  onStartMatch,
  onInspectMatchH2H,
}) => {
  const isVi = language === 'vi';

  // Organize matches into Group Stage vs Knockout rounds
  const { groupMap, roundColumns } = useMemo(() => {
    const groups = new Map<string, MatchRecord[]>();
    const rounds = new Map<string, MatchRecord[]>();

    for (const m of matches) {
      const grp =
        m.groupName ||
        (m.roundLabel.match(/Bảng\s+[A-Z0-9]+|Group\s+[A-Z0-9]+/i)?.[0] ?? '');
      if (grp) {
        const list = groups.get(grp) || [];
        list.push(m);
        groups.set(grp, list);
      } else {
        const key = m.roundLabel || (isVi ? 'Vòng 1' : 'Round 1');
        const list = rounds.get(key) || [];
        list.push(m);
        rounds.set(key, list);
      }
    }

    const roundPriority = (label: string): number => {
      const low = label.toLowerCase();
      if (low.includes('vòng 1') || low.includes('round 1') || low.includes('1/8')) return 1;
      if (low.includes('tứ kết') || low.includes('quarter')) return 2;
      if (low.includes('bán kết') || low.includes('semi')) return 3;
      if (low.includes('chung kết') || low.includes('final')) return 4;
      return 2;
    };

    const sortedRounds = Array.from(rounds.entries()).sort(
      ([a], [b]) => roundPriority(a) - roundPriority(b)
    );

    return { groupMap: groups, roundColumns: sortedRounds };
  }, [matches, isVi]);

  // Organize matches by court for the SportConnect Court Calling Board
  const courtBoards = useMemo(() => {
    const map = new Map<string, MatchRecord[]>();
    for (const m of matches) {
      const court = m.courtName || (isVi ? 'Sân 1' : 'Court 1');
      const list = map.get(court) || [];
      list.push(m);
      map.set(court, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([courtName, courtMatches]) => {
        const live = courtMatches.find((m) => m.status === 'live') || null;
        const upcoming = courtMatches.filter((m) => m.status === 'upcoming');
        const onDeck = upcoming[0] || null;
        const queued = upcoming.slice(1);
        const completedCount = courtMatches.filter((m) => m.status === 'completed').length;
        return { courtName, live, onDeck, queued, completedCount, total: courtMatches.length };
      });
  }, [matches, isVi]);

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 bg-[#FAF7F2]/60 dark:bg-stone-950/60 p-8 text-center space-y-3">
        <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center mx-auto">
          {mode === 'bracket' ? <GitBranch className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-stone-900 dark:text-white">
            {mode === 'bracket'
              ? isVi
                ? 'Chưa có sơ đồ nhánh đấu cho giải này'
                : 'No live bracket generated yet'
              : isVi
                ? 'Chưa có lịch phân bổ sân thi đấu'
                : 'No courts scheduled yet'}
          </h4>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            {isVi
              ? `Nhấn "Bốc thăm chia nhánh" để hệ thống tự động tạo sơ đồ vòng đấu & phân sân thông minh cho ${tournament.title}.`
              : `Click "Random Draw" to generate the live bracket tree and smart court calling board for ${tournament.title}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRunDraw}
          className="min-h-[40px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
        >
          <Shuffle className="w-4 h-4" />
          <span>{isVi ? 'Bốc thăm chia nhánh ngay' : 'Generate Bracket Now'}</span>
        </button>
      </div>
    );
  }

  if (mode === 'courts') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-2">
              <Radio className="w-4 h-4 text-accent" />
              <span>
                {isVi ? 'Bảng gọi sân trực tiếp (Live Court Board)' : 'Live Venue Court Calling Board'}
              </span>
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {isVi
                ? 'Theo dõi trận đang đánh trên từng sân, cặp chuẩn bị lên sân (On Deck) và phát thông báo gọi sân.'
                : 'Track active matches per court, On Deck pairs, and trigger instant call-to-court alerts.'}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-stone-500 dark:text-stone-400 tabular-nums">
            {courtBoards.length} {isVi ? 'sân hoạt động' : 'active courts'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {courtBoards.map((board) => (
            <div
              key={board.courtName}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2]/60 dark:bg-stone-950/70 overflow-hidden flex flex-col justify-between"
            >
              {/* Court Header */}
              <div className="px-4 py-2.5 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      board.live ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300 dark:bg-stone-600'
                    }`}
                  />
                  <span className="font-bold text-sm text-stone-900 dark:text-white font-display">
                    {board.courtName}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                  {board.completedCount}/{board.total} {isVi ? 'xong' : 'done'}
                </span>
              </div>

              <div className="p-4 space-y-3 flex-1">
                {/* ON COURT */}
                {board.live ? (
                  <div
                    role={onInspectMatchH2H ? 'button' : undefined}
                    tabIndex={onInspectMatchH2H ? 0 : undefined}
                    onClick={() => onInspectMatchH2H?.(board.live!)}
                    onKeyDown={(e) => {
                      if (onInspectMatchH2H && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onInspectMatchH2H(board.live!);
                      }
                    }}
                    className={`rounded-lg bg-[#120D0A] text-white p-3 space-y-2 border border-orange-500/30 ${
                      onInspectMatchH2H ? 'cursor-pointer hover:border-orange-400 transition-colors' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="font-bold text-emerald-400 truncate">
                        {isVi ? '● ĐANG THI ĐẤU' : '● ON COURT'} · {board.live.roundLabel}
                      </span>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {onInspectMatchH2H && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectMatchH2H(board.live!);
                            }}
                            className="text-orange-300 hover:underline font-semibold inline-flex items-center gap-1"
                          >
                            <Swords className="w-3 h-3" />
                            <span>H2H</span>
                          </button>
                        )}
                        {onOpenReferee && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenReferee(board.live!);
                            }}
                            className="text-amber-300 hover:underline font-semibold inline-flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>{isVi ? 'Trọng tài' : 'Ref'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">
                          {board.live.teamAName}
                          {board.live.servingSide === 'A' ? ' •' : ''}
                        </span>
                        <span className="font-mono font-extrabold text-sm tabular-nums text-amber-300">
                          {board.live.scoreA}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">
                          {board.live.teamBName}
                          {board.live.servingSide === 'B' ? ' •' : ''}
                        </span>
                        <span className="font-mono font-extrabold text-sm tabular-nums text-amber-300">
                          {board.live.scoreB}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-800 px-3 py-2.5 text-xs text-stone-500 dark:text-stone-400">
                    {isVi ? 'Sân đang trống — sẵn sàng gọi trận kế tiếp.' : 'Court is open — ready for next match.'}
                  </div>
                )}

                {/* ON DECK */}
                {board.onDeck && (
                  <div className="rounded-lg bg-white dark:bg-stone-900 border border-orange-200 dark:border-orange-900/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-accent">
                        {isVi ? 'CHUẨN BỊ LÊN SÂN (ON DECK)' : 'ON DECK'} · {board.onDeck.roundLabel}
                      </span>
                      <span className="text-[11px] font-mono text-stone-500">
                        {board.onDeck.scheduledTime || ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectMatchH2H?.(board.onDeck!)}
                      className="text-left w-full group flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold text-stone-900 dark:text-white group-hover:text-accent transition-colors leading-snug">
                        {board.onDeck.teamAName}{' '}
                        <span className="font-normal text-stone-400">vs</span>{' '}
                        {board.onDeck.teamBName}
                      </span>
                      {onInspectMatchH2H && (
                        <span className="text-[11px] font-semibold text-accent shrink-0 inline-flex items-center gap-0.5">
                          <Swords className="w-3 h-3" />
                          <span>H2H</span>
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onCallToCourt(board.onDeck!)}
                        className="flex-1 min-h-[34px] px-2.5 rounded-lg text-[11px] font-bold btn-accent inline-flex items-center justify-center gap-1"
                      >
                        <BellRing className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Gọi VĐV ra sân' : 'Call to Court'}</span>
                      </button>
                      {!board.live && onStartMatch && (
                        <button
                          type="button"
                          onClick={() => onStartMatch(board.onDeck!)}
                          className="min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold border border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 inline-flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>{isVi ? 'Bắt đầu' : 'Start'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* QUEUED */}
                {board.queued.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                      {isVi ? `Hàng chờ (${board.queued.length} trận)` : `Queue (${board.queued.length})`}
                    </p>
                    {board.queued.slice(0, 2).map((qm) => (
                      <button
                        key={qm.id}
                        type="button"
                        onClick={() => onInspectMatchH2H?.(qm)}
                        className="w-full text-left text-[11px] text-stone-600 dark:text-stone-300 hover:text-accent flex items-center justify-between gap-2 truncate py-0.5 transition-colors"
                      >
                        <span className="truncate">
                          {qm.teamAName} vs {qm.teamBName}
                        </span>
                        <span className="font-mono text-stone-400 shrink-0">{qm.scheduledTime || qm.roundLabel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // LIVE BRACKET MODE (Group Stage + Visual 2D Knockout Tree)
  return (
    <div className="space-y-5">
      {/* Group Stage Tables if any */}
      {groupMap.size > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            <span>{isVi ? 'Chia bảng Vòng loại' : 'Group Stage Matches'}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {Array.from(groupMap.entries()).map(([grpName, grpMatches]) => (
              <div
                key={grpName}
                className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2]/60 dark:bg-stone-950/60 overflow-hidden"
              >
                <div className="px-3.5 py-2 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-accent">{grpName}</span>
                  <span className="text-[11px] font-mono text-stone-500">
                    {grpMatches.length} {isVi ? 'trận' : 'matches'}
                  </span>
                </div>
                <div className="divide-y divide-stone-200/70 dark:divide-stone-800">
                  {grpMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onInspectMatchH2H?.(m)}
                      className="w-full text-left p-3 space-y-1.5 hover:bg-orange-50/50 dark:hover:bg-stone-900/80 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span>{m.courtName}</span>
                        <span className="inline-flex items-center gap-2 font-mono">
                          {onInspectMatchH2H && (
                            <span className="font-sans font-semibold text-accent inline-flex items-center gap-0.5">
                              <Swords className="w-3 h-3" />
                              <span>H2H</span>
                            </span>
                          )}
                          <span>
                            {m.status === 'completed'
                              ? isVi
                                ? 'Hoàn tất'
                                : 'Final'
                              : m.status === 'live'
                                ? 'LIVE'
                                : m.scheduledTime || ''}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={m.winnerSide === 'A' ? 'font-bold text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}>
                          {m.teamAName}
                        </span>
                        <span className="font-mono font-bold tabular-nums">{m.scoreA}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={m.winnerSide === 'B' ? 'font-bold text-stone-900 dark:text-white' : 'text-stone-700 dark:text-stone-300'}>
                          {m.teamBName}
                        </span>
                        <span className="font-mono font-bold tabular-nums">{m.scoreB}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Horizontal 2D Knockout Tree */}
      {roundColumns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-accent" />
              <span>{isVi ? 'Sơ đồ nhánh đấu trực tiếp (Live Bracket)' : 'Live Knockout Bracket'}</span>
            </h3>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              {isVi ? 'Kéo ngang để xem đầy đủ các vòng' : 'Scroll horizontally across rounds'}
            </span>
          </div>

          <div className="overflow-x-auto touch-scroll-x pb-2">
            <div className="flex items-stretch gap-5 min-w-max">
              {roundColumns.map(([roundName, roundMatches]) => (
                <div key={roundName} className="w-64 flex flex-col gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/80 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-stone-800 dark:text-stone-100">
                      {roundName}
                    </span>
                    <span className="text-[11px] font-mono text-stone-500">
                      {roundMatches.length}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col justify-around gap-3">
                    {roundMatches.map((m) => (
                      <div
                        key={m.id}
                        role={onInspectMatchH2H ? 'button' : undefined}
                        tabIndex={onInspectMatchH2H ? 0 : undefined}
                        onClick={() => onInspectMatchH2H?.(m)}
                        onKeyDown={(e) => {
                          if (onInspectMatchH2H && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            onInspectMatchH2H(m);
                          }
                        }}
                        className={`rounded-xl border p-3 bg-white dark:bg-stone-950/90 space-y-2 transition-colors ${
                          m.status === 'live'
                            ? 'border-emerald-500/70 ring-1 ring-emerald-500/25'
                            : 'border-stone-200 dark:border-stone-800 hover:border-orange-400/70'
                        } ${onInspectMatchH2H ? 'cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="font-mono">{m.courtName}</span>
                          <span
                            className={`font-semibold ${
                              m.status === 'live'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : m.status === 'completed'
                                  ? 'text-stone-500'
                                  : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {m.status === 'live'
                              ? '● LIVE'
                              : m.status === 'completed'
                                ? isVi
                                  ? 'Kết thúc'
                                  : 'Final'
                                : m.scheduledTime || (isVi ? 'Chờ sân' : 'Upcoming')}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs ${
                              m.winnerSide === 'A'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                                : 'bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              {m.winnerSide === 'A' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              <span className="truncate">{m.teamAName}</span>
                            </span>
                            <span className="font-mono font-extrabold tabular-nums shrink-0">
                              {m.scoreA}
                            </span>
                          </div>

                          <div
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs ${
                              m.winnerSide === 'B'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                                : 'bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200'
                            }`}
                          >
                            <span className="truncate flex items-center gap-1">
                              {m.winnerSide === 'B' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              <span className="truncate">{m.teamBName}</span>
                            </span>
                            <span className="font-mono font-extrabold tabular-nums shrink-0">
                              {m.scoreB}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 dark:border-stone-800">
                          {onInspectMatchH2H ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectMatchH2H(m);
                              }}
                              className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                            >
                              <Swords className="w-3 h-3" />
                              <span>H2H</span>
                            </button>
                          ) : (
                            <span />
                          )}
                          {m.status !== 'completed' && (
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCallToCourt(m);
                                }}
                                className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-accent inline-flex items-center gap-1"
                              >
                                <BellRing className="w-3 h-3" />
                                <span>{isVi ? 'Gọi sân' : 'Call'}</span>
                              </button>
                              {onOpenReferee && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenReferee(m);
                                  }}
                                  className="text-[11px] font-bold text-accent hover:underline inline-flex items-center gap-1"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>{isVi ? 'Chấm điểm' : 'Score'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
