import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Move, Plus, Trophy } from 'lucide-react';
import { computeGroupStandings, computeTeamTieSummary, getActiveGroupNames } from '../lib/seedData';
import type { GroupName, Language, TeamEntry, TeamStandingRow, TeamTie } from '../lib/types';

interface Bracket2DCanvasProps {
  teams: TeamEntry[];
  ties: TeamTie[];
  groupsCount?: number;
  selectedTieId: string | null;
  onSelectTie: (tieId: string) => void;
  language: Language;
}

type CameraPreset = 'overview' | 'groups' | 'serieA' | 'serieB';

const GROUP_W = 348;
const GROUP_H = 336;
const GROUP_GAP_X = 28;
const GROUP_GAP_Y = 28;

function truncateLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export const Bracket2DCanvas: React.FC<Bracket2DCanvasProps> = ({
  teams,
  ties,
  groupsCount = 4,
  selectedTieId,
  onSelectTie,
  language,
}) => {
  const isVi = language === 'vi';
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [camera, setCamera] = useState<CameraPreset>('overview');
  const [zoom, setZoom] = useState<number>(0.85);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const pinchRef = useRef<{
    active: boolean;
    initialDist: number;
    initialZoom: number;
  }>({
    active: false,
    initialDist: 0,
    initialZoom: 1,
  });

  const activeGroups = useMemo(
    () => getActiveGroupNames(teams, ties, groupsCount),
    [teams, ties, groupsCount]
  );

  const groupNodes = useMemo(
    () =>
      activeGroups.map((groupTitle) => ({
        groupTitle,
        rows: computeGroupStandings(teams, ties, groupTitle),
        groupTies: ties
          .filter((ti) => ti.stage === 'group' && ti.groupName === groupTitle)
          .sort((a, b) => (a.scheduledSlot || 99) - (b.scheduledSlot || 99)),
      })),
    [activeGroups, teams, ties]
  );

  // Dynamic 2D canvas layout for 2 to 8 groups
  const layout = useMemo(() => {
    const groupCols = groupNodes.length <= 2 ? 1 : 2;
    const groupRows = Math.max(2, Math.ceil(groupNodes.length / groupCols));
    const groupX = 24;
    const groupStartY = 24;
    const groupAreaRight =
      groupX + groupCols * GROUP_W + (groupCols - 1) * GROUP_GAP_X;

    const sfX = groupAreaRight + 114;
    const sfW = 256;
    const sfRightX = sfX + sfW;
    const midX = sfRightX + 38;
    const finX = midX + 38;
    const finRightX = finX + sfW;
    const champX = finRightX + 60;
    const canvasW = champX + 250;

    const groupsTotalH =
      groupStartY + groupRows * GROUP_H + (groupRows - 1) * GROUP_GAP_Y + 24;
    const canvasH = Math.max(748, groupsTotalH);
    const koBaseY = Math.round((canvasH - 748) / 2);

    const positions = groupNodes.map((node, idx) => {
      const col = groupCols === 1 ? 0 : idx % 2;
      const row = groupCols === 1 ? idx : Math.floor(idx / 2);
      const x = groupX + col * (GROUP_W + GROUP_GAP_X);
      const y = groupStartY + row * (GROUP_H + GROUP_GAP_Y);
      return {
        ...node,
        col,
        row,
        x,
        y,
      };
    });

    return {
      groupCols,
      groupRows,
      groupX,
      groupStartY,
      groupAreaRight,
      sfX,
      sfW,
      sfRightX,
      midX,
      finX,
      finRightX,
      champX,
      canvasW,
      canvasH,
      koBaseY,
      serieASf1Y: koBaseY + 56,
      serieASf2Y: koBaseY + 204,
      serieAFinY: koBaseY + 130,
      serieAChampY: koBaseY + 148,
      serieBSf1Y: koBaseY + 420,
      serieBSf2Y: koBaseY + 568,
      serieBFinY: koBaseY + 494,
      serieBChampY: koBaseY + 512,
      dividerY: koBaseY + 374,
      positions,
    };
  }, [groupNodes]);

  const findTie = (stage: 'serieA' | 'serieB', slot: 'SF1' | 'SF2' | 'FINAL') =>
    ties.find((ti) => ti.stage === stage && ti.bracketSlot === slot) || null;

  const focusCamera = useCallback(
    (preset: CameraPreset) => {
      setCamera(preset);
      const el = viewportRef.current;
      const vw = el ? el.clientWidth : 900;
      const vh = el ? el.clientHeight : 540;

      if (preset === 'overview') {
        const fitScale = Math.min(
          1.05,
          Math.max(0.28, Math.min((vw - 16) / layout.canvasW, (vh - 16) / layout.canvasH))
        );
        setZoom(Math.round(fitScale * 100) / 100);
        setPan({
          x: Math.max(8, (vw - layout.canvasW * fitScale) / 2),
          y: Math.max(8, (vh - layout.canvasH * fitScale) / 2),
        });
        return;
      }

      if (preset === 'groups') {
        const groupsSpanW = layout.groupAreaRight + 24;
        const targetScale = Math.min(1.1, Math.max(0.45, (vw - 20) / groupsSpanW));
        setZoom(Math.round(targetScale * 100) / 100);
        setPan({ x: 8, y: 8 });
        return;
      }

      if (preset === 'serieA') {
        const targetScale = Math.min(1.15, Math.max(0.5, (vw - 20) / 920));
        setZoom(Math.round(targetScale * 100) / 100);
        setPan({
          x: Math.round(-(layout.sfX - 18) * targetScale + 12),
          y: Math.round(-layout.koBaseY * targetScale + 8),
        });
        return;
      }

      if (preset === 'serieB') {
        const targetScale = Math.min(1.15, Math.max(0.5, (vw - 20) / 920));
        setZoom(Math.round(targetScale * 100) / 100);
        const yOffset = Math.max(
          -(layout.koBaseY + 368) * targetScale + 12,
          vh - layout.canvasH * targetScale - 12
        );
        setPan({
          x: Math.round(-(layout.sfX - 18) * targetScale + 12),
          y: Math.round(yOffset),
        });
      }
    },
    [layout]
  );

  // Auto-fit overview on mount, layout change & window resize
  useEffect(() => {
    focusCamera('overview');
    const onResize = () => focusCamera('overview');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [focusCamera]);

  // 1-Finger / Mouse Pan Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinchRef.current.active) return;
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || pinchRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    setPan({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  // 2-Finger Pinch-to-Zoom for Mobile Touch Screens
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        active: true,
        initialDist: Math.hypot(dx, dy) || 1,
        initialZoom: zoom,
      };
      dragRef.current.active = false;
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const nextZoom = Math.min(
        1.75,
        Math.max(0.25, pinchRef.current.initialZoom * (dist / pinchRef.current.initialDist))
      );
      setZoom(Math.round(nextZoom * 100) / 100);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
    }
  };

  // Mouse Wheel Zoom (with Ctrl/Meta or smooth zoom)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(1.75, Math.max(0.25, Math.round((z + delta) * 100) / 100)));
  };

  // Render 2D Group Stage Box (Mini Standings + Clickable Scheduled Group Ties)
  const renderGroupStageNode = (
    groupTitle: GroupName,
    rows: TeamStandingRow[],
    groupTies: TeamTie[],
    x: number,
    y: number,
    showRightPorts: boolean
  ) => {
    const w = GROUP_W;
    const h = GROUP_H;
    const completedCount = groupTies.filter((ti) => ti.status === 'completed').length;
    const prefix = groupTitle.replace('Bảng ', '').trim() || 'A';

    return (
      <g key={groupTitle}>
        {/* Group Container */}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={12}
          className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1.5}
        />

        {/* Header Strip */}
        <rect
          x={x}
          y={y}
          width={w}
          height={34}
          rx={12}
          className="fill-slate-100 dark:fill-slate-800"
        />
        <rect
          x={x}
          y={y + 22}
          width={w}
          height={12}
          className="fill-slate-100 dark:fill-slate-800"
        />
        <text
          x={x + 12}
          y={y + 21}
          className="fill-slate-900 dark:fill-white text-[12px] font-extrabold uppercase tracking-wider"
        >
          {isVi ? `VÒNG BẢNG · ${groupTitle.toUpperCase()}` : `GROUP STAGE · ${groupTitle}`}
        </text>
        <text
          x={x + w - 12}
          y={y + 21}
          textAnchor="end"
          className="fill-slate-500 dark:fill-slate-400 text-[10.5px] font-mono font-bold"
        >
          {completedCount}/{groupTies.length} {isVi ? 'trận' : 'ties'}
        </text>

        {/* Empty state inside group card */}
        {rows.length === 0 && (
          <text
            x={x + w / 2}
            y={y + 106}
            textAnchor="middle"
            className="fill-slate-400 dark:fill-slate-500 text-[11px] font-medium"
          >
            {isVi ? `Chưa có đội trong ${groupTitle}` : `No teams in ${groupTitle}`}
          </text>
        )}

        {/* Mini Standings Rows (Up to 4 Teams) */}
        {rows.slice(0, 4).map((row, idx) => {
          const rowY = y + 42 + idx * 30;
          const isSerieA = idx < 2;
          return (
            <g key={row.teamId}>
              <rect
                x={x + 8}
                y={rowY}
                width={w - 16}
                height={25}
                rx={6}
                className={
                  isSerieA
                    ? 'fill-emerald-50/75 dark:fill-emerald-950/35 stroke-emerald-200/80 dark:stroke-emerald-800/60'
                    : 'fill-amber-50/70 dark:fill-amber-950/30 stroke-amber-200/80 dark:stroke-amber-800/60'
                }
                strokeWidth={1}
              />
              <text
                x={x + 16}
                y={rowY + 16}
                className={`font-mono text-[10.5px] font-extrabold ${
                  isSerieA
                    ? 'fill-emerald-700 dark:fill-emerald-300'
                    : 'fill-amber-700 dark:fill-amber-300'
                }`}
              >
                {prefix}
                {row.rank}
              </text>
              <text
                x={x + 42}
                y={rowY + 16}
                className="fill-slate-900 dark:fill-white text-[11.5px] font-bold"
              >
                {truncateLabel(row.teamName, 20)}
              </text>
              <text
                x={x + w - 74}
                y={rowY + 16}
                textAnchor="end"
                className="fill-slate-600 dark:fill-slate-300 font-mono text-[10.5px] font-bold"
              >
                {row.points}đ ({row.wins}-{row.draws}-{row.losses})
              </text>
              <text
                x={x + w - 14}
                y={rowY + 16}
                textAnchor="end"
                className={`text-[9.5px] font-extrabold uppercase ${
                  isSerieA
                    ? 'fill-emerald-700 dark:fill-emerald-400'
                    : 'fill-amber-700 dark:fill-amber-400'
                }`}
              >
                → {isSerieA ? 'Serie A' : 'Serie B'}
              </text>
              {showRightPorts && (
                <circle
                  cx={x + w}
                  cy={rowY + 12.5}
                  r={3.5}
                  className={isSerieA ? 'fill-emerald-600' : 'fill-amber-500'}
                />
              )}
            </g>
          );
        })}

        {/* Divider to Group Matches Grid */}
        <line
          x1={x + 10}
          y1={y + 170}
          x2={x + w - 10}
          y2={y + 170}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={1}
        />
        <text
          x={x + 12}
          y={y + 185}
          className="fill-slate-500 dark:fill-slate-400 text-[9.5px] font-bold uppercase tracking-wider"
        >
          {isVi
            ? 'CÁC TRẬN VÒNG BẢNG (CHẠM ĐỂ CHẤM ĐIỂM / XẾP CẶP)'
            : 'GROUP MATCHES (TAP TO SCORE / LINEUP)'}
        </text>

        {/* 2x3 Compact Clickable Group Match Chips (Up to 6 round-robin ties) */}
        {groupTies.slice(0, 6).map((ti, idx) => {
          const col = idx % 2;
          const r = Math.floor(idx / 2);
          const cx = x + 10 + col * 166;
          const cy = y + 193 + r * 44;
          const cw = 160;
          const ch = 39;
          const summary = computeTeamTieSummary(ti);
          const isSelected = selectedTieId === ti.id;
          const codeA = teams.find((t) => t.id === ti.teamAId)?.shortCode || ti.teamAName.slice(0, 4);
          const codeB = teams.find((t) => t.id === ti.teamBId)?.shortCode || ti.teamBName.slice(0, 4);

          return (
            <g
              key={ti.id}
              onClick={() => {
                if (!dragRef.current.moved) onSelectTie(ti.id);
              }}
              className="cursor-pointer group"
            >
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={ch}
                rx={7}
                className={
                  isSelected
                    ? 'fill-orange-50 dark:fill-slate-800 stroke-[var(--accent-primary)]'
                    : 'fill-slate-50 dark:fill-slate-950/70 stroke-slate-200 dark:stroke-slate-700 group-hover:stroke-[var(--accent-primary)]'
                }
                strokeWidth={isSelected ? 1.8 : 1}
              />
              <text
                x={cx + 8}
                y={cy + 14}
                className="fill-slate-500 dark:fill-slate-400 font-mono text-[8.5px] font-semibold"
              >
                {ti.courtName || 'Sân 1'} · {ti.scheduledTime || '08:00'}
              </text>
              <text
                x={cx + cw - 8}
                y={cy + 14}
                textAnchor="end"
                className={`text-[8.5px] font-bold ${
                  ti.status === 'live'
                    ? 'fill-rose-600 dark:fill-rose-400'
                    : ti.status === 'completed'
                      ? 'fill-emerald-600 dark:fill-emerald-400'
                      : 'fill-slate-400'
                }`}
              >
                {ti.status === 'live'
                  ? 'LIVE'
                  : ti.status === 'completed'
                    ? summary.isGroupDraw22
                      ? isVi
                        ? 'HÒA'
                        : 'DRAW'
                      : isVi
                        ? 'XONG'
                        : 'DONE'
                    : isVi
                      ? 'CHỜ'
                      : 'NEXT'}
              </text>
              <text
                x={cx + 8}
                y={cy + 30}
                className="fill-slate-900 dark:fill-white text-[10.5px] font-bold"
              >
                {codeA} vs {codeB}
              </text>
              <text
                x={cx + cw - 8}
                y={cy + 30}
                textAnchor="end"
                className="fill-slate-900 dark:fill-white font-mono text-[11px] font-extrabold"
              >
                {summary.totalWinsA}-{summary.totalWinsB}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  // Render Knockout Match Node (with Assigned Court & Scheduled Time)
  const renderKnockoutNode = (tie: TeamTie | null, x: number, y: number, fallbackLabel: string) => {
    const w = 256;
    const h = 104;
    if (!tie) {
      return (
        <g key={`${x}_${y}`}>
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={10}
            className="fill-slate-50 dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1.25}
            strokeDasharray="4 4"
          />
          <text x={x + 14} y={y + 56} className="fill-slate-400 text-[12px] font-medium">
            {fallbackLabel}
          </text>
        </g>
      );
    }

    const summary = computeTeamTieSummary(tie);
    const isSelected = selectedTieId === tie.id;
    const aWon = summary.winnerSide === 'A';
    const bWon = summary.winnerSide === 'B';

    const statusText = summary.needsKnockoutTieBreak
      ? isVi
        ? 'Hòa 2-2 · Đấu Đơn'
        : '2-2 · Singles TB'
      : tie.status === 'completed'
        ? isVi
          ? 'Hoàn thành'
          : 'Completed'
        : tie.status === 'live'
          ? isVi
            ? 'Đang đấu'
            : 'Live'
          : isVi
            ? 'Chờ đấu'
            : 'Upcoming';

    const statusColor = summary.needsKnockoutTieBreak
      ? 'fill-amber-600 dark:fill-amber-400'
      : tie.status === 'live'
        ? 'fill-rose-600 dark:fill-rose-400'
        : tie.status === 'completed'
          ? 'fill-emerald-600 dark:fill-emerald-400'
          : 'fill-slate-500 dark:fill-slate-400';

    const slotLabel =
      tie.bracketSlot === 'FINAL'
        ? isVi
          ? 'CHUNG KẾT'
          : 'FINAL'
        : tie.bracketSlot === 'SF1'
          ? isVi
            ? 'BÁN KẾT 1'
            : 'SEMIFINAL 1'
          : isVi
            ? 'BÁN KẾT 2'
            : 'SEMIFINAL 2';

    return (
      <g
        key={tie.id}
        onClick={() => {
          if (!dragRef.current.moved) onSelectTie(tie.id);
        }}
        className="cursor-pointer group"
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={10}
          className={`transition-colors ${
            isSelected
              ? 'fill-orange-50/80 dark:fill-slate-800 stroke-[var(--accent-primary)]'
              : 'fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700 group-hover:stroke-[var(--accent-primary)]'
          }`}
          strokeWidth={isSelected ? 2.25 : 1.35}
        />

        {/* Header Row: Slot + Status */}
        <text
          x={x + 12}
          y={y + 18}
          className="fill-slate-500 dark:fill-slate-400 text-[9.5px] font-bold uppercase tracking-wider"
        >
          {slotLabel}
        </text>
        <text x={x + w - 12} y={y + 18} textAnchor="end" className={`text-[9.5px] font-bold ${statusColor}`}>
          {statusText}
        </text>

        {/* Court & Scheduled Time Sub-Strip */}
        <text
          x={x + 12}
          y={y + 32}
          className="fill-orange-700 dark:fill-amber-400 font-mono text-[9.5px] font-bold"
        >
          {tie.courtName || 'Sân 1'} · {tie.scheduledTime || '10:30'}
          {tie.scheduledSlot ? ` (${isVi ? 'Lượt' : 'Slot'} #${tie.scheduledSlot})` : ''}
        </text>

        <line
          x1={x + 10}
          y1={y + 39}
          x2={x + w - 10}
          y2={y + 39}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth={1}
        />

        {/* Team A Row */}
        <text
          x={x + 12}
          y={y + 61}
          className={`text-[12px] ${
            aWon
              ? 'fill-slate-950 dark:fill-white font-bold'
              : 'fill-slate-700 dark:fill-slate-300 font-medium'
          }`}
        >
          {truncateLabel(tie.teamAName, 22)}
        </text>
        <text
          x={x + w - 14}
          y={y + 61}
          textAnchor="end"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className={`font-mono text-[14px] font-extrabold ${
            aWon ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-slate-900 dark:fill-slate-100'
          }`}
        >
          {summary.totalWinsA}
        </text>

        <line
          x1={x + 12}
          y1={y + 70}
          x2={x + w - 12}
          y2={y + 70}
          className="stroke-slate-100 dark:stroke-slate-800/80"
          strokeWidth={1}
        />

        {/* Team B Row */}
        <text
          x={x + 12}
          y={y + 90}
          className={`text-[12px] ${
            bWon
              ? 'fill-slate-950 dark:fill-white font-bold'
              : 'fill-slate-700 dark:fill-slate-300 font-medium'
          }`}
        >
          {truncateLabel(tie.teamBName, 22)}
        </text>
        <text
          x={x + w - 14}
          y={y + 90}
          textAnchor="end"
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className={`font-mono text-[14px] font-extrabold ${
            bWon ? 'fill-emerald-600 dark:fill-emerald-400' : 'fill-slate-900 dark:fill-slate-100'
          }`}
        >
          {summary.totalWinsB}
        </text>
      </g>
    );
  };

  const {
    groupAreaRight,
    sfX,
    sfRightX,
    midX,
    finX,
    finRightX,
    champX,
    canvasW,
    canvasH,
    koBaseY,
    serieASf1Y,
    serieASf2Y,
    serieAFinY,
    serieAChampY,
    serieBSf1Y,
    serieBSf2Y,
    serieBFinY,
    serieBChampY,
    dividerY,
    positions,
  } = layout;

  const serieASf1 = findTie('serieA', 'SF1');
  const serieASf2 = findTie('serieA', 'SF2');
  const serieAFin = findTie('serieA', 'FINAL');
  const serieAChamp =
    (serieAFin && computeTeamTieSummary(serieAFin).winnerTeamName) ||
    (isVi ? 'Chờ nhà vô địch' : 'TBD Champion');

  const serieBSf1 = findTie('serieB', 'SF1');
  const serieBSf2 = findTie('serieB', 'SF2');
  const serieBFin = findTie('serieB', 'FINAL');
  const serieBChamp =
    (serieBFin && computeTeamTieSummary(serieBFin).winnerTeamName) ||
    (isVi ? 'Chờ nhà vô địch' : 'TBD Champion');

  const isTwoGroupMode = positions.length === 2;
  const portA = (idx: number) => (positions[0]?.y || 24) + 54.5 + idx * 30;
  const portB = (idx: number) => (positions[1]?.y || 388) + 54.5 + idx * 30;
  const spineX = groupAreaRight + 36;

  return (
    <div
      data-no-tab-swipe="true"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
    >
      {/* Toolbar: Camera Focus Presets + Zoom Controls (100% 2D Mode on Mobile & Desktop) */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
          {(
            [
              { id: 'overview', label: isVi ? 'Toàn cảnh 2D' : 'Full 2D' },
              {
                id: 'groups',
                label: isVi ? `Vòng bảng (${activeGroups.length})` : `Groups (${activeGroups.length})`,
              },
              { id: 'serieA', label: 'Serie A' },
              { id: 'serieB', label: 'Serie B' },
            ] as { id: CameraPreset; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => focusCamera(tab.id)}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                camera === tab.id
                  ? 'bg-accent-soft text-accent'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.15) * 100) / 100))}
            aria-label="Zoom out"
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-300 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.75, Math.round((z + 0.15) * 100) / 100))}
            aria-label="Zoom in"
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => focusCamera('overview')}
            className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Pure 2D Interactive Pan + Pinch-Zoom Viewport (Mobile & Desktop) */}
      <div
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className={`relative w-full h-[58dvh] min-h-[360px] max-h-[680px] overflow-hidden touch-none bg-slate-50/80 dark:bg-slate-950/70 select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <div
          className="origin-top-left will-change-transform"
          style={{
            width: canvasW,
            height: canvasH,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          }}
        >
          <svg
            width={canvasW}
            height={canvasH}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            className="block"
            role="img"
            aria-label={
              isVi
                ? 'Sơ đồ 2D liên mạch từ Vòng bảng sang Serie A và Serie B'
                : 'Continuous 2D Bracket from Group Stage to Serie A & Serie B'
            }
          >
            {/* Section Headers */}
            <text
              x={sfX}
              y={koBaseY + 36}
              className="fill-[var(--accent-primary)] text-[12px] font-extrabold uppercase tracking-wider"
            >
              {isVi
                ? 'NHÁNH SERIE A · TRANH VÔ ĐỊCH (Top đội dẫn đầu các bảng)'
                : 'SERIE A · CHAMPIONSHIP (Top seeds across groups)'}
            </text>
            <text
              x={sfX}
              y={koBaseY + 400}
              className="fill-amber-700 dark:fill-amber-400 text-[12px] font-extrabold uppercase tracking-wider"
            >
              {isVi
                ? 'NHÁNH SERIE B · CHALLENGER (Các đội xếp kế tiếp)'
                : 'SERIE B · CHALLENGER (Next-ranked seeds)'}
            </text>

            {/* Horizontal Divider between Serie A and Serie B */}
            <line
              x1={sfX - 16}
              y1={dividerY}
              x2={canvasW - 24}
              y2={dividerY}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeWidth={1.25}
              strokeDasharray="6 6"
            />

            {/* =======================================================
                CROSS-SEEDING ROUTING CURVES: GROUP STAGE -> SERIE A & B
               ======================================================= */}
            {isTwoGroupMode ? (
              <>
                <path
                  d={`M ${groupAreaRight} ${portA(0)} C ${groupAreaRight + 52} ${portA(0)}, ${sfX - 52} ${serieASf1Y + 56}, ${sfX} ${serieASf1Y + 56}`}
                  fill="none"
                  className="stroke-emerald-600/80 dark:stroke-emerald-400/80"
                  strokeWidth={2}
                />
                <path
                  d={`M ${groupAreaRight} ${portB(1)} C ${groupAreaRight + 68} ${portB(1)}, ${sfX - 68} ${serieASf1Y + 86}, ${sfX} ${serieASf1Y + 86}`}
                  fill="none"
                  className="stroke-emerald-500/60 dark:stroke-emerald-400/60"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
                <path
                  d={`M ${groupAreaRight} ${portB(0)} C ${groupAreaRight + 60} ${portB(0)}, ${sfX - 60} ${serieASf2Y + 56}, ${sfX} ${serieASf2Y + 56}`}
                  fill="none"
                  className="stroke-emerald-600/80 dark:stroke-emerald-400/80"
                  strokeWidth={2}
                />
                <path
                  d={`M ${groupAreaRight} ${portA(1)} C ${groupAreaRight + 46} ${portA(1)}, ${sfX - 46} ${serieASf2Y + 86}, ${sfX} ${serieASf2Y + 86}`}
                  fill="none"
                  className="stroke-emerald-500/60 dark:stroke-emerald-400/60"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
                <path
                  d={`M ${groupAreaRight} ${portA(2)} C ${groupAreaRight + 58} ${portA(2)}, ${sfX - 58} ${serieBSf1Y + 56}, ${sfX} ${serieBSf1Y + 56}`}
                  fill="none"
                  className="stroke-amber-500/80 dark:stroke-amber-400/80"
                  strokeWidth={2}
                />
                <path
                  d={`M ${groupAreaRight} ${portB(3)} C ${groupAreaRight + 46} ${portB(3)}, ${sfX - 46} ${serieBSf1Y + 86}, ${sfX} ${serieBSf1Y + 86}`}
                  fill="none"
                  className="stroke-amber-500/60 dark:stroke-amber-400/60"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
                <path
                  d={`M ${groupAreaRight} ${portB(2)} C ${groupAreaRight + 52} ${portB(2)}, ${sfX - 52} ${serieBSf2Y + 56}, ${sfX} ${serieBSf2Y + 56}`}
                  fill="none"
                  className="stroke-amber-500/80 dark:stroke-amber-400/80"
                  strokeWidth={2}
                />
                <path
                  d={`M ${groupAreaRight} ${portA(3)} C ${groupAreaRight + 70} ${portA(3)}, ${sfX - 70} ${serieBSf2Y + 86}, ${sfX} ${serieBSf2Y + 86}`}
                  fill="none"
                  className="stroke-amber-500/60 dark:stroke-amber-400/60"
                  strokeWidth={1.75}
                  strokeDasharray="5 4"
                />
              </>
            ) : (
              <>
                {/* Multi-group collector spine routing (4, 6, 8 groups -> Serie A & Serie B) */}
                {positions
                  .filter((p) => p.col === layout.groupCols - 1)
                  .map((p) => (
                    <g key={`feed_${p.groupTitle}`}>
                      <path
                        d={`M ${groupAreaRight} ${p.y + 72} H ${spineX}`}
                        fill="none"
                        className="stroke-emerald-500/65 dark:stroke-emerald-400/65"
                        strokeWidth={1.75}
                      />
                      <path
                        d={`M ${groupAreaRight} ${p.y + 132} H ${spineX + 12}`}
                        fill="none"
                        className="stroke-amber-500/65 dark:stroke-amber-400/65"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    </g>
                  ))}
                <line
                  x1={spineX}
                  y1={96}
                  x2={spineX}
                  y2={canvasH - 190}
                  className="stroke-emerald-500/55 dark:stroke-emerald-400/55"
                  strokeWidth={1.75}
                />
                <line
                  x1={spineX + 12}
                  y1={156}
                  x2={spineX + 12}
                  y2={canvasH - 130}
                  className="stroke-amber-500/55 dark:stroke-amber-400/55"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
                <path
                  d={`M ${spineX} ${serieASf1Y + 52} C ${spineX + 26} ${serieASf1Y + 52}, ${sfX - 26} ${serieASf1Y + 52}, ${sfX} ${serieASf1Y + 52}`}
                  fill="none"
                  className="stroke-emerald-600/85 dark:stroke-emerald-400/85"
                  strokeWidth={2}
                />
                <path
                  d={`M ${spineX} ${serieASf2Y + 52} C ${spineX + 26} ${serieASf2Y + 52}, ${sfX - 26} ${serieASf2Y + 52}, ${sfX} ${serieASf2Y + 52}`}
                  fill="none"
                  className="stroke-emerald-600/85 dark:stroke-emerald-400/85"
                  strokeWidth={2}
                />
                <path
                  d={`M ${spineX + 12} ${serieBSf1Y + 52} C ${spineX + 34} ${serieBSf1Y + 52}, ${sfX - 26} ${serieBSf1Y + 52}, ${sfX} ${serieBSf1Y + 52}`}
                  fill="none"
                  className="stroke-amber-500/85 dark:stroke-amber-400/85"
                  strokeWidth={2}
                />
                <path
                  d={`M ${spineX + 12} ${serieBSf2Y + 52} C ${spineX + 34} ${serieBSf2Y + 52}, ${sfX - 26} ${serieBSf2Y + 52}, ${sfX} ${serieBSf2Y + 52}`}
                  fill="none"
                  className="stroke-amber-500/85 dark:stroke-amber-400/85"
                  strokeWidth={2}
                />
              </>
            )}

            {/* =======================================================
                KNOCKOUT CONNECTORS: SEMIFINALS -> FINAL -> CHAMPION
               ======================================================= */}
            {/* Serie A connectors */}
            <path
              d={`M ${sfRightX} ${serieASf1Y + 52} H ${midX} V ${serieAFinY + 52} H ${finX}`}
              fill="none"
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={2}
            />
            <path
              d={`M ${sfRightX} ${serieASf2Y + 52} H ${midX} V ${serieAFinY + 52}`}
              fill="none"
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={2}
            />
            <path
              d={`M ${finRightX} ${serieAFinY + 52} H ${champX}`}
              fill="none"
              className="stroke-[var(--accent-primary)]"
              strokeWidth={2.4}
            />

            {/* Serie B connectors */}
            <path
              d={`M ${sfRightX} ${serieBSf1Y + 52} H ${midX} V ${serieBFinY + 52} H ${finX}`}
              fill="none"
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={2}
            />
            <path
              d={`M ${sfRightX} ${serieBSf2Y + 52} H ${midX} V ${serieBFinY + 52}`}
              fill="none"
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={2}
            />
            <path
              d={`M ${finRightX} ${serieBFinY + 52} H ${champX}`}
              fill="none"
              className="stroke-amber-500 dark:stroke-amber-400"
              strokeWidth={2.4}
            />

            {/* Column 1 (or 2-Col Grid): Group Stage Nodes (Bảng A .. Bảng H) */}
            {positions.map((pos) =>
              renderGroupStageNode(
                pos.groupTitle,
                pos.rows,
                pos.groupTies,
                pos.x,
                pos.y,
                pos.col === layout.groupCols - 1
              )
            )}

            {/* Serie A Knockout Nodes */}
            {renderKnockoutNode(serieASf1, sfX, serieASf1Y, isVi ? 'Bán kết 1 Serie A' : 'Serie A SF1')}
            {renderKnockoutNode(serieASf2, sfX, serieASf2Y, isVi ? 'Bán kết 2 Serie A' : 'Serie A SF2')}
            {renderKnockoutNode(serieAFin, finX, serieAFinY, isVi ? 'Chung kết Serie A' : 'Serie A Final')}

            {/* Serie B Knockout Nodes */}
            {renderKnockoutNode(serieBSf1, sfX, serieBSf1Y, isVi ? 'Bán kết 1 Serie B' : 'Serie B SF1')}
            {renderKnockoutNode(serieBSf2, sfX, serieBSf2Y, isVi ? 'Bán kết 2 Serie B' : 'Serie B SF2')}
            {renderKnockoutNode(serieBFin, finX, serieBFinY, isVi ? 'Chung kết Serie B' : 'Serie B Final')}

            {/* Champion Plaques */}
            <g>
              <rect
                x={champX}
                y={serieAChampY}
                width={224}
                height={68}
                rx={12}
                className="fill-orange-50/75 dark:fill-slate-900 stroke-[var(--accent-primary)]"
                strokeWidth={2}
              />
              <text
                x={champX + 14}
                y={serieAChampY + 24}
                className="fill-[var(--accent-primary)] text-[10px] font-extrabold uppercase tracking-wider"
              >
                {isVi ? 'VÔ ĐỊCH SERIE A' : 'SERIE A CHAMPION'}
              </text>
              <text
                x={champX + 14}
                y={serieAChampY + 48}
                className="fill-slate-900 dark:fill-white text-[14px] font-extrabold"
              >
                {truncateLabel(serieAChamp, 21)}
              </text>
            </g>

            <g>
              <rect
                x={champX}
                y={serieBChampY}
                width={224}
                height={68}
                rx={12}
                className="fill-amber-50/70 dark:fill-slate-900 stroke-amber-500 dark:stroke-amber-400"
                strokeWidth={2}
              />
              <text
                x={champX + 14}
                y={serieBChampY + 24}
                className="fill-amber-700 dark:fill-amber-400 text-[10px] font-extrabold uppercase tracking-wider"
              >
                {isVi ? 'VÔ ĐỊCH SERIE B' : 'SERIE B CHAMPION'}
              </text>
              <text
                x={champX + 14}
                y={serieBChampY + 48}
                className="fill-slate-900 dark:fill-white text-[14px] font-extrabold"
              >
                {truncateLabel(serieBChamp, 21)}
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Compact Gesture & Tap Hint Footer */}
      <div className="px-3 sm:px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>
            {isVi
              ? `Chạm bất kỳ trận Vòng bảng (${activeGroups.length} bảng) hoặc Serie A/B trên sơ đồ 2D để xếp cặp & chấm điểm.`
              : `Tap any Group Stage (${activeGroups.length} groups) or Serie A/B match node to edit lineups or score.`}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] shrink-0">
          <Move className="w-3 h-3" />
          <span>{isVi ? 'Kéo 1 ngón · Chụm 2 ngón phóng to/thu nhỏ' : 'Drag to pan · Pinch to zoom'}</span>
        </span>
      </div>
    </div>
  );
};
