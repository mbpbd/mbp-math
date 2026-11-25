import React, { useState, useMemo } from 'react';
import { OnlineApplication, CATEGORIES, QUESTION_MEDIUM_LABELS } from '../../types';
import { toBengaliDigits } from '../../services/idSystem';
import * as XLSX from 'xlsx';
import {
  Database,
  Search,
  Download,
  FileSpreadsheet
} from 'lucide-react';

interface OnlineGeneralDatasetProps {
  applications: OnlineApplication[];
}

const STATUS_LABELS: Record<OnlineApplication['status'], string> = {
  verified: 'গৃহীত (Verified)',
  pending: 'অপেক্ষমান (Pending)',
  rejected: 'বাতিল (Rejected)'
};

export const OnlineGeneralDataset: React.FC<OnlineGeneralDatasetProps> = ({
  applications
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter(app => {
      if (categoryFilter !== 'all' && app.category !== categoryFilter) return false;
      if (classFilter !== 'all' && app.class !== parseInt(classFilter, 10)) return false;
      if (statusFilter !== 'all' && app.status !== statusFilter) return false;
      if (!q) return true;
      return (
        app.nameBn?.toLowerCase().includes(q) ||
        app.nameEn?.toLowerCase().includes(q) ||
        app.schoolName?.toLowerCase().includes(q) ||
        app.mobile?.includes(q) ||
        app.payerMobile?.includes(q) ||
        app.assignedId?.toLowerCase().includes(q) ||
        app.txnId?.toLowerCase().includes(q) ||
        app.village?.toLowerCase().includes(q) ||
        app.upazila?.toLowerCase().includes(q)
      );
    });
  }, [applications, searchQuery, categoryFilter, classFilter, statusFilter]);

  const buildExportRows = () =>
    filteredApplications.map((app, idx) => ({
      SL: idx + 1,
      'Assigned Reg ID': app.assignedId || '',
      Status: app.status,
      'Name (English)': app.nameEn || '',
      'Name (Bengali)': app.nameBn || '',
      'Father Name': app.fatherName || '',
      'Mother Name': app.motherName || '',
      Class: app.class,
      Category: CATEGORIES[app.category]?.nameEn || app.category,
      'Question Medium':
        QUESTION_MEDIUM_LABELS[app.questionMedium === 'english' ? 'english' : 'bangla'].en,
      'School Name': app.schoolName || '',
      'Student Mobile': app.mobile || '',
      'Payer Mobile': app.payerMobile || '',
      'Village / Address': app.village || '',
      Upazila: app.upazila || '',
      District: app.district || '',
      'bKash TrxID': app.txnId || '',
      'Submitted At': app.submittedAt
        ? new Date(app.submittedAt).toLocaleString('en-GB')
        : '',
      'Rejection Reason': app.reason || ''
    }));

  const handleExportExcel = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Online_General_Dataset');
    XLSX.writeFile(wb, `MBP_Online_General_Dataset_${Date.now()}.xlsx`);
  };

  const handleExportCsv = () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `MBP_Online_General_Dataset_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>অনলাইন সাধারণ ডেটাসেট — আসন্ন ইভেন্টের জন্য ({toBengaliDigits(applications.length)} জন)</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
            অনলাইন রেজিস্ট্রেশন ফরমে শিক্ষার্থীদের প্রদত্ত মূল তথ্যসমূহ (ভবিষ্যতের যেকোনো ইভেন্টের যোগাযোগ ও এক্সপোর্টের জন্য পৃথক ডেটাসেট)।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Filters & Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-gray-200 dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম, বিদ্যালয়ের নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
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
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="all">সকল স্ট্যাটাস</option>
            <option value="verified">গৃহীত (Verified)</option>
            <option value="pending">অপেক্ষমান (Pending)</option>
            <option value="rejected">বাতিল (Rejected)</option>
          </select>
        </div>
      </div>

      {/* Dataset Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 font-extrabold uppercase tracking-wider border-b">
              <tr>
                <th className="py-2.5 px-3">ক্রম</th>
                <th className="py-2.5 px-3">শিক্ষার্থীর নাম</th>
                <th className="py-2.5 px-3">পিতা ও মাতা</th>
                <th className="py-2.5 px-2 text-center">শ্রেণি</th>
                <th className="py-2.5 px-3">বিদ্যালয়</th>
                <th className="py-2.5 px-3">মোবাইল নম্বর</th>
                <th className="py-2.5 px-3">ঠিকানা (গ্রাম / উপজেলা)</th>
                <th className="py-2.5 px-3">রেজিস্ট্রেশন / TrxID</th>
                <th className="py-2.5 px-3 text-center">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    কোনো অনলাইন আবেদনের তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app, idx) => {
                  const catInfo = CATEGORIES[app.category];
                  return (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 font-mono text-gray-500">
                        {toBengaliDigits(idx + 1)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-950 dark:text-white">
                          {app.nameBn || app.nameEn}
                        </div>
                        {app.nameEn && (
                          <div className="text-[10px] text-gray-500 uppercase font-mono">
                            {app.nameEn}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        <div>{app.fatherName || '—'}</div>
                        {app.motherName && (
                          <div className="text-gray-500">{app.motherName}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-mono font-extrabold block">
                          {toBengaliDigits(app.class)}
                        </span>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${catInfo?.badgeBg} ${catInfo?.textColor}`}>
                          {catInfo?.nameBn}
                        </span>
                        <span className="block text-[9px] text-indigo-600 dark:text-indigo-300 font-semibold mt-0.5">
                          {QUESTION_MEDIUM_LABELS[app.questionMedium === 'english' ? 'english' : 'bangla'].bn}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 max-w-[180px] font-medium">
                        {app.schoolName || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">{app.mobile || '—'}</div>
                        {app.payerMobile && app.payerMobile !== app.mobile && (
                          <div className="text-[10px] text-gray-500">পেমেন্ট: {app.payerMobile}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-600 dark:text-gray-300">
                        {[app.village, app.upazila, app.district].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <div className="font-bold text-indigo-600 dark:text-indigo-400">
                          {app.assignedId || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {app.txnId || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            app.status === 'verified'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : app.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {STATUS_LABELS[app.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-semibold">
            প্রদর্শিত রেকর্ড: {toBengaliDigits(filteredApplications.length)} / {toBengaliDigits(applications.length)} জন
          </span>
          <button
            onClick={handleExportExcel}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ফিল্টারকৃত ডেটা Excel-এ ডাউনলোড করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
};
