import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Flag,
  GitBranch,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { exportTeamCupToExcel } from '../lib/excelExport';
import { computeGroupStandings, computeTeamTieSummary, getActiveGroupNames } from '../lib/seedData';
import {
  auditScheduleConflicts,
  COURT_COUNT_PRESETS,
  GROUP_COUNT_PRESETS,
  MAX_COURTS_COUNT,
} from '../lib/teamScheduler';
import {
  ALL_GROUP_NAMES,
  type AthleteProfile,
  type CourtPinConfig,
  type Gender,
  type GroupName,
  type Language,
  type ScheduleConfig,
  type SkillTier,
  type StaffRoleSession,
  type SubMatchType,
  type TargetPointsOption,
  type TeamEntry,
  type TeamMember,
  type TeamSubMatch,
  type TeamTie,
  type TieBreakMode,
  type TournamentRulesConfig,
} from '../lib/types';
import { Bracket2DCanvas } from './Bracket2DCanvas';
import type { RefereeSessionPayload } from './RefereeAppModal';

interface TeamCupViewProps {
  teams: TeamEntry[];
  ties: TeamTie[];
  athletes: AthleteProfile[];
  language: Language;
  isAdmin: boolean;
  roleSession: StaffRoleSession;
  courtPins: CourtPinConfig[];
  scheduleConfig: ScheduleConfig;
  tournamentRules: TournamentRulesConfig;
  onUpdateScheduleConfig: (cfg: ScheduleConfig) => void;
  onUpdateTournamentRules: (rules: TournamentRulesConfig) => void;
  onAutoReschedule: () => void;
  onOpenRoleModal: () => void;
  onSignInAdmin?: () => void;
  onRegenerateCourtPin: (courtName: string) => void;
  onUpdateTie: (tie: TeamTie) => void;
  onGenerateSerieAB: () => void;
  onCreateTeam: (payload: {
    name: string;
    shortCode: string;
    groupName: GroupName;
    city: string;
  }) => void;
  onAddTeamMember: (teamId: string, member: Omit<TeamMember, 'id'>) => void;
  onRemoveTeamMember: (teamId: string, memberId: string) => void;
  onLaunchReferee: (
    session: RefereeSessionPayload,
    context: { kind: 'submatch'; tieId: string; subMatchId: string } | { kind: 'tiebreak'; tieId: string }
  ) => void;
  onInspectTieH2H?: (tie: TeamTie) => void;
  onInspectTeamH2H?: (team: TeamEntry) => void;
  onInspectPlayerH2H?: (playerName: string) => void;
}

type TeamCupSubTab = 'bracket_2d' | 'schedule' | 'group_lineup' | 'rosters';

function getSlotGenderRequirement(type: SubMatchType, slotIndex: 0 | 1): Gender {
  if (type === 'womens_doubles') return 'female';
  if (type === 'mens_doubles') return 'male';
  return slotIndex === 0 ? 'male' : 'female';
}

