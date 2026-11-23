import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  AdminQrScannerModal,
  type CheckInActionResult,
} from './components/AdminQrScannerModal';
import { AthleteQrModal } from './components/AthleteQrModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeadToHeadModal } from './components/HeadToHeadModal';
import { LiveScoreView } from './components/LiveScoreView';
import {
  NotificationDrawer,
  SocialShareModal,
  TwoFactorVerifyModal,
  VietQRPaymentModal,
} from './components/Modals';
import { OfflineIndicator } from './components/PWAInstallButton';
import { QuickThemeToggle } from './components/QuickThemeToggle';
import { RankingsH2HView } from './components/RankingsH2HView';
import {
  RefereeAppModal,
  type RefereeFinalPayload,
  type RefereeSessionPayload,
} from './components/RefereeAppModal';
import { RoleAccessModal } from './components/RoleAccessModal';
import { SettingsSecurityView } from './components/SettingsSecurityView';
import { SidebarNav } from './components/SidebarNav';
import { TeamCupView } from './components/TeamCupView';
import { TournamentsView } from './components/TournamentsView';
import { sanitizeCheckInId } from './lib/athleteQr';
import {
  buildEntityFromName,
  buildEntityFromTeam,
  buildMatchH2HContext,
  buildTieH2HContext,
  type H2HContext,
} from './lib/h2h';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './lib/firebase';
import {
  computeDuprDelta,
  computeTeamTieSummary,
  DEFAULT_TOURNAMENT_RULES,
  fisherYatesShuffle,
  INITIAL_ATHLETES,
  INITIAL_MATCHES,
  INITIAL_REGISTRATIONS,
  INITIAL_TEAM_ENTRIES,
  INITIAL_TEAM_TIES,
  INITIAL_TOURNAMENTS,
} from './lib/seedData';
import type { ShareCardPayload } from './lib/shareCard';
import {
  auditScheduleConflicts,
  autoSeedAndScheduleTies,
  DEFAULT_COURT_PINS,
  DEFAULT_SCHEDULE_CONFIG,
  ensureCourtPinsForCount,
  generateRandomSixDigitPin,
  scheduleTiesConflictFree,
} from './lib/teamScheduler';
import {
  ALL_GROUP_NAMES,
  type AthleteProfile,
  type CloudBackupSnapshot,
  type CourtPinConfig,
  type Gender,
  type GroupName,
  type Language,
  type MatchRecord,
  type NotificationItem,
  type Registration,
  type ScheduleConfig,
  type SkillTier,
  type StaffRoleSession,
  type TabId,
  type TeamEntry,
  type TeamMember,
  type TeamTie,
  type ThemeAccent,
  type Tournament,
  type TournamentCheckIn,
  type TournamentRulesConfig,
  type UserPrivateSecurity,
} from './lib/types';
import { generateTransferCode } from './lib/vietqr';

const DEFAULT_PRIVATE_SETTINGS: UserPrivateSecurity = {
  ownerUid: 'guest',
  twoFactorEnabled: false,
  totpSecret: '',
  recoveryCodes: [],
  themeAccent: 'amber',
  darkMode: false,
  language: 'vi',
  notifyUpcomingMatch: true,
  notifyScoreUpdate: true,
  notifyChatMention: true,
  notifyPaymentReceipt: true,
  autoCloudBackup: true,
};

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

const SEED_TOURNAMENT_IDS = new Set([
  'trn_saigon_open_2026',
  'trn_hanoi_autumn_2026',
  'trn_danang_coastal_2026',
  'trn_thaodien_series_q4',
]);

const SEED_TEAM_IDS = new Set([
  'team_sg_dink',
  'team_d7_smash',
  'team_landmark',
  'team_binhthanh',
  'team_hanoi_pro',
  'team_danang_coastal',
  'team_westlake',
  'team_mykhe',
]);

function isSeedTournament(trn: Tournament): boolean {
  return (
    SEED_TOURNAMENT_IDS.has(trn.id) ||
    trn.id.startsWith('seed_') ||
    String(trn.organizerUid || '').startsWith('seed_')
  );
}

function isSeedTeam(tm: TeamEntry): boolean {
  return (
    SEED_TEAM_IDS.has(tm.id) ||
    tm.id.startsWith('seed_') ||
    String(tm.organizerUid || '').startsWith('seed_') ||
    tm.tournamentId === 'trn_saigon_open_2026'
  );
}

function isSeedTie(ti: TeamTie): boolean {
  return (
    ti.id.startsWith('seed_') ||
    String(ti.organizerUid || '').startsWith('seed_') ||
    ti.tournamentId === 'trn_saigon_open_2026' ||
    SEED_TEAM_IDS.has(ti.teamAId) ||
    SEED_TEAM_IDS.has(ti.teamBId)
  );
}

