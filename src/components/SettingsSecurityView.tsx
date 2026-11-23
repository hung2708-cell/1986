import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Cloud,
  Copy,
  Download,
  Globe,
  HardDriveUpload,
  KeyRound,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { t } from '../lib/i18n';
import {
  buildOtpAuthUri,
  generateBase32Secret,
  generateRecoveryCodes,
  generateTOTP,
  renderQrDataUrl,
  verifyTOTP,
} from '../lib/totp';
import type {
  AthleteProfile,
  CloudBackupSnapshot,
  Gender,
  Language,
  SkillTier,
  ThemeAccent,
  UserPrivateSecurity,
} from '../lib/types';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsSecurityViewProps {
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  darkMode: boolean;
  onChangeDarkMode: (dark: boolean) => void;
  themeAccent: ThemeAccent;
  onChangeThemeAccent: (accent: ThemeAccent) => void;
  privateSettings: UserPrivateSecurity;
  onSavePrivateSettings: (patch: Partial<UserPrivateSecurity>) => Promise<void>;
  myProfile: AthleteProfile | null;
  onSaveMyProfile: (patch: Partial<AthleteProfile>) => Promise<void>;
  backups: CloudBackupSnapshot[];
  onCreateCloudBackup: (label: string) => Promise<void>;
  onDownloadJsonBackup: () => void;
  onImportJsonBackup: (jsonText: string) => Promise<void>;
  onSendTestNotification: () => Promise<void>;
  userEmail: string | null;
}

const ACCENT_THEMES: {
  id: ThemeAccent;
  labelVi: string;
  labelEn: string;
  elementVi: string;
  elementEn: string;
  hex: string;
}[] = [
  {
    id: 'amber',
    labelVi: 'Hỏa Lư Trung',
    labelEn: 'Furnace Fire 1986',
    elementVi: 'Bản mệnh Hỏa · Mặc định',
    elementEn: 'Fire Core · Default',
    hex: '#C2410C',
  },
  {
    id: 'emerald',
    labelVi: 'Ngọc Lục Bảo',
    labelEn: 'Jade Wood-Feeds-Fire',
    elementVi: 'Mộc sinh Hỏa · Tương sinh',
    elementEn: 'Wood feeds Fire · Best',
    hex: '#047857',
  },
  {
    id: 'crimson',
    labelVi: 'Đỏ Chu Sa',
    labelEn: 'Vermilion Flame',
    elementVi: 'Hỏa vượng · Tương hợp',
    elementEn: 'Fire Energy · Match',
    hex: '#BE123C',
  },
  {
    id: 'rose',
    labelVi: 'Hồng San Hô',
    labelEn: 'Coral Rose Fire',
    elementVi: 'Hỏa đào · Tương hợp',
    elementEn: 'Fire Harmony · Match',
    hex: '#DB2777',
  },
  {
    id: 'violet',
    labelVi: 'Tím Tử Vi',
    labelEn: 'Imperial Violet Fire',
    elementVi: 'Hỏa tím · Quý nhân',
    elementEn: 'Royal Fire · Match',
    hex: '#7E22CE',
  },
];

