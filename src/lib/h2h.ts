import { computeTeamTieSummary } from './seedData';
import type {
  AthleteProfile,
  Gender,
  Language,
  MatchRecord,
  SkillTier,
  TeamEntry,
  TeamTie,
} from './types';

export interface H2HEntity {
  kind: 'athlete' | 'team' | 'pair';
  id?: string;
  uid?: string;
  name: string;
  subtitle?: string;
  initials?: string;
  duprRating?: number;
  skillTier?: SkillTier;
  gender?: Gender;
  wins?: number;
  losses?: number;
  groupName?: string;
  memberCount?: number;
}

export interface H2HContext {
  mode: 'match' | 'profile';
  sideA: H2HEntity;
  sideB?: H2HEntity | null;
  highlightMatchId?: string;
  contextLabel?: string;
}

export interface H2HSubMatchBreakdown {
  id: string;
  type: 'womens_doubles' | 'mens_doubles' | 'mixed_1' | 'mixed_2' | 'tiebreak';
  labelVi: string;
  labelEn: string;
  teamAPlayers?: string;
  teamBPlayers?: string;
  scoreA: number;
  scoreB: number;
  winnerSide: '' | 'A' | 'B';
  forfeitSide?: '' | 'A' | 'B';
  status: 'upcoming' | 'live' | 'completed';
}

export interface H2HEncounter {
  id: string;
  source: 'match' | 'team_tie' | 'team_submatch';
  stageTag: 'group' | 'knockout' | 'match';
  tournamentTitle: string;
  roundLabel: string;
  courtName: string;
  scheduledTime?: string;
  status: 'upcoming' | 'live' | 'completed';
  nameA: string;
  nameB: string;
  scoreLabel: string;
  setBreakdown?: string;
  pointsA: number;
  pointsB: number;
  setsWonA: number;
  setsWonB: number;
  marginA: number;
  isCloseGame: boolean;
  isDecider: boolean;
  outcomeForA: 'win' | 'loss' | 'draw' | 'pending';
  ratingDelta?: number;
  isForfeit?: boolean;
  subMatches?: H2HSubMatchBreakdown[];
}

export interface H2HCategorySplit {
  key: string;
  labelVi: string;
  labelEn: string;
  played: number;
  winsA: number;
  winsB: number;
  draws: number;
  pointsA: number;
  pointsB: number;
}

export interface H2HCourtSplit {
  courtName: string;
  played: number;
  winsA: number;
  winsB: number;
  draws: number;
  pointDiffA: number;
}

export interface H2HHighlightMatch {
  encounterId: string;
  scoreLabel: string;
  pointsLabel: string;
  margin: number;
  roundLabel: string;
  tournamentTitle: string;
  courtName: string;
  winnerSide: 'A' | 'B' | 'draw';
}

export interface H2HStats {
  encounters: H2HEncounter[];
  completedCount: number;
  upcomingOrLiveCount: number;
  winsA: number;
  draws: number;
  winsB: number;
  winRateA: number;
  winRateB: number;
  pointsA: number;
  pointsB: number;
  pointDiffA: number;
  pointShareA: number;
  avgPointsA: number;
  avgPointsB: number;
  avgMarginA: number;
  setsWonA: number;
  setsWonB: number;
  closeGamesTotal: number;
  closeWinsA: number;
  closeWinsB: number;
  deciderTotal: number;
  deciderWinsA: number;
  deciderWinsB: number;
  longestStreakA: number;
  longestStreakB: number;
  biggestWinA: H2HHighlightMatch | null;
  biggestWinB: H2HHighlightMatch | null;
  closestMatch: H2HHighlightMatch | null;
  categoryBreakdown: H2HCategorySplit[];
  courtBreakdown: H2HCourtSplit[];
  marginTrendA: Array<{
    id: string;
    label: string;
    marginA: number;
    scoreLabel: string;
    outcomeForA: 'win' | 'loss' | 'draw';
  }>;
  duprExpectedWinA: number | null;
  recentFormA: Array<'W' | 'D' | 'L'>;
  currentStreak: { side: 'A' | 'B' | 'draw'; count: number } | null;
}