export const TeamCupView: React.FC<TeamCupViewProps> = ({
  teams,
  ties,
  athletes,
  language,
  isAdmin,
  roleSession,
  courtPins,
  scheduleConfig,
  tournamentRules,
  onUpdateScheduleConfig,
  onUpdateTournamentRules,
  onAutoReschedule,
  onOpenRoleModal,
  onSignInAdmin,
  onRegenerateCourtPin,
  onUpdateTie,
  onGenerateSerieAB,
  onCreateTeam,
  onAddTeamMember,
  onRemoveTeamMember,
  onLaunchReferee,
  onInspectTieH2H,
  onInspectTeamH2H,
  onInspectPlayerH2H,
}) => {
  const isVi = language === 'vi';
  const isOrganizer = roleSession.role === 'organizer';
  const isReferee = roleSession.role === 'referee';
  const canScore = isOrganizer || isReferee;

  const [subTab, setSubTab] = useState<TeamCupSubTab>('bracket_2d');
  const [selectedTieId, setSelectedTieId] = useState<string>(ties[0]?.id || '');
  const [stageFilter, setStageFilter] = useState<'all' | 'group' | 'serieA' | 'serieB'>('all');
  const [copiedPinCourt, setCopiedPinCourt] = useState<string | null>(null);
  const [tieForfeitOpenId, setTieForfeitOpenId] = useState<string | null>(null);
  const [tieForfeitPick, setTieForfeitPick] = useState<'A' | 'B' | null>(null);

  // Create Team form state
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newTeamGroup, setNewTeamGroup] = useState<GroupName>('Bảng A');
  const [newTeamCity, setNewTeamCity] = useState('TP.HCM');

  // Add Member form state
  const [targetTeamId, setTargetTeamId] = useState<string>(teams[0]?.id || '');
  const [memberName, setMemberName] = useState('');
  const [memberGender, setMemberGender] = useState<Gender>('male');
  const [memberTier, setMemberTier] = useState<SkillTier>('B');

  const activeGroups = useMemo(
    () => getActiveGroupNames(teams, ties, scheduleConfig.groupsCount || 4),
    [teams, ties, scheduleConfig.groupsCount]
  );

  const groupStandingsList = useMemo(
    () =>
      activeGroups.map((title) => ({
        title,
        rows: computeGroupStandings(teams, ties, title),
      })),
    [activeGroups, teams, ties]
  );

  const scheduleAudit = useMemo(() => auditScheduleConflicts(ties), [ties]);

  const courtNames = useMemo(() => {
    const count = Math.min(MAX_COURTS_COUNT, Math.max(2, scheduleConfig.courtsCount || 4));
    return Array.from({ length: count }, (_, i) => `Sân ${i + 1}`);
  }, [scheduleConfig.courtsCount]);

  const scheduleRows = useMemo(() => {
    const slotMap = new Map<number, { slot: number; time: string; byCourt: Record<string, TeamTie> }>();
    for (const ti of ties) {
      const slot = ti.scheduledSlot || 99;
      const time = ti.scheduledTime || '--:--';
      const existing = slotMap.get(slot) || { slot, time, byCourt: {} };
      if (ti.courtName) {
        existing.byCourt[ti.courtName] = ti;
      }
      if (existing.time === '--:--' && time !== '--:--') existing.time = time;
      slotMap.set(slot, existing);
    }
    return Array.from(slotMap.values()).sort((a, b) => a.slot - b.slot);
  }, [ties]);

  const refereeCourtQueue = useMemo(() => {
    if (!isReferee) return [];
    const targetCourt = roleSession.assignedCourt;
    const list =
      !targetCourt || targetCourt === 'all'
        ? ties
        : ties.filter((ti) => ti.courtName === targetCourt);
    const rankStatus = (s: TeamTie['status']) => (s === 'live' ? 0 : s === 'upcoming' ? 1 : 2);
    return [...list].sort((a, b) => {
      const diff = rankStatus(a.status) - rankStatus(b.status);
      if (diff !== 0) return diff;
      return (a.scheduledSlot || 99) - (b.scheduledSlot || 99);
    });
  }, [isReferee, roleSession.assignedCourt, ties]);

  const teamMap = useMemo(() => {
    const map = new Map<string, TeamEntry>();
    for (const tm of teams) map.set(tm.id, tm);
    return map;
  }, [teams]);

  const filteredTies = useMemo(() => {
    if (stageFilter === 'all') return ties;
    return ties.filter((ti) => ti.stage === stageFilter);
  }, [ties, stageFilter]);

  const activeTie = useMemo(
    () => ties.find((ti) => ti.id === selectedTieId) || ties[0] || null,
    [ties, selectedTieId]
  );

  const handleCopyCourtPin = async (courtName: string, pin: string) => {
    try {
      await navigator.clipboard.writeText(`${courtName} - PIN Trọng tài: ${pin}`);
      setCopiedPinCourt(courtName);
      window.setTimeout(() => setCopiedPinCourt(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const getMemberLabel = (team: TeamEntry | null, memberId: string) => {
    if (!team || !memberId) return '';
    const m = team.members.find((x) => x.id === memberId);
    if (!m) return '';
    return `${m.name} (${m.skillTier})`;
  };

  const handleAssignSubMatchPlayer = (
    tie: TeamTie,
    subMatchId: string,
    side: 'A' | 'B',
    slotIndex: 0 | 1,
    memberId: string
  ) => {
    const nextSubMatches = tie.subMatches.map((sm) => {
      if (sm.id !== subMatchId) return sm;
      const pair: [string, string] =
        side === 'A' ? [...sm.teamAPlayerIds] : [...sm.teamBPlayerIds];
      const otherSlot: 0 | 1 = slotIndex === 0 ? 1 : 0;
      // Block selecting the same player twice inside the same pair
      if (memberId && pair[otherSlot] === memberId) return sm;
      pair[slotIndex] = memberId;
      return side === 'A'
        ? { ...sm, teamAPlayerIds: pair }
        : { ...sm, teamBPlayerIds: pair };
    });

    onUpdateTie({ ...tie, subMatches: nextSubMatches });
  };

  const handleInitOrSwitchTieBreakMode = (tie: TeamTie, mode: TieBreakMode) => {
    const teamA = teamMap.get(tie.teamAId);
    const teamB = teamMap.get(tie.teamBId);
    const defaultA =
      mode === 'dreambreaker'
        ? (teamA?.members.slice(0, 4).map((m) => m.id) || ['', '', '', ''])
        : [teamA?.members[0]?.id || ''];
    const defaultB =
      mode === 'dreambreaker'
        ? (teamB?.members.slice(0, 4).map((m) => m.id) || ['', '', '', ''])
        : [teamB?.members[0]?.id || ''];

    while (mode === 'dreambreaker' && defaultA.length < 4) defaultA.push('');
    while (mode === 'dreambreaker' && defaultB.length < 4) defaultB.push('');

    onUpdateTie({
      ...tie,
      tieBreak: {
        mode,
        teamAPlayerIds: defaultA,
        teamBPlayerIds: defaultB,
        scoreA: tie.tieBreak?.scoreA || 0,
        scoreB: tie.tieBreak?.scoreB || 0,
        targetPoints: tournamentRules.knockoutTargetPoints,
        servingSide: tie.tieBreak?.servingSide || 'A',
        status: tie.tieBreak?.status === 'completed' ? 'completed' : 'upcoming',
        winnerSide: tie.tieBreak?.winnerSide || '',
        forfeitSide: tie.tieBreak?.forfeitSide || '',
      },
    });
  };

  const handleAssignTieBreakPlayer = (
    tie: TeamTie,
    side: 'A' | 'B',
    slotIdx: number,
    memberId: string
  ) => {
    const current = tie.tieBreak || {
      mode: 'singles_1v1' as TieBreakMode,
      teamAPlayerIds: [''],
      teamBPlayerIds: [''],
      scoreA: 0,
      scoreB: 0,
      targetPoints: tournamentRules.knockoutTargetPoints,
      servingSide: 'A' as const,
      status: 'upcoming' as const,
      winnerSide: '' as const,
      forfeitSide: '' as const,
    };
    const arr = side === 'A' ? [...current.teamAPlayerIds] : [...current.teamBPlayerIds];
    arr[slotIdx] = memberId;
    onUpdateTie({
      ...tie,
      tieBreak:
        side === 'A'
          ? { ...current, teamAPlayerIds: arr }
          : { ...current, teamBPlayerIds: arr },
    });
  };

  const handleApplyTieForfeit = (tie: TeamTie, forfeitSide: 'A' | 'B') => {
    const winnerSide: 'A' | 'B' = forfeitSide === 'A' ? 'B' : 'A';
    const nextSubs: TeamSubMatch[] = tie.subMatches.map((sm) => ({
      ...sm,
      scoreA: forfeitSide === 'A' ? 0 : 15,
      scoreB: forfeitSide === 'A' ? 15 : 0,
      status: 'completed',
      winnerSide,
      forfeitSide,
    }));
    onUpdateTie({
      ...tie,
      forfeitSide,
      subMatches: nextSubs,
      tieBreak: null,
      status: 'completed',
    });
    setTieForfeitOpenId(null);
    setTieForfeitPick(null);
  };

  const handleClearTieForfeit = (tie: TeamTie) => {
    const stagePts =
      tie.stage === 'group'
        ? tournamentRules.groupTargetPoints
        : tournamentRules.knockoutTargetPoints;
    const resetSubs: TeamSubMatch[] = tie.subMatches.map((sm) => ({
      ...sm,
      scoreA: 0,
      scoreB: 0,
      targetPoints: stagePts,
      status: 'upcoming',
      winnerSide: '',
      forfeitSide: '',
    }));
    onUpdateTie({
      ...tie,
      forfeitSide: '',
      subMatches: resetSubs,
      tieBreak: null,
      status: 'upcoming',
    });
  };

  const launchSubMatchReferee = (tie: TeamTie, sm: TeamSubMatch) => {
    const teamA = teamMap.get(tie.teamAId) || null;
    const teamB = teamMap.get(tie.teamBId) || null;
    const labelA = sm.teamAPlayerIds
      .map((id) => getMemberLabel(teamA, id))
      .filter(Boolean)
      .join(' / ');
    const labelB = sm.teamBPlayerIds
      .map((id) => getMemberLabel(teamB, id))
      .filter(Boolean)
      .join(' / ');

    const buildSlots = (team: TeamEntry | null, ids: [string, string], fallbackTeam: string) =>
      ids.map((id, idx) => {
        const m = team?.members.find((x) => x.id === id);
        return m
          ? { id: m.id, name: m.name, skillTier: m.skillTier }
          : { id: id || `${fallbackTeam}_${idx + 1}`, name: `${fallbackTeam} #${idx + 1}` };
      });

    const stageDefaultTarget =
      tie.stage === 'group'
        ? tournamentRules.groupTargetPoints
        : tournamentRules.knockoutTargetPoints;
    const lockedTarget =
      sm.status === 'upcoming' && sm.scoreA === 0 && sm.scoreB === 0
        ? stageDefaultTarget
        : sm.targetPoints || stageDefaultTarget;

    onLaunchReferee(
      {
        id: sm.id,
        title: `${isVi ? sm.labelVi : sm.labelEn} · ${tie.roundLabel}`,
        subtitle: `${tie.teamAName} vs ${tie.teamBName}`,
        teamAName: tie.teamAName,
        teamBName: tie.teamBName,
        teamAPlayersLabel: labelA || (isVi ? 'Chưa xếp cặp VĐV' : 'Lineup pending'),
        teamBPlayersLabel: labelB || (isVi ? 'Chưa xếp cặp VĐV' : 'Lineup pending'),
        teamAPlayers: buildSlots(teamA, sm.teamAPlayerIds, tie.teamAName),
        teamBPlayers: buildSlots(teamB, sm.teamBPlayerIds, tie.teamBName),
        teamARoster: teamA?.members || [],
        teamBRoster: teamB?.members || [],
        slotGenderRules: [
          getSlotGenderRequirement(sm.type, 0),
          getSlotGenderRequirement(sm.type, 1),
        ],
        isDoubles: true,
        initialScoreA: sm.scoreA,
        initialScoreB: sm.scoreB,
        initialTargetPoints: lockedTarget,
        initialServingSide: sm.servingSide || 'A',
        initialServerNumber: sm.serverNumber || 2,
        stageLabel: tie.stage === 'group' ? (isVi ? 'Vòng bảng' : 'Group') : 'Knockout',
        forfeitSide: sm.forfeitSide || '',
      },
      { kind: 'submatch', tieId: tie.id, subMatchId: sm.id }
    );
  };

  const launchTieBreakReferee = (tie: TeamTie) => {
    const tb = tie.tieBreak;
    if (!tb) return;
    const teamA = teamMap.get(tie.teamAId) || null;
    const teamB = teamMap.get(tie.teamBId) || null;
    const lineupA = tb.teamAPlayerIds.map((id) => getMemberLabel(teamA, id)).filter(Boolean);
    const lineupB = tb.teamBPlayerIds.map((id) => getMemberLabel(teamB, id)).filter(Boolean);

    const firstA = teamA?.members.find((m) => m.id === tb.teamAPlayerIds[0]);
    const firstB = teamB?.members.find((m) => m.id === tb.teamBPlayerIds[0]);
    const lockedTarget =
      tb.status === 'upcoming' && tb.scoreA === 0 && tb.scoreB === 0
        ? tournamentRules.knockoutTargetPoints
        : tb.targetPoints || tournamentRules.knockoutTargetPoints;

    onLaunchReferee(
      {
        id: `${tie.id}_tb`,
        title:
          tb.mode === 'dreambreaker'
            ? isVi
              ? `Trận 5 · Dreambreaker (Xoay tua 4 VĐV)`
              : `Match 5 · Dreambreaker (4-Player Rotation)`
            : isVi
              ? `Trận 5 · Đấu Đơn Quyết Định (1-1)`
              : `Match 5 · Deciding Singles (1v1)`,
        subtitle: `${tie.roundLabel} · ${tie.teamAName} vs ${tie.teamBName}`,
        teamAName: tie.teamAName,
        teamBName: tie.teamBName,
        teamAPlayersLabel: lineupA.join(' → ') || tie.teamAName,
        teamBPlayersLabel: lineupB.join(' → ') || tie.teamBName,
        teamAPlayers: firstA
          ? [{ id: firstA.id, name: firstA.name, skillTier: firstA.skillTier }]
          : [{ id: 'tb_a_0', name: tie.teamAName }],
        teamBPlayers: firstB
          ? [{ id: firstB.id, name: firstB.name, skillTier: firstB.skillTier }]
          : [{ id: 'tb_b_0', name: tie.teamBName }],
        teamARoster: teamA?.members || [],
        teamBRoster: teamB?.members || [],
        slotGenderRules: ['any', 'any'],
        isDoubles: false,
        isDreambreaker: tb.mode === 'dreambreaker',
        dreambreakerLineupA: lineupA,
        dreambreakerLineupB: lineupB,
        initialScoreA: tb.scoreA,
        initialScoreB: tb.scoreB,
        initialTargetPoints: lockedTarget,
        initialServingSide: tb.servingSide || 'A',
        initialServerNumber: 1,
        stageLabel: isVi ? 'Đấu đơn KO' : 'KO Singles',
        forfeitSide: tb.forfeitSide || '',
      },
      { kind: 'tiebreak', tieId: tie.id }
    );
  };

  const handleSubmitTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const code =
      newTeamCode.trim().toUpperCase().slice(0, 4) ||
      newTeamName
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 3);
    onCreateTeam({
      name: newTeamName.trim(),
      shortCode: code,
      groupName: newTeamGroup,
      city: newTeamCity.trim() || 'TP.HCM',
    });
    setNewTeamName('');
    setNewTeamCode('');
  };

  const handleSubmitMember = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedTeamId = targetTeamId || teams[0]?.id;
    if (!resolvedTeamId || !memberName.trim()) return;
    onAddTeamMember(resolvedTeamId, {
      name: memberName.trim(),
      gender: memberGender,
      skillTier: memberTier,
    });
    setMemberName('');
  };

  const renderTieEditorPanel = (tie: TeamTie | null) => {
    if (!tie) return null;
    const teamA = teamMap.get(tie.teamAId) || null;
    const teamB = teamMap.get(tie.teamBId) || null;
    const summary = computeTeamTieSummary(tie);

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
        {/* Tie Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <span>
                {tie.roundLabel}
                {tie.stage === 'group'
                  ? isVi
                    ? ' · Vòng bảng (Tính hòa 2-2)'
                    : ' · Group Stage (2-2 Draw Allowed)'
                  : isVi
                    ? ' · Loại trực tiếp (Hòa 2-2 đấu đơn)'
                    : ' · Knockout (2-2 → Singles Tie-break)'}
              </span>
              {tie.courtName && (
                <span className="font-mono text-[11px] normal-case tracking-normal px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {tie.courtName}
                  {tie.scheduledTime ? ` · ${tie.scheduledTime}` : ''}
                </span>
              )}
            </div>
            {onInspectTieH2H ? (
              <button
                type="button"
                onClick={() => onInspectTieH2H(tie)}
                className="text-left group mt-1"
                title={isVi ? 'Nhấn để xem lịch sử đối đầu H2H giữa hai đội' : 'Click to inspect Head-to-Head history'}
              >
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-accent transition-colors font-display">
                  {tie.teamAName} <span className="text-slate-400 font-normal">vs</span> {tie.teamBName}
                </h3>
              </button>
            ) : (
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1 font-display">
                {tie.teamAName} <span className="text-slate-400 font-normal">vs</span> {tie.teamBName}
              </h3>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onInspectTieH2H && (
              <button
                type="button"
                onClick={() => onInspectTieH2H(tie)}
                className="min-h-[38px] px-3 rounded-lg border border-orange-300/70 dark:border-orange-800/80 bg-accent-soft text-accent text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 whitespace-nowrap"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>{isVi ? 'Đối đầu H2H' : 'H2H History'}</span>
              </button>
            )}
            {canScore && !tie.forfeitSide && tieForfeitOpenId !== tie.id && (
              <button
                type="button"
                onClick={() => {
                  setTieForfeitOpenId(tie.id);
                  setTieForfeitPick(null);
                }}
                className="min-h-[38px] px-3 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/50"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{isVi ? 'Bỏ cuộc cả lượt (15-0 · 0đ)' : 'Tie Forfeit (15-0 · 0pt)'}</span>
              </button>
            )}

            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isVi ? 'Tỷ số Đồng đội' : 'Team Score'}
              </div>
              <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {summary.totalWinsA} - {summary.totalWinsB}
              </div>
            </div>
          </div>
        </div>

        {/* Inline Tie-Level Forfeit Confirmation Drawer */}
        {canScore && tieForfeitOpenId === tie.id && !tie.forfeitSide && (
          <div className="p-3.5 sm:p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {isVi
                      ? 'Xác nhận Xử Bỏ Cuộc cả lượt Đồng đội (4 trận đôi 15-0 · Đội bỏ cuộc nhận 0 điểm)'
                      : 'Confirm Full-Tie Forfeit (4 doubles 15-0 · Forfeiting team receives 0 pts)'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['A', 'B'] as const).map((side) => {
                const name = side === 'A' ? tie.teamAName : tie.teamBName;
                const active = tieForfeitPick === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setTieForfeitPick(side)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-left text-xs font-bold transition-colors ${
                      active
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {isVi
                      ? `${name} bỏ cuộc (Thua 0-4 · 0đ)`
                      : `${name} forfeits (0-4 · 0 pts)`}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTieForfeitOpenId(null);
                  setTieForfeitPick(null);
                }}
                className="min-h-[36px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!tieForfeitPick}
                onClick={() => tieForfeitPick && handleApplyTieForfeit(tie, tieForfeitPick)}
                className="min-h-[36px] px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {isVi ? 'Chốt Bỏ cuộc (15-0)' : 'Confirm Tie Forfeit'}
              </button>
            </div>
          </div>
        )}

        {/* Active Tie-Level Forfeit Banner */}
        {tie.forfeitSide && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/35 border border-rose-300 dark:border-rose-800 text-xs sm:text-sm text-rose-900 dark:text-rose-200 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold flex items-center gap-1.5">
              <Flag className="w-4 h-4 shrink-0" />
              <span>
                {isVi
                  ? `${tie.forfeitSide === 'A' ? tie.teamAName : tie.teamBName} bỏ cuộc cả lượt — Thua 0-4 (15-0 mỗi trận · 0 điểm BXH, đội thắng +3 điểm).`
                  : `${tie.forfeitSide === 'A' ? tie.teamAName : tie.teamBName} forfeited the tie — 0-4 loss (15-0 each · 0 standing pts, winner +3 pts).`}
              </span>
            </span>
            {isOrganizer && (
              <button
                type="button"
                onClick={() => handleClearTieForfeit(tie)}
                className="min-h-[34px] px-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100"
              >
                {isVi ? 'Hoàn tác bỏ cuộc' : 'Undo Forfeit'}
              </button>
            )}
          </div>
        )}

        {/* Group 2-2 Draw Notice */}
        {summary.isGroupDraw22 && (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {isVi
                ? 'Kết quả Vòng bảng: Hòa 2-2 (chỉ thi đấu 4 trận đôi) — Mỗi đội nhận +2 điểm xếp hạng (Thắng 3đ · Hòa 2đ · Thua 1đ · Bỏ cuộc 0đ).'
                : 'Group Stage Result: 2-2 Draw (4 doubles only) — Each team earns +2 standing points (Win 3 · Draw 2 · Loss 1 · Forfeit 0).'}
            </span>
          </div>
        )}

        {/* 4 Doubles Sub-Matches Grid with Strict Gender Filtering */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tie.subMatches.map((sm) => {
            const req0 = getSlotGenderRequirement(sm.type, 0);
            const req1 = getSlotGenderRequirement(sm.type, 1);

            const teamAOptions0 = (teamA?.members || []).filter((m) => m.gender === req0);
            const teamAOptions1 = (teamA?.members || []).filter((m) => m.gender === req1);
            const teamBOptions0 = (teamB?.members || []).filter((m) => m.gender === req0);
            const teamBOptions1 = (teamB?.members || []).filter((m) => m.gender === req1);

            const genderRuleHint =
              sm.type === 'womens_doubles'
                ? isVi
                  ? 'Chỉ hiển thị VĐV Nữ'
                  : 'Female players only'
                : sm.type === 'mens_doubles'
                  ? isVi
                    ? 'Chỉ hiển thị VĐV Nam'
                    : 'Male players only'
                  : isVi
                    ? 'Ô 1: Chỉ Nam · Ô 2: Chỉ Nữ'
                    : 'Slot 1: Male · Slot 2: Female';

            return (
              <div
                key={sm.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {isVi ? sm.labelVi : sm.labelEn}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {genderRuleHint}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {sm.scoreA} - {sm.scoreB}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {sm.forfeitSide ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {isVi
                            ? `Bỏ cuộc 15-0 (${sm.forfeitSide === 'A' ? teamA?.shortCode || 'A' : teamB?.shortCode || 'B'})`
                            : `Forfeit 15-0 (${sm.forfeitSide})`}
                        </span>
                      ) : sm.status === 'completed'
                        ? sm.winnerSide === 'A'
                          ? `${isVi ? 'Thắng:' : 'Win:'} ${teamA?.shortCode || 'A'}`
                          : `${isVi ? 'Thắng:' : 'Win:'} ${teamB?.shortCode || 'B'}`
                        : sm.status === 'live'
                          ? isVi
                            ? 'Đang đấu'
                            : 'Live'
                          : isVi
                            ? `Chạm ${tie.stage === 'group' ? tournamentRules.groupTargetPoints : tournamentRules.knockoutTargetPoints}đ`
                            : `To ${tie.stage === 'group' ? tournamentRules.groupTargetPoints : tournamentRules.knockoutTargetPoints}`}
                    </div>
                  </div>
                </div>

                {/* Team A Lineup Selectors */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {tie.teamAName}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      aria-label={`${sm.labelVi} Team A Slot 1`}
                      value={sm.teamAPlayerIds[0]}
                      onChange={(e) =>
                        handleAssignSubMatchPlayer(tie, sm.id, 'A', 0, e.target.value)
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">
                        {req0 === 'female'
                          ? isVi
                            ? '-- Chọn VĐV Nữ 1 --'
                            : '-- Select Female 1 --'
                          : isVi
                            ? '-- Chọn VĐV Nam 1 --'
                            : '-- Select Male 1 --'}
                      </option>
                      {teamAOptions0.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={sm.teamAPlayerIds[1] === m.id}
                        >
                          {m.name} · {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label={`${sm.labelVi} Team A Slot 2`}
                      value={sm.teamAPlayerIds[1]}
                      onChange={(e) =>
                        handleAssignSubMatchPlayer(tie, sm.id, 'A', 1, e.target.value)
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">
                        {req1 === 'female'
                          ? isVi
                            ? '-- Chọn VĐV Nữ 2 --'
                            : '-- Select Female 2 --'
                          : isVi
                            ? '-- Chọn VĐV Nam 2 --'
                            : '-- Select Male 2 --'}
                      </option>
                      {teamAOptions1.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={sm.teamAPlayerIds[0] === m.id}
                        >
                          {m.name} · {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Team B Lineup Selectors */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                    {tie.teamBName}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      aria-label={`${sm.labelVi} Team B Slot 1`}
                      value={sm.teamBPlayerIds[0]}
                      onChange={(e) =>
                        handleAssignSubMatchPlayer(tie, sm.id, 'B', 0, e.target.value)
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">
                        {req0 === 'female'
                          ? isVi
                            ? '-- Chọn VĐV Nữ 1 --'
                            : '-- Select Female 1 --'
                          : isVi
                            ? '-- Chọn VĐV Nam 1 --'
                            : '-- Select Male 1 --'}
                      </option>
                      {teamBOptions0.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={sm.teamBPlayerIds[1] === m.id}
                        >
                          {m.name} · {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label={`${sm.labelVi} Team B Slot 2`}
                      value={sm.teamBPlayerIds[1]}
                      onChange={(e) =>
                        handleAssignSubMatchPlayer(tie, sm.id, 'B', 1, e.target.value)
                      }
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="">
                        {req1 === 'female'
                          ? isVi
                            ? '-- Chọn VĐV Nữ 2 --'
                            : '-- Select Female 2 --'
                          : isVi
                            ? '-- Chọn VĐV Nam 2 --'
                            : '-- Select Male 2 --'}
                      </option>
                      {teamBOptions1.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={sm.teamBPlayerIds[0] === m.id}
                        >
                          {m.name} · {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Launch Referee App Button */}
                <div className="pt-1 flex justify-end">
                  {canScore ? (
                    <button
                      type="button"
                      onClick={() => launchSubMatchReferee(tie, sm)}
                      className="min-h-[40px] px-3.5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Mở App Trọng tài 2D' : 'Open 2D Referee App'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenRoleModal}
                      className="min-h-[38px] px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-accent inline-flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{isVi ? 'Đăng nhập Trọng tài để chấm' : 'Referee Login to Score'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Knockout Match 5: Singles Tie-Breaker when 2-2 */}
        {tie.stage !== 'group' &&
          (summary.needsKnockoutTieBreak || summary.decidedByTieBreak || tie.tieBreak) && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Swords className="w-4 h-4" />
                    <span>
                      {isVi
                        ? 'TRẬN 5 · ĐẤU ĐƠN QUYẾT ĐỊNH (HÒA 2-2)'
                        : 'MATCH 5 · SINGLES TIE-BREAKER (TIED 2-2)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {isVi
                      ? 'BTC chọn 1 trong 2 thể thức đấu đơn quyết định cho vòng loại trực tiếp.'
                      : 'Organizer chooses between 1v1 Deciding Singles or 4-player Dreambreaker.'}
                  </p>
                </div>

                {/* Dual-Mode Switcher */}
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => handleInitOrSwitchTieBreakMode(tie, 'singles_1v1')}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${
                      tie.tieBreak?.mode === 'singles_1v1'
                        ? 'bg-accent-soft text-accent'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isVi ? 'Đấu đơn 1-1' : '1v1 Singles'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitOrSwitchTieBreakMode(tie, 'dreambreaker')}
                    className={`px-3 py-2 text-xs font-semibold border-l border-slate-200 dark:border-slate-700 transition-colors ${
                      tie.tieBreak?.mode === 'dreambreaker'
                        ? 'bg-accent-soft text-accent'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isVi ? 'Dreambreaker (4 VĐV)' : 'Dreambreaker (4 Players)'}
                  </button>
                </div>
              </div>

              {!tie.tieBreak ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleInitOrSwitchTieBreakMode(tie, 'singles_1v1')}
                    className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent"
                  >
                    {isVi ? 'Kích hoạt Đấu đơn 1-1' : 'Start 1v1 Singles'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInitOrSwitchTieBreakMode(tie, 'dreambreaker')}
                    className="min-h-[42px] px-4 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    {isVi ? 'Kích hoạt Dreambreaker xoay tua 4 VĐV' : 'Start 4-Player Dreambreaker'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team A Tie-break Lineup */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {tie.teamAName}
                      </div>
                      {(tie.tieBreak.mode === 'dreambreaker' ? [0, 1, 2, 3] : [0]).map((slotIdx) => (
                        <select
                          key={`tbA_${slotIdx}`}
                          value={tie.tieBreak?.teamAPlayerIds[slotIdx] || ''}
                          onChange={(e) =>
                            handleAssignTieBreakPlayer(tie, 'A', slotIdx, e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value="">
                            {tie.tieBreak?.mode === 'dreambreaker'
                              ? isVi
                                ? `-- Lượt #${slotIdx + 1} (Đội A) --`
                                : `-- Slot #${slotIdx + 1} (Team A) --`
                              : isVi
                                ? '-- Chọn đại diện đấu đơn Đội A --'
                                : '-- Select Singles Player A --'}
                          </option>
                          {(teamA?.members || []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.gender === 'male' ? (isVi ? 'Nam' : 'M') : isVi ? 'Nữ' : 'F'} ·{' '}
                              {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>

                    {/* Team B Tie-break Lineup */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {tie.teamBName}
                      </div>
                      {(tie.tieBreak.mode === 'dreambreaker' ? [0, 1, 2, 3] : [0]).map((slotIdx) => (
                        <select
                          key={`tbB_${slotIdx}`}
                          value={tie.tieBreak?.teamBPlayerIds[slotIdx] || ''}
                          onChange={(e) =>
                            handleAssignTieBreakPlayer(tie, 'B', slotIdx, e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        >
                          <option value="">
                            {tie.tieBreak?.mode === 'dreambreaker'
                              ? isVi
                                ? `-- Lượt #${slotIdx + 1} (Đội B) --`
                                : `-- Slot #${slotIdx + 1} (Team B) --`
                              : isVi
                                ? '-- Chọn đại diện đấu đơn Đội B --'
                                : '-- Select Singles Player B --'}
                          </option>
                          {(teamB?.members || []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.gender === 'male' ? (isVi ? 'Nam' : 'M') : isVi ? 'Nữ' : 'F'} ·{' '}
                              {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200 dark:border-amber-900/60">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {isVi ? 'Tỷ số Trận 5:' : 'Match 5 Score:'}
                      </span>
                      <span className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {tie.tieBreak.scoreA} - {tie.tieBreak.scoreB}
                      </span>
                      {tie.tieBreak.mode === 'dreambreaker' && (
                        <span className="text-xs text-amber-800 dark:text-amber-300 inline-flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Xoay tua mỗi 4 điểm' : 'Rotates every 4 pts'}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => launchTieBreakReferee(tie)}
                      className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isVi ? 'Mở App Trọng tài Tie-break' : 'Launch Tie-break Referee'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Focused Referee Workspace Strip when signed in with Court PIN */}
      {isReferee && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {isVi ? 'Chế độ Trọng tài Sân đang kích hoạt' : 'Court Referee Mode Active'}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {roleSession.refereeName || (isVi ? 'Trọng tài Sân' : 'Court Referee')} ·{' '}
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {roleSession.assignedCourt === 'all'
                      ? isVi
                        ? 'Tất cả sân'
                        : 'All Courts'
                      : roleSession.assignedCourt || 'Sân 1'}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenRoleModal}
              className="min-h-[38px] px-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500"
            >
              {isVi ? 'Đổi sân / Đăng xuất' : 'Switch Court / Sign Out'}
            </button>
          </div>

          {refereeCourtQueue.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {refereeCourtQueue.slice(0, 6).map((tie) => {
                const s = computeTeamTieSummary(tie);
                const nextSub =
                  tie.subMatches.find((sm) => sm.status === 'live') ||
                  tie.subMatches.find((sm) => sm.status === 'upcoming') ||
                  tie.subMatches[0];
                return (
                  <div
                    key={`ref_q_${tie.id}`}
                    className="rounded-xl border border-emerald-200 dark:border-emerald-900/70 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {tie.courtName} · {tie.scheduledTime || '--:--'}
                        </span>
                        <span className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                          {tie.roundLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tie.teamAName} vs {tie.teamBName}
                        </div>
                        <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                          {s.totalWinsA}-{s.totalWinsB}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTieId(tie.id);
                          setSubTab('group_lineup');
                        }}
                        className="flex-1 min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                      >
                        {isVi ? 'Xem 4 trận đôi' : '4 Sub-matches'}
                      </button>
                      {nextSub && (
                        <button
                          type="button"
                          onClick={() => launchSubMatchReferee(tie, nextSub)}
                          className="flex-1 min-h-[36px] px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{isVi ? 'Chấm 2D ngay' : 'Score 2D'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Header & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {isVi
              ? 'Sơ đồ 2D Từ Vòng Bảng · Tự Chia Serie A/B · Xếp Lịch Chống Trùng Sân'
              : 'Continuous 2D Bracket · Auto Serie A/B · Conflict-Free Multi-Court Scheduler'}
          </p>
          <h1 className="text-[clamp(1.375rem,4.5vw,1.875rem)] font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 font-display leading-tight">
            {isVi ? 'Giải Đồng đội, Sơ đồ 2D & Điều phối Sân' : 'Team Cup, 2D Bracket & Court Dispatch'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isVi
              ? 'Tự động chia nhánh Serie A/B khi xong Vòng bảng · Lịch 2 sân luân phiên 0 xung đột trùng đội.'
              : 'Auto-seeds Serie A/B when Group Stage completes · Zero-conflict alternating 2-court schedule.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenRoleModal}
            className="min-h-[42px] px-3.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-accent inline-flex items-center gap-1.5"
          >
            <KeyRound className="w-4 h-4 text-accent" />
            <span>{isVi ? 'Tài khoản BTC / Trọng tài' : 'BTC / Referee Login'}</span>
          </button>

          {isOrganizer && (
            <button
              type="button"
              onClick={onGenerateSerieAB}
              className="min-h-[42px] px-3.5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
            >
              <GitBranch className="w-4 h-4" />
              <span>{isVi ? 'Chia Serie A/B & Xếp Lịch' : 'Seed A/B & Schedule'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => exportTeamCupToExcel({ teams, ties, language })}
            className="min-h-[42px] px-3.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>{isVi ? 'Xuất Excel (.xlsx)' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto touch-scroll-x no-scrollbar">
        {(
          [
            {
              id: 'bracket_2d',
              label: isVi ? 'Sơ đồ 2D (Vòng bảng → Serie A/B)' : '2D Bracket (Groups → A/B)',
              icon: GitBranch,
            },
            {
              id: 'schedule',
              label: isVi
                ? `Lịch ${scheduleConfig.courtsCount} Sân (Chống trùng đội)`
                : `${scheduleConfig.courtsCount}-Court Schedule`,
              icon: CalendarClock,
            },
            {
              id: 'group_lineup',
              label: isVi ? 'BXH Bảng & Xếp 4 Nội dung' : 'Standings & 4-Event Lineups',
              icon: Trophy,
            },
            {
              id: 'rosters',
              label: isVi ? 'Đội & VĐV (Trình A/B/C)' : 'Teams & Rosters (A/B/C)',
              icon: Users,
            },
          ] as { id: TeamCupSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 sm:gap-2 ${
                active
                  ? 'border-[var(--accent-primary)] text-accent'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: CONFLICT-FREE MULTI-COURT SCHEDULE BOARD */}
      {subTab === 'schedule' && (
        <div className="space-y-5">
          {/* Live Schedule Conflict Verification Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              className={`rounded-xl border p-3.5 flex items-center gap-3 ${
                scheduleAudit.conflictCount === 0
                  ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/60 dark:bg-emerald-950/20'
                  : 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30'
              }`}
            >
              {scheduleAudit.conflictCount === 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                  {scheduleAudit.conflictCount === 0
                    ? isVi
                      ? '0 xung đột trùng đội'
                      : '0 Team Conflicts'
                    : `${scheduleAudit.conflictCount} ${isVi ? 'xung đột' : 'conflicts'}`}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">
                  {isVi
                    ? 'Không có đội nào đánh 2 sân cùng khung giờ'
                    : 'No team ever plays on 2 courts simultaneously'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {scheduleAudit.totalSlots} {isVi ? 'khung giờ' : 'slots'} ·{' '}
                {courtNames.length <= 4
                  ? courtNames.join(' · ')
                  : `${courtNames.length} ${isVi ? 'sân' : 'courts'} (Sân 1–${courtNames.length})`}{' '}
                · {activeGroups.length} {isVi ? 'bảng' : 'groups'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isVi
                  ? `Bắt đầu ${scheduleConfig.startTime} · Mỗi khung ${scheduleConfig.slotMinutes} phút (luân phiên nghỉ)`
                  : `Starts ${scheduleConfig.startTime} · ${scheduleConfig.slotMinutes}m slots (rest alternating)`}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {isVi ? 'Vòng bảng:' : 'Group Stage:'} {scheduleAudit.groupCompletedCount}/
                {scheduleAudit.groupTotalCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {scheduleAudit.allGroupMatchesCompleted
                  ? isVi
                    ? 'Đã chốt nhánh Serie A & Serie B tự động'
                    : 'Serie A & B automatically locked from standings'
                  : isVi
                    ? 'Tự động cập nhật nhánh Serie A/B ngay khi xong vòng bảng'
                    : 'Auto-seeds Serie A/B immediately upon group completion'}
              </div>
            </div>
          </div>

          {/* Organizer-Only Schedule & Court PIN Control Bar */}
          {isOrganizer && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {isVi ? `Số sân thi đấu (tối đa ${MAX_COURTS_COUNT} sân)` : `Active Courts (up to ${MAX_COURTS_COUNT})`}
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {COURT_COUNT_PRESETS.map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() =>
                              onUpdateScheduleConfig({ ...scheduleConfig, courtsCount: cnt })
                            }
                            className={`min-h-[38px] px-2.5 text-xs font-bold font-mono tabular-nums transition-colors ${
                              scheduleConfig.courtsCount === cnt
                                ? 'bg-accent-soft text-accent'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                      <select
                        aria-label={isVi ? 'Chọn số sân tùy chỉnh' : 'Custom courts count'}
                        value={scheduleConfig.courtsCount}
                        onChange={(e) =>
                          onUpdateScheduleConfig({
                            ...scheduleConfig,
                            courtsCount: Number(e.target.value),
                          })
                        }
                        className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white"
                      >
                        {Array.from({ length: MAX_COURTS_COUNT - 1 }, (_, i) => i + 2).map((cnt) => (
                          <option key={cnt} value={cnt}>
                            {cnt} {isVi ? 'sân' : 'courts'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {isVi ? 'Số bảng đấu (Bảng A–H)' : 'Group Pools (A–H)'}
                    </label>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {GROUP_COUNT_PRESETS.map((grpCnt) => {
                        const lastLetter = ALL_GROUP_NAMES[grpCnt - 1]?.replace('Bảng ', '') || 'D';
                        const isActive = (scheduleConfig.groupsCount || 4) === grpCnt;
                        return (
                          <button
                            key={grpCnt}
                            type="button"
                            onClick={() =>
                              onUpdateScheduleConfig({ ...scheduleConfig, groupsCount: grpCnt })
                            }
                            className={`min-h-[38px] px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                              isActive
                                ? 'bg-accent-soft text-accent'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {grpCnt} {isVi ? 'bảng' : 'grps'} (A–{lastLetter})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {isVi ? 'Giờ bắt đầu' : 'Start Time'}
                    </label>
                    <input
                      type="time"
                      value={scheduleConfig.startTime}
                      onChange={(e) =>
                        onUpdateScheduleConfig({
                          ...scheduleConfig,
                          startTime: e.target.value || '08:00',
                        })
                      }
                      className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      {isVi ? 'Thời lượng / lượt' : 'Slot Duration'}
                    </label>
                    <select
                      value={scheduleConfig.slotMinutes}
                      onChange={(e) =>
                        onUpdateScheduleConfig({
                          ...scheduleConfig,
                          slotMinutes: Number(e.target.value),
                        })
                      }
                      className="min-h-[38px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-xs font-bold text-slate-900 dark:text-white"
                    >
                      <option value={25}>25 {isVi ? 'phút' : 'min'}</option>
                      <option value={30}>30 {isVi ? 'phút' : 'min'}</option>
                      <option value={40}>40 {isVi ? 'phút' : 'min'}</option>
                      <option value={45}>45 {isVi ? 'phút' : 'min'}</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onAutoReschedule}
                  className="min-h-[40px] px-3.5 rounded-lg btn-accent text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Tự xếp lịch tối ưu lại' : 'Re-run Optimal Schedule'}</span>
                </button>
              </div>

              {/* Admin / BTC Default Target Points Configuration (Locked for Referees during play) */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
                    <Settings2 className="w-3.5 h-3.5 text-accent" />
                    <span>
                      {isVi
                        ? 'Cài đặt điểm kết thúc mặc định cho cả giải (Admin / BTC)'
                        : 'Tournament Default Target Points (Admin / BTC)'}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>
                      {isVi
                        ? 'Khóa chọn 11/15/21 trong App Trọng tài khi đang thi đấu'
                        : 'Locked inside Referee App during matches'}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {isVi ? 'Vòng bảng (4 trận đôi)' : 'Group Stage (4 Doubles)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isVi
                          ? `Đổi sân tự động ở điểm ${tournamentRules.groupTargetPoints === 11 ? 6 : tournamentRules.groupTargetPoints === 15 ? 8 : 11}`
                          : `Auto court switch @ ${tournamentRules.groupTargetPoints === 11 ? 6 : tournamentRules.groupTargetPoints === 15 ? 8 : 11}`}
                      </div>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                      {([11, 15, 21] as TargetPointsOption[]).map((pts) => (
                        <button
                          key={`grp_${pts}`}
                          type="button"
                          onClick={() =>
                            onUpdateTournamentRules({
                              ...tournamentRules,
                              groupTargetPoints: pts,
                            })
                          }
                          className={`min-h-[36px] px-3 font-mono text-xs font-bold transition-colors ${
                            tournamentRules.groupTargetPoints === pts
                              ? 'bg-accent-soft text-accent'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {pts}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {isVi ? 'Vòng loại trực tiếp & Đấu đơn' : 'Knockout (Serie A/B & Singles)'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isVi
                          ? `Đổi sân tự động ở điểm ${tournamentRules.knockoutTargetPoints === 11 ? 6 : tournamentRules.knockoutTargetPoints === 15 ? 8 : 11}`
                          : `Auto court switch @ ${tournamentRules.knockoutTargetPoints === 11 ? 6 : tournamentRules.knockoutTargetPoints === 15 ? 8 : 11}`}
                      </div>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                      {([11, 15, 21] as TargetPointsOption[]).map((pts) => (
                        <button
                          key={`ko_${pts}`}
                          type="button"
                          onClick={() =>
                            onUpdateTournamentRules({
                              ...tournamentRules,
                              knockoutTargetPoints: pts,
                            })
                          }
                          className={`min-h-[36px] px-3 font-mono text-xs font-bold transition-colors ${
                            tournamentRules.knockoutTargetPoints === pts
                              ? 'bg-accent-soft text-accent'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {pts}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Court PINs Strip for BTC to share with Referees */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 mr-1">
                  <KeyRound className="w-3.5 h-3.5 text-accent" />
                  <span>{isVi ? 'PIN Trọng tài sân:' : 'Court Referee PINs:'}</span>
                </span>
                {courtPins.map((cp) => (
                  <div
                    key={cp.courtName}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {cp.courtName}:
                    </span>
                    <span className="font-mono font-extrabold text-accent tabular-nums">
                      {cp.pin}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCourtPin(cp.courtName, cp.pin)}
                      title={isVi ? 'Sao chép PIN' : 'Copy PIN'}
                      className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      {copiedPinCourt === cp.courtName ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRegenerateCourtPin(cp.courtName)}
                      title={isVi ? 'Đổi mã PIN mới' : 'Reset PIN'}
                      className="p-1 text-slate-500 hover:text-accent"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Court Timeline Table (Sticky Time Slot Column on Mobile) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto touch-scroll-x">
              <table className="w-full min-w-[600px] text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 sticky-col-edge py-3 pl-3.5 pr-3 font-bold whitespace-nowrap w-[108px]">
                      {isVi ? 'Khung giờ' : 'Time Slot'}
                    </th>
                    {courtNames.map((cn) => (
                      <th key={cn} className="py-3 px-3.5 font-bold whitespace-nowrap">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-900 dark:text-white">{cn}</span>
                          {isReferee && roleSession.assignedCourt === cn && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              {isVi ? 'Sân của bạn' : 'Your Court'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {scheduleRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={courtNames.length + 1}
                        className="py-10 px-4 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400"
                      >
                        {isVi
                          ? 'Chưa có lượt đấu Đồng đội nào. Hãy tạo đội ở tab "Đội & VĐV" rồi nhấn "Chia Serie A/B & Xếp Lịch".'
                          : 'No Team Cup ties scheduled yet. Register teams in "Teams & Rosters" and click "Seed A/B & Schedule".'}
                      </td>
                    </tr>
                  ) : null}
                  {scheduleRows.map((row) => (
                    <tr key={`slot_${row.slot}`}>
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 sticky-col-edge py-3 pl-3.5 pr-3 align-top">
                        <div className="font-mono text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {row.time}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {isVi ? `Ca #${row.slot}` : `Slot #${row.slot}`}
                        </div>
                      </td>
                      {courtNames.map((cn) => {
                        const tie = row.byCourt[cn];
                        if (!tie) {
                          return (
                            <td
                              key={`${row.slot}_${cn}`}
                              className="py-3 px-3.5 align-top text-xs text-slate-400 dark:text-slate-600 italic"
                            >
                              {isVi ? 'Sân trống / Chờ lượt' : 'Open / Rest Buffer'}
                            </td>
                          );
                        }
                        const s = computeTeamTieSummary(tie);
                        const isSelected = activeTie?.id === tie.id;
                        const nextSub =
                          tie.subMatches.find((sm) => sm.status === 'live') ||
                          tie.subMatches.find((sm) => sm.status === 'upcoming') ||
                          tie.subMatches[0];

                        return (
                          <td key={`${row.slot}_${cn}`} className="py-2.5 px-3 align-top">
                            <div
                              onClick={() => setSelectedTieId(tie.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') setSelectedTieId(tie.id);
                              }}
                              className={`rounded-xl border p-3 cursor-pointer transition-colors space-y-2 ${
                                isSelected
                                  ? 'border-accent bg-accent-soft/40 dark:bg-slate-800/90'
                                  : tie.stage === 'serieA'
                                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/15 hover:border-emerald-400'
                                    : tie.stage === 'serieB'
                                      ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/15 hover:border-amber-400'
                                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span
                                  className={`font-bold truncate ${
                                    tie.stage === 'serieA'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : tie.stage === 'serieB'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {tie.roundLabel}
                                </span>
                                <span
                                  className={`font-semibold shrink-0 ${
                                    tie.status === 'live'
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : tie.status === 'completed'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {tie.status === 'live'
                                    ? isVi
                                      ? 'Đang đấu'
                                      : 'Live'
                                    : tie.status === 'completed'
                                      ? isVi
                                        ? 'Xong'
                                        : 'Done'
                                      : isVi
                                        ? 'Sắp đấu'
                                        : 'Next'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                  <div>{tie.teamAName}</div>
                                  <div className="text-slate-500 dark:text-slate-400 font-medium">
                                    vs {tie.teamBName}
                                  </div>
                                </div>
                                <div className="font-mono text-lg font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                                  {s.totalWinsA}-{s.totalWinsB}
                                </div>
                              </div>

                              {(onInspectTieH2H || (canScore && nextSub)) && (
                                <div className="pt-1 flex items-center justify-between gap-2">
                                  {onInspectTieH2H ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onInspectTieH2H(tie);
                                      }}
                                      className="min-h-[30px] px-2 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent-soft inline-flex items-center gap-1"
                                    >
                                      <Swords className="w-3 h-3" />
                                      <span>H2H</span>
                                    </button>
                                  ) : (
                                    <span />
                                  )}
                                  {canScore && nextSub && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTieId(tie.id);
                                        launchSubMatchReferee(tie, nextSub);
                                      }}
                                      className="min-h-[32px] px-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold inline-flex items-center gap-1 hover:opacity-90"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>{isVi ? 'Chấm 2D' : 'Score 2D'}</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Tie Editor below Schedule for quick lineup edits */}
          {renderTieEditorPanel(activeTie)}
        </div>
      )}

      {/* TAB 1: GROUP STANDINGS & 4-EVENT LINEUP BUILDER */}
      {subTab === 'group_lineup' && (
        <div className="space-y-6">
          {/* Dynamic Group Standings (Bảng A .. Bảng H) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {groupStandingsList.map((grp) => (
              <div
                key={grp.title}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="px-3.5 sm:px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                      {grp.title}
                    </h2>
                    <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-mono truncate">
                      {isVi
                        ? 'Thắng 3đ · Hòa 2đ · Thua 1đ · Bỏ cuộc 0đ'
                        : 'Win 3 · Draw 2 · Loss 1 · Forfeit 0'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {isVi
                      ? `Ưu tiên bằng điểm: Đối kháng → Hiệu số trận đôi → Hiệu số điểm (+/-) · Vòng bảng chạm ${tournamentRules.groupTargetPoints}đ`
                      : `Tie-break: Head-to-Head → Doubles Diff → Point +/- · Group plays to ${tournamentRules.groupTargetPoints}`}
                  </div>
                </div>
                <div className="overflow-x-auto touch-scroll-x">
                  <table className="w-full min-w-[520px] text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 sticky-col-edge py-2.5 pl-3.5 pr-3 font-semibold whitespace-nowrap min-w-[155px]">
                          # · {isVi ? 'Đội tuyển' : 'Team'}
                        </th>
                        <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap">{isVi ? 'T-H-B' : 'W-D-L'}</th>
                        <th className="py-2.5 px-2 font-semibold text-center whitespace-nowrap">{isVi ? 'Trận đôi' : 'Sub'}</th>
                        <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">+/-</th>
                        <th className="py-2.5 px-2 font-semibold text-right whitespace-nowrap">{isVi ? 'Điểm' : 'Pts'}</th>
                        <th className="py-2.5 pl-2 pr-3.5 font-semibold text-right whitespace-nowrap">{isVi ? 'Nhánh' : 'Split'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {grp.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 px-4 text-center text-xs text-slate-400 dark:text-slate-500"
                          >
                            {isVi
                              ? `Chưa có đội nào trong ${grp.title}. Thêm đội ở tab "Đội & VĐV".`
                              : `No teams in ${grp.title} yet. Add teams in "Teams & Rosters".`}
                          </td>
                        </tr>
                      )}
                      {grp.rows.map((row) => (
                        <tr key={row.teamId} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 sticky-col-edge py-3 pl-3.5 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums w-4 shrink-0">
                                {row.rank}
                              </span>
                              {onInspectTeamH2H ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tm = teamMap.get(row.teamId);
                                    if (tm) onInspectTeamH2H(tm);
                                  }}
                                  className="font-semibold text-slate-900 dark:text-white hover:text-accent transition-colors truncate max-w-[135px] sm:max-w-[190px] text-left"
                                  title={isVi ? 'Nhấn xem lịch sử đối đầu H2H của đội' : 'View team Head-to-Head history'}
                                >
                                  {row.teamName}
                                </button>
                              ) : (
                                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[135px] sm:max-w-[190px]">
                                  {row.teamName}
                                </span>
                              )}
                              <span className="text-slate-400 font-mono font-normal hidden sm:inline">
                                ({row.shortCode})
                              </span>
                              {row.forfeits > 0 && (
                                <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                                  BC:{row.forfeits}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row.wins}-{row.draws}-{row.losses}
                          </td>
                          <td className="py-3 px-2 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {row.subWins}-{row.subLosses}
                          </td>
                          <td
                            className={`py-3 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                              row.pointDiff > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : row.pointDiff < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </td>
                          <td className="py-3 px-2 text-right font-mono font-extrabold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            {row.points}
                          </td>
                          <td className="py-3 pl-2 pr-3.5 text-right font-semibold whitespace-nowrap">
                            <span
                              className={
                                row.qualifiedSerie === 'Serie A'
                                  ? 'text-accent'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              → {row.qualifiedSerie}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {/* Match / Tie Selector Strip */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                {isVi ? 'Chọn lượt đấu để xếp 4 nội dung & chấm điểm' : 'Select Tie for 4-Event Lineups & Scoring'}
              </h2>
              <div className="flex items-center gap-1 overflow-x-auto touch-scroll-x no-scrollbar max-w-full">
                {(
                  [
                    { id: 'all', label: isVi ? 'Tất cả' : 'All' },
                    { id: 'group', label: isVi ? 'Vòng bảng' : 'Group' },
                    { id: 'serieA', label: 'Serie A' },
                    { id: 'serieB', label: 'Serie B' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStageFilter(f.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      stageFilter === f.id
                        ? 'bg-accent-soft text-accent'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {isVi
                    ? 'Chưa có lượt đấu Đồng đội nào. Tạo đội ở mục "Đội & VĐV" rồi nhấn "Chia Serie A/B & Xếp Lịch" để khởi tạo lịch thi đấu.'
                    : 'No Team Cup ties yet. Add teams in "Teams & Rosters" and click "Seed A/B & Schedule".'}
                </p>
                <button
                  type="button"
                  onClick={() => setSubTab('rosters')}
                  className="min-h-[40px] px-4 rounded-lg text-xs font-semibold btn-accent"
                >
                  {isVi ? 'Tạo đội Đồng đội mới' : 'Register Teams'}
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTies.map((tie) => {
                const s = computeTeamTieSummary(tie);
                const selected = activeTie?.id === tie.id;
                return (
                  <div
                    key={tie.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTieId(tie.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTieId(tie.id);
                      }
                    }}
                    className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                      selected
                        ? 'border-accent bg-accent-soft/50 dark:bg-slate-800/90'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {tie.roundLabel}
                        {tie.courtName ? ` · ${tie.courtName}` : ''}
                        {tie.scheduledTime ? ` (${tie.scheduledTime})` : ''}
                      </span>
                      <span
                        className={`font-semibold shrink-0 ${
                          tie.forfeitSide
                            ? 'text-rose-600 dark:text-rose-400'
                            : s.needsKnockoutTieBreak
                              ? 'text-amber-600 dark:text-amber-400'
                              : s.isGroupDraw22
                                ? 'text-slate-600 dark:text-slate-300'
                                : tie.status === 'live'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {tie.forfeitSide
                          ? isVi
                            ? 'Bỏ cuộc 15-0'
                            : 'Forfeit 15-0'
                          : s.needsKnockoutTieBreak
                            ? isVi
                              ? 'Hòa 2-2 · Đấu đơn'
                              : '2-2 · Singles'
                            : s.isGroupDraw22
                              ? isVi
                                ? 'Hòa 2-2 (+2đ)'
                                : 'Draw 2-2 (+2pt)'
                              : tie.status === 'live'
                                ? isVi
                                  ? 'Đang đấu'
                                  : 'Live'
                                : tie.status === 'completed'
                                  ? isVi
                                    ? 'Hoàn thành'
                                    : 'Done'
                                  : isVi
                                    ? 'Chờ đấu'
                                    : 'Upcoming'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {tie.teamAName} <span className="text-slate-400 font-normal">vs</span> {tie.teamBName}
                      </div>
                      <span className="font-mono text-base font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                        {s.totalWinsA}-{s.totalWinsB}
                      </span>
                    </div>
                    {onInspectTieH2H && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectTieH2H(tie);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        >
                          <Swords className="w-3 h-3" />
                          <span>{isVi ? 'Lịch sử đối đầu H2H' : 'Head-to-Head'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Active Tie Editor */}
          {renderTieEditorPanel(activeTie)}
        </div>
      )}

      {/* TAB 2: INTERACTIVE 2D BRACKET DIAGRAM (ALWAYS 2D CANVAS: GROUP STAGE -> SERIE A & SERIE B) */}
      {subTab === 'bracket_2d' && (
        <div className="space-y-6">
          {teams.length === 0 && ties.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-4">
              <GitBranch className="w-8 h-8 text-accent mx-auto" />
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display">
                  {isVi
                    ? 'Chưa có đội và nhánh đấu Đồng đội nào'
                    : 'No Team Cup teams or brackets yet'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {isVi
                    ? `Toàn bộ đội mẫu đã được xóa sạch. Hãy vào tab "Đội & VĐV" để tạo các đội thực tế cho ${activeGroups.length} bảng (${activeGroups[0]}–${activeGroups[activeGroups.length - 1]}), sau đó bấm "Chia Serie A/B & Xếp Lịch" để dựng sơ đồ 2D.`
                    : `All sample teams have been cleared. Go to "Teams & Rosters" to create real teams across ${activeGroups.length} groups, then click "Seed A/B & Schedule" to build the 2D bracket.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('rosters')}
                className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent"
              >
                {isVi ? 'Mở tab Đội & VĐV để tạo đội' : 'Open Teams & Rosters'}
              </button>
            </div>
          ) : (
            <>
              <Bracket2DCanvas
                teams={teams}
                ties={ties}
                groupsCount={scheduleConfig.groupsCount || 4}
                selectedTieId={activeTie?.id || null}
                onSelectTie={(tieId) => setSelectedTieId(tieId)}
                language={language}
              />
              {renderTieEditorPanel(activeTie)}
            </>
          )}
        </div>
      )}

      {/* TAB 3: TEAMS & ATHLETES ROSTER (GENDER + A/B/C SKILL TIER) */}
      {subTab === 'rosters' && (
        <div className="space-y-6">
          {isOrganizer ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Create New Team Form */}
            <form
              onSubmit={handleSubmitTeam}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                  {isVi ? 'Đăng ký Đội đồng đội mới' : 'Register New Team'}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Tên đội tuyển / CLB *' : 'Team / Club Name *'}
                  </label>
                  <input
                    required
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={isVi ? 'VD: Thủ Đức Eagles' : 'e.g., Thu Duc Eagles'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Mã viết tắt (2-4 ký tự)' : 'Short Code'}
                  </label>
                  <input
                    value={newTeamCode}
                    onChange={(e) => setNewTeamCode(e.target.value)}
                    maxLength={4}
                    placeholder="TDE"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono uppercase text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Xếp bảng đấu' : 'Group'}
                  </label>
                  <select
                    value={newTeamGroup}
                    onChange={(e) => setNewTeamGroup(e.target.value as GroupName)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  >
                    {activeGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Thành phố' : 'City'}
                  </label>
                  <input
                    value={newTeamCity}
                    onChange={(e) => setNewTeamCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent"
              >
                {isVi ? 'Tạo đội mới' : 'Create Team'}
              </button>
            </form>

            {/* Add Athlete with Mandatory Gender + A/B/C Skill Tier (Strictly Admin Only) */}
            {isAdmin ? (
              <form
                onSubmit={handleSubmitMember}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {isVi ? 'Thêm VĐV vào đội (Quyền Admin · Giới tính & Trình A/B/C)' : 'Add Athlete (Admin Only · Gender & Tier A/B/C)'}
                  </h2>
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Chọn đội tuyển *' : 'Select Team *'}
                  </label>
                  <select
                    value={targetTeamId || teams[0]?.id || ''}
                    onChange={(e) => setTargetTeamId(e.target.value)}
                    disabled={teams.length === 0}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white disabled:opacity-60"
                  >
                    {teams.length === 0 ? (
                      <option value="">
                        {isVi ? '-- Hãy tạo đội Đồng đội bên trái trước --' : '-- Create a team first --'}
                      </option>
                    ) : (
                      teams.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.name} ({tm.groupName}) · {tm.members.length} VĐV
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Quick 1-Tap Pick from Master Athletes Directory */}
                {(() => {
                  const selectedTeamObj = teams.find((tm) => tm.id === (targetTeamId || teams[0]?.id));
                  const existingNames = new Set(
                    (selectedTeamObj?.members || []).map((m) => m.name.trim().toLowerCase())
                  );
                  const availableFromDirectory = athletes.filter(
                    (a) => !existingNames.has(a.displayName.trim().toLowerCase())
                  );
                  if (availableFromDirectory.length === 0) return null;
                  return (
                    <div className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isVi
                          ? 'Chọn nhanh từ Kho VĐV đã thêm (1 chạm):'
                          : 'Quick pick from Athletes Directory (1 tap):'}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {availableFromDirectory.map((ath) => (
                          <button
                            key={ath.id}
                            type="button"
                            onClick={() => {
                              const destId = targetTeamId || teams[0]?.id;
                              if (!destId) return;
                              onAddTeamMember(destId, {
                                name: ath.displayName,
                                gender: ath.gender || 'male',
                                skillTier: ath.skillTier || 'B',
                              });
                            }}
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-accent text-xs font-medium text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3 h-3 text-accent shrink-0" />
                            <span>{ath.displayName}</span>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {ath.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'}·
                              {ath.skillTier || 'B'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Họ và tên VĐV *' : 'Athlete Full Name *'}
                  </label>
                  <input
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder={isVi ? 'VD: Nguyễn Lan Phương' : 'e.g., Nguyen Lan Phuong'}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Giới tính *' : 'Gender *'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'male', label: isVi ? 'Nam' : 'Male' },
                        { id: 'female', label: isVi ? 'Nữ' : 'Female' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setMemberGender(g.id)}
                        className={`min-h-[44px] rounded-lg border text-xs font-semibold transition-colors ${
                          memberGender === g.id
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {isVi ? 'Trình độ (A / B / C) *' : 'Skill Tier (A / B / C) *'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['A', 'B', 'C'] as SkillTier[]).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setMemberTier(tier)}
                        className={`min-h-[44px] rounded-lg border text-xs font-mono font-bold transition-colors ${
                          memberTier === tier
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-lg text-xs font-semibold btn-accent"
                >
                  {isVi ? 'Thêm VĐV vào đội hình' : 'Add to Roster'}
                </button>
              </form>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                      {isVi ? 'Thêm VĐV — Yêu cầu đăng nhập Admin' : 'Add Athlete — Admin Login Required'}
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isVi
                      ? 'Chỉ khi đăng nhập bằng tài khoản Google Admin mới có thể thêm hoặc xóa VĐV vào đội tuyển.'
                      : 'Only a verified signed-in Admin account can add or remove athletes from team rosters.'}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={onSignInAdmin || onOpenRoleModal}
                    className="min-h-[44px] px-4 rounded-lg text-xs font-semibold btn-accent"
                  >
                    {isVi ? 'Đăng nhập tài khoản Admin (Google)' : 'Sign In as Admin (Google)'}
                  </button>
                </div>
              </div>
            )}
          </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {isVi
                  ? 'Chỉ Ban Tổ Chức (BTC) mới có quyền thêm đội mới hoặc thay đổi danh sách VĐV.'
                  : 'Only Organizers (BTC) can register new teams or edit official rosters.'}
              </div>
              <button
                type="button"
                onClick={onOpenRoleModal}
                className="min-h-[38px] px-3.5 rounded-lg btn-accent text-xs font-bold"
              >
                {isVi ? 'Đăng nhập Ban Tổ Chức' : 'Organizer Sign In'}
              </button>
            </div>
          )}

          {/* Roster Directory Grid */}
          {teams.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {isVi
                ? `Chưa có đội Đồng đội nào. Hãy dùng biểu mẫu "Đăng ký Đội đồng đội mới" ở trên để tạo đội đầu tiên cho ${activeGroups[0]}–${activeGroups[activeGroups.length - 1]}.`
                : 'No teams registered yet. Use the "Register New Team" form above to add your first team.'}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((tm) => {
              const maleCount = tm.members.filter((m) => m.gender === 'male').length;
              const femaleCount = tm.members.filter((m) => m.gender === 'female').length;
              return (
                <div
                  key={tm.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-accent">
                        {tm.groupName} · {tm.city}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white font-display">
                        {tm.name}{' '}
                        <span className="font-mono text-xs text-slate-400">({tm.shortCode})</span>
                      </h3>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums text-right">
                        {maleCount} {isVi ? 'Nam' : 'M'} · {femaleCount} {isVi ? 'Nữ' : 'F'}
                      </div>
                      {onInspectTeamH2H && (
                        <button
                          type="button"
                          onClick={() => onInspectTeamH2H(tm)}
                          className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
                        >
                          <Swords className="w-3 h-3" />
                          <span>{isVi ? 'Đối đầu H2H' : 'Team H2H'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {tm.members.length === 0 ? (
                    <div className="py-5 text-center text-xs text-slate-400 dark:text-slate-500">
                      {isVi
                        ? 'Chưa có VĐV trong đội. Thêm VĐV mới hoặc chọn từ Kho VĐV ở trên.'
                        : 'No athletes in this team yet. Add new or pick from the directory above.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {tm.members.map((m) => (
                        <div
                          key={m.id}
                          className="py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          {onInspectPlayerH2H ? (
                            <button
                              type="button"
                              onClick={() => onInspectPlayerH2H(m.name)}
                              className="font-medium text-slate-800 dark:text-slate-100 hover:text-accent transition-colors truncate text-left"
                              title={isVi ? 'Nhấn xem lịch sử đối đầu H2H của VĐV' : 'View athlete Head-to-Head'}
                            >
                              {m.name}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {m.name}
                            </span>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {m.gender === 'male' ? (isVi ? 'Nam' : 'Male') : isVi ? 'Nữ' : 'Female'} ·{' '}
                              <strong className="text-slate-900 dark:text-white">
                                {isVi ? `Trình ${m.skillTier}` : `Tier ${m.skillTier}`}
                              </strong>
                            </span>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => onRemoveTeamMember(tm.id, m.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={isVi ? 'Xóa khỏi đội' : 'Remove from team'}
                                aria-label={isVi ? `Xóa ${m.name} khỏi đội` : `Remove ${m.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
      )}
    </div>
  );
};
