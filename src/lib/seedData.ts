import {
  ALL_GROUP_NAMES,
  type AthleteProfile,
  type ChatMessage,
  type CommunityPost,
  type GroupName,
  type MatchRecord,
  type PickleballCourt,
  type Registration,
  type TeamEntry,
  type TeamStandingRow,
  type TeamSubMatch,
  type TeamTie,
  type Tournament,
  type TournamentRulesConfig,
} from './types';

export const DEFAULT_TOURNAMENT_RULES: TournamentRulesConfig = {
  groupTargetPoints: 11,
  knockoutTargetPoints: 15,
};

export const BRAND_LOGO_IMAGE = '/src/assets/images/logo_1986_binh_dan_1795426961264.jpg';
export const HERO_COURT_IMAGE = '/src/assets/images/hero_pickleball_court_1795408792624.jpg';
export const TOURNAMENT_BANNER_IMAGE = '/src/assets/images/tournament_open_banner_1795408788267.jpg';
export const COMMUNITY_RECAP_IMAGE = '/src/assets/images/community_match_recap_1795408788441.jpg';

export const INITIAL_ATHLETES: AthleteProfile[] = [];

export const INITIAL_TOURNAMENTS: Tournament[] = [];

export const INITIAL_REGISTRATIONS: Registration[] = [];

export const INITIAL_MATCHES: MatchRecord[] = [];

export const INITIAL_POSTS: CommunityPost[] = [];

export const INITIAL_CHAT_ROOMS = [
  { id: 'general', nameVi: 'Cộng đồng Pickleball 1986', nameEn: '1986 Pickleball Hub', members: 0 },
  { id: 'south_club', nameVi: 'Kèo giao lưu Miền Nam', nameEn: 'South Region Open Play', members: 0 },
  { id: 'north_club', nameVi: 'Kèo giao lưu Miền Bắc', nameEn: 'North Region Open Play', members: 0 },
  { id: 'central_club', nameVi: 'Kèo giao lưu Miền Trung', nameEn: 'Central Region Open Play', members: 0 },
];

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [];

export const PICKLEBALL_COURTS: PickleballCourt[] = [
  {
    id: 'crt_thaodien',
    name: 'Thảo Điền Pickleball Arena',
    city: 'TP.HCM',
    district: 'Thảo Điền, Thủ Đức',
    courtsCount: 12,
    surface: 'Acrylic Pro Cushion',
    lat: 10.8052,
    lng: 106.7332,
    pricePerHourVnd: 220000,
    openHours: '05:30 - 22:30',
  },
  {
    id: 'crt_djoy',
    name: 'D-Joy District 7 Courts',
    city: 'TP.HCM',
    district: 'Quận 7',
    courtsCount: 8,
    surface: 'Outdoor Laykold',
    lat: 10.7312,
    lng: 106.7204,
    pricePerHourVnd: 180000,
    openHours: '06:00 - 22:00',
  },
  {
    id: 'crt_landmark',
    name: 'Saigon Riverfront Pickleball',
    city: 'TP.HCM',
    district: 'Bình Thạnh',
    courtsCount: 6,
    surface: 'Covered Acrylic',
    lat: 10.7962,
    lng: 106.7231,
    pricePerHourVnd: 240000,
    openHours: '06:00 - 23:00',
  },
  {
    id: 'crt_caugiay',
    name: 'Cầu Giấy Indoor Pickleball Hub',
    city: 'Hà Nội',
    district: 'Cầu Giấy',
    courtsCount: 10,
    surface: 'Indoor Pro Surface',
    lat: 21.0345,
    lng: 105.7928,
    pricePerHourVnd: 200000,
    openHours: '05:30 - 22:30',
  },
  {
    id: 'crt_tayho',
    name: 'West Lake Dink Club',
    city: 'Hà Nội',
    district: 'Tây Hồ',
    courtsCount: 6,
    surface: 'Acrylic Outdoor',
    lat: 21.0648,
    lng: 105.8195,
    pricePerHourVnd: 190000,
    openHours: '06:00 - 22:00',
  },
  {
    id: 'crt_mykhe',
    name: 'Mỹ Khê Coastal Pickleball',
    city: 'Đà Nẵng',
    district: 'Sơn Trà',
    courtsCount: 8,
    surface: 'Weatherproof Cushion',
    lat: 16.0665,
    lng: 108.2458,
    pricePerHourVnd: 150000,
    openHours: '05:30 - 22:00',
  },
];

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function computeDuprDelta(winnerRating: number, loserRating: number): number {
  const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 1.5));
  const rawDelta = 0.14 * (1 - expectedWin);
  return Math.max(0.02, Math.min(0.24, Math.round(rawDelta * 100) / 100));
}

