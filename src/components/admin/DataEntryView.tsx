import React, { useState, useEffect, useRef } from 'react';
import { NumberBlock, Student, CATEGORIES, CategoryCode, QuestionMedium } from '../../types';
import { parseRegistrationId, toBengaliDigits } from '../../services/idSystem';
import { findBlockForId } from '../../services/blockAllocation';
import { Keyboard, Check, Edit2, AlertCircle, Save, Plus } from 'lucide-react';

interface DataEntryViewProps {
  blocks: NumberBlock[];
  existingStudents: Student[];
  onSaveStudent: (student: Student) => Promise<void>;
}

export const DataEntryView: React.FC<DataEntryViewProps> = ({
  blocks,
  existingStudents,
  onSaveStudent
}) => {
  const [currentId, setCurrentId] = useState<string>('2601001');
  const [nameBn, setNameBn] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [studentClass, setStudentClass] = useState<number>(3);
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [upazila, setUpazila] = useState('কমলগঞ্জ');
  const [district, setDistrict] = useState('মৌলভীবাজার');
  const [questionMedium, setQuestionMedium] = useState<QuestionMedium>('bangla');

  const [activeBlock, setActiveBlock] = useState<NumberBlock | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [recentEntries, setRecentEntries] = useState<Student[]>([]);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);

  // Look up block info whenever ID changes
  useEffect(() => {
    const clean = currentId.trim();
    if (clean.length === 7) {
      const parsed = parseRegistrationId(clean);
      if (!parsed.valid) {
        setBlockError(parsed.error || 'অকার্যকর আইডি');
        setActiveBlock(null);
        return;
      }

      // Check which block it belongs to
      const block = blocks.find(b => 
        b.category === parsed.category &&
        parsed.serial! >= b.firstSerial &&
        parsed.serial! <= b.lastSerial
      );

      if (!block) {
        setBlockError(`আইডি '${clean}' কোনো অনুমোদিত ব্লকের অন্তর্ভুক্ত নয়!`);
        setActiveBlock(null);
        return;
      }

      setActiveBlock(block);
      setBlockError(null);

      // Check if student already exists
      const existing = existingStudents.find(s => s.id === clean);
      if (existing) {
        setIsEditingExisting(true);
        setNameBn(existing.nameBn);
        setNameEn(existing.nameEn);
        setFatherName(existing.fatherName);
        setMotherName(existing.motherName || '');
        setStudentClass(existing.class);
        setMobile(existing.mobile);
        setVillage(existing.village || '');
        setUpazila(existing.upazila || 'কমলগঞ্জ');
        setDistrict(existing.district || 'মৌলভীবাজার');
        setQuestionMedium(existing.questionMedium === 'english' ? 'english' : 'bangla');
      } else {
        setIsEditingExisting(false);
        // Default class to first class of this category
        const catClasses = CATEGORIES[block.category].classes;
        if (!catClasses.includes(studentClass)) {
          setStudentClass(catClasses[0]);
        }
      }
    } else {
      setActiveBlock(null);
      setBlockError(null);
      setIsEditingExisting(false);
    }
  }, [currentId, blocks, existingStudents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBlock) {
      alert('সঠিক ব্লক ছাড়া তথ্য সংরক্ষণ করা যাবে না');
      return;
    }
    if (!nameBn.trim()) {
      alert('শিক্ষার্থীর বাংলা নাম দিন');
      nameInputRef.current?.focus();
      return;
    }

    const studentObj: Student = {
      id: currentId.trim(),
      category: activeBlock.category,
      class: studentClass,
      nameBn: nameBn.trim(),
      nameEn: nameEn.trim().toUpperCase(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      mobile: mobile.trim(),
      village: village.trim(),
      upazila: upazila.trim(),
      district: district.trim(),
      schoolName: activeBlock.schoolName || 'বিদ্যালয়',
      schoolId: activeBlock.schoolId,
      venueId: activeBlock.venueId,
      source: 'school',
      questionMedium,
      createdAt: new Date().toISOString()
    };

    await onSaveStudent(studentObj);
    setRecentEntries(prev => [studentObj, ...prev.filter(s => s.id !== studentObj.id)].slice(0, 20));
    setSaveFeedback(`আইডি ${currentId} সফলভাবে সংরক্ষিত হয়েছে!`);
    setTimeout(() => setSaveFeedback(null), 3000);

    // Auto increment to next ID
    const currentNum = parseInt(currentId, 10);
    const nextIdStr = String(currentNum + 1);
    setCurrentId(nextIdStr);

    // Reset fields and jump focus back to Name field for rapid data entry
    setNameBn('');
    setNameEn('');
    setFatherName('');
    setMotherName('');
    setMobile('');
    setVillage('');
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  };

  const handleEditRecent = (st: Student) => {
    setCurrentId(st.id);
    setNameBn(st.nameBn);
    setNameEn(st.nameEn);
    setFatherName(st.fatherName);
    setMotherName(st.motherName || '');
    setStudentClass(st.class);
    setMobile(st.mobile);
    setVillage(st.village || '');
    setUpazila(st.upazila || 'কমলগঞ্জ');
    setDistrict(st.district || 'মৌলভীবাজার');
    setQuestionMedium(st.questionMedium === 'english' ? 'english' : 'bangla');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Left Form: Fast Entry */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>কাগজের ফরম ডাটা এন্ট্রি (Fast Keyboard Entry)</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ৭ ডিজিট আইডি লিখে Enter চাপলেই স্বয়ংক্রিয়ভাবে পরবর্তী আইডিতে চলে যাবে।
            </p>
          </div>

          {saveFeedback && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
              {saveFeedback}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* ID Input & Auto-Block Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                রেজিস্ট্রেশন নম্বর (৭ ডিজিট) *
              </label>
              <input
                ref={idInputRef}
                type="text"
                required
                maxLength={7}
                value={currentId}
                onChange={e => setCurrentId(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400 text-center"
              />
              {isEditingExisting && (
                <span className="text-[10px] text-amber-600 font-bold block mt-1">
                  ⚠️ এই আইডিতে পূর্বেই ডাটা এন্ট্রি করা হয়েছে (সম্পাদনা মোড)
                </span>
              )}
            </div>

            {/* Resolved Block Meta */}
            <div>
              <span className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                সনাক্তকৃত বিদ্যালয় ও ভেন্যু:
              </span>
              {activeBlock ? (
                <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/60 rounded-lg border border-indigo-200 dark:border-indigo-800 text-[11px] space-y-0.5">
                  <p className="font-bold text-indigo-900 dark:text-indigo-200">{activeBlock.schoolName}</p>
                  <p className="text-gray-600 dark:text-gray-400">ভেন্যু: {activeBlock.venueName}</p>
                  <p className="font-semibold text-indigo-700">
                    ক্যাটাগরি: {CATEGORIES[activeBlock.category].nameBn} (শ্রেণি: {CATEGORIES[activeBlock.category].classes.join(', ')})
                  </p>
                </div>
              ) : blockError ? (
                <div className="p-2 bg-red-50 dark:bg-red-950/60 rounded-lg border border-red-300 text-red-700 font-semibold text-[11px]">
                  {blockError}
                </div>
              ) : (
                <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-400 text-[11px]">
                  সঠিক ৭ ডিজিট আইডি দিন...
                </div>
              )}
            </div>
          </div>

          {/* Student Names */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                অংশগ্রহণকারীর নাম (বাংলা) *
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={nameBn}
                onChange={e => setNameBn(e.target.value)}
                placeholder="যেমন: প্রজ্ঞা সিংহ"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                Name in English (CAPITAL LETTERS)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value.toUpperCase())}
                placeholder="PROGNA SINGHA"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 uppercase text-xs"
              />
            </div>
          </div>

          {/* Parents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                পিতার নাম *
              </label>
              <input
                type="text"
                required
                value={fatherName}
                onChange={e => setFatherName(e.target.value)}
                placeholder="পিতার নাম"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                মাতার নাম
              </label>
              <input
                type="text"
                value={motherName}
                onChange={e => setMotherName(e.target.value)}
                placeholder="মাতার নাম"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          {/* Class, Medium & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                শ্রেণি (অনুমোদিত শ্রেণি) *
              </label>
              <select
                value={studentClass}
                onChange={e => setStudentClass(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
              >
                {activeBlock ? (
                  CATEGORIES[activeBlock.category].classes.map(c => (
                    <option key={c} value={c}>শ্রেণি {toBengaliDigits(c)}</option>
                  ))
                ) : (
                  <option value={3}>শ্রেণি ৩</option>
                )}
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                প্রশ্নের ধরন *
              </label>
              <select
                value={questionMedium}
                onChange={e => setQuestionMedium(e.target.value as QuestionMedium)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="bangla">বাংলা মাধ্যম</option>
                <option value="english">ইংরেজি মাধ্যম</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                মোবাইল নম্বর
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 font-mono text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">গ্রাম / পাড়া</label>
              <input
                type="text"
                value={village}
                onChange={e => setVillage(e.target.value)}
                placeholder="গ্রাম"
                className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">উপজেলা</label>
              <input
                type="text"
                value={upazila}
                onChange={e => setUpazila(e.target.value)}
                placeholder="উপজেলা"
                className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">জেলা</label>
              <input
                type="text"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                placeholder="জেলা"
                className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={!activeBlock}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>সংরক্ষণ করুন (Enter)</span>
            </button>
          </div>
        </form>
      </div>

      {/* Right Sidebar: Recent 20 Entries */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col space-y-3">
        <h3 className="font-bold text-gray-900 dark:text-white text-sm border-b pb-2 flex justify-between items-center">
          <span>সর্বশেষ এন্ট্রিকৃত তালিকা</span>
          <span className="text-[10px] text-gray-400 font-mono font-normal">
            ({recentEntries.length} টি)
          </span>
        </h3>

        {recentEntries.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-xs">
            এখনও কোনো এন্ট্রি করা হয়নি। উপরে ফরম পূরণ করে সেভ করুন।
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {recentEntries.map(s => (
              <div
                key={s.id}
                onClick={() => handleEditRecent(s)}
                className="p-2.5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer transition space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                    {s.id}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    শ্রেণি {toBengaliDigits(s.class)}
                  </span>
                </div>
                <p className="font-bold text-gray-900 dark:text-white truncate text-xs">
                  {s.nameBn} ({s.nameEn})
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {s.schoolName}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
