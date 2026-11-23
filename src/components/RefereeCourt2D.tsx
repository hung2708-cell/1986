import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { Language, SkillTier } from '../lib/types';

export interface CourtPlayerSlot {
  id: string;
  name: string;
  skillTier?: SkillTier;
  isSub?: boolean;
}

interface RefereeCourt2DProps {
  language: Language;
  isDoubles: boolean;
  leftSide: 'A' | 'B';
  rightSide: 'A' | 'B';
  leftTeamName: string;
  rightTeamName: string;
  leftScore: number;
  rightScore: number;
  leftPlayers: CourtPlayerSlot[];
  rightPlayers: CourtPlayerSlot[];
  /** For each side, index 0 = player currently in Right (Even) box, index 1 = player in Left (Odd) box */
  servingSide: 'A' | 'B';
  serverNumber: 1 | 2;
  onSwapSides: () => void;
  onClickPlayer?: (side: 'A' | 'B', playerIndex: number) => void;
  className?: string;
}

function shortName(fullName: string): string {
  const cleaned = fullName.trim();
  if (cleaned.length <= 15) return cleaned;
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    const candidate = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    if (candidate.length <= 16) return candidate;
  }
  return `${cleaned.slice(0, 14)}…`;
}

export const RefereeCourt2D: React.FC<RefereeCourt2DProps> = ({
  language,
  isDoubles,
  leftSide,
  rightSide,
  leftTeamName,
  rightTeamName,
  leftScore,
  rightScore,
  leftPlayers,
  rightPlayers,
  servingSide,
  serverNumber,
  onSwapSides,
  onClickPlayer,
  className = '',
}) => {
  const isVi = language === 'vi';
  const servingIsLeft = servingSide === leftSide;
  const servingScore = servingIsLeft ? leftScore : rightScore;
  const isEvenServe = servingScore % 2 === 0;

  /**
   * Authentic Pickleball 2D Court Geometry:
   * - Left Court faces RIGHT toward the net:
   *   - Right Service Box (Even: 0, 2, 4...) = BOTTOM-LEFT box (y: 160..286)
   *   - Left Service Box  (Odd:  1, 3, 5...) = TOP-LEFT box    (y: 34..160)
   * - Right Court faces LEFT toward the net:
   *   - Right Service Box (Even: 0, 2, 4...) = TOP-RIGHT box    (y: 34..160)
   *   - Left Service Box  (Odd:  1, 3, 5...) = BOTTOM-RIGHT box (y: 160..286)
   */
  const leftEvenBox = { x: 42, y: 160, w: 202, h: 126, cx: 132, cy: 223 };
  const leftOddBox = { x: 42, y: 34, w: 202, h: 126, cx: 132, cy: 97 };
  const rightEvenBox = { x: 436, y: 34, w: 202, h: 126, cx: 548, cy: 97 };
  const rightOddBox = { x: 436, y: 160, w: 202, h: 126, cx: 548, cy: 223 };

  const activeServerBox = servingIsLeft
    ? isEvenServe
      ? leftEvenBox
      : leftOddBox
    : isEvenServe
      ? rightEvenBox
      : rightOddBox;

  const activeReceiverBox = servingIsLeft
    ? isEvenServe
      ? rightEvenBox
      : rightOddBox
    : isEvenServe
      ? leftEvenBox
      : leftOddBox;

  const arrowStart = {
    x: servingIsLeft ? activeServerBox.cx + 62 : activeServerBox.cx - 62,
    y: activeServerBox.cy,
  };
  const arrowEnd = {
    x: servingIsLeft ? activeReceiverBox.cx - 62 : activeReceiverBox.cx + 62,
    y: activeReceiverBox.cy,
  };

  const renderPlayerToken = (
    player: CourtPlayerSlot,
    side: 'A' | 'B',
    slotIdx: number,
    cx: number,
    cy: number,
    isServer: boolean,
    isReceiver: boolean,
    boxTag: string
  ) => {
    const label = shortName(player.name);
    const pillW = 154;
    const pillH = 46;
    const x = cx - pillW / 2;
    const y = cy - pillH / 2;

    return (
      <g
        key={`${side}_${slotIdx}`}
        onClick={() => onClickPlayer?.(side, slotIdx)}
        className={onClickPlayer ? 'cursor-pointer group' : ''}
      >
        <rect
          x={x}
          y={y}
          width={pillW}
          height={pillH}
          rx={10}
          className={
            isServer
              ? 'fill-amber-400 stroke-white'
              : isReceiver
                ? 'fill-slate-900/90 stroke-emerald-300'
                : 'fill-slate-900/80 stroke-white/35 group-hover:stroke-white/80'
          }
          strokeWidth={isServer ? 2.2 : 1.3}
        />

        <text
          x={x + 10}
          y={y + 16}
          className={`text-[9.5px] font-mono font-bold uppercase tracking-wider ${
            isServer ? 'fill-slate-950' : 'fill-emerald-200'
          }`}
        >
          {boxTag}
          {isServer ? ` · ${isVi ? 'GIAO' : 'SRV'}${isDoubles ? `#${serverNumber}` : ''}` : ''}
          {isReceiver ? ` · ${isVi ? 'ĐỠ' : 'RCV'}` : ''}
          {player.isSub ? ' · SUB' : ''}
        </text>

        <text
          x={x + 10}
          y={y + 35}
          className={`text-[12.5px] font-bold ${isServer ? 'fill-slate-950' : 'fill-white'}`}
        >
          {label}
        </text>

        {isServer && (
          <g transform={`translate(${x + pillW - 16}, ${y + 23})`}>
            <circle r={8.5} fill="#BEF264" stroke="#120D0A" strokeWidth={1.5} />
            <circle cx={-2.5} cy={-2} r={1.1} fill="#365314" />
            <circle cx={2.5} cy={-2} r={1.1} fill="#365314" />
            <circle cx={0} cy={2.5} r={1.1} fill="#365314" />
          </g>
        )}
      </g>
    );
  };

  const leftTokens = isDoubles
    ? [
        {
          player: leftPlayers[0] || { id: 'l0', name: `${leftTeamName} #1` },
          slotIdx: 0,
          box: leftEvenBox,
          isServer: servingIsLeft && isEvenServe,
          isReceiver: !servingIsLeft && isEvenServe,
          boxTag: isVi ? 'Chẵn (P)' : 'Even (R)',
        },
        {
          player: leftPlayers[1] || { id: 'l1', name: `${leftTeamName} #2` },
          slotIdx: 1,
          box: leftOddBox,
          isServer: servingIsLeft && !isEvenServe,
          isReceiver: !servingIsLeft && !isEvenServe,
          boxTag: isVi ? 'Lẻ (T)' : 'Odd (L)',
        },
      ]
    : [
        {
          player: leftPlayers[0] || { id: 'l0', name: leftTeamName },
          slotIdx: 0,
          box: isEvenServe ? leftEvenBox : leftOddBox,
          isServer: servingIsLeft,
          isReceiver: !servingIsLeft,
          boxTag: isEvenServe ? (isVi ? 'Chẵn' : 'Even') : isVi ? 'Lẻ' : 'Odd',
        },
      ];

  const rightTokens = isDoubles
    ? [
        {
          player: rightPlayers[0] || { id: 'r0', name: `${rightTeamName} #1` },
          slotIdx: 0,
          box: rightEvenBox,
          isServer: !servingIsLeft && isEvenServe,
          isReceiver: servingIsLeft && isEvenServe,
          boxTag: isVi ? 'Chẵn (P)' : 'Even (R)',
        },
        {
          player: rightPlayers[1] || { id: 'r1', name: `${rightTeamName} #2` },
          slotIdx: 1,
          box: rightOddBox,
          isServer: !servingIsLeft && !isEvenServe,
          isReceiver: servingIsLeft && !isEvenServe,
          boxTag: isVi ? 'Lẻ (T)' : 'Odd (L)',
        },
      ]
    : [
        {
          player: rightPlayers[0] || { id: 'r0', name: rightTeamName },
          slotIdx: 0,
          box: isEvenServe ? rightEvenBox : rightOddBox,
          isServer: !servingIsLeft,
          isReceiver: servingIsLeft,
          boxTag: isEvenServe ? (isVi ? 'Chẵn' : 'Even') : isVi ? 'Lẻ' : 'Odd',
        },
      ];

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden flex flex-col min-h-0 ${className}`}
    >
      {/* Ultra-Compact 2D Court Header Bar */}
      <div className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-300 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-bold text-amber-400 uppercase tracking-wider shrink-0">
            {isVi ? 'Sân 2D' : '2D Court'}
          </span>
          <span className="text-slate-600">·</span>
          <span className="truncate text-slate-400">
            {isVi ? 'Chạm VĐV để thay chấn thương' : 'Tap player for injury sub'}
          </span>
        </div>

        <button
          type="button"
          onClick={onSwapSides}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-200 shrink-0"
        >
          <ArrowLeftRight className="w-3 h-3" />
          <span>{isVi ? 'Đổi sân' : 'Swap'}</span>
        </button>
      </div>

      {/* Fluid Single-Screen SVG Court Container */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-1 sm:p-2">
        <svg
          viewBox="0 0 680 318"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-full block select-none"
          role="img"
          aria-label={isVi ? 'Sơ đồ sân Pickleball 2D trực quan' : 'Interactive 2D Pickleball Court'}
        >
          <defs>
            <marker
              id="serveArrowHead"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1 L 7 4 L 0 7 z" fill="#FDE047" />
            </marker>
            <pattern id="netMesh" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="0.7" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="680" height="318" rx="12" fill="#120D0A" />

          {/* Top Side Labels */}
          <text
            x="42"
            y="21"
            className="fill-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider"
          >
            {isVi ? 'TRÁI' : 'LEFT'} · {leftTeamName.slice(0, 18)} ({leftScore})
          </text>
          <text
            x="638"
            y="21"
            textAnchor="end"
            className="fill-slate-300 text-[11px] font-mono font-bold uppercase tracking-wider"
          >
            ({rightScore}) {rightTeamName.slice(0, 18)} · {isVi ? 'PHẢI' : 'RIGHT'}
          </text>

          {/* Main Emerald Court (Mộc sinh Hỏa) */}
          <rect x="42" y="34" width="596" height="252" rx="4" fill="#065F46" />

          {/* Non-Volley Zones (Terracotta Kitchen · Hỏa) */}
          <rect x="244" y="34" width="96" height="252" fill="#9A3412" />
          <rect x="340" y="34" width="96" height="252" fill="#9A3412" />

          {/* Active Server & Receiver Box Highlights */}
          <rect
            x={activeServerBox.x + 2}
            y={activeServerBox.y + 2}
            width={activeServerBox.w - 4}
            height={activeServerBox.h - 4}
            fill="rgba(250, 204, 21, 0.24)"
          />
          <rect
            x={activeReceiverBox.x + 2}
            y={activeReceiverBox.y + 2}
            width={activeReceiverBox.w - 4}
            height={activeReceiverBox.h - 4}
            fill="rgba(52, 211, 153, 0.24)"
          />

          {/* White Court Lines */}
          <rect x="42" y="34" width="596" height="252" fill="none" stroke="#FFFFFF" strokeWidth="3" />
          <line x1="244" y1="34" x2="244" y2="286" stroke="#FFFFFF" strokeWidth="2.5" />
          <line x1="436" y1="34" x2="436" y2="286" stroke="#FFFFFF" strokeWidth="2.5" />
          <line x1="42" y1="160" x2="244" y2="160" stroke="#FFFFFF" strokeWidth="2.2" />
          <line x1="436" y1="160" x2="638" y2="160" stroke="#FFFFFF" strokeWidth="2.2" />

          {/* Kitchen Labels */}
          <text
            x="292"
            y="164"
            textAnchor="middle"
            transform="rotate(-90 292 164)"
            className="fill-orange-100/75 text-[10px] font-mono font-bold tracking-[0.2em]"
          >
            KITCHEN · NVZ
          </text>
          <text
            x="388"
            y="164"
            textAnchor="middle"
            transform="rotate(90 388 164)"
            className="fill-orange-100/75 text-[10px] font-mono font-bold tracking-[0.2em]"
          >
            KITCHEN · NVZ
          </text>

          {/* Center Net */}
          <rect x="336" y="30" width="8" height="260" fill="url(#netMesh)" />
          <line x1="340" y1="28" x2="340" y2="292" stroke="#FAF7F2" strokeWidth="3.5" />
          <circle cx="340" cy="28" r="5" fill="#F1ECE4" stroke="#120D0A" strokeWidth="1.5" />
          <circle cx="340" cy="292" r="5" fill="#F1ECE4" stroke="#120D0A" strokeWidth="1.5" />

          {/* Serve Diagonal Arrow */}
          <line
            x1={arrowStart.x}
            y1={arrowStart.y}
            x2={arrowEnd.x}
            y2={arrowEnd.y}
            stroke="#FDE047"
            strokeWidth="2.4"
            strokeDasharray="6 5"
            markerEnd="url(#serveArrowHead)"
            opacity="0.95"
          />

          {/* Player Tokens */}
          {leftTokens.map((tk) =>
            renderPlayerToken(
              tk.player,
              leftSide,
              tk.slotIdx,
              tk.box.cx,
              tk.box.cy,
              tk.isServer,
              tk.isReceiver,
              tk.boxTag
            )
          )}
          {rightTokens.map((tk) =>
            renderPlayerToken(
              tk.player,
              rightSide,
              tk.slotIdx,
              tk.box.cx,
              tk.box.cy,
              tk.isServer,
              tk.isReceiver,
              tk.boxTag
            )
          )}

          {/* Bottom Legend */}
          <text x="42" y="306" className="fill-slate-400 text-[10.5px] font-mono">
            {isVi
              ? `Giao: ${servingIsLeft ? leftTeamName.slice(0, 16) : rightTeamName.slice(0, 16)} (${isEvenServe ? 'Chẵn' : 'Lẻ'}${isDoubles ? ` #${serverNumber}` : ''})`
              : `Srv: ${servingIsLeft ? leftTeamName.slice(0, 16) : rightTeamName.slice(0, 16)} (${isEvenServe ? 'Even' : 'Odd'}${isDoubles ? ` #${serverNumber}` : ''})`}
          </text>
          <text x="638" y="306" textAnchor="end" className="fill-amber-300 text-[10.5px] font-mono">
            {isVi ? '● Vàng = Giao  ◌ Ngọc lục = Đỡ' : '● Gold = Srv  ◌ Emerald = Rcv'}
          </text>
        </svg>
      </div>
    </div>
  );
};
