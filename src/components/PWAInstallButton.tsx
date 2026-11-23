import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { t } from '../lib/i18n';
import type { Language } from '../lib/types';

export const PWAInstallButton: React.FC<{ language: Language; compact?: boolean }> = ({
  language,
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={() => void install()}
        className={`inline-flex items-center gap-2 rounded-lg font-medium whitespace-nowrap shrink-0 btn-accent ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{t(language, 'installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>{t(language, 'installIOS')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {language === 'vi' ? 'Cài đặt trên iPhone / iPad' : 'Install on iPhone / iPad'}
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
                <li>
                  {language === 'vi'
                    ? 'Chạm biểu tượng Chia sẻ (Share) ở thanh công cụ Safari.'
                    : 'Tap the Share button in the Safari toolbar.'}
                </li>
                <li>
                  {language === 'vi'
                    ? 'Cuộn xuống và chọn Thêm vào Màn hình chính (Add to Home Screen).'
                    : 'Scroll down and tap Add to Home Screen.'}
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-lg text-sm font-medium btn-accent"
              >
                {language === 'vi' ? 'Đã hiểu' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ language: Language }> = ({ language }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-600 text-white px-4 py-2.5 text-xs font-medium shadow-lg max-w-md"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{t(language, 'offlineBanner')}</span>
    </div>
  );
};
