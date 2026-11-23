import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CalendarPlus,
  Check,
  MapPin,
  Plus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { ClubProfile, Language } from '../lib/types';
import { formatVnd } from '../lib/vietqr';

interface ClubManagerPanelProps {
  clubs: ClubProfile[];
  language: Language;
  currentUserName: string | null;
  onCreateClub: (payload: {
    name: string;
    city: string;
    homeCourt: string;
    skillRange: string;
    description: string;
  }) => Promise<void>;
  onAddFundEntry: (
    clubId: string,
    payload: { type: 'income' | 'expense'; title: string; amountVnd: number }
  ) => Promise<void>;
  onCreateSocialSession: (
    clubId: string,
    payload: {
      title: string;
      courtName: string;
      dateTime: string;
      skillRange: string;
      feePerPlayerVnd: number;
      maxSlots: number;
    }
  ) => Promise<void>;
  onToggleJoinSession: (clubId: string, sessionId: string) => Promise<void>;
}

export const ClubManagerPanel: React.FC<ClubManagerPanelProps> = ({
  clubs,
  language,
  currentUserName,
  onCreateClub,
  onAddFundEntry,
  onCreateSocialSession,
  onToggleJoinSession,
}) => {
  const isVi = language === 'vi';
  const [selectedClubId, setSelectedClubId] = useState<string>(clubs[0]?.id || '');
  const [showCreateClub, setShowCreateClub] = useState(false);

  // Create Club Form
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('TP.HCM');
  const [clubCourt, setClubCourt] = useState('');
  const [clubSkill, setClubSkill] = useState('Trình B - C (3.0 - 4.2)');
  const [clubDesc, setClubDesc] = useState('');

  // Fund Form
  const [fundType, setFundType] = useState<'income' | 'expense'>('income');
  const [fundTitle, setFundTitle] = useState('');
  const [fundAmount, setFundAmount] = useState('200000');

  // Social Session Form
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessTitle, setSessTitle] = useState('');
  const [sessCourt, setSessCourt] = useState('');
  const [sessTime, setSessTime] = useState('19:00 Thứ 5');
  const [sessSkill, setSessSkill] = useState('Trình B / C');
  const [sessFee, setSessFee] = useState('80000');
  const [sessMax, setSessMax] = useState('8');

  const activeClub = clubs.find((c) => c.id === selectedClubId) || clubs[0] || null;
  const myName = currentUserName || (isVi ? 'VĐV 1986' : '1986 Player');

  const handleSubmitClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clubName.trim().length < 2) return;
    await onCreateClub({
      name: clubName.trim(),
      city: clubCity.trim() || 'TP.HCM',
      homeCourt: clubCourt.trim() || 'Thảo Điền Arena',
      skillRange: clubSkill.trim() || 'Mọi trình độ',
      description: clubDesc.trim(),
    });
    setClubName('');
    setClubCourt('');
    setClubDesc('');
    setShowCreateClub(false);
  };

  const handleSubmitFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClub || !fundTitle.trim()) return;
    const amt = Math.max(0, Number(fundAmount) || 0);
    if (amt <= 0) return;
    await onAddFundEntry(activeClub.id, {
      type: fundType,
      title: fundTitle.trim(),
      amountVnd: amt,
    });
    setFundTitle('');
  };

  const handleSubmitSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClub || !sessTitle.trim()) return;
    await onCreateSocialSession(activeClub.id, {
      title: sessTitle.trim(),
      courtName: sessCourt.trim() || activeClub.homeCourt || 'Sân CLB',
      dateTime: sessTime.trim() || '19:00',
      skillRange: sessSkill.trim() || activeClub.skillRange,
      feePerPlayerVnd: Math.max(0, Number(sessFee) || 0),
      maxSlots: Math.max(2, Math.min(32, Number(sessMax) || 8)),
    });
    setSessTitle('');
    setShowSessionForm(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-4 sm:p-5">
        <div>
          <h2 className="text-base font-extrabold text-stone-900 dark:text-white font-display">
            {isVi ? 'Quản lý Câu lạc bộ, Quỹ sân & Kèo giao lưu' : 'Clubs, Fund Ledger & Open Play'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {isVi
              ? 'Mô hình SportConnect: Thành lập CLB, quản lý thu/chi quỹ sinh hoạt minh bạch và mở kèo giao lưu nhận slot.'
              : 'Create Pickleball clubs, manage transparent income/expense fund ledgers, and host RSVP open-play sessions.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateClub((p) => !p)}
          className="min-h-[40px] px-4 rounded-lg text-xs font-bold btn-accent inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
        >
          {showCreateClub ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showCreateClub ? (isVi ? 'Đóng' : 'Close') : isVi ? 'Tạo CLB mới' : 'Create Club'}</span>
        </button>
      </div>

      {/* Create Club Form */}
      {showCreateClub && (
        <form
          onSubmit={(e) => void handleSubmitClub(e)}
          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4"
        >
          <h3 className="text-sm font-bold text-stone-900 dark:text-white">
            {isVi ? 'Thành lập Câu lạc bộ Pickleball' : 'Create New Pickleball Club'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              required
              minLength={2}
              maxLength={80}
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder={isVi ? 'Tên CLB (VD: CLB Bính Dần 1986)' : 'Club name'}
              className="min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs"
            />
            <input
              value={clubCity}
              onChange={(e) => setClubCity(e.target.value)}
              placeholder={isVi ? 'Thành phố (TP.HCM, Hà Nội...)' : 'City'}
              className="min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs"
            />
            <input
              value={clubCourt}
              onChange={(e) => setClubCourt(e.target.value)}
              placeholder={isVi ? 'Sân sinh hoạt chính' : 'Home court'}
              className="min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs"
            />
            <input
              value={clubSkill}
              onChange={(e) => setClubSkill(e.target.value)}
              placeholder={isVi ? 'Trình độ (VD: B - C)' : 'Skill range'}
              className="min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs"
            />
          </div>
          <input
            value={clubDesc}
            onChange={(e) => setClubDesc(e.target.value)}
            maxLength={300}
            placeholder={isVi ? 'Mô tả lịch sinh hoạt, nội quy CLB...' : 'Club schedule & description...'}
            className="w-full min-h-[42px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-xs"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="min-h-[40px] px-5 rounded-lg text-xs font-bold btn-accent"
            >
              {isVi ? 'Lưu & Tạo CLB' : 'Save & Create Club'}
            </button>
          </div>
        </form>
      )}

      {/* Main Split: Club Directory + Active Club Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Club List */}
        <div className="lg:col-span-4 space-y-2.5">
          {clubs.map((club) => {
            const active = activeClub?.id === club.id;
            return (
              <button
                key={club.id}
                type="button"
                onClick={() => setSelectedClubId(club.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  active
                    ? 'bg-white dark:bg-stone-900 border-accent ring-1 ring-orange-500/30'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-accent shrink-0" />
                    <h3 className="font-bold text-sm text-stone-900 dark:text-white truncate">
                      {club.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-stone-500 shrink-0">
                    {club.city}
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{club.homeCourt}</span>
                </p>
                <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-600 dark:text-stone-300">
                    {club.membersCount} {isVi ? 'TV' : 'members'}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatVnd(club.fundBalanceVnd)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Active Club Detail (Social Open Play + Fund Ledger) */}
        {activeClub && (
          <div className="lg:col-span-8 space-y-5">
            {/* Club Overview Banner */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-accent">
                    {activeClub.city} · {activeClub.skillRange}
                  </p>
                  <h3 className="text-lg font-extrabold text-stone-900 dark:text-white font-display mt-0.5">
                    {activeClub.name}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                    {activeClub.homeCourt}
                    {activeClub.description ? ` — ${activeClub.description}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {isVi ? 'Số dư quỹ CLB' : 'Club Fund Balance'}
                  </p>
                  <p className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatVnd(activeClub.fundBalanceVnd)}
                  </p>
                </div>
              </div>
            </div>

            {/* Open Play / Kèo giao lưu */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>{isVi ? 'Kèo giao lưu & Xé vé (Open Play)' : 'Club Open Play Sessions'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowSessionForm((p) => !p)}
                  className="min-h-[36px] px-3 rounded-lg text-xs font-semibold border border-accent text-accent hover:bg-accent-soft inline-flex items-center gap-1"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span>{isVi ? 'Mở kèo mới' : 'Host Session'}</span>
                </button>
              </div>

              {showSessionForm && (
                <form
                  onSubmit={(e) => void handleSubmitSession(e)}
                  className="rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      required
                      value={sessTitle}
                      onChange={(e) => setSessTitle(e.target.value)}
                      placeholder={isVi ? 'Tên buổi đánh (VD: Kèo tối T5 giao lưu)' : 'Session title'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                    />
                    <input
                      value={sessCourt}
                      onChange={(e) => setSessCourt(e.target.value)}
                      placeholder={isVi ? 'Sân đấu' : 'Court'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                    />
                    <input
                      value={sessTime}
                      onChange={(e) => setSessTime(e.target.value)}
                      placeholder={isVi ? 'Giờ & ngày' : 'Date & Time'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                    />
                    <input
                      value={sessSkill}
                      onChange={(e) => setSessSkill(e.target.value)}
                      placeholder={isVi ? 'Trình độ' : 'Skill tier'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={sessFee}
                      onChange={(e) => setSessFee(e.target.value)}
                      placeholder={isVi ? 'Phí share sân (VNĐ)' : 'Fee per player'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono"
                    />
                    <input
                      type="number"
                      min={2}
                      max={32}
                      value={sessMax}
                      onChange={(e) => setSessMax(e.target.value)}
                      placeholder={isVi ? 'Số lượng tối đa' : 'Max slots'}
                      className="min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSessionForm(false)}
                      className="min-h-[36px] px-3 rounded-lg text-xs text-stone-600 dark:text-stone-300"
                    >
                      {isVi ? 'Hủy' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="min-h-[36px] px-4 rounded-lg text-xs font-bold btn-accent"
                    >
                      {isVi ? 'Đăng kèo giao lưu' : 'Publish Session'}
                    </button>
                  </div>
                </form>
              )}

              {activeClub.socialSessions.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {isVi
                    ? 'Chưa có kèo giao lưu nào được mở. Nhấn "Mở kèo mới" để rủ thành viên chia tiền sân.'
                    : 'No open-play sessions posted yet.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {activeClub.socialSessions.map((ss) => {
                    const joined = ss.joinedNames.includes(myName);
                    const full = ss.joinedNames.length >= ss.maxSlots;
                    const pct = Math.min(100, Math.round((ss.joinedNames.length / ss.maxSlots) * 100));
                    return (
                      <div
                        key={ss.id}
                        className="rounded-xl border border-stone-200 dark:border-stone-800 p-4 space-y-2.5 bg-[#FAF7F2]/50 dark:bg-stone-950/60"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-stone-900 dark:text-white">
                              {ss.title}
                            </p>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                              {ss.dateTime} · {ss.courtName} · {ss.skillRange} ·{' '}
                              <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                                {formatVnd(ss.feePerPlayerVnd)}/{isVi ? 'người' : 'player'}
                              </span>
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!joined && full}
                            onClick={() => void onToggleJoinSession(activeClub.id, ss.id)}
                            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50 ${
                              joined
                                ? 'border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                : 'btn-accent'
                            }`}
                          >
                            {joined && <Check className="w-3.5 h-3.5" />}
                            <span>
                              {joined
                                ? isVi
                                  ? 'Đã nhận slot (Hủy)'
                                  : 'Joined (Leave)'
                                : full
                                  ? isVi
                                    ? 'Đã đủ slot'
                                    : 'Full'
                                  : isVi
                                    ? 'Nhận slot đánh'
                                    : 'Join Slot'}
                            </span>
                          </button>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono text-stone-500">
                            <span>
                              {ss.joinedNames.length}/{ss.maxSlots} {isVi ? 'người tham gia' : 'players'}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-800 overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent-primary)] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Club Fund Ledger (Quỹ sinh hoạt CLB) */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-stone-900 dark:text-white inline-flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isVi ? 'Sổ Quỹ sinh hoạt CLB (Thu / Chi)' : 'Club Fund Ledger'}</span>
                </h4>
                <span className="text-xs font-mono text-stone-500">
                  {activeClub.fundEntries.length} {isVi ? 'giao dịch' : 'entries'}
                </span>
              </div>

              <form
                onSubmit={(e) => void handleSubmitFund(e)}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-3.5 rounded-xl bg-[#FAF7F2] dark:bg-stone-950 border border-stone-200 dark:border-stone-800"
              >
                <select
                  value={fundType}
                  onChange={(e) => setFundType(e.target.value as 'income' | 'expense')}
                  className="sm:col-span-3 min-h-[40px] px-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-bold"
                >
                  <option value="income">{isVi ? '+ Thu quỹ' : '+ Income'}</option>
                  <option value="expense">{isVi ? '- Chi sân/bóng' : '- Expense'}</option>
                </select>
                <input
                  required
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  placeholder={isVi ? 'Nội dung (VD: Thu quỹ T11, Mua bóng Franklin)' : 'Description'}
                  className="sm:col-span-4 min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs"
                />
                <input
                  required
                  type="number"
                  min={1000}
                  step={10000}
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="sm:col-span-3 min-h-[40px] px-3 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 min-h-[40px] px-3 rounded-lg text-xs font-bold btn-accent"
                >
                  {isVi ? 'Ghi sổ' : 'Add'}
                </button>
              </form>

              {activeClub.fundEntries.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {isVi ? 'Chưa có giao dịch quỹ nào được ghi nhận.' : 'No fund transactions logged yet.'}
                </p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {activeClub.fundEntries.slice(0, 12).map((entry) => (
                    <div
                      key={entry.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${
                            entry.type === 'income'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {entry.type === 'income' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-900 dark:text-white truncate">
                            {entry.title}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono">
                            {entry.date} · {entry.recordedBy}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          entry.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {entry.type === 'income' ? '+' : '-'}
                        {formatVnd(entry.amountVnd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
