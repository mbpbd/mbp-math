import React, { useState } from 'react';
import { ContestSettings, Student, CATEGORIES } from '../../types';
import { computeAllRankings, StudentResult, getEnglishSchoolName, getEnglishPositionText } from '../../services/resultsService';
import { toBengaliDigits } from '../../services/idSystem';
import { getRegistrationQrDataUrl } from '../../services/qrGenerator';
import { downloadCertificateAsPdf } from '../../services/pdfExport';
import { 
  Trophy, 
  Search, 
  Download, 
  Printer, 
  CheckCircle2, 
  Award, 
  X, 
  AlertCircle, 
  Lock, 
  Sparkles,
  School as SchoolIcon,
  Medal
} from 'lucide-react';

interface PublicResultsModalProps {
  students: Student[];
  settings: ContestSettings;
  onClose: () => void;
}

export const PublicResultsModal: React.FC<PublicResultsModalProps> = ({
  students,
  settings,
  onClose
}) => {
  const [regId, setRegId] = useState('');
  const [mobile, setMobile] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [matchedResult, setMatchedResult] = useState<StudentResult | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Certificate modal inside result view
  const [showCertificate, setShowCertificate] = useState(false);
  const [certQrUrl, setCertQrUrl] = useState<string>('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setErrorMessage(null);
    setMatchedResult(null);
    setMatchedStudent(null);

    const cleanId = regId.trim();
    const cleanPhone = mobile.trim();

    if (!cleanId || !cleanPhone) {
      setErrorMessage('রেজিস্ট্রেশন নম্বর এবং মোবাইল নম্বর উভয়ই প্রদান করতে হবে।');
      return;
    }

    if (!settings.resultsPublished) {
      setErrorMessage('ফলাফল এখনও প্রকাশিত হয়নি। অ্যাডমিন ফলাফল প্রকাশ করার পর এখানে উন্মুক্ত হবে।');
      return;
    }

    const student = students.find(s => s.id === cleanId && s.mobile === cleanPhone);
    if (!student) {
      setErrorMessage('প্রদত্ত রেজিস্ট্রেশন নম্বর অথবা মোবাইল নম্বরের সাথে কোনো রেকর্ড মেলেনি। তথ্য যাচাই করে পুনরায় চেষ্টা করুন।');
      return;
    }

    const allRankings = computeAllRankings(students, 3);
    const result = allRankings.get(student.id);

    if (result) {
      setMatchedResult(result);
      setMatchedStudent(student);

      const verifyPayload = `${window.location.origin}/#verify-${result.certNo || result.studentId}`;
      const qr = await getRegistrationQrDataUrl(verifyPayload);
      setCertQrUrl(qr);
    } else {
      setErrorMessage('ফলাফল লোড করা সম্ভব হয়নি।');
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadCertificate = async () => {
    if (!matchedResult) return;
    const fileName = `MBP_Certificate_${matchedResult.studentId}_${matchedResult.studentNameEn.replace(/\s+/g, '_')}`;
    setIsExportingPdf(true);
    try {
      await downloadCertificateAsPdf('public-certificate-render', fileName);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const rawSignatories = settings.signatories?.length === 3 ? settings.signatories : [
    { name: 'Brojendro Kumar Singha', title: 'Director General', post: 'Director General, MBP' },
    { name: 'Kiran Singha', title: 'Exam Controller', post: 'Exam Controller, MBP' },
    { name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' }
  ];
  const signatories = rawSignatories.map(s => 
    s.name.includes('Swarup') ? { ...s, name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' } : s
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-['Hind_Siliguri',sans-serif]">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col text-xs">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex justify-between items-center shadow">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                ব্যক্তিগত ফলাফল ও সনদ (Individual Result & Certificate)
              </h2>
              <p className="text-amber-100 text-[11px]">
                রেজিস্ট্রেশন নম্বর ও মোবাইল নম্বর দিয়ে আপনার প্রাপ্ত নম্বর ও স্থান জানুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5">
          
          {/* Status indicator banner if locked */}
          {!settings.resultsPublished && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 rounded-2xl flex items-center gap-3">
              <Lock className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">ফলাফল এখনও লকড আছে</h4>
                <p className="text-slate-700 dark:text-gray-300 text-xs mt-0.5">
                  প্রতিযোগিতার উত্তরপত্র মূল্যায়ন শেষে কেন্দ্রীয়ভাবে ফলাফল উন্মুক্ত করা হবে। অনুগ্রহ করে অপেক্ষা করুন।
                </p>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  রেজিস্ট্রেশন নম্বর (৭ ডিজিট) *
                </label>
                <input
                  type="text"
                  required
                  value={regId}
                  onChange={e => setRegId(e.target.value)}
                  placeholder="যেমন: 2601001"
                  className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 font-mono font-extrabold text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                  মোবাইল নম্বর *
                </label>
                <input
                  type="tel"
                  required
                  inputMode="numeric"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="রেজিস্ট্রিকৃত মোবাইল নম্বর"
                  className="w-full px-3 py-2.5 border rounded-xl dark:bg-slate-800 font-mono text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white rounded-xl font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>ফলাফল অনুসন্ধান করুন</span>
            </button>
          </form>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold text-xs">{errorMessage}</span>
            </div>
          )}

          {/* Result Card when Found */}
          {hasSearched && matchedResult && matchedStudent && (
            <div className="space-y-4 animate-fade-in pt-2 border-t border-slate-200 dark:border-slate-800">
              
              {/* Absent Warning */}
              {!matchedResult.attendance ? (
                <div className="p-4 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-center space-y-1">
                  <span className="font-extrabold text-base text-slate-800 dark:text-slate-200 block">
                    {matchedResult.studentNameBn} ({matchedResult.studentId})
                  </span>
                  <p className="text-red-600 font-bold text-sm">
                    ❌ শিক্ষার্থী কুইজ পরীক্ষায় অনুপস্থিত ছিলেন।
                  </p>
                  <p className="text-slate-500 text-xs">
                    পরীক্ষায় অংশগ্রহণ না করায় কোনো নম্বর বা স্থান বরাদ্দ করা হয়নি।
                  </p>
                </div>
              ) : (
                /* Attended Result Display */
                <div className="space-y-4">
                  
                  {/* Winner / Placement Badge Card */}
                  <div className={`p-5 rounded-2xl border-2 shadow-md relative overflow-hidden ${
                    matchedResult.classRank === 1
                      ? 'bg-gradient-to-br from-amber-400 via-amber-300 to-yellow-200 border-amber-500 text-slate-950'
                      : matchedResult.classRank === 2
                        ? 'bg-gradient-to-br from-slate-200 via-slate-100 to-gray-200 border-slate-400 text-slate-950'
                        : matchedResult.classRank === 3
                          ? 'bg-gradient-to-br from-orange-200 via-amber-100 to-yellow-100 border-orange-400 text-slate-950'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                  }`}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 block">
                          অভিনন্দন! আপনার পরীক্ষার ফলাফল
                        </span>
                        <h3 className="text-xl font-black mt-0.5 leading-tight">
                          {matchedResult.studentNameBn}
                        </h3>
                        <p className="text-xs font-bold opacity-80 uppercase tracking-wide">
                          {matchedResult.studentNameEn}
                        </p>
                      </div>

                      {matchedResult.isClassWinner ? (
                        <div className="px-3 py-1.5 bg-slate-950 text-amber-300 rounded-xl font-black text-xs shadow flex items-center gap-1.5 shrink-0">
                          <Medal className="w-4 h-4 text-amber-400" />
                          <span>{matchedResult.classPositionTextBn}</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 rounded-xl font-bold text-xs shrink-0">
                          {matchedResult.awardTextBn}
                        </div>
                      )}
                    </div>

                    {/* Marks & Placement Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                      
                      {/* 1. Marks */}
                      <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-black/10 dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold opacity-75 block">প্রাপ্ত নম্বর</span>
                        <span className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-400">
                          {toBengaliDigits(matchedResult.marks || 0)} <span className="text-xs font-normal opacity-75">/ ১০০</span>
                        </span>
                      </div>

                      {/* 2. Class Rank */}
                      <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-black/10 dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold opacity-75 block">শ্রেণিভিত্তিক স্থান</span>
                        <span className="text-base font-extrabold text-slate-950 dark:text-white block mt-0.5">
                          {matchedResult.classPositionTextBn}
                        </span>
                        <span className="text-[10px] opacity-75">
                          (শ্রেণি {toBengaliDigits(matchedResult.studentClass)}-এ মোট {toBengaliDigits(matchedResult.classTotal || 0)} জনের মধ্যে)
                        </span>
                      </div>

                      {/* 3. Category Rank */}
                      <div className="p-3 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-black/10 dark:border-white/10 text-center">
                        <span className="text-[10px] font-bold opacity-75 block">ক্যাটাগরি স্থান</span>
                        <span className="text-base font-extrabold text-slate-950 dark:text-white block mt-0.5">
                          {toBengaliDigits(matchedResult.categoryRank || 0)}ম স্থান
                        </span>
                        <span className="text-[10px] opacity-75">
                          (সার্বিক {toBengaliDigits(matchedResult.categoryTotal || 0)} জনের মধ্যে)
                        </span>
                      </div>

                    </div>

                    {/* School & Venue Details */}
                    <div className="mt-3 text-[11px] opacity-90 space-y-0.5">
                      <p><strong>আইডি নম্বর:</strong> <span className="font-mono font-bold">{matchedResult.studentId}</span></p>
                      <p><strong>বিদ্যালয়:</strong> {matchedResult.schoolName}</p>
                      <p><strong>ক্যাটাগরি:</strong> {CATEGORIES[matchedResult.category].nameBn} (শ্রেণি {toBengaliDigits(matchedResult.studentClass)})</p>
                    </div>

                  </div>

                  {/* Certificate Download Action */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCertificate(true)}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition"
                    >
                      <Award className="w-4 h-4 text-amber-300" />
                      <span>ইংরেজি সনদপত্র দেখুন ও ডাউনলোড করুন (Certificate)</span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* English Certificate Full Modal Preview & Download */}
      {showCertificate && matchedResult && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white text-gray-900 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center pb-2 border-b print:hidden font-sans">
              <h3 className="font-bold text-base text-gray-800">
                Official English Certificate Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCertificate}
                  disabled={isExportingPdf}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingPdf ? 'PDF তৈরি হচ্ছে...' : 'ডাউনলোড করুন (PDF)'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setShowCertificate(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-800 text-lg font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Certificate Canvas */}
            <div 
              id="public-certificate-render"
              className="bg-white border-8 border-double border-indigo-950 p-8 rounded-sm relative flex flex-col justify-between text-center min-h-[500px] font-serif shadow-inner"
            >
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
                  {matchedResult.isClassWinner ? 'Certificate of Achievement' : 'Certificate of Merit'}
                </h2>
                <p className="text-xs italic text-gray-500 mt-0.5">
                  Held on 26 December 2026
                </p>
              </div>

              <div className="my-6 space-y-3 font-sans">
                <p className="text-sm italic text-gray-600">
                  This certificate is proudly awarded to
                </p>
                <h1 className="text-3xl font-extrabold text-indigo-950 uppercase tracking-wide underline decoration-amber-500 decoration-2 underline-offset-8">
                  {matchedResult.studentNameEn}
                </h1>
                <p className="text-sm text-gray-700 max-w-2xl mx-auto leading-relaxed">
                  Student of Class {matchedResult.studentClass}, <strong>{matchedResult.schoolNameEn || getEnglishSchoolName(matchedResult.schoolName)}</strong>, for outstanding performance securing <strong className="text-red-600 font-extrabold">{matchedResult.classPositionTextEn || getEnglishPositionText(matchedResult)}</strong> in Class {matchedResult.studentClass} ({CATEGORIES[matchedResult.category].nameEn} Category) of the Annual Math Quiz Contest 2026.
                </p>
              </div>

              {/* Signatures & QR */}
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

                <div className="text-center">
                  {certQrUrl && (
                    <img 
                      src={certQrUrl} 
                      alt="Verify QR" 
                      className="w-14 h-14 border mx-auto p-0.5 object-contain" 
                    />
                  )}
                  <span className="font-mono text-[9px] text-gray-500 block mt-1">
                    Verify: {matchedResult.certNo || matchedResult.studentId}
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
