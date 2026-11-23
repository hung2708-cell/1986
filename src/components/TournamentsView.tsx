import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  GitBranch,
  LayoutGrid,
  Lock,
  LogIn,
  MapPin,
  Plus,
  QrCode,
  Radio,
  Receipt,
  ScanLine,
  Search,
  Share2,
  Shirt,
  Shuffle,
  Trophy,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { LiveBracketCourtBoard } from './LiveBracketCourtBoard';
import { MotionModal } from './MotionModal';
import { formatCheckInTime } from '../lib/athleteQr';
import { computeTournamentStandings, exportTournamentToExcel } from '../lib/excelExport';
import { t } from '../lib/i18n';
import { HERO_COURT_IMAGE, TOURNAMENT_BANNER_IMAGE } from '../lib/seedData';
import type { ShareCardPayload } from '../lib/shareCard';
import type {
  AthleteProfile,
  Gender,
  Language,
  MatchRecord,
  Registration,
  SkillTier,
  Tournament,
  TournamentCheckIn,
  TournamentFormat,
} from '../lib/types';
import { formatVnd } from '../lib/vietqr';

interface TournamentsViewProps {
  tournaments: Tournament[];
  matches: MatchRecord[];
  registrations: Registration[];
  athletes: AthleteProfile[];
  checkIns: TournamentCheckIn[];
  language: Language;
  currentUid: string | null;
  currentUserName: string | null;
  isAdmin: boolean;
  showCreateModal: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
  onSignIn: () => void;
  onJumpToLive: () => void;
  onJumpToTeamCup?: () => void;
  onCreateTournament: (
    payload: Omit<Tournament, 'id' | 'organizerUid' | 'registeredCount' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'>
  ) => Promise<string | void>;
  onRegisterTournament: (
    tournament: Tournament,
    teamName: string,
    partnerName: string,
    combinedDupr: number,
    meta: { gender: Gender; skillTier: SkillTier; partnerGender?: Gender | ''; partnerSkillTier?: SkillTier | '' }
  ) => Promise<Registration | null>;
  onRunRandomDraw: (tournament: Tournament) => Promise<void>;
  onOpenVietQR: (tournament: Tournament, registration: Registration) => void;
  onOpenQrScanner: (tournamentId: string) => void;
  onOpenAthleteQr: (athlete: AthleteProfile, tournamentId?: string) => void;
  onUndoCheckIn?: (checkInId: string) => Promise<void>;
  onToggleKitIssued?: (checkInId: string) => Promise<void>;
  onOpenRefereeMatch?: (match: MatchRecord) => void;
  onCallToCourt?: (match: MatchRecord) => void;
  onStartMatch?: (match: MatchRecord) => void;
  onInspectMatchH2H?: (match: MatchRecord) => void;
  onInspectProfileH2H?: (name: string) => void;
  onOpenShare: (payload: ShareCardPayload) => void;
  canShare?: boolean;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  tournaments,
  matches,
  registrations,
  athletes,
  checkIns,
  language,
  currentUid,
  currentUserName,
  isAdmin,
  showCreateModal,
  onCloseCreateModal,
  onOpenCreateModal,
  onSignIn,
  onJumpToLive,
  onJumpToTeamCup,
  onCreateTournament,
  onRegisterTournament,
  onRunRandomDraw,
  onOpenVietQR,
  onOpenQrScanner,
  onOpenAthleteQr,
  onUndoCheckIn,
  onToggleKitIssued,
  onOpenRefereeMatch,
  onCallToCourt,
  onStartMatch,
  onInspectMatchH2H,
  onInspectProfileH2H,
  onOpenShare,
  canShare = true,
}) => {
  const isSignedIn = Boolean(currentUid);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'live' | 'completed'>('all');
  const [filterFormat, setFilterFormat] = useState<'all' | TournamentFormat>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'bracket' | 'courts'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(tournaments[0]?.id || '');
  const [registerModalTournament, setRegisterModalTournament] = useState<Tournament | null>(null);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [partnerInput, setPartnerInput] = useState('');
  const [duprInput, setDuprInput] = useState('4.50');
  const [genderInput, setGenderInput] = useState<Gender>('male');
  const [tierInput, setTierInput] = useState<SkillTier>('B');
  const [partnerGenderInput, setPartnerGenderInput] = useState<Gender>('female');
  const [partnerTierInput, setPartnerTierInput] = useState<SkillTier>('B');
  const [drawing, setDrawing] = useState(false);

  // Create tournament form state
  const [newFormat, setNewFormat] = useState<TournamentFormat>('doubles');
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCity, setNewCity] = useState('TP.HCM');
  const [newDate, setNewDate] = useState('2026-12-28');
  const [newCategory, setNewCategory] = useState('Đôi Nam 5.5');
  const [newSkillCap, setNewSkillCap] = useState('10.0');
  const [newFee, setNewFee] = useState('500000');
  const [newMaxTeams, setNewMaxTeams] = useState('16');
  const [newPrize, setNewPrize] = useState('30000000');
  const [newBankCode, setNewBankCode] = useState('VCB');
  const [newBankAccount, setNewBankAccount] = useState('1029485712');
  const [newBankOwner, setNewBankOwner] = useState('CLB 1986 VN');

  const handleSelectFormat = (fmt: TournamentFormat) => {
    setNewFormat(fmt);
    if (fmt === 'team') {
      if (!newCategory.trim() || newCategory === 'Đôi Nam 5.5') {
        setNewCategory('Đồng đội 4 nội dung (Serie A/B)');
      }
      if (newMaxTeams === '16') setNewMaxTeams('8');
      if (newFee === '500000') setNewFee('2000000');
    } else {
      if (!newCategory.trim() || newCategory === 'Đồng đội 4 nội dung (Serie A/B)') {
        setNewCategory('Đôi Nam 5.5');
      }
      if (newMaxTeams === '8') setNewMaxTeams('16');
      if (newFee === '2000000') setNewFee('500000');
    }
  };

  const formatLabel = (fmt?: TournamentFormat) => {
    const resolved: TournamentFormat = fmt || 'doubles';
    if (language === 'vi') return resolved === 'team' ? 'Đồng đội' : 'Đôi';
    return resolved === 'team' ? 'Team Cup' : 'Doubles';
  };

  const filteredTournaments = useMemo(() => {
    return tournaments.filter((trn) => {
      const trnFormat: TournamentFormat = trn.format || 'doubles';
      if (filterFormat !== 'all' && trnFormat !== filterFormat) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'live' && trn.status !== 'live' && trn.status !== 'drawn') return false;
        if (filterStatus !== 'live' && trn.status !== filterStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          trn.title.toLowerCase().includes(q) ||
          trn.location.toLowerCase().includes(q) ||
          trn.city.toLowerCase().includes(q) ||
          trn.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tournaments, filterStatus, filterFormat, searchQuery]);

  const activeTournament =
    tournaments.find((item) => item.id === selectedId) || filteredTournaments[0] || tournaments[0];

  const tournamentMatches = useMemo(
    () => (activeTournament ? matches.filter((m) => m.tournamentId === activeTournament.id) : []),
    [matches, activeTournament]
  );

  const tournamentRegistrations = useMemo(
    () =>
      activeTournament
        ? registrations.filter((r) => r.tournamentId === activeTournament.id)
        : [],
    [registrations, activeTournament]
  );

  const tournamentCheckIns = useMemo(
    () =>
      activeTournament
        ? checkIns
            .filter((c) => c.tournamentId === activeTournament.id && c.status === 'checked_in')
            .sort((a, b) => (b.checkedInAtIso || '').localeCompare(a.checkedInAtIso || ''))
        : [],
    [checkIns, activeTournament]
  );

  const checkInCountByTournament = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkIns) {
      if (c.status === 'checked_in') {
        map.set(c.tournamentId, (map.get(c.tournamentId) || 0) + 1);
      }
    }
    return map;
  }, [checkIns]);

  const standings = useMemo(
    () => computeTournamentStandings(tournamentMatches),
    [tournamentMatches]
  );

  const openCount = tournaments.filter((x) => x.status === 'open').length;
  const liveCourtsCount = matches.filter((m) => m.status === 'live').length;

  const statusLabel = (status: Tournament['status']) => {
    const map = {
      vi: { open: 'Đang mở đăng ký', drawn: 'Đã bốc thăm', live: 'Đang thi đấu', completed: 'Đã hoàn thành' },
      en: { open: 'Registration Open', drawn: 'Bracket Drawn', live: 'Live Now', completed: 'Completed' },
    };
    return map[language][status];
  };

  const handleOpenRegister = (trn: Tournament) => {
    setTeamNameInput(currentUserName || '');
    setPartnerInput('');
    setDuprInput('4.50');
    setGenderInput('male');
    setTierInput('B');
    setPartnerGenderInput('female');
    setPartnerTierInput('B');
    setRegisterModalTournament(trn);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerModalTournament || !teamNameInput.trim()) return;
    const combinedTeam = partnerInput.trim()
      ? `${teamNameInput.trim()} / ${partnerInput.trim()}`
      : teamNameInput.trim();
    const createdReg = await onRegisterTournament(
      registerModalTournament,
      combinedTeam,
      partnerInput.trim(),
      Number(duprInput) || 4.5,
      {
        gender: genderInput,
        skillTier: tierInput,
        partnerGender: partnerInput.trim() ? partnerGenderInput : '',
        partnerSkillTier: partnerInput.trim() ? partnerTierInput : '',
      }
    );
    const targetTrn = registerModalTournament;
    setRegisterModalTournament(null);
    if (createdReg) {
      onOpenVietQR(targetTrn, createdReg);
    }
  };

  const handleDraw = async (trn: Tournament) => {
    setDrawing(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      await onRunRandomDraw(trn);
    } finally {
      setDrawing(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLocation.trim()) return;
    const createdId = await onCreateTournament({
      title: newTitle.trim(),
      format: newFormat,
      location: newLocation.trim(),
      city: newCity.trim() || 'TP.HCM',
      startDate: newDate,
      category:
        newCategory.trim() ||
        (newFormat === 'team' ? 'Đồng đội 4 nội dung (Serie A/B)' : 'Đôi Nam 5.5'),
      skillCap: Number(newSkillCap) || 10.0,
      entryFeeVnd: Number(newFee) || (newFormat === 'team' ? 2000000 : 500000),
      maxTeams: Number(newMaxTeams) || (newFormat === 'team' ? 8 : 16),
      prizePoolVnd: Number(newPrize) || 20000000,
      bankCode: newBankCode,
      bankAccount: newBankAccount.trim(),
      bankAccountName: newBankOwner.trim(),
    });
    if (createdId) {
      setSelectedId(createdId);
      setFilterFormat('all');
      setFilterStatus('all');
    }
    setNewTitle('');
    setNewLocation('');
    onCloseCreateModal();
  };

  return (
    <div className="space-y-8">
      {/* Hero Split Banner (2-column balanced height + clean contrast scrim) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[240px] sm:min-h-[280px] flex flex-col justify-end p-5 sm:p-8 bg-slate-900">
          <img
            src={HERO_COURT_IMAGE}
            alt="Pickleball Championship Court"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/20" />
          <div className="relative z-10 max-w-xl space-y-2.5 sm:space-y-3">
            <p className="text-[11px] sm:text-xs font-semibold text-amber-300 tracking-wide">
              Bính Dần 1986 · Vietnam Pickleball Tour 2026
            </p>
            <h1 className="text-[clamp(1.375rem,5.2vw,1.875rem)] font-extrabold text-white leading-tight tracking-tight">
              {t(language, 'heroTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {t(language, 'heroSubtitle')}
            </p>
            <div className="pt-1.5 flex flex-wrap items-center gap-2.5">
              {activeTournament && (
                <button
                  onClick={() => handleOpenRegister(activeTournament)}
                  className="min-h-[44px] px-4 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold btn-accent whitespace-nowrap"
                >
                  {t(language, 'heroPrimaryCta')}
                </button>
              )}
              <button
                onClick={onJumpToLive}
                className="min-h-[44px] px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-white/15 hover:bg-white/25 text-white backdrop-blur-sm border border-white/20 transition-colors whitespace-nowrap"
              >
                {t(language, 'heroSecondaryCta')}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="relative h-44 sm:h-48 overflow-hidden bg-slate-900">
            <img
              src={TOURNAMENT_BANNER_IMAGE}
              alt="Pickleball Tournament Paddles"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-5 right-5 text-white">
              <p className="text-xs text-slate-200">
                {language === 'vi' ? 'Giải đấu nổi bật' : 'Featured Event'}
              </p>
              <p className="font-bold text-base truncate">
                {activeTournament
                  ? activeTournament.title
                  : language === 'vi'
                    ? 'Sẵn sàng khởi tạo giải 1986'
                    : 'Ready to launch your first 1986 event'}
              </p>
            </div>
          </div>
          {activeTournament ? (
            <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-accent">{formatLabel(activeTournament.format)}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTournament.city}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTournament.startDate}</span>
                <span aria-hidden="true">·</span>
                <span>{activeTournament.category}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    {t(language, 'entryFee')}
                  </span>
                  <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatVnd(activeTournament.entryFeeVnd)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    {t(language, 'prizePool')}
                  </span>
                  <span className="font-mono font-bold text-base text-accent tabular-nums">
                    {formatVnd(activeTournament.prizePoolVnd)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {isSignedIn
                  ? language === 'vi'
                    ? 'Danh sách giải đấu đang trống (không có giải mẫu). Tạo mới giải Đôi hoặc giải Đồng đội để mở đăng ký, check-in QR và bốc thăm nhánh.'
                    : 'No sample tournaments. Create your own Doubles or Team Cup tournament to open registration, QR check-in, and live brackets.'
                  : language === 'vi'
                    ? 'Danh sách giải đấu đang trống. Vui lòng đăng nhập tài khoản Google trước để khởi tạo giải Đôi hoặc giải Đồng đội mới.'
                    : 'No tournaments yet. Please sign in with Google first to create a new Doubles or Team Cup tournament.'}
              </p>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="min-h-[40px] px-4 rounded-lg text-xs font-semibold btn-accent w-full"
                >
                  {language === 'vi' ? '+ Khởi tạo giải đấu đầu tiên' : '+ Create First Tournament'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="min-h-[40px] px-4 rounded-lg text-xs font-semibold btn-accent w-full inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{language === 'vi' ? 'Đăng nhập để tạo giải' : 'Sign In to Create Tournament'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Full-Width 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t(language, 'kpiActiveTournaments'), value: openCount, sub: language === 'vi' ? 'Sẵn sàng đăng ký' : 'Open slots' },
          { label: t(language, 'kpiLiveCourts'), value: liveCourtsCount, sub: language === 'vi' ? 'Cập nhật trực tuyến' : 'Real-time feed' },
          { label: t(language, 'kpiRankedAthletes'), value: athletes.length, sub: 'DUPR Verified' },
          { label: t(language, 'kpiMatchesLogged'), value: matches.length, sub: language === 'vi' ? 'Đồng bộ đám mây' : 'Cloud synced' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </section>

      {/* Prominent Competition Format Chooser: Doubles vs Team Cup */}
      <section className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-white font-display">
              {language === 'vi' ? 'Chọn thể thức thi đấu' : 'Select Competition Format'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {language === 'vi'
                ? 'Chọn Thi đấu Đôi hoặc Thi đấu Đồng đội để lọc danh sách giải và khởi tạo giải theo đúng thể thức.'
                : 'Choose Doubles or Team Cup to filter tournaments and pre-configure new tournament creation.'}
            </p>
          </div>
          {filterFormat !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterFormat('all')}
              className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
            >
              {language === 'vi' ? 'Xem tất cả thể thức' : 'Show all formats'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-3 ${
              filterFormat === 'doubles'
                ? 'border-accent bg-accent-soft ring-1 ring-orange-500/30'
                : 'border-stone-200 dark:border-stone-800 bg-[#FAF7F2]/60 dark:bg-stone-950/60 hover:border-stone-300 dark:hover:border-stone-700'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setFilterFormat('doubles');
                handleSelectFormat('doubles');
              }}
              className="text-left space-y-1 w-full"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-base font-extrabold font-display ${filterFormat === 'doubles' ? 'text-accent' : 'text-stone-900 dark:text-white'}`}>
                  {language === 'vi' ? 'Thi đấu Đôi' : 'Doubles Format'}
                </span>
                <Users className={`w-4 h-4 shrink-0 ${filterFormat === 'doubles' ? 'text-accent' : 'text-stone-400'}`} />
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {language === 'vi'
                  ? 'Đôi Nam · Đôi Nữ · Đôi Nam-Nữ · Bốc thăm nhánh trực tiếp & tính điểm DUPR.'
                  : 'Men’s · Women’s · Mixed Doubles · Direct random draw & live DUPR ratings.'}
              </p>
            </button>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/70 dark:border-stone-800">
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                {tournaments.filter((tr) => (tr.format || 'doubles') === 'doubles').length}{' '}
                {language === 'vi' ? 'giải Đôi' : 'events'}
              </span>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectFormat('doubles');
                    onOpenCreateModal();
                  }}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
                >
                  {language === 'vi' ? '+ Tạo giải Đôi' : '+ New Doubles'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>{language === 'vi' ? 'Đăng nhập để tạo' : 'Sign in to create'}</span>
                </span>
              )}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-3 ${
              filterFormat === 'team'
                ? 'border-accent bg-accent-soft ring-1 ring-orange-500/30'
                : 'border-stone-200 dark:border-stone-800 bg-[#FAF7F2]/60 dark:bg-stone-950/60 hover:border-stone-300 dark:hover:border-stone-700'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setFilterFormat('team');
                handleSelectFormat('team');
              }}
              className="text-left space-y-1 w-full"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-base font-extrabold font-display ${filterFormat === 'team' ? 'text-accent' : 'text-stone-900 dark:text-white'}`}>
                  {language === 'vi' ? 'Thi đấu Đồng đội' : 'Team Cup Format'}
                </span>
                <GitBranch className={`w-4 h-4 shrink-0 ${filterFormat === 'team' ? 'text-accent' : 'text-stone-400'}`} />
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {language === 'vi'
                  ? 'Vòng bảng 4 trận đôi (3-2-1-0) · Chia nhánh Serie A & B 2D · Chống trùng sân.'
                  : 'Group 4 doubles (3-2-1-0) · Automatic Serie A & B 2D bracket · Conflict-free courts.'}
              </p>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200/70 dark:border-stone-800">
              <span className="text-xs font-mono text-stone-500 dark:text-stone-400 tabular-nums">
                {tournaments.filter((tr) => tr.format === 'team').length}{' '}
                {language === 'vi' ? 'giải Đồng đội' : 'events'}
              </span>
              <div className="flex items-center gap-2">
                {onJumpToTeamCup && (
                  <button
                    type="button"
                    onClick={onJumpToTeamCup}
                    className="min-h-[36px] px-3 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-white/60 dark:hover:bg-stone-900 whitespace-nowrap"
                  >
                    {language === 'vi' ? 'Mở Sơ đồ 2D' : 'Open 2D'}
                  </button>
                )}
                {isSignedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFormat('team');
                      onOpenCreateModal();
                    }}
                    className="min-h-[36px] px-3 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
                  >
                    {language === 'vi' ? '+ Tạo giải Đồng đội' : '+ New Team Cup'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
                    <Lock className="w-3.5 h-3.5 text-accent" />
                    <span>{language === 'vi' ? 'Đăng nhập để tạo' : 'Sign in to create'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-lg overflow-x-auto max-w-full">
            {(
              [
                ['all', t(language, 'filterAll')],
                ['open', t(language, 'filterOpen')],
                ['live', t(language, 'filterLive')],
                ['completed', t(language, 'filterCompleted')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  filterStatus === key
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/80 rounded-lg">
            {(
              [
                ['all', language === 'vi' ? 'Mọi thể thức' : 'All Formats'],
                ['doubles', language === 'vi' ? 'Đôi' : 'Doubles'],
                ['team', language === 'vi' ? 'Đồng đội' : 'Team'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterFormat(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  filterFormat === key
                    ? 'bg-white dark:bg-stone-900 text-accent font-semibold shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(language, 'searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
          {isSignedIn && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t(language, 'createTournament')}</span>
            </button>
          )}
        </div>
      </section>

      {/* Main Split Workspace: Tournament List + Active Tournament Operations */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Tournament Directory */}
        <div className="lg:col-span-5 space-y-3">
          {filteredTournaments.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {tournaments.length === 0
                  ? language === 'vi'
                    ? 'Chưa có giải Đôi hoặc Đồng đội nào'
                    : 'No Doubles or Team Cup tournaments yet'
                  : language === 'vi'
                    ? 'Không tìm thấy giải đấu phù hợp'
                    : 'No tournaments match your filter'}
              </p>
              {tournaments.length === 0 ? (
                isSignedIn ? (
                  <button
                    type="button"
                    onClick={onOpenCreateModal}
                    className="min-h-[40px] px-4 rounded-lg text-xs font-semibold btn-accent"
                  >
                    {language === 'vi' ? '+ Tạo giải đấu mới' : '+ Create Tournament'}
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'vi'
                        ? 'Vui lòng đăng nhập tài khoản để khởi tạo giải đấu mới.'
                        : 'Please sign in to create a new tournament.'}
                    </p>
                    <button
                      type="button"
                      onClick={onSignIn}
                      className="min-h-[40px] px-4 rounded-lg text-xs font-semibold btn-accent inline-flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{language === 'vi' ? 'Đăng nhập (Google)' : 'Sign In (Google)'}</span>
                    </button>
                  </div>
                )
              ) : (
                <button
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterFormat('all');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {language === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filters'}
                </button>
              )}
            </div>
          ) : (
            filteredTournaments.map((trn) => {
              const selected = activeTournament?.id === trn.id;
              return (
                <button
                  key={trn.id}
                  onClick={() => setSelectedId(trn.id)}
                  className={`w-full text-left p-5 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-white dark:bg-slate-900 border-accent ring-1 ring-orange-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-snug">
                      {trn.title}
                    </h3>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                        trn.status === 'live'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : trn.status === 'open'
                          ? 'text-accent'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {statusLabel(trn.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-accent">
                      {formatLabel(trn.format)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {trn.location}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Calendar className="w-3.5 h-3.5" />
                      {trn.startDate}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 truncate">
                      {trn.category} · DUPR ≤ <span className="font-mono tabular-nums">{trn.skillCap.toFixed(1)}</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap shrink-0">
                      {(checkInCountByTournament.get(trn.id) || 0) > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 mr-2">
                          ✓ {checkInCountByTournament.get(trn.id)} {language === 'vi' ? 'có mặt' : 'in'}
                        </span>
                      )}
                      {trn.registeredCount}/{trn.maxTeams} · {formatVnd(trn.entryFeeVnd)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Active Tournament Control Center */}
        {activeTournament && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-accent">
                  {language === 'vi' ? `Thể thức ${formatLabel(activeTournament.format)}` : formatLabel(activeTournament.format)} · {activeTournament.category} · {statusLabel(activeTournament.status)}
                </p>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {activeTournament.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeTournament.location}, {activeTournament.city} · {activeTournament.startDate} ·{' '}
                  {t(language, 'entryFee')}:{' '}
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatVnd(activeTournament.entryFeeVnd)}
                  </span>
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleOpenRegister(activeTournament)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold btn-accent whitespace-nowrap"
              >
                <Receipt className="w-4 h-4" />
                <span>{t(language, 'registerNow')}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenQrScanner(activeTournament.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 whitespace-nowrap"
              >
                <ScanLine className="w-4 h-4" />
                <span>
                  {language === 'vi'
                    ? `Quét QR Check-in (${tournamentCheckIns.length})`
                    : `Scan QR Check-in (${tournamentCheckIns.length})`}
                </span>
              </button>

              {(activeTournament.format || 'doubles') === 'team' && onJumpToTeamCup && (
                <button
                  onClick={onJumpToTeamCup}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold border border-accent bg-accent-soft text-accent hover:opacity-90 whitespace-nowrap"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>
                    {language === 'vi' ? 'Quản lý Đồng đội & Sơ đồ 2D' : 'Team Cup & 2D Bracket'}
                  </span>
                </button>
              )}

              <button
                disabled={drawing}
                onClick={() => void handleDraw(activeTournament)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
              >
                <Shuffle className={`w-4 h-4 ${drawing ? 'animate-spin' : ''}`} />
                <span>
                  {drawing
                    ? language === 'vi'
                      ? 'Đang bốc thăm...'
                      : 'Drawing...'
                    : t(language, 'randomDraw')}
                </span>
              </button>

              <button
                onClick={() =>
                  exportTournamentToExcel({
                    tournament: activeTournament,
                    matches: tournamentMatches,
                    registrations: tournamentRegistrations,
                    athletes,
                    language,
                  })
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t(language, 'exportExcel')}</span>
              </button>

              {canShare && (
                <button
                  onClick={() => {
                    const topTeam = standings[0];
                    const secondTeam = standings[1];
                    onOpenShare({
                      title: activeTournament.title,
                      subtitle: `${activeTournament.category} · ${activeTournament.city}`,
                      leftName: topTeam?.teamName || 'Top Seed #1',
                      rightName: secondTeam?.teamName || 'Top Seed #2',
                      leftScore: String(topTeam?.standingPoints ?? 0),
                      rightScore: String(secondTeam?.standingPoints ?? 0),
                      detailLine: `${tournamentMatches.length} matches · Prize Pool ${formatVnd(activeTournament.prizePoolVnd)}`,
                    });
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{t(language, 'shareResult')}</span>
                </button>
              )}
            </div>

            {/* SportConnect Tournament Workspace Sub-tabs: Overview / Live Bracket / Court Calling Board */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800/80 overflow-x-auto touch-scroll-x no-scrollbar">
              {(
                [
                  {
                    id: 'overview',
                    icon: LayoutGrid,
                    label: language === 'vi' ? 'Tổng quan & Check-in' : 'Overview & Check-in',
                  },
                  {
                    id: 'bracket',
                    icon: GitBranch,
                    label:
                      language === 'vi'
                        ? `Sơ đồ nhánh (${tournamentMatches.length})`
                        : `Live Bracket (${tournamentMatches.length})`,
                  },
                  {
                    id: 'courts',
                    icon: Radio,
                    label: language === 'vi' ? 'Bảng gọi sân' : 'Court Board',
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDetailTab(tab.id)}
                  className={`flex-1 min-h-[38px] px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${
                    detailTab === tab.id
                      ? 'bg-white dark:bg-stone-900 text-accent shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {detailTab !== 'overview' ? (
              <LiveBracketCourtBoard
                mode={detailTab === 'bracket' ? 'bracket' : 'courts'}
                tournament={activeTournament}
                matches={tournamentMatches}
                language={language}
                onRunDraw={() => void handleDraw(activeTournament)}
                onOpenReferee={onOpenRefereeMatch}
                onCallToCourt={(m) => onCallToCourt && onCallToCourt(m)}
                onStartMatch={onStartMatch}
                onInspectMatchH2H={onInspectMatchH2H}
              />
            ) : (
              <>
            {/* Real-Time Tournament Standings Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <span>{t(language, 'tournamentStandings')}</span>
                </h3>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {tournamentMatches.length} {language === 'vi' ? 'trận' : 'matches'}
                </span>
              </div>

              {standings.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {language === 'vi'
                      ? 'Chưa có nhánh đấu cho giải này. Nhấn "Bốc thăm ngẫu nhiên" để khởi tạo cặp đấu.'
                      : 'No bracket matches yet. Click "Random Draw" to generate matchups.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto touch-scroll-x -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full min-w-[420px] text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="sticky left-0 z-20 bg-white dark:bg-slate-900 sticky-col-edge py-2.5 pr-3 font-medium whitespace-nowrap min-w-[165px]">
                          # · {t(language, 'athlete')}
                        </th>
                        <th className="py-2.5 px-2.5 text-right font-medium whitespace-nowrap">{t(language, 'record')}</th>
                        <th className="py-2.5 px-2.5 text-right font-medium whitespace-nowrap">{t(language, 'pointDiff')}</th>
                        <th className="py-2.5 pl-2.5 text-right font-medium whitespace-nowrap">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {standings.map((row) => (
                        <tr
                          key={row.teamName}
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/90 sticky-col-edge py-2.5 pr-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums w-4 shrink-0">
                                {row.rank}
                              </span>
                              {onInspectProfileH2H ? (
                                <button
                                  type="button"
                                  onClick={() => onInspectProfileH2H(row.teamName)}
                                  className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100 hover:text-accent transition-colors truncate max-w-[140px] sm:max-w-[210px] text-left"
                                  title={language === 'vi' ? 'Nhấn xem lịch sử đối đầu H2H' : 'Click to inspect Head-to-Head'}
                                >
                                  {row.teamName}
                                </button>
                              ) : (
                                <span className="font-medium text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[210px]">
                                  {row.teamName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono text-xs sm:text-sm tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {row.wins}-{row.losses}
                          </td>
                          <td
                            className={`py-2.5 px-2.5 text-right font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap ${
                              row.pointDiff >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </td>
                          <td className="py-2.5 pl-2.5 text-right font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            {row.standingPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Registrations & VietQR Fee Status */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>{t(language, 'registeredTeams')}</span>
                </h3>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {tournamentRegistrations.length} {language === 'vi' ? 'đơn đăng ký' : 'entries'}
                </span>
              </div>

              {tournamentRegistrations.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'vi'
                    ? 'Hãy là đội đầu tiên đăng ký giải đấu này bằng nút Đăng ký & VietQR.'
                    : 'Be the first team to register using Register & VietQR.'}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tournamentRegistrations.map((reg) => {
                    const canManage =
                      isAdmin ||
                      currentUid === activeTournament.organizerUid ||
                      currentUid === reg.athleteUid;
                    return (
                      <div
                        key={reg.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {reg.teamName}
                            {(reg.gender || reg.skillTier) && (
                              <span className="ml-2 text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                                {reg.gender === 'female'
                                  ? language === 'vi'
                                    ? 'Nữ'
                                    : 'F'
                                  : reg.gender === 'male'
                                    ? language === 'vi'
                                      ? 'Nam'
                                      : 'M'
                                    : ''}
                                {reg.skillTier ? ` · ${language === 'vi' ? `Trình ${reg.skillTier}` : `Tier ${reg.skillTier}`}` : ''}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {reg.transferCode} · {formatVnd(reg.amountVnd)}
                            {reg.receiptCode ? ` · ${reg.receiptCode}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-semibold ${
                              reg.paymentStatus === 'verified'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : reg.paymentStatus === 'paid'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {reg.paymentStatus === 'verified'
                              ? language === 'vi'
                                ? 'Đã duyệt lệ phí'
                                : 'Verified'
                              : reg.paymentStatus === 'paid'
                              ? language === 'vi'
                                ? 'Đã chuyển · Chờ duyệt'
                                : 'Paid · Pending'
                              : language === 'vi'
                              ? 'Chưa thanh toán'
                              : 'Pending'}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => onOpenVietQR(activeTournament, reg)}
                              className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
                            >
                              {language === 'vi' ? 'Mở VietQR / Biên lai' : 'VietQR / Receipt'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Venue QR Check-in Attendance Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {language === 'vi'
                      ? 'Điểm danh QR tại sân (Đã có mặt)'
                      : 'Venue QR Check-in (Checked-in)'}
                  </span>
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {tournamentCheckIns.length} {language === 'vi' ? 'VĐV có mặt' : 'checked-in'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenQrScanner(activeTournament.id)}
                    className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Mở máy quét QR' : 'Open QR Scanner'}</span>
                  </button>
                </div>
              </div>

              {tournamentCheckIns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi'
                      ? 'Chưa có VĐV nào quét QR điểm danh vào giải đấu này. Admin có thể mở máy quét QR tại bàn BTC.'
                      : 'No athletes checked-in yet. Admin can scan athlete QR passes at the venue desk.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {tournamentCheckIns.map((ci) => {
                    const matchedAthlete = athletes.find((a) => a.id === ci.athleteId);
                    return (
                      <div
                        key={ci.id}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {ci.athleteName}
                            <span className="ml-2 text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                              {ci.gender === 'female'
                                ? language === 'vi'
                                  ? 'Nữ'
                                  : 'F'
                                : language === 'vi'
                                  ? 'Nam'
                                  : 'M'}
                              {ci.skillTier
                                ? ` · ${language === 'vi' ? `Trình ${ci.skillTier}` : `Tier ${ci.skillTier}`}`
                                : ''}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {ci.club || '1986 Club'} ·{' '}
                            {language === 'vi' ? 'Check-in lúc' : 'Checked-in at'}{' '}
                            {formatCheckInTime(ci.checkedInAtIso, language)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Đã có mặt' : 'Checked-in'}</span>
                          </span>
                          {isAdmin && onToggleKitIssued && (
                            <button
                              type="button"
                              onClick={() => void onToggleKitIssued(ci.id)}
                              className={`min-h-[30px] px-2 rounded-lg text-[11px] font-semibold border inline-flex items-center gap-1 transition-colors ${
                                ci.kitIssued
                                  ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                  : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-white'
                              }`}
                              title={language === 'vi' ? 'Đánh dấu đã nhận áo / Race Kit' : 'Toggle Race Kit issued'}
                            >
                              <Shirt className="w-3.5 h-3.5" />
                              <span>{ci.kitIssued ? (language === 'vi' ? 'Đã nhận áo' : 'Kit OK') : language === 'vi' ? 'Phát áo' : 'Kit'}</span>
                            </button>
                          )}
                          {matchedAthlete && (
                            <button
                              type="button"
                              onClick={() => onOpenAthleteQr(matchedAthlete, activeTournament.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-accent hover:bg-accent-soft"
                              title={language === 'vi' ? 'Xem thẻ QR' : 'View QR pass'}
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && onUndoCheckIn && (
                            <button
                              type="button"
                              onClick={() => void onUndoCheckIn(ci.id)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              title={language === 'vi' ? 'Hủy check-in' : 'Undo check-in'}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              </>
            )}
          </div>
        )}

        {!activeTournament && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center space-y-4">
            {isSignedIn ? (
              <Trophy className="w-8 h-8 text-accent mx-auto" />
            ) : (
              <Lock className="w-8 h-8 text-accent mx-auto" />
            )}
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-display">
                {isSignedIn
                  ? language === 'vi'
                    ? 'Bắt đầu tổ chức giải đấu 1986 của riêng bạn'
                    : 'Start organizing your own 1986 tournament'
                  : language === 'vi'
                    ? 'Đăng nhập để sử dụng chức năng tạo giải đấu'
                    : 'Sign in required to create a tournament'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isSignedIn
                  ? language === 'vi'
                    ? 'Chọn khởi tạo giải Đôi (bốc thăm nhánh trực tiếp & DUPR) hoặc giải Đồng đội (4 trận đôi, chia nhánh Serie A/B 2D).'
                    : 'Create a Doubles event (direct bracket & DUPR) or Team Cup event (4 doubles/tie, Serie A/B 2D bracket).'
                  : language === 'vi'
                    ? 'Phần khởi tạo giải Đôi và giải Đồng đội chỉ hiển thị sau khi bạn đăng nhập tài khoản Google.'
                    : 'Doubles and Team Cup tournament creation unlocks after signing in with your Google account.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {isSignedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFormat('doubles');
                      onOpenCreateModal();
                    }}
                    className="min-h-[42px] px-4 rounded-lg text-xs font-semibold btn-accent"
                  >
                    {language === 'vi' ? '+ Tạo giải Đôi' : '+ New Doubles Event'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectFormat('team');
                      onOpenCreateModal();
                    }}
                    className="min-h-[42px] px-4 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent-soft"
                  >
                    {language === 'vi' ? '+ Tạo giải Đồng đội' : '+ New Team Cup'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="min-h-[42px] px-5 rounded-lg text-xs font-semibold btn-accent inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{language === 'vi' ? 'Đăng nhập (Google)' : 'Sign In (Google)'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Register Modal (Bottom Sheet on mobile, centered dialog on desktop) */}
      <AnimatePresence>
        {registerModalTournament && (
          <MotionModal
            key="register-tournament-modal"
            variant="sheet"
            ariaLabel={t(language, 'registerNow')}
            onBackdropClick={() => setRegisterModalTournament(null)}
            onEscape={() => setRegisterModalTournament(null)}
            overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
            panelClassName="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe space-y-5 shadow-2xl"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {t(language, 'registerNow')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {registerModalTournament.title} · {formatVnd(registerModalTournament.entryFeeVnd)}
                </p>
              </div>
              <button
                onClick={() => setRegisterModalTournament(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitRegistration(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {(registerModalTournament.format || 'doubles') === 'team'
                    ? language === 'vi'
                      ? 'Tên đội tuyển / CLB'
                      : 'Team / Club Name'
                    : language === 'vi'
                      ? 'Tên vận động viên chính'
                      : 'Primary Athlete Name'}
                </label>
                <input
                  required
                  maxLength={80}
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  placeholder={
                    (registerModalTournament.format || 'doubles') === 'team'
                      ? 'CLB Bính Dần 1986'
                      : 'Nguyễn Văn A'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t(language, 'genderLabel')} *
                  </label>
                  <select
                    value={genderInput}
                    onChange={(e) => setGenderInput(e.target.value as Gender)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="male">{t(language, 'genderMale')}</option>
                    <option value="female">{t(language, 'genderFemale')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t(language, 'skillTierLabel')} *
                  </label>
                  <select
                    value={tierInput}
                    onChange={(e) => setTierInput(e.target.value as SkillTier)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100"
                  >
                    <option value="A">{language === 'vi' ? 'Trình A (Cao cấp)' : 'Tier A (Advanced)'}</option>
                    <option value="B">{language === 'vi' ? 'Trình B (Trung cấp)' : 'Tier B (Intermediate)'}</option>
                    <option value="C">{language === 'vi' ? 'Trình C (Phong trào)' : 'Tier C (Club / Novice)'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {(registerModalTournament.format || 'doubles') === 'team'
                    ? language === 'vi'
                      ? 'Đội trưởng / Thành viên đại diện (tùy chọn)'
                      : 'Team Captain / Representative (optional)'
                    : language === 'vi'
                      ? 'Đồng đội đánh đôi (để trống nếu đánh đơn)'
                      : 'Doubles Partner (optional)'}
                </label>
                <input
                  maxLength={80}
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  placeholder="Trần Minh B"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              {partnerInput.trim() && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'vi' ? 'Giới tính đồng đội' : 'Partner Gender'}
                    </label>
                    <select
                      value={partnerGenderInput}
                      onChange={(e) => setPartnerGenderInput(e.target.value as Gender)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <option value="male">{t(language, 'genderMale')}</option>
                      <option value="female">{t(language, 'genderFemale')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'vi' ? 'Trình độ đồng đội' : 'Partner Tier'}
                    </label>
                    <select
                      value={partnerTierInput}
                      onChange={(e) => setPartnerTierInput(e.target.value as SkillTier)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi'
                    ? `Tổng điểm DUPR cặp (Trần ≤ ${registerModalTournament.skillCap})`
                    : `Combined DUPR (Cap ≤ ${registerModalTournament.skillCap})`}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="2.0"
                  max="15.0"
                  value={duprInput}
                  onChange={(e) => setDuprInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRegisterModalTournament(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold btn-accent">
                  {language === 'vi' ? 'Tiếp tục VietQR' : 'Proceed to VietQR'}
                </button>
              </div>
            </form>
          </MotionModal>
        )}
      </AnimatePresence>

      {/* Create Tournament Modal (Bottom Sheet on mobile, centered dialog on desktop) */}
      <AnimatePresence>
        {showCreateModal && isSignedIn && (
          <MotionModal
            key="create-tournament-modal"
            variant="sheet"
            ariaLabel={t(language, 'createTournament')}
            onBackdropClick={onCloseCreateModal}
            onEscape={onCloseCreateModal}
            overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
            panelClassName="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe space-y-5 shadow-2xl"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t(language, 'createTournament')}
              </h3>
              <button
                onClick={onCloseCreateModal}
                aria-label="Close"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateSubmit(e)} className="space-y-4">
              {/* Format Selector: Doubles vs Team Cup */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'vi' ? 'Chọn thể thức giải đấu *' : 'Tournament Format *'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectFormat('doubles')}
                    className={`min-h-[60px] p-3 rounded-xl border text-left transition-colors ${
                      newFormat === 'doubles'
                        ? 'border-accent bg-accent-soft ring-1 ring-orange-500/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold ${newFormat === 'doubles' ? 'text-accent' : 'text-slate-900 dark:text-white'}`}>
                        {language === 'vi' ? 'Giải Đôi' : 'Doubles'}
                      </span>
                      <Users className={`w-4 h-4 shrink-0 ${newFormat === 'doubles' ? 'text-accent' : 'text-slate-400'}`} />
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {language === 'vi' ? 'Đấu cặp 2 VĐV · Bốc thăm nhánh' : '2-player pairs · Direct draw'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectFormat('team')}
                    className={`min-h-[60px] p-3 rounded-xl border text-left transition-colors ${
                      newFormat === 'team'
                        ? 'border-accent bg-accent-soft ring-1 ring-orange-500/30'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold ${newFormat === 'team' ? 'text-accent' : 'text-slate-900 dark:text-white'}`}>
                        {language === 'vi' ? 'Giải Đồng đội' : 'Team Cup'}
                      </span>
                      <GitBranch className={`w-4 h-4 shrink-0 ${newFormat === 'team' ? 'text-accent' : 'text-slate-400'}`} />
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {language === 'vi' ? '4 trận đôi · Chia Serie A & B' : '4 doubles/tie · Serie A & B'}
                    </span>
                  </button>
                </div>
                {newFormat === 'team' && (
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                    {language === 'vi'
                      ? 'Điều lệ Đồng đội: Vòng bảng 4 trận đôi · Thắng 3đ / Hòa 2đ / Thua 1đ / Bỏ cuộc 0đ (15-0) · Vòng loại hòa 2-2 đấu đơn quyết định.'
                      : 'Team rules: Group stage 4 doubles · Win 3 / Draw 2 / Loss 1 / Forfeit 0 (15-0) · Knockout 2-2 decided by singles.'}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Tên giải đấu' : 'Tournament Title'}
                  </label>
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={
                      newFormat === 'team'
                        ? 'Giải Pickleball Đồng Đội Bính Dần 1986'
                        : 'Giải Pickleball Đôi Nam Nữ 1986 Open'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Địa điểm / Cụm sân' : 'Venue / Court Complex'}
                  </label>
                  <input
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Cụm sân Thảo Điền"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Thành phố' : 'City'}
                  </label>
                  <select
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="TP.HCM">TP.HCM</option>
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Ngày khởi tranh' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Nội dung thi đấu' : 'Category'}
                  </label>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {newFormat === 'team'
                      ? language === 'vi'
                        ? 'Trần điểm DUPR đội'
                        : 'Team DUPR Cap'
                      : language === 'vi'
                        ? 'Trần điểm DUPR cặp'
                        : 'Pair DUPR Cap'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newSkillCap}
                    onChange={(e) => setNewSkillCap(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {newFormat === 'team'
                      ? language === 'vi'
                        ? 'Lệ phí / đội (VNĐ)'
                        : 'Entry Fee / Team (VND)'
                      : language === 'vi'
                        ? 'Lệ phí / cặp (VNĐ)'
                        : 'Entry Fee / Pair (VND)'}
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {newFormat === 'team'
                      ? language === 'vi'
                        ? 'Số đội tối đa'
                        : 'Max Teams'
                      : language === 'vi'
                        ? 'Số cặp tối đa'
                        : 'Max Pairs'}
                  </label>
                  <input
                    type="number"
                    min="4"
                    max="128"
                    value={newMaxTeams}
                    onChange={(e) => setNewMaxTeams(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t(language, 'prizePool')} (VNĐ)
                  </label>
                  <input
                    type="number"
                    step="1000000"
                    value={newPrize}
                    onChange={(e) => setNewPrize(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Ngân hàng VietQR' : 'VietQR Bank'}
                  </label>
                  <select
                    value={newBankCode}
                    onChange={(e) => setNewBankCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    <option value="VCB">Vietcombank (VCB)</option>
                    <option value="TCB">Techcombank (TCB)</option>
                    <option value="MB">MB Bank (MB)</option>
                    <option value="ACB">ACB</option>
                    <option value="BIDV">BIDV</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Số tài khoản nhận lệ phí' : 'Bank Account'}
                  </label>
                  <input
                    value={newBankAccount}
                    onChange={(e) => setNewBankAccount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {language === 'vi' ? 'Tên chủ tài khoản' : 'Account Holder'}
                  </label>
                  <input
                    value={newBankOwner}
                    onChange={(e) => setNewBankOwner(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseCreateModal}
                  className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button type="submit" className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold btn-accent">
                  {newFormat === 'team'
                    ? language === 'vi'
                      ? 'Khởi tạo giải Đồng đội'
                      : 'Create Team Cup'
                    : language === 'vi'
                      ? 'Khởi tạo giải Đôi'
                      : 'Create Doubles Event'}
                </button>
              </div>
            </form>
          </MotionModal>
        )}
      </AnimatePresence>
    </div>
  );
};
