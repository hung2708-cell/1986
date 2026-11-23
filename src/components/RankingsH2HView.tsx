import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  Lock,
  LogIn,
  QrCode,
  ScanLine,
  Search,
  Share2,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { formatCheckInTime } from '../lib/athleteQr';
import {
  buildEntityFromAthlete,
  buildEntityFromName,
  buildEntityFromTeam,
  computeH2H,
  createEmptyH2HStats,
  type H2HContext,
} from '../lib/h2h';
import { t } from '../lib/i18n';
import type { ShareCardPayload } from '../lib/shareCard';
import type {
  AthleteProfile,
  Gender,
  Language,
  MatchRecord,
  SkillTier,
  TeamEntry,
  TeamTie,
  Tournament,
  TournamentCheckIn,
} from '../lib/types';
import { AnimatePresence } from 'motion/react';
import { AthleteProfileModal } from './AthleteProfileModal';

interface RankingsH2HViewProps {
  athletes: AthleteProfile[];
  teams: TeamEntry[];
  ties?: TeamTie[];
  tournaments: Tournament[];
  checkIns: TournamentCheckIn[];
  matches: MatchRecord[];
  language: Language;
  canManageAthletes: boolean;
  canShare?: boolean;
  onRequireAdminLogin?: () => void;
  onAddAthlete: (payload: {
    displayName: string;
    skillTier: SkillTier;
    gender: Gender;
    teamId?: string;
  }) => void;
  onDeleteAthlete: (athleteId: string) => void;
  onClearAllAthletes: () => void;
  onOpenAthleteQr: (athlete: AthleteProfile, tournamentId?: string) => void;
  onOpenQrScanner: (tournamentId?: string) => void;
  onOpenShare: (payload: ShareCardPayload) => void;
  onInspectH2H?: (context: H2HContext) => void;
}

const TIER_DUPR_HINT: Record<SkillTier, string> = {
  A: '4.50+',
  B: '3.75+',
  C: '3.00+',
};