// =============================================================================
// Team Cup Initial Data (Empty — Admin / Organizer creates real teams) + Algorithms
// =============================================================================
export const INITIAL_TEAM_ENTRIES: TeamEntry[] = [];

export function createDefaultSubMatches(tieId: string, targetPoints = 11): TeamSubMatch[] {
  return [
    {
      id: `${tieId}_wd`,
      type: 'womens_doubles',
      labelVi: '01. Đôi Nữ',
      labelEn: '01. Women’s Doubles',
      teamAPlayerIds: ['', ''],
      teamBPlayerIds: ['', ''],
      scoreA: 0,
      scoreB: 0,
      targetPoints,
      servingSide: 'A',
      serverNumber: 2,
      status: 'upcoming',
      winnerSide: '',
      forfeitSide: '',
    },
    {
      id: `${tieId}_md`,
      type: 'mens_doubles',
      labelVi: '02. Đôi Nam',
      labelEn: '02. Men’s Doubles',
      teamAPlayerIds: ['', ''],
      teamBPlayerIds: ['', ''],
      scoreA: 0,
      scoreB: 0,
      targetPoints,
      servingSide: 'A',
      serverNumber: 2,
      status: 'upcoming',
      winnerSide: '',
      forfeitSide: '',
    },
    {
      id: `${tieId}_mx1`,
      type: 'mixed_1',
      labelVi: '03. Đôi Nam Nữ 1',
      labelEn: '03. Mixed Doubles 1',
      teamAPlayerIds: ['', ''],
      teamBPlayerIds: ['', ''],
      scoreA: 0,
      scoreB: 0,
      targetPoints,
      servingSide: 'A',
      serverNumber: 2,
      status: 'upcoming',
      winnerSide: '',
      forfeitSide: '',
    },
    {
      id: `${tieId}_mx2`,
      type: 'mixed_2',
      labelVi: '04. Đôi Nam Nữ 2',
      labelEn: '04. Mixed Doubles 2',
      teamAPlayerIds: ['', ''],
      teamBPlayerIds: ['', ''],
      scoreA: 0,
      scoreB: 0,
      targetPoints,
      servingSide: 'A',
      serverNumber: 2,
      status: 'upcoming',
      winnerSide: '',
      forfeitSide: '',
    },
  ];
}

export const INITIAL_TEAM_TIES: TeamTie[] = [];

export interface TeamTieSummary {
  doublesWinsA: number;
  doublesWinsB: number;
  totalWinsA: number;
  totalWinsB: number;
  doublesCompletedCount: number;
  isGroupDraw22: boolean;
  needsKnockoutTieBreak: boolean;
  decidedByTieBreak: boolean;
  forfeitSide: '' | 'A' | 'B';
  winnerSide: '' | 'A' | 'B' | 'DRAW';
  winnerTeamId: string;
  winnerTeamName: string;
  pointsDiffA: number;
}

