import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  FileText,
  Flag,
  HeartPulse,
  Lock,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
  UserMinus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Gender, Language, TeamMember } from '../lib/types';
import { MotionModal } from './MotionModal';
import { RefereeCourt2D, type CourtPlayerSlot } from './RefereeCourt2D';

export interface RefereeSessionPayload {
  id: string;
  title: string;
  subtitle: string;
  teamAName: string;
  teamBName: string;
  teamAPlayersLabel?: string;
  teamBPlayersLabel?: string;
  teamAPlayers?: CourtPlayerSlot[];
  teamBPlayers?: CourtPlayerSlot[];
  teamARoster?: TeamMember[];
  teamBRoster?: TeamMember[];
  /** Optional gender restriction per court slot [slot0, slot1] for Team Cup injury substitutions */
  slotGenderRules?: Array<Gender | 'any'>;
  isDoubles: boolean;
  isDreambreaker?: boolean;
  dreambreakerLineupA?: string[];
  dreambreakerLineupB?: string[];
  initialScoreA: number;
  initialScoreB: number;
  initialTargetPoints: number;
  initialServingSide: 'A' | 'B';
  initialServerNumber: 1 | 2;
  /** Read-only stage label (e.g. Vòng bảng / Knockout) shown alongside locked Admin default target points */
  stageLabel?: string;
  forfeitSide?: '' | 'A' | 'B';
}

export interface RefereeFinalPayload {
  scoreA: number;
  scoreB: number;
  targetPoints: number;
  servingSide: 'A' | 'B';
  serverNumber: 1 | 2;
  winnerSide: '' | 'A' | 'B';
  status: 'live' | 'completed';
  forfeitSide?: '' | 'A' | 'B';
  updatedTeamAPlayerIds?: string[];
  updatedTeamBPlayerIds?: string[];
  updatedTeamAName?: string;
  updatedTeamBName?: string;
}

interface SnapshotState {
  scoreA: number;
  scoreB: number;
  servingSide: 'A' | 'B';
  serverNumber: 1 | 2;
  playersA: CourtPlayerSlot[];
  playersB: CourtPlayerSlot[];
}

interface TossSummary {
  winner: 'A' | 'B';
  firstServer: 'A' | 'B';
  leftTeam: 'A' | 'B';
  rightTeam: 'A' | 'B';
}

interface ActiveTimeoutState {
  side: 'A' | 'B';
  teamName: string;
  kind: 'standard' | 'medical';
  totalSeconds: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  paused: boolean;
  remainingQuotaAfter: number;
}

interface MatchLogItem {
  id: string;
  time: string;
  kind: 'toss' | 'timeout' | 'sub' | 'switch' | 'forfeit';
  text: string;
}

interface RefereeAppModalProps {
  session: RefereeSessionPayload;
  language: Language;
  onClose: () => void;
  onSaveProgress: (payload: RefereeFinalPayload) => void;
  onFinalize: (payload: RefereeFinalPayload) => void;
}

const INJURY_REASONS_VI = [
  'Chuột rút cơ bắp',
  'Căng cơ / Rách cơ nhẹ',
  'Lật cổ chân',
  'Chấn thương vai / cổ tay',
  'Kiệt sức / Sốc nhiệt',
  'Chấn thương khác',
];

const INJURY_REASONS_EN = [
  'Muscle cramp',
  'Muscle strain',
  'Ankle sprain',
  'Shoulder / wrist injury',
  'Exhaustion / heat stress',
  'Other medical injury',
];

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds()
  ).padStart(2, '0')}`;
}

function playRefereeWhistle(doubleBeep = false) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const beep = (startOffset: number, duration: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration + 0.02);
    };
    beep(0, 0.22, 880);
    if (doubleBeep) {
      beep(0.28, 0.35, 1175);
    }
  } catch {
    // Ignore audio context autoplay limits gracefully
  }
}

function buildInitialPlayers(
  provided: CourtPlayerSlot[] | undefined,
  label: string | undefined,
  teamName: string,
  isDoubles: boolean,
  prefix: string
): CourtPlayerSlot[] {
  if (provided && provided.length > 0) {
    if (isDoubles && provided.length === 1) {
      return [provided[0], { id: `${prefix}_2`, name: `${teamName} #2` }];
    }
    return provided.map((p) => ({ ...p }));
  }
  const sourceText =
    label && label !== 'Chưa xếp cặp VĐV' && label !== 'Lineup pending' ? label : teamName;
  const parts = sourceText
    .split(/\s*\/\s*|\s*→\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (isDoubles) {
    return [
      { id: `${prefix}_1`, name: parts[0] || `${teamName} #1` },
      { id: `${prefix}_2`, name: parts[1] || `${teamName} #2` },
    ];
  }
  return [{ id: `${prefix}_1`, name: parts[0] || teamName }];
}