export interface H2HOpponentOption {
  entity: H2HEntity;
  meetings: number;
  winsForBase: number;
  lossesForBase: number;
  draws: number;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getInitials(name: string): string {
  const parts = name
    .replace(/\//g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '19';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function splitPairTokens(label: string): string[] {
  return label
    .split(/\s*[/&+]\s*/)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function entityMatchesLabel(entity: H2HEntity, label: string, uid?: string): boolean {
  if (entity.uid && uid && entity.uid === uid) return true;
  const normEntity = normalizeText(entity.name);
  const normLabel = normalizeText(label);
  if (!normEntity || !normLabel) return false;
  if (normEntity === normLabel) return true;

  if (entity.kind === 'athlete') {
    const labelTokens = splitPairTokens(label);
    if (labelTokens.some((tok) => tok === normEntity)) return true;
    if (normEntity.length >= 4 && normLabel.includes(normEntity)) return true;
    return false;
  }

  const entityTokens = splitPairTokens(entity.name).sort();
  const labelTokens = splitPairTokens(label).sort();
  if (
    entityTokens.length > 1 &&
    entityTokens.length === labelTokens.length &&
    entityTokens.every((tok, idx) => tok === labelTokens[idx])
  ) {
    return true;
  }

  return false;
}

function teamTieMatchesSide(entity: H2HEntity, teamId: string, teamName: string): boolean {
  if (entity.id && teamId && entity.id === teamId) return true;
  return normalizeText(entity.name) === normalizeText(teamName);
}

function parseSetPoints(match: MatchRecord): { ptsA: number; ptsB: number; setCount: number } {
  if (match.setHistory && match.setHistory.length > 0) {
    let ptsA = 0;
    let ptsB = 0;
    for (const s of match.setHistory) {
      const [p1, p2] = s.split('-').map((n) => Number(n) || 0);
      ptsA += p1;
      ptsB += p2;
    }
    return { ptsA, ptsB, setCount: match.setHistory.length };
  }
  return { ptsA: match.scoreA || 0, ptsB: match.scoreB || 0, setCount: 1 };
}

function isKnockoutRoundLabel(label: string): boolean {
  const norm = label.toLowerCase();
  return (
    norm.includes('chung kết') ||
    norm.includes('bán kết') ||
    norm.includes('tứ kết') ||
    norm.includes('serie') ||
    norm.includes('final') ||
    norm.includes('semi') ||
    norm.includes('quarter') ||
    norm.includes('knockout')
  );
}

export function buildEntityFromAthlete(athlete: AthleteProfile, language: Language): H2HEntity {
  const isVi = language === 'vi';
  const tierLabel = isVi ? `Trình ${athlete.skillTier || 'B'}` : `Tier ${athlete.skillTier || 'B'}`;
  const genderLabel =
    athlete.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M';
  return {
    kind: 'athlete',
    id: athlete.id,
    uid: athlete.ownerUid,
    name: athlete.displayName,
    initials: athlete.avatarInitials || getInitials(athlete.displayName),
    subtitle: `${tierLabel} · ${genderLabel} · DUPR ${athlete.duprRating.toFixed(2)}`,
    duprRating: athlete.duprRating,
    skillTier: athlete.skillTier || 'B',
    gender: athlete.gender || 'male',
    wins: athlete.wins,
    losses: athlete.losses,
  };
}

export function buildEntityFromTeam(team: TeamEntry, language: Language): H2HEntity {
  const isVi = language === 'vi';
  return {
    kind: 'team',
    id: team.id,
    name: team.name,
    initials: team.shortCode || getInitials(team.name),
    subtitle: `${team.groupName} · ${team.members.length} ${isVi ? 'VĐV' : 'players'} · ${team.city}`,
    groupName: team.groupName,
    memberCount: team.members.length,
  };
}

export function buildEntityFromName(
  name: string,
  athletes: AthleteProfile[],
  teams: TeamEntry[],
  language: Language,
  uid?: string
): H2HEntity {
  const norm = normalizeText(name);
  const matchedTeam = teams.find((tm) => normalizeText(tm.name) === norm);
  if (matchedTeam) return buildEntityFromTeam(matchedTeam, language);

  const matchedAthlete = athletes.find(
    (a) => (uid && a.ownerUid === uid) || normalizeText(a.displayName) === norm
  );
  if (matchedAthlete) return buildEntityFromAthlete(matchedAthlete, language);

  const tokens = splitPairTokens(name);
  const matchedPairAthletes = tokens
    .map((tok) => athletes.find((a) => normalizeText(a.displayName) === tok))
    .filter((a): a is AthleteProfile => Boolean(a));

  const avgDupr =
    matchedPairAthletes.length > 0
      ? Number(
          (
            matchedPairAthletes.reduce((sum, a) => sum + a.duprRating, 0) /
            matchedPairAthletes.length
          ).toFixed(2)
        )
      : undefined;

  const isPair = name.includes('/') || name.includes('&');
  return {
    kind: isPair ? 'pair' : 'athlete',
    uid,
    name: name.trim(),
    initials: getInitials(name),
    duprRating: avgDupr,
    subtitle: avgDupr
      ? `${isPair ? (language === 'vi' ? 'Cặp đôi' : 'Pair') : language === 'vi' ? 'VĐV' : 'Player'} · DUPR ${avgDupr.toFixed(2)}`
      : isPair
        ? language === 'vi'
          ? 'Cặp thi đấu đôi'
          : 'Doubles Pair'
        : language === 'vi'
          ? 'Vận động viên'
          : 'Athlete',
  };
}

export function buildMatchH2HContext(
  match: MatchRecord,
  athletes: AthleteProfile[],
  teams: TeamEntry[],
  language: Language
): H2HContext {
  return {
    mode: 'match',
    sideA: buildEntityFromName(match.teamAName, athletes, teams, language, match.playerAUid),
    sideB: buildEntityFromName(match.teamBName, athletes, teams, language, match.playerBUid),
    highlightMatchId: match.id,
    contextLabel: `${match.tournamentTitle || '1986'} · ${match.roundLabel} · ${match.courtName}`,
  };
}

export function buildTieH2HContext(
  tie: TeamTie,
  teams: TeamEntry[],
  athletes: AthleteProfile[],
  language: Language
): H2HContext {
  const teamA = teams.find((t) => t.id === tie.teamAId);
  const teamB = teams.find((t) => t.id === tie.teamBId);
  return {
    mode: 'match',
    sideA: teamA
      ? buildEntityFromTeam(teamA, language)
      : buildEntityFromName(tie.teamAName, athletes, teams, language),
    sideB: teamB
      ? buildEntityFromTeam(teamB, language)
      : buildEntityFromName(tie.teamBName, athletes, teams, language),
    highlightMatchId: tie.id,
    contextLabel: `${tie.roundLabel}${tie.courtName ? ` · ${tie.courtName}` : ''}${
      tie.scheduledTime ? ` · ${tie.scheduledTime}` : ''
    }`,
  };
}

export function createEmptyH2HStats(): H2HStats {
  return {
    encounters: [],
    completedCount: 0,
    upcomingOrLiveCount: 0,
    winsA: 0,
    draws: 0,
    winsB: 0,
    winRateA: 0,
    winRateB: 0,
    pointsA: 0,
    pointsB: 0,
    pointDiffA: 0,
    pointShareA: 50,
    avgPointsA: 0,
    avgPointsB: 0,
    avgMarginA: 0,
    setsWonA: 0,
    setsWonB: 0,
    closeGamesTotal: 0,
    closeWinsA: 0,
    closeWinsB: 0,
    deciderTotal: 0,
    deciderWinsA: 0,
    deciderWinsB: 0,
    longestStreakA: 0,
    longestStreakB: 0,
    biggestWinA: null,
    biggestWinB: null,
    closestMatch: null,
    categoryBreakdown: [],
    courtBreakdown: [],
    marginTrendA: [],
    duprExpectedWinA: null,
    recentFormA: [],
    currentStreak: null,
  };
}

export function computeH2H(
  sideA: H2HEntity | null | undefined,
  sideB: H2HEntity | null | undefined,
  matches: MatchRecord[],
  ties: TeamTie[],
  teams: TeamEntry[]
): H2HStats {
  if (!sideA || !sideB || normalizeText(sideA.name) === normalizeText(sideB.name)) {
    return createEmptyH2HStats();
  }

  const encounters: H2HEncounter[] = [];
  const teamById = new Map(teams.map((tm) => [tm.id, tm]));
  const categoryMap = new Map<string, H2HCategorySplit>();

  const bumpCategory = (
    key: string,
    labelVi: string,
    labelEn: string,
    outcome: 'win' | 'loss' | 'draw',
    ptsA: number,
    ptsB: number
  ) => {
    const existing = categoryMap.get(key) || {
      key,
      labelVi,
      labelEn,
      played: 0,
      winsA: 0,
      winsB: 0,
      draws: 0,
      pointsA: 0,
      pointsB: 0,
    };
    existing.played += 1;
    existing.pointsA += ptsA;
    existing.pointsB += ptsB;
    if (outcome === 'win') existing.winsA += 1;
    else if (outcome === 'loss') existing.winsB += 1;
    else existing.draws += 1;
    categoryMap.set(key, existing);
  };

  const resolveNames = (team: TeamEntry | undefined, playerIds: string[]): string => {
    if (!team || playerIds.length === 0) return '';
    return playerIds
      .map((pid) => team.members.find((m) => m.id === pid)?.name || '')
      .filter(Boolean)
      .join(' / ');
  };

  // 1. Regular Matches (Doubles / Singles)
  for (const m of matches) {
    const aIsTeamA = entityMatchesLabel(sideA, m.teamAName, m.playerAUid);
    const bIsTeamB = entityMatchesLabel(sideB, m.teamBName, m.playerBUid);
    const bIsTeamA = entityMatchesLabel(sideB, m.teamAName, m.playerAUid);
    const aIsTeamB = entityMatchesLabel(sideA, m.teamBName, m.playerBUid);

    const direct = aIsTeamA && bIsTeamB;
    const reversed = bIsTeamA && aIsTeamB;
    if (!direct && !reversed) continue;

    const { ptsA: rawPtsA, ptsB: rawPtsB, setCount } = parseSetPoints(m);
    const pointsForA = direct ? rawPtsA : rawPtsB;
    const pointsForB = direct ? rawPtsB : rawPtsA;

    const alignedSetsA = direct ? m.setsA : m.setsB;
    const alignedSetsB = direct ? m.setsB : m.setsA;
    const alignedScoreA = direct ? m.scoreA : m.scoreB;
    const alignedScoreB = direct ? m.scoreB : m.scoreA;

    const alignedSetHistory =
      m.setHistory && m.setHistory.length > 0
        ? m.setHistory.map((s) => {
            if (direct) return s;
            const [p1, p2] = s.split('-');
            return p2 !== undefined ? `${p2}-${p1}` : s;
          })
        : [];

    let outcomeForA: H2HEncounter['outcomeForA'] = 'pending';
    if (m.status === 'completed') {
      if (m.winnerSide === 'A') outcomeForA = direct ? 'win' : 'loss';
      else if (m.winnerSide === 'B') outcomeForA = direct ? 'loss' : 'win';
      else if (pointsForA > pointsForB) outcomeForA = 'win';
      else if (pointsForB > pointsForA) outcomeForA = 'loss';
      else outcomeForA = 'draw';
    }

    const scoreLabel =
      m.setsA > 0 || m.setsB > 0
        ? `${alignedSetsA} - ${alignedSetsB}`
        : `${alignedScoreA} - ${alignedScoreB}`;

    const marginA = pointsForA - pointsForB;
    const isKnockout = isKnockoutRoundLabel(m.roundLabel);
    const isDecider = setCount >= 3 || (alignedSetsA >= 1 && alignedSetsB >= 1 && alignedSetsA + alignedSetsB >= 3);
    const isCloseGame = m.status === 'completed' && (Math.abs(marginA) <= 2 || isDecider);

    const setsWonA = m.setsA > 0 || m.setsB > 0 ? alignedSetsA : outcomeForA === 'win' ? 1 : 0;
    const setsWonB = m.setsA > 0 || m.setsB > 0 ? alignedSetsB : outcomeForA === 'loss' ? 1 : 0;

    if (m.status === 'completed' && outcomeForA !== 'pending') {
      bumpCategory(
        isKnockout ? 'knockout_match' : 'group_match',
        isKnockout ? 'Loại trực tiếp (Đôi/Đơn)' : 'Vòng bảng (Đôi/Đơn)',
        isKnockout ? 'Knockout (Doubles/Singles)' : 'Group Stage (Doubles/Singles)',
        outcomeForA,
        pointsForA,
        pointsForB
      );
    }

    encounters.push({
      id: m.id,
      source: 'match',
      stageTag: isKnockout ? 'knockout' : 'match',
      tournamentTitle: m.tournamentTitle || '1986',
      roundLabel: m.roundLabel,
      courtName: m.courtName,
      scheduledTime: m.scheduledTime,
      status: m.status,
      nameA: direct ? m.teamAName : m.teamBName,
      nameB: direct ? m.teamBName : m.teamAName,
      scoreLabel,
      setBreakdown:
        alignedSetHistory.length > 0
          ? alignedSetHistory.join(' · ')
          : m.setsA > 0 || m.setsB > 0
            ? `${alignedScoreA}-${alignedScoreB}`
            : undefined,
      pointsA: pointsForA,
      pointsB: pointsForB,
      setsWonA,
      setsWonB,
      marginA,
      isCloseGame,
      isDecider,
      outcomeForA,
      ratingDelta: m.ratingDelta,
    });
  }

  // 2. Team Cup Ties (Team vs Team)
  const bothTeams = sideA.kind === 'team' && sideB.kind === 'team';
  if (bothTeams) {
    for (const tie of ties) {
      const direct =
        teamTieMatchesSide(sideA, tie.teamAId, tie.teamAName) &&
        teamTieMatchesSide(sideB, tie.teamBId, tie.teamBName);
      const reversed =
        teamTieMatchesSide(sideB, tie.teamAId, tie.teamAName) &&
        teamTieMatchesSide(sideA, tie.teamBId, tie.teamBName);
      if (!direct && !reversed) continue;

      const teamA = teamById.get(tie.teamAId);
      const teamB = teamById.get(tie.teamBId);
      const summary = computeTeamTieSummary(tie);
      const winsForA = direct ? summary.totalWinsA : summary.totalWinsB;
      const winsForB = direct ? summary.totalWinsB : summary.totalWinsA;
      let rawTiePtsA = 0;
      let rawTiePtsB = 0;
      if (tie.forfeitSide === 'A') {
        rawTiePtsA = 0;
        rawTiePtsB = 60;
      } else if (tie.forfeitSide === 'B') {
        rawTiePtsA = 60;
        rawTiePtsB = 0;
      } else {
        for (const sm of tie.subMatches) {
          rawTiePtsA += sm.scoreA || 0;
          rawTiePtsB += sm.scoreB || 0;
        }
        if (tie.tieBreak && tie.tieBreak.status === 'completed') {
          rawTiePtsA += tie.tieBreak.scoreA || 0;
          rawTiePtsB += tie.tieBreak.scoreB || 0;
        }
      }
      const ptsForA = direct ? rawTiePtsA : rawTiePtsB;
      const ptsForB = direct ? rawTiePtsB : rawTiePtsA;

      let outcomeForA: H2HEncounter['outcomeForA'] = 'pending';
      const isCompleted = tie.status === 'completed' || Boolean(tie.forfeitSide);
      if (isCompleted) {
        if (summary.winnerSide === 'A') outcomeForA = direct ? 'win' : 'loss';
        else if (summary.winnerSide === 'B') outcomeForA = direct ? 'loss' : 'win';
        else if (summary.isGroupDraw22) outcomeForA = 'draw';
      }

      const subMatches: H2HSubMatchBreakdown[] = tie.subMatches.map((sm) => {
        const playersA = resolveNames(teamA, sm.teamAPlayerIds);
        const playersB = resolveNames(teamB, sm.teamBPlayerIds);
        const alignedWinner: '' | 'A' | 'B' =
          sm.winnerSide === ''
            ? ''
            : direct
              ? sm.winnerSide
              : sm.winnerSide === 'A'
                ? 'B'
                : 'A';
        const sA = direct ? sm.scoreA : sm.scoreB;
        const sB = direct ? sm.scoreB : sm.scoreA;

        if (sm.status === 'completed' && alignedWinner) {
          const catMeta: Record<
            H2HSubMatchBreakdown['type'],
            { vi: string; en: string }
          > = {
            womens_doubles: { vi: 'Đôi Nữ', en: "Women's Doubles" },
            mens_doubles: { vi: 'Đôi Nam', en: "Men's Doubles" },
            mixed_1: { vi: 'Đôi Nam Nữ 1', en: 'Mixed Doubles 1' },
            mixed_2: { vi: 'Đôi Nam Nữ 2', en: 'Mixed Doubles 2' },
            tiebreak: { vi: 'Trận 5 Tie-break', en: 'Match 5 Tie-break' },
          };
          bumpCategory(
            sm.type,
            catMeta[sm.type].vi,
            catMeta[sm.type].en,
            alignedWinner === 'A' ? 'win' : 'loss',
            sA,
            sB
          );
        }

        return {
          id: sm.id,
          type: sm.type,
          labelVi: sm.labelVi,
          labelEn: sm.labelEn,
          teamAPlayers: direct ? playersA : playersB,
          teamBPlayers: direct ? playersB : playersA,
          scoreA: sA,
          scoreB: sB,
          winnerSide: alignedWinner,
          forfeitSide:
            !sm.forfeitSide
              ? ''
              : direct
                ? sm.forfeitSide
                : sm.forfeitSide === 'A'
                  ? 'B'
                  : 'A',
          status: sm.status,
        };
      });

      if (
        tie.tieBreak &&
        (tie.tieBreak.status !== 'upcoming' || tie.tieBreak.scoreA > 0 || tie.tieBreak.scoreB > 0)
      ) {
        const tb = tie.tieBreak;
        const playersA = resolveNames(teamA, tb.teamAPlayerIds);
        const playersB = resolveNames(teamB, tb.teamBPlayerIds);
        const alignedWinner: '' | 'A' | 'B' =
          tb.winnerSide === ''
            ? ''
            : direct
              ? tb.winnerSide
              : tb.winnerSide === 'A'
                ? 'B'
                : 'A';
        const sA = direct ? tb.scoreA : tb.scoreB;
        const sB = direct ? tb.scoreB : tb.scoreA;

        if (tb.status === 'completed' && alignedWinner) {
          bumpCategory(
            'tiebreak',
            'Trận 5 Tie-break / Đơn',
            'Match 5 Tie-break',
            alignedWinner === 'A' ? 'win' : 'loss',
            sA,
            sB
          );
        }

        subMatches.push({
          id: `${tie.id}_tb`,
          type: 'tiebreak',
          labelVi: tb.mode === 'dreambreaker' ? 'Trận 5 · Dreambreaker' : 'Trận 5 · Đấu đơn',
          labelEn: tb.mode === 'dreambreaker' ? 'Match 5 · Dreambreaker' : 'Match 5 · Singles',
          teamAPlayers: direct ? playersA : playersB,
          teamBPlayers: direct ? playersB : playersA,
          scoreA: sA,
          scoreB: sB,
          winnerSide: alignedWinner,
          forfeitSide:
            !tb.forfeitSide
              ? ''
              : direct
                ? tb.forfeitSide
                : tb.forfeitSide === 'A'
                  ? 'B'
                  : 'A',
          status: tb.status,
        });
      }

      const marginA = ptsForA - ptsForB;
      const isDecider = Boolean(summary.decidedByTieBreak);
      const isCloseGame =
        isCompleted && (isDecider || Math.abs(winsForA - winsForB) <= 1 || Math.abs(marginA) <= 5);

      encounters.push({
        id: tie.id,
        source: 'team_tie',
        stageTag: tie.stage === 'group' ? 'group' : 'knockout',
        tournamentTitle:
          tie.stage === 'group'
            ? `Giải Đồng đội · ${tie.groupName || 'Vòng bảng'}`
            : tie.stage === 'serieA'
              ? 'Giải Đồng đội · Serie A'
              : 'Giải Đồng đội · Serie B',
        roundLabel: tie.roundLabel,
        courtName: tie.courtName || 'Sân Đồng đội',
        scheduledTime: tie.scheduledTime,
        status: isCompleted ? 'completed' : tie.status,
        nameA: direct ? tie.teamAName : tie.teamBName,
        nameB: direct ? tie.teamBName : tie.teamAName,
        scoreLabel: `${winsForA} - ${winsForB}`,
        setBreakdown: `Điểm: ${ptsForA}-${ptsForB}`,
        pointsA: ptsForA,
        pointsB: ptsForB,
        setsWonA: winsForA,
        setsWonB: winsForB,
        marginA,
        isCloseGame,
        isDecider,
        outcomeForA,
        isForfeit: Boolean(tie.forfeitSide),
        subMatches,
      });
    }
  } else {
    // 3. Team Cup Sub-Matches & Tie-Breaks for Athlete vs Athlete or Pair vs Pair
    for (const tie of ties) {
      const teamA = teamById.get(tie.teamAId);
      const teamB = teamById.get(tie.teamBId);

      for (const sm of tie.subMatches) {
        const labelA = resolveNames(teamA, sm.teamAPlayerIds);
        const labelB = resolveNames(teamB, sm.teamBPlayerIds);
        if (!labelA || !labelB) continue;

        const direct = entityMatchesLabel(sideA, labelA) && entityMatchesLabel(sideB, labelB);
        const reversed = entityMatchesLabel(sideB, labelA) && entityMatchesLabel(sideA, labelB);
        if (!direct && !reversed) continue;

        const scoreForA = direct ? sm.scoreA : sm.scoreB;
        const scoreForB = direct ? sm.scoreB : sm.scoreA;
        let outcomeForA: H2HEncounter['outcomeForA'] = 'pending';
        if (sm.status === 'completed') {
          if (sm.winnerSide === 'A') outcomeForA = direct ? 'win' : 'loss';
          else if (sm.winnerSide === 'B') outcomeForA = direct ? 'loss' : 'win';
        }

        const marginA = scoreForA - scoreForB;
        const isCloseGame = sm.status === 'completed' && Math.abs(marginA) <= 2;

        if (sm.status === 'completed' && outcomeForA !== 'pending') {
          bumpCategory(
            sm.type,
            sm.labelVi.replace(/^\d+\.\s*/, ''),
            sm.labelEn.replace(/^\d+\.\s*/, ''),
            outcomeForA,
            scoreForA,
            scoreForB
          );
        }

        encounters.push({
          id: `${tie.id}_${sm.id}`,
          source: 'team_submatch',
          stageTag: tie.stage === 'group' ? 'group' : 'knockout',
          tournamentTitle: `${tie.teamAName} vs ${tie.teamBName}`,
          roundLabel: `${tie.roundLabel} · ${sm.labelVi}`,
          courtName: tie.courtName || 'Sân Đồng đội',
          scheduledTime: tie.scheduledTime,
          status: sm.status,
          nameA: direct ? labelA : labelB,
          nameB: direct ? labelB : labelA,
          scoreLabel: `${scoreForA} - ${scoreForB}`,
          pointsA: scoreForA,
          pointsB: scoreForB,
          setsWonA: outcomeForA === 'win' ? 1 : 0,
          setsWonB: outcomeForA === 'loss' ? 1 : 0,
          marginA,
          isCloseGame,
          isDecider: false,
          outcomeForA,
          isForfeit: Boolean(sm.forfeitSide),
        });
      }

      if (tie.tieBreak) {
        const tb = tie.tieBreak;
        const labelA = resolveNames(teamA, tb.teamAPlayerIds);
        const labelB = resolveNames(teamB, tb.teamBPlayerIds);
        if (labelA && labelB) {
          const direct = entityMatchesLabel(sideA, labelA) && entityMatchesLabel(sideB, labelB);
          const reversed = entityMatchesLabel(sideB, labelA) && entityMatchesLabel(sideA, labelB);
          if (direct || reversed) {
            const scoreForA = direct ? tb.scoreA : tb.scoreB;
            const scoreForB = direct ? tb.scoreB : tb.scoreA;
            let outcomeForA: H2HEncounter['outcomeForA'] = 'pending';
            if (tb.status === 'completed') {
              if (tb.winnerSide === 'A') outcomeForA = direct ? 'win' : 'loss';
              else if (tb.winnerSide === 'B') outcomeForA = direct ? 'loss' : 'win';
            }
            const marginA = scoreForA - scoreForB;

            if (tb.status === 'completed' && outcomeForA !== 'pending') {
              bumpCategory(
                'tiebreak',
                'Đấu đơn quyết định',
                'Deciding Singles',
                outcomeForA,
                scoreForA,
                scoreForB
              );
            }

            encounters.push({
              id: `${tie.id}_tb`,
              source: 'team_submatch',
              stageTag: tie.stage === 'group' ? 'group' : 'knockout',
              tournamentTitle: `${tie.teamAName} vs ${tie.teamBName}`,
              roundLabel: `${tie.roundLabel} · Đấu đơn quyết định`,
              courtName: tie.courtName || 'Sân Đồng đội',
              scheduledTime: tie.scheduledTime,
              status: tb.status,
              nameA: direct ? labelA : labelB,
              nameB: direct ? labelB : labelA,
              scoreLabel: `${scoreForA} - ${scoreForB}`,
              pointsA: scoreForA,
              pointsB: scoreForB,
              setsWonA: outcomeForA === 'win' ? 1 : 0,
              setsWonB: outcomeForA === 'loss' ? 1 : 0,
              marginA,
              isCloseGame: tb.status === 'completed' && Math.abs(marginA) <= 2,
              isDecider: true,
              outcomeForA,
              isForfeit: Boolean(tb.forfeitSide),
            });
          }
        }
      }
    }
  }

  // Sort: live first, then completed, then upcoming
  const statusOrder: Record<H2HEncounter['status'], number> = {
    live: 0,
    completed: 1,
    upcoming: 2,
  };
  encounters.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  let winsA = 0;
  let draws = 0;
  let winsB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let setsWonA = 0;
  let setsWonB = 0;
  let closeGamesTotal = 0;
  let closeWinsA = 0;
  let closeWinsB = 0;
  let deciderTotal = 0;
  let deciderWinsA = 0;
  let deciderWinsB = 0;
  let longestStreakA = 0;
  let longestStreakB = 0;
  let runA = 0;
  let runB = 0;
  let biggestWinA: H2HHighlightMatch | null = null;
  let biggestWinB: H2HHighlightMatch | null = null;
  let closestMatch: H2HHighlightMatch | null = null;

  const courtMap = new Map<string, H2HCourtSplit>();
  const completedOutcomes: Array<'W' | 'D' | 'L'> = [];
  const marginTrendA: H2HStats['marginTrendA'] = [];

  for (const enc of encounters) {
    if (enc.status !== 'completed') continue;

    pointsA += enc.pointsA;
    pointsB += enc.pointsB;
    setsWonA += enc.setsWonA;
    setsWonB += enc.setsWonB;

    if (enc.outcomeForA === 'win') {
      winsA += 1;
      completedOutcomes.push('W');
      runA += 1;
      runB = 0;
      if (runA > longestStreakA) longestStreakA = runA;
      if (!biggestWinA || enc.marginA > biggestWinA.margin) {
        biggestWinA = {
          encounterId: enc.id,
          scoreLabel: enc.scoreLabel,
          pointsLabel: `${enc.pointsA}-${enc.pointsB}`,
          margin: enc.marginA,
          roundLabel: enc.roundLabel,
          tournamentTitle: enc.tournamentTitle,
          courtName: enc.courtName,
          winnerSide: 'A',
        };
      }
    } else if (enc.outcomeForA === 'loss') {
      winsB += 1;
      completedOutcomes.push('L');
      runB += 1;
      runA = 0;
      if (runB > longestStreakB) longestStreakB = runB;
      const marginB = -enc.marginA;
      if (!biggestWinB || marginB > biggestWinB.margin) {
        biggestWinB = {
          encounterId: enc.id,
          scoreLabel: enc.scoreLabel,
          pointsLabel: `${enc.pointsA}-${enc.pointsB}`,
          margin: marginB,
          roundLabel: enc.roundLabel,
          tournamentTitle: enc.tournamentTitle,
          courtName: enc.courtName,
          winnerSide: 'B',
        };
      }
    } else if (enc.outcomeForA === 'draw') {
      draws += 1;
      completedOutcomes.push('D');
      runA = 0;
      runB = 0;
    }

    if (enc.isCloseGame) {
      closeGamesTotal += 1;
      if (enc.outcomeForA === 'win') closeWinsA += 1;
      else if (enc.outcomeForA === 'loss') closeWinsB += 1;
    }

    if (enc.isDecider) {
      deciderTotal += 1;
      if (enc.outcomeForA === 'win') deciderWinsA += 1;
      else if (enc.outcomeForA === 'loss') deciderWinsB += 1;
    }

    const absMargin = Math.abs(enc.marginA);
    if (!closestMatch || absMargin < closestMatch.margin) {
      closestMatch = {
        encounterId: enc.id,
        scoreLabel: enc.scoreLabel,
        pointsLabel: `${enc.pointsA}-${enc.pointsB}`,
        margin: absMargin,
        roundLabel: enc.roundLabel,
        tournamentTitle: enc.tournamentTitle,
        courtName: enc.courtName,
        winnerSide:
          enc.outcomeForA === 'win' ? 'A' : enc.outcomeForA === 'loss' ? 'B' : 'draw',
      };
    }

    const cName = enc.courtName || 'Sân 1';
    const cRow = courtMap.get(cName) || {
      courtName: cName,
      played: 0,
      winsA: 0,
      winsB: 0,
      draws: 0,
      pointDiffA: 0,
    };
    cRow.played += 1;
    cRow.pointDiffA += enc.marginA;
    if (enc.outcomeForA === 'win') cRow.winsA += 1;
    else if (enc.outcomeForA === 'loss') cRow.winsB += 1;
    else if (enc.outcomeForA === 'draw') cRow.draws += 1;
    courtMap.set(cName, cRow);

    if (enc.outcomeForA !== 'pending') {
      marginTrendA.push({
        id: enc.id,
        label: enc.roundLabel,
        marginA: enc.marginA,
        scoreLabel: enc.scoreLabel,
        outcomeForA: enc.outcomeForA,
      });
    }
  }

  const completedCount = winsA + draws + winsB;
  const upcomingOrLiveCount = encounters.length - completedCount;
  const winRateA = completedCount > 0 ? Math.round((winsA / completedCount) * 100) : 0;
  const winRateB = completedCount > 0 ? Math.round((winsB / completedCount) * 100) : 0;
  const totalPts = pointsA + pointsB;
  const pointShareA = totalPts > 0 ? Math.round((pointsA / totalPts) * 100) : 50;
  const avgPointsA = completedCount > 0 ? Number((pointsA / completedCount).toFixed(1)) : 0;
  const avgPointsB = completedCount > 0 ? Number((pointsB / completedCount).toFixed(1)) : 0;
  const avgMarginA =
    completedCount > 0 ? Number(((pointsA - pointsB) / completedCount).toFixed(1)) : 0;

  let currentStreak: H2HStats['currentStreak'] = null;
  if (completedOutcomes.length > 0) {
    const first = completedOutcomes[0];
    let count = 0;
    for (const o of completedOutcomes) {
      if (o === first) count += 1;
      else break;
    }
    currentStreak = {
      side: first === 'W' ? 'A' : first === 'L' ? 'B' : 'draw',
      count,
    };
  }

  const duprExpectedWinA =
    sideA.duprRating !== undefined && sideB.duprRating !== undefined
      ? Math.round((1 / (1 + Math.pow(10, (sideB.duprRating - sideA.duprRating) / 1.5))) * 100)
      : null;

  return {
    encounters,
    completedCount,
    upcomingOrLiveCount,
    winsA,
    draws,
    winsB,
    winRateA,
    winRateB,
    pointsA,
    pointsB,
    pointDiffA: pointsA - pointsB,
    pointShareA,
    avgPointsA,
    avgPointsB,
    avgMarginA,
    setsWonA,
    setsWonB,
    closeGamesTotal,
    closeWinsA,
    closeWinsB,
    deciderTotal,
    deciderWinsA,
    deciderWinsB,
    longestStreakA,
    longestStreakB,
    biggestWinA,
    biggestWinB,
    closestMatch,
    categoryBreakdown: Array.from(categoryMap.values()).sort((a, b) => b.played - a.played),
    courtBreakdown: Array.from(courtMap.values()).sort((a, b) =>
      a.courtName.localeCompare(b.courtName, 'vi', { numeric: true })
    ),
    marginTrendA: marginTrendA.slice(0, 8),
    duprExpectedWinA,
    recentFormA: completedOutcomes.slice(0, 5),
    currentStreak,
  };
}

export function listOpponentsForEntity(
  base: H2HEntity,
  athletes: AthleteProfile[],
  teams: TeamEntry[],
  matches: MatchRecord[],
  ties: TeamTie[],
  language: Language
): H2HOpponentOption[] {
  const candidates = new Map<string, H2HEntity>();
  const baseNorm = normalizeText(base.name);

  if (base.kind === 'team') {
    for (const tm of teams) {
      const k = normalizeText(tm.name);
      if (k === baseNorm) continue;
      candidates.set(k, buildEntityFromTeam(tm, language));
    }
    for (const tie of ties) {
      if (teamTieMatchesSide(base, tie.teamAId, tie.teamAName)) {
        const k = normalizeText(tie.teamBName);
        if (k !== baseNorm && !candidates.has(k)) {
          candidates.set(k, {
            kind: 'team',
            id: tie.teamBId,
            name: tie.teamBName,
            initials: getInitials(tie.teamBName),
          });
        }
      } else if (teamTieMatchesSide(base, tie.teamBId, tie.teamBName)) {
        const k = normalizeText(tie.teamAName);
        if (k !== baseNorm && !candidates.has(k)) {
          candidates.set(k, {
            kind: 'team',
            id: tie.teamAId,
            name: tie.teamAName,
            initials: getInitials(tie.teamAName),
          });
        }
      }
    }
  } else {
    for (const a of athletes) {
      const k = normalizeText(a.displayName);
      if (k === baseNorm) continue;
      candidates.set(k, buildEntityFromAthlete(a, language));
    }
    for (const m of matches) {
      if (entityMatchesLabel(base, m.teamAName, m.playerAUid)) {
        const k = normalizeText(m.teamBName);
        if (k !== baseNorm && !candidates.has(k)) {
          candidates.set(k, buildEntityFromName(m.teamBName, athletes, teams, language, m.playerBUid));
        }
      } else if (entityMatchesLabel(base, m.teamBName, m.playerBUid)) {
        const k = normalizeText(m.teamAName);
        if (k !== baseNorm && !candidates.has(k)) {
          candidates.set(k, buildEntityFromName(m.teamAName, athletes, teams, language, m.playerAUid));
        }
      }
    }
  }

  const options: H2HOpponentOption[] = [];
  for (const entity of candidates.values()) {
    const stats = computeH2H(base, entity, matches, ties, teams);
    options.push({
      entity,
      meetings: stats.encounters.length,
      winsForBase: stats.winsA,
      lossesForBase: stats.winsB,
      draws: stats.draws,
    });
  }

  options.sort((a, b) => {
    if (b.meetings !== a.meetings) return b.meetings - a.meetings;
    return a.entity.name.localeCompare(b.entity.name, 'vi');
  });

  return options;
}
