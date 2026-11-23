import * as XLSX from 'xlsx';
import { computeGroupStandings, computeTeamTieSummary, getActiveGroupNames } from './seedData';
import type { AthleteProfile, Language, MatchRecord, Registration, TeamEntry, TeamTie, Tournament } from './types';

export interface TournamentStandingRow {
  rank: number;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  standingPoints: number;
}

export function computeTournamentStandings(matches: MatchRecord[]): TournamentStandingRow[] {
  const table = new Map<string, Omit<TournamentStandingRow, 'rank' | 'pointDiff'>>();

  const ensureTeam = (name: string) => {
    if (!table.has(name)) {
      table.set(name, {
        teamName: name,
        played: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        standingPoints: 0,
      });
    }
    return table.get(name)!;
  };

  for (const m of matches) {
    const teamA = ensureTeam(m.teamAName);
    const teamB = ensureTeam(m.teamBName);

    if (m.status === 'completed') {
      teamA.played += 1;
      teamB.played += 1;

      let totalA = m.scoreA;
      let totalB = m.scoreB;
      if (m.setHistory && m.setHistory.length > 0) {
        totalA = 0;
        totalB = 0;
        for (const setStr of m.setHistory) {
          const [a, b] = setStr.split('-').map((n) => Number(n) || 0);
          totalA += a;
          totalB += b;
        }
      }
      teamA.pointsFor += totalA;
      teamA.pointsAgainst += totalB;
      teamB.pointsFor += totalB;
      teamB.pointsAgainst += totalA;

      if (m.winnerSide === 'A') {
        teamA.wins += 1;
        teamA.standingPoints += 3;
        teamB.losses += 1;
      } else if (m.winnerSide === 'B') {
        teamB.wins += 1;
        teamB.standingPoints += 3;
        teamA.losses += 1;
      }
    }
  }

  return Array.from(table.values())
    .map((row) => ({
      ...row,
      pointDiff: row.pointsFor - row.pointsAgainst,
    }))
    .sort((a, b) => {
      if (b.standingPoints !== a.standingPoints) return b.standingPoints - a.standingPoints;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      return b.pointsFor - a.pointsFor;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export function exportTournamentToExcel(params: {
  tournament: Tournament;
  matches: MatchRecord[];
  registrations: Registration[];
  athletes: AthleteProfile[];
  language: Language;
}) {
  const { tournament, matches, registrations, athletes, language } = params;
  const wb = XLSX.utils.book_new();
  const isVi = language === 'vi';

  // Sheet 1: Tournament Overview
  const overviewRows = [
    [isVi ? 'Tên giải đấu' : 'Tournament', tournament.title],
    [isVi ? 'Địa điểm' : 'Location', `${tournament.location}, ${tournament.city}`],
    [isVi ? 'Ngày thi đấu' : 'Start Date', tournament.startDate],
    [isVi ? 'Hạng mục' : 'Category', tournament.category],
    [isVi ? 'Trần điểm DUPR' : 'Skill Cap', tournament.skillCap],
    [isVi ? 'Lệ phí tham gia (VNĐ)' : 'Entry Fee (VND)', tournament.entryFeeVnd],
    [isVi ? 'Tổng giải thưởng (VNĐ)' : 'Prize Pool (VND)', tournament.prizePoolVnd],
    [isVi ? 'Số đội đăng ký' : 'Registered Teams', `${tournament.registeredCount}/${tournament.maxTeams}`],
    [isVi ? 'Trạng thái' : 'Status', tournament.status.toUpperCase()],
    [isVi ? 'Ngày xuất báo cáo' : 'Exported At', new Date().toLocaleString(isVi ? 'vi-VN' : 'en-US')],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  wsOverview['!cols'] = [{ wch: 28 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, isVi ? 'TongQuan' : 'Overview');

  // Sheet 2: Match Results
  const matchRows = matches.map((m, idx) => ({
    '#': idx + 1,
    [isVi ? 'Vòng đấu' : 'Round']: m.roundLabel,
    [isVi ? 'Sân' : 'Court']: m.courtName,
    [isVi ? 'Đội A' : 'Team A']: m.teamAName,
    [isVi ? 'Đội B' : 'Team B']: m.teamBName,
    [isVi ? 'Tỷ số Set' : 'Sets']: `${m.setsA} - ${m.setsB}`,
    [isVi ? 'Chi tiết điểm' : 'Set Scores']: m.setHistory.length ? m.setHistory.join(', ') : `${m.scoreA}-${m.scoreB}`,
    [isVi ? 'Trạng thái' : 'Status']: m.status,
    [isVi ? 'Đội thắng' : 'Winner']:
      m.winnerSide === 'A' ? m.teamAName : m.winnerSide === 'B' ? m.teamBName : '-',
  }));
  const wsMatches = XLSX.utils.json_to_sheet(
    matchRows.length > 0 ? matchRows : [{ Info: isVi ? 'Chưa có trận đấu' : 'No matches yet' }]
  );
  wsMatches['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMatches, isVi ? 'KetQuaTranDau' : 'MatchResults');

  // Sheet 3: Standings
  const standings = computeTournamentStandings(matches);
  const standingRows = standings.map((s) => ({
    [isVi ? 'Hạng' : 'Rank']: s.rank,
    [isVi ? 'Đội / VĐV' : 'Team / Athlete']: s.teamName,
    [isVi ? 'Số trận' : 'Played']: s.played,
    [isVi ? 'Thắng' : 'Wins']: s.wins,
    [isVi ? 'Thua' : 'Losses']: s.losses,
    [isVi ? 'Điểm ghi' : 'PF']: s.pointsFor,
    [isVi ? 'Điểm mất' : 'PA']: s.pointsAgainst,
    [isVi ? 'Hiệu số' : 'Diff']: s.pointDiff,
    [isVi ? 'Điểm BXH' : 'Pts']: s.standingPoints,
  }));
  const wsStandings = XLSX.utils.json_to_sheet(
    standingRows.length > 0 ? standingRows : [{ Info: isVi ? 'Chưa có bảng xếp hạng' : 'No standings yet' }]
  );
  XLSX.utils.book_append_sheet(wb, wsStandings, isVi ? 'BangXepHang' : 'Standings');

  // Sheet 4: Registrations & VietQR Fees
  const regRows = registrations.map((r, idx) => ({
    '#': idx + 1,
    [isVi ? 'Đội / VĐV' : 'Team']: r.teamName,
    [isVi ? 'Đồng đội' : 'Partner']: r.partnerName || '-',
    [isVi ? 'Hạng mục' : 'Category']: r.category,
    [isVi ? 'Lệ phí (VNĐ)' : 'Fee (VND)']: r.amountVnd,
    [isVi ? 'Mã VietQR' : 'VietQR Ref']: r.transferCode,
    [isVi ? 'Trạng thái lệ phí' : 'Payment Status']: r.paymentStatus.toUpperCase(),
    [isVi ? 'Mã biên lai' : 'Receipt']: r.receiptCode || '-',
  }));
  const wsRegs = XLSX.utils.json_to_sheet(
    regRows.length > 0
      ? regRows
      : athletes.slice(0, 8).map((a, i) => ({
          '#': i + 1,
          [isVi ? 'Vận động viên' : 'Athlete']: a.displayName,
          [isVi ? 'CLB' : 'Club']: a.club,
          DUPR: a.duprRating,
        }))
  );
  XLSX.utils.book_append_sheet(wb, wsRegs, isVi ? 'LePhiVietQR' : 'Registrations');

  const safeSlug = tournament.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 32);

  XLSX.writeFile(wb, `1986_${safeSlug}_Report.xlsx`);
}

export function exportTeamCupToExcel(params: {
  teams: TeamEntry[];
  ties: TeamTie[];
  language: Language;
}) {
  const { teams, ties, language } = params;
  const wb = XLSX.utils.book_new();
  const isVi = language === 'vi';

  const activeGroups = getActiveGroupNames(teams, ties);
  const allStandings = activeGroups
    .flatMap((groupName) => computeGroupStandings(teams, ties, groupName))
    .map((row) => ({
    [isVi ? 'Bảng' : 'Group']: row.groupName,
    [isVi ? 'Hạng' : 'Rank']: row.rank,
    [isVi ? 'Đội tuyển' : 'Team']: row.teamName,
    [isVi ? 'Số lượt' : 'Played']: row.played,
    [isVi ? 'Thắng (3đ)' : 'Win (3pt)']: row.wins,
    [isVi ? 'Hòa 2-2 (2đ)' : 'Draw 2-2 (2pt)']: row.draws,
    [isVi ? 'Thua (1đ)' : 'Loss (1pt)']: row.losses,
    [isVi ? 'Bỏ cuộc (0đ)' : 'Forfeit (0pt)']: row.forfeits,
    [isVi ? 'Trận đôi T-B' : 'Sub W-L']: `${row.subWins}-${row.subLosses}`,
    [isVi ? 'HS Trận đôi' : 'Sub Diff']: row.subWins - row.subLosses,
    [isVi ? 'HS Điểm (+/-)' : 'Pt Diff (+/-)']: row.pointDiff,
    [isVi ? 'Tổng điểm' : 'Points']: row.points,
    [isVi ? 'Phân nhánh' : 'Bracket']: row.qualifiedSerie,
  }));

  const wsGroup = XLSX.utils.json_to_sheet(allStandings);
  XLSX.utils.book_append_sheet(wb, wsGroup, isVi ? 'BXH_VongBang' : 'GroupStandings');

  const tieRows = ties.map((tie, idx) => {
    const s = computeTeamTieSummary(tie);
    return {
      '#': idx + 1,
      [isVi ? 'Giai đoạn' : 'Stage']:
        tie.stage === 'group' ? tie.groupName || 'Vòng bảng' : tie.stage === 'serieA' ? 'Serie A' : 'Serie B',
      [isVi ? 'Vòng đấu' : 'Round']: tie.roundLabel,
      [isVi ? 'Đội A' : 'Team A']: tie.teamAName,
      [isVi ? 'Đội B' : 'Team B']: tie.teamBName,
      [isVi ? 'Tỷ số 4 nội dung' : 'Doubles Score']: `${s.doublesWinsA} - ${s.doublesWinsB}`,
      [isVi ? 'Đấu đơn Tie-break' : 'Singles Tie-break']: tie.tieBreak
        ? `${tie.tieBreak.mode === 'dreambreaker' ? 'Dreambreaker' : 'Đơn 1-1'} (${tie.tieBreak.scoreA}-${tie.tieBreak.scoreB})`
        : s.isGroupDraw22
          ? isVi
            ? 'Hòa 2-2 (Vòng bảng)'
            : '2-2 Draw (Group)'
          : '-',
      [isVi ? 'Kết quả' : 'Result']:
        s.forfeitSide
          ? `${s.winnerTeamName} (${isVi ? 'Thắng bỏ cuộc 15-0' : 'Win by Forfeit 15-0'})`
          : s.winnerSide === 'DRAW'
            ? isVi
              ? 'Hòa 2-2 (+2đ)'
              : 'Draw 2-2 (+2pt)'
            : s.winnerTeamName || (isVi ? 'Đang thi đấu' : 'In progress'),
    };
  });
  const wsTies = XLSX.utils.json_to_sheet(tieRows);
  XLSX.utils.book_append_sheet(wb, wsTies, isVi ? 'LichThiDau_SerieAB' : 'SerieAB_Ties');

  const rosterRows: Record<string, string | number>[] = [];
  for (const tm of teams) {
    for (const mb of tm.members) {
      rosterRows.push({
        [isVi ? 'Bảng' : 'Group']: tm.groupName,
        [isVi ? 'Đội' : 'Team']: tm.name,
        [isVi ? 'Vận động viên' : 'Athlete']: mb.name,
        [isVi ? 'Giới tính' : 'Gender']:
          mb.gender === 'male' ? (isVi ? 'Nam' : 'Male') : isVi ? 'Nữ' : 'Female',
        [isVi ? 'Trình độ' : 'Skill Tier']: mb.skillTier,
      });
    }
  }
  const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
  XLSX.utils.book_append_sheet(wb, wsRoster, isVi ? 'DanhSach_VDV_ABC' : 'TeamRosters');

  XLSX.writeFile(wb, `1986_TeamCup_SerieAB_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