export function computeTeamTieSummary(tie: TeamTie): TeamTieSummary {
  // Tie-level forfeit: forfeiting team loses 0-4 (each doubles match 0-15) and receives 0 standing points
  if (tie.forfeitSide === 'A' || tie.forfeitSide === 'B') {
    const winnerSide: 'A' | 'B' = tie.forfeitSide === 'A' ? 'B' : 'A';
    return {
      doublesWinsA: winnerSide === 'A' ? 4 : 0,
      doublesWinsB: winnerSide === 'B' ? 4 : 0,
      totalWinsA: winnerSide === 'A' ? 4 : 0,
      totalWinsB: winnerSide === 'B' ? 4 : 0,
      doublesCompletedCount: 4,
      isGroupDraw22: false,
      needsKnockoutTieBreak: false,
      decidedByTieBreak: false,
      forfeitSide: tie.forfeitSide,
      winnerSide,
      winnerTeamId: winnerSide === 'A' ? tie.teamAId : tie.teamBId,
      winnerTeamName: winnerSide === 'A' ? tie.teamAName : tie.teamBName,
      pointsDiffA: winnerSide === 'A' ? 60 : -60,
    };
  }

  let doublesWinsA = 0;
  let doublesWinsB = 0;
  let doublesCompletedCount = 0;
  let pointsDiffA = 0;

  for (const sm of tie.subMatches) {
    pointsDiffA += sm.scoreA - sm.scoreB;
    if (sm.status === 'completed') {
      doublesCompletedCount += 1;
      if (sm.winnerSide === 'A') doublesWinsA += 1;
      else if (sm.winnerSide === 'B') doublesWinsB += 1;
    }
  }

  let totalWinsA = doublesWinsA;
  let totalWinsB = doublesWinsB;
  let decidedByTieBreak = false;

  if (tie.stage !== 'group' && tie.tieBreak && tie.tieBreak.status === 'completed') {
    pointsDiffA += tie.tieBreak.scoreA - tie.tieBreak.scoreB;
    if (tie.tieBreak.winnerSide === 'A') {
      totalWinsA += 1;
      decidedByTieBreak = true;
    } else if (tie.tieBreak.winnerSide === 'B') {
      totalWinsB += 1;
      decidedByTieBreak = true;
    }
  }

  const allDoublesDone = doublesCompletedCount === 4;
  const isTied22 = allDoublesDone && doublesWinsA === 2 && doublesWinsB === 2;
  const isGroupDraw22 = tie.stage === 'group' && isTied22;
  const needsKnockoutTieBreak =
    tie.stage !== 'group' && isTied22 && (!tie.tieBreak || tie.tieBreak.status !== 'completed');

  let winnerSide: '' | 'A' | 'B' | 'DRAW' = '';
  let winnerTeamId = '';
  let winnerTeamName = '';

  if (isGroupDraw22) {
    winnerSide = 'DRAW';
  } else if (allDoublesDone && !needsKnockoutTieBreak) {
    if (totalWinsA > totalWinsB) {
      winnerSide = 'A';
      winnerTeamId = tie.teamAId;
      winnerTeamName = tie.teamAName;
    } else if (totalWinsB > totalWinsA) {
      winnerSide = 'B';
      winnerTeamId = tie.teamBId;
      winnerTeamName = tie.teamBName;
    }
  }

  return {
    doublesWinsA,
    doublesWinsB,
    totalWinsA,
    totalWinsB,
    doublesCompletedCount,
    isGroupDraw22,
    needsKnockoutTieBreak,
    decidedByTieBreak,
    forfeitSide: '',
    winnerSide,
    winnerTeamId,
    winnerTeamName,
    pointsDiffA,
  };
}

