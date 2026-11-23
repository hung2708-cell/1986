import {
  buildSerieABBrackets,
  computeGroupStandings,
  computeTeamTieSummary,
  createDefaultSubMatches,
  getActiveGroupNames,
} from './seedData';
import type {
  CourtPinConfig,
  GroupName,
  ScheduleConfig,
  TargetPointsOption,
  TeamEntry,
  TeamTie,
} from './types';

export const MAX_COURTS_COUNT = 16;
export const COURT_COUNT_PRESETS = [2, 4, 6, 8, 12, 16] as const;
export const GROUP_COUNT_PRESETS = [2, 4, 6, 8] as const;

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  courtsCount: 4,
  groupsCount: 4,
  startTime: '08:00',
  slotMinutes: 30,
};

export const DEFAULT_COURT_PINS: CourtPinConfig[] = [
  { courtName: 'Sân 1', pin: '112233', refereeLabel: 'Trọng tài Sân 1' },
  { courtName: 'Sân 2', pin: '445566', refereeLabel: 'Trọng tài Sân 2' },
  { courtName: 'Sân 3', pin: '778899', refereeLabel: 'Trọng tài Sân 3' },
  { courtName: 'Sân 4', pin: '224466', refereeLabel: 'Trọng tài Sân 4' },
];

export function ensureCourtPinsForCount(
  existing: CourtPinConfig[],
  courtsCount: number
): CourtPinConfig[] {
  const safeCount = Math.max(1, Math.min(MAX_COURTS_COUNT, courtsCount));
  const next: CourtPinConfig[] = [];
  for (let i = 1; i <= safeCount; i++) {
    const courtName = `Sân ${i}`;
    const found = existing.find((c) => c.courtName === courtName);
    if (found) {
      next.push(found);
    } else {
      const seedPin = String(100000 + ((i * 234567) % 899999));
      next.push({
        courtName,
        pin: seedPin,
        refereeLabel: `Trọng tài Sân ${i}`,
      });
    }
  }
  return next;
}

export function generateRandomSixDigitPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function parseMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 8 * 60;
  return h * 60 + m;
}