export const RankingsH2HView: React.FC<RankingsH2HViewProps> = ({
  athletes,
  teams,
  ties = [],
  tournaments,
  checkIns,
  matches,
  language,
  canManageAthletes,
  canShare = true,
  onRequireAdminLogin,
  onAddAthlete,
  onDeleteAthlete,
  onClearAllAthletes,
  onOpenAthleteQr,
  onOpenQrScanner,
  onOpenShare,
  onInspectH2H,
}) => {
  const isVi = language === 'vi';
  const [subTab, setSubTab] = useState<'rankings' | 'h2h'>('rankings');
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all');
  const [tierFilter, setTierFilter] = useState<'all' | SkillTier>('all');
  const [sortBy, setSortBy] = useState<'dupr' | 'wins' | 'winRate'>('dupr');
  const [checkInTournamentId, setCheckInTournamentId] = useState<string>(tournaments[0]?.id || '');

  const activeCheckInTournamentId =
    tournaments.some((trn) => trn.id === checkInTournamentId)
      ? checkInTournamentId
      : tournaments[0]?.id || '';

  const checkInByAthleteId = useMemo(() => {
    const map = new Map<string, TournamentCheckIn>();
    for (const c of checkIns) {
      if (c.tournamentId === activeCheckInTournamentId && c.status === 'checked_in') {
        map.set(c.athleteId, c);
      }
    }
    return map;
  }, [checkIns, activeCheckInTournamentId]);

  // Add Athlete Form state (only open for verified Admin)
  const [showAddForm, setShowAddForm] = useState<boolean>(canManageAthletes && athletes.length === 0);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<SkillTier>('B');
  const [newGender, setNewGender] = useState<Gender>('male');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [profileModalAthlete, setProfileModalAthlete] = useState<AthleteProfile | null>(null);

  const [h2hMode, setH2hMode] = useState<'athletes' | 'teams'>('athletes');
  const [playerAId, setPlayerAId] = useState<string>(athletes[0]?.id || '');
  const [playerBId, setPlayerBId] = useState<string>(athletes[1]?.id || athletes[0]?.id || '');
  const [teamAId, setTeamAId] = useState<string>(teams[0]?.id || '');
  const [teamBId, setTeamBId] = useState<string>(teams[1]?.id || teams[0]?.id || '');

  const rankedAthletes = useMemo(() => {
    return [...athletes]
      .filter((a) => {
        if (genderFilter !== 'all' && a.gender !== genderFilter) return false;
        if (tierFilter !== 'all' && a.skillTier !== tierFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            a.displayName.toLowerCase().includes(q) ||
            a.club.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wins') return b.wins - a.wins;
        if (sortBy === 'winRate') {
          const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
          const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
          return rateB - rateA;
        }
        return b.duprRating - a.duprRating;
      });
  }, [athletes, genderFilter, tierFilter, search, sortBy]);

  const playerA = athletes.find((a) => a.id === playerAId) || athletes[0];
  const playerB = athletes.find((a) => a.id === playerBId) || athletes[1] || athletes[0];
  const teamA = teams.find((tm) => tm.id === teamAId) || teams[0];
  const teamB = teams.find((tm) => tm.id === teamBId) || teams[1] || teams[0];

  const h2hData = useMemo(() => {
    if (h2hMode === 'teams') {
      if (!teamA || !teamB || teamA.id === teamB.id) return createEmptyH2HStats();
      return computeH2H(
        buildEntityFromTeam(teamA, language),
        buildEntityFromTeam(teamB, language),
        matches,
        ties,
        teams
      );
    }
    if (!playerA || !playerB || playerA.id === playerB.id) {
      return createEmptyH2HStats();
    }
    return computeH2H(
      buildEntityFromAthlete(playerA, language),
      buildEntityFromAthlete(playerB, language),
      matches,
      ties,
      teams
    );
  }, [h2hMode, matches, ties, teams, playerA, playerB, teamA, teamB, language]);

  const inspectPlayerH2H = (
    athlete: AthleteProfile,
    opponentName?: string,
    highlightMatchId?: string
  ) => {
    if (onInspectH2H) {
      const sideA = buildEntityFromAthlete(athlete, language);
      const sideB = opponentName
        ? buildEntityFromName(opponentName, athletes, teams, language)
        : null;
      onInspectH2H({
        mode: 'profile',
        sideA,
        sideB,
        highlightMatchId,
      });
      return;
    }
    setPlayerAId(athlete.id);
    const rival = athletes.find((a) => a.id !== athlete.id);
    if (rival) setPlayerBId(rival.id);
    setSubTab('h2h');
  };

  const handleSubmitAthlete = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newName.trim();
    if (cleaned.length < 2) {
      setFormError(isVi ? 'Vui lòng nhập họ tên VĐV tối thiểu 2 ký tự.' : 'Name must be at least 2 characters.');
      return;
    }
    setFormError(null);
    onAddAthlete({
      displayName: cleaned,
      skillTier: newTier,
      gender: newGender,
      teamId: newTeamId || undefined,
    });
    setNewName('');
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
            {t(language, 'navRankings')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isVi
              ? 'Quản lý danh sách VĐV (Tên, Trình A/B/C, Giới tính), xếp hạng DUPR và thống kê đối đầu H2H.'
              : 'Manage athletes (Name, Tier A/B/C, Gender), live DUPR rankings, and H2H analytics.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {canManageAthletes ? (
            <>
              <button
                type="button"
                onClick={() => onOpenQrScanner(activeCheckInTournamentId || undefined)}
                className="min-h-[40px] px-3.5 rounded-lg text-xs font-semibold border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 inline-flex items-center gap-1.5"
              >
                <ScanLine className="w-4 h-4" />
                <span>{isVi ? 'Quét QR Check-in' : 'Scan QR Check-in'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubTab('rankings');
                  setShowAddForm((prev) => !prev);
                }}
                className="min-h-[40px] px-3.5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isVi ? 'Thêm VĐV' : 'Add Athlete'}</span>
              </button>
            </>
          ) : (
            onRequireAdminLogin && (
              <button
                type="button"
                onClick={onRequireAdminLogin}
                className="min-h-[40px] px-3.5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>{isVi ? 'Đăng nhập Admin để thêm VĐV' : 'Admin Sign In to Add'}</span>
              </button>
            )
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('rankings')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === 'rankings'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{t(language, 'rankingsTab')}</span>
              <span className="font-mono text-[11px] opacity-75">({athletes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('h2h')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                subTab === 'h2h'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>{t(language, 'h2hTab')}</span>
            </button>
          </div>
        </div>
      </div>

      {subTab === 'rankings' ? (
        <div className="space-y-5">
          {/* Admin-Only Notice when not signed in as Admin */}
          {!canManageAthletes && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {isVi ? 'Chức năng thêm / xóa VĐV chỉ dành cho tài khoản Admin' : 'Admin Account Required to Manage Athletes'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isVi
                      ? 'Vui lòng đăng nhập đúng tài khoản Google Admin để thêm vận động viên mới (Tên, Trình A/B/C, Giới tính).'
                      : 'Sign in with the verified Admin Google account to add or remove athletes.'}
                  </p>
                </div>
              </div>
              {onRequireAdminLogin && (
                <button
                  type="button"
                  onClick={onRequireAdminLogin}
                  className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isVi ? 'Đăng nhập Admin (Google)' : 'Admin Sign In (Google)'}</span>
                </button>
              )}
            </div>
          )}

          {/* Dedicated Add Athlete Form Card (Admin Only) */}
          {canManageAthletes && showAddForm && (
            <form
              onSubmit={handleSubmitAthlete}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                    {isVi ? 'Thêm Vận động viên mới' : 'Add New Athlete'}
                  </h2>
                </div>
                {athletes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    aria-label={isVi ? 'Đóng biểu mẫu' : 'Close form'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Name */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isVi ? 'Tên VĐV *' : 'Athlete Name *'}
                  </label>
                  <input
                    required
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={isVi ? 'VD: Nguyễn Văn An' : 'e.g., Nguyen Van An'}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  />
                </div>

                {/* Skill Tier A / B / C */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isVi ? 'Trình độ (A / B / C) *' : 'Skill Tier (A / B / C) *'}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['A', 'B', 'C'] as SkillTier[]).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setNewTier(tier)}
                        className={`min-h-[44px] rounded-lg border text-center transition-colors flex flex-col items-center justify-center leading-tight ${
                          newTier === tier
                            ? 'border-accent bg-accent-soft text-accent font-bold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-mono text-sm font-extrabold">{tier}</span>
                        <span className="font-mono text-[10px] opacity-75">{TIER_DUPR_HINT[tier]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isVi ? 'Giới tính *' : 'Gender *'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'male', label: isVi ? 'Nam' : 'Male' },
                        { id: 'female', label: isVi ? 'Nữ' : 'Female' },
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setNewGender(g.id)}
                        className={`min-h-[44px] rounded-lg border text-xs font-bold transition-colors ${
                          newGender === g.id
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Team Assignment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isVi ? 'Gắn vào Đội (tùy chọn)' : 'Assign Team (optional)'}
                  </label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100"
                  >
                    <option value="">
                      {isVi ? '-- Không gắn đội (VĐV tự do) --' : '-- No Team (Free Agent) --'}
                    </option>
                    {teams.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {tm.name} ({tm.groupName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formError && (
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{formError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isVi
                    ? 'VĐV mới sẽ tự động đồng bộ vào BXH và có thể chọn trực tiếp khi xếp cặp Giải Đồng đội.'
                    : 'New athletes sync immediately to the leaderboard and Team Cup rosters.'}
                </p>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isVi ? 'Lưu & Thêm VĐV' : 'Save & Add Athlete'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Athletes Table Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isVi ? 'Tìm tên VĐV, đội...' : 'Search athlete or team...'}
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {tournaments.length > 0 && (
                  <select
                    value={activeCheckInTournamentId}
                    onChange={(e) => setCheckInTournamentId(e.target.value)}
                    aria-label={isVi ? 'Giải đấu check-in' : 'Check-in tournament'}
                    className="min-h-[40px] max-w-[210px] px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                  >
                    {tournaments.map((trn) => (
                      <option key={trn.id} value={trn.id}>
                        {isVi ? 'Check-in: ' : 'Check-in: '}
                        {trn.title}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value as 'all' | Gender)}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">{isVi ? 'Mọi giới tính' : 'All Genders'}</option>
                  <option value="male">{isVi ? 'Nam' : 'Male'}</option>
                  <option value="female">{isVi ? 'Nữ' : 'Female'}</option>
                </select>

                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as 'all' | SkillTier)}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                >
                  <option value="all">{isVi ? 'Mọi trình độ' : 'All Tiers'}</option>
                  <option value="A">{isVi ? 'Trình A' : 'Tier A'}</option>
                  <option value="B">{isVi ? 'Trình B' : 'Tier B'}</option>
                  <option value="C">{isVi ? 'Trình C' : 'Tier C'}</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setSortBy((prev) =>
                      prev === 'dupr' ? 'wins' : prev === 'wins' ? 'winRate' : 'dupr'
                    )
                  }
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>
                    {sortBy === 'dupr'
                      ? 'DUPR'
                      : sortBy === 'wins'
                      ? isVi
                        ? 'Số trận thắng'
                        : 'Wins'
                      : t(language, 'winRate')}
                  </span>
                </button>

                {canManageAthletes && athletes.length > 0 && !confirmClearAll && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/70 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Xóa tất cả VĐV' : 'Clear All'}</span>
                  </button>
                )}

                {canManageAthletes && confirmClearAll && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      {isVi ? 'Xóa sạch danh sách?' : 'Clear everyone?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllAthletes();
                        setConfirmClearAll(false);
                        setShowAddForm(true);
                      }}
                      className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
                    >
                      {isVi ? 'Xác nhận' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1 rounded text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                    >
                      {isVi ? 'Hủy' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {athletes.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {isVi ? 'Danh sách VĐV đang trống' : 'No Athletes Yet'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {canManageAthletes
                      ? isVi
                        ? 'Toàn bộ VĐV mẫu đã được xóa sạch. Bạn đang ở quyền Admin — hãy thêm VĐV mới với Tên, Trình A/B/C và Giới tính.'
                        : 'All sample athletes have been cleared. As Admin, add new athletes with Name, Tier A/B/C, and Gender.'
                      : isVi
                        ? 'Toàn bộ VĐV mẫu đã được xóa sạch. Chỉ tài khoản Admin sau khi đăng nhập mới có thể thêm VĐV.'
                        : 'All sample athletes have been cleared. Only a signed-in Admin account can add athletes.'}
                  </p>
                </div>
                {canManageAthletes ? (
                  !showAddForm && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="min-h-[42px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isVi ? 'Thêm VĐV đầu tiên' : 'Add First Athlete'}</span>
                    </button>
                  )
                ) : (
                  onRequireAdminLogin && (
                    <button
                      type="button"
                      onClick={onRequireAdminLogin}
                      className="min-h-[42px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isVi ? 'Đăng nhập tài khoản Admin' : 'Sign In as Admin'}</span>
                    </button>
                  )
                )}
              </div>
            ) : rankedAthletes.length === 0 ? (
              <div className="py-10 px-6 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isVi ? 'Không tìm thấy VĐV phù hợp với bộ lọc.' : 'No athletes match the current filters.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setGenderFilter('all');
                    setTierFilter('all');
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {isVi ? 'Đặt lại bộ lọc' : 'Reset filters'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto touch-scroll-x">
                <table className="w-full min-w-[640px] text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400">
                      <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950 sticky-col-edge py-3 pl-3.5 sm:pl-5 pr-3 font-medium whitespace-nowrap min-w-[185px] sm:min-w-[230px]">
                        {t(language, 'rank')} · {t(language, 'athlete')}
                      </th>
                      <th className="py-3 px-3 font-medium whitespace-nowrap">
                        {isVi ? 'Giới tính' : 'Gender'}
                      </th>
                      <th className="py-3 px-3 font-medium whitespace-nowrap">
                        {isVi ? 'Trình' : 'Tier'}
                      </th>
                      <th className="py-3 px-3 font-medium whitespace-nowrap">
                        {isVi ? 'Trạng thái sân' : 'Check-in'}
                      </th>
                      <th className="py-3 px-3 font-medium whitespace-nowrap hidden md:table-cell">
                        {isVi ? 'Đội / CLB' : 'Team / Club'}
                      </th>
                      <th className="py-3 px-3 text-right font-medium whitespace-nowrap">
                        {t(language, 'dupr')}
                      </th>
                      <th className="py-3 px-3 text-right font-medium whitespace-nowrap">
                        {t(language, 'record')}
                      </th>
                      <th className="py-3 pl-3 pr-4 sm:pr-5 text-right font-medium whitespace-nowrap">
                        {isVi ? 'Mã QR & Thao tác' : 'QR & Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rankedAthletes.map((athlete, idx) => {
                      const checkInRec = checkInByAthleteId.get(athlete.id);
                      return (
                      <tr
                        key={athlete.id}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 sticky-col-edge py-3 pl-3.5 sm:pl-5 pr-3">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums w-5 shrink-0">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-soft text-accent font-bold text-[11px] sm:text-xs flex items-center justify-center shrink-0">
                              {athlete.avatarInitials}
                            </div>
                            <button
                              type="button"
                              onClick={() => setProfileModalAthlete(athlete)}
                              className="min-w-0 max-w-[140px] sm:max-w-[210px] text-left group/name"
                            >
                              <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate group-hover/name:text-accent transition-colors">
                                {athlete.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 md:hidden truncate">
                                {athlete.club}
                              </p>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {athlete.gender === 'female'
                            ? isVi
                              ? 'Nữ'
                              : 'Female'
                            : isVi
                              ? 'Nam'
                              : 'Male'}
                        </td>
                        <td className="py-3 px-3 font-mono text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {isVi ? `Trình ${athlete.skillTier || 'B'}` : `Tier ${athlete.skillTier || 'B'}`}
                        </td>
                        <td className="py-3 px-3 text-xs whitespace-nowrap">
                          {checkInRec ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isVi ? 'Có mặt' : 'Checked-in'} ·{' '}
                                <span className="font-mono text-[11px]">
                                  {formatCheckInTime(checkInRec.checkedInAtIso, language)}
                                </span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {isVi ? 'Chưa check-in' : 'Not checked-in'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell whitespace-nowrap">
                          {athlete.club}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-accent tabular-nums whitespace-nowrap">
                          {athlete.duprRating.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {athlete.wins}-{athlete.losses}
                        </td>
                        <td className="py-3 pl-3 pr-4 sm:pr-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenAthleteQr(athlete, activeCheckInTournamentId || undefined)}
                              className="min-h-[36px] px-2.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-100 hover:border-accent hover:text-accent inline-flex items-center gap-1 whitespace-nowrap"
                              title={isVi ? 'Xem & tải mã QR Check-in' : 'View & download Check-in QR'}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>{isVi ? 'Mã QR' : 'QR'}</span>
                            </button>
                            {athletes.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => inspectPlayerH2H(athlete)}
                                className="min-h-[36px] px-2 text-xs font-semibold text-accent hover:underline whitespace-nowrap"
                              >
                                H2H
                              </button>
                            )}
                            {canManageAthletes && (
                              <button
                                type="button"
                                onClick={() => onDeleteAthlete(athlete.id)}
                                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title={isVi ? 'Xóa VĐV' : 'Delete athlete'}
                                aria-label={isVi ? `Xóa ${athlete.displayName}` : `Delete ${athlete.displayName}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* H2H Mode Switcher & Detailed Comparison Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setH2hMode('athletes')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    h2hMode === 'athletes'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isVi ? `VĐV vs VĐV (${athletes.length})` : `Players (${athletes.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setH2hMode('teams')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    h2hMode === 'teams'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isVi ? `Đội vs Đội (${teams.length})` : `Teams (${teams.length})`}
                </button>
              </div>

              {onInspectH2H &&
                ((h2hMode === 'athletes' && playerA && playerB && playerA.id !== playerB.id) ||
                  (h2hMode === 'teams' && teamA && teamB && teamA.id !== teamB.id)) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (h2hMode === 'teams' && teamA && teamB) {
                        onInspectH2H({
                          mode: 'match',
                          sideA: buildEntityFromTeam(teamA, language),
                          sideB: buildEntityFromTeam(teamB, language),
                        });
                      } else if (playerA && playerB) {
                        onInspectH2H({
                          mode: 'match',
                          sideA: buildEntityFromAthlete(playerA, language),
                          sideB: buildEntityFromAthlete(playerB, language),
                        });
                      }
                    }}
                    className="min-h-[38px] px-3.5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center gap-1.5"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Mở bảng phân tích chuyên sâu' : 'Open Deep H2H Breakdown'}</span>
                  </button>
                )}
            </div>

            {(h2hMode === 'athletes' && athletes.length < 2) ||
            (h2hMode === 'teams' && teams.length < 2) ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Swords className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {h2hMode === 'teams'
                    ? isVi
                      ? 'Cần ít nhất 2 Đội tuyển để so sánh đối đầu đồng đội (H2H).'
                      : 'Add at least 2 teams to compare Team Head-to-Head.'
                    : isVi
                      ? 'Cần ít nhất 2 VĐV để so sánh đối đầu (H2H).'
                      : 'Add at least 2 athletes to compare Head-to-Head.'}
                </p>
                {h2hMode === 'athletes' &&
                  (canManageAthletes ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSubTab('rankings');
                        setShowAddForm(true);
                      }}
                      className="min-h-[40px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isVi ? 'Thêm VĐV ngay' : 'Add Athletes Now'}</span>
                    </button>
                  ) : (
                    onRequireAdminLogin && (
                      <button
                        type="button"
                        onClick={onRequireAdminLogin}
                        className="min-h-[40px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>{isVi ? 'Đăng nhập Admin để thêm VĐV' : 'Admin Sign In'}</span>
                      </button>
                    )
                  ))}
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {h2hMode === 'teams'
                      ? isVi
                        ? 'So sánh đối đầu Đội tuyển'
                        : 'Compare Team Entries'
                      : t(language, 'comparePlayers')}
                  </h2>
                  {canShare &&
                    ((h2hMode === 'athletes' && playerA && playerB) ||
                      (h2hMode === 'teams' && teamA && teamB)) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (h2hMode === 'teams' && teamA && teamB) {
                            onOpenShare({
                              title: isVi ? 'Đối đầu Đồng đội (H2H)' : 'Team Head-to-Head',
                              subtitle: `${teamA.groupName} vs ${teamB.groupName}`,
                              leftName: teamA.name,
                              rightName: teamB.name,
                              leftScore: String(h2hData.winsA),
                              rightScore: String(h2hData.winsB),
                              detailLine: `${h2hData.completedCount} ${isVi ? 'trận' : 'ties'} · ${
                                isVi ? 'Tổng điểm' : 'Points'
                              } ${h2hData.pointsA}-${h2hData.pointsB}`,
                            });
                          } else if (playerA && playerB) {
                            onOpenShare({
                              title: 'Head-to-Head Comparison',
                              subtitle: `${playerA.club} vs ${playerB.club}`,
                              leftName: playerA.displayName,
                              rightName: playerB.displayName,
                              leftScore: String(h2hData.winsA),
                              rightScore: String(h2hData.winsB),
                              detailLine: `DUPR ${playerA.duprRating.toFixed(2)} vs ${playerB.duprRating.toFixed(2)} · Points ${h2hData.pointsA}-${h2hData.pointsB}`,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 self-start sm:self-auto"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{t(language, 'shareResult')}</span>
                      </button>
                    )}
                </div>

                {h2hMode === 'teams' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        {isVi ? 'Chọn Đội A' : 'Select Team A'}
                      </label>
                      <select
                        value={teamA?.id || ''}
                        onChange={(e) => setTeamAId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name} ({tm.groupName} · {tm.members.length} VĐV)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        {isVi ? 'Chọn Đội B' : 'Select Team B'}
                      </label>
                      <select
                        value={teamB?.id || ''}
                        onChange={(e) => setTeamBId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name} ({tm.groupName} · {tm.members.length} VĐV)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        {t(language, 'selectPlayerA')}
                      </label>
                      <select
                        value={playerA?.id || ''}
                        onChange={(e) => setPlayerAId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {athletes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.displayName} ({a.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'} ·{' '}
                            {a.skillTier || 'B'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        {t(language, 'selectPlayerB')}
                      </label>
                      <select
                        value={playerB?.id || ''}
                        onChange={(e) => setPlayerBId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100"
                      >
                        {athletes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.displayName} ({a.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'} ·{' '}
                            {a.skillTier || 'B'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {((h2hMode === 'athletes' && playerA && playerB) ||
                  (h2hMode === 'teams' && teamA && teamB)) && (
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-3 items-center text-center py-5 border-y border-slate-200 dark:border-slate-800">
                      <div>
                        <p className="text-3xl sm:text-4xl font-extrabold font-mono text-accent tabular-nums">
                          {h2hData.winsA}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate px-2">
                          {h2hMode === 'teams' ? teamA!.name : playerA!.displayName}
                        </p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {h2hMode === 'teams'
                            ? `${teamA!.groupName} · ${teamA!.members.length} ${isVi ? 'VĐV' : 'players'}`
                            : `${playerA!.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'} · ${
                                isVi ? `Trình ${playerA!.skillTier || 'B'}` : `Tier ${playerA!.skillTier || 'B'}`
                              } · DUPR ${playerA!.duprRating.toFixed(2)}`}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400">HEAD TO HEAD</p>
                        <p className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {h2hData.completedCount} {isVi ? 'trận' : 'matches'}
                          {h2hData.draws > 0 ? ` · ${h2hData.draws} ${isVi ? 'hòa' : 'D'}` : ''}
                        </p>
                        <p className="text-[11px] font-mono text-accent tabular-nums">
                          {h2hData.winRateA}% vs {h2hData.winRateB}%
                        </p>
                      </div>

                      <div>
                        <p className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                          {h2hData.winsB}
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1 truncate px-2">
                          {h2hMode === 'teams' ? teamB!.name : playerB!.displayName}
                        </p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                          {h2hMode === 'teams'
                            ? `${teamB!.groupName} · ${teamB!.members.length} ${isVi ? 'VĐV' : 'players'}`
                            : `${playerB!.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'} · ${
                                isVi ? `Trình ${playerB!.skillTier || 'B'}` : `Tier ${playerB!.skillTier || 'B'}`
                              } · DUPR ${playerB!.duprRating.toFixed(2)}`}
                        </p>
                      </div>
                    </div>

                    {/* 6-Card Detailed H2H Metrics */}
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-center">
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Tổng điểm H2H' : 'Total Points'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                          {h2hData.pointsA} - {h2hData.pointsB}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'TB điểm / trận' : 'Avg Points'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                          {h2hData.avgPointsA} - {h2hData.avgPointsB}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Thị phần điểm' : 'Point Share'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-accent mt-1">
                          {h2hData.pointShareA}% - {100 - h2hData.pointShareA}%
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Trận sát nút' : 'Clutch Games'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                          {h2hData.closeWinsA} - {h2hData.closeWinsB}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isVi ? 'Chuỗi thắng dài' : 'Best Streak'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                          {h2hData.longestStreakA}W vs {h2hData.longestStreakB}W
                        </p>
                      </div>
                      <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {h2hData.duprExpectedWinA !== null
                            ? isVi
                              ? 'Xác suất DUPR'
                              : 'DUPR Odds'
                            : isVi
                              ? 'Tổng ván / trận con'
                              : 'Sets / Sub Won'}
                        </p>
                        <p className="text-base font-bold font-mono tabular-nums text-accent mt-1">
                          {h2hData.duprExpectedWinA !== null
                            ? `${h2hData.duprExpectedWinA}%`
                            : `${h2hData.setsWonA} - ${h2hData.setsWonB}`}
                        </p>
                      </div>
                    </div>

                    {/* Category & Court Quick Splits */}
                    {(h2hData.categoryBreakdown.length > 0 || h2hData.courtBreakdown.length > 0) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {h2hData.categoryBreakdown.length > 0 && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                              {isVi ? 'Theo nội dung / vòng đấu' : 'By Event / Stage'}
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                              {h2hData.categoryBreakdown.map((c) => (
                                <div
                                  key={c.key}
                                  className="px-3.5 py-2 flex items-center justify-between gap-2"
                                >
                                  <span className="text-slate-700 dark:text-slate-300 truncate">
                                    {isVi ? c.labelVi : c.labelEn}
                                  </span>
                                  <span className="font-mono font-bold tabular-nums shrink-0">
                                    <span className="text-accent">
                                      {c.winsA}-{c.winsB}
                                    </span>
                                    <span className="text-slate-400 mx-1">·</span>
                                    <span className="text-slate-500">
                                      {c.pointsA}-{c.pointsB}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {h2hData.courtBreakdown.length > 0 && (
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                              {isVi ? 'Hiệu suất theo Mặt sân' : 'Record by Court'}
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                              {h2hData.courtBreakdown.map((crt) => (
                                <div
                                  key={crt.courtName}
                                  className="px-3.5 py-2 flex items-center justify-between gap-2"
                                >
                                  <span className="text-slate-700 dark:text-slate-300 truncate">
                                    {crt.courtName} ({crt.played})
                                  </span>
                                  <span className="font-mono font-bold tabular-nums shrink-0">
                                    <span>
                                      {crt.winsA}-{crt.winsB}
                                    </span>
                                    <span className="text-slate-400 mx-1">·</span>
                                    <span
                                      className={
                                        crt.pointDiffA >= 0
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-rose-600 dark:text-rose-400'
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

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {t(language, 'h2hMatches')}
                      </h3>
                      {h2hData.encounters.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                          {t(language, 'noH2hMatches')}
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                          {h2hData.encounters.map((enc) => (
                            <div
                              key={enc.id}
                              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {enc.nameA} vs {enc.nameB}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {enc.tournamentTitle} · {enc.roundLabel} · {enc.courtName}
                                  {enc.scheduledTime ? ` · ${enc.scheduledTime}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                                {enc.setBreakdown && (
                                  <span className="text-slate-600 dark:text-slate-300">
                                    {enc.setBreakdown}
                                  </span>
                                )}
                                <span className="font-bold text-accent">
                                  {enc.scoreLabel}
                                </span>
                                {enc.status === 'completed' && (
                                  <span
                                    className={
                                      enc.marginA > 0
                                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                        : enc.marginA < 0
                                          ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                          : 'text-slate-400'
                                    }
                                  >
                                    {enc.marginA > 0 ? `+${enc.marginA}` : enc.marginA}đ
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {profileModalAthlete && (
          <AthleteProfileModal
            key={`athlete-profile-${profileModalAthlete.id}`}
            athlete={profileModalAthlete}
            athletes={athletes}
            teams={teams}
            ties={ties}
            matches={matches}
            checkIns={checkIns}
            language={language}
            onOpenQr={() => onOpenAthleteQr(profileModalAthlete, activeCheckInTournamentId || undefined)}
            onInspectH2H={
              athletes.length >= 2 || matches.length > 0
                ? (opponentName, highlightMatchId) =>
                    inspectPlayerH2H(profileModalAthlete, opponentName, highlightMatchId)
                : undefined
            }
            onClose={() => setProfileModalAthlete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
