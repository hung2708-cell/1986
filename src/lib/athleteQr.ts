import QRCode from 'qrcode';
import type { AthleteProfile, Language } from './types';

export const ATHLETE_QR_PREFIX = '1986PB|v1|';

export function sanitizeCheckInId(tournamentId: string, athleteId: string): string {
  const cleanT = tournamentId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanA = athleteId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `chk_${cleanT}__${cleanA}`.slice(0, 128);
}

/**
 * Generates a deterministic, compact QR payload for an athlete.
 * Permanent athlete QR works for check-in across any tournament selected by Admin at the venue.
 */
export function buildAthleteQrPayload(athleteId: string, tournamentId?: string): string {
  const safeAthlete = athleteId.trim();
  if (tournamentId && tournamentId.trim()) {
    return `${ATHLETE_QR_PREFIX}${safeAthlete}|${tournamentId.trim()}`;
  }
  return `${ATHLETE_QR_PREFIX}${safeAthlete}`;
}

export interface ParsedAthleteQr {
  athleteId: string;
  tournamentId?: string;
}

/**
 * Parses a scanned QR string into an athleteId (and optional tournamentId).
 * Supports:
 * - `1986PB|v1|<athleteId>`
 * - `1986PB|v1|<athleteId>|<tournamentId>`
 * - JSON `{ "athleteId": "...", "tournamentId": "..." }`
 * - Direct athlete ID fallback (e.g. `ath_...` or `m_...`)
 */
export function parseAthleteQrPayload(rawInput: string): ParsedAthleteQr | null {
  const raw = rawInput.trim();
  if (!raw) return null;

  if (raw.startsWith(ATHLETE_QR_PREFIX)) {
    const rest = raw.slice(ATHLETE_QR_PREFIX.length);
    const parts = rest.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 1 && /^[a-zA-Z0-9_-]{2,128}$/.test(parts[0])) {
      return {
        athleteId: parts[0],
        tournamentId: parts[1] && /^[a-zA-Z0-9_-]{2,128}$/.test(parts[1]) ? parts[1] : undefined,
      };
    }
    return null;
  }

  // Legacy / JSON fallback
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as { athleteId?: string; tournamentId?: string };
      if (parsed.athleteId && /^[a-zA-Z0-9_-]{2,128}$/.test(parsed.athleteId)) {
        return {
          athleteId: parsed.athleteId,
          tournamentId:
            parsed.tournamentId && /^[a-zA-Z0-9_-]{2,128}$/.test(parsed.tournamentId)
              ? parsed.tournamentId
              : undefined,
        };
      }
    } catch {
      return null;
    }
  }

  // Direct ID manual paste fallback
  if (/^[a-zA-Z0-9_-]{4,128}$/.test(raw)) {
    return { athleteId: raw };
  }

  return null;
}

export async function generateAthleteQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 380,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#1C1410',
      light: '#FFFFFF',
    },
  });
}

export function formatCheckInTime(isoString?: string, language: Language = 'vi'): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

export function playCheckInChime(kind: 'success' | 'already' | 'error'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    if (kind === 'success') {
      playTone(880, now, 0.11);
      playTone(1318.5, now + 0.1, 0.22);
    } else if (kind === 'already') {
      playTone(659.25, now, 0.12);
      playTone(659.25, now + 0.14, 0.14);
    } else {
      playTone(260, now, 0.18, 'triangle');
      playTone(210, now + 0.16, 0.22, 'triangle');
    }

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 600);
  } catch {
    // ignore audio restrictions
  }
}

/**
 * Renders and downloads a high-contrast, printable 1986 Athlete QR Check-in Pass PNG.
 */
export async function downloadAthleteQrCardPng(options: {
  athlete: AthleteProfile;
  qrPayload: string;
  tournamentTitle?: string;
  language: Language;
}): Promise<void> {
  const { athlete, qrPayload, tournamentTitle, language } = options;
  const isVi = language === 'vi';
  const qrDataUrl = await generateAthleteQrDataUrl(qrPayload);

  const width = 760;
  const height = 1020;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background — warm volcanic dark frame + ivory card (Bính Dần 1986)
  ctx.fillStyle = '#120D0A';
  ctx.fillRect(0, 0, width, height);

  // Subtle fire-gold top bar
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#9A3412');
  grad.addColorStop(0.5, '#EA580C');
  grad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 16);

  // Header brand
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('1986', 48, 86);

  ctx.fillStyle = '#F59E0B';
  ctx.font = '700 18px "Inter", system-ui, sans-serif';
  ctx.fillText(
    isVi ? 'THẺ QR CHECK-IN VẬN ĐỘNG VIÊN' : 'ATHLETE VENUE QR CHECK-IN PASS',
    48,
    118
  );

  // Inner ivory card
  ctx.fillStyle = '#FAF7F2';
  ctx.beginPath();
  ctx.roundRect(44, 148, width - 88, 790, 24);
  ctx.fill();

  // QR Image
  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });

  const qrSize = 440;
  const qrX = (width - qrSize) / 2;
  const qrY = 190;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 20);
  ctx.fill();
  ctx.strokeStyle = '#E7E5E4';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Athlete Info
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1C1410';
  ctx.font = '800 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(athlete.displayName.slice(0, 32), width / 2, 706);

  const genderLabel =
    athlete.gender === 'female' ? (isVi ? 'Nữ' : 'Female') : isVi ? 'Nam' : 'Male';
  const tierLabel = isVi ? `Trình ${athlete.skillTier || 'B'}` : `Tier ${athlete.skillTier || 'B'}`;
  ctx.fillStyle = '#C2410C';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillText(
    `${tierLabel}  ·  ${genderLabel}  ·  DUPR ${athlete.duprRating.toFixed(2)}`,
    width / 2,
    748
  );

  ctx.fillStyle = '#57534E';
  ctx.font = '600 20px "Inter", system-ui, sans-serif';
  ctx.fillText(
    `${athlete.club || '1986 Club'}${tournamentTitle ? ` · ${tournamentTitle.slice(0, 30)}` : ''}`,
    width / 2,
    790
  );

  // Divider
  ctx.strokeStyle = '#E7E5E4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(96, 828);
  ctx.lineTo(width - 96, 828);
  ctx.stroke();

  // Payload code
  ctx.fillStyle = '#78716C';
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillText(qrPayload, width / 2, 868);

  ctx.fillStyle = '#44403C';
  ctx.font = '500 16px "Inter", system-ui, sans-serif';
  ctx.fillText(
    isVi
      ? 'Xuất trình mã QR này cho Admin tại bàn BTC để tự động check-in có mặt'
      : 'Show this QR code to the Admin desk for instant venue check-in',
    width / 2,
    904
  );

  // Footer
  ctx.fillStyle = '#A8A29E';
  ctx.font = '500 14px "Inter", system-ui, sans-serif';
  ctx.fillText('1986 · Pickleball Tournament Operations', width / 2, 986);

  const link = document.createElement('a');
  const safeSlug = athlete.displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.download = `1986-qr-${safeSlug || athlete.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