export function computeGroupStandings(
  teams: TeamEntry[],
  ties: TeamTie[],
  groupName: GroupName
): TeamStandingRow[] {
  const groupTeams = teams.filter((tm) => tm.groupName === groupName);
  type StandingDraft = Omit<TeamStandingRow, 'rank' | 'qualifiedSerie'>;
  const map = new Map<string, StandingDraft>();

  for (const tm of groupTeams) {
    map.set(tm.id, {
      teamId: tm.id,
      teamName: tm.name,
      shortCode: tm.shortCode,
      groupName,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      forfeits: 0,
      subWins: 0,
      subLosses: 0,
      pointDiff: 0,
      points: 0,
    });
  }

  const completedGroupTies: Array<{ tie: TeamTie; summary: TeamTieSummary }> = [];
  const groupTies = ties.filter((ti) => ti.stage === 'group' && ti.groupName === groupName);

  for (const tie of groupTies) {
    const summary = computeTeamTieSummary(tie);
    if (summary.doublesCompletedCount < 4) continue;

    const rowA = map.get(tie.teamAId);
    const rowB = map.get(tie.teamBId);
    if (!rowA || !rowB) continue;

    completedGroupTies.push({ tie, summary });

    rowA.played += 1;
    rowB.played += 1;
    rowA.subWins += summary.doublesWinsA;
    rowA.subLosses += summary.doublesWinsB;
    rowB.subWins += summary.doublesWinsB;
    rowB.subLosses += summary.doublesWinsA;
    rowA.pointDiff += summary.pointsDiffA;
    rowB.pointDiff -= summary.pointsDiffA;

    // Official Team Cup Scoring: Win = 3 pts, Draw 2-2 = 2 pts, Loss = 1 pt, Forfeit = 0 pts (15-0)
    if (summary.forfeitSide === 'A') {
      rowB.wins += 1;
      rowB.points += 3;
      rowA.losses += 1;
      rowA.forfeits += 1;
      // Team A gets 0 points for forfeit
    } else if (summary.forfeitSide === 'B') {
      rowA.wins += 1;
      rowA.points += 3;
      rowB.losses += 1;
      rowB.forfeits += 1;
      // Team B gets 0 points for forfeit
    } else if (summary.winnerSide === 'DRAW') {
      rowA.draws += 1;
      rowB.draws += 1;
      rowA.points += 2;
      rowB.points += 2;
    } else if (summary.winnerSide === 'A') {
      rowA.wins += 1;
      rowA.points += 3;
      rowB.losses += 1;
      rowB.points += 1;
    } else if (summary.winnerSide === 'B') {
      rowB.wins += 1;
      rowB.points += 3;
      rowA.losses += 1;
      rowA.points += 1;
    }
  }

  // Group teams by total standing points to resolve Head-to-Head (Đối kháng) mini-tables
  const buckets = new Map<number, StandingDraft[]>();
  for (const row of map.values()) {
    const arr = buckets.get(row.points) || [];
    arr.push(row);
    buckets.set(row.points, arr);
  }

  const sortedPoints = Array.from(buckets.keys()).sort((a, b) => b - a);
  const finalOrdered: StandingDraft[] = [];

  for (const pts of sortedPoints) {
    const bucket = buckets.get(pts) || [];
    if (bucket.length <= 1) {
      finalOrdered.push(...bucket);
      continue;
    }

    // Build Head-to-Head (Đối kháng) mini-table strictly among teams in this tied bucket
    const tiedIds = new Set(bucket.map((r) => r.teamId));
    const h2hStats = new Map<string, { points: number; subDiff: number; pointDiff: number }>();
    for (const r of bucket) {
      h2hStats.set(r.teamId, { points: 0, subDiff: 0, pointDiff: 0 });
    }

    for (const { tie, summary } of completedGroupTies) {
      if (!tiedIds.has(tie.teamAId) || !tiedIds.has(tie.teamBId)) continue;
      const stA = h2hStats.get(tie.teamAId)!;
      const stB = h2hStats.get(tie.teamBId)!;

      stA.subDiff += summary.doublesWinsA - summary.doublesWinsB;
      stB.subDiff += summary.doublesWinsB - summary.doublesWinsA;
      stA.pointDiff += summary.pointsDiffA;
      stB.pointDiff -= summary.pointsDiffA;

      if (summary.forfeitSide === 'A') {
        stB.points += 3;
      } else if (summary.forfeitSide === 'B') {
        stA.points += 3;
      } else if (summary.winnerSide === 'DRAW') {
        stA.points += 2;
        stB.points += 2;
      } else if (summary.winnerSide === 'A') {
        stA.points += 3;
        stB.points += 1;
      } else if (summary.winnerSide === 'B') {
        stB.points += 3;
        stA.points += 1;
      }
    }

    // Official tie-break order:
    // 1. Head-to-Head points (Đối kháng)
    // 2. Sub-match difference (Hiệu số trận đôi: H2H then overall)
    // 3. Point difference (+/-: H2H then overall)
    // 4. Total sub-matches won
    bucket.sort((a, b) => {
      const ha = h2hStats.get(a.teamId)!;
      const hb = h2hStats.get(b.teamId)!;

      if (hb.points !== ha.points) return hb.points - ha.points;
      if (hb.subDiff !== ha.subDiff) return hb.subDiff - ha.subDiff;
      const subDiffA = a.subWins - a.subLosses;
      const subDiffB = b.subWins - b.subLosses;
      if (subDiffB !== subDiffA) return subDiffB - subDiffA;
      if (hb.pointDiff !== ha.pointDiff) return hb.pointDiff - ha.pointDiff;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.subWins - a.subWins;
    });

    finalOrdered.push(...bucket);
  }

  return finalOrdered.map((row, idx) => ({
    ...row,
    rank: idx + 1,
    qualifiedSerie: idx < 2 ? 'Serie A' : 'Serie B',
  }));
}