function mergeById<T extends { id: string }>(seed: T[], cloud: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of seed) map.set(item.id, item);
  for (const item of cloud) map.set(item.id, item);
  return Array.from(map.values());
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Navigation & UI Preferences (with iOS 27 directional slide transition)
  const [activeTab, setActiveTabState] = useState<TabId>('tournaments');
  const [tabSlideDir, setTabSlideDir] = useState<'left' | 'right' | null>(null);
  const swipeTouchRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lockedHorizontal: boolean;
  }>({ active: false, startX: 0, startY: 0, lockedHorizontal: false });

  const TAB_ORDER: TabId[] = useMemo(
    () => ['tournaments', 'teamcup', 'live', 'rankings', 'settings'],
    []
  );
  const MOBILE_SWIPE_TABS: TabId[] = useMemo(
    () => ['tournaments', 'teamcup', 'live', 'rankings'],
    []
  );

  const setActiveTab = useCallback(
    (nextTab: TabId) => {
      setActiveTabState((prevTab) => {
        if (prevTab === nextTab) return prevTab;
        const prevIdx = TAB_ORDER.indexOf(prevTab);
        const nextIdx = TAB_ORDER.indexOf(nextTab);
        setTabSlideDir(nextIdx >= prevIdx ? 'right' : 'left');
        return nextTab;
      });
    },
    [TAB_ORDER]
  );

  const handleMainTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'input, select, textarea, button, a, svg, .touch-scroll-x, [data-no-tab-swipe="true"]'
      )
    ) {
      swipeTouchRef.current.active = false;
      return;
    }
    swipeTouchRef.current = {
      active: true,
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      lockedHorizontal: false,
    };
  };

  const handleMainTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!swipeTouchRef.current.active || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - swipeTouchRef.current.startX;
    const dy = e.changedTouches[0].clientY - swipeTouchRef.current.startY;
    swipeTouchRef.current.active = false;
    if (Math.abs(dx) < 68 || Math.abs(dx) < Math.abs(dy) * 1.45) return;
    const currentIdx = MOBILE_SWIPE_TABS.indexOf(activeTab);
    if (currentIdx === -1) return;
    if (dx < 0 && currentIdx < MOBILE_SWIPE_TABS.length - 1) {
      setActiveTab(MOBILE_SWIPE_TABS[currentIdx + 1]);
    } else if (dx > 0 && currentIdx > 0) {
      setActiveTab(MOBILE_SWIPE_TABS[currentIdx - 1]);
    }
  };
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('pc_lang');
    return saved === 'en' ? 'en' : 'vi';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pc_dark') === 'true';
  });
  const [themeAccent, setThemeAccent] = useState<ThemeAccent>(() => {
    const saved = localStorage.getItem('pc_accent_1986') as ThemeAccent | null;
    return saved && ['amber', 'crimson', 'emerald', 'rose', 'violet'].includes(saved)
      ? saved
      : 'amber';
  });

  // Cloud + Local Data State
  const [cloudAthletes, setCloudAthletes] = useState<AthleteProfile[]>([]);
  const [localAthletes, setLocalAthletes] = useState<AthleteProfile[]>(() => {
    try {
      const saved = localStorage.getItem('pc_custom_athletes_v3');
      if (saved) {
        const parsed = JSON.parse(saved) as AthleteProfile[];
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (a) => !a.id.startsWith('seed_') && !String(a.ownerUid || '').startsWith('seed_')
          );
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_ATHLETES;
  });

  const [cloudTournaments, setCloudTournaments] = useState<Tournament[]>([]);
  const [localTournaments, setLocalTournaments] = useState<Tournament[]>(() => {
    try {
      const saved = localStorage.getItem('pc_custom_tournaments_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as Tournament[];
        if (Array.isArray(parsed)) {
          return parsed.filter((trn) => !isSeedTournament(trn));
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_TOURNAMENTS;
  });

  const [cloudRegistrations, setCloudRegistrations] = useState<Registration[]>([]);
  const [localRegistrations, setLocalRegistrations] = useState<Registration[]>(INITIAL_REGISTRATIONS);

  const [cloudMatches, setCloudMatches] = useState<MatchRecord[]>([]);
  const [localMatches, setLocalMatches] = useState<MatchRecord[]>(INITIAL_MATCHES);

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(() => {
    try {
      const saved = localStorage.getItem('pc_schedule_cfg');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ScheduleConfig>;
        return {
          courtsCount:
            typeof parsed.courtsCount === 'number'
              ? Math.min(16, Math.max(2, parsed.courtsCount))
              : DEFAULT_SCHEDULE_CONFIG.courtsCount,
          groupsCount:
            typeof parsed.groupsCount === 'number'
              ? Math.min(8, Math.max(2, parsed.groupsCount))
              : DEFAULT_SCHEDULE_CONFIG.groupsCount,
          startTime: typeof parsed.startTime === 'string' ? parsed.startTime : '08:00',
          slotMinutes: typeof parsed.slotMinutes === 'number' ? parsed.slotMinutes : 30,
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SCHEDULE_CONFIG;
  });

  const [courtPins, setCourtPins] = useState<CourtPinConfig[]>(() => {
    try {
      const saved = localStorage.getItem('pc_court_pins');
      if (saved) {
        const parsed = JSON.parse(saved) as CourtPinConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_COURT_PINS;
  });

  const [tournamentRules, setTournamentRules] = useState<TournamentRulesConfig>(() => {
    try {
      const saved = localStorage.getItem('pc_tournament_rules_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<TournamentRulesConfig>;
        const valid = (v: unknown): v is 11 | 15 | 21 => v === 11 || v === 15 || v === 21;
        return {
          groupTargetPoints: valid(parsed.groupTargetPoints)
            ? parsed.groupTargetPoints
            : DEFAULT_TOURNAMENT_RULES.groupTargetPoints,
          knockoutTargetPoints: valid(parsed.knockoutTargetPoints)
            ? parsed.knockoutTargetPoints
            : DEFAULT_TOURNAMENT_RULES.knockoutTargetPoints,
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_TOURNAMENT_RULES;
  });

  const [roleSession, setRoleSession] = useState<StaffRoleSession>(() => {
    try {
      const saved = sessionStorage.getItem('pc_role_session');
      if (saved) {
        const parsed = JSON.parse(saved) as StaffRoleSession;
        if (parsed && ['organizer', 'referee', 'viewer'].includes(parsed.role)) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return { role: 'organizer', refereeName: '', assignedCourt: '' };
  });

  const [cloudTeams, setCloudTeams] = useState<TeamEntry[]>([]);
  const [localTeams, setLocalTeams] = useState<TeamEntry[]>(() => {
    try {
      const saved = localStorage.getItem('pc_custom_teams_v3');
      if (saved) {
        const parsed = JSON.parse(saved) as TeamEntry[];
        if (Array.isArray(parsed)) {
          return parsed.filter((tm) => !isSeedTeam(tm));
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_TEAM_ENTRIES;
  });

  const [cloudTies, setCloudTies] = useState<TeamTie[]>([]);
  const [localTies, setLocalTies] = useState<TeamTie[]>(() => {
    try {
      const saved = localStorage.getItem('pc_custom_ties_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as TeamTie[];
        if (Array.isArray(parsed)) {
          return parsed.filter((ti) => !isSeedTie(ti));
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_TEAM_TIES;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [backups, setBackups] = useState<CloudBackupSnapshot[]>([]);
  const [privateSettings, setPrivateSettings] = useState<UserPrivateSecurity>(DEFAULT_PRIVATE_SETTINGS);

  const [cloudCheckIns, setCloudCheckIns] = useState<TournamentCheckIn[]>([]);
  const [localCheckIns, setLocalCheckIns] = useState<TournamentCheckIn[]>(() => {
    try {
      const saved = localStorage.getItem('pc_checkins_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as TournamentCheckIn[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  // Modals & Toasts
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [qrAthleteContext, setQrAthleteContext] = useState<{
    athlete: AthleteProfile;
    tournamentId?: string;
  } | null>(null);
  const [qrScannerContext, setQrScannerContext] = useState<{
    tournamentId?: string;
  } | null>(null);
  const [vietqrContext, setVietqrContext] = useState<{
    tournament: Tournament;
    registration: Registration;
  } | null>(null);
  const [sharePayload, setSharePayload] = useState<ShareCardPayload | null>(null);
  const [pending2FA, setPending2FA] = useState<{
    description: string;
    onVerified: () => Promise<void>;
  } | null>(null);
  const [refereeContext, setRefereeContext] = useState<{
    session: RefereeSessionPayload;
    target:
      | { kind: 'submatch'; tieId: string; subMatchId: string }
      | { kind: 'tiebreak'; tieId: string }
      | { kind: 'match'; matchId: string };
  } | null>(null);
  const [h2hContext, setH2hContext] = useState<H2HContext | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  // Sync HTML dark class and accent CSS theme attribute
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('pc_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', themeAccent);
    localStorage.setItem('pc_accent_1986', themeAccent);
  }, [themeAccent]);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem('pc_lang', language);
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_schedule_cfg', JSON.stringify(scheduleConfig));
    } catch {
      // ignore storage errors
    }
  }, [scheduleConfig]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_court_pins', JSON.stringify(courtPins));
    } catch {
      // ignore storage errors
    }
  }, [courtPins]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_tournament_rules_v1', JSON.stringify(tournamentRules));
    } catch {
      // ignore storage errors
    }
  }, [tournamentRules]);

  useEffect(() => {
    try {
      sessionStorage.setItem('pc_role_session', JSON.stringify(roleSession));
    } catch {
      // ignore storage errors
    }
  }, [roleSession]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_custom_athletes_v3', JSON.stringify(localAthletes));
    } catch {
      // ignore storage errors
    }
  }, [localAthletes]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_custom_tournaments_v1', JSON.stringify(localTournaments));
    } catch {
      // ignore storage errors
    }
  }, [localTournaments]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_custom_teams_v3', JSON.stringify(localTeams));
    } catch {
      // ignore storage errors
    }
  }, [localTeams]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_custom_ties_v1', JSON.stringify(localTies));
    } catch {
      // ignore storage errors
    }
  }, [localTies]);

  useEffect(() => {
    try {
      localStorage.setItem('pc_checkins_v1', JSON.stringify(localCheckIns));
    } catch {
      // ignore storage errors
    }
  }, [localCheckIns]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);

      if (fbUser && fbUser.emailVerified) {
        try {
          // Load owner-only private security & preferences (do not auto-seed dummy athlete rows)
          const secRef = doc(db, 'users', fbUser.uid, 'private', 'security');
          const secSnap = await getDoc(secRef);
          if (secSnap.exists()) {
            const data = secSnap.data() as UserPrivateSecurity;
            setPrivateSettings({ ...DEFAULT_PRIVATE_SETTINGS, ...data });
            if (typeof data.darkMode === 'boolean') setDarkMode(data.darkMode);
            if (
              data.themeAccent &&
              ['amber', 'crimson', 'emerald', 'rose', 'violet'].includes(data.themeAccent)
            ) {
              setThemeAccent(data.themeAccent);
            }
            if (data.language) setLanguage(data.language);
          } else {
            await setDoc(secRef, {
              ownerUid: fbUser.uid,
              twoFactorEnabled: false,
              totpSecret: '',
              recoveryCodes: [],
              themeAccent,
              darkMode,
              language,
              notifyUpcomingMatch: true,
              notifyScoreUpdate: true,
              notifyChatMention: true,
              notifyPaymentReceipt: true,
              autoCloudBackup: true,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}/private/security`);
        }
      }
    });
    return () => unsub();
  }, []);

  // Public Firestore real-time subscriptions
  useEffect(() => {
    if (!authReady) return;

    const unsubAthletes = onSnapshot(
      query(collection(db, 'athletes'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudAthletes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AthleteProfile, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'athletes')
    );

    const unsubTournaments = onSnapshot(
      query(collection(db, 'tournaments'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudTournaments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Tournament, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tournaments')
    );

    const unsubRegs = onSnapshot(
      query(collection(db, 'registrations'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudRegistrations(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Registration, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'registrations')
    );

    const unsubMatches = onSnapshot(
      query(collection(db, 'matches'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudMatches(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MatchRecord, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'matches')
    );

    const unsubTeams = onSnapshot(
      query(collection(db, 'teamEntries'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudTeams(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeamEntry, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'teamEntries')
    );

    const unsubTies = onSnapshot(
      query(collection(db, 'teamTies'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudTies(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TeamTie, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'teamTies')
    );

    const unsubCheckIns = onSnapshot(
      query(collection(db, 'checkins'), where('visibility', '==', 'public')),
      (snap) => {
        setCloudCheckIns(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TournamentCheckIn, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'checkins')
    );

    return () => {
      unsubAthletes();
      unsubTournaments();
      unsubRegs();
      unsubMatches();
      unsubTeams();
      unsubTies();
      unsubCheckIns();
    };
  }, [authReady]);

  // Owner-only private subscriptions (Notifications, Cloud Backups)
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('recipientUid', '==', user.uid)),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
        if (docs.length > 0) setNotifications(docs);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubBackups = onSnapshot(
      query(collection(db, 'cloudBackups'), where('ownerUid', '==', user.uid)),
      (snap) => {
        setBackups(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CloudBackupSnapshot, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cloudBackups')
    );

    return () => {
      unsubNotifs();
      unsubBackups();
    };
  }, [authReady, user]);

  // Merged datasets (always rich and immediately interactive, cloud wins on ID collision)
  const athletes = useMemo(
    () =>
      mergeById(localAthletes, cloudAthletes).filter(
        (a) => !a.id.startsWith('seed_') && !String(a.ownerUid || '').startsWith('seed_')
      ),
    [localAthletes, cloudAthletes]
  );
  const tournaments = useMemo(
    () => mergeById(localTournaments, cloudTournaments).filter((trn) => !isSeedTournament(trn)),
    [localTournaments, cloudTournaments]
  );
  const registrations = useMemo(
    () => mergeById(localRegistrations, cloudRegistrations),
    [localRegistrations, cloudRegistrations]
  );
  const matches = useMemo(() => mergeById(localMatches, cloudMatches), [localMatches, cloudMatches]);
  const teams = useMemo(
    () => mergeById(localTeams, cloudTeams).filter((tm) => !isSeedTeam(tm)),
    [localTeams, cloudTeams]
  );
  const ties = useMemo(() => {
    const merged = mergeById(localTies, cloudTies).filter((ti) => !isSeedTie(ti));
    if (merged.length === 0) return [];
    const missingSchedule = merged.some((ti) => !ti.courtName || !ti.scheduledSlot);
    return missingSchedule ? scheduleTiesConflictFree(merged, scheduleConfig) : merged;
  }, [localTies, cloudTies, scheduleConfig]);

  const checkIns = useMemo(
    () => mergeById(localCheckIns, cloudCheckIns),
    [localCheckIns, cloudCheckIns]
  );

  const myProfile = useMemo(
    () => (user ? athletes.find((a) => a.id === user.uid || a.ownerUid === user.uid) || null : null),
    [athletes, user]
  );

  const isAdmin = Boolean(
    user?.emailVerified && user.email?.toLowerCase() === 'hung.2708@gmail.com'
  );

  const handleAdminSignIn = useCallback(async () => {
    try {
      const signedIn = await signInWithGoogle();
      const signedEmail = signedIn?.user?.email?.toLowerCase();
      if (signedIn?.user?.emailVerified && signedEmail === 'hung.2708@gmail.com') {
        setRoleSession({ role: 'organizer', refereeName: '', assignedCourt: '' });
        showToast(
          language === 'vi'
            ? 'Đã đăng nhập tài khoản Admin — bạn có thể thêm VĐV & quét QR Check-in.'
            : 'Signed in as Admin — athlete management & QR check-in unlocked.'
        );
      } else {
        showToast(
          language === 'vi'
            ? 'Tài khoản này không có quyền Admin.'
            : 'This account does not have Admin privileges.'
        );
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Sign-in cancelled');
    }
  }, [language, showToast]);

  const handleProcessCheckIn = useCallback(
    async (tournamentId: string, athleteId: string): Promise<CheckInActionResult> => {
      if (!isAdmin || !user) {
        return {
          outcome: 'unauthorized',
          message:
            language === 'vi'
              ? 'Chỉ tài khoản Admin sau khi đăng nhập Google mới có quyền quét QR check-in.'
              : 'Only the signed-in Admin account can perform venue QR check-in.',
        };
      }

      const tournament = tournaments.find((trn) => trn.id === tournamentId);
      if (!tournament) {
        return {
          outcome: 'not_found',
          message:
            language === 'vi'
              ? 'Không tìm thấy giải đấu cần check-in.'
              : 'Target tournament not found.',
        };
      }

      const athlete = athletes.find((a) => a.id === athleteId);
      if (!athlete) {
        return {
          outcome: 'not_found',
          message:
            language === 'vi'
              ? `Không tìm thấy VĐV với mã "${athleteId}". VĐV cần có trong danh sách BXH trước khi check-in.`
              : `No athlete found with ID "${athleteId}". Add the athlete first.`,
        };
      }

      const checkInId = sanitizeCheckInId(tournament.id, athlete.id);
      const existingCheckIn = checkIns.find(
        (c) =>
          (c.id === checkInId ||
            (c.tournamentId === tournament.id && c.athleteId === athlete.id)) &&
          c.status === 'checked_in'
      );

      if (existingCheckIn) {
        return {
          outcome: 'already_checked_in',
          athlete,
          checkIn: existingCheckIn,
          message:
            language === 'vi'
              ? `${athlete.displayName} đã được điểm danh có mặt tại ${tournament.title} trước đó.`
              : `${athlete.displayName} was already checked in for ${tournament.title}.`,
        };
      }

      const nowIso = new Date().toISOString();
      const newCheckIn: TournamentCheckIn = {
        id: checkInId,
        tournamentId: tournament.id,
        tournamentTitle: tournament.title.slice(0, 120),
        athleteId: athlete.id,
        athleteName: athlete.displayName.slice(0, 80),
        skillTier: athlete.skillTier || 'B',
        gender: athlete.gender || 'male',
        club: (athlete.club || '1986 Club').slice(0, 80),
        status: 'checked_in',
        checkedInByUid: user.uid,
        checkedInByEmail: (user.email || '').slice(0, 120),
        checkedInAtIso: nowIso,
        visibility: 'public',
      };

      setLocalCheckIns((prev) => mergeById(prev, [newCheckIn]));

      // Sync matching registrations if the athlete is already registered in this tournament
      const matchedRegs = registrations.filter(
        (r) =>
          r.tournamentId === tournament.id &&
          (r.athleteUid === athlete.id ||
            r.athleteUid === athlete.ownerUid ||
            r.teamName.toLowerCase().includes(athlete.displayName.toLowerCase()))
      );
      if (matchedRegs.length > 0) {
        const regIds = new Set(matchedRegs.map((r) => r.id));
        setLocalRegistrations((prev) =>
          prev.map((r) => (regIds.has(r.id) ? { ...r, checkedIn: true, checkedInAt: nowIso } : r))
        );
      }

      if (user.emailVerified) {
        try {
          await setDoc(doc(db, 'checkins', checkInId), {
            tournamentId: newCheckIn.tournamentId,
            tournamentTitle: newCheckIn.tournamentTitle,
            athleteId: newCheckIn.athleteId,
            athleteName: newCheckIn.athleteName,
            skillTier: newCheckIn.skillTier,
            gender: newCheckIn.gender,
            club: newCheckIn.club,
            status: 'checked_in',
            checkedInByUid: newCheckIn.checkedInByUid,
            checkedInByEmail: newCheckIn.checkedInByEmail,
            checkedInAtIso: newCheckIn.checkedInAtIso,
            visibility: 'public',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          for (const reg of matchedRegs) {
            if (cloudRegistrations.some((cr) => cr.id === reg.id)) {
              await updateDoc(doc(db, 'registrations', reg.id), {
                checkedIn: true,
                checkedInAt: nowIso,
                updatedAt: serverTimestamp(),
              }).catch(() => {});
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `checkins/${checkInId}`);
        }
      }

      showToast(
        language === 'vi'
          ? `Đã check-in có mặt: ${athlete.displayName} → ${tournament.title}`
          : `Checked-in: ${athlete.displayName} → ${tournament.title}`
      );

      return {
        outcome: 'checked_in',
        athlete,
        checkIn: newCheckIn,
        message:
          language === 'vi'
            ? `Đã cập nhật trạng thái CÓ MẶT cho VĐV ${athlete.displayName} vào giải ${tournament.title}.`
            : `${athlete.displayName} is now marked CHECKED-IN for ${tournament.title}.`,
      };
    },
    [isAdmin, user, tournaments, athletes, checkIns, registrations, cloudRegistrations, language, showToast]
  );

  const handleUndoCheckIn = useCallback(
    async (checkInId: string) => {
      if (!isAdmin || !user) {
        showToast(
          language === 'vi'
            ? 'Chỉ tài khoản Admin mới có quyền hủy trạng thái check-in.'
            : 'Only Admin can undo check-in status.'
        );
        return;
      }

      setLocalCheckIns((prev) => prev.filter((c) => c.id !== checkInId));
      setCloudCheckIns((prev) => prev.filter((c) => c.id !== checkInId));

      if (user.emailVerified) {
        try {
          await deleteDoc(doc(db, 'checkins', checkInId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `checkins/${checkInId}`);
        }
      }

      showToast(
        language === 'vi' ? 'Đã hủy trạng thái check-in của VĐV.' : 'Athlete check-in removed.'
      );
    },
    [isAdmin, user, language, showToast]
  );

  const handleToggleKitIssued = useCallback(
    async (checkInId: string) => {
      if (!isAdmin || !user) return;
      const target = checkIns.find((c) => c.id === checkInId);
      if (!target) return;
      const nextVal = !target.kitIssued;

      setLocalCheckIns((prev) => {
        const exists = prev.some((c) => c.id === checkInId);
        if (exists) return prev.map((c) => (c.id === checkInId ? { ...c, kitIssued: nextVal } : c));
        return [...prev, { ...target, kitIssued: nextVal }];
      });

      if (user.emailVerified && cloudCheckIns.some((c) => c.id === checkInId)) {
        try {
          await updateDoc(doc(db, 'checkins', checkInId), {
            kitIssued: nextVal,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `checkins/${checkInId}`);
        }
      }

      showToast(
        nextVal
          ? language === 'vi'
            ? `Đã phát áo / Race Kit cho ${target.athleteName}`
            : `Race Kit issued to ${target.athleteName}`
          : language === 'vi'
            ? `Đã bỏ đánh dấu phát áo cho ${target.athleteName}`
            : `Race Kit unchecked for ${target.athleteName}`
      );
    },
    [isAdmin, user, checkIns, cloudCheckIns, language, showToast]
  );

  // Helper: Push personalized browser + in-app notification
  const pushAlert = useCallback(
    async (
      title: string,
      body: string,
      category: NotificationItem['category']
    ) => {
      if (category === 'match' && !privateSettings.notifyUpcomingMatch) return;
      if (category === 'payment' && !privateSettings.notifyPaymentReceipt) return;
      if (category === 'chat' && !privateSettings.notifyChatMention) return;

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/pwa-192x192.png' });
        } catch {
          // ignore sandbox notification errors
        }
      }

      const id = makeId('ntf');
      const item: NotificationItem = {
        id,
        recipientUid: user?.uid || 'guest',
        title,
        body,
        category,
        read: false,
      };

      setNotifications((prev) => [item, ...prev]);

      if (user?.emailVerified) {
        try {
          await setDoc(doc(db, 'notifications', id), {
            recipientUid: user.uid,
            title: title.slice(0, 120),
            body: body.slice(0, 300),
            category,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `notifications/${id}`);
        }
      }
    },
    [privateSettings, user]
  );

  // Helper: 2FA Gate for sensitive actions
  const runWith2FA = useCallback(
    async (description: string, fn: () => Promise<void>) => {
      if (privateSettings.twoFactorEnabled && privateSettings.totpSecret) {
        setPending2FA({ description, onVerified: fn });
      } else {
        await fn();
      }
    },
    [privateSettings]
  );

  // Private Settings sync
  const handleSavePrivateSettings = async (patch: Partial<UserPrivateSecurity>) => {
    const next: UserPrivateSecurity = {
      ...privateSettings,
      ...patch,
      ownerUid: user?.uid || 'guest',
    };
    setPrivateSettings(next);
    if (typeof patch.darkMode === 'boolean') setDarkMode(patch.darkMode);
    if (patch.themeAccent) setThemeAccent(patch.themeAccent);
    if (patch.language) setLanguage(patch.language);

    if (user?.emailVerified) {
      const path = `users/${user.uid}/private/security`;
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'private', 'security'),
          {
            ownerUid: user.uid,
            twoFactorEnabled: next.twoFactorEnabled,
            totpSecret: next.totpSecret || '',
            recoveryCodes: (next.recoveryCodes || []).slice(0, 10),
            themeAccent: next.themeAccent,
            darkMode: next.darkMode,
            language: next.language,
            notifyUpcomingMatch: next.notifyUpcomingMatch,
            notifyScoreUpdate: next.notifyScoreUpdate,
            notifyChatMention: next.notifyChatMention,
            notifyPaymentReceipt: next.notifyPaymentReceipt,
            autoCloudBackup: next.autoCloudBackup,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }
    showToast(language === 'vi' ? 'Đã lưu & đồng bộ cài đặt' : 'Settings saved & synced');
  };

  const handleSaveMyProfile = async (patch: Partial<AthleteProfile>) => {
    if (!user?.emailVerified || !myProfile) return;
    const path = `athletes/${user.uid}`;
    try {
      await updateDoc(doc(db, 'athletes', user.uid), {
        displayName: (patch.displayName || myProfile.displayName).slice(0, 80),
        gender: patch.gender || myProfile.gender || 'male',
        skillTier: patch.skillTier || myProfile.skillTier || 'B',
        club: (patch.club || myProfile.club).slice(0, 80),
        city: (patch.city || myProfile.city).slice(0, 60),
        availableForMatch: patch.availableForMatch ?? myProfile.availableForMatch,
        updatedAt: serverTimestamp(),
      });
      showToast(language === 'vi' ? 'Đã cập nhật hồ sơ VĐV' : 'Athlete profile updated');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  // Cloud Backup Snapshot
  const handleCreateCloudBackup = useCallback(
    async (label: string) => {
      const id = makeId('bkp');
      const snapObj: CloudBackupSnapshot = {
        id,
        ownerUid: user?.uid || 'guest',
        label: label.slice(0, 100),
        tournamentsCount: tournaments.length,
        matchesCount: matches.length,
        athletesCount: athletes.length,
        deviceName: navigator.platform || 'Web Browser',
      };
      setBackups((prev) => [snapObj, ...prev]);

      if (user?.emailVerified) {
        try {
          await setDoc(doc(db, 'cloudBackups', id), {
            ...snapObj,
            ownerUid: user.uid,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `cloudBackups/${id}`);
        }
      }
      showToast(language === 'vi' ? 'Đã sao lưu dữ liệu lên đám mây' : 'Cloud backup snapshot created');
    },
    [user, tournaments.length, matches.length, athletes.length, language, showToast]
  );

  // Create Tournament (requires signed-in verified account)
  const handleCreateTournament = async (
    payload: Omit<
      Tournament,
      'id' | 'organizerUid' | 'registeredCount' | 'status' | 'visibility' | 'createdAt' | 'updatedAt'
    >
  ): Promise<string> => {
    if (!user?.emailVerified) {
      showToast(
        language === 'vi'
          ? 'Vui lòng đăng nhập tài khoản trước khi tạo giải đấu.'
          : 'Please sign in before creating a tournament.'
      );
      return '';
    }
    const id = makeId('trn');
    const resolvedFormat = payload.format || 'doubles';
    const newTrn: Tournament = {
      ...payload,
      format: resolvedFormat,
      id,
      organizerUid: user.uid,
      registeredCount: 0,
      status: 'open',
      visibility: 'public',
    };

    const { id: _ignoreId, ...trnDoc } = newTrn;
    try {
      await setDoc(doc(db, 'tournaments', id), {
        ...trnDoc,
        organizerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tournaments/${id}`);
      return '';
    }

    if (privateSettings.autoCloudBackup) {
      void handleCreateCloudBackup(`Auto: ${newTrn.title}`);
    }
    showToast(
      resolvedFormat === 'team'
        ? language === 'vi'
          ? 'Đã khởi tạo giải Đồng đội mới thành công'
          : 'New Team Cup tournament created'
        : language === 'vi'
          ? 'Đã khởi tạo giải Đôi mới thành công'
          : 'New Doubles tournament created'
    );
    return id;
  };

  // Register & VietQR
  const handleRegisterTournament = async (
    tournament: Tournament,
    teamName: string,
    partnerName: string,
    combinedDupr: number,
    meta: {
      gender: Gender;
      skillTier: SkillTier;
      partnerGender?: Gender | '';
      partnerSkillTier?: SkillTier | '';
    }
  ): Promise<Registration | null> => {
    const id = makeId('reg');
    const transferCode = generateTransferCode(tournament.id);
    const reg: Registration = {
      id,
      tournamentId: tournament.id,
      organizerUid: tournament.organizerUid,
      athleteUid: user?.uid || 'guest',
      teamName: teamName.slice(0, 100),
      partnerName: partnerName.slice(0, 80),
      gender: meta.gender,
      skillTier: meta.skillTier,
      partnerGender: meta.partnerGender || '',
      partnerSkillTier: meta.partnerSkillTier || '',
      combinedDupr,
      category: tournament.category,
      amountVnd: tournament.entryFeeVnd,
      transferCode,
      paymentStatus: 'pending',
      receiptCode: '',
      visibility: 'public',
    };

    const existsInCloud = cloudTournaments.some((t) => t.id === tournament.id);
    if (user?.emailVerified && existsInCloud) {
      try {
        const { id: _ignoreId, ...regDoc } = reg;
        await setDoc(doc(db, 'registrations', id), {
          ...regDoc,
          athleteUid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (tournament.status === 'open' && tournament.registeredCount < tournament.maxTeams) {
          await updateDoc(doc(db, 'tournaments', tournament.id), {
            registeredCount: tournament.registeredCount + 1,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `registrations/${id}`);
      }
    } else {
      setLocalRegistrations((prev) => [reg, ...prev]);
      setLocalTournaments((prev) =>
        prev.map((t) =>
          t.id === tournament.id
            ? { ...t, registeredCount: Math.min(t.maxTeams, t.registeredCount + 1) }
            : t
        )
      );
    }

    await pushAlert(
      language === 'vi' ? 'Đã tạo mã thanh toán VietQR' : 'VietQR Registration Created',
      `${tournament.title} · ${transferCode}`,
      'payment'
    );
    return reg;
  };

  const handleConfirmPaid = async (reg: Registration) => {
    const receiptCode = `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
    const isCloud = cloudRegistrations.some((r) => r.id === reg.id);
    if (user?.emailVerified && isCloud) {
      try {
        await updateDoc(doc(db, 'registrations', reg.id), {
          paymentStatus: 'paid',
          receiptCode,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `registrations/${reg.id}`);
      }
    } else {
      setLocalRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, paymentStatus: 'paid', receiptCode } : r))
      );
    }
    setVietqrContext((prev) =>
      prev ? { ...prev, registration: { ...prev.registration, paymentStatus: 'paid', receiptCode } } : null
    );
    await pushAlert(
      language === 'vi' ? 'Đã ghi nhận chuyển khoản VietQR' : 'VietQR Payment Submitted',
      `${reg.teamName} · ${receiptCode}`,
      'payment'
    );
  };

  const handleVerifyReceipt = async (reg: Registration) => {
    await runWith2FA(
      language === 'vi' ? 'Xác nhận duyệt lệ phí VietQR cho vận động viên' : 'Verify VietQR entry fee receipt',
      async () => {
        const receiptCode = reg.receiptCode || `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
        const isCloud = cloudRegistrations.some((r) => r.id === reg.id);
        if (user?.emailVerified && isCloud) {
          try {
            await updateDoc(doc(db, 'registrations', reg.id), {
              paymentStatus: 'verified',
              receiptCode,
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `registrations/${reg.id}`);
          }
        } else {
          setLocalRegistrations((prev) =>
            prev.map((r) => (r.id === reg.id ? { ...r, paymentStatus: 'verified', receiptCode } : r))
          );
        }
        setVietqrContext((prev) =>
          prev
            ? { ...prev, registration: { ...prev.registration, paymentStatus: 'verified', receiptCode } }
            : null
        );
        showToast(language === 'vi' ? 'Đã duyệt biên lai lệ phí!' : 'Entry fee receipt verified!');
      }
    );
  };

  // Random Draw Generator (SportConnect-grade Fisher-Yates + Multi-round Bracket + Court Assignment)
  const handleRunRandomDraw = async (tournament: Tournament) => {
    await runWith2FA(
      language === 'vi' ? `Bốc thăm chia nhánh giải ${tournament.title}` : `Run random draw for ${tournament.title}`,
      async () => {
        const regTeams = registrations
          .filter((r) => r.tournamentId === tournament.id)
          .map((r) => ({ name: r.teamName, uid: r.athleteUid }));

        const checkedInPool = checkIns
          .filter((c) => c.tournamentId === tournament.id && c.status === 'checked_in')
          .map((c) => ({ name: c.athleteName, uid: c.athleteId }));

        const pool =
          regTeams.length >= 2
            ? regTeams
            : checkedInPool.length >= 2
              ? checkedInPool
              : athletes.slice(0, 16).map((a) => ({ name: a.displayName, uid: a.ownerUid }));

        if (pool.length < 2) {
          showToast(
            language === 'vi'
              ? 'Cần ít nhất 2 VĐV / cặp đấu (đã đăng ký, đã check-in QR hoặc trong BXH) để bốc thăm chia nhánh.'
              : 'At least 2 registered, checked-in, or directory athletes are required to run the draw.'
          );
          return;
        }

        const shuffled = fisherYatesShuffle(pool);
        const generated: MatchRecord[] = [];
        const pairCount = Math.floor(shuffled.length / 2);
        const firstRoundLabel =
          pairCount === 1
            ? language === 'vi'
              ? 'Chung kết'
              : 'Final'
            : pairCount === 2
              ? language === 'vi'
                ? 'Bán kết'
                : 'Semifinals'
              : pairCount <= 4
                ? language === 'vi'
                  ? 'Tứ kết'
                  : 'Quarterfinals'
                : language === 'vi'
                  ? 'Vòng 1'
                  : 'Round 1';

        const activeCourts = Math.min(16, Math.max(2, scheduleConfig.courtsCount || 4));
        const activeGroupsCount = Math.min(8, Math.max(2, scheduleConfig.groupsCount || 4));
        const slotMinutes = Math.max(15, scheduleConfig.slotMinutes || 30);

        const formatTimeSlot = (idx: number) => {
          const baseMin = 8 * 60 + 30 + Math.floor(idx / activeCourts) * slotMinutes;
          const hh = String(Math.floor(baseMin / 60)).padStart(2, '0');
          const mm = String(baseMin % 60).padStart(2, '0');
          return `${hh}:${mm}`;
        };

        const formatCourtName = (idx: number) => {
          const courtNum = (idx % activeCourts) + 1;
          return `Sân ${String(courtNum).padStart(2, '0')}`;
        };

        for (let i = 0; i + 1 < shuffled.length; i += 2) {
          const matchIdx = i / 2;
          const teamA = shuffled[i];
          const teamB = shuffled[i + 1];
          const assignedGroup =
            pairCount >= 4
              ? ALL_GROUP_NAMES[matchIdx % Math.min(activeGroupsCount, pairCount)]
              : null;
          generated.push({
            id: makeId('mat'),
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            organizerUid: user?.uid || tournament.organizerUid,
            roundLabel: assignedGroup ? `${firstRoundLabel} · ${assignedGroup}` : firstRoundLabel,
            bracketSlot: `R1_${matchIdx + 1}`,
            courtName: formatCourtName(matchIdx),
            scheduledTime: formatTimeSlot(matchIdx),
            playerAUid: teamA.uid,
            playerBUid: teamB.uid,
            teamAName: teamA.name,
            teamBName: teamB.name,
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            setHistory: [],
            targetPoints: tournamentRules.groupTargetPoints,
            servingSide: 'A',
            status: 'upcoming',
            winnerSide: '',
            ratingDelta: 0,
            visibility: 'public',
          });
        }

        // Auto-seed Knockout Final / Semifinal placeholders for visual bracket tree
        if (pairCount === 2) {
          generated.push({
            id: makeId('mat'),
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            organizerUid: user?.uid || tournament.organizerUid,
            roundLabel: language === 'vi' ? 'Chung kết' : 'Final',
            bracketSlot: 'FINAL',
            courtName: 'Sân 01',
            scheduledTime: formatTimeSlot(4),
            teamAName: language === 'vi' ? 'Thắng Bán kết 1' : 'Winner SF 1',
            teamBName: language === 'vi' ? 'Thắng Bán kết 2' : 'Winner SF 2',
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            setHistory: [],
            targetPoints: tournamentRules.knockoutTargetPoints,
            servingSide: 'A',
            status: 'upcoming',
            winnerSide: '',
            ratingDelta: 0,
            visibility: 'public',
          });
        } else if (pairCount >= 3 && pairCount <= 4) {
          for (let sf = 0; sf < 2; sf++) {
            generated.push({
              id: makeId('mat'),
              tournamentId: tournament.id,
              tournamentTitle: tournament.title,
              organizerUid: user?.uid || tournament.organizerUid,
              roundLabel: language === 'vi' ? 'Bán kết' : 'Semifinals',
              bracketSlot: `SF_${sf + 1}`,
              courtName: `Sân 0${sf + 1}`,
              scheduledTime: formatTimeSlot(4 + sf),
              teamAName: language === 'vi' ? `Thắng TK ${sf * 2 + 1}` : `Winner QF ${sf * 2 + 1}`,
              teamBName: language === 'vi' ? `Thắng TK ${sf * 2 + 2}` : `Winner QF ${sf * 2 + 2}`,
              scoreA: 0,
              scoreB: 0,
              setsA: 0,
              setsB: 0,
              setHistory: [],
              targetPoints: tournamentRules.knockoutTargetPoints,
              servingSide: 'A',
              status: 'upcoming',
              winnerSide: '',
              ratingDelta: 0,
              visibility: 'public',
            });
          }
          generated.push({
            id: makeId('mat'),
            tournamentId: tournament.id,
            tournamentTitle: tournament.title,
            organizerUid: user?.uid || tournament.organizerUid,
            roundLabel: language === 'vi' ? 'Chung kết' : 'Final',
            bracketSlot: 'FINAL',
            courtName: 'Sân 01',
            scheduledTime: formatTimeSlot(8),
            teamAName: language === 'vi' ? 'Thắng Bán kết 1' : 'Winner SF 1',
            teamBName: language === 'vi' ? 'Thắng Bán kết 2' : 'Winner SF 2',
            scoreA: 0,
            scoreB: 0,
            setsA: 0,
            setsB: 0,
            setHistory: [],
            targetPoints: tournamentRules.knockoutTargetPoints,
            servingSide: 'A',
            status: 'upcoming',
            winnerSide: '',
            ratingDelta: 0,
            visibility: 'public',
          });
        }

        const trnInCloud = cloudTournaments.some((t) => t.id === tournament.id);
        if (user?.emailVerified && trnInCloud && (user.uid === tournament.organizerUid || isAdmin)) {
          try {
            const batch = writeBatch(db);
            for (const m of generated) {
              batch.set(doc(db, 'matches', m.id), {
                ...m,
                organizerUid: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            batch.update(doc(db, 'tournaments', tournament.id), {
              status: 'live',
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, 'matches');
          }
        } else {
          setLocalMatches((prev) => [...generated, ...prev]);
          setLocalTournaments((prev) =>
            prev.map((t) => (t.id === tournament.id ? { ...t, status: 'live' } : t))
          );
        }

        await pushAlert(
          language === 'vi' ? 'Hoàn tất bốc thăm chia nhánh' : 'Random Bracket Draw Completed',
          `${tournament.title}: ${generated.length} ${language === 'vi' ? 'trận đấu đã lên sơ đồ & bảng gọi sân.' : 'matches scheduled onto bracket & court board.'}`,
          'match'
        );
        showToast(
          language === 'vi'
            ? `Đã bốc thăm tạo sơ đồ nhánh & phân sân (${generated.length} trận)!`
            : `Generated live bracket & court board (${generated.length} matches)!`
        );
      }
    );
  };

  // Live Score Update
  const handleUpdateMatchScore = async (match: MatchRecord, next: Partial<MatchRecord>) => {
    const isCloud = cloudMatches.some((m) => m.id === match.id);
    if (
      user?.emailVerified &&
      isCloud &&
      (isAdmin || user.uid === match.organizerUid || user.uid === match.playerAUid || user.uid === match.playerBUid)
    ) {
      try {
        await updateDoc(doc(db, 'matches', match.id), {
          ...next,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `matches/${match.id}`);
      }
    } else {
      setLocalMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, ...next } : m)));
    }
  };

  // Finalize Match & Update Real-Time DUPR Rankings
  const handleCompleteMatch = async (match: MatchRecord, winnerSide: 'A' | 'B') => {
    const finalHistory =
      match.scoreA > 0 || match.scoreB > 0
        ? [...(match.setHistory || []), `${match.scoreA}-${match.scoreB}`].slice(0, 5)
        : match.setHistory || [];

    const setsA = match.setsA + (match.scoreA > match.scoreB ? 1 : 0);
    const setsB = match.setsB + (match.scoreB > match.scoreA ? 1 : 0);

    const athA = athletes.find(
      (a) => a.ownerUid === match.playerAUid || match.teamAName.includes(a.displayName)
    );
    const athB = athletes.find(
      (a) => a.ownerUid === match.playerBUid || match.teamBName.includes(a.displayName)
    );

    const winnerRating = winnerSide === 'A' ? athA?.duprRating || 4.5 : athB?.duprRating || 4.5;
    const loserRating = winnerSide === 'A' ? athB?.duprRating || 4.5 : athA?.duprRating || 4.5;
    const delta = computeDuprDelta(winnerRating, loserRating);

    await handleUpdateMatchScore(match, {
      setsA,
      setsB,
      setHistory: finalHistory,
      status: 'completed',
      winnerSide,
      ratingDelta: delta,
    });

    // Update athlete DUPR stats locally (and in Firestore if present)
    const updateAth = async (ath: AthleteProfile | undefined, won: boolean) => {
      if (!ath) return;
      const nextRating = Math.max(
        2.0,
        Math.min(8.0, Math.round((ath.duprRating + (won ? delta : -delta * 0.8)) * 100) / 100)
      );
      const nextWins = ath.wins + (won ? 1 : 0);
      const nextLosses = ath.losses + (won ? 0 : 1);
      const inCloud = cloudAthletes.some((c) => c.id === ath.id);
      if (user?.emailVerified && inCloud) {
        try {
          await updateDoc(doc(db, 'athletes', ath.id), {
            duprRating: nextRating,
            wins: nextWins,
            losses: nextLosses,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Rating sync note:', err);
        }
      } else {
        setLocalAthletes((prev) =>
          prev.map((a) =>
            a.id === ath.id
              ? { ...a, duprRating: nextRating, wins: nextWins, losses: nextLosses }
              : a
          )
        );
      }
    };

    await updateAth(athA, winnerSide === 'A');
    await updateAth(athB, winnerSide === 'B');

    const winnerName = winnerSide === 'A' ? match.teamAName : match.teamBName;
    await pushAlert(
      language === 'vi' ? 'Trận đấu đã kết thúc' : 'Match Finalized',
      `${winnerName} ${language === 'vi' ? 'giành chiến thắng' : 'won'} (${setsA}-${setsB}) · DUPR +${delta.toFixed(2)}`,
      'match'
    );
    showToast(
      language === 'vi'
        ? `Đã chốt kết quả & cập nhật BXH DUPR (+${delta.toFixed(2)})`
        : `Match finalized & DUPR updated (+${delta.toFixed(2)})`
    );
  };

  // =========================================================================
  // Team Cup Handlers (4-Event Lineups, Serie A/B Brackets & Referee App)
  // =========================================================================
  const persistTeamEntry = async (entry: TeamEntry, isNew: boolean) => {
    setLocalTeams((prev) =>
      isNew ? [...prev, entry] : prev.map((tm) => (tm.id === entry.id ? entry : tm))
    );
    if (user?.emailVerified) {
      const { id, createdAt: _c, updatedAt: _u, ...docData } = entry;
      try {
        if (isNew || !cloudTeams.some((c) => c.id === id)) {
          await setDoc(doc(db, 'teamEntries', id), {
            ...docData,
            organizerUid: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'teamEntries', id), {
            members: docData.members,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Team entry cloud sync note:', err);
      }
    }
  };

  const handleCreateTeam = (payload: {
    name: string;
    shortCode: string;
    groupName: GroupName;
    city: string;
  }) => {
    const activeTeamTournamentId =
      tournaments.find((tr) => tr.format === 'team')?.id || tournaments[0]?.id || 'trn_team_cup_1986';
    const newTeam: TeamEntry = {
      id: makeId('team'),
      organizerUid: user?.uid || 'guest',
      tournamentId: activeTeamTournamentId,
      name: payload.name.slice(0, 80),
      shortCode: payload.shortCode.slice(0, 4),
      groupName: payload.groupName,
      city: payload.city.slice(0, 60),
      members: [],
      visibility: 'public',
    };
    void persistTeamEntry(newTeam, true);
    showToast(
      language === 'vi' ? `Đã tạo đội ${newTeam.name} (${newTeam.groupName})` : `Created team ${newTeam.name}`
    );
  };

  const createMasterAthlete = async (payload: {
    displayName: string;
    skillTier: SkillTier;
    gender: Gender;
    clubName?: string;
    city?: string;
  }) => {
    if (!isAdmin || !user?.emailVerified) {
      showToast(
        language === 'vi'
          ? 'Chỉ khi đăng nhập tài khoản Admin mới có thể thêm VĐV.'
          : 'Only a signed-in Admin account can add athletes.'
      );
      return null;
    }
    const cleaned = payload.displayName.trim().slice(0, 80);
    if (cleaned.length < 2) return null;
    const initials = cleaned
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);
    const tierDupr: Record<SkillTier, number> = { A: 4.5, B: 3.75, C: 3.0 };
    const id = makeId('ath');
    const newAth: AthleteProfile = {
      id,
      ownerUid: user.uid,
      displayName: cleaned,
      gender: payload.gender,
      skillTier: payload.skillTier,
      club: (payload.clubName || (language === 'vi' ? 'VĐV Tự do' : 'Free Agent')).slice(0, 80),
      city: (payload.city || 'TP.HCM').slice(0, 60),
      district: '',
      duprRating: tierDupr[payload.skillTier],
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      playingStyle: 'All-Court',
      availableForMatch: true,
      lat: 10.802,
      lng: 106.73,
      avatarInitials: initials || 'VD',
      visibility: 'public',
    };

    setLocalAthletes((prev) => [newAth, ...prev]);
    const { id: _id, createdAt: _c, updatedAt: _u, ...docData } = newAth;
    try {
      await setDoc(doc(db, 'athletes', id), {
        ...docData,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Athlete cloud sync note:', err);
    }
    return newAth;
  };

  const handleAddTeamMember = (
    teamId: string,
    member: Omit<TeamMember, 'id'>,
    opts?: { skipMasterSync?: boolean }
  ) => {
    if (!isAdmin) {
      showToast(
        language === 'vi'
          ? 'Chỉ khi đăng nhập tài khoản Admin mới có thể thêm VĐV.'
          : 'Only a signed-in Admin account can add athletes.'
      );
      return;
    }
    const target = teams.find((tm) => tm.id === teamId);
    if (!target || target.members.length >= 16) return;
    const cleanedName = member.name.trim().slice(0, 80);
    if (cleanedName.length < 2) return;
    if (target.members.some((m) => m.name.trim().toLowerCase() === cleanedName.toLowerCase())) {
      showToast(
        language === 'vi'
          ? `${cleanedName} đã có trong đội ${target.name}`
          : `${cleanedName} is already on ${target.name}`
      );
      return;
    }
    const newMember: TeamMember = {
      id: makeId('mb'),
      name: cleanedName,
      gender: member.gender,
      skillTier: member.skillTier,
    };
    const updated: TeamEntry = {
      ...target,
      members: [...target.members, newMember],
    };
    void persistTeamEntry(updated, false);

    if (!opts?.skipMasterSync) {
      const alreadyInMaster = athletes.some(
        (a) => a.displayName.trim().toLowerCase() === cleanedName.toLowerCase()
      );
      if (!alreadyInMaster) {
        void createMasterAthlete({
          displayName: cleanedName,
          gender: member.gender,
          skillTier: member.skillTier,
          clubName: target.name,
          city: target.city,
        });
      }
    }

    showToast(
      language === 'vi'
        ? `Đã thêm ${newMember.name} (${newMember.gender === 'male' ? 'Nam' : 'Nữ'} · Trình ${newMember.skillTier})`
        : `Added ${newMember.name} (Tier ${newMember.skillTier})`
    );
  };

  const handleRemoveTeamMember = (teamId: string, memberId: string) => {
    if (!isAdmin) {
      showToast(
        language === 'vi'
          ? 'Chỉ tài khoản Admin mới có quyền xóa VĐV khỏi đội.'
          : 'Only an Admin account can remove team athletes.'
      );
      return;
    }
    const target = teams.find((tm) => tm.id === teamId);
    if (!target) return;
    const removed = target.members.find((m) => m.id === memberId);
    const updated: TeamEntry = {
      ...target,
      members: target.members.filter((m) => m.id !== memberId),
    };
    void persistTeamEntry(updated, false);
    if (removed) {
      showToast(
        language === 'vi'
          ? `Đã xóa ${removed.name} khỏi đội ${target.name}`
          : `Removed ${removed.name} from ${target.name}`
      );
    }
  };

  const handleAddAthlete = async (payload: {
    displayName: string;
    skillTier: SkillTier;
    gender: Gender;
    teamId?: string;
  }) => {
    if (!isAdmin) {
      showToast(
        language === 'vi'
          ? 'Chỉ khi đăng nhập tài khoản Admin mới có thể thêm VĐV.'
          : 'Only a signed-in Admin account can add athletes.'
      );
      return;
    }
    const selectedTeam = payload.teamId ? teams.find((tm) => tm.id === payload.teamId) : undefined;
    const created = await createMasterAthlete({
      displayName: payload.displayName,
      skillTier: payload.skillTier,
      gender: payload.gender,
      clubName: selectedTeam?.name,
      city: selectedTeam?.city,
    });
    if (!created) return;

    if (selectedTeam) {
      handleAddTeamMember(
        selectedTeam.id,
        {
          name: created.displayName,
          gender: payload.gender,
          skillTier: payload.skillTier,
        },
        { skipMasterSync: true }
      );
    } else {
      showToast(
        language === 'vi'
          ? `Đã thêm VĐV ${created.displayName} (${payload.gender === 'male' ? 'Nam' : 'Nữ'} · Trình ${payload.skillTier})`
          : `Added athlete ${created.displayName} (Tier ${payload.skillTier})`
      );
    }
  };

  const handleDeleteAthlete = async (athleteId: string) => {
    if (!isAdmin) {
      showToast(
        language === 'vi'
          ? 'Chỉ tài khoản Admin mới có quyền xóa VĐV.'
          : 'Only an Admin account can delete athletes.'
      );
      return;
    }
    const target = athletes.find((a) => a.id === athleteId);
    setLocalAthletes((prev) => prev.filter((a) => a.id !== athleteId));
    setCloudAthletes((prev) => prev.filter((a) => a.id !== athleteId));

    if (user?.emailVerified && cloudAthletes.some((a) => a.id === athleteId)) {
      try {
        await deleteDoc(doc(db, 'athletes', athleteId));
      } catch (err) {
        console.error('Athlete cloud delete note:', err);
      }
    }
    if (target) {
      showToast(
        language === 'vi' ? `Đã xóa VĐV ${target.displayName}` : `Deleted athlete ${target.displayName}`
      );
    }
  };

  const handleClearAllAthletes = async () => {
    if (!isAdmin) {
      showToast(
        language === 'vi'
          ? 'Chỉ tài khoản Admin mới có quyền xóa danh sách VĐV.'
          : 'Only an Admin account can clear athletes.'
      );
      return;
    }
    const cloudIds = cloudAthletes.map((a) => a.id);

    setLocalAthletes([]);
    setCloudAthletes([]);

    // Also clear all team rosters so everything stays cleanly empty
    const emptiedTeams = teams.map((tm) => ({ ...tm, members: [] }));
    setLocalTeams(emptiedTeams);
    for (const tm of teams) {
      if (tm.members.length > 0) {
        void persistTeamEntry({ ...tm, members: [] }, false);
      }
    }

    if (user?.emailVerified && cloudIds.length > 0) {
      for (const id of cloudIds) {
        try {
          await deleteDoc(doc(db, 'athletes', id));
        } catch (err) {
          console.error('Clear athlete cloud note:', err);
        }
      }
    }

    showToast(
      language === 'vi'
        ? 'Đã xóa sạch toàn bộ danh sách VĐV và đội hình'
        : 'Cleared all athletes and team rosters'
    );
  };

  const persistTeamTie = async (tie: TeamTie) => {
    const { id, createdAt: _c, updatedAt: _u, ...rest } = tie;
    if (!user?.emailVerified) return;
    const payload = {
      ...rest,
      organizerUid: user.uid,
      teamAId: rest.teamAId || 'TBD',
      teamBId: rest.teamBId || 'TBD',
      roundLabel: rest.roundLabel.slice(0, 40),
      courtName: (rest.courtName || '').slice(0, 40),
      scheduledSlot: typeof rest.scheduledSlot === 'number' ? rest.scheduledSlot : 0,
      scheduledTime: (rest.scheduledTime || '').slice(0, 24),
      forfeitSide: rest.forfeitSide || '',
    };
    try {
      if (cloudTies.some((c) => c.id === id)) {
        await updateDoc(doc(db, 'teamTies', id), {
          teamAId: payload.teamAId,
          teamBId: payload.teamBId,
          teamAName: payload.teamAName,
          teamBName: payload.teamBName,
          subMatches: payload.subMatches,
          tieBreak: payload.tieBreak ?? null,
          status: payload.status,
          forfeitSide: payload.forfeitSide,
          courtName: payload.courtName,
          scheduledSlot: payload.scheduledSlot,
          scheduledTime: payload.scheduledTime,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'teamTies', id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Team tie cloud sync note:', err);
    }
  };

  const handleUpdateTeamTie = (updatedTie: TeamTie) => {
    const summary = computeTeamTieSummary(updatedTie);
    let nextStatus: TeamTie['status'] = updatedTie.status;
    if (summary.winnerSide === 'A' || summary.winnerSide === 'B' || summary.winnerSide === 'DRAW') {
      nextStatus = 'completed';
    } else if (
      updatedTie.subMatches.some((sm) => sm.status === 'live' || sm.status === 'completed') ||
      updatedTie.tieBreak?.status === 'live'
    ) {
      nextStatus = 'live';
    }

    const finalizedTie: TeamTie = { ...updatedTie, status: nextStatus };
    const prevAllGroupDone = auditScheduleConflicts(ties).allGroupMatchesCompleted;

    // Combine updated tie with existing dataset, then auto-seed Serie A / Serie B
    // and recalculate conflict-free multi-court schedule immediately
    const replaced = ties.some((ti) => ti.id === finalizedTie.id)
      ? ties.map((ti) => (ti.id === finalizedTie.id ? finalizedTie : ti))
      : [...ties, finalizedTie];

    const activeTeamTournamentId =
      tournaments.find((tr) => tr.format === 'team')?.id || tournaments[0]?.id || 'trn_team_cup_1986';
    const scheduledAll = autoSeedAndScheduleTies(
      teams,
      replaced,
      user?.uid || 'guest',
      activeTeamTournamentId,
      scheduleConfig,
      tournamentRules.knockoutTargetPoints,
      tournamentRules.groupTargetPoints
    );

    setLocalTies(scheduledAll);

    // Persist the updated tie and any knockout ties whose seeding/schedule changed
    const nextMap = new Map(scheduledAll.map((ti) => [ti.id, ti]));
    const updatedFromScheduled = nextMap.get(finalizedTie.id) || finalizedTie;
    void persistTeamTie(updatedFromScheduled);
    for (const nextTie of scheduledAll) {
      if (nextTie.id === finalizedTie.id) continue;
      const oldTie = ties.find((ti) => ti.id === nextTie.id);
      if (
        !oldTie ||
        oldTie.teamAId !== nextTie.teamAId ||
        oldTie.teamBId !== nextTie.teamBId ||
        oldTie.courtName !== nextTie.courtName ||
        oldTie.scheduledSlot !== nextTie.scheduledSlot
      ) {
        void persistTeamTie(nextTie);
      }
    }

    const nowAllGroupDone = auditScheduleConflicts(scheduledAll).allGroupMatchesCompleted;
    if (!prevAllGroupDone && nowAllGroupDone) {
      void pushAlert(
        language === 'vi'
          ? 'Tự động chia nhánh Serie A & Serie B'
          : 'Auto-Seeded Serie A & Serie B',
        language === 'vi'
          ? 'Vòng bảng vừa hoàn tất! Hệ thống đã tự chia nhánh Serie A/B và xếp lịch 2 sân chống trùng đội.'
          : 'Group Stage completed! Serie A/B brackets and conflict-free 2-court schedules are now live.',
        'match'
      );
      showToast(
        language === 'vi'
          ? 'Xong Vòng bảng! Đã tự động chia Serie A/B & xếp lịch 2 sân không trùng đội.'
          : 'Group Stage finished! Auto-seeded Serie A/B & scheduled 2 courts conflict-free.'
      );
    }
  };

  const handleGenerateSerieAB = () => {
    if (teams.length < 2) {
      showToast(
        language === 'vi'
          ? 'Cần tạo ít nhất 2 đội Đồng đội trước khi tạo lịch & chia nhánh Serie A/B.'
          : 'Create at least 2 teams before generating schedules and Serie A/B brackets.'
      );
      return;
    }
    const activeTeamTournamentId =
      tournaments.find((tr) => tr.format === 'team')?.id || tournaments[0]?.id || 'trn_team_cup_1986';
    void runWith2FA(
      language === 'vi'
        ? 'Chốt bảng xếp hạng Vòng bảng, chia nhánh Serie A / Serie B và tự xếp lịch sân'
        : 'Seed Serie A/B knockout brackets and generate conflict-free court schedule',
      async () => {
        const scheduledAll = autoSeedAndScheduleTies(
          teams,
          ties,
          user?.uid || 'guest',
          activeTeamTournamentId,
          scheduleConfig,
          tournamentRules.knockoutTargetPoints,
          tournamentRules.groupTargetPoints
        );
        setLocalTies(scheduledAll);
        for (const bt of scheduledAll) {
          void persistTeamTie(bt);
        }
        const audit = auditScheduleConflicts(scheduledAll);
        await pushAlert(
          language === 'vi'
            ? 'Đã chốt nhánh Serie A/B & Lịch sân'
            : 'Serie A/B Brackets & Court Schedule Ready',
          language === 'vi'
            ? `Top 1-2 vào Serie A · Hạng 3-4 vào Serie B · ${audit.conflictCount} xung đột trùng đội trên ${scheduleConfig.courtsCount} sân.`
            : `Top 1-2 to Serie A · Rank 3-4 to Serie B · ${audit.conflictCount} team conflicts across ${scheduleConfig.courtsCount} courts.`,
          'match'
        );
        showToast(
          language === 'vi'
            ? `Đã chia nhánh Serie A/B & xếp lịch ${scheduleConfig.courtsCount} sân (${audit.conflictCount} xung đột)!`
            : `Seeded Serie A/B & scheduled ${scheduleConfig.courtsCount} courts (${audit.conflictCount} conflicts)!`
        );
      }
    );
  };

  const handleUpdateScheduleConfig = (nextCfg: ScheduleConfig) => {
    setScheduleConfig(nextCfg);
    setCourtPins((prev) => ensureCourtPinsForCount(prev, nextCfg.courtsCount));
    const grpCount = nextCfg.groupsCount || 4;
    if (teams.length === 0 && ties.length === 0) {
      showToast(
        language === 'vi'
          ? `Đã lưu cấu hình ${nextCfg.courtsCount} sân · ${grpCount} bảng (${nextCfg.startTime} · ${nextCfg.slotMinutes} phút/ca)`
          : `Saved ${nextCfg.courtsCount}-court · ${grpCount}-group config`
      );
      return;
    }
    const activeTeamTournamentId =
      tournaments.find((tr) => tr.format === 'team')?.id || tournaments[0]?.id || 'trn_team_cup_1986';
    const scheduledAll = autoSeedAndScheduleTies(
      teams,
      ties,
      user?.uid || 'guest',
      activeTeamTournamentId,
      nextCfg,
      tournamentRules.knockoutTargetPoints,
      tournamentRules.groupTargetPoints
    );
    setLocalTies(scheduledAll);
    for (const ti of scheduledAll) {
      void persistTeamTie(ti);
    }
    const audit = auditScheduleConflicts(scheduledAll);
    showToast(
      language === 'vi'
        ? `Đã cập nhật lịch ${nextCfg.courtsCount} sân · ${grpCount} bảng (${audit.totalSlots} khung giờ · ${audit.conflictCount} xung đột)`
        : `Updated ${nextCfg.courtsCount}-court · ${grpCount}-group schedule (${audit.totalSlots} slots · ${audit.conflictCount} conflicts)`
    );
  };

  const handleUpdateTournamentRules = (nextRules: TournamentRulesConfig) => {
    setTournamentRules(nextRules);
    const updatedTies = ties.map((ti) => {
      const stageTarget =
        ti.stage === 'group' ? nextRules.groupTargetPoints : nextRules.knockoutTargetPoints;
      const nextSubMatches = ti.subMatches.map((sm) =>
        sm.status === 'upcoming' && sm.scoreA === 0 && sm.scoreB === 0
          ? { ...sm, targetPoints: stageTarget }
          : sm
      );
      const nextTieBreak =
        ti.tieBreak &&
        ti.tieBreak.status === 'upcoming' &&
        ti.tieBreak.scoreA === 0 &&
        ti.tieBreak.scoreB === 0
          ? { ...ti.tieBreak, targetPoints: nextRules.knockoutTargetPoints }
          : ti.tieBreak;
      return {
        ...ti,
        subMatches: nextSubMatches,
        tieBreak: nextTieBreak,
      };
    });
    setLocalTies(updatedTies);
    for (const ti of updatedTies) {
      void persistTeamTie(ti);
    }
    showToast(
      language === 'vi'
        ? `Đã đặt mặc định giải: Vòng bảng chạm ${nextRules.groupTargetPoints}đ · Knockout chạm ${nextRules.knockoutTargetPoints}đ`
        : `Tournament defaults updated: Group to ${nextRules.groupTargetPoints} · Knockout to ${nextRules.knockoutTargetPoints}`
    );
  };

  const handleAutoReschedule = () => {
    if (teams.length < 2) {
      showToast(
        language === 'vi'
          ? 'Cần tạo ít nhất 2 đội Đồng đội trước khi tự động xếp lịch.'
          : 'Create at least 2 teams before auto-scheduling.'
      );
      return;
    }
    const activeTeamTournamentId =
      tournaments.find((tr) => tr.format === 'team')?.id || tournaments[0]?.id || 'trn_team_cup_1986';
    const scheduledAll = autoSeedAndScheduleTies(
      teams,
      ties,
      user?.uid || 'guest',
      activeTeamTournamentId,
      scheduleConfig,
      tournamentRules.knockoutTargetPoints,
      tournamentRules.groupTargetPoints
    );
    setLocalTies(scheduledAll);
    for (const ti of scheduledAll) {
      void persistTeamTie(ti);
    }
    const audit = auditScheduleConflicts(scheduledAll);
    showToast(
      language === 'vi'
        ? `Xếp lịch hoàn tất: ${audit.totalSlots} khung giờ · ${audit.conflictCount} xung đột trùng đội`
        : `Rescheduled cleanly: ${audit.totalSlots} slots · ${audit.conflictCount} team conflicts`
    );
  };

  const handleRegenerateCourtPin = (courtName: string) => {
    const newPin = generateRandomSixDigitPin();
    setCourtPins((prev) =>
      prev.map((cp) => (cp.courtName === courtName ? { ...cp, pin: newPin } : cp))
    );
    showToast(
      language === 'vi'
        ? `Đã cấp mã PIN mới cho ${courtName}: ${newPin}`
        : `New PIN issued for ${courtName}: ${newPin}`
    );
  };

  const handleRefereeApply = async (payload: RefereeFinalPayload, closeAfter: boolean) => {
    if (!refereeContext) return;
    const { target } = refereeContext;

    if (target.kind === 'submatch') {
      const tie = ties.find((ti) => ti.id === target.tieId);
      if (tie) {
        const teamAObj = teams.find((t) => t.id === tie.teamAId);
        const teamBObj = teams.find((t) => t.id === tie.teamBId);
        const validAIds = new Set((teamAObj?.members || []).map((m) => m.id));
        const validBIds = new Set((teamBObj?.members || []).map((m) => m.id));

        const nextSubMatches = tie.subMatches.map((sm) => {
          if (sm.id !== target.subMatchId) return sm;
          const nextAIds: [string, string] = [
            payload.updatedTeamAPlayerIds?.[0] && validAIds.has(payload.updatedTeamAPlayerIds[0])
              ? payload.updatedTeamAPlayerIds[0]
              : sm.teamAPlayerIds[0],
            payload.updatedTeamAPlayerIds?.[1] && validAIds.has(payload.updatedTeamAPlayerIds[1])
              ? payload.updatedTeamAPlayerIds[1]
              : sm.teamAPlayerIds[1],
          ];
          const nextBIds: [string, string] = [
            payload.updatedTeamBPlayerIds?.[0] && validBIds.has(payload.updatedTeamBPlayerIds[0])
              ? payload.updatedTeamBPlayerIds[0]
              : sm.teamBPlayerIds[0],
            payload.updatedTeamBPlayerIds?.[1] && validBIds.has(payload.updatedTeamBPlayerIds[1])
              ? payload.updatedTeamBPlayerIds[1]
              : sm.teamBPlayerIds[1],
          ];
          return {
            ...sm,
            teamAPlayerIds: nextAIds,
            teamBPlayerIds: nextBIds,
            scoreA: payload.scoreA,
            scoreB: payload.scoreB,
            targetPoints: payload.targetPoints,
            servingSide: payload.servingSide,
            serverNumber: payload.serverNumber,
            status: payload.status,
            winnerSide: payload.winnerSide,
            forfeitSide: payload.forfeitSide ?? ('' as const),
          };
        });
        handleUpdateTeamTie({ ...tie, subMatches: nextSubMatches });
      }
    } else if (target.kind === 'tiebreak') {
      const tie = ties.find((ti) => ti.id === target.tieId);
      if (tie && tie.tieBreak) {
        const teamAObj = teams.find((t) => t.id === tie.teamAId);
        const teamBObj = teams.find((t) => t.id === tie.teamBId);
        const validAIds = new Set((teamAObj?.members || []).map((m) => m.id));
        const validBIds = new Set((teamBObj?.members || []).map((m) => m.id));

        const nextTbA = tie.tieBreak.teamAPlayerIds.map((oldId, i) =>
          payload.updatedTeamAPlayerIds?.[i] && validAIds.has(payload.updatedTeamAPlayerIds[i])
            ? payload.updatedTeamAPlayerIds[i]
            : oldId
        );
        const nextTbB = tie.tieBreak.teamBPlayerIds.map((oldId, i) =>
          payload.updatedTeamBPlayerIds?.[i] && validBIds.has(payload.updatedTeamBPlayerIds[i])
            ? payload.updatedTeamBPlayerIds[i]
            : oldId
        );

        handleUpdateTeamTie({
          ...tie,
          tieBreak: {
            ...tie.tieBreak,
            teamAPlayerIds: nextTbA,
            teamBPlayerIds: nextTbB,
            scoreA: payload.scoreA,
            scoreB: payload.scoreB,
            targetPoints: payload.targetPoints,
            servingSide: payload.servingSide,
            status: payload.status,
            winnerSide: payload.winnerSide,
            forfeitSide: payload.forfeitSide ?? ('' as const),
          },
        });
      }
    } else if (target.kind === 'match') {
      const match = matches.find((m) => m.id === target.matchId);
      if (match) {
        const nextTeamAName = payload.updatedTeamAName || match.teamAName;
        const nextTeamBName = payload.updatedTeamBName || match.teamBName;
        if (payload.status === 'completed' && (payload.winnerSide === 'A' || payload.winnerSide === 'B')) {
          await handleCompleteMatch(
            {
              ...match,
              teamAName: nextTeamAName,
              teamBName: nextTeamBName,
              scoreA: payload.scoreA,
              scoreB: payload.scoreB,
              targetPoints: payload.targetPoints,
              servingSide: payload.servingSide,
              serverNumber: payload.serverNumber,
            },
            payload.winnerSide
          );
        } else {
          await handleUpdateMatchScore(match, {
            teamAName: nextTeamAName,
            teamBName: nextTeamBName,
            scoreA: payload.scoreA,
            scoreB: payload.scoreB,
            targetPoints: payload.targetPoints,
            servingSide: payload.servingSide,
            serverNumber: payload.serverNumber,
            status: 'live',
          });
        }
      }
    }

    showToast(
      payload.status === 'completed'
        ? language === 'vi'
          ? 'Trọng tài đã chốt tỷ số trận đấu!'
          : 'Referee finalized the match!'
        : language === 'vi'
          ? 'Đã lưu tỷ số trực tuyến từ App Trọng tài'
          : 'Live score saved from Referee App'
    );
    if (closeAfter) setRefereeContext(null);
  };

  // JSON Backup Export & Import
  const handleDownloadJsonBackup = () => {
    const bundle = {
      exportedAt: new Date().toISOString(),
      version: 2,
      tournaments,
      matches,
      athletes,
      registrations,
      teams,
      ties,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1986_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonBackup = async (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed.tournaments)) setLocalTournaments(parsed.tournaments);
      if (Array.isArray(parsed.matches)) setLocalMatches(parsed.matches);
      if (Array.isArray(parsed.athletes)) setLocalAthletes(parsed.athletes);
      if (Array.isArray(parsed.registrations)) setLocalRegistrations(parsed.registrations);
      if (Array.isArray(parsed.teams)) setLocalTeams(parsed.teams);
      if (Array.isArray(parsed.ties)) setLocalTies(parsed.ties);
      showToast(language === 'vi' ? 'Khôi phục dữ liệu từ bản sao lưu thành công!' : 'Backup restored successfully!');
    } catch {
      showToast(language === 'vi' ? 'Tệp sao lưu JSON không hợp lệ.' : 'Invalid JSON backup file.');
    }
  };

  const isSignedIn = Boolean(user?.emailVerified);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const liveMatchCount = matches.filter((m) => m.status === 'live').length;
  const canShareSocial = roleSession.role !== 'referee';
  const handleSafeOpenShare = (payload: ShareCardPayload) => {
    if (!canShareSocial) return;
    setSharePayload(payload);
  };
  const handleGoogleSignIn = () => {
    void signInWithGoogle()
      .then(() => {
        setRoleSession({ role: 'organizer', refereeName: '', assignedCourt: '' });
      })
      .catch((e) =>
        showToast(e instanceof Error ? e.message : 'Sign-in cancelled')
      );
  };
  const handleOpenCreateTournament = () => {
    if (!isSignedIn) {
      showToast(
        language === 'vi'
          ? 'Vui lòng đăng nhập tài khoản trước khi tạo giải đấu.'
          : 'Please sign in before creating a tournament.'
      );
      return;
    }
    setActiveTab('tournaments');
    setShowCreateTournament(true);
  };

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#120D0A] text-stone-900 dark:text-stone-100 transition-colors">
        <SidebarNav
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          language={language}
          onToggleLanguage={() =>
            void handleSavePrivateSettings({ language: language === 'vi' ? 'en' : 'vi' })
          }
          darkMode={darkMode}
          onToggleDarkMode={() => void handleSavePrivateSettings({ darkMode: !darkMode })}
          userName={user?.displayName || null}
          userPhoto={user?.photoURL || null}
          isSignedIn={isSignedIn}
          roleSession={roleSession}
          unreadCount={unreadCount}
          liveMatchCount={liveMatchCount}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenRoleModal={() => setShowRoleModal(true)}
          onSignIn={handleGoogleSignIn}
          onSignOut={() => {
            setShowCreateTournament(false);
            void signOutUser();
          }}
          onPrimaryAction={handleOpenCreateTournament}
        />

        <main
          onTouchStart={handleMainTouchStart}
          onTouchEnd={handleMainTouchEnd}
          className="lg:pl-64 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] lg:pb-12"
        >
          <div
            key={activeTab}
            className={`max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 ${
              tabSlideDir === 'right'
                ? 'ios27-tab-slide-right'
                : tabSlideDir === 'left'
                  ? 'ios27-tab-slide-left'
                  : ''
            }`}
          >
            {activeTab === 'tournaments' && (
              <TournamentsView
                tournaments={tournaments}
                matches={matches}
                registrations={registrations}
                athletes={athletes}
                checkIns={checkIns}
                language={language}
                currentUid={isSignedIn && user ? user.uid : null}
                currentUserName={myProfile?.displayName || user?.displayName || null}
                isAdmin={isAdmin}
                showCreateModal={showCreateTournament && isSignedIn}
                onCloseCreateModal={() => setShowCreateTournament(false)}
                onOpenCreateModal={handleOpenCreateTournament}
                onSignIn={handleGoogleSignIn}
                onJumpToLive={() => setActiveTab('live')}
                onJumpToTeamCup={() => setActiveTab('teamcup')}
                onCreateTournament={handleCreateTournament}
                onRegisterTournament={handleRegisterTournament}
                onRunRandomDraw={handleRunRandomDraw}
                onOpenVietQR={(tournament, registration) =>
                  setVietqrContext({ tournament, registration })
                }
                onOpenQrScanner={(tournamentId) => setQrScannerContext({ tournamentId })}
                onOpenAthleteQr={(athlete, tournamentId) =>
                  setQrAthleteContext({ athlete, tournamentId })
                }
                onUndoCheckIn={handleUndoCheckIn}
                onToggleKitIssued={handleToggleKitIssued}
                onCallToCourt={(match) => {
                  void pushAlert(
                    language === 'vi'
                      ? `Mời VĐV ra ${match.courtName}`
                      : `Call to ${match.courtName}`,
                    `${match.teamAName} vs ${match.teamBName} · ${match.roundLabel}`,
                    'match'
                  );
                  showToast(
                    language === 'vi'
                      ? `Đã phát thông báo gọi sân: ${match.teamAName} vs ${match.teamBName} → ${match.courtName}`
                      : `Called to ${match.courtName}: ${match.teamAName} vs ${match.teamBName}`
                  );
                }}
                onStartMatch={(match) => void handleUpdateMatchScore(match, { status: 'live' })}
                onOpenRefereeMatch={(match) => {
                  const isDbl = match.teamAName.includes('/') || match.teamBName.includes('/');
                  const parseSlots = (raw: string, prefix: string) =>
                    raw
                      .split(/\s*\/\s*/)
                      .map((name, idx) => ({ id: `${prefix}_${idx}`, name: name.trim() }))
                      .filter((p) => p.name);
                  const isKoMatch = /chung kết|bán kết|tứ kết|final|semi|quarter|knockout/i.test(
                    match.roundLabel || ''
                  );
                  const defaultPts = isKoMatch
                    ? tournamentRules.knockoutTargetPoints
                    : tournamentRules.groupTargetPoints;
                  setRefereeContext({
                    session: {
                      id: match.id,
                      title: `${match.roundLabel} · ${match.courtName}`,
                      subtitle: match.tournamentTitle || '1986',
                      teamAName: match.teamAName,
                      teamBName: match.teamBName,
                      teamAPlayers: parseSlots(match.teamAName, 'ma'),
                      teamBPlayers: parseSlots(match.teamBName, 'mb'),
                      isDoubles: isDbl,
                      initialScoreA: match.scoreA,
                      initialScoreB: match.scoreB,
                      initialTargetPoints:
                        match.status === 'upcoming' && match.scoreA === 0 && match.scoreB === 0
                          ? defaultPts
                          : match.targetPoints || defaultPts,
                      initialServingSide: match.servingSide || 'A',
                      initialServerNumber: match.serverNumber || 2,
                      stageLabel: isKoMatch
                        ? 'Knockout'
                        : language === 'vi'
                          ? 'Vòng bảng'
                          : 'Group',
                    },
                    target: { kind: 'match', matchId: match.id },
                  });
                }}
                onInspectMatchH2H={(match) =>
                  setH2hContext(buildMatchH2HContext(match, athletes, teams, language))
                }
                onInspectProfileH2H={(name) =>
                  setH2hContext({
                    mode: 'profile',
                    sideA: buildEntityFromName(name, athletes, teams, language),
                    sideB: null,
                  })
                }
                onOpenShare={handleSafeOpenShare}
                canShare={canShareSocial}
              />
            )}

            {activeTab === 'teamcup' && (
              <TeamCupView
                teams={teams}
                ties={ties}
                athletes={athletes}
                language={language}
                isAdmin={isAdmin}
                roleSession={roleSession}
                courtPins={courtPins}
                scheduleConfig={scheduleConfig}
                tournamentRules={tournamentRules}
                onUpdateScheduleConfig={handleUpdateScheduleConfig}
                onUpdateTournamentRules={handleUpdateTournamentRules}
                onAutoReschedule={handleAutoReschedule}
                onOpenRoleModal={() => setShowRoleModal(true)}
                onSignInAdmin={() => void handleAdminSignIn()}
                onRegenerateCourtPin={handleRegenerateCourtPin}
                onUpdateTie={handleUpdateTeamTie}
                onGenerateSerieAB={handleGenerateSerieAB}
                onCreateTeam={handleCreateTeam}
                onAddTeamMember={handleAddTeamMember}
                onRemoveTeamMember={handleRemoveTeamMember}
                onLaunchReferee={(session, target) => setRefereeContext({ session, target })}
                onInspectTieH2H={(tie) =>
                  setH2hContext(buildTieH2HContext(tie, teams, athletes, language))
                }
                onInspectTeamH2H={(team) =>
                  setH2hContext({
                    mode: 'profile',
                    sideA: buildEntityFromTeam(team, language),
                    sideB: null,
                  })
                }
                onInspectPlayerH2H={(playerName) =>
                  setH2hContext({
                    mode: 'profile',
                    sideA: buildEntityFromName(playerName, athletes, teams, language),
                    sideB: null,
                  })
                }
              />
            )}

            {activeTab === 'live' && (
              <LiveScoreView
                matches={matches}
                language={language}
                canShare={canShareSocial}
                onUpdateMatchScore={handleUpdateMatchScore}
                onCompleteMatch={handleCompleteMatch}
                onScheduleMatchAlert={async (match) => {
                  await pushAlert(
                    language === 'vi' ? 'Đã bật nhắc trận đấu sắp diễn ra' : 'Upcoming Match Reminder Set',
                    `${match.teamAName} vs ${match.teamBName} · ${match.courtName}`,
                    'match'
                  );
                  showToast(
                    language === 'vi'
                      ? 'Đã đặt thông báo đẩy nhắc trước trận đấu 15 phút!'
                      : 'Push alert scheduled 15 minutes before match!'
                  );
                }}
                onOpenShare={handleSafeOpenShare}
                onOpenRefereeApp={(match) => {
                  const isDbl = match.teamAName.includes('/') || match.teamBName.includes('/');
                  const parseSlots = (raw: string, prefix: string) =>
                    raw
                      .split(/\s*\/\s*/)
                      .map((name, idx) => ({ id: `${prefix}_${idx}`, name: name.trim() }))
                      .filter((p) => p.name);
                  const isKoMatch = /chung kết|bán kết|tứ kết|final|semi|quarter|knockout/i.test(
                    match.roundLabel || ''
                  );
                  const defaultPts = isKoMatch
                    ? tournamentRules.knockoutTargetPoints
                    : tournamentRules.groupTargetPoints;
                  setRefereeContext({
                    session: {
                      id: match.id,
                      title: `${match.roundLabel} · ${match.courtName}`,
                      subtitle: match.tournamentTitle || '1986',
                      teamAName: match.teamAName,
                      teamBName: match.teamBName,
                      teamAPlayers: parseSlots(match.teamAName, 'ma'),
                      teamBPlayers: parseSlots(match.teamBName, 'mb'),
                      isDoubles: isDbl,
                      initialScoreA: match.scoreA,
                      initialScoreB: match.scoreB,
                      initialTargetPoints:
                        match.status === 'upcoming' && match.scoreA === 0 && match.scoreB === 0
                          ? defaultPts
                          : match.targetPoints || defaultPts,
                      initialServingSide: match.servingSide || 'A',
                      initialServerNumber: match.serverNumber || 2,
                      stageLabel: isKoMatch
                        ? 'Knockout'
                        : language === 'vi'
                          ? 'Vòng bảng'
                          : 'Group',
                    },
                    target: { kind: 'match', matchId: match.id },
                  });
                }}
                onInspectMatchH2H={(match) =>
                  setH2hContext(buildMatchH2HContext(match, athletes, teams, language))
                }
              />
            )}

            {activeTab === 'rankings' && (
              <RankingsH2HView
                athletes={athletes}
                teams={teams}
                ties={ties}
                tournaments={tournaments}
                checkIns={checkIns}
                matches={matches}
                language={language}
                canManageAthletes={isAdmin}
                canShare={canShareSocial}
                onRequireAdminLogin={() => void handleAdminSignIn()}
                onAddAthlete={(payload) => void handleAddAthlete(payload)}
                onDeleteAthlete={(id) => void handleDeleteAthlete(id)}
                onClearAllAthletes={() => void handleClearAllAthletes()}
                onOpenAthleteQr={(athlete, tournamentId) =>
                  setQrAthleteContext({ athlete, tournamentId })
                }
                onOpenQrScanner={(tournamentId) => setQrScannerContext({ tournamentId })}
                onOpenShare={handleSafeOpenShare}
                onInspectH2H={(ctx) => setH2hContext(ctx)}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsSecurityView
                language={language}
                onChangeLanguage={(lang) => void handleSavePrivateSettings({ language: lang })}
                darkMode={darkMode}
                onChangeDarkMode={(dm) => void handleSavePrivateSettings({ darkMode: dm })}
                themeAccent={themeAccent}
                onChangeThemeAccent={(acc) => {
                  localStorage.setItem('pc_accent_1986_user_picked', '1');
                  void handleSavePrivateSettings({ themeAccent: acc });
                }}
                privateSettings={privateSettings}
                onSavePrivateSettings={handleSavePrivateSettings}
                myProfile={myProfile}
                onSaveMyProfile={handleSaveMyProfile}
                backups={backups}
                onCreateCloudBackup={handleCreateCloudBackup}
                onDownloadJsonBackup={handleDownloadJsonBackup}
                onImportJsonBackup={handleImportJsonBackup}
                onSendTestNotification={async () => {
                  await pushAlert(
                    language === 'vi'
                      ? 'Thông báo 1986 hoạt động'
                      : '1986 Push Alert Active',
                    language === 'vi'
                      ? 'Bạn sẽ nhận thông báo cá nhân hóa cho các trận sắp diễn ra và kết quả giải đấu.'
                      : 'You will receive personalized alerts for upcoming matches and tournament updates.',
                    'system'
                  );
                  showToast(language === 'vi' ? 'Đã gửi thông báo đẩy thử nghiệm!' : 'Test push notification sent!');
                }}
                userEmail={user?.email || null}
              />
            )}
          </div>
        </main>

        {/* Modals & Drawers with Framer Motion Slide-in / Slide-out */}
        <AnimatePresence>
          {vietqrContext && (
            <VietQRPaymentModal
              key="vietqr-modal"
              tournament={vietqrContext.tournament}
              registration={vietqrContext.registration}
              language={language}
              isOrganizer={
                isAdmin ||
                !user ||
                user.uid === vietqrContext.tournament.organizerUid
              }
              onConfirmPaid={handleConfirmPaid}
              onVerifyReceipt={handleVerifyReceipt}
              onClose={() => setVietqrContext(null)}
            />
          )}

          {canShareSocial && sharePayload && (
            <SocialShareModal
              key="social-share-modal"
              payload={sharePayload}
              language={language}
              onClose={() => setSharePayload(null)}
            />
          )}

          {pending2FA && privateSettings.totpSecret && (
            <TwoFactorVerifyModal
              key="two-factor-modal"
              secret={privateSettings.totpSecret}
              recoveryCodes={privateSettings.recoveryCodes || []}
              actionDescription={pending2FA.description}
              language={language}
              onSuccess={() => {
                const fn = pending2FA.onVerified;
                setPending2FA(null);
                void fn();
              }}
              onClose={() => setPending2FA(null)}
            />
          )}

          {showNotifications && (
            <NotificationDrawer
              key="notification-drawer"
              notifications={notifications}
              language={language}
              onMarkRead={(id) => {
                setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
                if (user?.emailVerified && id !== 'notif_welcome') {
                  void updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});
                }
              }}
              onMarkAllRead={() => {
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              }}
              onClose={() => setShowNotifications(false)}
            />
          )}

          {showRoleModal && (
            <RoleAccessModal
              key="role-access-modal"
              language={language}
              roleSession={roleSession}
              userName={user?.displayName || null}
              userEmail={user?.email || null}
              courtPins={courtPins}
              onClose={() => setShowRoleModal(false)}
              onSignInGoogleOrganizer={async () => {
                try {
                  await signInWithGoogle();
                  setRoleSession({ role: 'organizer', refereeName: '', assignedCourt: '' });
                  showToast(
                    language === 'vi'
                      ? 'Đã đăng nhập quyền Ban Tổ Chức (Google)'
                      : 'Signed in as Organizer (Google)'
                  );
                } catch (e) {
                  showToast(e instanceof Error ? e.message : 'Sign-in cancelled');
                }
              }}
              onSignOutGoogle={async () => {
                await signOutUser();
                showToast(
                  language === 'vi' ? 'Đã đăng xuất tài khoản Google' : 'Signed out of Google'
                );
              }}
              onActivateOrganizerRole={() => {
                setRoleSession({ role: 'organizer', refereeName: '', assignedCourt: '' });
                showToast(
                  language === 'vi'
                    ? 'Đang ở chế độ Ban Tổ Chức (BTC)'
                    : 'Switched to Organizer (BTC) mode'
                );
              }}
              onActivateRefereeRole={({ refereeName, assignedCourt }) => {
                setRoleSession({
                  role: 'referee',
                  refereeName,
                  assignedCourt,
                });
                setActiveTab('teamcup');
                showToast(
                  language === 'vi'
                    ? `Đăng nhập Trọng tài thành công · ${assignedCourt === 'all' ? 'Tất cả sân' : assignedCourt}`
                    : `Referee signed in · ${assignedCourt}`
                );
              }}
              onSwitchToViewerRole={() => {
                setRoleSession({ role: 'viewer', refereeName: '', assignedCourt: '' });
                showToast(
                  language === 'vi'
                    ? 'Đã chuyển sang chế độ VĐV / Khán giả'
                    : 'Switched to Viewer mode'
                );
              }}
              onRegenerateCourtPin={handleRegenerateCourtPin}
            />
          )}

          {refereeContext && (
            <RefereeAppModal
              key={`referee-modal-${refereeContext.session.id}`}
              session={refereeContext.session}
              language={language}
              onClose={() => setRefereeContext(null)}
              onSaveProgress={(payload) => void handleRefereeApply(payload, false)}
              onFinalize={(payload) => void handleRefereeApply(payload, true)}
            />
          )}

          {qrAthleteContext && (
            <AthleteQrModal
              key={`athlete-qr-modal-${qrAthleteContext.athlete.id}`}
              athlete={qrAthleteContext.athlete}
              tournaments={tournaments}
              initialTournamentId={qrAthleteContext.tournamentId}
              checkIns={checkIns}
              language={language}
              isAdmin={isAdmin}
              onClose={() => setQrAthleteContext(null)}
              onManualCheckIn={async (trnId, athId) => {
                await handleProcessCheckIn(trnId, athId);
              }}
              onUndoCheckIn={handleUndoCheckIn}
              onOpenScanner={(trnId) => setQrScannerContext({ tournamentId: trnId })}
            />
          )}

          {qrScannerContext && (
            <AdminQrScannerModal
              key="admin-qr-scanner-modal"
              tournaments={tournaments}
              initialTournamentId={qrScannerContext.tournamentId}
              athletes={athletes}
              checkIns={checkIns}
              language={language}
              isAdmin={isAdmin}
              onRequireAdminLogin={() => void handleAdminSignIn()}
              onProcessCheckIn={handleProcessCheckIn}
              onUndoCheckIn={handleUndoCheckIn}
              onOpenAthleteQr={(athlete, trnId) =>
                setQrAthleteContext({ athlete, tournamentId: trnId })
              }
              onClose={() => setQrScannerContext(null)}
            />
          )}

          {h2hContext && (
            <HeadToHeadModal
              key={`h2h-modal-${h2hContext.sideA.name}`}
              context={h2hContext}
              matches={matches}
              ties={ties}
              teams={teams}
              athletes={athletes}
              language={language}
              canShare={canShareSocial}
              onOpenShare={handleSafeOpenShare}
              onClose={() => setH2hContext(null)}
            />
          )}
        </AnimatePresence>

        {!refereeContext && (
          <QuickThemeToggle
            darkMode={darkMode}
            language={language}
            onToggle={() => void handleSavePrivateSettings({ darkMode: !darkMode })}
          />
        )}

        {/* Toast feedback with smooth Framer Motion slide-up */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              key={toastMessage}
              role="status"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed bottom-[calc(8.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-20 left-3 right-3 sm:left-auto sm:right-5 lg:right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-lg text-center sm:text-left"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <OfflineIndicator language={language} />
      </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
