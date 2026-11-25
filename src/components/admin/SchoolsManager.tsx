import React, { useState } from 'react';
import { School, Venue, CATEGORIES, CategoryCode } from '../../types';
import { generate4DigitPin, hashPin, toBengaliDigits } from '../../services/idSystem';
import { getPreferredExamVenueId } from '../../services/defaultData';
import { School as SchoolIcon, Plus, RefreshCw, Copy, Check, Edit2, Trash2, X, KeyRound, MapPin } from 'lucide-react';

interface SchoolsManagerProps {
  schools: School[];
  venues: Venue[];
  onSaveSchool: (school: School) => Promise<void>;
  onDeleteSchool?: (schoolId: string) => Promise<void>;
}

export const SchoolsManager: React.FC<SchoolsManagerProps> = ({
  schools,
  venues,
  onSaveSchool,
  onDeleteSchool
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form & Filter states
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [upazila, setUpazila] = useState('কমলগঞ্জ (৩২২০)');
  const [venueId, setVenueId] = useState(() => getPreferredExamVenueId(venues));
  const [formsNeeded, setFormsNeeded] = useState<Record<CategoryCode, number>>({
    '01': 20,
    '02': 20,
    '03': 20
  });
  const [currentPlainPin, setCurrentPlainPin] = useState(generate4DigitPin());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'primary' | 'junior' | 'secondary'>('all');

  const resetForm = () => {
    setName('');
    setNameEn('');
    setUpazila('কমলগঞ্জ (৩২২০)');
    setVenueId(getPreferredExamVenueId(venues));
    setFormsNeeded({ '01': 20, '02': 20, '03': 20 });
    setCurrentPlainPin(generate4DigitPin());
    setIsAdding(false);
    setEditingId(null);
  };

  const startEdit = (s: School) => {
    setEditingId(s.id);
    setName(s.name);
    setNameEn(s.nameEn || '');
    setUpazila(s.upazila);
    setVenueId(s.venueId);
    setFormsNeeded(s.formsNeeded || { '01': 0, '02': 0, '03': 0 });
    setCurrentPlainPin(s.plainPin || generate4DigitPin());
    setIsAdding(true);
  };

  const handleRegeneratePin = async (school: School) => {
    if (!window.confirm(`আপনি কি ${school.name}-এর শিক্ষক প্যানেল পিন পুনর্নির্ধারণ করতে চান? পূর্বের সেশন অকার্যকর হয়ে যাবে।`)) {
      return;
    }
    const newPin = generate4DigitPin();
    const hashed = await hashPin(newPin);
    const updated: School = {
      ...school,
      pinHash: hashed,
      plainPin: newPin
    };
    await onSaveSchool(updated);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const maxNum = schools.reduce((max, s) => {
      const n = parseInt(s.id.replace(/\D/g, ''), 10);
      return !isNaN(n) && n > max ? n : max;
    }, 0);
    const nextId = `S${String(maxNum + 1).padStart(3, '0')}`;

    const hashedPin = await hashPin(currentPlainPin);
    const newSchool: School = {
      id: editingId || nextId,
      name: name.trim(),
      nameEn: nameEn.trim(),
      upazila: upazila.trim(),
      venueId,
      pinHash: hashedPin,
      plainPin: currentPlainPin,
      formsNeeded
    };

    await onSaveSchool(newSchool);
    resetForm();
  };

  const handleDelete = async (school: School) => {
    if (!onDeleteSchool) return;
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${school.name}" (${school.id}) মুছে ফেলতে চান?`)) {
      return;
    }
    await onDeleteSchool(school.id);
  };

  const totalPrimary = schools.reduce((sum, s) => sum + (s.formsNeeded?.['01'] || 0), 0);
  const totalLowerSec = schools.reduce((sum, s) => sum + (s.formsNeeded?.['02'] || 0), 0);
  const totalSec = schools.reduce((sum, s) => sum + (s.formsNeeded?.['03'] || 0), 0);

  const filteredSchools = schools.filter(s => {
    const matchesLevel =
      levelFilter === 'all' ||
      (levelFilter === 'primary' && (s.formsNeeded?.['01'] || 0) > 0) ||
      (levelFilter === 'junior' && (s.formsNeeded?.['02'] || 0) > 0 && (s.formsNeeded?.['03'] || 0) === 0) ||
      (levelFilter === 'secondary' && (s.formsNeeded?.['03'] || 0) > 0);
    if (!matchesLevel) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nameEn || '').toLowerCase().includes(q) ||
      (s.upazila || '').toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header and Summary Cards */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SchoolIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>অংশগ্রহণকারী বিদ্যালয়সমূহ ও ফর্ম কোটা</span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            বিদ্যালয় তালিকা, পিন নম্বর ব্যবস্থাপনা এবং ক্যাটাগরিভিত্তিক প্রয়োজনীয় ফর্মের হিসাব।
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন বিদ্যালয় যোগ করুন</span>
          </button>
        )}
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-500 block">মোট বিদ্যালয়</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
            {toBengaliDigits(schools.length)} <span className="text-xs font-normal text-gray-500">টি</span>
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-sky-200 dark:border-sky-900/40">
          <span className="text-xs text-sky-700 dark:text-sky-300 block font-semibold">প্রাথমিক (৩, ৪, ৫)</span>
          <span className="text-2xl font-bold text-sky-700 dark:text-sky-300 font-mono">
            {toBengaliDigits(totalPrimary)} <span className="text-xs font-normal text-gray-500">ফরম</span>
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 block font-semibold">নিম্ন মাধ্যমিক (৬, ৭, ৮)</span>
          <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 font-mono">
            {toBengaliDigits(totalLowerSec)} <span className="text-xs font-normal text-gray-500">ফরম</span>
          </span>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-200 dark:border-amber-900/40">
          <span className="text-xs text-amber-700 dark:text-amber-300 block font-semibold">মাধ্যমিক (৯, ১০)</span>
          <span className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
            {toBengaliDigits(totalSec)} <span className="text-xs font-normal text-gray-500">ফরম</span>
          </span>
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="font-bold text-gray-900 dark:text-white">
              {editingId ? 'বিদ্যালয় তথ্য সম্পাদনা' : 'নতুন বিদ্যালয় নিবন্ধন'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                বিদ্যালয়ের নাম (বাংলা) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="যেমন: তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                School Name in English (সার্টিফিকেটের জন্য ব্যবহৃত হবে)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Tetaigaon Rashid Uddin High School"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                উপজেলা
              </label>
              <input
                type="text"
                value={upazila}
                onChange={e => setUpazila(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                বরাদ্দকৃত ভেন্যু *
              </label>
              <select
                value={venueId}
                onChange={e => setVenueId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm"
              >
                {venues.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                শিক্ষক ৪-ডিজিট পিন
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={currentPlainPin}
                  onChange={e => setCurrentPlainPin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-sm font-mono font-bold tracking-widest text-center"
                />
                <button
                  type="button"
                  onClick={() => setCurrentPlainPin(generate4DigitPin())}
                  className="p-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300"
                  title="নতুন পিন তৈরি করুন"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Forms Needed per Category */}
          <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
              প্রয়োজনীয় ফর্ম কোটা (ক্যাটাগরিভিত্তিক সংখ্যা দিন)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['01', '02', '03'] as CategoryCode[]).map(cat => {
                const info = CATEGORIES[cat];
                return (
                  <div key={cat} className={`p-3 rounded-lg border ${info.badgeBg} ${info.borderColor}`}>
                    <span className={`block text-xs font-bold ${info.textColor} mb-1`}>
                      {info.nameBn} ({info.classes.join(', ')})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={900}
                      value={formsNeeded[cat] || 0}
                      onChange={e => setFormsNeeded({
                        ...formsNeeded,
                        [cat]: Math.max(0, parseInt(e.target.value, 10) || 0)
                      })}
                      className="w-full px-2 py-1.5 border rounded bg-white dark:bg-slate-900 font-mono font-bold text-center text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              বাতিল
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm shadow flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>সংরক্ষণ করুন</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Level Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="বিদ্যালয়ের নাম, এলাকা বা আইডি দিয়ে খুঁজুন (যেমন: কমলগঞ্জ, শমসেরনগর, আদমপুর)..."
          className="flex-1 px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-xs text-gray-900 dark:text-white"
        />
        <div className="flex flex-wrap gap-1.5 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setLevelFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${levelFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300'}`}
          >
            সব ({schools.length})
          </button>
          <button
            type="button"
            onClick={() => setLevelFilter('primary')}
            className={`px-3 py-1.5 rounded-lg transition ${levelFilter === 'primary' ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300'}`}
          >
            প্রাথমিক
          </button>
          <button
            type="button"
            onClick={() => setLevelFilter('junior')}
            className={`px-3 py-1.5 rounded-lg transition ${levelFilter === 'junior' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300'}`}
          >
            জুনিয়র
          </button>
          <button
            type="button"
            onClick={() => setLevelFilter('secondary')}
            className={`px-3 py-1.5 rounded-lg transition ${levelFilter === 'secondary' ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-gray-300'}`}
          >
            মাধ্যমিক
          </button>
        </div>
      </div>

      {/* Schools Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3">আইডি</th>
                <th className="py-3 px-4">বিদ্যালয়ের নাম</th>
                <th className="py-3 px-3">উপজেলা / এলাকা</th>
                <th className="py-3 px-3">পরীক্ষা কেন্দ্র (ভেন্যু)</th>
                <th className="py-3 px-3 text-center">প্রাথমিক (০১)</th>
                <th className="py-3 px-3 text-center">নিম্ন মাধ্য. (০২)</th>
                <th className="py-3 px-3 text-center">মাধ্যমিক (০৩)</th>
                <th className="py-3 px-3 text-center">শিক্ষক পিন</th>
                <th className="py-3 px-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-800 dark:text-gray-200">
              {filteredSchools.map(school => {
                const venue = venues.find(v => v.id === school.venueId);
                const totalSchoolForms = (school.formsNeeded?.['01'] || 0) + (school.formsNeeded?.['02'] || 0) + (school.formsNeeded?.['03'] || 0);

                return (
                  <tr key={school.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {school.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {school.name}
                      </div>
                      {school.nameEn && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                          {school.nameEn}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        মোট ফর্ম: {toBengaliDigits(totalSchoolForms)} টি
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                      {school.upazila}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span>{venue?.name || school.venueId}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-sky-700 dark:text-sky-300">
                      {school.formsNeeded?.['01'] || 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      {school.formsNeeded?.['02'] || 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-amber-700 dark:text-amber-300">
                      {school.formsNeeded?.['03'] || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded font-mono font-bold">
                        <KeyRound className="w-3 h-3" />
                        <span>{school.plainPin || '••••'}</span>
                        {school.plainPin && (
                          <button
                            onClick={() => copyToClipboard(school.plainPin!, school.id)}
                            className="ml-1 hover:text-red-900"
                            title="পিন কপি করুন"
                          >
                            {copiedId === school.id ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRegeneratePin(school)}
                          className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                          title="নতুন পিন দিন"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => startEdit(school)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 rounded"
                          title="সম্পাদনা করুন"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteSchool && (
                          <button
                            onClick={() => handleDelete(school)}
                            className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                            title="বিদ্যালয় মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
