import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Copy,
  Download,
  ExternalLink,
  Receipt,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { t } from '../lib/i18n';
import { renderSocialShareCardDataUrl, type ShareCardPayload } from '../lib/shareCard';
import { verifyTOTP } from '../lib/totp';
import type { Language, NotificationItem, Registration, Tournament } from '../lib/types';
import { formatVnd, generateVietQrImage, getBankDisplayName } from '../lib/vietqr';
import { MotionModal } from './MotionModal';

interface VietQRModalProps {
  tournament: Tournament;
  registration: Registration;
  language: Language;
  isOrganizer: boolean;
  onConfirmPaid: (reg: Registration) => Promise<void>;
  onVerifyReceipt: (reg: Registration) => Promise<void>;
  onClose: () => void;
}

export const VietQRPaymentModal: React.FC<VietQRModalProps> = ({
  tournament,
  registration,
  language,
  isOrganizer,
  onConfirmPaid,
  onVerifyReceipt,
  onClose,
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void generateVietQrImage({
      bankCode: tournament.bankCode || 'VCB',
      accountNumber: tournament.bankAccount || '1029485712',
      amountVnd: registration.amountVnd,
      memo: registration.transferCode,
    }).then(setQrUrl);
  }, [tournament, registration]);

  const copyText = (key: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(''), 1800);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirmPaid(registration);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setSubmitting(true);
    try {
      await onVerifyReceipt(registration);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={t(language, 'vietqrTitle')}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      panelClassName="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe space-y-5 shadow-2xl"
    >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t(language, 'vietqrTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t(language, 'vietqrSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center border-y border-slate-200 dark:border-slate-800 py-5">
          <div className="flex flex-col items-center justify-center bg-white rounded-xl p-4 border border-slate-200">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="VietQR Payment Code"
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-lg" />
            )}
            <p className="text-[11px] font-mono text-slate-500 mt-2">
              NAPAS 247 · {getBankDisplayName(tournament.bankCode)}
            </p>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {language === 'vi' ? 'Ngân hàng & Chủ tài khoản' : 'Bank & Beneficiary'}
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {getBankDisplayName(tournament.bankCode)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {tournament.bankAccountName}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  {language === 'vi' ? 'Số tài khoản' : 'Account Number'}
                </span>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {tournament.bankAccount}
                </p>
              </div>
              <button
                onClick={() => copyText('acc', tournament.bankAccount)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Copy"
              >
                {copiedField === 'acc' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  {language === 'vi' ? 'Số tiền lệ phí' : 'Amount'}
                </span>
                <p className="font-mono font-bold text-base text-accent tabular-nums">
                  {formatVnd(registration.amountVnd)}
                </p>
              </div>
              <button
                onClick={() => copyText('amt', String(registration.amountVnd))}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Copy"
              >
                {copiedField === 'amt' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  {language === 'vi' ? 'Nội dung chuyển khoản' : 'Transfer Reference'}
                </span>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {registration.transferCode}
                </p>
              </div>
              <button
                onClick={() => copyText('memo', registration.transferCode)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title="Copy"
              >
                {copiedField === 'memo' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <Receipt className="w-4 h-4 text-accent shrink-0" />
            <span>
              {registration.paymentStatus === 'verified'
                ? `${t(language, 'receiptIssued')}: ${registration.receiptCode || 'RCP-VERIFIED'}`
                : registration.paymentStatus === 'paid'
                ? language === 'vi'
                  ? `Đã gửi xác nhận (${registration.receiptCode || 'Chờ BTC duyệt'})`
                  : `Transfer confirmed (${registration.receiptCode || 'Pending verification'})`
                : language === 'vi'
                ? `Đội: ${registration.teamName} · Chờ thanh toán`
                : `Team: ${registration.teamName} · Awaiting payment`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {registration.paymentStatus === 'pending' && (
              <button
                disabled={submitting}
                onClick={() => void handleConfirm()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium btn-accent whitespace-nowrap disabled:opacity-50"
              >
                {t(language, 'confirmPaid')}
              </button>
            )}
            {isOrganizer && registration.paymentStatus !== 'verified' && (
              <button
                disabled={submitting}
                onClick={() => void handleVerify()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap disabled:opacity-50"
              >
                {t(language, 'verifyReceipt')}
              </button>
            )}
            {registration.paymentStatus === 'verified' && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {language === 'vi' ? 'Hoàn tất' : 'Done'}
              </button>
            )}
          </div>
        </div>
    </MotionModal>
  );
};

interface SocialShareModalProps {
  payload: ShareCardPayload;
  language: Language;
  onClose: () => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  payload,
  language,
  onClose,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImageUrl(renderSocialShareCardDataUrl(payload));
  }, [payload]);

  const summaryText = `${payload.title} (${payload.subtitle})\n${payload.leftName} ${payload.leftScore} - ${payload.rightScore} ${payload.rightName}\n${payload.detailLine}\n#1986 #PickleballVietnam`;

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `1986_${Date.now()}.png`;
    link.click();
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: summaryText,
          url: window.location.href,
        });
      } catch {
        // user dismissed
      }
    } else {
      handleCopy();
    }
  };

  const encodedText = encodeURIComponent(summaryText);
  const encodedUrl = encodeURIComponent(window.location.href);

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={t(language, 'shareCardTitle')}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      panelClassName="w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe space-y-5 shadow-2xl"
    >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1" />
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {t(language, 'shareCardTitle')}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {imageUrl && (
          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <img
              src={imageUrl}
              alt={payload.title}
              className="w-full aspect-[1200/630] object-cover"
            />
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <button
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium btn-accent whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{t(language, 'downloadCardPng')}</span>
          </button>

          <button
            onClick={() => void handleNativeShare()}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span>{t(language, 'nativeShare')}</span>
          </button>

          <button
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap col-span-2 sm:col-span-1"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? t(language, 'copySuccess') : t(language, 'copySummary')}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {language === 'vi' ? 'Đăng nhanh lên:' : 'Direct post:'}
          </span>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Facebook <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            X (Twitter) <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Telegram <ExternalLink className="w-3 h-3" />
          </a>
        </div>
    </MotionModal>
  );
};

