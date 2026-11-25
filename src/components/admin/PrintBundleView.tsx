import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CATEGORIES, CategoryCode, ContestSettings, NumberBlock, School, Venue } from '../../types';
import { BundleCoverSheet } from '../print/BundleCoverSheet';
import { PrintedFormSheet } from '../print/PrintedFormSheet';
import { getRegistrationQrDataUrl, getUrlQrDataUrl } from '../../services/qrGenerator';
import { downloadSheetsAsPdf } from '../../services/pdfExport';
import { INITIAL_VENUES, getPreferredExamVenueId } from '../../services/defaultData';
import {
  buildCategorywiseForms,
  CategorySerialRange,
  toBengaliDigits
} from '../../services/idSystem';
import { Printer, FileText, Download, Eye, ZoomIn, ZoomOut, Smartphone, Layers, School as SchoolIcon, MapPin, AlertCircle } from 'lucide-react';

interface PrintBundleViewProps {
  schools: School[];
  venues: Venue[];
  blocks: NumberBlock[];
  settings: ContestSettings;
  onBack: () => void;
}

export const PrintBundleView: React.FC<PrintBundleViewProps> = ({
  schools,
  venues,
  blocks,
  settings,
  onBack
}) => {
  const [formMode, setFormMode] = useState<'school' | 'category'>('school');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(schools[0]?.id || '');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | CategoryCode>('all');
  const [categoryRanges, setCategoryRanges] = useState<Record<CategoryCode, CategorySerialRange>>({
    '01': { start: 1, end: 500 },
    '02': { start: 1, end: 500 },
    '03': { start: 1, end: 500 }
  });
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => getPreferredExamVenueId(venues));
  const [manualSchoolName, setManualSchoolName] = useState<string>('');
  const [includeForms, setIncludeForms] = useState<boolean>(true);
  const [includeCover, setIncludeCover] = useState<boolean>(true);
  const [previewLimit, setPreviewLimit] = useState<number>(5);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const qrCacheRef = useRef<Record<string, string>>({});
  const [teacherPortalQr, setTeacherPortalQr] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);

  // Sync selectedSchoolId / selectedVenueId when lists load
  useEffect(() => {
    if (!selectedSchoolId && schools.length > 0) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools, selectedSchoolId]);

  useEffect(() => {
    if ((!selectedVenueId || !venues.some(v => v.id === selectedVenueId)) && venues.length > 0) {
      setSelectedVenueId(getPreferredExamVenueId(venues));
    }
  }, [venues, selectedVenueId]);

  const availableVenues = venues.length > 0 ? venues : INITIAL_VENUES;
  const selectedSchool = schools.find(s => s.id === selectedSchoolId) || schools[0];
  const schoolBlocks = selectedSchool ? blocks.filter(b => b.schoolId === selectedSchool.id) : [];
  const schoolVenue = availableVenues.find(v => v.id === selectedSchool?.venueId) || availableVenues[0];
  const manualVenue = availableVenues.find(v => v.id === selectedVenueId) || availableVenues[0];

  const yearPrefix = (settings.yearCode || '26').slice(0, 2);
  const serialDigits = settings.serialDigits || 3;

  // Build full list of forms for School-wise mode
  const formsToPrint = useMemo(() => {
    const list: Array<{ id: string; category: CategoryCode }> = [];
    schoolBlocks.forEach(b => {
      for (let s = b.firstSerial; s <= b.lastSerial; s++) {
        const padded = String(s).padStart(serialDigits, '0');
        list.push({
          id: `${settings.yearCode}${b.category}${padded}`,
          category: b.category
        });
      }
    });
    return list;
  }, [schoolBlocks, serialDigits, settings.yearCode]);

  // Build sequential Category-wise forms up to admin-defined last serial number per category
  const categoryFormsToPrint = useMemo(() => {
    return buildCategorywiseForms({
      yearCode: yearPrefix,
      selectedCategory: selectedCategoryFilter,
      ranges: categoryRanges,
      serialDigits
    });
  }, [yearPrefix, selectedCategoryFilter, categoryRanges, serialDigits]);

  const activeTotalCount = formMode === 'school' ? formsToPrint.length : categoryFormsToPrint.length;
  const activeBatch = useMemo(() => {
    const source = formMode === 'school' ? formsToPrint : categoryFormsToPrint;
    return source.slice(0, previewLimit);
  }, [formMode, formsToPrint, categoryFormsToPrint, previewLimit]);

  // Generate QR codes for visible forms (cached by registration ID) and teacher portal
  useEffect(() => {
    let isCancelled = false;
    const generateQrs = async () => {
      setIsGeneratingQr(true);
      const appUrl = window.location.origin;
      const portalUrl = `${appUrl}/#teacher`;
      if (!teacherPortalQr) {
        const portalQr = await getUrlQrDataUrl(portalUrl);
        if (!isCancelled) {
          setTeacherPortalQr(portalQr);
        }
      }

      const missingForms = activeBatch.filter(form => !qrCacheRef.current[form.id]);
      if (missingForms.length > 0) {
        const chunkSize = 15;
        for (let i = 0; i < missingForms.length; i += chunkSize) {
          if (isCancelled) break;
          const chunk = missingForms.slice(i, i + chunkSize);
          const entries = await Promise.all(
            chunk.map(async form => {
              const qr = await getRegistrationQrDataUrl(form.id);
              return [form.id, qr] as const;
            })
          );
          if (isCancelled) break;
          entries.forEach(([id, qr]) => {
            qrCacheRef.current[id] = qr;
          });
          setQrMap({ ...qrCacheRef.current });
        }
      }

      if (!isCancelled) {
        setIsGeneratingQr(false);
      }
    };

    generateQrs();
    return () => {
      isCancelled = true;
    };
  }, [activeBatch, teacherPortalQr]);

  const handleUpdateRange = (cat: CategoryCode, field: 'start' | 'end', rawVal: string) => {
    const parsed = parseInt(rawVal, 10);
    const num = Number.isNaN(parsed) ? 0 : Math.max(field === 'start' ? 1 : 0, parsed);
    setCategoryRanges(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        [field]: num
      }
    }));
  };

  const handlePrint = () => {
    setActionError(null);
    window.print();
  };

  // Generate and Download Genuine PDF (.pdf) file directly without triggering print dialog
  const handleDownloadPdf = async () => {
    setActionError(null);
    const sheets = document.querySelectorAll<HTMLElement>('.print-container .a4-sheet');
    if (!sheets || sheets.length === 0) {
      setActionError('কোনো পাতা পাওয়া যায়নি।');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const fileName =
        formMode === 'category'
          ? `Categorywise_Registration_Forms_${yearPrefix}_MBP_MathQuiz.pdf`
          : `${selectedSchool?.name || 'School'}_MBP_MathQuiz_Forms.pdf`;
      await downloadSheetsAsPdf(Array.from(sheets), fileName);
    } catch (err) {
      console.error('PDF Download Error:', err);
      setActionError('PDF ডাউনলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে কম পাতা নিয়ে অথবা প্রিন্ট অপশন থেকে "Save as PDF" ব্যবহার করুন।');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const visibleRangeCategories: CategoryCode[] =
    selectedCategoryFilter === 'all' ? ['01', '02', '03'] : [selectedCategoryFilter];

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Top Toolbar (Hidden during print) */}
      <div className="print:hidden bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button
              onClick={onBack}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline mb-1 flex items-center gap-1"
            >
              ← ফিরে যান
            </button>
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>স্কুল বান্ডিল ও প্রিন্ট-রেডি ফরম জেনারেটর (PDF & Print)</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
              A4 পোর্ট্রেইট ফরম (মূল রেজিস্ট্রেশন কপি + প্রবেশপত্র) — স্কুলভিত্তিক অথবা ক্যাটাগরিভিত্তিক ধারাবাহিক ক্রমিক নম্বরসহ প্রিন্ট ও PDF ডাউনলোড করুন।
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingQr || isDownloadingPdf || activeTotalCount === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingPdf ? 'PDF তৈরি হচ্ছে...' : 'PDF ডাউনলোড করুন'}</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isGeneratingQr || isDownloadingPdf || activeTotalCount === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        {actionError && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Mode Switcher Tabs: School-wise vs Category-wise Registration Forms */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setFormMode('school');
              setPreviewLimit(5);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
              formMode === 'school'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                : 'bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <SchoolIcon className="w-4 h-4" />
            <span>স্কুলভিত্তিক রেজিস্ট্রেশন ফরম ও কভার শীট</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormMode('category');
              setPreviewLimit(5);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition ${
              formMode === 'category'
                ? 'bg-amber-500 text-slate-950 shadow-sm ring-2 ring-amber-300'
                : 'bg-gray-100 dark:bg-slate-900 text-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ক্যাটাগরিভিত্তিক রেজিস্ট্রেশন ফরম (Category-wise Registration Form)</span>
          </button>
        </div>

        {/* Controls for School Mode */}
        {formMode === 'school' && (
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 dark:border-slate-700/60">
            <div>
              <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-0.5">স্কুল নির্বাচন করুন</label>
              <select
                value={selectedSchool?.id || ''}
                onChange={e => setSelectedSchoolId(e.target.value)}
                className="px-3 py-1.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-xs font-semibold"
              >
                {schools.length === 0 ? (
                  <option value="">কোনো বিদ্যালয় নেই</option>
                ) : (
                  schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))
                )}
              </select>
            </div>

            {schoolVenue && (
              <div className="pt-3 flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>ভেন্যু: <strong>{schoolVenue.name}</strong></span>
              </div>
            )}

            <div className="flex items-center gap-4 pt-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={e => setIncludeCover(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>কভার শীট</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeForms}
                  onChange={e => setIncludeForms(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span>ফরমসমূহ</span>
              </label>
            </div>
          </div>
        )}

        {/* Controls for Category-wise Registration Form */}
        {formMode === 'category' && (
          <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-0.5">
                  ক্যাটাগরি নির্বাচন করুন
                </label>
                <select
                  value={selectedCategoryFilter}
                  onChange={e => {
                    setSelectedCategoryFilter(e.target.value as 'all' | CategoryCode);
                    setPreviewLimit(5);
                  }}
                  className="w-full px-3 py-1.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-xs font-semibold"
                >
                  <option value="all">সকল ৩টি ক্যাটাগরি একসাথে</option>
                  <option value="01">{CATEGORIES['01'].nameBn} (ক্যাটাগরি ০১ — {yearPrefix}01...)</option>
                  <option value="02">{CATEGORIES['02'].nameBn} (ক্যাটাগরি ০২ — {yearPrefix}02...)</option>
                  <option value="03">{CATEGORIES['03'].nameBn} (ক্যাটাগরি ০৩ — {yearPrefix}03...)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-0.5">
                  পরীক্ষার ভেন্যু নির্বাচন করুন
                </label>
                <select
                  value={manualVenue.id}
                  onChange={e => setSelectedVenueId(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-xs font-semibold"
                >
                  {availableVenues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 dark:text-gray-300 uppercase mb-0.5">
                  বিদ্যালয়ের নাম (ঐচ্ছিক — খালি রাখলে কলম দিয়ে লেখার লাইন থাকবে)
                </label>
                <input
                  type="text"
                  value={manualSchoolName}
                  onChange={e => setManualSchoolName(e.target.value)}
                  placeholder="খালি রাখুন অথবা বিদ্যালয়ের নাম লিখুন..."
                  className="w-full px-3 py-1.5 border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-xs font-semibold"
                />
              </div>
            </div>

            {/* Category Serial Range Controls */}
            <div className="p-3 bg-amber-50/70 dark:bg-slate-900/80 border border-amber-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-900 dark:text-amber-200">
                  ক্যাটাগরিভিত্তিক ধারাবাহিক রেজিস্ট্রেশন নম্বর নির্ধারণ (Serial Range)
                </span>
                <span className="text-[10px] text-slate-600 dark:text-gray-400">
                  শেষ ক্রমিক নম্বর দিলে (যেমন 500) {yearPrefix}01001 থেকে {yearPrefix}01500 পর্যন্ত স্বয়ংক্রিয়ভাবে তৈরি হবে।
                </span>
              </div>

              <div className={`grid grid-cols-1 ${visibleRangeCategories.length === 1 ? 'sm:grid-cols-1 max-w-md' : 'sm:grid-cols-3'} gap-2.5`}>
                {visibleRangeCategories.map(cat => {
                  const range = categoryRanges[cat];
                  const validCount = range.end >= range.start ? range.end - range.start + 1 : 0;
                  const firstId = `${yearPrefix}${cat}${String(Math.max(1, range.start)).padStart(serialDigits, '0')}`;
                  const lastId = `${yearPrefix}${cat}${String(Math.max(1, range.end)).padStart(serialDigits, '0')}`;
                  return (
                    <div
                      key={cat}
                      className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-slate-900 dark:text-white">
                          {CATEGORIES[cat].nameBn} ({cat})
                        </span>
                        <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                          {validCount > 0 ? `${firstId} – ${lastId} (${validCount}টি)` : '০টি'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9.5px] font-semibold text-gray-600 dark:text-gray-400">
                            শুরু (Start)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={range.start}
                            onChange={e => handleUpdateRange(cat, 'start', e.target.value)}
                            className="w-full px-2 py-1 border rounded-md dark:bg-slate-900 dark:border-slate-700 font-mono text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9.5px] font-semibold text-gray-600 dark:text-gray-400">
                            শেষ নম্বর (Last Number)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={range.end}
                            onChange={e => handleUpdateRange(cat, 'end', e.target.value)}
                            className="w-full px-2 py-1 border rounded-md dark:bg-slate-900 dark:border-slate-700 font-mono text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Responsive Fit Bar */}
      <div className="print:hidden p-3 bg-amber-50 dark:bg-slate-800 border border-amber-300 dark:border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
          <Smartphone className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>মোবাইল ফিট ভিউ:</strong> মোবাইলে স্ক্রিনের সাথে মানানসই করতে জুম নিয়ন্ত্রণ করুন (প্রিন্টে ১০০% A4 আসবে)।
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScale(prev => Math.max(0.4, prev - 0.1))}
            className="p-1.5 border rounded-lg hover:bg-white dark:hover:bg-slate-700"
            title="জুম আউট"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(prev => Math.min(1.2, prev + 0.1))}
            className="p-1.5 border rounded-lg hover:bg-white dark:hover:bg-slate-700"
            title="জুম ইন"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale(1)}
            className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-lg text-[10px] font-bold"
          >
            রিসেট
          </button>
        </div>
      </div>

      {/* Preview Section — Completely Borderless & Backgroundless During Print */}
      <div className="bg-gray-200 dark:bg-slate-900/80 p-3 sm:p-5 rounded-2xl border border-gray-300 dark:border-slate-800 space-y-4 overflow-hidden print:bg-transparent print:p-0 print:m-0 print:border-0 print:rounded-none print:shadow-none print:overflow-visible print:space-y-0">
        
        {/* Notice for preview & batch loading */}
        <div className="print:hidden text-center text-xs text-gray-800 dark:text-gray-200 flex flex-wrap items-center justify-center gap-2 font-semibold">
          <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            {formMode === 'school' ? 'স্কুলভিত্তিক' : 'ক্যাটাগরিভিত্তিক'} প্রিভিউ ও প্রিন্টের জন্য লোডকৃত:{' '}
            {toBengaliDigits(Math.min(previewLimit, activeTotalCount))} / {toBengaliDigits(activeTotalCount)} টি ফরম
            {isGeneratingQr ? ' (QR তৈরি হচ্ছে...)' : ''}
          </span>
          {activeTotalCount > previewLimit && (
            <>
              {activeTotalCount - previewLimit > 50 && (
                <button
                  type="button"
                  onClick={() => setPreviewLimit(prev => Math.min(activeTotalCount, prev + 50))}
                  className="px-2.5 py-0.5 bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-md font-bold hover:bg-indigo-50"
                >
                  +৫০টি লোড করুন
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewLimit(activeTotalCount)}
                className="px-2.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold"
              >
                সবগুলো লোড করুন ({toBengaliDigits(activeTotalCount)} পাতা)
              </button>
            </>
          )}
          {previewLimit > 5 && activeTotalCount > 5 && (
            <button
              type="button"
              onClick={() => setPreviewLimit(5)}
              className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 rounded-md text-[10px]"
            >
              ৫টিতে নামান
            </button>
          )}
        </div>

        {/* Scrollable / Scaled Preview Wrapper for Full Mobile Responsiveness */}
        <div className="overflow-x-auto w-full flex justify-center py-2 print:p-0 print:m-0 print:overflow-visible print:block">
          <div 
            style={{ 
              transform: `scale(${scale})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease'
            }}
            className="print-scale-reset print-container flex flex-col items-center gap-8 print:gap-0"
          >
            
            {formMode === 'school' && (
              <>
                {/* 1. Cover Sheet */}
                {includeCover && selectedSchool && schoolVenue && (
                  <div className="a4-sheet-wrapper print:block">
                    <BundleCoverSheet
                      school={selectedSchool}
                      venue={schoolVenue}
                      settings={settings}
                      blocks={blocks}
                      teacherPortalUrl={`${window.location.origin}/#teacher`}
                      qrDataUrl={teacherPortalQr}
                    />
                  </div>
                )}

                {/* 2. Printed Forms */}
                {includeForms && selectedSchool && schoolVenue && (
                  activeBatch.map(form => (
                    <div key={form.id} className="a4-sheet-wrapper print:block">
                      <PrintedFormSheet
                        registrationId={form.id}
                        category={form.category}
                        schoolName={selectedSchool.name}
                        venue={schoolVenue}
                        settings={settings}
                        qrDataUrl={qrMap[form.id] || ''}
                      />
                    </div>
                  ))
                )}
              </>
            )}

            {formMode === 'category' && (
              activeBatch.map(form => (
                <div key={form.id} className="a4-sheet-wrapper print:block">
                  <PrintedFormSheet
                    registrationId={form.id}
                    category={form.category}
                    schoolName={manualSchoolName.trim()}
                    venue={manualVenue}
                    settings={settings}
                    qrDataUrl={qrMap[form.id] || ''}
                    isCategoryMode={true}
                  />
                </div>
              ))
            )}

          </div>
        </div>

      </div>

    </div>
  );
};