function formatMinutes(totalMins: number): string {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getTieRealTeamIds(tie: TeamTie): string[] {
  const ids: string[] = [];
  if (tie.teamAId && tie.teamAId !== 'TBD') ids.push(tie.teamAId);
  if (tie.teamBId && tie.teamBId !== 'TBD') ids.push(tie.teamBId);
  return ids;
}

function isTieStarted(tie: TeamTie): boolean {
  if (tie.status === 'live' || tie.status === 'completed') return true;
  if (tie.subMatches.some((sm) => sm.scoreA > 0 || sm.scoreB > 0 || sm.status !== 'upcoming')) {
    return true;
  }
  if (tie.tieBreak && (tie.tieBreak.scoreA > 0 || tie.tieBreak.scoreB > 0 || tie.tieBreak.status !== 'upcoming')) {
    return true;
  }
  return false;
}

function buildMissingGroupRoundRobinTies(
  teams: TeamEntry[],
  existingGroupTies: TeamTie[],
  organizerUid: string,
  tournamentId: string,
  groupTargetPoints: TargetPointsOption = 11,
  groupsCount = 4
): TeamTie[] {
  const pairKey = (a: string, b: string) => [a, b].sort().join('__');
  const existingPairs = new Set(
    existingGroupTies.map((ti) => pairKey(ti.teamAId, ti.teamBId))
  );

  const additions: TeamTie[] = [];
  const groups: GroupName[] = getActiveGroupNames(teams, existingGroupTies, groupsCount);

  for (const grp of groups) {
    const grpTeams = teams.filter((tm) => tm.groupName === grp);
    const code = grp.replace('Bảng ', '').trim() || 'A';
    let roundCounter = existingGroupTies.filter((ti) => ti.groupName === grp).length;

    for (let i = 0; i < grpTeams.length; i++) {
      for (let j = i + 1; j < grpTeams.length; j++) {
        const tA = grpTeams[i];
        const tB = grpTeams[j];
        const key = pairKey(tA.id, tB.id);
        if (existingPairs.has(key)) continue;
        existingPairs.add(key);
        roundCounter += 1;
        const id = `tie_grp${code}_${tA.id.slice(-4)}_${tB.id.slice(-4)}_${roundCounter}`.replace(
          /[^a-zA-Z0-9_\-]/g,
          ''
        );
        additions.push({
          id,
          organizerUid,
          tournamentId,
          stage: 'group',
          groupName: grp,
          roundLabel: `${grp} · Lượt ${roundCounter}`,
          bracketSlot: 'GROUP',
          teamAId: tA.id,
          teamBId: tB.id,
          teamAName: tA.name,
          teamBName: tB.name,
          subMatches: createDefaultSubMatches(id, groupTargetPoints),
          tieBreak: null,
          status: 'upcoming',
          visibility: 'public',
        });
      }
    }
  }

  return [...existingGroupTies, ...additions];
}

/**
 * Automatically updates Serie A & Serie B from live Group Stage standings (2 to 8 groups),
 * advances Semifinal winners into Finals, and schedules every match across N courts
 * (up to 16 courts: Sân 1 .. Sân 16) with ZERO same-slot team conflicts and fair alternating rest slots.
 */
export function autoSeedAndScheduleTies(
  teams: TeamEntry[],
  ties: TeamTie[],
  organizerUid: string,
  tournamentId: string,
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG,
  knockoutTargetPoints?: TargetPointsOption,
  groupTargetPoints: TargetPointsOption = 11
): TeamTie[] {
  if (teams.length === 0 && ties.length === 0) {
    return [];
  }

  const groupsCount = config.groupsCount || 4;
  const existingGroupTies = ties.filter((ti) => ti.stage === 'group');
  const groupTies = buildMissingGroupRoundRobinTies(
    teams,
    existingGroupTies,
    organizerUid,
    tournamentId,
    groupTargetPoints,
    groupsCount
  );

  const hasKnockoutEligibility =
    teams.length >= 2 || ties.some((ti) => ti.stage !== 'group');

  const freshBrackets = hasKnockoutEligibility
    ? buildSerieABBrackets(
        teams,
        groupTies,
        organizerUid,
        tournamentId,
        knockoutTargetPoints,
        groupsCount
      )
    : [];

  // Merge newly seeded Serie A / Serie B brackets while preserving live/completed scores
  const existingMap = new Map<string, TeamTie>();
  for (const ti of ties) existingMap.set(ti.id, ti);

  const mergedKnockouts: TeamTie[] = freshBrackets.map((fresh) => {
    const existing = existingMap.get(fresh.id);
    if (!existing) return fresh;
    // If match already started or finished, preserve its teams and scores
    if (isTieStarted(existing)) {
      return existing;
    }
    // Otherwise sync seeded teams from live Group Stage standings while keeping submatch shell
    if (fresh.bracketSlot === 'SF1' || fresh.bracketSlot === 'SF2') {
      return {
        ...existing,
        teamAId: fresh.teamAId,
        teamBId: fresh.teamBId,
        teamAName: fresh.teamAName,
        teamBName: fresh.teamBName,
        roundLabel: fresh.roundLabel,
      };
    }
    return existing;
  });

  // Auto-advance SF1 & SF2 winners into Serie A Final & Serie B Final
  const knockoutById = new Map<string, TeamTie>();
  for (const ko of mergedKnockouts) knockoutById.set(ko.id, ko);

  const stages: Array<'serieA' | 'serieB'> = ['serieA', 'serieB'];
  for (const stage of stages) {
    const sf1 = knockoutById.get(`tie_${stage}_sf1`);
    const sf2 = knockoutById.get(`tie_${stage}_sf2`);
    const fin = knockoutById.get(`tie_${stage}_final`);
    if (!fin) continue;

    let nextFin = { ...fin };
    if (sf1) {
      const s1 = computeTeamTieSummary(sf1);
      if (s1.winnerTeamId && s1.winnerTeamName) {
        nextFin.teamAId = s1.winnerTeamId;
        nextFin.teamAName = s1.winnerTeamName;
      } else if (!isTieStarted(fin)) {
        nextFin.teamAId = '';
        nextFin.teamAName = stage === 'serieA' ? 'Thắng BK1 Serie A' : 'Thắng BK1 Serie B';
      }
    }
    if (sf2) {
      const s2 = computeTeamTieSummary(sf2);
      if (s2.winnerTeamId && s2.winnerTeamName) {
        nextFin.teamBId = s2.winnerTeamId;
        nextFin.teamBName = s2.winnerTeamName;
      } else if (!isTieStarted(fin)) {
        nextFin.teamBId = '';
        nextFin.teamBName = stage === 'serieA' ? 'Thắng BK2 Serie A' : 'Thắng BK2 Serie B';
      }
    }
    knockoutById.set(fin.id, nextFin);
  }

  // Keep any extra custom knockout ties not in standard 6 slots
  const standardIds = new Set(mergedKnockouts.map((k) => k.id));
  const extraTies = ties.filter((ti) => ti.stage !== 'group' && !standardIds.has(ti.id));

  const allCombined: TeamTie[] = [
    ...groupTies,
    ...mergedKnockouts.map((k) => knockoutById.get(k.id) || k),
    ...extraTies,
  ];

  return scheduleTiesConflictFree(allCombined, config);
}

/**
 * Pure deterministic multi-court scheduler (Default: 2 courts Sân 1 & Sân 2).
 * Guarantees:
 *  1) No team is ever assigned to 2 courts in the same time slot.
 *  2) Stage ordering: Group Stage -> Knockout Semifinals -> Championship Finals.
 *  3) Alternating rest priority: prefers pairing teams that rested in the previous slot
 *     and balances Bảng A / Bảng B simultaneously across Sân 1 & Sân 2.
 */
export function scheduleTiesConflictFree(
  ties: TeamTie[],
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): TeamTie[] {
  const courtsCount = Math.max(1, Math.min(MAX_COURTS_COUNT, config.courtsCount || 4));
  const startMins = parseMinutes(config.startTime || '08:00');
  const slotMins = Math.max(15, Math.min(90, config.slotMinutes || 30));

  const statusOrder = (s: TeamTie['status']) =>
    s === 'completed' ? 0 : s === 'live' ? 1 : 2;

  const wave1Group = ties
    .filter((ti) => ti.stage === 'group')
    .sort((a, b) => {
      const so = statusOrder(a.status) - statusOrder(b.status);
      if (so !== 0) return so;
      return a.id.localeCompare(b.id);
    });

  const wave2Semis = ties
    .filter((ti) => ti.stage !== 'group' && ti.bracketSlot !== 'FINAL')
    .sort((a, b) => {
      // Interleave Serie A & Serie B SF1/SF2 cleanly, completed/live first
      const so = statusOrder(a.status) - statusOrder(b.status);
      if (so !== 0) return so;
      const stageOrd = (st: TeamTie['stage']) => (st === 'serieA' ? 0 : 1);
      if (stageOrd(a.stage) !== stageOrd(b.stage)) return stageOrd(a.stage) - stageOrd(b.stage);
      return (a.bracketSlot || '').localeCompare(b.bracketSlot || '');
    });

  const wave3Finals = ties
    .filter((ti) => ti.stage !== 'group' && ti.bracketSlot === 'FINAL')
    .sort((a, b) => {
      // Schedule Serie B Final + Serie A Final side-by-side or cleanly ordered
      if (a.stage === 'serieB' && b.stage === 'serieA') return -1;
      if (a.stage === 'serieA' && b.stage === 'serieB') return 1;
      return a.id.localeCompare(b.id);
    });

  const waves = [wave1Group, wave2Semis, wave3Finals];
  const scheduledMap = new Map<string, TeamTie>();

  let currentSlot = 1;
  let prevSlotTeams = new Set<string>();
  const lastPlayedSlot = new Map<string, number>();

  for (const wave of waves) {
    const remaining = [...wave];

    while (remaining.length > 0) {
      const usedTeamsInSlot = new Set<string>();
      const usedGroupsInSlot = new Set<string>();
      const slotTime = formatMinutes(startMins + (currentSlot - 1) * slotMins);

      for (let courtIdx = 1; courtIdx <= courtsCount; courtIdx++) {
        if (remaining.length === 0) break;

        // Filter candidates with ZERO team overlap against teams already scheduled in this time slot
        const eligibleIndices: number[] = [];
        for (let i = 0; i < remaining.length; i++) {
          const teamIds = getTieRealTeamIds(remaining[i]);
          const hasConflict = teamIds.some((id) => usedTeamsInSlot.has(id));
          if (!hasConflict) eligibleIndices.push(i);
        }

        if (eligibleIndices.length === 0) {
          // No conflict-free match can fit into the remaining court of this slot -> move to next slot
          break;
        }

        // Score eligible candidates to maximize rest fairness and cross-group parallelism
        let bestIdx = eligibleIndices[0];
        let bestScore = -Infinity;

        for (const idx of eligibleIndices) {
          const cand = remaining[idx];
          const teamIds = getTieRealTeamIds(cand);

          // 1. Strongly keep completed ties in earliest slots, live ties in active slots
          const statusPriority = cand.status === 'completed' ? 500 : cand.status === 'live' ? 200 : 0;

          // 2. Rest Bonus: teams that did NOT play in the immediately preceding slot get huge bonus
          let restedCount = 0;
          let idleGapSum = 0;
          for (const tid of teamIds) {
            if (!prevSlotTeams.has(tid)) restedCount += 1;
            const last = lastPlayedSlot.get(tid);
            idleGapSum += last === undefined ? 4 : Math.min(6, currentSlot - last);
          }
          const restScore = restedCount * 40 + idleGapSum * 8;

          // 3. Group Balance Bonus: on 2 courts, put Bảng A on Sân 1 and Bảng B on Sân 2 when possible
          const groupBonus =
            cand.groupName && !usedGroupsInSlot.has(cand.groupName) ? 25 : 0;

          // 4. Slight preference for Serie A on Sân 1 during Finals/Semis
          const courtAff =
            courtIdx === 1 && cand.stage === 'serieA'
              ? 12
              : courtIdx === 2 && cand.stage === 'serieB'
                ? 12
                : 0;

          const totalScore = statusPriority + restScore + groupBonus + courtAff;
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestIdx = idx;
          }
        }

        const picked = remaining.splice(bestIdx, 1)[0];
        const teamIds = getTieRealTeamIds(picked);
        for (const tid of teamIds) {
          usedTeamsInSlot.add(tid);
          lastPlayedSlot.set(tid, currentSlot);
        }
        if (picked.groupName) usedGroupsInSlot.add(picked.groupName);

        scheduledMap.set(picked.id, {
          ...picked,
          courtName: `Sân ${courtIdx}`,
          scheduledSlot: currentSlot,
          scheduledTime: slotTime,
        });
      }

      prevSlotTeams = usedTeamsInSlot;
      currentSlot += 1;
    }
  }

  return ties.map((orig) => scheduledMap.get(orig.id) || orig);
}

