import React, { useState, useEffect } from 'react';
import { Student, ContestSettings, CATEGORIES, CategoryCode } from '../../types';
import { computeAllRankings, StudentResult, getEnglishSchoolName, getEnglishPositionText } from '../../services/resultsService';
import { toBengaliDigits } from '../../services/idSystem';
import { getRegistrationQrDataUrl } from '../../services/qrGenerator';
import { downloadCertificateAsPdf } from '../../services/pdfExport';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Lock, 
  Unlock, 
  Award, 
  Printer, 
  Download,
  CheckCircle2, 
  Search, 
  Eye, 
  FileCheck,
  UserCheck,
  Edit3,
  Upload,
  Image,
  Medal
} from 'lucide-react';

interface ResultsManagerProps {
  students: Student[];
  settings: ContestSettings;
  onSaveMarks: (updatedStudents: Student[]) => Promise<void>;
  onSaveSettings: (settings: ContestSettings) => Promise<void>;
}

export const ResultsManager: React.FC<ResultsManagerProps> = ({
  students,
  settings,
  onSaveMarks,
  onSaveSettings
}) => {
  const [activeClass, setActiveClass] = useState<number>(5);
  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryCode>('01');
  const [marksMap, setMarksMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      if (typeof s.marks === 'number') map[s.id] = s.marks;
    });
    return map;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [certificateStudent, setCertificateStudent] = useState<StudentResult | null>(null);
  const [certQrUrl, setCertQrUrl] = useState<string>('');

  // Signatures State with PNG Signature Support (User Request #8)
  const defaultSignatories = (settings.signatories?.length === 3 ? settings.signatories : [
    { name: 'Brojendro Kumar Singha', title: 'Director General', post: 'Director General, MBP' },
    { name: 'Kiran Singha', title: 'Exam Controller', post: 'Exam Controller, MBP' },
    { name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' }
  ]).map(s => s.name.includes('Swarup') ? { ...s, name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' } : s);

  const [signatories, setSignatories] = useState(defaultSignatories);
  const [showSignaturesEditor, setShowSignaturesEditor] = useState(false);

  // Sync signatories when settings load from Firestore
  useEffect(() => {
    if (settings.signatories && settings.signatories.length === 3) {
      setSignatories(
        settings.signatories.map(s =>
          s.name.includes('Swarup') ? { ...s, name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' } : s
        )
      );
    }
  }, [settings.signatories]);

  // Sync marks map when students prop updates
  useEffect(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      if (typeof s.marks === 'number') map[s.id] = s.marks;
    });
    setMarksMap(map);
  }, [students]);

  // Compute live rankings for all students (Classwise 1st, 2nd, 3rd - User Request #9)
  const studentsWithLiveMarks = students.map(s => ({
    ...s,
    marks: marksMap[s.id] !== undefined ? marksMap[s.id] : s.marks
  }));

  const allRankingsMap = computeAllRankings(studentsWithLiveMarks, 3);
  const allRankingsList = Array.from(allRankingsMap.values());

  const handleMarkChange = (studentId: string, val: string) => {
    const num = parseInt(val, 10);
    setMarksMap(prev => ({
      ...prev,
      [studentId]: isNaN(num) ? 0 : Math.min(100, Math.max(0, num))
    }));
  };

  const handleSaveMarksBatch = async () => {
    setIsSavingMarks(true);
    try {
      const updatedList = students.map(s => {
        if (marksMap[s.id] !== undefined) {
          return { ...s, marks: marksMap[s.id] };
        }
        return s;
      });
      await onSaveMarks(updatedList);
      alert('নম্বরসমূহ সফলভাবে সংরক্ষিত হয়েছে!');
    } finally {
      setIsSavingMarks(false);
    }
  };

  // Upload PNG Signature for Signatories (User Request #8)
  const handleSignatureUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      setSignatories(prev => {
        const next = [...prev];
        next[index] = { ...next[index], signatureUrl: base64Url };
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearSignature = (index: number) => {
    setSignatories(prev => {
      const next = [...prev];
      const updated = { ...next[index] };
      delete updated.signatureUrl;
      next[index] = updated;
      return next;
    });
  };

  // Save Signatories
  const handleSaveSignatories = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      ...settings,
      signatories
    });
    setShowSignaturesEditor(false);
    alert('সনদের ৩ জন স্বাক্ষরকারীর নাম, পদবি এবং PNG স্বাক্ষর সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // Toggle Results Lock
  const handleToggleLock = async () => {
    if (!settings.resultsPublished) {
      if (!window.confirm('আপনি কি ফলাফল উন্মুক্ত করতে চান? এটি সাথে সাথে পাবলিক রেজাল্ট পোর্টালে সবার জন্য দৃশ্যমান হবে।')) {
        return;
      }
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    await onSaveSettings({
      ...settings,
      resultsPublished: !settings.resultsPublished
    });
  };

  // Open single certificate
  const handleViewCertificate = async (res: StudentResult) => {
    const verifyPayload = `${window.location.origin}/#verify-${res.certNo || res.studentId}`;
    const qr = await getRegistrationQrDataUrl(verifyPayload);
    setCertQrUrl(qr);
    setCertificateStudent(res);
  };

  // Download certificate directly as high-resolution PDF (no outside background page)
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadCertificate = async () => {
    if (!certificateStudent) return;
    const fileName = `MBP_MathQuiz_Certificate_${certificateStudent.studentId}_${certificateStudent.studentNameEn.replace(/\s+/g, '_')}`;
    setIsExportingPdf(true);
    try {
      await downloadCertificateAsPdf('printable-certificate-sheet', fileName);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Filter rankings for active class
  const classStudentsResults = allRankingsList
    .filter(r => r.studentClass === activeClass)
    .sort((a, b) => (b.marks || 0) - (a.marks || 0));

  const firstPlace = classStudentsResults.find(r => r.classRank === 1 && r.attendance);
  const secondPlace = classStudentsResults.find(r => r.classRank === 2 && r.attendance);
  const thirdPlace = classStudentsResults.find(r => r.classRank === 3 && r.attendance);

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Top Banner and Results Lock Switch */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>ফলাফল ও সনদ ব্যবস্থাপনা (Phase 4 Results & Certificates)</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
            প্রতিটি শ্রেণির ১ম, ২য় ও ৩য় স্থান নির্ধারণ, ৩ জন স্বাক্ষরকারীর PNG স্বাক্ষর আপলোড এবং ইংরেজি সনদ।
          </p>
        </div>

        {/* Lock Switch & Signatures Editor Button */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSignaturesEditor(true)}
            className="px-3.5 py-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition text-slate-800 dark:text-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
            <span>৩ জনের PNG স্বাক্ষর ও পদবি</span>
          </button>

          <div className="text-right pl-2 border-l border-slate-300 dark:border-slate-700">
            <span className="text-[10px] text-gray-500 block uppercase font-bold">পাবলিক ফলাফল</span>
            <span className={`font-bold text-xs ${settings.resultsPublished ? 'text-emerald-600' : 'text-red-600'}`}>
              {settings.resultsPublished ? '● ফলাফল উন্মুক্ত' : '🔒 ফলাফল লকড'}
            </span>
          </div>

          <button
            onClick={handleToggleLock}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition ${
              settings.resultsPublished
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {settings.resultsPublished ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{settings.resultsPublished ? 'ফলাফল লক করুন' : 'ফলাফল প্রকাশ করুন'}</span>
          </button>
        </div>
      </div>

      {/* Class Selector Bar (User Request #9: 1st, 2nd, 3rd Prizes are Class-wise) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-2">
        <div className="flex justify-between items-center pb-1">
          <span className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Medal className="w-4 h-4 text-amber-500" />
            <span>শ্রেণিভিত্তিক ফলাফল ও পুরস্কার (Classes 3 to 10 - Class-wise 1st, 2nd, 3rd)</span>
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
            প্রতিটি শ্রেণির জন্য পৃথক ১ম, ২য় ও ৩য় স্থান বিজয়ী নির্ধারিত
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {[3, 4, 5, 6, 7, 8, 9, 10].map(c => {
            const cat = c <= 5 ? '01' : c <= 8 ? '02' : '03';
            const catInfo = CATEGORIES[cat];
            return (
              <button
                key={c}
                onClick={() => setActiveClass(c)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeClass === c
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                <span>শ্রেণি {toBengaliDigits(c)}</span>
                <span className="text-[10px] opacity-75 font-normal font-sans">({catInfo.nameEn})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Class Winners Podium Cards (1st, 2nd, 3rd for Selected Class) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* 1st Place */}
        <div className="p-4 bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200 border-2 border-amber-500 rounded-2xl text-slate-950 shadow-md">
          <div className="flex justify-between items-center mb-1">
            <span className="font-black text-sm">🥇 ১ম স্থান (1st Place Winner)</span>
            <span className="px-2 py-0.5 bg-slate-950 text-amber-300 font-bold text-[10px] rounded-full">
              Class {activeClass} Champion
            </span>
          </div>
          {firstPlace ? (
            <div className="space-y-1">
              <h4 className="text-lg font-black">{firstPlace.studentNameBn}</h4>
              <p className="text-xs font-bold uppercase">{firstPlace.studentNameEn}</p>
              <p className="text-xs opacity-90">{firstPlace.schoolName}</p>
              <div className="mt-2 pt-2 border-t border-black/10 flex justify-between items-center">
                <span className="font-mono font-bold text-xs">আইডি: {firstPlace.studentId}</span>
                <span className="font-mono font-black text-base text-indigo-950">প্রাপ্ত নম্বর: {toBengaliDigits(firstPlace.marks || 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-75 italic py-4 text-center">এখনও কোনো ১ম স্থান বিজয়ী নেই</p>
          )}
        </div>

        {/* 2nd Place */}
        <div className="p-4 bg-gradient-to-br from-slate-200 via-slate-100 to-gray-200 border-2 border-slate-400 rounded-2xl text-slate-950 shadow-md">
          <div className="flex justify-between items-center mb-1">
            <span className="font-black text-sm">🥈 ২য় স্থান (Runner-Up)</span>
            <span className="px-2 py-0.5 bg-slate-950 text-white font-bold text-[10px] rounded-full">
              2nd Place
            </span>
          </div>
          {secondPlace ? (
            <div className="space-y-1">
              <h4 className="text-lg font-black">{secondPlace.studentNameBn}</h4>
              <p className="text-xs font-bold uppercase">{secondPlace.studentNameEn}</p>
              <p className="text-xs opacity-90">{secondPlace.schoolName}</p>
              <div className="mt-2 pt-2 border-t border-black/10 flex justify-between items-center">
                <span className="font-mono font-bold text-xs">আইডি: {secondPlace.studentId}</span>
                <span className="font-mono font-black text-base text-indigo-950">প্রাপ্ত নম্বর: {toBengaliDigits(secondPlace.marks || 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-75 italic py-4 text-center">এখনও কোনো ২য় স্থান বিজয়ী নেই</p>
          )}
        </div>

        {/* 3rd Place */}
        <div className="p-4 bg-gradient-to-br from-orange-200 via-amber-100 to-yellow-100 border-2 border-orange-400 rounded-2xl text-slate-950 shadow-md">
          <div className="flex justify-between items-center mb-1">
            <span className="font-black text-sm">🥉 ৩য় স্থান (3rd Place)</span>
            <span className="px-2 py-0.5 bg-slate-950 text-orange-200 font-bold text-[10px] rounded-full">
              3rd Place
            </span>
          </div>
          {thirdPlace ? (
            <div className="space-y-1">
              <h4 className="text-lg font-black">{thirdPlace.studentNameBn}</h4>
              <p className="text-xs font-bold uppercase">{thirdPlace.studentNameEn}</p>
              <p className="text-xs opacity-90">{thirdPlace.schoolName}</p>
              <div className="mt-2 pt-2 border-t border-black/10 flex justify-between items-center">
                <span className="font-mono font-bold text-xs">আইডি: {thirdPlace.studentId}</span>
                <span className="font-mono font-black text-base text-indigo-950">প্রাপ্ত নম্বর: {toBengaliDigits(thirdPlace.marks || 0)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-75 italic py-4 text-center">এখনও কোনো ৩য় স্থান বিজয়ী নেই</p>
          )}
        </div>

      </div>

      {/* Selected Class Student Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center gap-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            শ্রেণি {toBengaliDigits(activeClass)}: শিক্ষার্থীদের মেধা তালিকা ও নম্বর
          </h3>
          <button
            onClick={handleSaveMarksBatch}
            disabled={isSavingMarks}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSavingMarks ? 'সংরক্ষণ হচ্ছে...' : 'সব নম্বর সংরক্ষণ'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">শ্রেণি স্থান</th>
                <th className="py-2.5 px-3">আইডি</th>
                <th className="py-2.5 px-3">শিক্ষার্থীর নাম</th>
                <th className="py-2.5 px-3">বিদ্যালয়</th>
                <th className="py-2.5 px-2 text-center">উপস্থিতি</th>
                <th className="py-2.5 px-3 text-center">প্রাপ্ত নম্বর (১০০)</th>
                <th className="py-2.5 px-3">শ্রেণি / ক্যাটাগরি স্থান</th>
                <th className="py-2.5 px-3 text-right">ইংরেজি সনদ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
              {classStudentsResults.map(r => (
                <tr key={r.studentId} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                  <td className="py-2.5 px-3 font-bold font-mono">
                    {r.classRank ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.classRank === 1 ? 'bg-amber-100 text-amber-900 font-extrabold' :
                        r.classRank === 2 ? 'bg-slate-200 text-slate-800 font-bold' :
                        r.classRank === 3 ? 'bg-orange-100 text-orange-900 font-bold' :
                        'text-gray-600'
                      }`}>
                        {r.classRank}ম স্থান
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {r.studentId}
                  </td>
                  <td className="py-2.5 px-3 font-bold">
                    {r.studentNameBn} ({r.studentNameEn})
                  </td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                    {r.schoolName}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {r.attendance ? (
                      <span className="text-emerald-600 font-bold">উপস্থিত</span>
                    ) : (
                      <span className="text-gray-400">অনুপস্থিত</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {r.attendance ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={marksMap[r.studentId] !== undefined ? marksMap[r.studentId] : (r.marks || '')}
                        onChange={e => handleMarkChange(r.studentId, e.target.value)}
                        className="w-16 px-2 py-1 border rounded-lg dark:bg-slate-900 text-center font-mono font-bold text-xs"
                      />
                    ) : (
                      <span className="text-gray-400 font-mono">অনুপস্থিত</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                      {r.classAwardTextBn}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      ক্যাটাগরি স্থান: {r.categoryRank}ম
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {r.attendance && (
                      <button
                        onClick={() => handleViewCertificate(r)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] shadow-xs"
                      >
                        সনদ দেখুন / প্রিন্ট
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Signatures & PNG Signatures Configuration Modal (User Request #8) */}
      {showSignaturesEditor && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <span>সনদের ৩ জন স্বাক্ষরকারী ও PNG ডিজিটাল স্বাক্ষর</span>
              </h3>
              <button
                onClick={() => setShowSignaturesEditor(false)}
                className="text-gray-500 hover:text-gray-800 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              সনদের নিচে প্রদর্শিত ৩টি স্বাক্ষরের নাম, পদবি এবং তাদের PNG স্বাক্ষর আপলোড করুন (সনদে স্বয়ংক্রিয়ভাবে বসে যাবে):
            </p>

            <form onSubmit={handleSaveSignatories} className="space-y-3.5 text-xs">
              {signatories.map((sig, idx) => (
                <div key={idx} className="p-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl border space-y-2.5">
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block text-xs">
                    স্বাক্ষরকারী {idx + 1}
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold mb-0.5">নাম (English)</label>
                      <input
                        type="text"
                        required
                        value={sig.name}
                        onChange={e => {
                          const val = e.target.value;
                          setSignatories(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], name: val };
                            return next;
                          });
                        }}
                        placeholder="e.g. Brojendro Kumar Singha"
                        className="w-full p-2 border rounded-lg dark:bg-slate-900 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-0.5">পদবি (Post)</label>
                      <input
                        type="text"
                        required
                        value={sig.post || sig.title}
                        onChange={e => {
                          const val = e.target.value;
                          setSignatories(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], post: val, title: val };
                            return next;
                          });
                        }}
                        placeholder="e.g. Director General, MBP"
                        className="w-full p-2 border rounded-lg dark:bg-slate-900 font-semibold"
                      />
                    </div>
                  </div>

                  {/* PNG Signature File Upload (User Request #8) */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 rounded-lg font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-indigo-600" />
                        <span>PNG স্বাক্ষর আপলোড</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={e => handleSignatureUpload(idx, e)}
                          className="hidden"
                        />
                      </label>
                      {sig.signatureUrl && (
                        <button
                          type="button"
                          onClick={() => handleClearSignature(idx)}
                          className="text-red-600 hover:underline text-[10px] font-semibold"
                        >
                          মুছুন
                        </button>
                      )}
                    </div>

                    {/* Thumbnail Preview */}
                    {sig.signatureUrl ? (
                      <div className="h-8 p-1 bg-white border rounded flex items-center justify-center">
                        <img src={sig.signatureUrl} alt="Signature Preview" className="h-6 max-h-6 w-auto object-contain" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">কোনো স্বাক্ষর নেই</span>
                    )}
                  </div>

                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSignaturesEditor(false)}
                  className="px-4 py-2 border rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* English Certificate Preview Modal (A4 Landscape - Working Print & Download) */}
      {certificateStudent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white text-gray-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b print:hidden font-sans">
              <h3 className="font-bold text-base text-gray-800">
                Official English Certificate (A4 Landscape)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCertificate}
                  disabled={isExportingPdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingPdf ? 'Generating PDF...' : 'Download Certificate (PDF)'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setCertificateStudent(null)}
                  className="p-1.5 text-gray-500 hover:text-gray-800 text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* The Certificate Sheet (100% in English) */}
            <div 
              id="printable-certificate-sheet"
              className="bg-white border-8 border-double border-indigo-950 p-8 rounded-sm relative flex flex-col justify-between text-center min-h-[520px] font-serif shadow-inner"
            >
              
              {/* Header */}
              <div>
                <img 
                  src="/assets/aistudio/mbp_d0333f88.jpg" 
                  alt="MBP Logo" 
                  className="w-16 h-16 object-contain mx-auto mb-2"
                />
                <h4 className="text-xl font-bold uppercase tracking-wider text-indigo-950">
                  Manipuri Biggan Projonmo
                </h4>
                <p className="text-xs uppercase tracking-widest text-gray-600 font-sans font-semibold">
                  Math Quiz Contest 2026
                </p>
                <h2 className="text-2xl font-extrabold text-amber-600 uppercase tracking-widest mt-4">
                  {certificateStudent.isClassWinner ? 'Certificate of Achievement' : 'Certificate of Merit'}
                </h2>
                <p className="text-xs italic text-gray-500 mt-0.5">
                  Held on 26 December 2026
                </p>
              </div>

              {/* Recipient Body */}
              <div className="my-6 space-y-3 font-sans">
                <p className="text-sm italic text-gray-600">
                  This certificate is proudly awarded to
                </p>
                <h1 className="text-3xl font-extrabold text-indigo-950 uppercase tracking-wide underline decoration-amber-500 decoration-2 underline-offset-8">
                  {certificateStudent.studentNameEn}
                </h1>
                <p className="text-sm text-gray-700 max-w-2xl mx-auto leading-relaxed">
                  Student of Class {certificateStudent.studentClass}, <strong>{certificateStudent.schoolNameEn || getEnglishSchoolName(certificateStudent.schoolName)}</strong>, for outstanding performance securing <strong className="text-red-600 font-extrabold">{certificateStudent.classPositionTextEn || getEnglishPositionText(certificateStudent)}</strong> in Class {certificateStudent.studentClass} ({CATEGORIES[certificateStudent.category].nameEn} Category) of the Annual Math Quiz Contest 2026.
                </p>
              </div>

              {/* Dynamic 3 PNG Signatures & Verification QR Code (User Request #8) */}
              <div className="pt-6 border-t border-gray-300 grid grid-cols-4 items-end text-xs font-sans">
                {signatories.map((sig, idx) => (
                  <div key={idx} className="text-center">
                    {sig.signatureUrl ? (
                      <img src={sig.signatureUrl} alt={sig.name} className="h-10 max-h-10 w-auto object-contain mx-auto mb-1" />
                    ) : (
                      <div className="h-6"></div>
                    )}
                    <div className="w-28 border-b border-gray-600 mx-auto mb-1"></div>
                    <span className="font-bold text-gray-900 block leading-tight">{sig.name}</span>
                    <span className="text-[10px] text-gray-600 block mt-0.5">{sig.post || sig.title}</span>
                  </div>
                ))}

                {/* Verification QR Code */}
                <div className="text-center">
                  {certQrUrl && (
                    <img 
                      src={certQrUrl} 
                      alt="Verify QR" 
                      className="w-14 h-14 border mx-auto p-0.5 object-contain" 
                    />
                  )}
                  <span className="font-mono text-[9px] text-gray-500 block mt-1">
                    Verify: {certificateStudent.certNo || certificateStudent.studentId}
                  </span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
