import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { PartialResetOptions } from '../../services/firestoreService';
import { auth, verifyAdminSession } from '../../config/firebase';

interface ResetDataModalProps {
  adminEmail: string;
  onConfirmPartialReset: (options: PartialResetOptions) => Promise<void>;
  onClose: () => void;
}

export const ResetDataModal: React.FC<ResetDataModalProps> = ({
  adminEmail,
  onConfirmPartialReset,
  onClose
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  const [options, setOptions] = useState<PartialResetOptions>({
    resetResults: true,
    resetStudents: false,
    resetApplications: false,
    resetTeacherMarks: false,
    resetSchools: false,
    resetVenues: false,
    resetSettings: false
  });

  const toggleOption = (key: keyof PartialResetOptions) => {
    setOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    setError(null);
  };

  const handleSelectAll = (selectAll: boolean) => {
    setOptions({
      resetResults: selectAll,
      resetStudents: selectAll,
      resetApplications: selectAll,
      resetTeacherMarks: selectAll,
      resetSchools: selectAll,
      resetVenues: selectAll,
      resetSettings: selectAll
    });
    setError(null);
  };

  const hasAnySelected = Object.values(options).some(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasAnySelected) {
      setError('দয়া করে রিসেট করার জন্য তালিকা থেকে কমপক্ষে একটি অপশন নির্বাচন করুন।');
      return;
    }

    if (confirmText.trim().toUpperCase() !== 'RESET') {
      setError('নিশ্চিত করতে নিচের ঘরে ইংরেজিতে RESET লিখুন।');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || (currentUser.email || '').toLowerCase() !== adminEmail.toLowerCase()) {
      setError('সক্রিয় Google অ্যাডমিন সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।');
      return;
    }

    setIsWiping(true);
    try {
      const verification = await verifyAdminSession(currentUser);
      if (!verification.authorized) {
        setError(verification.error);
        return;
      }
      await onConfirmPartialReset(options);
      onClose();
    } catch {
      setError('ডেটা রিসেট করার সময় একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border-2 border-red-300 dark:border-red-900 overflow-hidden font-['Hind_Siliguri',sans-serif] my-4">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-700 via-rose-800 to-red-900 text-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-amber-300" />
            <h3 className="text-base font-extrabold text-white">
              আংশিক বা সম্পূর্ণ ডেটাসেট রিসেট (Partial Reset)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-red-200 hover:text-white p-1 rounded-lg transition"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          
          {/* Warning box */}
          <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-red-900 dark:text-red-200">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-xs sm:text-sm">সতর্কতা: এটি অপরিবর্তনীয় সিস্টেম অ্যাকশন!</p>
              <p className="leading-relaxed text-[11px] sm:text-xs">
                প্রয়োজন অনুসারে শুধুমাত্র যে অংশগুলো রিসেট করতে চান সেগুলো নির্বাচন করুন। উদাহরণস্বরূপ: শুধু ফলাফল রিসেট করলে নিবন্ধিত শিক্ষার্থীদের নাম ও আইডি অক্ষুণ্ণ থাকবে।
              </p>
            </div>
          </div>

          {/* Granular Selection Checklist */}
          <div className="space-y-2">
            <div className="flex justify-between items-center pb-1 border-b border-gray-200 dark:border-slate-800">
              <label className="font-extrabold text-slate-950 dark:text-white text-xs">
                কোন কোন ডেটা রিসেট করতে চান? (Select Datasets):
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  সব নির্বাচন
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-[11px] font-bold text-gray-600 dark:text-gray-400 hover:underline"
                >
                  সব বাতিল
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {/* 1. Results only */}
              <div
                role="checkbox"
                aria-checked={!!options.resetResults}
                tabIndex={0}
                onClick={() => toggleOption('resetResults')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetResults'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetResults
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-slate-950 dark:text-amber-100'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetResults ? <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ১. পরীক্ষার প্রাপ্ত নম্বর, র‍্যাংক ও হাজিরা (Reset Results & Attendance only)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    সকল শিক্ষার্থীর নম্বর, পজিশন ও হাজিরা মুছে যাবে; নিবন্ধিত শিক্ষার্থীদের নাম ও আইডি অক্ষুণ্ণ থাকবে।
                  </span>
                </div>
              </div>

              {/* 2. Students Dataset */}
              <div
                role="checkbox"
                aria-checked={!!options.resetStudents}
                tabIndex={0}
                onClick={() => toggleOption('resetStudents')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetStudents'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetStudents
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-400 text-red-950 dark:text-red-200'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetStudents ? <CheckSquare className="w-4 h-4 text-red-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ২. নিবন্ধিত সকল শিক্ষার্থী ডেটাসেট (Reset Student Dataset)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    ডিরেক্টরি ও সিট প্ল্যানের সকল শিক্ষার্থী রেকর্ড পুরোপুরি মুছে ফেলা হবে।
                  </span>
                </div>
              </div>

              {/* 3. Online Applications */}
              <div
                role="checkbox"
                aria-checked={!!options.resetApplications}
                tabIndex={0}
                onClick={() => toggleOption('resetApplications')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetApplications'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetApplications
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-950 dark:text-rose-200'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetApplications ? <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ৩. অনলাইন আবেদন ও বিকাশ পেমেন্ট (Reset Online Applications)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    অপেক্ষমান ও যাচাইকৃত সকল অনলাইন আবেদন মুছে ফেলা হবে।
                  </span>
                </div>
              </div>

              {/* 4. Teacher Marks */}
              <div
                role="checkbox"
                aria-checked={!!options.resetTeacherMarks}
                tabIndex={0}
                onClick={() => toggleOption('resetTeacherMarks')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetTeacherMarks'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetTeacherMarks
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400 text-purple-950 dark:text-purple-200'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetTeacherMarks ? <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ৪. শিক্ষকদের জমা দেওয়া সিট নম্বর (Reset Teacher Seat Selections)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    শিক্ষক প্যানেল থেকে পাঠানো ও লক করা ফরম নম্বরগুলো ফাঁকা করা হবে।
                  </span>
                </div>
              </div>

              {/* 5. School Entries & Blocks */}
              <div
                role="checkbox"
                aria-checked={!!options.resetSchools}
                tabIndex={0}
                onClick={() => toggleOption('resetSchools')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetSchools'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetSchools
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 text-blue-950 dark:text-blue-200'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetSchools ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ৫. বিদ্যালয় তালিকা ও নম্বর ব্লক (Reset School Entries & Blocks)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    সকল ডামি বা সংরক্ষিত বিদ্যালয় ও ব্লক মুছে দিয়ে নতুন করে বিদ্যালয় যোগ করার সুযোগ দেবে।
                  </span>
                </div>
              </div>

              {/* 6. Venues */}
              <div
                role="checkbox"
                aria-checked={!!options.resetVenues}
                tabIndex={0}
                onClick={() => toggleOption('resetVenues')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetVenues'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetVenues
                    ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-400 text-teal-950 dark:text-teal-200'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetVenues ? <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ৬. ভেন্যু ও কক্ষ তালিকা (Reset Venues & Rooms)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    সকল ভেন্যু ও কক্ষের তথ্য মুছে ফেলা হবে।
                  </span>
                </div>
              </div>

              {/* 7. Settings */}
              <div
                role="checkbox"
                aria-checked={!!options.resetSettings}
                tabIndex={0}
                onClick={() => toggleOption('resetSettings')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOption('resetSettings'); } }}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                  options.resetSettings
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 text-slate-950 dark:text-white'
                    : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  {options.resetSettings ? <CheckSquare className="w-4 h-4 text-slate-800 dark:text-white shrink-0" /> : <Square className="w-4 h-4 text-gray-400 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  <span className="font-extrabold text-xs block text-slate-950 dark:text-white">
                    ৭. কনটেস্ট সেটিংস ও সিলেবাস (Restore Default Settings)
                  </span>
                  <span className="text-[11px] text-gray-600 dark:text-gray-400 block leading-tight">
                    প্রতিযোগিতার তারিখ, ফি, সিলেবাস ও সাধারণ সেটিংস ডিফল্ট অবস্থায় ফিরিয়ে আনুন।
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Google Admin Confirmation Prompt */}
          <div className="pt-2 border-t border-gray-200 dark:border-slate-800 space-y-2">
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>যাচাইকৃত অ্যাডমিন: <strong className="font-mono">{adminEmail}</strong></span>
            </div>
            <label className="block font-extrabold text-slate-950 dark:text-gray-200 mb-1.5">
              রিসেট নিশ্চিত করতে নিচে <span className="font-mono text-red-600 dark:text-red-400">RESET</span> লিখুন:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setError(null);
              }}
              placeholder="RESET"
              autoFocus
              className="w-full px-3 py-2 border-2 border-red-300 dark:border-red-900 focus:border-red-600 dark:focus:border-red-500 rounded-xl dark:bg-slate-800 dark:text-white font-mono text-sm uppercase tracking-widest outline-hidden transition"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-2.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-lg text-xs font-bold border border-red-300 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isWiping}
              className="px-4 py-2 border rounded-xl font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isWiping || !hasAnySelected}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-amber-300" />
              <span>{isWiping ? 'রিসেট করা হচ্ছে...' : 'নির্বাচিত অংশ রিসেট করুন'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
