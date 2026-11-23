import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  Keyboard,
  Lock,
  LogIn,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import {
  formatCheckInTime,
  parseAthleteQrPayload,
  playCheckInChime,
} from '../lib/athleteQr';
import type {
  AthleteProfile,
  Language,
  Tournament,
  TournamentCheckIn,
} from '../lib/types';
import { MotionModal } from './MotionModal';

export interface CheckInActionResult {
  outcome: 'checked_in' | 'already_checked_in' | 'not_found' | 'unauthorized';
  athlete?: AthleteProfile;
  checkIn?: TournamentCheckIn;
  message: string;
}

interface AdminQrScannerModalProps {
  tournaments: Tournament[];
  initialTournamentId?: string;
  athletes: AthleteProfile[];
  checkIns: TournamentCheckIn[];
  language: Language;
  isAdmin: boolean;
  onRequireAdminLogin: () => void;
  onProcessCheckIn: (tournamentId: string, athleteId: string) => Promise<CheckInActionResult>;
  onUndoCheckIn: (checkInId: string) => Promise<void>;
  onOpenAthleteQr: (athlete: AthleteProfile, tournamentId?: string) => void;
  onClose: () => void;
}

export const AdminQrScannerModal: React.FC<AdminQrScannerModalProps> = ({
  tournaments,
  initialTournamentId,
  athletes,
  checkIns,
  language,
  isAdmin,
  onRequireAdminLogin,
  onProcessCheckIn,
  onUndoCheckIn,
  onOpenAthleteQr,
  onClose,
}) => {
  const isVi = language === 'vi';
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    initialTournamentId || tournaments[0]?.id || ''
  );
  const [activeMode, setActiveMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualInput, setManualInput] = useState('');
  const [scanResult, setScanResult] = useState<CheckInActionResult | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [processing, setProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ raw: string; ts: number }>({ raw: '', ts: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId) || tournaments[0] || null,
    [tournaments, selectedTournamentId]
  );

  const tournamentCheckIns = useMemo(() => {
    if (!selectedTournament) return [];
    return checkIns
      .filter((c) => c.tournamentId === selectedTournament.id && c.status === 'checked_in')
      .sort((a, b) => (b.checkedInAtIso || '').localeCompare(a.checkedInAtIso || ''));
  }, [checkIns, selectedTournament]);

  const checkInByAthleteId = useMemo(() => {
    const map = new Map<string, TournamentCheckIn>();
    for (const c of tournamentCheckIns) {
      map.set(c.athleteId, c);
    }
    return map;
  }, [tournamentCheckIns]);

  const filteredRoster = useMemo(() => {
    return athletes.filter((a) => {
      const present = checkInByAthleteId.has(a.id);
      if (attendanceFilter === 'present' && !present) return false;
      if (attendanceFilter === 'absent' && present) return false;
      if (attendanceSearch.trim()) {
        const q = attendanceSearch.toLowerCase();
        return (
          a.displayName.toLowerCase().includes(q) ||
          (a.club || '').toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [athletes, checkInByAthleteId, attendanceFilter, attendanceSearch]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const handleDecodedRaw = useCallback(
    async (rawText: string) => {
      const now = Date.now();
      if (lastScanRef.current.raw === rawText && now - lastScanRef.current.ts < 2500) {
        return;
      }
      lastScanRef.current = { raw: rawText, ts: now };

      if (!selectedTournament) return;
      const parsed = parseAthleteQrPayload(rawText);
      if (!parsed) {
        playCheckInChime('error');
        setScanResult({
          outcome: 'not_found',
          message: isVi
            ? `Mã QR không hợp lệ (${rawText.slice(0, 40)}). Vui lòng dùng thẻ QR của hệ thống 1986.`
            : `Unrecognized QR code (${rawText.slice(0, 40)}). Please scan an official 1986 Athlete QR pass.`,
        });
        return;
      }

      setProcessing(true);
      try {
        const targetTrnId =
          parsed.tournamentId && tournaments.some((t) => t.id === parsed.tournamentId)
            ? parsed.tournamentId
            : selectedTournament.id;
        const result = await onProcessCheckIn(targetTrnId, parsed.athleteId);
        setScanResult(result);
        if (result.outcome === 'checked_in') {
          playCheckInChime('success');
        } else if (result.outcome === 'already_checked_in') {
          playCheckInChime('already');
        } else {
          playCheckInChime('error');
        }
      } finally {
        setProcessing(false);
      }
    },
    [selectedTournament, tournaments, onProcessCheckIn, isVi]
  );

  const startCamera = useCallback(
    async (desiredFacing: 'environment' | 'user' = facingMode) => {
      stopCamera();
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          isVi
            ? 'Trình duyệt hiện tại không hỗ trợ truy cập Camera trực tiếp. Hãy dùng tab Quét từ ảnh QR hoặc Nhập mã.'
            : 'Camera access is not supported in this browser. Use Upload QR Image or Manual Input.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: desiredFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        setCameraError(
          isVi
            ? `Không thể mở camera (${msg || 'chưa cấp quyền'}). Bạn có thể cấp quyền camera hoặc dùng "Quét từ ảnh QR" / "Nhập mã QR".`
            : `Cannot open camera (${msg || 'permission denied'}). Grant camera permission or use Upload QR Image / Manual Input.`
        );
        stopCamera();
      }
    },
    [facingMode, isVi, stopCamera]
  );

  // Continuous QR frame decoding loop while camera is active
  useEffect(() => {
    if (!cameraActive || !isAdmin || activeMode !== 'camera') return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            void handleDecodedRaw(code.data);
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, isAdmin, activeMode, handleDecodedRaw]);

  // Cleanup camera on unmount or mode change
  useEffect(() => {
    if (activeMode !== 'camera') {
      stopCamera();
    }
  }, [activeMode, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);

    try {
      const imgUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = imgUrl;
      });

      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      URL.revokeObjectURL(imgUrl);

      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data) {
        // Bypass duplicate cooldown for intentional file upload
        lastScanRef.current = { raw: '', ts: 0 };
        await handleDecodedRaw(code.data);
      } else {
        playCheckInChime('error');
        setScanResult({
          outcome: 'not_found',
          message: isVi
            ? 'Không tìm thấy mã QR rõ nét trong ảnh vừa chọn. Hãy chọn ảnh chụp rõ mã QR hơn.'
            : 'No readable QR code found in the selected image. Please try a clearer QR image.',
        });
      }
    } catch {
      playCheckInChime('error');
      setScanResult({
        outcome: 'not_found',
        message: isVi ? 'Không thể đọc tệp ảnh này.' : 'Failed to read this image file.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualInput.trim();
    if (!cleaned) return;
    lastScanRef.current = { raw: '', ts: 0 };
    await handleDecodedRaw(cleaned);
    setManualInput('');
  };

  const handleCloseScanner = () => {
    stopCamera();
    onClose();
  };

  return (
    <MotionModal
      variant="sheet"
      ariaLabel={isVi ? 'Trạm Quét QR Check-in (Admin)' : 'Admin Venue QR Check-in Scanner'}
      onBackdropClick={handleCloseScanner}
      onEscape={handleCloseScanner}
      overlayClassName="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      panelClassName="w-full sm:max-w-4xl bg-white dark:bg-stone-900 border-t sm:border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
    >
        {/* Header */}
        <div className="bg-[#120D0A] text-white px-5 py-4 flex items-center justify-between border-b border-orange-500/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-600/25 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
              <ScanLine className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold font-display tracking-tight truncate">
                {isVi ? 'Quét QR Check-in VĐV tại sân' : 'Admin Venue QR Check-in'}
              </h2>
              <p className="text-[11px] text-stone-300 truncate">
                {isVi
                  ? 'Quét mã QR của VĐV để tự động cập nhật trạng thái Có mặt (Checked-in) vào giải đấu'
                  : 'Scan athlete QR passes to automatically mark Checked-in status for the tournament'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[40px] min-w-[40px] rounded-lg inline-flex items-center justify-center text-stone-300 hover:text-white hover:bg-white/10"
            aria-label={isVi ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {!isAdmin ? (
            <div className="py-10 px-4 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/15 text-accent flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-extrabold text-stone-900 dark:text-white font-display">
                  {isVi ? 'Chỉ tài khoản Admin được quét QR Check-in' : 'Admin Sign-in Required'}
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                  {isVi
                    ? 'Để đảm bảo tính chính xác điểm danh tại bàn BTC, vui lòng đăng nhập đúng tài khoản Google Admin để mở máy quét QR.'
                    : 'Please sign in with the verified Admin Google account to operate the venue QR check-in scanner.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onRequireAdminLogin}
                className="min-h-[44px] px-5 rounded-xl text-sm font-bold btn-accent inline-flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isVi ? 'Đăng nhập Admin (Google)' : 'Admin Sign In (Google)'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Tournament Selector + Live Progress */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="flex-1 min-w-0 space-y-1">
                  <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {isVi ? 'Giải đấu đang điểm danh Check-in' : 'Active Check-in Tournament'}
                  </label>
                  <select
                    value={selectedTournament?.id || ''}
                    onChange={(e) => {
                      setSelectedTournamentId(e.target.value);
                      setScanResult(null);
                    }}
                    className="w-full min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-bold text-stone-900 dark:text-white"
                  >
                    {tournaments.map((trn) => (
                      <option key={trn.id} value={trn.id}>
                        {trn.title} · {trn.startDate}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4 sm:border-l sm:border-stone-200 sm:dark:border-stone-800 sm:pl-4 shrink-0">
                  <div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {isVi ? 'Đã có mặt' : 'Checked-in'}
                    </p>
                    <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {tournamentCheckIns.length}
                      <span className="text-sm font-semibold text-stone-400">
                        /{athletes.length}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Instant Scan Result Feedback Banner */}
              {scanResult && (
                <div
                  className={`rounded-xl border p-4 flex items-start gap-3 ${
                    scanResult.outcome === 'checked_in'
                      ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                      : scanResult.outcome === 'already_checked_in'
                        ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                        : 'bg-rose-50 dark:bg-rose-950/35 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                  }`}
                >
                  {scanResult.outcome === 'checked_in' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-extrabold">
                      {scanResult.outcome === 'checked_in'
                        ? isVi
                          ? 'CHECK-IN THÀNH CÔNG · ĐÃ CÓ MẶT'
                          : 'CHECK-IN SUCCESSFUL · PRESENT'
                        : scanResult.outcome === 'already_checked_in'
                          ? isVi
                            ? 'VĐV ĐÃ CHECK-IN TRƯỚC ĐÓ'
                            : 'ALREADY CHECKED-IN'
                          : isVi
                            ? 'KHÔNG THỂ CHECK-IN'
                            : 'CHECK-IN FAILED'}
                    </p>
                    <p className="text-xs sm:text-sm opacity-90">{scanResult.message}</p>
                    {scanResult.athlete && scanResult.checkIn && (
                      <p className="text-xs font-mono opacity-80 pt-0.5">
                        {scanResult.athlete.displayName} ·{' '}
                        {isVi
                          ? `Trình ${scanResult.athlete.skillTier || 'B'}`
                          : `Tier ${scanResult.athlete.skillTier || 'B'}`}{' '}
                        ·{' '}
                        {scanResult.athlete.gender === 'female'
                          ? isVi
                            ? 'Nữ'
                            : 'Female'
                          : isVi
                            ? 'Nam'
                            : 'Male'}{' '}
                        · {formatCheckInTime(scanResult.checkIn.checkedInAtIso, language)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setScanResult(null)}
                    className="p-1 rounded-lg opacity-70 hover:opacity-100"
                    aria-label={isVi ? 'Ẩn thông báo' : 'Dismiss'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Split Workspace: Left Scanner + Right Live Attendance Roster */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: 3-Mode Scanner */}
                <div className="lg:col-span-6 space-y-3.5">
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-stone-800">
                    {(
                      [
                        { id: 'camera', icon: Camera, label: isVi ? 'Camera QR' : 'Live Camera' },
                        { id: 'upload', icon: ImageUp, label: isVi ? 'Tải ảnh QR' : 'QR Image' },
                        { id: 'manual', icon: Keyboard, label: isVi ? 'Nhập mã' : 'Manual' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveMode(m.id)}
                        className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                          activeMode === m.id
                            ? 'bg-white dark:bg-stone-900 text-accent shadow-xs'
                            : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                        }`}
                      >
                        <m.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {activeMode === 'camera' && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-950 overflow-hidden">
                      <div className="relative aspect-[4/3] w-full flex items-center justify-center bg-stone-950">
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {cameraActive ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="w-52 h-52 sm:w-60 sm:h-60 border-2 border-orange-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative">
                              <div className="absolute inset-x-3 top-1/2 h-0.5 bg-orange-400 animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 text-center space-y-3 text-stone-300">
                            <Camera className="w-10 h-10 mx-auto text-orange-400" />
                            <p className="text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                              {isVi
                                ? 'Nhấn "Bật Camera quét QR" và đưa thẻ QR của VĐV vào khung ngắm.'
                                : 'Tap "Start QR Camera" and hold the athlete QR pass inside the viewfinder.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {cameraError && (
                        <div className="px-4 py-3 bg-rose-950/80 text-rose-200 text-xs leading-relaxed border-t border-rose-800/60">
                          {cameraError}
                        </div>
                      )}

                      <div className="p-3 bg-stone-900 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800">
                        {!cameraActive ? (
                          <button
                            type="button"
                            onClick={() => void startCamera(facingMode)}
                            className="flex-1 min-h-[42px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center justify-center gap-2"
                          >
                            <Camera className="w-4 h-4" />
                            <span>{isVi ? 'Bật Camera quét QR' : 'Start QR Camera'}</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="flex-1 min-h-[42px] px-3 rounded-lg text-xs font-bold bg-stone-800 hover:bg-stone-700 text-white inline-flex items-center justify-center gap-1.5"
                            >
                              <CameraOff className="w-4 h-4" />
                              <span>{isVi ? 'Tắt Camera' : 'Stop Camera'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = facingMode === 'environment' ? 'user' : 'environment';
                                setFacingMode(next);
                                void startCamera(next);
                              }}
                              className="min-h-[42px] px-3 rounded-lg text-xs font-semibold border border-stone-700 text-stone-200 hover:bg-stone-800 inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>{isVi ? 'Đổi camera' : 'Flip'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {activeMode === 'upload' && (
                    <div className="rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 bg-[#FAF7F2] dark:bg-stone-950 p-6 text-center space-y-3">
                      <ImageUp className="w-10 h-10 mx-auto text-accent" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-stone-900 dark:text-white">
                          {isVi ? 'Chọn ảnh chụp thẻ QR của VĐV' : 'Upload Athlete QR Screenshot'}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          {isVi
                            ? 'Hỗ trợ ảnh PNG/JPG thẻ QR đã tải về hoặc ảnh chụp màn hình VĐV gửi qua Zalo.'
                            : 'Supports downloaded PNG/JPG QR passes or screenshots.'}
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleUploadQrImage(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[44px] px-5 rounded-xl text-xs font-bold btn-accent inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <ImageUp className="w-4 h-4" />
                        <span>{isVi ? 'Chọn ảnh QR để quét' : 'Select QR Image'}</span>
                      </button>
                    </div>
                  )}

                  {activeMode === 'manual' && (
                    <form
                      onSubmit={(e) => void handleManualSubmit(e)}
                      className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-stone-950 p-4 space-y-3"
                    >
                      <label className="block text-xs font-bold text-stone-800 dark:text-stone-200">
                        {isVi ? 'Dán chuỗi mã QR hoặc Mã VĐV' : 'Paste QR Payload or Athlete ID'}
                      </label>
                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="1986PB|v1|ath_..."
                        className="w-full min-h-[44px] px-3.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-mono text-xs text-stone-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={processing || !manualInput.trim()}
                        className="w-full min-h-[44px] rounded-xl text-xs font-bold btn-accent inline-flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isVi ? 'Xác nhận Check-in Có mặt' : 'Confirm Check-in'}</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* Right: Live Venue Attendance List */}
                <div className="lg:col-span-6 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950/60 overflow-hidden flex flex-col">
                  <div className="p-3.5 border-b border-stone-200 dark:border-stone-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-accent" />
                        <span>{isVi ? 'Danh sách điểm danh VĐV' : 'Venue Attendance Roster'}</span>
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] font-semibold">
                        {(
                          [
                            ['all', isVi ? 'Tất cả' : 'All'],
                            ['present', isVi ? 'Có mặt' : 'Present'],
                            ['absent', isVi ? 'Chưa đến' : 'Absent'],
                          ] as const
                        ).map(([key, lbl]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setAttendanceFilter(key)}
                            className={`px-2 py-1 rounded-md transition-colors ${
                              attendanceFilter === key
                                ? 'bg-accent-soft text-accent'
                                : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={attendanceSearch}
                        onChange={(e) => setAttendanceSearch(e.target.value)}
                        placeholder={isVi ? 'Tìm nhanh tên VĐV...' : 'Search athlete name...'}
                        className="w-full min-h-[36px] pl-8 pr-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[340px] overflow-y-auto">
                    {filteredRoster.length === 0 ? (
                      <div className="py-10 px-4 text-center text-xs text-stone-500 dark:text-stone-400">
                        {athletes.length === 0
                          ? isVi
                            ? 'Chưa có VĐV nào trong hệ thống. Hãy thêm VĐV ở mục BXH & VĐV trước.'
                            : 'No athletes in the directory yet. Add athletes in Rankings first.'
                          : isVi
                            ? 'Không có VĐV nào khớp bộ lọc.'
                            : 'No athletes match this filter.'}
                      </div>
                    ) : (
                      filteredRoster.map((ath) => {
                        const rec = checkInByAthleteId.get(ath.id);
                        return (
                          <div
                            key={ath.id}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-stone-50 dark:hover:bg-stone-900/60"
                          >
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white truncate">
                                {ath.displayName}
                              </p>
                              <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400 truncate">
                                {isVi ? `Trình ${ath.skillTier || 'B'}` : `Tier ${ath.skillTier || 'B'}`} ·{' '}
                                {ath.gender === 'female' ? (isVi ? 'Nữ' : 'F') : isVi ? 'Nam' : 'M'}
                                {rec ? ` · ${formatCheckInTime(rec.checkedInAtIso, language)}` : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {rec ? (
                                <>
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isVi ? 'Có mặt' : 'Present'}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void onUndoCheckIn(rec.id)}
                                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    title={isVi ? 'Hủy check-in' : 'Undo check-in'}
                                  >
                                    <Undo2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectedTournament &&
                                    void handleDecodedRaw(`1986PB|v1|${ath.id}`)
                                  }
                                  className="min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold border border-emerald-600/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  {isVi ? 'Check-in' : 'Check-in'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenAthleteQr(ath, selectedTournament?.id)}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-accent hover:bg-accent-soft"
                                title={isVi ? 'Xem mã QR VĐV' : 'Show Athlete QR'}
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
    </MotionModal>
  );
};
