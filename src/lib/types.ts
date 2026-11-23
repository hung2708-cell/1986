export type ThemeAccent = 'amber' | 'crimson' | 'emerald' | 'rose' | 'violet';
export type Language = 'vi' | 'en';
export type TabId = 'tournaments' | 'teamcup' | 'live' | 'rankings' | 'settings';
export type Gender = 'male' | 'female';
export type SkillTier = 'A' | 'B' | 'C';
export type TournamentFormat = 'doubles' | 'team';
export type GroupName =
  | 'Bảng A'
  | 'Bảng B'
  | 'Bảng C'
  | 'Bảng D'
  | 'Bảng E'
  | 'Bảng F'
  | 'Bảng G'
  | 'Bảng H';

export const ALL_GROUP_NAMES: GroupName[] = [
  'Bảng A',
  'Bảng B',
  'Bảng C',
  'Bảng D',
  'Bảng E',
  'Bảng F',
  'Bảng G',
  'Bảng H',
];

export interface AthleteProfile {
  id: string;
  ownerUid: string;
  displayName: string;
  gender?: Gender;
  skillTier?: SkillTier;
  club: string;
  city: string;
  district: string;
  duprRating: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  playingStyle: string;
  availableForMatch: boolean;
  lat: number;
  lng: number;
  avatarInitials: string;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateSecurity {
  ownerUid: string;
  twoFactorEnabled: boolean;
  totpSecret?: string;
  recoveryCodes?: string[];
  themeAccent: ThemeAccent;
  darkMode: boolean;
  language: Language;
  notifyUpcomingMatch: boolean;
  notifyScoreUpdate: boolean;
  notifyChatMention: boolean;
  notifyPaymentReceipt: boolean;
  autoCloudBackup: boolean;
  updatedAt?: unknown;
}

export interface Tournament {
  id: string;
  organizerUid: string;
  title: string;
  format?: TournamentFormat;
  location: string;
  city: string;
  startDate: string;
  category: string;
  skillCap: number;
  entryFeeVnd: number;
  maxTeams: number;
  registeredCount: number;
  status: 'open' | 'drawn' | 'live' | 'completed';
  bankCode: string;
  bankAccount: string;
  bankAccountName: string;
  prizePoolVnd: number;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Registration {
  id: string;
  tournamentId: string;
  organizerUid: string;
  athleteUid: string;
  teamName: string;
  partnerName?: string;
  gender?: Gender;
  skillTier?: SkillTier;
  partnerGender?: Gender | '';
  partnerSkillTier?: SkillTier | '';
  combinedDupr?: number;
  category: string;
  amountVnd: number;
  transferCode: string;
  paymentStatus: 'pending' | 'paid' | 'verified';
  receiptCode?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TournamentCheckIn {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  athleteId: string;
  athleteName: string;
  skillTier?: SkillTier;
  gender?: Gender;
  club?: string;
  status: 'checked_in';
  checkedInByUid: string;
  checkedInByEmail?: string;
  checkedInAtIso: string;
  kitIssued?: boolean;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MatchRecord {
  id: string;
  tournamentId: string;
  tournamentTitle?: string;
  organizerUid: string;
  roundLabel: string;
  groupName?: string;
  bracketSlot?: string;
  courtName: string;
  scheduledTime?: string;
  playerAUid?: string;
  playerBUid?: string;
  teamAName: string;
  teamBName: string;
  scoreA: number;
  scoreB: number;
  setsA: number;
  setsB: number;
  setHistory: string[];
  targetPoints: number;
  servingSide: 'A' | 'B';
  serverNumber?: 1 | 2;
  status: 'upcoming' | 'live' | 'completed';
  winnerSide: '' | 'A' | 'B';
  ratingDelta?: number;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

// =============================================================================
// Team Cup, 4-Event Gender-Filtered Lineups, Serie A/B & Referee App Types
// =============================================================================
export interface TeamMember {
  id: string;
  name: string;
  gender: Gender;
  skillTier: SkillTier;
}

export interface TeamEntry {
  id: string;
  organizerUid: string;
  tournamentId: string;
  name: string;
  shortCode: string;
  groupName: GroupName;
  city: string;
  members: TeamMember[];
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type SubMatchType = 'womens_doubles' | 'mens_doubles' | 'mixed_1' | 'mixed_2';
export type TargetPointsOption = 11 | 15 | 21;

export interface TournamentRulesConfig {
  groupTargetPoints: TargetPointsOption;
  knockoutTargetPoints: TargetPointsOption;
}

export interface TeamSubMatch {
  id: string;
  type: SubMatchType;
  labelVi: string;
  labelEn: string;
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  scoreA: number;
  scoreB: number;
  targetPoints: number;
  servingSide: 'A' | 'B';
  serverNumber: 1 | 2;
  status: 'upcoming' | 'live' | 'completed';
  winnerSide: '' | 'A' | 'B';
  forfeitSide?: '' | 'A' | 'B';
}

export type TieBreakMode = 'singles_1v1' | 'dreambreaker';

export interface TieBreakSingles {
  mode: TieBreakMode;
  teamAPlayerIds: string[]; // 1 player for singles_1v1, up to 4 for dreambreaker
  teamBPlayerIds: string[];
  scoreA: number;
  scoreB: number;
  targetPoints: number;
  servingSide: 'A' | 'B';
  status: 'upcoming' | 'live' | 'completed';
  winnerSide: '' | 'A' | 'B';
  forfeitSide?: '' | 'A' | 'B';
}

export type UserRoleMode = 'organizer' | 'referee' | 'viewer';

export interface CourtPinConfig {
  courtName: string;
  pin: string;
  refereeLabel: string;
}

export interface StaffRoleSession {
  role: UserRoleMode;
  refereeName?: string;
  assignedCourt?: string; // 'Sân 1', 'Sân 2', or 'all'
}

export interface ScheduleConfig {
  courtsCount: number;
  groupsCount?: number;
  startTime: string; // HH:MM e.g. '08:00'
  slotMinutes: number; // e.g. 30
}

export interface TeamTie {
  id: string;
  organizerUid: string;
  tournamentId: string;
  stage: 'group' | 'serieA' | 'serieB';
  groupName?: string;
  roundLabel: string;
  bracketSlot?: 'SF1' | 'SF2' | 'FINAL' | 'GROUP';
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  courtName?: string;
  scheduledSlot?: number;
  scheduledTime?: string;
  subMatches: TeamSubMatch[];
  tieBreak?: TieBreakSingles | null;
  status: 'upcoming' | 'live' | 'completed';
  forfeitSide?: '' | 'A' | 'B';
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TeamStandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  shortCode: string;
  groupName: GroupName;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  forfeits: number;
  subWins: number;
  subLosses: number;
  pointDiff: number;
  points: number; // Win = 3, Draw 2-2 = 2, Loss = 1, Forfeit = 0
  qualifiedSerie: 'Serie A' | 'Serie B';
}

export interface CommunityPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorRating?: number;
  content: string;
  tag?: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PostComment {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  visibility: 'public';
  createdAt?: unknown;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  senderRating?: number;
  text: string;
  visibility: 'public';
  createdAt?: unknown;
}

export interface NotificationItem {
  id: string;
  recipientUid: string;
  title: string;
  body: string;
  category: 'match' | 'payment' | 'chat' | 'challenge' | 'system';
  read: boolean;
  createdAt?: unknown;
}

export interface ChallengeInvite {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  courtName: string;
  proposedTime: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CloudBackupSnapshot {
  id: string;
  ownerUid: string;
  label: string;
  tournamentsCount: number;
  matchesCount: number;
  athletesCount: number;
  deviceName?: string;
  createdAt?: unknown;
}

export interface PickleballCourt {
  id: string;
  name: string;
  city: string;
  district: string;
  courtsCount: number;
  surface: string;
  lat: number;
  lng: number;
  pricePerHourVnd: number;
  openHours: string;
}

export interface ClubFundEntry {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amountVnd: number;
  date: string;
  recordedBy: string;
}

export interface ClubSocialSession {
  id: string;
  title: string;
  courtName: string;
  dateTime: string;
  skillRange: string;
  feePerPlayerVnd: number;
  maxSlots: number;
  joinedNames: string[];
}

export interface ClubProfile {
  id: string;
  ownerUid: string;
  name: string;
  city: string;
  homeCourt: string;
  description: string;
  skillRange: string;
  membersCount: number;
  fundBalanceVnd: number;
  fundEntries: ClubFundEntry[];
  socialSessions: ClubSocialSession[];
  visibility: 'public';
  createdAt?: unknown;
  updatedAt?: unknown;
}
