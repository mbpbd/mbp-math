import React, { useState, useEffect } from 'react';
import { ContestSettings } from '../../types';
import { Settings as SettingsIcon, Save, CheckCircle2, Shield, Trash2, RotateCcw } from 'lucide-react';

interface SettingsManagerProps {
  settings: ContestSettings;
  onSaveSettings: (settings: ContestSettings) => Promise<void>;
  onOpenResetModal?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  settings,
  onSaveSettings,
  onOpenResetModal
}) => {
  const [formData, setFormData] = useState<ContestSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync formData whenever persisted settings update from Firestore
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (field: keyof ContestSettings, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-950 dark:text-white">প্রতিযোগিতা সেটিংস ও সাধারণ কনফিগারেশন</span>
          </h2>
          <p className="text-xs text-slate-700 dark:text-gray-300 font-medium">
            প্রতিযোগিতার নাম, তারিখ, ফি, বিকাশ নম্বর, হেল্পলাইন ও ফলাফল প্রকাশ নিয়ন্ত্রণ। (কোনো মান হার্ডকোড নয়)
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5 transition"
        >
          {isSaved ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : isSaved ? 'সংরক্ষিত হয়েছে!' : 'সেটিংস সংরক্ষণ করুন'}</span>
        </button>
      </div>

      {/* Basic Event Names */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b pb-2">
          ১. প্রতিযোগিতার শিরোনাম ও আয়োজক
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              প্রতিযোগিতার নাম (বাংলা)
            </label>
            <input
              type="text"
              value={formData.contestNameBn}
              onChange={e => handleChange('contestNameBn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Contest Name (English)
            </label>
            <input
              type="text"
              value={formData.contestNameEn}
              onChange={e => handleChange('contestNameEn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              আয়োজক সংস্থা (বাংলা)
            </label>
            <input
              type="text"
              value={formData.organiserBn}
              onChange={e => handleChange('organiserBn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Organiser (English)
            </label>
            <input
              type="text"
              value={formData.organiserEn}
              onChange={e => handleChange('organiserEn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Dates, IDs, and Fee */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b pb-2">
          ২. তারিখ, আইডি ফরম্যাট ও ফি সংক্রান্ত
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              বছর কোড (Year Code in ID)
            </label>
            <input
              type="text"
              maxLength={4}
              value={formData.yearCode}
              onChange={e => handleChange('yearCode', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-mono font-bold text-center"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              রেজিস্ট্রেশন ফি (টাকা)
            </label>
            <input
              type="number"
              value={formData.registrationFee}
              onChange={e => handleChange('registrationFee', parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-mono font-bold text-center"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              অনলাইন সংরক্ষিত সিরিয়াল শুরু
            </label>
            <input
              type="number"
              value={formData.onlineSerialStart}
              onChange={e => handleChange('onlineSerialStart', parseInt(e.target.value, 10) || 601)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-mono font-bold text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              পরীক্ষার তারিখ ও সময় লেখা (বাংলা)
            </label>
            <input
              type="text"
              value={formData.quizDateTextBn}
              onChange={e => handleChange('quizDateTextBn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              সময় (বাংলা)
            </label>
            <input
              type="text"
              value={formData.quizTimeTextBn}
              onChange={e => handleChange('quizTimeTextBn', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Category Syllabus Editor (Phase 1a Custom Input) */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4 text-xs">
        <div className="border-b pb-2 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            ৩. ক্যাটাগরিভিত্তিক কুইজ সিলেবাস কনফিগারেশন (Syllabus for Print & Admit)
          </h3>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
            * প্রতিটি ক্যাটাগরির সিলেবাসের লেখা পরিবর্তন করুন যা ফরম ও প্রবেশপত্রে মুদ্রিত হবে
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block font-bold text-sky-700 dark:text-sky-300 mb-1">
              প্রাথমিক (ক্যাটাগরি ০১ — শ্রেণি ৩, ৪, ৫) সিলেবাস:
            </label>
            <textarea
              rows={3}
              value={formData.syllabuses?.['01'] || ''}
              onChange={e => setFormData({
                ...formData,
                syllabuses: { ...formData.syllabuses, '01': e.target.value }
              })}
              placeholder="প্রাথমিক ক্যাটাগরির গণিত কুইজ সিলেবাস..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium text-xs text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-emerald-700 dark:text-emerald-300 mb-1">
              নিম্ন মাধ্যমিক (ক্যাটাগরি ০২ — শ্রেণি ৬, ৭, ৮) সিলেবাস:
            </label>
            <textarea
              rows={3}
              value={formData.syllabuses?.['02'] || ''}
              onChange={e => setFormData({
                ...formData,
                syllabuses: { ...formData.syllabuses, '02': e.target.value }
              })}
              placeholder="নিম্ন মাধ্যমিক ক্যাটাগরির গণিত কুইজ সিলেবাস..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium text-xs text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-amber-700 dark:text-amber-300 mb-1">
              মাধ্যমিক (ক্যাটাগরি ০৩ — শ্রেণি ৯, ১০) সিলেবাস:
            </label>
            <textarea
              rows={3}
              value={formData.syllabuses?.['03'] || ''}
              onChange={e => setFormData({
                ...formData,
                syllabuses: { ...formData.syllabuses, '03': e.target.value }
              })}
              placeholder="মাধ্যমিক ক্যাটাগরির গণিত কুইজ সিলেবাস..."
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium text-xs text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Payment & Contact Info */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b pb-2">
          ৪. পেমেন্ট (বিকাশ) ও হেল্পলাইন
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              বিকাশ পার্সোনাল নম্বর (Send Money)
            </label>
            <input
              type="text"
              value={formData.bkashNumber}
              onChange={e => handleChange('bkashNumber', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              বিকাশ একাউন্টের নাম
            </label>
            <input
              type="text"
              value={formData.bkashAccountName}
              onChange={e => handleChange('bkashAccountName', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              হেল্পলাইন নম্বরসমূহ
            </label>
            <input
              type="text"
              value={formData.helplineNumbers}
              onChange={e => handleChange('helplineNumbers', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
              ফেসবুক পেজ লিংক
            </label>
            <input
              type="text"
              value={formData.facebookPage}
              onChange={e => handleChange('facebookPage', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Feature Locks and Switches */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b pb-2 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span>৪. নিরাপত্তা, আসন বিন্যাস ও ফলাফল প্রকাশ সুইচ</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.resultsPublished}
              onChange={e => handleChange('resultsPublished', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">ফলাফল প্রকাশ সুইচ (Results Published)</span>
              <span className="text-[11px] text-gray-500">অন থাকলে পাবলিক ফলাফল দেখতে পারবে; অফ থাকলে সার্ভার থেকে লক থাকবে।</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.seatPlanPublished}
              onChange={e => handleChange('seatPlanPublished', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">আসন বিন্যাস প্রকাশ (Seat Plan Published)</span>
              <span className="text-[11px] text-gray-500">অন থাকলে প্রবেশপত্র ও যাচাই পাতায় আসন নম্বর প্রদর্শিত হবে।</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.showWinnersList}
              onChange={e => handleChange('showWinnersList', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">বিজয়ী তালিকা উন্মুক্তকরণ (Winners List)</span>
              <span className="text-[11px] text-gray-500">ফলাফল প্রকাশের পর ক্যাটাগরিভিত্তিক মেধা তালিকা উন্মুক্ত থাকবে।</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.altVerifyByFather}
              onChange={e => handleChange('altVerifyByFather', e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <div>
              <span className="font-bold text-gray-900 dark:text-white block">পিতার নাম দিয়ে বিকল্প যাচাই</span>
              <span className="text-[11px] text-gray-500">মোবাইল নম্বর ছাড়া আইডি + পিতার নাম দিয়ে ফলাফল যাচাইয়ের সুযোগ।</span>
            </div>
          </label>
        </div>
      </div>

      {/* 5. Clean / Reset Dataset */}
      {onOpenResetModal && (
        <div className="bg-red-50/70 dark:bg-red-950/30 p-5 rounded-xl border border-red-200 dark:border-red-900 shadow-xs space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200 text-sm flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>৫. ডেটাসেট রিসেট ও ডামি ডেটা পরিষ্কারকরণ (Clean Dataset)</span>
              </h3>
              <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                পরীক্ষামূলক ডামি আবেদন, শিক্ষার্থী রেকর্ড, ফলাফল বা বিদ্যালয় তালিকা আংশিক বা সম্পূর্ণভাবে পরিষ্কার করুন (অ্যাডমিন পাসওয়ার্ড আবশ্যক)।
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenResetModal}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>রিসেট ও ক্লিন ডেটাসেট</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
};