export function getActiveGroupNames(
  teams: TeamEntry[],
  ties: TeamTie[],
  groupsCount = 4
): GroupName[] {
  const safeCount = Math.max(2, Math.min(ALL_GROUP_NAMES.length, groupsCount || 4));
  const used = new Set<GroupName>(ALL_GROUP_NAMES.slice(0, safeCount));
  for (const tm of teams) {
    if (ALL_GROUP_NAMES.includes(tm.groupName)) used.add(tm.groupName);
  }
  for (const ti of ties) {
    if (ti.groupName && ALL_GROUP_NAMES.includes(ti.groupName as GroupName)) {
      used.add(ti.groupName as GroupName);
    }
  }
  return ALL_GROUP_NAMES.filter((g) => used.has(g));
}

function compareOverallStandingRows(a: TeamStandingRow, b: TeamStandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  const subDiffA = a.subWins - a.subLosses;
  const subDiffB = b.subWins - b.subLosses;
  if (subDiffB !== subDiffA) return subDiffB - subDiffA;
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
  return b.subWins - a.subWins;
}

export function buildSerieABBrackets(
  teams: TeamEntry[],
  ties: TeamTie[],
  organizerUid: string,
  tournamentId: string,
  knockoutTargetPoints = DEFAULT_TOURNAMENT_RULES.knockoutTargetPoints,
  groupsCount = 4
): TeamTie[] {
  const activeGroups = getActiveGroupNames(teams, ties, groupsCount);
  const populatedGroups = activeGroups.filter((g) =>
    teams.some((tm) => tm.groupName === g)
  );
  const useMultiGroup = populatedGroups.length > 2 || activeGroups.length > 2;

  const pick = (rows: TeamStandingRow[], idx: number, fallback: string) => ({
    id: rows[idx]?.teamId || '',
    name: rows[idx]?.teamName || fallback,
  });

  let sa1: { id: string; name: string };
  let sa2: { id: string; name: string };
  let sa3: { id: string; name: string };
  let sa4: { id: string; name: string };
  let sb1: { id: string; name: string };
  let sb2: { id: string; name: string };
  let sb3: { id: string; name: string };
  let sb4: { id: string; name: string };
  let sf1ALabel = 'Bán kết 1 · Serie A (1A vs 2B)';
  let sf2ALabel = 'Bán kết 2 · Serie A (1B vs 2A)';
  let sf1BLabel = 'Bán kết 1 · Serie B (3A vs 4B)';
  let sf2BLabel = 'Bán kết 2 · Serie B (3B vs 4A)';

  if (!useMultiGroup) {
    const standA = computeGroupStandings(teams, ties, 'Bảng A');
    const standB = computeGroupStandings(teams, ties, 'Bảng B');
    sa1 = pick(standA, 0, 'Nhất Bảng A');
    sa2 = pick(standB, 1, 'Nhì Bảng B');
    sa3 = pick(standB, 0, 'Nhất Bảng B');
    sa4 = pick(standA, 1, 'Nhì Bảng A');
    sb1 = pick(standA, 2, 'Hạng 3 Bảng A');
    sb2 = pick(standB, 3, 'Hạng 4 Bảng B');
    sb3 = pick(standB, 2, 'Hạng 3 Bảng B');
    sb4 = pick(standA, 3, 'Hạng 4 Bảng A');
  } else {
    const groupStandings = activeGroups.map((g) => ({
      group: g,
      code: g.replace('Bảng ', ''),
      rows: computeGroupStandings(teams, ties, g),
    }));

    // Rank all #1 seeds first, then #2 seeds for Serie A; remaining seeds for Serie B
    const firstSeeds = groupStandings
      .map((gs) => gs.rows[0])
      .filter((r): r is TeamStandingRow => Boolean(r))
      .sort(compareOverallStandingRows);
    const secondSeeds = groupStandings
      .map((gs) => gs.rows[1])
      .filter((r): r is TeamStandingRow => Boolean(r))
      .sort(compareOverallStandingRows);
    const lowerSeeds = groupStandings
      .flatMap((gs) => gs.rows.slice(2))
      .sort(compareOverallStandingRows);

    const serieAPool = [...firstSeeds, ...secondSeeds];
    const serieBPool = [
      ...serieAPool.slice(4),
      ...lowerSeeds,
    ];

    const gCodes = activeGroups.map((g) => g.replace('Bảng ', ''));
    sa1 = pick(serieAPool, 0, `Nhất Bảng ${gCodes[0] || 'A'}`);
    sa2 = pick(serieAPool, 3, `Nhất Bảng ${gCodes[3] || 'D'}`);
    sa3 = pick(serieAPool, 1, `Nhất Bảng ${gCodes[1] || 'B'}`);
    sa4 = pick(serieAPool, 2, `Nhất Bảng ${gCodes[2] || 'C'}`);

    sb1 = pick(serieBPool, 0, `Nhì Bảng ${gCodes[0] || 'A'}`);
    sb2 = pick(serieBPool, 3, `Nhì Bảng ${gCodes[3] || 'D'}`);
    sb3 = pick(serieBPool, 1, `Nhì Bảng ${gCodes[1] || 'B'}`);
    sb4 = pick(serieBPool, 2, `Nhì Bảng ${gCodes[2] || 'C'}`);

    sf1ALabel = `Bán kết 1 · Serie A (Top #1 vs #4 · ${activeGroups.length} bảng)`;
    sf2ALabel = `Bán kết 2 · Serie A (Top #2 vs #3 · ${activeGroups.length} bảng)`;
    sf1BLabel = `Bán kết 1 · Serie B (Hạt giống #5 vs #8)`;
    sf2BLabel = `Bán kết 2 · Serie B (Hạt giống #6 vs #7)`;
  }

  return [
    {
      id: 'tie_serieA_sf1',
      organizerUid,
      tournamentId,
      stage: 'serieA',
      roundLabel: sf1ALabel,
      bracketSlot: 'SF1',
      teamAId: sa1.id,
      teamBId: sa2.id,
      teamAName: sa1.name,
      teamBName: sa2.name,
      subMatches: createDefaultSubMatches('tie_serieA_sf1', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
    {
      id: 'tie_serieA_sf2',
      organizerUid,
      tournamentId,
      stage: 'serieA',
      roundLabel: sf2ALabel,
      bracketSlot: 'SF2',
      teamAId: sa3.id,
      teamBId: sa4.id,
      teamAName: sa3.name,
      teamBName: sa4.name,
      subMatches: createDefaultSubMatches('tie_serieA_sf2', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
    {
      id: 'tie_serieA_final',
      organizerUid,
      tournamentId,
      stage: 'serieA',
      roundLabel: 'Chung kết · Serie A',
      bracketSlot: 'FINAL',
      teamAId: '',
      teamBId: '',
      teamAName: 'Thắng BK1 Serie A',
      teamBName: 'Thắng BK2 Serie A',
      subMatches: createDefaultSubMatches('tie_serieA_final', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
    {
      id: 'tie_serieB_sf1',
      organizerUid,
      tournamentId,
      stage: 'serieB',
      roundLabel: sf1BLabel,
      bracketSlot: 'SF1',
      teamAId: sb1.id,
      teamBId: sb2.id,
      teamAName: sb1.name,
      teamBName: sb2.name,
      subMatches: createDefaultSubMatches('tie_serieB_sf1', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
    {
      id: 'tie_serieB_sf2',
      organizerUid,
      tournamentId,
      stage: 'serieB',
      roundLabel: sf2BLabel,
      bracketSlot: 'SF2',
      teamAId: sb3.id,
      teamBId: sb4.id,
      teamAName: sb3.name,
      teamBName: sb4.name,
      subMatches: createDefaultSubMatches('tie_serieB_sf2', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
    {
      id: 'tie_serieB_final',
      organizerUid,
      tournamentId,
      stage: 'serieB',
      roundLabel: 'Chung kết · Serie B',
      bracketSlot: 'FINAL',
      teamAId: '',
      teamBId: '',
      teamAName: 'Thắng BK1 Serie B',
      teamBName: 'Thắng BK2 Serie B',
      subMatches: createDefaultSubMatches('tie_serieB_final', knockoutTargetPoints),
      tieBreak: null,
      status: 'upcoming',
      visibility: 'public',
    },
  ];
}