export const SettingsSecurityView: React.FC<SettingsSecurityViewProps> = ({
  language,
  onChangeLanguage,
  darkMode,
  onChangeDarkMode,
  themeAccent,
  onChangeThemeAccent,
  privateSettings,
  onSavePrivateSettings,
  myProfile,
  onSaveMyProfile,
  backups,
  onCreateCloudBackup,
  onDownloadJsonBackup,
  onImportJsonBackup,
  onSendTestNotification,
  userEmail,
}) => {
  // Profile edit state
  const [displayName, setDisplayName] = useState(myProfile?.displayName || '');
  const [gender, setGender] = useState<Gender>(myProfile?.gender || 'male');
  const [skillTier, setSkillTier] = useState<SkillTier>(myProfile?.skillTier || 'B');
  const [club, setClub] = useState(myProfile?.club || '');
  const [city, setCity] = useState(myProfile?.city || 'TP.HCM');
  const [availableForMatch, setAvailableForMatch] = useState(myProfile?.availableForMatch ?? true);
  const [profileSaved, setProfileSaved] = useState(false);

  // 2FA setup flow state
  const [enrolling2FA, setEnrolling2FA] = useState(false);
  const [draftSecret, setDraftSecret] = useState('');
  const [draftQr, setDraftQr] = useState('');
  const [draftRecovery, setDraftRecovery] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [currentTotpPreview, setCurrentTotpPreview] = useState('');
  const [twoFaError, setTwoFaError] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Push notification permission
  const [pushPerm, setPushPerm] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // Cloud backup state
  const [backupLabel, setBackupLabel] = useState('');
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    if (myProfile) {
      setDisplayName(myProfile.displayName);
      setGender(myProfile.gender || 'male');
      setSkillTier(myProfile.skillTier || 'B');
      setClub(myProfile.club);
      setCity(myProfile.city);
      setAvailableForMatch(myProfile.availableForMatch);
    }
  }, [myProfile]);

  useEffect(() => {
    if (!enrolling2FA || !draftSecret) return;
    let active = true;
    const refreshCode = async () => {
      const code = await generateTOTP(draftSecret);
      if (active) setCurrentTotpPreview(code);
    };
    void refreshCode();
    const timer = setInterval(() => void refreshCode(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enrolling2FA, draftSecret]);

  const handleStart2FA = async () => {
    const secret = generateBase32Secret(20);
    const recovery = generateRecoveryCodes(6);
    const uri = buildOtpAuthUri(userEmail || displayName || 'athlete', secret);
    const qr = await renderQrDataUrl(uri);
    setDraftSecret(secret);
    setDraftRecovery(recovery);
    setDraftQr(qr);
    setVerifyCode('');
    setTwoFaError('');
    setEnrolling2FA(true);
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaError('');
    const ok = await verifyTOTP(draftSecret, verifyCode);
    if (!ok) {
      setTwoFaError(
        language === 'vi'
          ? 'Mã 6 số chưa khớp. Hãy kiểm tra lại ứng dụng Authenticator.'
          : 'Code mismatch. Check your Authenticator app and try again.'
      );
      return;
    }
    await onSavePrivateSettings({
      twoFactorEnabled: true,
      totpSecret: draftSecret,
      recoveryCodes: draftRecovery,
    });
    setEnrolling2FA(false);
  };

  const handleDisable2FA = async () => {
    await onSavePrivateSettings({
      twoFactorEnabled: false,
      totpSecret: '',
      recoveryCodes: [],
    });
  };

  const handleRequestPush = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPushPerm(result);
    if (result === 'granted') {
      await onSendTestNotification();
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await onSaveMyProfile({
      displayName: displayName.trim(),
      gender,
      skillTier,
      club: club.trim(),
      city,
      availableForMatch,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      await onCreateCloudBackup(
        backupLabel.trim() ||
          `Cloud Backup ${new Date().toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}`
      );
      setBackupLabel('');
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void onImportJsonBackup(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {t(language, 'navSettings')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {language === 'vi'
            ? 'Tùy chỉnh giao diện tối giản, đa ngôn ngữ, bảo mật 2FA, thông báo đẩy cá nhân hóa và đồng bộ đám mây.'
            : 'Customize color themes, dark mode, language, TOTP 2FA security, push alerts, and cloud sync.'}
        </p>
      </div>

      {/* 1. Appearance, Custom Theme & Language */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            <span>{t(language, 'appearanceTitle')}</span>
          </h2>
          <PWAInstallButton language={language} compact />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t(language, 'darkModeLabel')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {darkMode
                  ? language === 'vi'
                    ? 'Than Hồng Ấm (#120D0A · Hợp Hỏa)'
                    : 'Warm Ember Dark (#120D0A)'
                  : language === 'vi'
                    ? 'Ngà Ấm (#FAF7F2 · Dịu mắt)'
                    : 'Warm Ivory Light (#FAF7F2)'}
              </p>
            </div>
            <button
              onClick={() => onChangeDarkMode(!darkMode)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-accent" />}
              <span>{darkMode ? 'Light' : 'Dark'}</span>
            </button>
          </div>

          {/* Language Switch */}
          <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-accent" />
                <span>{t(language, 'languageLabel')}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi' ? 'Tiếng Việt (Mặc định)' : 'English (International)'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['vi', 'en'] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => onChangeLanguage(code)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    language === code
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customizable Feng Shui Color Theme Picker for Bính Dần 1986 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {language === 'vi'
                ? 'Bảng màu Phong thủy Bính Dần 1986 (Lư Trung Hỏa)'
                : 'Binh Dan 1986 Auspicious Fire Palette'}
            </p>
            <span className="text-[11px] font-medium text-accent">
              {language === 'vi' ? 'Mộc sinh Hỏa · Hỏa tương hợp' : 'Wood-Feeds-Fire & Fire Core'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {ACCENT_THEMES.map((theme) => {
              const active = themeAccent === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChangeThemeAccent(theme.id)}
                  className={`p-3 rounded-xl border text-left transition-colors space-y-1.5 ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="w-5 h-5 rounded-full block ring-2 ring-white/80 dark:ring-stone-900 shadow-xs"
                      style={{ backgroundColor: theme.hex }}
                    />
                    {active && <Check className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {language === 'vi' ? theme.labelVi : theme.labelEn}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {language === 'vi' ? theme.elementVi : theme.elementEn}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {language === 'vi'
              ? 'Tuổi Bính Dần 1986 (Lư Trung Hỏa) hợp nhất màu tương sinh hành Mộc (Xanh Ngọc Lục Bảo) và màu bản mệnh hành Hỏa (Cam Lửa, Đỏ Chu Sa, Hồng San Hô, Tím Tử Vi). Hệ thống đã loại bỏ tông Xanh dương / Xanh đen lạnh (hành Thủy khắc Hỏa).'
              : 'Binh Dan 1986 (Furnace Fire) harmonizes with Wood-element Emerald and Fire-element Amber, Crimson, Coral Rose, and Violet. Cold Water-element blue tones have been removed.'}
          </p>
        </div>
      </section>

      {/* 2. Two-Factor Authentication (TOTP 2FA) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>{t(language, 'security2faTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {privateSettings.twoFactorEnabled
                ? t(language, 'twoFaActive')
                : t(language, 'twoFaInactive')}
            </p>
          </div>

          {privateSettings.twoFactorEnabled ? (
            <button
              onClick={() => void handleDisable2FA()}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 whitespace-nowrap self-start sm:self-auto"
            >
              {t(language, 'disable2fa')}
            </button>
          ) : (
            !enrolling2FA && (
              <button
                onClick={() => void handleStart2FA()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap self-start sm:self-auto"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t(language, 'enable2fa')}</span>
              </button>
            )
          )}
        </div>

        {enrolling2FA && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {language === 'vi'
                  ? '1. Quét mã QR bằng Google Authenticator hoặc Authy để liên kết tài khoản.'
                  : '1. Scan this QR code with Google Authenticator or Authy.'}
              </p>
              {draftQr && (
                <div className="inline-block p-3 bg-white rounded-xl border border-slate-200">
                  <img src={draftQr} alt="TOTP 2FA QR Code" className="w-44 h-44" />
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <code className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                  {draftSecret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(draftSecret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 1800);
                  }}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {language === 'vi' ? 'Mã kiểm thử hiện tại (30s):' : 'Current TOTP window:'}{' '}
                <strong className="text-accent">{currentTotpPreview}</strong>
              </p>
            </div>

            <form onSubmit={(e) => void handleConfirm2FA(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'vi'
                    ? '2. Nhập mã xác thực 6 số để kích hoạt'
                    : '2. Enter the 6-digit verification code'}
                </label>
                <input
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-base tracking-widest"
                />
                {twoFaError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{twoFaError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {language === 'vi' ? 'Mã khôi phục dự phòng (lưu giữ an toàn):' : 'Recovery codes (store safely):'}
                </p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                  {draftRecovery.map((rc) => (
                    <span
                      key={rc}
                      className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-950 text-center"
                    >
                      {rc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold btn-accent"
                >
                  {language === 'vi' ? 'Kích hoạt 2FA' : 'Activate 2FA'}
                </button>
                <button
                  type="button"
                  onClick={() => setEnrolling2FA(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* 3. Personalized Push Notifications */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" />
              <span>{t(language, 'notificationsTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'vi' ? 'Trạng thái trình duyệt:' : 'Browser permission:'}{' '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                {pushPerm}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pushPerm !== 'granted' && pushPerm !== 'unsupported' && (
              <button
                onClick={() => void handleRequestPush()}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap"
              >
                {t(language, 'enablePushBrowser')}
              </button>
            )}
            <button
              onClick={() => void onSendTestNotification()}
              className="px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {t(language, 'sendTestPush')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {(
            [
              [
                'notifyUpcomingMatch',
                language === 'vi' ? 'Nhắc trận đấu sắp diễn ra (15 phút)' : 'Upcoming match alert (15m prior)',
              ],
              [
                'notifyScoreUpdate',
                language === 'vi' ? 'Cập nhật tỷ số & kết thúc trận' : 'Live score & match completion',
              ],
              [
                'notifyChatMention',
                language === 'vi' ? 'Tin nhắn chat nhóm & lời mời đấu' : 'Group chat & match challenges',
              ],
              [
                'notifyPaymentReceipt',
                language === 'vi' ? 'Biên lai & duyệt lệ phí VietQR' : 'VietQR fee & receipt updates',
              ],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 cursor-pointer"
            >
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
              <input
                type="checkbox"
                checked={Boolean(privateSettings[key])}
                onChange={(e) => void onSavePrivateSettings({ [key]: e.target.checked })}
                className="w-4 h-4 accent-[var(--accent-primary)] rounded"
              />
            </label>
          ))}
        </div>
      </section>

      {/* 4. Auto Cloud Backup & Multi-Device Sync */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-accent" />
              <span>{t(language, 'cloudBackupTitle')}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'vi'
                ? 'Firestore IndexedDB tự động lưu ngoại tuyến và đồng bộ ngay khi kết nối mạng.'
                : 'Firestore IndexedDB automatically persists offline and syncs across all signed-in devices.'}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={privateSettings.autoCloudBackup}
              onChange={(e) => void onSavePrivateSettings({ autoCloudBackup: e.target.checked })}
              className="w-4 h-4 accent-[var(--accent-primary)] rounded"
            />
            <span>{t(language, 'autoBackupLabel')}</span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            value={backupLabel}
            onChange={(e) => setBackupLabel(e.target.value)}
            placeholder={
              language === 'vi' ? 'Tên bản sao lưu (vd: Sau vòng Tứ kết)...' : 'Snapshot label...'
            }
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
          <button
            disabled={backingUp}
            onClick={() => void handleCreateBackup()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold btn-accent whitespace-nowrap disabled:opacity-50"
          >
            <HardDriveUpload className="w-4 h-4" />
            <span>{t(language, 'createSnapshot')}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onDownloadJsonBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t(language, 'downloadJsonBackup')}</span>
          </button>
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Nhập bản sao lưu JSON' : 'Import JSON Backup'}</span>
            <input type="file" accept="application/json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>

        {backups.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
            {backups.map((b) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{b.label}</p>
                  <p className="text-slate-500 dark:text-slate-400">{b.deviceName || 'Web Device'}</p>
                </div>
                <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {b.tournamentsCount}T · {b.matchesCount}M · {b.athletesCount}A
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Athlete Profile Editor */}
      {myProfile && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {language === 'vi' ? 'Hồ sơ Vận động viên của tôi' : 'My Athlete Profile'}
          </h2>
          <form onSubmit={(e) => void handleSaveProfile(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'vi' ? 'Tên thi đấu' : 'Display Name'}
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'vi' ? 'Câu lạc bộ' : 'Club'}
              </label>
              <input
                value={club}
                onChange={(e) => setClub(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t(language, 'genderLabel')}
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="male">{t(language, 'genderMale')}</option>
                <option value="female">{t(language, 'genderFemale')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t(language, 'skillTierLabel')}
              </label>
              <select
                value={skillTier}
                onChange={(e) => setSkillTier(e.target.value as SkillTier)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono font-semibold"
              >
                <option value="A">{language === 'vi' ? 'Trình A' : 'Tier A'}</option>
                <option value="B">{language === 'vi' ? 'Trình B' : 'Tier B'}</option>
                <option value="C">{language === 'vi' ? 'Trình C' : 'Tier C'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {language === 'vi' ? 'Thành phố' : 'City'}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              >
                <option value="TP.HCM">TP.HCM</option>
                <option value="Hà Nội">Hà Nội</option>
                <option value="Đà Nẵng">Đà Nẵng</option>
              </select>
            </div>
            <div className="flex items-end justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 pb-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableForMatch}
                  onChange={(e) => setAvailableForMatch(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-primary)] rounded"
                />
                <span>{t(language, 'availableNow')}</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold btn-accent"
              >
                {profileSaved
                  ? language === 'vi'
                    ? 'Đã lưu'
                    : 'Saved'
                  : language === 'vi'
                  ? 'Lưu hồ sơ'
                  : 'Save Profile'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};
