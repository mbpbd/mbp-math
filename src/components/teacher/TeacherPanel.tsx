import React, { useState, useEffect } from 'react';
import { CategoryCode, CATEGORIES, NumberBlock, School, Venue } from '../../types';
import { verifyPin, toBengaliDigits } from '../../services/idSystem';
import { Lock, Check, Send, Trash2, ArrowLeft, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface TeacherPanelProps {
  schools: School[];
  venues: Venue[];
  blocks: NumberBlock[];
  markedIds: Set<string>;
  onSendNumbers: (schoolId: string, ids: string[]) => Promise<void>;
  onClose: () => void;
}

export const TeacherPanel: React.FC<TeacherPanelProps> = ({
  schools,
  venues,
  blocks,
  markedIds,
  onSendNumbers,
  onClose
}) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => {
    return localStorage.getItem('mbp_teacher_school_id') || '';
  });
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('mbp_teacher_authed') === 'true' && !!localStorage.getItem('mbp_teacher_school_id');
  });
  const [pinError, setPinError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);

  // Grid selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  const school = schools.find(s => s.id === selectedSchoolId);
  const venue = venues.find(v => v.id === school?.venueId);
  const schoolBlocks = blocks.filter(b => b.schoolId === selectedSchoolId);

  // Group all IDs for this school by category
  const categorizedIds: Record<CategoryCode, string[]> = {
    '01': [],
    '02': [],
    '03': []
  };

  schoolBlocks.forEach(b => {
    const yearCode = b.firstId ? b.firstId.slice(0, 2) : '26';
    for (let s = b.firstSerial; s <= b.lastSerial; s++) {
      const padded = String(s).padStart(3, '0');
      const id = `${yearCode}${b.category}${padded}`;
      categorizedIds[b.category].push(id);
    }
  });

  const allSchoolIds = [...categorizedIds['01'], ...categorizedIds['02'], ...categorizedIds['03']];
  const alreadySentCount = allSchoolIds.filter(id => markedIds.has(id)).length;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;
    if (!school) {
      setPinError('অনুগ্রহ করে বিদ্যালয় নির্বাচন করুন');
      return;
    }

    const isValid = await verifyPin(enteredPin, school.pinHash);
    if (isValid || enteredPin === school.plainPin) {
      setIsAuthenticated(true);
      setPinError(null);
      localStorage.setItem('mbp_teacher_school_id', school.id);
      localStorage.setItem('mbp_teacher_authed', 'true');
    } else {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      if (attempts >= 5) {
        setIsLockedOut(true);
        setPinError('৫ বার ভুল পিন দেওয়ায় এই স্কুলের লগইন ১৫ মিনিটের জন্য স্থগিত করা হয়েছে।');
      } else {
        setPinError(`ভুল পিন নম্বর! অবশিষ্ট সুযোগ: ${5 - attempts} বার।`);
      }
    }
  };

  const handleLogoutSchool = () => {
    localStorage.removeItem('mbp_teacher_school_id');
    localStorage.removeItem('mbp_teacher_authed');
    setIsAuthenticated(false);
    setSelectedSchoolId('');
    setEnteredPin('');
    setSelectedIds(new Set());
  };

  const toggleSelectId = (id: string) => {
    if (markedIds.has(id)) {
      alert('এই নম্বরটি আগেই পাঠানো হয়েছে। ভুল হলে অ্যাডমিনকে জানান।');
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleConfirmSend = async () => {
    if (selectedIds.size === 0 || !school) return;
    setIsSending(true);
    const idsToSend = Array.from(selectedIds);
    try {
      await onSendNumbers(school.id, idsToSend);
      setSendSuccessMessage(`${toBengaliDigits(idsToSend.length)} টি নম্বর সফলভাবে পাঠানো হয়েছে!`);
      setSelectedIds(new Set());
      setShowConfirm(false);
      setTimeout(() => setSendSuccessMessage(null), 4000);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 overflow-hidden font-['Hind_Siliguri',sans-serif]">
      
      {/* Top Header */}
      <div className="bg-indigo-900 text-white p-4 sm:p-5 flex justify-between items-center">
        <div>
          <button
            onClick={onClose}
            className="text-xs text-indigo-200 hover:text-white flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>ফিরে যান</span>
          </button>
          <h2 className="text-xl font-bold tracking-tight">শিক্ষক প্যানেল (Teacher Panel)</h2>
          <p className="text-xs text-indigo-200">
            শিক্ষার্থীকে দেওয়া ফরমের নম্বরগুলো ট্যাপ করে এক ক্লিকে জমা দিন।
          </p>
        </div>

        {isAuthenticated && (
          <button
            onClick={handleLogoutSchool}
            className="px-3 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-xs font-semibold rounded-lg border border-indigo-700 transition"
          >
            স্কুল পরিবর্তন
          </button>
        )}
      </div>

      {/* Screen 1: School Login */}
      {!isAuthenticated ? (
        <form onSubmit={handleLogin} className="p-6 max-w-md mx-auto space-y-4 my-6 text-xs">
          <div className="text-center mb-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-600">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">বিদ্যালয় ও পিন যাচাই</h3>
            <p className="text-gray-500">আপনার বান্ডিল কভার শীটে মুদ্রিত ৪-ডিজিট পিন দিয়ে প্রবেশ করুন।</p>
          </div>

          {pinError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 rounded-lg text-red-700 text-xs font-semibold">
              {pinError}
            </div>
          )}

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              বিদ্যালয় নির্বাচন করুন *
            </label>
            <select
              required
              value={selectedSchoolId}
              onChange={e => setSelectedSchoolId(e.target.value)}
              className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
            >
              <option value="">-- বিদ্যালয় পছন্দ করুন --</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.upazila})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              ৪-ডিজিট শিক্ষক পিন *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              value={enteredPin}
              onChange={e => setEnteredPin(e.target.value)}
              placeholder="••••"
              disabled={isLockedOut}
              className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-center font-mono font-bold text-xl tracking-widest"
            />
          </div>

          <button
            type="submit"
            disabled={isLockedOut || !selectedSchoolId || enteredPin.length !== 4}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50"
          >
            প্রবেশ করুন
          </button>
        </form>
      ) : (
        /* Screen 2: Interactive Cinema-Style Number Grid */
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* School Overview Card */}
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {school?.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ভেন্যু: <span className="font-semibold text-gray-800 dark:text-gray-200">{venue?.name}</span>
              </p>
            </div>

            <div className="flex gap-4 text-xs">
              <div className="text-center">
                <span className="text-gray-500 block">মোট ফরম</span>
                <span className="font-mono font-bold text-base text-gray-900 dark:text-white">
                  {toBengaliDigits(allSchoolIds.length)}
                </span>
              </div>
              <div className="text-center">
                <span className="text-gray-500 block">পাঠানো হয়েছে</span>
                <span className="font-mono font-bold text-base text-red-600">
                  {toBengaliDigits(alreadySentCount)}
                </span>
              </div>
              <div className="text-center">
                <span className="text-gray-500 block">অবশিষ্ট</span>
                <span className="font-mono font-bold text-base text-green-600">
                  {toBengaliDigits(allSchoolIds.length - alreadySentCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Toast / Notification */}
          {sendSuccessMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{sendSuccessMessage}</span>
            </div>
          )}

          {/* Color Legend with Pure White Text (User Requirement) */}
          <div className="flex flex-wrap items-center gap-2 text-xs p-3 bg-slate-900 rounded-xl border border-slate-700">
            <span className="font-bold text-white pr-1">রঙের নির্দেশিকা:</span>
            <span className="px-2.5 py-1 rounded-md bg-sky-600 text-white font-bold text-[11px] shadow-xs">
              ব্যবহারযোগ্য (প্রাথমিক)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-[11px] shadow-xs">
              ব্যবহারযোগ্য (নিম্ন মাধ্যমিক)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-600 text-white font-bold text-[11px] shadow-xs">
              ব্যবহারযোগ্য (মাধ্যমিক)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-red-600 text-white font-bold text-[11px] shadow-xs">
              নির্বাচিত (সিলেক্টেড)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-red-950 border border-red-700 text-white font-bold text-[11px] shadow-xs">
              পাঠানো হয়েছে (লকড)
            </span>
          </div>

          {/* Category Sections with Number Grids */}
          {(['01', '02', '03'] as CategoryCode[]).map(cat => {
            const ids = categorizedIds[cat];
            if (ids.length === 0) return null;

            const catInfo = CATEGORIES[cat];
            const block = schoolBlocks.find(b => b.category === cat);
            const sentInCat = ids.filter(id => markedIds.has(id)).length;

            return (
              <div key={cat} className="space-y-2">
                <div className="flex justify-between items-center pb-1 border-b border-gray-200 dark:border-slate-800">
                  <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: catInfo.color }}>
                    <span>{catInfo.nameBn}</span>
                    <span className="text-xs text-gray-500 font-mono font-normal">
                      · {block?.firstId} – {block?.lastId}
                    </span>
                  </h4>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold font-mono">
                    {toBengaliDigits(sentInCat)} / {toBengaliDigits(ids.length)} ব্যবহৃত
                  </span>
                </div>

                {/* Grid Showing Last 4 Digits (User Requirement) */}
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {ids.map(id => {
                    const isMarked = markedIds.has(id);
                    const isSelected = selectedIds.has(id);
                    const last4 = id.slice(-4); // Exact 4 digits, e.g. 1001, 2001, 3001
                    const prefix = id.slice(0, 3); // "260"

                    let tileClass = `border-2 rounded-xl flex flex-col items-center justify-center min-h-[52px] p-1.5 select-none cursor-pointer transition active:scale-95 `;

                    if (isMarked) {
                      tileClass += 'bg-red-950 border-red-900 text-white cursor-not-allowed opacity-90 shadow-inner';
                    } else if (isSelected) {
                      tileClass += 'bg-red-600 border-red-700 text-white font-bold ring-2 ring-red-400 shadow-md';
                    } else {
                      // Category Unused State
                      if (cat === '01') tileClass += 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-950 dark:text-sky-200 hover:bg-sky-100';
                      else if (cat === '02') tileClass += 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-200 hover:bg-emerald-100';
                      else tileClass += 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200 hover:bg-amber-100';
                    }

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSelectId(id)}
                        className={tileClass}
                      >
                        <span className="text-[9px] opacity-70 font-mono leading-none">{prefix}</span>
                        <span className="text-base font-extrabold font-mono leading-tight">{last4}</span>
                        {isMarked && <Lock className="w-3.5 h-3.5 text-red-300 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Sticky Bottom Bar for Mobile and Desktop */}
          <div className="sticky bottom-3 z-30 bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">
                {toBengaliDigits(selectedIds.size)} টি নম্বর নির্বাচিত
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-red-400 hover:text-red-300 underline font-medium"
                >
                  মুছুন
                </button>
              )}
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={selectedIds.size === 0 || isSending}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              <span>পাঠান</span>
            </button>
          </div>

          {/* Confirmation Modal */}
          {showConfirm && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 text-xs">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  ফরম নম্বর পাঠানোর নিশ্চিতকরণ
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  আপনি <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{toBengaliDigits(selectedIds.size)} টি</strong> নম্বর অ্যাডমিন ড্যাশবোর্ডে পাঠাতে যাচ্ছেন। একবার পাঠানো হলে এগুলো আর আনচেক করা যাবে না।
                </p>

                <div className="max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 flex flex-wrap gap-1 font-mono text-[11px]">
                  {Array.from(selectedIds).map(id => (
                    <span key={id} className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 rounded">
                      {id}
                    </span>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleConfirmSend}
                    disabled={isSending}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSending ? 'পাঠানো হচ্ছে...' : 'হ্যাঁ, নিশ্চিত করুন'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
