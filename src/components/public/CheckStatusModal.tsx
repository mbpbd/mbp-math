import React, { useState } from 'react';
import {
  ContestSettings,
  NumberBlock,
  OnlineApplication,
  QUESTION_MEDIUM_LABELS,
  Student,
  Venue,
  CATEGORIES,
  getSyllabusParagraphs
} from '../../types';
import { parseRegistrationId, toBengaliDigits } from '../../services/idSystem';
import { getRegistrationQrDataUrl } from '../../services/qrGenerator';
import { normalizeBdMobile, sendApprovalSms } from '../../services/smsService';
import { SeatAssignment, SeatPlanResult } from '../../services/seatPlanAlgorithm';
import { downloadAdmitCardAsPdf } from '../../services/pdfExport';
import { Search, Download, CheckCircle2, Clock, XCircle, AlertCircle, X, RotateCcw } from 'lucide-react';
import { getPreferredExamVenueId } from '../../services/defaultData';

interface CheckStatusModalProps {
  students: Student[];
  applications: OnlineApplication[];
  markedSchoolIds: Set<string>;
  blocks: NumberBlock[];
  venues: Venue[];
  seatPlans?: SeatPlanResult[];
  settings: ContestSettings;
  initialRegId?: string;
  onOpenOnlineRegistration?: () => void;
  onClose: () => void;
}

interface ResolvedSeatInfo {
  venueName: string;
  roomName?: string;
  seatLabel?: string;
  hasAssignedSeat: boolean;
}

function resolveStudentSeatAndVenue(
  student: Student,
  seatPlans: SeatPlanResult[],
  venues: Venue[]
): ResolvedSeatInfo {
  let matchedAssignment: SeatAssignment | undefined;
  for (const plan of seatPlans) {
    const found = plan.assignments?.find(a => a.studentId === student.id);
    if (found) {
      matchedAssignment = found;
      break;
    }
  }

  const rawVenueId = matchedAssignment?.venueId || student.seatVenueId || student.venueId;
  const hasExplicitSeatVenue = Boolean(matchedAssignment?.venueId || student.seatVenueId);
  const resolvedVenueId =
    !hasExplicitSeatVenue && rawVenueId === 'V01' && venues.some(v => v.id === 'V02')
      ? getPreferredExamVenueId(venues)
      : rawVenueId;
  const venueObj =
    venues.find(v => v.id === resolvedVenueId) ||
    venues.find(v => v.id === getPreferredExamVenueId(venues)) ||
    venues[0];
  const venueName =
    matchedAssignment?.venueName ||
    student.seatVenueName ||
    venueObj?.name ||
    'দয়াময় সিংহ উচ্চ বিদ্যালয়';

  const roomName = matchedAssignment?.roomName || student.seatRoomName;
  const column = matchedAssignment?.column || student.seatColumn;
  const row = matchedAssignment?.row ?? student.seatRow;
  const position = matchedAssignment?.position ?? student.seatPosition;

  if (roomName && row !== undefined && position !== undefined) {
    const colLabel = column === 'right' ? 'ডান' : 'বাম';
    return {
      venueName,
      roomName,
      seatLabel: `${roomName}, ${colLabel} বেঞ্চ-${toBengaliDigits(row)} (আসন-${toBengaliDigits(position)})`,
      hasAssignedSeat: true
    };
  }

  if (roomName) {
    return {
      venueName,
      roomName,
      seatLabel: roomName,
      hasAssignedSeat: true
    };
  }

  return {
    venueName,
    hasAssignedSeat: false
  };
}

