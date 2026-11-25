import React, { useState, useEffect } from 'react';
import {
  Student,
  Venue,
  CATEGORIES,
  CategoryCode,
  QuestionMedium,
  QUESTION_MEDIUM_LABELS
} from '../../types';
import { toBengaliDigits } from '../../services/idSystem';
import * as XLSX from 'xlsx';
import { 
  Users, 
  Search, 
  Download, 
  Edit2, 
  Trash2, 
  FileSpreadsheet, 
  CheckCircle2, 
  Save,
  Filter,
  Eye,
  X
} from 'lucide-react';

interface StudentsDirectoryProps {
  students: Student[];
  venues: Venue[];
  onSaveStudent: (student: Student) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
}

export const StudentsDirectory: React.FC<StudentsDirectoryProps> = ({
  students,
  venues,
  onSaveStudent,
  onDeleteStudent
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [mediumFilter, setMediumFilter] = useState<'all' | QuestionMedium>('all');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Local marks state for direct inline entry by admin (User Request #6)
  const [marksState, setMarksState] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      if (typeof s.marks === 'number') map[s.id] = s.marks;
    });
    return map;
  });

  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync marks state if students prop updates
  useEffect(() => {
    const map: Record<string, number> = {};
    students.forEach(s => {
      if (typeof s.marks === 'number') map[s.id] = s.marks;
    });
    setMarksState(map);
  }, [students]);

  // Handle inline mark input
  const handleMarkChange = (studentId: string, val: string) => {
    const num = parseInt(val, 10);
    setMarksState(prev => ({
      ...prev,
      [studentId]: isNaN(num) ? 0 : Math.min(100, Math.max(0, num))
    }));
  };

  // Batch Save all marks (User Request #6)
  const handleSaveAllMarks = async () => {
    setIsSavingMarks(true);
    try {
      for (const st of students) {
        const newMark = marksState[st.id];
        if (newMark !== undefined && newMark !== st.marks) {
          await onSaveStudent({
            ...st,
            marks: newMark
          });
        }
      }
      setSaveSuccessMsg('পরীক্ষার্থীদের সকল নম্বর সফলভাবে সংরক্ষিত হয়েছে! পাবলিক পোর্টালে শিক্ষার্থীরা নিজ নিজ নম্বর দেখতে পারবে।');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } finally {
      setIsSavingMarks(false);
    }
  };

  const getStudentMedium = (s: Student): QuestionMedium =>
    s.questionMedium === 'english' ? 'english' : 'bangla';

  const banglaCount = students.filter(s => getStudentMedium(s) === 'bangla').length;
  const englishCount = students.filter(s => getStudentMedium(s) === 'english').length;

  // Filter students
  const filteredStudents = students.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (classFilter !== 'all' && s.class !== parseInt(classFilter, 10)) return false;
    if (sourceFilter !== 'all' && s.source !== sourceFilter) return false;
    if (mediumFilter !== 'all' && getStudentMedium(s) !== mediumFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.nameBn?.toLowerCase().includes(q) ||
      s.nameEn?.toLowerCase().includes(q) ||
      s.schoolName?.toLowerCase().includes(q) ||
      s.mobile?.includes(q)
    );
  });

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const rows = filteredStudents.map((s, idx) => ({
      'SL': idx + 1,
      'Registration ID': s.id,
      'Name (Bengali)': s.nameBn,
      'Name (English)': s.nameEn,
      'Father Name': s.fatherName,
      'Class': s.class,
      'Category': CATEGORIES[s.category]?.nameEn || s.category,
      'Question Medium': QUESTION_MEDIUM_LABELS[getStudentMedium(s)].en,
      'School': s.schoolName,
      'Mobile': s.mobile,
      'Source': s.source,
      'Attendance': s.attendance ? 'Present' : 'Absent',
      'Marks': marksState[s.id] !== undefined ? marksState[s.id] : (typeof s.marks === 'number' ? s.marks : '')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `MBP_Math_Quiz_2026_Students_${Date.now()}.xlsx`);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const rows = filteredStudents.map((s, idx) => ({
      'SL': idx + 1,
      'Registration ID': s.id,
      'Name (Bengali)': s.nameBn,
      'Name (English)': s.nameEn,
      'Class': s.class,
      'Category': s.category,
      'Question Medium': QUESTION_MEDIUM_LABELS[getStudentMedium(s)].en,
      'School': s.schoolName,
      'Mobile': s.mobile,
      'Marks': marksState[s.id] !== undefined ? marksState[s.id] : (typeof s.marks === 'number' ? s.marks : '')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `MBP_Math_Quiz_2026_Students_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || !deleteTargetId) return;
    await onDeleteStudent(deleteTargetId);
    setDeleteTargetId(null);
    setDeleteConfirmText('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    await onSaveStudent(editingStudent);
    setEditingStudent(null);
  };

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>নিবন্ধিত সকল শিক্ষার্থী ডিরেক্টরি ও নম্বর এন্ট্রি ({toBengaliDigits(students.length)} জন)</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
            উত্তরপত্র মূল্যায়নের পর প্রতিটি শিক্ষার্থীর নম্বর ইনপুট দিন।{' '}
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              প্রশ্নের ধরন — বাংলা মাধ্যম: {toBengaliDigits(banglaCount)} জন · ইংরেজি মাধ্যম: {toBengaliDigits(englishCount)} জন
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleSaveAllMarks}
            disabled={isSavingMarks}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingMarks ? 'সংরক্ষণ হচ্ছে...' : 'নম্বরসমূহ সংরক্ষণ করুন'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (.xlsx)</span>
          </button>
          
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="আইডি, নাম, বিদ্যালয় বা মোবাইল নম্বর..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl dark:bg-slate-900 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            <option value="01">প্রাথমিক (০১)</option>
            <option value="02">নিম্ন মাধ্যমিক (০২)</option>
            <option value="03">মাধ্যমিক (০৩)</option>
          </select>

          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="all">সকল শ্রেণি (৩-১০)</option>
            {[3, 4, 5, 6, 7, 8, 9, 10].map(c => (
              <option key={c} value={c}>শ্রেণি {toBengaliDigits(c)}</option>
            ))}
          </select>

          <select
            value={mediumFilter}
            onChange={e => setMediumFilter(e.target.value as 'all' | QuestionMedium)}
            className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="all">সকল প্রশ্নের ধরন</option>
            <option value="bangla">বাংলা মাধ্যম ({toBengaliDigits(banglaCount)})</option>
            <option value="english">ইংরেজি মাধ্যম ({toBengaliDigits(englishCount)})</option>
          </select>

          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="all">সকল উৎস</option>
            <option value="school">স্কুল ফরম</option>
            <option value="online">অনলাইন</option>
            <option value="walkin">ওয়াক-ইন</option>
          </select>
        </div>
      </div>

      {/* Table with Inline Marks Entry */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 font-extrabold uppercase tracking-wider border-b">
              <tr>
                <th className="py-2.5 px-3">আইডি</th>
                <th className="py-2.5 px-3">শিক্ষার্থীর নাম</th>
                <th className="py-2.5 px-2 text-center">শ্রেণি</th>
                <th className="py-2.5 px-3">ক্যাটাগরি</th>
                <th className="py-2.5 px-3">প্রশ্নের ধরন</th>
                <th className="py-2.5 px-3">বিদ্যালয়</th>
                <th className="py-2.5 px-3">মোবাইল</th>
                <th className="py-2.5 px-2 text-center">উপস্থিতি</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300">
                  প্রাপ্ত নম্বর (১০০)
                </th>
                <th className="py-2.5 px-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredStudents.map(st => {
                  const catInfo = CATEGORIES[st.category];
                  const medium = getStudentMedium(st);
                  const mediumLabel = QUESTION_MEDIUM_LABELS[medium];
                  const currentMark = marksState[st.id] !== undefined ? marksState[st.id] : (st.marks || '');

                  return (
                    <tr key={st.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {st.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-950 dark:text-white">
                          {st.nameBn}
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase font-mono">
                          {st.nameEn}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-extrabold text-sm">
                        {toBengaliDigits(st.class)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${catInfo?.badgeBg} ${catInfo?.textColor}`}>
                          {catInfo?.nameBn}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${
                            medium === 'english'
                              ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-800'
                              : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800'
                          }`}
                        >
                          {mediumLabel.bn}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-[150px] truncate font-medium">
                        {st.schoolName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-gray-600 dark:text-gray-400">
                        {st.mobile || '—'}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {st.attendance ? (
                          <span className="text-emerald-600 font-bold">✓ উপস্থিত</span>
                        ) : (
                          <span className="text-gray-400">অনুপস্থিত</span>
                        )}
                      </td>

                      {/* Inline Marks Input (User Request #6) */}
                      <td className="py-2 px-3 text-center bg-indigo-50/40 dark:bg-indigo-950/20">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={currentMark}
                          onChange={e => handleMarkChange(st.id, e.target.value)}
                          placeholder="নম্বর"
                          className="w-16 px-2 py-1 text-center font-mono font-extrabold text-sm border-2 border-indigo-200 dark:border-indigo-800 rounded-lg dark:bg-slate-900 focus:outline-indigo-600 text-indigo-950 dark:text-indigo-200 shadow-inner"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingStudent(st)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition"
                            title="সম্পাদনা করুন"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(st.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Bar */}
        <div className="p-3 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-semibold">
            প্রদর্শিত শিক্ষার্থী: {toBengaliDigits(filteredStudents.length)} জন
          </span>
          <button
            onClick={handleSaveAllMarks}
            disabled={isSavingMarks}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow transition"
          >
            <Save className="w-4 h-4" />
            <span>নম্বর সংরক্ষণ করুন</span>
          </button>
        </div>
      </div>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveEdit} className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-lg w-full shadow-2xl border space-y-3">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                শিক্ষার্থী তথ্য ও নম্বর সংশোধন — {editingStudent.id}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">বাংলা নাম</label>
                <input
                  type="text"
                  required
                  value={editingStudent.nameBn}
                  onChange={e => setEditingStudent({ ...editingStudent, nameBn: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">English Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.nameEn}
                  onChange={e => setEditingStudent({ ...editingStudent, nameEn: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 uppercase text-xs font-mono font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">শ্রেণি</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  required
                  value={editingStudent.class}
                  onChange={e => setEditingStudent({ ...editingStudent, class: parseInt(e.target.value, 10) || 5 })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs font-mono font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">মোবাইল নম্বর</label>
                <input
                  type="tel"
                  value={editingStudent.mobile}
                  onChange={e => setEditingStudent({ ...editingStudent, mobile: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">পিতার নাম</label>
                <input
                  type="text"
                  required
                  value={editingStudent.fatherName}
                  onChange={e => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-indigo-700 dark:text-indigo-400 mb-0.5">প্রাপ্ত নম্বর (১০০)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={typeof editingStudent.marks === 'number' ? editingStudent.marks : ''}
                  onChange={e => {
                    const num = parseInt(e.target.value, 10);
                    setEditingStudent({ ...editingStudent, marks: isNaN(num) ? undefined : num });
                  }}
                  placeholder="নম্বর লিখুন"
                  className="w-full px-2 py-1.5 border-2 border-indigo-400 rounded-lg dark:bg-slate-800 font-mono font-bold text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">বিদ্যালয়ের নাম</label>
                <input
                  type="text"
                  required
                  value={editingStudent.schoolName}
                  onChange={e => setEditingStudent({ ...editingStudent, schoolName: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-0.5">প্রশ্নের ধরন (Medium)</label>
                <select
                  value={editingStudent.questionMedium === 'english' ? 'english' : 'bangla'}
                  onChange={e =>
                    setEditingStudent({
                      ...editingStudent,
                      questionMedium: e.target.value as QuestionMedium
                    })
                  }
                  className="w-full px-2 py-1.5 border rounded-lg dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value="bangla">বাংলা মাধ্যম (Bangla Medium)</option>
                  <option value="english">ইংরেজি মাধ্যম (English Medium)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-2xl border space-y-3">
            <h3 className="font-bold text-base text-red-600">
              রেকর্ড মুছে ফেলার নিশ্চিতকরণ
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              আপনি কি নিশ্চিতভাবে আইডি <strong className="font-mono text-indigo-600">{deleteTargetId}</strong> মুছে ফেলতে চান? নিশ্চিত করতে নিচের ঘরে <strong>DELETE</strong> টাইপ করুন:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono text-center uppercase font-bold"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-3 py-1.5 border rounded-lg text-xs"
              >
                বাতিল
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs disabled:opacity-40"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