export interface ScheduleAuditResult {
  conflictCount: number;
  backToBackCount: number;
  totalSlots: number;
  courtsUsed: string[];
  allGroupMatchesCompleted: boolean;
  groupCompletedCount: number;
  groupTotalCount: number;
}

export function auditScheduleConflicts(ties: TeamTie[]): ScheduleAuditResult {
  const bySlot = new Map<number, TeamTie[]>();
  const courtsSet = new Set<string>();

  let groupCompletedCount = 0;
  let groupTotalCount = 0;

  for (const ti of ties) {
    if (ti.stage === 'group') {
      groupTotalCount += 1;
      if (ti.status === 'completed') groupCompletedCount += 1;
    }
    if (ti.courtName) courtsSet.add(ti.courtName);
    if (ti.scheduledSlot) {
      const arr = bySlot.get(ti.scheduledSlot) || [];
      arr.push(ti);
      bySlot.set(ti.scheduledSlot, arr);
    }
  }

  const sortedSlots = Array.from(bySlot.keys()).sort((a, b) => a - b);
  let conflictCount = 0;
  let backToBackCount = 0;
  let prevTeams = new Set<string>();

  for (const slot of sortedSlots) {
    const slotTies = bySlot.get(slot) || [];
    const seenInSlot = new Set<string>();
    for (const ti of slotTies) {
      for (const tid of getTieRealTeamIds(ti)) {
        if (seenInSlot.has(tid)) {
          conflictCount += 1;
        }
        if (prevTeams.has(tid)) {
          backToBackCount += 1;
        }
        seenInSlot.add(tid);
      }
    }
    prevTeams = seenInSlot;
  }

  return {
    conflictCount,
    backToBackCount,
    totalSlots: sortedSlots.length,
    courtsUsed: Array.from(courtsSet).sort(),
    allGroupMatchesCompleted: groupTotalCount > 0 && groupCompletedCount === groupTotalCount,
    groupCompletedCount,
    groupTotalCount,
  };
}

export function getGroupRankingsSummary(
  teams: TeamEntry[],
  ties: TeamTie[],
  groupsCount = 4
) {
  const activeGroups = getActiveGroupNames(teams, ties, groupsCount);
  return activeGroups.map((groupName) => ({
    groupName,
    rows: computeGroupStandings(teams, ties, groupName),
  }));
}