interface TwoFactorVerifyModalProps {
  secret: string;
  recoveryCodes: string[];
  actionDescription: string;
  language: Language;
  onSuccess: () => void;
  onClose: () => void;
}

export const TwoFactorVerifyModal: React.FC<TwoFactorVerifyModalProps> = ({
  secret,
  recoveryCodes,
  actionDescription,
  language,
  onSuccess,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = code.trim().toUpperCase();
    if (recoveryCodes.includes(trimmed)) {
      onSuccess();
      return;
    }
    const ok = await verifyTOTP(secret, trimmed);
    if (ok) {
      onSuccess();
    } else {
      setError(
        language === 'vi'
          ? 'Mã xác thực 6 số hoặc mã khôi phục không chính xác.'
          : 'Invalid 6-digit TOTP code or recovery code.'
      );
    }
  };

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={language === 'vi' ? 'Xác thực Hai Lớp (2FA)' : 'Two-Factor Verification'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      panelClassName="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-safe space-y-5 shadow-2xl"
    >
        <div className="sm:hidden w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'vi' ? 'Xác thực Hai Lớp (2FA)' : 'Two-Factor Verification'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{actionDescription}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {language === 'vi'
                ? 'Nhập mã 6 số từ ứng dụng Authenticator (hoặc mã khôi phục)'
                : 'Enter 6-digit code from Authenticator app (or recovery code)'}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium btn-accent"
            >
              {t(language, 'verify2faCode')}
            </button>
          </div>
        </form>
    </MotionModal>
  );
};

interface NotificationDrawerProps {
  notifications: NotificationItem[];
  language: Language;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  language,
  onMarkRead,
  onMarkAllRead,
  onClose,
}) => {
  return (
    <MotionModal
      variant="drawer-right"
      ariaLabel={language === 'vi' ? 'Thông báo cá nhân hóa' : 'Personalized Alerts'}
      onBackdropClick={onClose}
      onEscape={onClose}
      overlayClassName="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
      panelClassName="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-[100dvh] flex flex-col pt-safe pb-safe shadow-2xl"
    >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
              {language === 'vi' ? 'Thông báo cá nhân hóa' : 'Personalized Alerts'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {language === 'vi' ? 'Đọc tất cả' : 'Mark all read'}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Chưa có thông báo mới' : 'No notifications yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi'
                  ? 'Các nhắc nhở trận đấu sắp diễn ra, xác nhận lệ phí VietQR và lời mời giao hữu sẽ hiện tại đây.'
                  : 'Upcoming match alerts, VietQR payment receipts, and match invites will appear here.'}
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => onMarkRead(n.id)}
                className={`w-full text-left px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  !n.read ? 'bg-accent-soft/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{n.title}</span>
                  <span>{n.read ? (language === 'vi' ? 'Đã xem' : 'Read') : language === 'vi' ? 'Mới' : 'New'}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {n.body}
                </p>
              </button>
            ))
          )}
        </div>
    </MotionModal>
  );
};