export const RefereeAppModal: React.FC<RefereeAppModalProps> = ({
  session,
  language,
  onClose,
  onSaveProgress,
  onFinalize,
}) => {
  const isVi = language === 'vi';

  // Core Match Scoring State (Target points LOCKED to Admin tournament default)
  const targetPoints = session.initialTargetPoints || 11;
  const midPointThreshold = targetPoints === 11 ? 6 : targetPoints === 15 ? 8 : 11;

  const [scoreA, setScoreA] = useState(session.initialScoreA);
  const [scoreB, setScoreB] = useState(session.initialScoreB);
  const [servingSide, setServingSide] = useState<'A' | 'B'>(session.initialServingSide || 'A');
  const [serverNumber, setServerNumber] = useState<1 | 2>(
    session.isDoubles ? session.initialServerNumber || 2 : 1
  );
  const [swappedSides, setSwappedSides] = useState(false);
  const [showCourt2D, setShowCourt2D] = useState(true);
  const [showEventLog, setShowEventLog] = useState(false);

  // Mid-Game Court Switch Popup State (6 for 11pt, 8 for 15pt, 11 for 21pt)
  const [courtSwitchPrompted, setCourtSwitchPrompted] = useState<boolean>(
    session.initialScoreA >= midPointThreshold || session.initialScoreB >= midPointThreshold
  );
  const [showCourtSwitchModal, setShowCourtSwitchModal] = useState(false);

  // Sub-Match Forfeit (15-0) Modal State
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitDraftSide, setForfeitDraftSide] = useState<'A' | 'B' | null>(null);

  // Active On-Court Players (index 0 = Even/Right box, index 1 = Odd/Left box)
  const [playersA, setPlayersA] = useState<CourtPlayerSlot[]>(() =>
    buildInitialPlayers(
      session.teamAPlayers,
      session.teamAPlayersLabel,
      session.teamAName,
      session.isDoubles,
      'pA'
    )
  );
  const [playersB, setPlayersB] = useState<CourtPlayerSlot[]>(() =>
    buildInitialPlayers(
      session.teamBPlayers,
      session.teamBPlayersLabel,
      session.teamBName,
      session.isDoubles,
      'pB'
    )
  );
  const [didSubstitute, setDidSubstitute] = useState(false);
  const [history, setHistory] = useState<SnapshotState[]>([]);

  // Event Audit Log
  const [eventLog, setEventLog] = useState<MatchLogItem[]>([]);
  const appendLog = (kind: MatchLogItem['kind'], text: string) => {
    setEventLog((prev) => [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, time: nowTimeStr(), kind, text },
      ...prev.slice(0, 29),
    ]);
  };

  // Coin Toss / Draw Modal State (3D Coin Spin: Winner serves first, Opponent chooses Left/Right side)
  const [showTossModal, setShowTossModal] = useState(false);
  const [isFlippingCoin, setIsFlippingCoin] = useState(false);
  const [coinFinalRot, setCoinFinalRot] = useState<number>(1800);
  const [tossWinner, setTossWinner] = useState<'A' | 'B' | null>(null);
  const [otherSideChoice, setOtherSideChoice] = useState<'left' | 'right' | null>(null);
  const [tossResult, setTossResult] = useState<TossSummary | null>(null);
  const flipTimerRef = useRef<number | null>(null);

  // Time-Out State (2 standard 60s timeouts per team + Medical 180s)
  const [timeoutsA, setTimeoutsA] = useState(2);
  const [timeoutsB, setTimeoutsB] = useState(2);
  const [activeTimeout, setActiveTimeout] = useState<ActiveTimeoutState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Injury Substitution Modal State
  const [subModal, setSubModal] = useState<{ side: 'A' | 'B'; slotIdx: number } | null>(null);
  const [selectedRosterMemberId, setSelectedRosterMemberId] = useState('');
  const [customSubName, setCustomSubName] = useState('');
  const [injuryReason, setInjuryReason] = useState(
    isVi ? INJURY_REASONS_VI[0] : INJURY_REASONS_EN[0]
  );
  const [triggerMedicalTimeoutOnSub, setTriggerMedicalTimeoutOnSub] = useState(true);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    };
  }, []);

  // Live 1-second Timeout Ticker (Tracks BOTH Elapsed Time Counted & Remaining Countdown)
  useEffect(() => {
    if (!activeTimeout || activeTimeout.paused) return;
    const interval = window.setInterval(() => {
      setActiveTimeout((prev) => {
        if (!prev || prev.paused) return prev;
        const nextElapsed = prev.elapsedSeconds + 1;
        const nextRemaining = Math.max(0, prev.remainingSeconds - 1);
        if (soundEnabled) {
          if (prev.remainingSeconds === 16 && nextRemaining === 15) {
            playRefereeWhistle(false);
          } else if (prev.remainingSeconds === 1 && nextRemaining === 0) {
            playRefereeWhistle(true);
          }
        }
        return {
          ...prev,
          elapsedSeconds: nextElapsed,
          remainingSeconds: nextRemaining,
        };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimeout?.paused, Boolean(activeTimeout), soundEnabled]);

  const pushHistory = () => {
    setHistory((prev) => [
      ...prev.slice(-24),
      {
        scoreA,
        scoreB,
        servingSide,
        serverNumber,
        playersA: playersA.map((p) => ({ ...p })),
        playersB: playersB.map((p) => ({ ...p })),
      },
    ]);
  };

  const isMatchFinished = scoreA >= targetPoints || scoreB >= targetPoints;
  const finishedWinnerSide: '' | 'A' | 'B' = isMatchFinished
    ? scoreA >= targetPoints
      ? 'A'
      : 'B'
    : '';

  const handleAddPoint = (side: 'A' | 'B') => {
    // Hard lock #1: once either side reaches targetPoints (11/15/21), no further +1 is allowed
    if (isMatchFinished) return;
    // Hard lock #2 (Side-out scoring): only the currently serving side can score +1
    if (side !== servingSide) return;

    const prevMax = Math.max(scoreA, scoreB);
    pushHistory();
    let nextScore = 0;

    if (side === 'A') {
      nextScore = Math.min(targetPoints, scoreA + 1);
      setScoreA(nextScore);
      if (session.isDoubles && playersA.length >= 2) {
        setPlayersA((prev) => [prev[1], prev[0]]);
      }
    } else {
      nextScore = Math.min(targetPoints, scoreB + 1);
      setScoreB(nextScore);
      if (session.isDoubles && playersB.length >= 2) {
        setPlayersB((prev) => [prev[1], prev[0]]);
      }
    }

    if (nextScore >= targetPoints) {
      if (soundEnabled) playRefereeWhistle(true);
    } else if (!courtSwitchPrompted && prevMax < midPointThreshold && nextScore === midPointThreshold) {
      setCourtSwitchPrompted(true);
      setShowCourtSwitchModal(true);
      if (soundEnabled) playRefereeWhistle(false);
    }
  };

  const handleSubtractPoint = (side: 'A' | 'B') => {
    // Allow correcting accidental taps anytime a side has score > 0 (even right after hitting targetPoints)
    if (side === 'A' && scoreA <= 0) return;
    if (side === 'B' && scoreB <= 0) return;

    pushHistory();
    const nextA = side === 'A' ? Math.max(0, scoreA - 1) : scoreA;
    const nextB = side === 'B' ? Math.max(0, scoreB - 1) : scoreB;
    setScoreA(nextA);
    setScoreB(nextB);

    if (session.isDoubles) {
      if (side === 'A' && playersA.length >= 2) {
        setPlayersA((prev) => [prev[1], prev[0]]);
      } else if (side === 'B' && playersB.length >= 2) {
        setPlayersB((prev) => [prev[1], prev[0]]);
      }
    }

    if (Math.max(nextA, nextB) < midPointThreshold) {
      setCourtSwitchPrompted(false);
      setShowCourtSwitchModal(false);
    }
  };

  const handleSideOutFault = () => {
    if (isMatchFinished) return;
    pushHistory();
    if (session.isDoubles) {
      if (serverNumber === 1) {
        setServerNumber(2);
      } else {
        setServingSide((prev) => (prev === 'A' ? 'B' : 'A'));
        setServerNumber(1);
      }
    } else {
      setServingSide((prev) => (prev === 'A' ? 'B' : 'A'));
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setScoreA(last.scoreA);
    setScoreB(last.scoreB);
    setServingSide(last.servingSide);
    setServerNumber(last.serverNumber);
    setPlayersA(last.playersA);
    setPlayersB(last.playersB);
    setHistory((prev) => prev.slice(0, -1));
    if (Math.max(last.scoreA, last.scoreB) < midPointThreshold) {
      setCourtSwitchPrompted(false);
      setShowCourtSwitchModal(false);
    }
  };

  const handleConfirmMidCourtSwitch = () => {
    setSwappedSides((v) => !v);
    appendLog(
      'switch',
      isVi
        ? `Đổi sân giữa trận tại điểm ${midPointThreshold}/${targetPoints} (Tỷ số ${scoreA}-${scoreB})`
        : `Mid-game court switch at ${midPointThreshold}/${targetPoints} (Score ${scoreA}-${scoreB})`
    );
    setShowCourtSwitchModal(false);
  };

  const handleConfirmForfeit = () => {
    if (!forfeitDraftSide) return;
    const winnerSide: 'A' | 'B' = forfeitDraftSide === 'A' ? 'B' : 'A';
    const fScoreA = forfeitDraftSide === 'A' ? 0 : 15;
    const fScoreB = forfeitDraftSide === 'A' ? 15 : 0;
    const forfeitName = forfeitDraftSide === 'A' ? session.teamAName : session.teamBName;
    appendLog(
      'forfeit',
      isVi
        ? `Xử bỏ cuộc: ${forfeitName} bỏ cuộc → Tỷ số ${fScoreA}-${fScoreB}`
        : `Forfeit recorded: ${forfeitName} forfeited → Final ${fScoreA}-${fScoreB}`
    );
    setShowForfeitModal(false);
    setForfeitDraftSide(null);
    onFinalize({
      scoreA: fScoreA,
      scoreB: fScoreB,
      targetPoints,
      servingSide,
      serverNumber,
      winnerSide,
      status: 'completed',
      forfeitSide: forfeitDraftSide,
      ...(didSubstitute
        ? {
            updatedTeamAPlayerIds: playersA.map((p) => p.id),
            updatedTeamBPlayerIds: playersB.map((p) => p.id),
            updatedTeamAName: playersA.map((p) => p.name).join(' / '),
            updatedTeamBName: playersB.map((p) => p.name).join(' / '),
          }
        : {}),
    });
  };

  const officialCallout = useMemo(() => {
    const serverScore = servingSide === 'A' ? scoreA : scoreB;
    const receiverScore = servingSide === 'A' ? scoreB : scoreA;
    if (session.isDoubles) {
      return `${serverScore}-${receiverScore}-${serverNumber}`;
    }
    return `${serverScore}-${receiverScore}`;
  }, [servingSide, scoreA, scoreB, serverNumber, session.isDoubles]);

  // Dreambreaker active rotation every 4 total points
  const dreambreakerInfo = useMemo(() => {
    if (!session.isDreambreaker) return null;
    const totalPoints = scoreA + scoreB;
    const rotationIdx = Math.floor(totalPoints / 4) % 4;
    const pointsUntilSwitch = 4 - (totalPoints % 4);
    const lineupA = session.dreambreakerLineupA || [];
    const lineupB = session.dreambreakerLineupB || [];
    return {
      rotationSlot: rotationIdx + 1,
      pointsUntilSwitch,
      playerA: lineupA[rotationIdx] || playersA[0]?.name || `${session.teamAName} #${rotationIdx + 1}`,
      playerB: lineupB[rotationIdx] || playersB[0]?.name || `${session.teamBName} #${rotationIdx + 1}`,
    };
  }, [session, scoreA, scoreB, playersA, playersB]);

  const courtPlayersA: CourtPlayerSlot[] = useMemo(() => {
    if (dreambreakerInfo) {
      return [{ id: 'db_a', name: dreambreakerInfo.playerA }];
    }
    return playersA;
  }, [dreambreakerInfo, playersA]);

  const courtPlayersB: CourtPlayerSlot[] = useMemo(() => {
    if (dreambreakerInfo) {
      return [{ id: 'db_b', name: dreambreakerInfo.playerB }];
    }
    return playersB;
  }, [dreambreakerInfo, playersB]);

  const formatPlayersSummary = (slots: CourtPlayerSlot[]) =>
    slots
      .map((p) => `${p.name}${p.isSub ? ' [SUB]' : ''}`)
      .join(' / ');

  const canFinalize = scoreA !== scoreB && (scoreA > 0 || scoreB > 0);
  const reachedTarget = isMatchFinished;

  const leftSide: 'A' | 'B' = swappedSides ? 'B' : 'A';
  const rightSide: 'A' | 'B' = swappedSides ? 'A' : 'B';

  const getSideMeta = (side: 'A' | 'B') => ({
    name: side === 'A' ? session.teamAName : session.teamBName,
    playersText:
      side === 'A'
        ? formatPlayersSummary(courtPlayersA)
        : formatPlayersSummary(courtPlayersB),
    score: side === 'A' ? scoreA : scoreB,
    isServing: servingSide === side,
    timeoutsLeft: side === 'A' ? timeoutsA : timeoutsB,
    shortTag: side === 'A' ? 'A' : 'B',
    courtEndTag:
      side === leftSide
        ? isVi
          ? 'Trái'
          : 'Left'
        : isVi
          ? 'Phải'
          : 'Right',
  });

  const leftMeta = getSideMeta(leftSide);
  const rightMeta = getSideMeta(rightSide);

  // ----- Coin Toss Handlers (3D Coin Spin · Winner Serves First, Opponent Picks Left/Right Side) -----
  const resetTossDraft = () => {
    setTossWinner(null);
    setOtherSideChoice(null);
  };

  const handleOpenToss = () => {
    resetTossDraft();
    setShowTossModal(true);
  };

  const handleFlipCoin = () => {
    if (isFlippingCoin) return;
    resetTossDraft();
    const winner: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    setCoinFinalRot(winner === 'A' ? 1800 : 1980);
    setIsFlippingCoin(true);
    flipTimerRef.current = window.setTimeout(() => {
      setTossWinner(winner);
      setIsFlippingCoin(false);
      if (soundEnabled) playRefereeWhistle(false);
    }, 1050);
  };

  const handleManualTossWinner = (winner: 'A' | 'B') => {
    setTossWinner(winner);
    setOtherSideChoice(null);
    setCoinFinalRot(winner === 'A' ? 0 : 180);
  };

  const tossOtherSide: 'A' | 'B' | null = tossWinner ? (tossWinner === 'A' ? 'B' : 'A') : null;

  const resolvedTossPreview = useMemo(() => {
    if (!tossWinner || !tossOtherSide || !otherSideChoice) return null;
    const firstServer: 'A' | 'B' = tossWinner;
    const leftTeam: 'A' | 'B' = otherSideChoice === 'left' ? tossOtherSide : tossWinner;
    const rightTeam: 'A' | 'B' = leftTeam === 'A' ? 'B' : 'A';
    return {
      winner: tossWinner,
      firstServer,
      leftTeam,
      rightTeam,
    } as TossSummary;
  }, [tossWinner, tossOtherSide, otherSideChoice]);

  const handleApplyToss = () => {
    if (!resolvedTossPreview) return;
    pushHistory();
    setServingSide(resolvedTossPreview.firstServer);
    setServerNumber(session.isDoubles ? 2 : 1);
    setSwappedSides(resolvedTossPreview.leftTeam === 'B');
    setTossResult(resolvedTossPreview);

    const serverName =
      resolvedTossPreview.firstServer === 'A' ? session.teamAName : session.teamBName;
    const leftName =
      resolvedTossPreview.leftTeam === 'A' ? session.teamAName : session.teamBName;
    const rightName =
      resolvedTossPreview.rightTeam === 'A' ? session.teamAName : session.teamBName;

    appendLog(
      'toss',
      isVi
        ? `Bốc thăm đồng xu: ${serverName} thắng → Giao bóng trước · Trái: ${leftName} · Phải: ${rightName}`
        : `Coin toss: ${serverName} won → Serves first · Left: ${leftName} · Right: ${rightName}`
    );
    setShowTossModal(false);
  };

  // ----- Time-Out Handlers -----
  const handleStartTimeout = (side: 'A' | 'B', kind: 'standard' | 'medical') => {
    const teamName = side === 'A' ? session.teamAName : session.teamBName;
    let remainingAfter = side === 'A' ? timeoutsA : timeoutsB;

    if (kind === 'standard') {
      if (remainingAfter <= 0) return;
      remainingAfter = remainingAfter - 1;
      if (side === 'A') setTimeoutsA(remainingAfter);
      else setTimeoutsB(remainingAfter);
    }

    const totalSeconds = kind === 'medical' ? 180 : 60;
    setActiveTimeout({
      side,
      teamName,
      kind,
      totalSeconds,
      remainingSeconds: totalSeconds,
      elapsedSeconds: 0,
      paused: false,
      remainingQuotaAfter: remainingAfter,
    });
  };

  const handleEndTimeout = () => {
    if (!activeTimeout) return;
    appendLog(
      'timeout',
      isVi
        ? `${activeTimeout.kind === 'medical' ? 'Time-out Y tế' : 'Time-out'} (${activeTimeout.teamName}) · Đã đếm: ${formatClock(activeTimeout.elapsedSeconds)} · Tỷ số ${scoreA}-${scoreB}`
        : `${activeTimeout.kind === 'medical' ? 'Medical Time-out' : 'Time-out'} (${activeTimeout.teamName}) · Elapsed: ${formatClock(activeTimeout.elapsedSeconds)} · Score ${scoreA}-${scoreB}`
    );
    setActiveTimeout(null);
  };

  // ----- Injury Substitution Handlers -----
  const openSubModal = (side: 'A' | 'B', slotIdx = 0) => {
    setSubModal({ side, slotIdx });
    setSelectedRosterMemberId('');
    setCustomSubName('');
    setInjuryReason(isVi ? INJURY_REASONS_VI[0] : INJURY_REASONS_EN[0]);
    setTriggerMedicalTimeoutOnSub(true);
  };

  const subContext = useMemo(() => {
    if (!subModal) return null;
    const currentPlayers = subModal.side === 'A' ? playersA : playersB;
    const safeIdx = Math.min(subModal.slotIdx, Math.max(0, currentPlayers.length - 1));
    const outgoingPlayer = currentPlayers[safeIdx] || currentPlayers[0];
    const roster = (subModal.side === 'A' ? session.teamARoster : session.teamBRoster) || [];
    const requiredGender = session.slotGenderRules?.[safeIdx] || 'any';
    const onCourtIds = new Set(currentPlayers.map((p) => p.id));

    const eligibleBench = roster.filter((m) => {
      if (onCourtIds.has(m.id)) return false;
      if (requiredGender !== 'any' && m.gender !== requiredGender) return false;
      return true;
    });

    return {
      side: subModal.side,
      slotIdx: safeIdx,
      teamName: subModal.side === 'A' ? session.teamAName : session.teamBName,
      currentPlayers,
      outgoingPlayer,
      roster,
      eligibleBench,
      requiredGender,
    };
  }, [subModal, playersA, playersB, session]);

  const handleConfirmSubstitution = () => {
    if (!subContext) return;
    const chosenRosterMember = subContext.eligibleBench.find(
      (m) => m.id === selectedRosterMemberId
    );
    const trimmedCustom = customSubName.trim();
    if (!chosenRosterMember && !trimmedCustom) return;

    const incomingSlot: CourtPlayerSlot = chosenRosterMember
      ? {
          id: chosenRosterMember.id,
          name: chosenRosterMember.name,
          skillTier: chosenRosterMember.skillTier,
          isSub: true,
        }
      : {
          id: `sub_${Date.now().toString(36)}`,
          name: trimmedCustom,
          isSub: true,
        };

    pushHistory();
    if (subContext.side === 'A') {
      setPlayersA((prev) =>
        prev.map((p, idx) => (idx === subContext.slotIdx ? incomingSlot : p))
      );
    } else {
      setPlayersB((prev) =>
        prev.map((p, idx) => (idx === subContext.slotIdx ? incomingSlot : p))
      );
    }
    setDidSubstitute(true);

    appendLog(
      'sub',
      isVi
        ? `Thay VĐV chấn thương (${subContext.teamName}): ${subContext.outgoingPlayer?.name || 'VĐV'} → ${incomingSlot.name} · Lý do: ${injuryReason} · Tỷ số ${scoreA}-${scoreB}`
        : `Injury Sub (${subContext.teamName}): ${subContext.outgoingPlayer?.name || 'Player'} → ${incomingSlot.name} · Reason: ${injuryReason} · Score ${scoreA}-${scoreB}`
    );

    const shouldStartMedical = triggerMedicalTimeoutOnSub;
    const subSide = subContext.side;
    setSubModal(null);

    if (shouldStartMedical) {
      handleStartTimeout(subSide, 'medical');
    }
  };

  // ----- Save & Finalize Payload Builders -----
  const buildFinalPayload = (
    status: 'live' | 'completed',
    winnerSide: '' | 'A' | 'B'
  ): RefereeFinalPayload => {
    const base: RefereeFinalPayload = {
      scoreA,
      scoreB,
      targetPoints,
      servingSide,
      serverNumber,
      winnerSide,
      status,
    };

    if (didSubstitute) {
      base.updatedTeamAPlayerIds = playersA.map((p) => p.id);
      base.updatedTeamBPlayerIds = playersB.map((p) => p.id);
      base.updatedTeamAName = playersA.map((p) => p.name).join(' / ');
      base.updatedTeamBName = playersB.map((p) => p.name).join(' / ');
    }
    return base;
  };

  const handleSave = () => {
    onSaveProgress(buildFinalPayload('live', ''));
  };

  const handleComplete = () => {
    if (!canFinalize) return;
    const winnerSide: 'A' | 'B' = scoreA > scoreB ? 'A' : 'B';
    onFinalize(buildFinalPayload('completed', winnerSide));
  };

  const genderLabel = (g: Gender | 'any') => {
    if (g === 'female') return isVi ? 'Chỉ VĐV Nữ' : 'Female Only';
    if (g === 'male') return isVi ? 'Chỉ VĐV Nam' : 'Male Only';
    return isVi ? 'Nam / Nữ tự do' : 'Any Gender';
  };

  const needsPreMatchToss = scoreA === 0 && scoreB === 0 && !tossResult;

  return (
    <MotionModal
      variant="fullscreen"
      ariaLabel={session.title}
      overlayClassName="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-3 phone-landscape:p-0 overflow-hidden"
      panelClassName="relative w-full sm:max-w-4xl phone-landscape:max-w-none h-[100dvh] sm:h-[min(94dvh,780px)] phone-landscape:h-[100dvh] bg-white dark:bg-slate-900 sm:border border-slate-200 dark:border-slate-800 phone-landscape:border-0 rounded-none sm:rounded-2xl phone-landscape:rounded-none overflow-hidden flex flex-col pt-safe pb-safe px-safe"
    >
        {/* ============================================================
            ROW 1: SINGLE-LINE COCKPIT TOP BAR (PORTRAIT & LANDSCAPE)
           ============================================================ */}
        <div className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 phone-landscape:py-1 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1.5 shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0 hidden sm:block phone-landscape:block" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm phone-landscape:text-xs font-bold text-slate-900 dark:text-white truncate font-display leading-tight">
                {session.title}
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate hidden sm:block phone-landscape:hidden leading-tight">
                {session.subtitle}
              </p>
            </div>
          </div>

          {/* Inline Callout + Read-Only Locked Target Points in Phone Landscape */}
          <div className="hidden phone-landscape:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
              {officialCallout}
            </span>
            <span className="inline-flex items-center gap-1 ml-1 border-l border-slate-300 dark:border-slate-700 pl-1.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
              <Lock className="w-2.5 h-2.5 text-accent" />
              <span>{targetPoints}đ</span>
            </span>
          </div>

          {/* Compact Utility Actions (No Social Share for Referee) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleOpenToss}
              className={`h-8 sm:h-9 phone-landscape:h-7 px-2 sm:px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                tossResult
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : needsPreMatchToss
                    ? 'border-amber-400 bg-amber-400 text-slate-950 hover:bg-amber-500'
                    : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
              }`}
              title={isVi ? 'Bốc thăm đồng xu' : 'Coin Toss'}
            >
              <Coins className="w-3.5 h-3.5 shrink-0" />
              <span>{isVi ? 'Bốc thăm' : 'Toss'}</span>
            </button>

            <button
              type="button"
              onClick={() => openSubModal('A', 0)}
              className="h-8 sm:h-9 phone-landscape:h-7 px-2 sm:px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1"
              title={isVi ? 'Thay VĐV do chấn thương' : 'Injury Substitution'}
            >
              <HeartPulse className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline phone-landscape:inline">
                {isVi ? 'Thay VĐV' : 'Sub'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setForfeitDraftSide(null);
                setShowForfeitModal(true);
              }}
              className="h-8 sm:h-9 phone-landscape:h-7 px-2 sm:px-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/35 text-amber-800 dark:text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1"
              title={isVi ? 'Xử bỏ cuộc (15-0)' : 'Record Forfeit (15-0)'}
            >
              <Flag className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline phone-landscape:inline">
                {isVi ? 'Bỏ cuộc' : 'Forfeit'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowCourt2D((v) => !v)}
              className={`h-8 sm:h-9 phone-landscape:h-7 px-2 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 ${
                showCourt2D
                  ? 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
              title={isVi ? 'Ẩn/Hiện sân 2D' : 'Toggle 2D Court'}
            >
              {showCourt2D ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">2D</span>
            </button>

            {eventLog.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEventLog(true)}
                className="h-8 sm:h-9 phone-landscape:h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-mono font-bold inline-flex items-center gap-1"
                title={isVi ? 'Nhật ký trọng tài' : 'Referee Log'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{eventLog.length}</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close Referee Console"
              className="h-8 w-8 sm:h-9 sm:w-9 phone-landscape:h-7 phone-landscape:w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ============================================================
            ROW 2: SLIM CALLOUT & TARGET STRIP (PORTRAIT / DESKTOP ONLY)
           ============================================================ */}
        <div className="px-2.5 sm:px-4 py-1 sm:py-1.5 phone-landscape:hidden bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              {isVi ? 'Điểm' : 'Call'}
            </span>
            <span className="font-mono text-base sm:text-xl font-extrabold text-slate-900 dark:text-white tabular-nums tracking-tight shrink-0">
              {officialCallout}
            </span>
            {isMatchFinished ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                ·{' '}
                {isVi
                  ? `Kết thúc (${finishedWinnerSide === 'A' ? session.teamAName : session.teamBName} thắng)`
                  : `Finished (${finishedWinnerSide === 'A' ? session.teamAName : session.teamBName} wins)`}
              </span>
            ) : (
              <>
                {session.isDoubles && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    · {isVi ? `Giao #${serverNumber}` : `Srv #${serverNumber}`}
                  </span>
                )}
                {dreambreakerInfo && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 truncate">
                    · <RefreshCw className="w-3 h-3 shrink-0" />#{dreambreakerInfo.rotationSlot}/4 (
                    {dreambreakerInfo.pointsUntilSwitch}đ)
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
            <Lock className="w-3 h-3 text-accent shrink-0" />
            <span>
              {isVi ? `Chạm ${targetPoints}đ` : `To ${targetPoints}`}
              {session.stageLabel ? ` · ${session.stageLabel}` : ''}
            </span>
            <span className="hidden sm:inline text-[10px] font-sans font-medium text-slate-400 dark:text-slate-500">
              ({isVi ? `Đổi sân ${midPointThreshold}đ` : `Switch @ ${midPointThreshold}`})
            </span>
          </div>
        </div>

        {/* ============================================================
            ROW 3: ZERO-SCROLL ADAPTIVE COCKPIT
            - Portrait: Vertical flex (2D Court ~31dvh + 2-Col Scoreboard flex-1)
            - Landscape: 12-Col Horizontal Split (2D Court Left 6 + Scoreboard Right 6)
           ============================================================ */}
        <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3 phone-landscape:p-1.5 flex flex-col gap-2 sm:gap-3 phone-landscape:grid phone-landscape:grid-cols-12 phone-landscape:gap-2">
          {/* Interactive 2D Pickleball Court */}
          {showCourt2D && (
            <RefereeCourt2D
              language={language}
              isDoubles={session.isDoubles}
              leftSide={leftSide}
              rightSide={rightSide}
              leftTeamName={leftMeta.name}
              rightTeamName={rightMeta.name}
              leftScore={leftMeta.score}
              rightScore={rightMeta.score}
              leftPlayers={leftSide === 'A' ? courtPlayersA : courtPlayersB}
              rightPlayers={rightSide === 'A' ? courtPlayersA : courtPlayersB}
              servingSide={servingSide}
              serverNumber={serverNumber}
              onSwapSides={() => setSwappedSides((v) => !v)}
              onClickPlayer={(side, slotIdx) => openSubModal(side, slotIdx)}
              className="h-[31dvh] min-h-[146px] max-h-[250px] sm:h-[265px] sm:max-h-[285px] shrink-0 phone-landscape:col-span-6 phone-landscape:h-full phone-landscape:min-h-0 phone-landscape:max-h-none"
            />
          )}

          {/* Side-by-Side 2-Column Scoreboard (Even in Portrait, aligned Left/Right under the 2D court!) */}
          <div
            className={`flex-1 min-h-0 grid grid-cols-2 gap-2 sm:gap-3 phone-landscape:gap-1.5 phone-landscape:h-full ${
              showCourt2D ? 'phone-landscape:col-span-6' : 'phone-landscape:col-span-12'
            }`}
          >
            {[
              { side: leftSide, meta: leftMeta },
              { side: rightSide, meta: rightMeta },
            ].map(({ side, meta }) => {
              const isWinnerSide = isMatchFinished && finishedWinnerSide === side;
              const canPressAddPoint = !isMatchFinished && meta.isServing;
              return (
              <div
                key={side}
                className={`rounded-xl sm:rounded-2xl border p-2 sm:p-3.5 phone-landscape:p-2 flex flex-col justify-between min-h-0 overflow-hidden transition-colors ${
                  isWinnerSide
                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/35'
                    : meta.isServing && !isMatchFinished
                      ? 'border-accent bg-accent-soft/35 dark:bg-slate-800/80'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {/* Card Header: Team & Server Status */}
                <div className="min-w-0 shrink-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                      {meta.shortTag} · {meta.courtEndTag}
                    </span>
                    {isMatchFinished ? (
                      <span
                        className={`text-[10px] sm:text-xs font-bold shrink-0 ${
                          isWinnerSide
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {isWinnerSide
                          ? isVi
                            ? '★ Thắng'
                            : '★ Winner'
                          : isVi
                            ? 'Kết thúc'
                            : 'Final'}
                      </span>
                    ) : meta.isServing ? (
                      <span className="text-[10px] sm:text-xs font-bold text-accent shrink-0">
                        ● {isVi ? 'Giao' : 'Srv'}
                        {session.isDoubles ? `#${serverNumber}` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">
                        {isVi ? 'Đỡ bóng' : 'Receive'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs sm:text-base phone-landscape:text-xs font-bold text-slate-900 dark:text-white mt-0.5 truncate font-display leading-tight">
                    {meta.name}
                  </h3>
                  <p className="text-[10px] sm:text-xs phone-landscape:text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                    {meta.playersText}
                  </p>
                </div>

                {/* Big Fluid Score Number */}
                <div className="my-auto py-0.5 text-center shrink-0">
                  <div
                    className={`font-mono text-[clamp(2.5rem,12vw,4.75rem)] phone-landscape:text-[clamp(1.85rem,13vh,3.25rem)] font-extrabold tabular-nums leading-none tracking-tight ${
                      isWinnerSide
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {meta.score}
                  </div>
                </div>

                {/* Bottom Actions inside Score Card (-1 Correction + +1 Score) */}
                <div className="space-y-1.5 phone-landscape:space-y-1 shrink-0">
                  <div className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      disabled={meta.score <= 0}
                      onClick={() => handleSubtractPoint(side)}
                      title={isVi ? `Trừ 1 điểm (${meta.name})` : `Subtract 1 pt (${meta.name})`}
                      aria-label={isVi ? `Trừ 1 điểm đội ${side}` : `Subtract 1 point team ${side}`}
                      className="w-10 sm:w-12 phone-landscape:w-9 min-h-[42px] sm:min-h-[50px] phone-landscape:min-h-[34px] rounded-lg sm:rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 text-slate-700 dark:text-slate-200 font-mono font-bold text-xs inline-flex items-center justify-center shrink-0 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5 shrink-0" />
                    </button>

                    <button
                      type="button"
                      disabled={!canPressAddPoint}
                      onClick={() => handleAddPoint(side)}
                      className={`flex-1 min-w-0 min-h-[42px] sm:min-h-[50px] phone-landscape:min-h-[34px] px-1.5 rounded-lg sm:rounded-xl font-bold text-xs sm:text-base phone-landscape:text-xs inline-flex items-center justify-center gap-1 transition-colors ${
                        canPressAddPoint
                          ? 'btn-accent'
                          : isWinnerSide
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-not-allowed'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      {canPressAddPoint ? (
                        <>
                          <Plus className="w-4 h-4 shrink-0" />
                          <span className="truncate">1 {isVi ? 'ĐIỂM' : 'PT'} ({side})</span>
                        </>
                      ) : isMatchFinished ? (
                        <>
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {isWinnerSide
                              ? isVi
                                ? `ĐẠT ${targetPoints}Đ`
                                : `WON (${targetPoints})`
                              : isVi
                                ? 'KẾT THÚC'
                                : 'LOCKED'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{isVi ? 'ĐỠ BÓNG' : 'RECEIVE'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Compact Per-Team Time-Out + Injury Sub Row */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={meta.timeoutsLeft <= 0}
                      onClick={() => handleStartTimeout(side, 'standard')}
                      className="flex-1 min-h-[32px] phone-landscape:min-h-[28px] px-1.5 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:border-accent text-[10px] sm:text-xs font-semibold text-slate-800 dark:text-slate-100 disabled:opacity-45 inline-flex items-center justify-between gap-1 transition-colors"
                    >
                      <span className="inline-flex items-center gap-1 truncate">
                        <Timer className="w-3 h-3 text-accent shrink-0" />
                        <span>TO</span>
                      </span>
                      <span className="inline-flex items-center gap-0.5 shrink-0">
                        {[0, 1].map((idx) => (
                          <span
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full ${
                              idx < meta.timeoutsLeft
                                ? 'bg-emerald-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                        ))}
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 ml-0.5">
                          {meta.timeoutsLeft}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openSubModal(side, 0)}
                      className="min-h-[32px] phone-landscape:min-h-[28px] px-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-[10px] sm:text-xs font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center justify-center gap-1 shrink-0"
                      title={isVi ? `Thay VĐV chấn thương (${meta.name})` : `Injury sub (${meta.name})`}
                    >
                      <UserMinus className="w-3 h-3 shrink-0" />
                      <span className="hidden sm:inline phone-landscape:hidden">
                        {isVi ? 'Thay' : 'Sub'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================
            ROW 4: UNIFIED FOOTER BAR
            - Portrait: 2 tight rows (Controls + Save/Finalize)
            - Landscape: 1 single slim horizontal cockpit bar!
           ============================================================ */}
        <div className="px-2 sm:px-4 py-1.5 sm:py-2.5 phone-landscape:py-1 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex flex-col phone-landscape:flex-row phone-landscape:items-center phone-landscape:justify-between gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Match Controls: Side-Out, Server 1-2, Swap, Undo */}
          <div className="flex items-center justify-between phone-landscape:justify-start gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isMatchFinished}
                onClick={handleSideOutFault}
                className="min-h-[36px] sm:min-h-[40px] phone-landscape:min-h-[32px] px-2.5 sm:px-3.5 rounded-lg sm:rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {session.isDoubles
                  ? serverNumber === 1
                    ? isVi
                      ? 'Mất giao (→ G2)'
                      : 'Fault (→ S2)'
                    : isVi
                      ? 'Đổi giao bóng'
                      : 'Side-out'
                  : isVi
                    ? 'Đổi giao bóng'
                    : 'Side-out'}
              </button>

              {session.isDoubles && (
                <div className="inline-flex rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                  <button
                    type="button"
                    disabled={isMatchFinished}
                    onClick={() => {
                      if (isMatchFinished) return;
                      pushHistory();
                      setServerNumber(1);
                    }}
                    className={`min-h-[36px] sm:min-h-[40px] phone-landscape:min-h-[32px] px-2.5 text-[11px] font-mono font-bold transition-colors disabled:opacity-40 ${
                      serverNumber === 1
                        ? 'bg-accent-soft text-accent'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    G1
                  </button>
                  <button
                    type="button"
                    disabled={isMatchFinished}
                    onClick={() => {
                      if (isMatchFinished) return;
                      pushHistory();
                      setServerNumber(2);
                    }}
                    className={`min-h-[36px] sm:min-h-[40px] phone-landscape:min-h-[32px] px-2.5 text-[11px] font-mono font-bold border-l border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-40 ${
                      serverNumber === 2
                        ? 'bg-accent-soft text-accent'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    G2
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSwappedSides((v) => !v)}
                className="min-h-[36px] sm:min-h-[40px] phone-landscape:min-h-[32px] px-2 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xs:inline">{isVi ? 'Đổi sân' : 'Swap'}</span>
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className="min-h-[36px] sm:min-h-[40px] phone-landscape:min-h-[32px] px-2 sm:px-3 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>{isVi ? 'Hoàn tác' : 'Undo'}</span>
              </button>
            </div>
          </div>

          {/* Save Live & Quick Finalize */}
          <div className="flex items-center justify-between gap-2">
            <div className="hidden md:block phone-landscape:hidden text-xs text-slate-500 dark:text-slate-400 truncate">
              {isMatchFinished ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {isVi
                    ? `Đã chạm ${targetPoints}đ — Đã khóa +1 · Bấm "Chốt trận" hoặc "Hoàn tác"`
                    : `Reached ${targetPoints} pts — Scoring locked · Finalize or Undo`}
                </span>
              ) : (
                <span>
                  {isVi
                    ? 'Chỉ bên đang giao bóng mới bấm +1 · Bên kia bấm Đổi giao bóng.'
                    : 'Only serving team can score +1 · Tap Side-out to switch serve.'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 phone-landscape:flex sm:flex items-center gap-1.5 w-full sm:w-auto phone-landscape:w-auto">
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[40px] sm:min-h-[42px] phone-landscape:min-h-[32px] px-3 sm:px-4 rounded-lg sm:rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {isVi ? 'Lưu Live' : 'Save Live'}
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={!canFinalize}
                className={`min-h-[40px] sm:min-h-[42px] phone-landscape:min-h-[32px] px-3.5 sm:px-5 rounded-lg sm:rounded-xl text-xs font-bold btn-accent disabled:opacity-40 inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  reachedTarget ? 'ring-2 ring-emerald-400 ring-offset-1 dark:ring-offset-slate-900' : ''
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isVi ? 'Chốt trận' : 'Finalize'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================
            OVERLAY 0: REFEREE MATCH EVENT LOG MODAL
           ============================================================ */}
        {showEventLog && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-[calc(100dvh-24px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <FileText className="w-4 h-4 text-accent" />
                  <span>{isVi ? 'Nhật ký trọng tài' : 'Referee Match Log'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEventLog(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-2 flex-1">
                {eventLog.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2"
                  >
                    <span className="font-mono text-[10px] text-slate-400 shrink-0 mt-0.5">
                      [{ev.time}]
                    </span>
                    <span>{ev.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            OVERLAY 1: PRE-MATCH 3D SPINNING COIN TOSS
            Rule: Winner serves first; Opponent chooses Left or Right court side.
           ============================================================ */}
        {showTossModal && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-xl max-h-[calc(100dvh-16px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Coins className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display truncate">
                      {isVi ? 'Bốc thăm Đồng xu 3D' : 'Pre-Match 3D Coin Toss'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isVi
                        ? 'Đội thắng đồng xu Giao bóng trước · Đội còn lại chọn Sân Trái / Phải'
                        : 'Coin winner serves first · Opponent chooses Left or Right side'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTossModal(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
                {/* Step 1: 3D Spinning Coin + Flip Trigger */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="coin-3d-scene shrink-0">
                      <div
                        className={`coin-3d-disc ${isFlippingCoin ? 'is-spinning' : ''}`}
                        style={
                          {
                            '--coin-final-rot': `${coinFinalRot}deg`,
                            transform: isFlippingCoin
                              ? undefined
                              : tossWinner === 'B'
                                ? 'rotateY(180deg)'
                                : 'rotateY(0deg)',
                          } as React.CSSProperties
                        }
                      >
                        {/* Front Face: Team A */}
                        <div className="coin-face bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 border-4 border-amber-200 text-slate-950 shadow-lg flex-col">
                          <span className="font-mono text-xl font-black leading-none">A</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 max-w-[68px] truncate">
                            {session.teamAName}
                          </span>
                        </div>
                        {/* Back Face: Team B */}
                        <div className="coin-face coin-face-back bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 border-4 border-emerald-200 text-white shadow-lg flex-col">
                          <span className="font-mono text-xl font-black leading-none">B</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5 max-w-[68px] truncate">
                            {session.teamBName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {isVi ? 'Bước 1 · Tung đồng xu chọn quyền giao bóng' : 'Step 1 · Flip Coin for First Serve'}
                      </div>
                      <button
                        type="button"
                        onClick={handleFlipCoin}
                        disabled={isFlippingCoin}
                        className="min-h-[42px] px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-2 disabled:opacity-60 shadow-xs"
                      >
                        <Coins className={`w-4 h-4 ${isFlippingCoin ? 'animate-spin' : ''}`} />
                        <span>
                          {isFlippingCoin
                            ? isVi
                              ? 'Đang quay đồng xu...'
                              : 'Spinning coin...'
                            : isVi
                              ? 'Quay đồng xu ngay'
                              : 'Spin 3D Coin'}
                        </span>
                      </button>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isVi
                          ? 'Hoặc chạm chọn trực tiếp đội thắng thăm bên dưới:'
                          : 'Or tap directly to select the toss winner below:'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(['A', 'B'] as const).map((side) => {
                      const active = tossWinner === side;
                      const label = side === 'A' ? session.teamAName : session.teamBName;
                      return (
                        <button
                          key={side}
                          type="button"
                          disabled={isFlippingCoin}
                          onClick={() => handleManualTossWinner(side)}
                          className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="text-[10px] font-mono uppercase opacity-75">
                            {side === 'A' ? (isVi ? 'Mặt A · Đội A' : 'Side A · Team A') : isVi ? 'Mặt B · Đội B' : 'Side B · Team B'}
                            {active ? ` · ${isVi ? 'GIAO TRƯỚC' : 'SERVES FIRST'}` : ''}
                          </div>
                          <div className="text-xs font-bold truncate">{label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2 (Locked): Winner Serves First */}
                {tossWinner && tossOtherSide && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/25 p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {isVi ? 'Bước 2 · Quyền Giao bóng trước' : 'Step 2 · First Serve'}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                        {tossWinner === 'A' ? session.teamAName : session.teamBName}{' '}
                        <span className="font-normal text-emerald-700 dark:text-emerald-300">
                          — {isVi ? 'Giao bóng trước' : 'Serves First'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                      {isVi ? 'Cố định' : 'Locked'}
                    </span>
                  </div>
                )}

                {/* Step 3: Remaining Team Chooses Left or Right Court */}
                {tossWinner && tossOtherSide && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {isVi
                          ? `Bước 3 · ${tossOtherSide === 'A' ? session.teamAName : session.teamBName} chọn Sân`
                          : `Step 3 · ${tossOtherSide === 'A' ? session.teamAName : session.teamBName} Picks Court Side`}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                        {isVi ? 'Trái hoặc Phải' : 'Left or Right'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setOtherSideChoice('left')}
                        className={`min-h-[48px] px-3 rounded-xl border text-xs font-bold transition-colors ${
                          otherSideChoice === 'left'
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-accent'
                        }`}
                      >
                        {isVi ? '← Chọn Sân Trái' : '← Pick Left Court'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtherSideChoice('right')}
                        className={`min-h-[48px] px-3 rounded-xl border text-xs font-bold transition-colors ${
                          otherSideChoice === 'right'
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-accent'
                        }`}
                      >
                        {isVi ? 'Chọn Sân Phải →' : 'Pick Right Court →'}
                      </button>
                    </div>
                  </div>
                )}

                {resolvedTossPreview && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                    <strong>{isVi ? 'Giao trước:' : 'First Serve:'}</strong>{' '}
                    {resolvedTossPreview.firstServer === 'A'
                      ? session.teamAName
                      : session.teamBName}{' '}
                    · <strong>{isVi ? 'Trái:' : 'Left:'}</strong>{' '}
                    {resolvedTossPreview.leftTeam === 'A' ? session.teamAName : session.teamBName} ·{' '}
                    <strong>{isVi ? 'Phải:' : 'Right:'}</strong>{' '}
                    {resolvedTossPreview.rightTeam === 'A' ? session.teamAName : session.teamBName}
                  </div>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTossModal(false)}
                  className="min-h-[38px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={!resolvedTossPreview}
                  onClick={handleApplyToss}
                  className="min-h-[38px] px-4 rounded-xl btn-accent text-xs font-bold disabled:opacity-40"
                >
                  {isVi ? 'Áp dụng lên Sân 2D' : 'Apply to 2D Court'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            OVERLAY 2: LIVE TIME-OUT NOTIFICATION BOARD (SINGLE-SCREEN PORTRAIT & LANDSCAPE)
           ============================================================ */}
        {activeTimeout && (
          <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4">
            <div
              className={`w-full max-w-md phone-landscape:max-w-xl max-h-[calc(100dvh-16px)] rounded-2xl border-2 overflow-hidden shadow-2xl flex flex-col ${
                activeTimeout.remainingSeconds === 0
                  ? 'border-rose-500 bg-slate-900'
                  : activeTimeout.remainingSeconds <= 15
                    ? 'border-amber-400 bg-slate-900'
                    : activeTimeout.kind === 'medical'
                      ? 'border-rose-400 bg-slate-900'
                      : 'border-emerald-500 bg-slate-900'
              }`}
            >
              {/* Board Header */}
              <div
                className={`px-4 py-2.5 phone-landscape:py-2 flex items-center justify-between shrink-0 ${
                  activeTimeout.remainingSeconds === 0
                    ? 'bg-rose-600 text-white'
                    : activeTimeout.kind === 'medical'
                      ? 'bg-rose-950/90 text-rose-100 border-b border-rose-800/70'
                      : 'bg-slate-800 text-white border-b border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {activeTimeout.kind === 'medical' ? (
                    <HeartPulse className="w-4 h-4 text-rose-300 shrink-0" />
                  ) : (
                    <Timer className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider truncate">
                    {activeTimeout.kind === 'medical'
                      ? isVi
                        ? 'BẢNG THÔNG BÁO TIME-OUT Y TẾ'
                        : 'MEDICAL TIME-OUT BOARD'
                      : isVi
                        ? 'BẢNG THÔNG BÁO TIME-OUT'
                        : 'TIME-OUT NOTIFICATION BOARD'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
                  title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>

              {/* Body */}
              <div className="p-4 phone-landscape:p-3 text-center space-y-3.5 phone-landscape:space-y-2.5 overflow-y-auto">
                <div className="phone-landscape:flex phone-landscape:items-center phone-landscape:justify-between phone-landscape:text-left">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {isVi ? 'Đội yêu cầu tạm dừng' : 'Called By'}
                    </div>
                    <div className="text-lg sm:text-2xl phone-landscape:text-lg font-extrabold text-white font-display truncate">
                      {activeTimeout.teamName}
                    </div>
                  </div>
                  {activeTimeout.kind === 'standard' && (
                    <div className="text-xs text-slate-400 mt-0.5 phone-landscape:mt-0 font-mono">
                      {isVi
                        ? `Còn lại: ${activeTimeout.remainingQuotaAfter}/2 lượt`
                        : `Left: ${activeTimeout.remainingQuotaAfter}/2`}
                    </div>
                  )}
                </div>

                {/* Dual Clock Readout: Count-Up (Đã đếm) + Countdown (Còn lại) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 phone-landscape:p-2">
                    <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {isVi ? 'Thời gian đã đếm' : 'Time Counted'}
                    </div>
                    <div className="font-mono text-3xl sm:text-4xl phone-landscape:text-3xl font-extrabold text-emerald-400 tabular-nums mt-0.5">
                      {formatClock(activeTimeout.elapsedSeconds)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 phone-landscape:p-2">
                    <div className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      {isVi ? 'Còn lại' : 'Remaining'}
                    </div>
                    <div
                      className={`font-mono text-3xl sm:text-4xl phone-landscape:text-3xl font-extrabold tabular-nums mt-0.5 ${
                        activeTimeout.remainingSeconds === 0
                          ? 'text-rose-400 animate-pulse'
                          : activeTimeout.remainingSeconds <= 15
                            ? 'text-amber-400'
                            : 'text-white'
                      }`}
                    >
                      {formatClock(activeTimeout.remainingSeconds)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        activeTimeout.remainingSeconds === 0
                          ? 'bg-rose-500'
                          : activeTimeout.remainingSeconds <= 15
                            ? 'bg-amber-400'
                            : activeTimeout.kind === 'medical'
                              ? 'bg-rose-400'
                              : 'bg-emerald-400'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (activeTimeout.elapsedSeconds / Math.max(1, activeTimeout.totalSeconds)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>00:00</span>
                    <span>
                      {activeTimeout.remainingSeconds === 0
                        ? isVi
                          ? 'HẾT GIỜ! MỜI VĐV VÀO SÂN'
                          : 'TIME UP! RESUME PLAY'
                        : activeTimeout.remainingSeconds <= 15
                          ? isVi
                            ? 'Còn ≤ 15 giây!'
                            : '15s warning!'
                          : activeTimeout.paused
                            ? isVi
                              ? 'Đang tạm dừng'
                              : 'Paused'
                            : `${formatClock(activeTimeout.totalSeconds)}`}
                    </span>
                    <span>{formatClock(activeTimeout.totalSeconds)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-2 phone-landscape:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTimeout((prev) => (prev ? { ...prev, paused: !prev.paused } : null))
                    }
                    className="min-h-[42px] phone-landscape:min-h-[38px] rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    {activeTimeout.paused ? (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Tiếp tục' : 'Resume'}</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>{isVi ? 'Tạm dừng' : 'Pause'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTimeout((prev) =>
                        prev
                          ? {
                              ...prev,
                              totalSeconds: prev.totalSeconds + 30,
                              remainingSeconds: prev.remainingSeconds + 30,
                            }
                          : null
                      )
                    }
                    className="min-h-[42px] phone-landscape:min-h-[38px] rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+30s</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEndTimeout}
                    className="col-span-2 phone-landscape:col-span-1 min-h-[44px] phone-landscape:min-h-[38px] rounded-xl btn-accent font-bold text-xs sm:text-sm"
                  >
                    {isVi ? 'Kết thúc & Thi đấu' : 'End & Resume'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            OVERLAY 3: INJURY SUBSTITUTION PANEL
           ============================================================ */}
        {subModal && subContext && (
          <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-lg max-h-[calc(100dvh-16px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <HeartPulse className="w-5 h-5 text-rose-500 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display truncate">
                      {isVi ? 'Thay VĐV do Chấn thương' : 'Injury Substitution'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {isVi ? 'Cập nhật tức thì lên Sân 2D & bảng điểm' : 'Updates 2D court & scoreboard immediately'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubModal(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
                {/* Team Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  {(['A', 'B'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => {
                        setSubModal({ side, slotIdx: 0 });
                        setSelectedRosterMemberId('');
                      }}
                      className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold truncate ${
                        subModal.side === side
                          ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {side === 'A' ? session.teamAName : session.teamBName}
                    </button>
                  ))}
                </div>

                {/* Outgoing Player */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isVi ? '1. VĐV rời sân (chấn thương)' : '1. Injured Player Leaving'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {subContext.currentPlayers.map((p, idx) => (
                      <button
                        key={`${p.id}_${idx}`}
                        type="button"
                        onClick={() => {
                          setSubModal({ side: subContext.side, slotIdx: idx });
                          setSelectedRosterMemberId('');
                        }}
                        className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-left ${
                          subContext.slotIdx === idx
                            ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                          {session.isDoubles
                            ? idx === 0
                              ? isVi
                                ? 'Ô Chẵn'
                                : 'Even'
                              : isVi
                                ? 'Ô Lẻ'
                                : 'Odd'
                            : isVi
                              ? 'Đơn'
                              : 'Singles'}
                        </div>
                        <div className="text-xs font-bold truncate">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Incoming Player */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {isVi ? '2. VĐV vào sân thay thế' : '2. Replacement Player'}
                    </label>
                    {subContext.requiredGender !== 'any' && (
                      <span className="text-[10px] font-semibold text-accent">
                        {genderLabel(subContext.requiredGender)}
                      </span>
                    )}
                  </div>

                  {subContext.eligibleBench.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                      {subContext.eligibleBench.map((m) => {
                        const selected = selectedRosterMemberId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedRosterMemberId(m.id);
                              setCustomSubName('');
                            }}
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-left ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="text-xs font-bold truncate">{m.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {m.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'} ·{' '}
                              {m.skillTier}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="text"
                    value={customSubName}
                    onChange={(e) => {
                      setCustomSubName(e.target.value);
                      if (e.target.value.trim()) setSelectedRosterMemberId('');
                    }}
                    placeholder={
                      isVi ? 'Hoặc nhập tên VĐV thay thế khẩn cấp...' : 'Or type substitute name...'
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Injury Reason */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isVi ? '3. Lý do chấn thương' : '3. Injury Reason'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(isVi ? INJURY_REASONS_VI : INJURY_REASONS_EN).map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setInjuryReason(reason)}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-medium ${
                          injuryReason === reason
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={triggerMedicalTimeoutOnSub}
                    onChange={(e) => setTriggerMedicalTimeoutOnSub(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {isVi
                      ? 'Mở ngay Bảng thông báo Time-out Y tế (3 phút) sau khi thay VĐV'
                      : 'Launch 3-min Medical Time-out Board after confirming'}
                  </span>
                </label>
              </div>

              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubModal(null)}
                  className="min-h-[38px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={!selectedRosterMemberId && !customSubName.trim()}
                  onClick={handleConfirmSubstitution}
                  className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
                >
                  {isVi ? 'Xác nhận thay VĐV' : 'Confirm Sub'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            OVERLAY 4: MID-GAME COURT SWITCH POPUP (6/11, 8/15, 11/21)
           ============================================================ */}
        {showCourtSwitchModal && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-amber-400 text-slate-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 shrink-0" />
                  <h3 className="text-sm sm:text-base font-extrabold font-display uppercase tracking-wide">
                    {isVi ? 'ĐẾN ĐIỂM ĐỔI SÂN!' : 'MID-GAME COURT SWITCH!'}
                  </h3>
                </div>
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-950/15 tabular-nums">
                  {midPointThreshold}/{targetPoints}
                </span>
              </div>

              <div className="p-4 sm:p-5 space-y-4 text-center">
                <div className="font-mono text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  {scoreA} - {scoreB}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isVi
                    ? `Trận chạm ${targetPoints} điểm đã đạt mốc ${midPointThreshold} điểm. Mời hai đội đổi sân thi đấu (Sân Trái ↔ Sân Phải).`
                    : `This ${targetPoints}-point game has reached ${midPointThreshold} points. Both sides should now switch court ends (Left ↔ Right).`}
                </p>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCourtSwitchModal(false)}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {isVi ? 'Bỏ qua / Đã đổi' : 'Dismiss'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMidCourtSwitch}
                    className="min-h-[44px] px-3 rounded-xl btn-accent text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeftRight className="w-4 h-4 shrink-0" />
                    <span>{isVi ? 'Đổi sân ngay' : 'Switch Ends Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            OVERLAY 5: SUB-MATCH FORFEIT (15-0) CONFIRMATION MODAL
           ============================================================ */}
        {showForfeitModal && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-display">
                    {isVi ? 'Xử Bỏ Cuộc Trận Này (15-0)' : 'Record Match Forfeit (15-0)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForfeitModal(false);
                    setForfeitDraftSide(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3.5">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isVi
                    ? 'Chọn đội bỏ cuộc. Theo điều lệ giải, trận đấu sẽ được chốt ngay với tỷ số 15-0 cho đội đối thủ.'
                    : 'Select the forfeiting side. Per tournament rules, the match is finalized immediately as a 15-0 win for the opponent.'}
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {(['A', 'B'] as const).map((side) => {
                    const teamLabel = side === 'A' ? session.teamAName : session.teamBName;
                    const active = forfeitDraftSide === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setForfeitDraftSide(side)}
                        className={`min-h-[48px] px-3.5 py-2 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                          active
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {isVi ? `Đội ${side} bỏ cuộc: ${teamLabel}` : `Team ${side} forfeits: ${teamLabel}`}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {side === 'A' ? 'Tỷ số chốt: 0 - 15' : 'Tỷ số chốt: 15 - 0'}
                          </div>
                        </div>
                        <Flag className={`w-4 h-4 shrink-0 ${active ? 'text-rose-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForfeitModal(false);
                      setForfeitDraftSide(null);
                    }}
                    className="min-h-[40px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {isVi ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={!forfeitDraftSide}
                    onClick={handleConfirmForfeit}
                    className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
                  >
                    {isVi ? 'Xác nhận Bỏ cuộc (15-0)' : 'Confirm Forfeit (15-0)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </MotionModal>
  );
};