export const CheckStatusModal: React.FC<CheckStatusModalProps> = ({
  students,
  applications,
  markedSchoolIds,
  blocks,
  venues,
  seatPlans = [],
  settings,
  initialRegId = '',
  onOpenOnlineRegistration,
  onClose
}) => {
  const [regId, setRegId] = useState(initialRegId);
  const [mobile, setMobile] = useState('');
  const [hasSearched, setHasSearched] = useState(!!initialRegId);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotFeedback, setForgotFeedback] = useState<string | null>(null);

  // Admit Card preview state
  const [showAdmitCard, setShowAdmitCard] = useState<Student | null>(null);
  const [admitQrUrl, setAdmitQrUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Result categories
  type ResultType =
    | { type: 'VERIFIED_STUDENT'; student: Student; seatInfo: ResolvedSeatInfo }
    | { type: 'TEACHER_MARKED_ONLY'; schoolName: string; venueName: string }
    | { type: 'ONLINE_PENDING'; app: OnlineApplication }
    | { type: 'ONLINE_REJECTED'; app: OnlineApplication }
    | { type: 'NOT_FOUND' };

  const resolveLookup = (rawId: string, rawPhone: string): ResultType => {
    const cleanId = rawId.trim();
    const cleanPhone = rawPhone.trim();
    const normalizedInputPhone = cleanPhone ? normalizeBdMobile(cleanPhone) : '';

    if (!cleanId && !cleanPhone) {
      return { type: 'NOT_FOUND' };
    }

    const phoneMatches = (candidatePhone?: string) => {
      if (!normalizedInputPhone || !candidatePhone) return false;
      const normCandidate = normalizeBdMobile(candidatePhone);
      return (
        normCandidate === normalizedInputPhone ||
        candidatePhone.trim() === cleanPhone
      );
    };

    // 1. Check verified students FIRST (so reused IDs resolve to the active verified participant)
    const matchedStudent = students.find(s => {
      const matchId = Boolean(cleanId && s.id === cleanId);
      const matchPhone = phoneMatches(s.mobile);
      if (cleanId && cleanPhone) return matchId && matchPhone;
      return matchId || matchPhone;
    });

    if (matchedStudent) {
      return {
        type: 'VERIFIED_STUDENT',
        student: matchedStudent,
        seatInfo: resolveStudentSeatAndVenue(matchedStudent, seatPlans, venues)
      };
    }

    // 2. Check ACTIVE applications (pending or verified)
    const matchesApp = (a: OnlineApplication) => {
      const matchId = Boolean(
        cleanId &&
          (a.assignedId === cleanId ||
            a.id === cleanId ||
            a.txnId?.toUpperCase() === cleanId.toUpperCase())
      );
      const matchPhone = phoneMatches(a.mobile) || phoneMatches(a.payerMobile);
      if (cleanId && cleanPhone) return matchId && matchPhone;
      return matchId || matchPhone;
    };

    const activeApp = applications.find(
      a => (a.status === 'pending' || a.status === 'verified') && matchesApp(a)
    );

    if (activeApp) {
      if (activeApp.status === 'pending') {
        return { type: 'ONLINE_PENDING', app: activeApp };
      }
      if (activeApp.status === 'verified') {
        const student = students.find(
          s =>
            s.id === (activeApp.assignedId || cleanId) ||
            phoneMatches(s.mobile)
        );
        if (student) {
          return {
            type: 'VERIFIED_STUDENT',
            student,
            seatInfo: resolveStudentSeatAndVenue(student, seatPlans, venues)
          };
        }
      }
    }

    // 3. Check REJECTED applications (matched by TrxID, phone, or un-reassigned ID)
    const rejectedApp = applications.find(
      a => a.status === 'rejected' && matchesApp(a)
    );
    if (rejectedApp) {
      return { type: 'ONLINE_REJECTED', app: rejectedApp };
    }

    // 4. Check if ID was marked by teacher (paper forms)
    if (cleanId && markedSchoolIds.has(cleanId)) {
      const parsed = parseRegistrationId(cleanId, settings.yearCode, settings.serialDigits);
      if (parsed.valid && parsed.category && parsed.serial) {
        const block = blocks.find(
          b =>
            b.category === parsed.category &&
            parsed.serial! >= b.firstSerial &&
            parsed.serial! <= b.lastSerial
        );
        if (block) {
          const v02 = venues.find(v => v.id === getPreferredExamVenueId(venues));
          const resolvedVenueName =
            block.venueId === 'V01' && v02
              ? v02.name
              : block.venueName || v02?.name || 'দয়াময় সিংহ উচ্চ বিদ্যালয়';
          return {
            type: 'TEACHER_MARKED_ONLY',
            schoolName: block.schoolName || 'বিদ্যালয়',
            venueName: resolvedVenueName
          };
        }
      }
    }

    return { type: 'NOT_FOUND' };
  };

  const [lookupResult, setLookupResult] = useState<ResultType | null>(() => {
    if (!initialRegId) return null;
    return resolveLookup(initialRegId, '');
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setLookupResult(resolveLookup(regId, mobile));
  };

  const handleOpenAdmit = async (student: Student) => {
    setPdfError(null);
    const qr = await getRegistrationQrDataUrl(student.id);
    setAdmitQrUrl(qr);
    setShowAdmitCard(student);
  };

  const handleDownloadAdmitPdf = async () => {
    if (!showAdmitCard || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    setPdfError(null);
    try {
      const ok = await downloadAdmitCardAsPdf(
        'admit-card-printable-box',
        `Admit_Card_${showAdmitCard.id}.pdf`
      );
      if (!ok) {
        setPdfError('প্রবেশপত্র PDF তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleForgotId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizeBdMobile(forgotMobile);
    const student = students.find(s => normalizeBdMobile(s.mobile) === cleanPhone);
    const app = applications.find(
      a => a.status !== 'rejected' && normalizeBdMobile(a.mobile) === cleanPhone && a.assignedId
    );

    const targetId = student?.id || app?.assignedId;
    if (!targetId) {
      setForgotFeedback('এই নম্বরের সাথে কোনো নিশ্চিত বা সক্রিয় রেজিস্ট্রেশন পাওয়া যায়নি।');
      return;
    }

    setForgotFeedback('SMS পাঠানো হচ্ছে...');
    const smsRes = await sendApprovalSms({
      to: cleanPhone,
      message: `${settings.contestNameBn}: আপনার রেজিস্ট্রেশন নম্বর ${targetId}। ওয়েব পোর্টালে এই নম্বর দিয়ে প্রবেশপত্র ডাউনলোড করুন। - ${settings.organiserBn}`,
      registrationId: targetId
    });

    if (smsRes.sent) {
      setForgotFeedback(`আপনার মোবাইল নম্বরে (${cleanPhone}) রেজিস্ট্রেশন নম্বরটি SMS এর মাধ্যমে পাঠানো হয়েছে।`);
    } else if (!smsRes.configured) {
      setForgotFeedback(`আপনার রেজিস্ট্রেশন নম্বর: ${targetId} (সার্ভার SMS গেটওয়ে কনফিগার করা নেই; এই নম্বর দিয়ে উপরে যাচাই করুন)।`);
    } else {
      setForgotFeedback(`আপনার রেজিস্ট্রেশন নম্বর: ${targetId} (SMS পাঠানো যায়নি: ${smsRes.error || 'গেটওয়ে ত্রুটি'})।`);
    }
  };

  const admitSeatInfo = showAdmitCard
    ? resolveStudentSeatAndVenue(showAdmitCard, seatPlans, venues)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col text-xs font-['Hind_Siliguri',sans-serif]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-indigo-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              রেজিস্ট্রেশন যাচাই ও প্রবেশপত্র (Status Check & Admit Card)
            </h2>
            <p className="text-indigo-200 text-xs">
              রেজিস্ট্রেশন নম্বর, মোবাইল নম্বর অথবা TrxID দিয়ে আপনার তথ্য, কেন্দ্র ও আসন নম্বর যাচাই করুন
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-300 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Form */}
        <div className="p-5 space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  রেজিস্ট্রেশন নম্বর (৭ ডিজিট) / TrxID
                </label>
                <input
                  type="text"
                  value={regId}
                  onChange={e => setRegId(e.target.value)}
                  placeholder="যেমন: 2601001"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={() => setIsForgotOpen(!isForgotOpen)}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                রেজিস্ট্রেশন নম্বর ভুলে গেছেন?
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md transition"
              >
                <Search className="w-4 h-4" />
                <span>যাচাই করুন</span>
              </button>
            </div>
          </form>

          {/* Forgot Registration Number Box */}
          {isForgotOpen && (
            <form onSubmit={handleForgotId} className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 rounded-xl space-y-2">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 block text-xs">
                রেজিস্ট্রেশন নম্বর পুনরুদ্ধার (SMS এ পাঠানো হবে)
              </span>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  value={forgotMobile}
                  onChange={e => setForgotMobile(e.target.value)}
                  placeholder="রেজিস্ট্রিকৃত মোবাইল নম্বর"
                  className="flex-1 px-3 py-1.5 border rounded-lg dark:bg-slate-800 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                >
                  SMS পাঠান
                </button>
              </div>
              {forgotFeedback && (
                <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  {forgotFeedback}
                </p>
              )}
            </form>
          )}

          {/* Results Display */}
          {hasSearched && lookupResult && (
            <div className="pt-3 border-t border-gray-200 dark:border-slate-800">
              {/* 1. Verified Student Match */}
              {lookupResult.type === 'VERIFIED_STUDENT' && (() => {
                const liveSeatInfo = resolveStudentSeatAndVenue(lookupResult.student, seatPlans, venues);
                return (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                        নিবন্ধিত (Verified Contestant)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-xs px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 rounded">
                      ID: {lookupResult.student.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div>
                      <span className="font-semibold text-gray-500 block text-[10px]">শিক্ষার্থীর নাম:</span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        {lookupResult.student.nameBn} ({lookupResult.student.nameEn})
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 block text-[10px]">শ্রেণি, ক্যাটাগরি ও প্রশ্নের ধরন:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        শ্রেণি {toBengaliDigits(lookupResult.student.class)} · {CATEGORIES[lookupResult.student.category].nameBn} ·{' '}
                        {QUESTION_MEDIUM_LABELS[lookupResult.student.questionMedium === 'english' ? 'english' : 'bangla'].bn}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 block text-[10px]">বিদ্যালয়:</span>
                      <span className="font-semibold">{lookupResult.student.schoolName}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 block text-[10px]">প্রকৃত পরীক্ষার ভেন্যু (Seat Venue):</span>
                      <span className="font-bold text-indigo-800 dark:text-indigo-300">
                        {liveSeatInfo.venueName}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-gray-700 dark:text-gray-300 space-y-1">
                    <div>
                      <strong>তারিখ ও সময়:</strong> {settings.quizDateTextBn}, {settings.quizTimeTextBn}
                    </div>
                    <div>
                      <strong>কক্ষ ও আসন নম্বর:</strong>{' '}
                      {settings.seatPlanPublished ? (
                        liveSeatInfo.hasAssignedSeat ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-300">
                            {liveSeatInfo.seatLabel}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">
                            আসন শীঘ্রই নির্ধারিত হবে
                          </span>
                        )
                      ) : (
                        <span className="text-gray-500">
                          আসন বিন্যাস প্রকাশের পর প্রদর্শিত হবে
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAdmit(lookupResult.student)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>প্রবেশপত্র ডাউনলোড / দেখুন (Admit Card)</span>
                  </button>
                </div>
                );
              })()}

              {/* 2. School Marked Only */}
              {lookupResult.type === 'TEACHER_MARKED_ONLY' && (
                <div className="p-4 bg-sky-50 dark:bg-sky-950/40 border border-sky-300 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-sky-600" />
                    <span className="font-bold text-sm text-sky-900 dark:text-sky-200">
                      নিবন্ধিত (শিক্ষক কর্তৃক জমাকৃত ফরম)
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">
                    বিদ্যালয়: <strong>{lookupResult.schoolName}</strong> | ভেন্যু: <strong>{lookupResult.venueName}</strong>
                  </p>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-sky-200 text-gray-600 dark:text-gray-400 text-[11px]">
                    ℹ️ শিক্ষক আপনাকে যে মূল প্রবেশপত্রটি দিয়েছেন সেটি কার্যকর। স্কুল থেকে ফর্ম সংগ্রহ ও ডাটা এন্ট্রি সম্পন্ন হলে অনলাইনে পূর্ণাঙ্গ প্রবেশপত্র ও প্রকৃত কক্ষ/আসন পাওয়া যাবে।
                  </div>
                </div>
              )}

              {/* 3. Online Pending */}
              {lookupResult.type === 'ONLINE_PENDING' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                      <span className="font-bold text-sm text-amber-900 dark:text-amber-200">
                        পেমেন্ট যাচাই অপেক্ষমান (Pending Verification)
                      </span>
                    </div>
                    {lookupResult.app.assignedId && (
                      <span className="font-mono font-bold text-xs px-2.5 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded-lg border border-amber-300 dark:border-amber-700">
                        বরাদ্দকৃত ID: {lookupResult.app.assignedId}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">শিক্ষার্থীর নাম:</span>
                      <strong className="text-gray-900 dark:text-white">
                        {lookupResult.app.nameBn} ({lookupResult.app.nameEn})
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ক্যাটাগরি ও শ্রেণি:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {CATEGORIES[lookupResult.app.category]?.nameBn} (শ্রেণি {lookupResult.app.class})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">বিদ্যালয়:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {lookupResult.app.schoolName}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-gray-500 font-sans">bKash TrxID:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {lookupResult.app.txnId || 'Screenshot Attached'}
                      </strong>
                    </div>
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
                    আপনার অনলাইন আবেদনটি সফলভাবে গৃহীত হয়েছে। অ্যাডমিন bKash ট্রানজ্যাকশন আইডি ভেরিফাই করে অনুমোদন সম্পন্ন করলে এই আইডি দিয়ে প্রবেশপত্র (Admit Card) প্রিন্ট ও ডাউনলোড করতে পারবেন।
                  </p>
                </div>
              )}

              {/* 4. Online Rejected */}
              {lookupResult.type === 'ONLINE_REJECTED' && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-400 dark:border-red-700 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <span className="font-extrabold text-sm text-red-900 dark:text-red-200">
                        আবেদন বাতিল / পেমেন্ট যাচাই ব্যর্থ (Application Rejected)
                      </span>
                    </div>
                    {lookupResult.app.txnId && (
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 rounded border border-red-300">
                        TrxID: {lookupResult.app.txnId}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">আবেদনকারীর নাম:</span>
                      <strong className="text-gray-900 dark:text-white">
                        {lookupResult.app.nameBn || lookupResult.app.nameEn}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">বিদ্যালয়:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {lookupResult.app.schoolName}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-red-100 dark:border-red-900/40 text-red-700 dark:text-red-300 font-bold">
                      বাতিলের কারণ: {lookupResult.app.reason || 'প্রদত্ত TrxID মেলেনি অথবা পেমেন্ট পাওয়া যায়নি'}
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                    সঠিক ট্রানজ্যাকশন আইডি (TrxID) ও পেমেন্ট তথ্যসহ অনুগ্রহ করে পুনরায় অনলাইন আবেদন করুন।
                    {lookupResult.app.assignedId && (
                      <>
                        {' '}পূর্ববর্তী বরাদ্দকৃত নম্বর (<span className="font-mono font-bold">{lookupResult.app.assignedId}</span>) নতুন আবেদনের জন্য উন্মুক্ত করা হয়েছে।
                      </>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-gray-600 dark:text-gray-400">
                      সহায়তার জন্য হেল্পলাইন: <strong className="font-mono">{settings.helplineNumbers}</strong>
                    </span>

                    {onOpenOnlineRegistration && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenOnlineRegistration();
                        }}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>পুনরায় অনলাইন আবেদন করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Not Found / Mismatch */}
              {lookupResult.type === 'NOT_FOUND' && (
                <div className="p-4 bg-gray-50 dark:bg-slate-800 border border-gray-300 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">তথ্য মিলছে না</h4>
                    <p className="text-gray-500 text-[11px]">
                      আপনার দেওয়া রেজিস্ট্রেশন নম্বর, TrxID অথবা মোবাইল নম্বর যাচাই করে পুনরায় চেষ্টা করুন।
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admit Card Modal View */}
          {showAdmitCard && admitSeatInfo && (
            <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white text-gray-900 rounded-2xl max-w-lg w-full p-5 shadow-2xl border flex flex-col space-y-3 text-xs">
                <div className="flex justify-between items-center pb-2 border-b">
                  <h3 className="font-bold text-base text-gray-900">
                    প্রবেশপত্র (Admit Card Preview)
                  </h3>
                  <button
                    onClick={() => setShowAdmitCard(null)}
                    className="text-gray-500 hover:text-gray-800"
                  >
                    ✕
                  </button>
                </div>

                {/* Admit Card Box */}
                <div
                  id="admit-card-printable-box"
                  className="border-2 border-gray-900 p-4 rounded-xl space-y-3 bg-gray-50 text-gray-900"
                >
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h4 className="font-bold text-base">{settings.contestNameBn}</h4>
                      <p className="text-[11px] text-gray-600">আয়োজনে: {settings.organiserBn}</p>
                    </div>
                    {admitQrUrl && (
                      <img src={admitQrUrl} alt="QR" className="w-16 h-16 border p-0.5 bg-white rounded" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 text-[10px] block">আইডি নম্বর:</span>
                      <span className="font-mono font-bold text-base text-indigo-700">{showAdmitCard.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">শ্রেণি ও প্রশ্নের ধরন:</span>
                      <span className="font-bold">
                        {showAdmitCard.class} ({CATEGORIES[showAdmitCard.category].nameBn}) ·{' '}
                        {QUESTION_MEDIUM_LABELS[showAdmitCard.questionMedium === 'english' ? 'english' : 'bangla'].bn}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500 text-[10px] block">নাম:</span>
                      <span className="font-bold text-sm">{showAdmitCard.nameBn} ({showAdmitCard.nameEn})</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">বিদ্যালয়:</span>
                      <span className="font-semibold">{showAdmitCard.schoolName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">তারিখ ও সময়:</span>
                      <span className="font-semibold text-red-600">{settings.quizDateTextBn}, {settings.quizTimeTextBn}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">পরীক্ষার কেন্দ্র (Venue):</span>
                      <span className="font-bold text-indigo-800">{admitSeatInfo.venueName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">কক্ষ ও আসন নম্বর:</span>
                      <span className="font-bold text-emerald-700">
                        {settings.seatPlanPublished
                          ? admitSeatInfo.hasAssignedSeat
                            ? admitSeatInfo.seatLabel
                            : 'আসন শীঘ্রই নির্ধারিত হবে'
                          : 'প্রকাশের অপেক্ষায়'}
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-300 rounded-lg overflow-hidden bg-white text-[10px]">
                    <div className="bg-gray-200 px-2 py-0.5 font-bold text-gray-900">
                      কুইজ সিলেবাস ({CATEGORIES[showAdmitCard.category].nameBn})
                    </div>
                    <div className="px-2 py-1 text-gray-800 leading-snug space-y-1">
                      {getSyllabusParagraphs(
                        settings.syllabuses?.[showAdmitCard.category] ||
                        `${CATEGORIES[showAdmitCard.category].syllabusBn}\n${CATEGORIES[showAdmitCard.category].syllabusEn}`
                      ).map((para, idx) => (
                        <p key={idx} className="m-0">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-[10px] text-yellow-900">
                    ⚠️ পরীক্ষা কেন্দ্রে প্রবেশের সময় এই প্রবেশপত্র সাথে রাখা বাধ্যতামূলক। ক্যালকুলেটর বা মোবাইল ফোন নিষিদ্ধ।
                  </div>
                </div>

                {pdfError && (
                  <p className="text-red-600 text-[11px] font-semibold m-0">
                    {pdfError}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadAdmitPdf}
                    disabled={isDownloadingPdf}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isDownloadingPdf
                        ? 'PDF ডাউনলোড হচ্ছে...'
                        : 'প্রবেশপত্র ডাউনলোড করুন (Download Admit Card PDF)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
