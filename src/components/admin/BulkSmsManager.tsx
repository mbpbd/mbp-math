import React, { useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  CategoryCode,
  ContestSettings,
  OnlineApplication,
  Student,
  Venue
} from '../../types';
import { SeatPlanResult } from '../../services/seatPlanAlgorithm';
import { auth } from '../../config/firebase';
import { getPreferredExamVenueId } from '../../services/defaultData';
import { toBengaliDigits } from '../../services/idSystem';
import {
  applySmsTemplatePlaceholders,
  buildBatchSmsAnchorHref,
  buildSmsAnchorHref,
  DEFAULT_PUBLIC_PORTAL_URL,
  estimateSmsParts,
  normalizeBdMobile,
  sendApprovalSms
} from '../../services/smsService';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Filter,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  StopCircle,
  Users,
  XCircle
} from 'lucide-react';

interface BulkSmsManagerProps {
  students: Student[];
  applications: OnlineApplication[];
  venues: Venue[];
  seatPlans: SeatPlanResult[];
  settings: ContestSettings;
  serverSmsConfigured: boolean;
  onNotify?: (message: string) => void;
}

type AudienceScope = 'verified_students' | 'verified_online' | 'pending_online' | 'all_active';

interface ResolvedRecipient {
  key: string;
  id: string;
  name: string;
  smsName: string;
  schoolName: string;
  category: CategoryCode;
  venueId: string;
  rawMobile: string;
  normalizedMobile: string;
  isValidMobile: boolean;
  sourceLabel: string;
}

type DeliveryStatus = 'idle' | 'sending' | 'sent' | 'failed';

function formatShortQuizDateEn(iso?: string): string {
  try {
    if (iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        const dayMonth = new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'Asia/Dhaka'
        }).format(d);
        const timeStr = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Dhaka'
        }).format(d);
        return `${dayMonth}, ${timeStr}`;
      }
    }
  } catch {
    // fallback below
  }
  return '26 Dec, 10:30 AM';
}

function toAsciiSmsName(nameEn?: string): string {
  const cleaned = String(nameEn || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Participant';
  return cleaned.length <= 24 ? cleaned : `${cleaned.slice(0, 21).trimEnd()}...`;
}

export const BulkSmsManager: React.FC<BulkSmsManagerProps> = ({
  students,
  applications,
  venues,
  seatPlans,
  settings,
  serverSmsConfigured,
  onNotify
}) => {
  const [audienceScope, setAudienceScope] = useState<AudienceScope>('verified_students');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CategoryCode>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [deduplicatePhones, setDeduplicatePhones] = useState<boolean>(true);
  const [recipientSearch, setRecipientSearch] = useState<string>('');
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(() => new Set());

  const shortQuizDateEn = useMemo(
    () => formatShortQuizDateEn(settings.quizDateTime),
    [settings.quizDateTime]
  );

  const [messageTemplate, setMessageTemplate] = useState<string>(
    () =>
      `Dear {name}, Math Quiz 2026 is on ${formatShortQuizDateEn(settings.quizDateTime)}. Bring Admit Card (${DEFAULT_PUBLIC_PORTAL_URL}) 30m early. - MBP`
  );

  // Mode B (Phone SMS App) Controls
  const [batchSize, setBatchSize] = useState<number>(15);
  const [smsSeparator, setSmsSeparator] = useState<',' | ';'>(',');
  const [openedBatches, setOpenedBatches] = useState<Set<number>>(() => new Set());
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  // Mode A (Server Bulk SMS API) State
  const [confirmServerSend, setConfirmServerSend] = useState<boolean>(false);
  const [isSendingBulk, setIsSendingBulk] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    done: number;
    sent: number;
    failed: number;
  }>({ total: 0, done: 0, sent: 0, failed: 0 });
  const [deliveryMap, setDeliveryMap] = useState<
    Record<string, { status: DeliveryStatus; error?: string }>
  >({});
  const cancelSendRef = useRef<boolean>(false);

  const seatVenueByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of seatPlans) {
      for (const assignment of plan.assignments || []) {
        if (assignment.studentId && assignment.venueId) {
          map.set(assignment.studentId, assignment.venueId);
        }
      }
    }
    return map;
  }, [seatPlans]);

  const preferredVenueId = useMemo(() => getPreferredExamVenueId(venues), [venues]);

  const resolveEffectiveVenueId = (student: Student): string => {
    const seatVenue = seatVenueByStudentId.get(student.id) || student.seatVenueId;
    if (seatVenue) return seatVenue;
    if (student.venueId === 'V01' && venues.some(v => v.id === 'V02')) {
      return preferredVenueId;
    }
    return student.venueId || preferredVenueId;
  };

  // Build candidate pool based on selected audience
  const rawAudienceList = useMemo<ResolvedRecipient[]>(() => {
    const items: ResolvedRecipient[] = [];

    if (audienceScope === 'verified_students' || audienceScope === 'all_active') {
      for (const s of students) {
        const norm = normalizeBdMobile(s.mobile || '');
        items.push({
          key: `stu_${s.id}`,
          id: s.id,
          name: (s.nameBn || s.nameEn || 'Participant').trim(),
          smsName: toAsciiSmsName(s.nameEn),
          schoolName: s.schoolName || '',
          category: s.category,
          venueId: resolveEffectiveVenueId(s),
          rawMobile: s.mobile || '',
          normalizedMobile: norm,
          isValidMobile: /^01[3-9]\d{8}$/.test(norm),
          sourceLabel: s.source === 'online' ? 'অনলাইন নিবন্ধিত' : 'কাগজের ফরম'
        });
      }
    }

    if (audienceScope === 'verified_online') {
      for (const s of students) {
        if (s.source !== 'online') continue;
        const norm = normalizeBdMobile(s.mobile || '');
        items.push({
          key: `stu_${s.id}`,
          id: s.id,
          name: (s.nameBn || s.nameEn || 'Participant').trim(),
          smsName: toAsciiSmsName(s.nameEn),
          schoolName: s.schoolName || '',
          category: s.category,
          venueId: resolveEffectiveVenueId(s),
          rawMobile: s.mobile || '',
          normalizedMobile: norm,
          isValidMobile: /^01[3-9]\d{8}$/.test(norm),
          sourceLabel: 'অনলাইন নিবন্ধিত'
        });
      }
    }

    if (audienceScope === 'pending_online' || audienceScope === 'all_active') {
      for (const app of applications) {
        if (app.status !== 'pending') continue;
        const norm = normalizeBdMobile(app.mobile || '');
        items.push({
          key: `app_${app.id}`,
          id: app.assignedId || app.txnId || app.id.slice(0, 8),
          name: (app.nameBn || app.nameEn || 'Applicant').trim(),
          smsName: toAsciiSmsName(app.nameEn),
          schoolName: app.schoolName || '',
          category: app.category,
          venueId: preferredVenueId,
          rawMobile: app.mobile || '',
          normalizedMobile: norm,
          isValidMobile: /^01[3-9]\d{8}$/.test(norm),
          sourceLabel: 'পেমেন্ট অপেক্ষমান'
        });
      }
    }

    return items;
  }, [audienceScope, students, applications, seatVenueByStudentId, venues, preferredVenueId]);

  // Apply category, venue, search & deduplication filters
  const { validRecipients, invalidRecipients, duplicateSkippedCount } = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    const filtered = rawAudienceList.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (venueFilter !== 'all' && r.venueId !== venueFilter) return false;
      if (q) {
        const hay = `${r.name} ${r.id} ${r.schoolName} ${r.normalizedMobile} ${r.rawMobile}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const valid: ResolvedRecipient[] = [];
    const invalid: ResolvedRecipient[] = [];
    const seenPhones = new Set<string>();
    let dupSkipped = 0;

    for (const r of filtered) {
      if (!r.isValidMobile) {
        invalid.push(r);
        continue;
      }
      if (deduplicatePhones) {
        if (seenPhones.has(r.normalizedMobile)) {
          dupSkipped++;
          continue;
        }
        seenPhones.add(r.normalizedMobile);
      }
      valid.push(r);
    }

    return {
      validRecipients: valid,
      invalidRecipients: invalid,
      duplicateSkippedCount: dupSkipped
    };
  }, [rawAudienceList, categoryFilter, venueFilter, recipientSearch, deduplicatePhones]);

  const activeRecipients = useMemo(
    () => validRecipients.filter(r => !excludedKeys.has(r.key)),
    [validRecipients, excludedKeys]
  );

  const smsMetrics = useMemo(() => estimateSmsParts(messageTemplate.trim()), [messageTemplate]);

  // Generic message for Phone App multi-recipient batches ({name}/{id} fallback to generic ASCII)
  const genericBatchMessage = useMemo(() => {
    return applySmsTemplatePlaceholders(messageTemplate.trim(), {
      name: 'Participant',
      regId: '',
      contestNameEn: settings.contestNameEn,
      organiserEn: settings.organiserEn
    })
      .replace(/\s{2,}/g, ' ')
      .trim();
  }, [messageTemplate, settings.contestNameEn, settings.organiserEn]);

  // Split active recipients into Phone SMS App batches
  const phoneBatches = useMemo(() => {
    const size = Math.max(1, batchSize);
    const batches: Array<{
      index: number;
      recipients: ResolvedRecipient[];
      phones: string[];
      smsHref: string;
    }> = [];

    for (let i = 0; i < activeRecipients.length; i += size) {
      const slice = activeRecipients.slice(i, i + size);
      const phones = slice.map(r => r.normalizedMobile);
      batches.push({
        index: batches.length,
        recipients: slice,
        phones,
        smsHref: buildBatchSmsAnchorHref(phones, genericBatchMessage, smsSeparator)
      });
    }
    return batches;
  }, [activeRecipients, batchSize, genericBatchMessage, smsSeparator]);

  const applyPresetTemplate = (type: 'reminder' | 'seatplan' | 'result' | 'custom') => {
    if (type === 'reminder') {
      setMessageTemplate(
        `Dear {name}, Math Quiz 2026 is on ${shortQuizDateEn}. Bring Admit Card (${DEFAULT_PUBLIC_PORTAL_URL}) 30m early. - MBP`
      );
    } else if (type === 'seatplan') {
      setMessageTemplate(
        `Dear {name}, Math Quiz 2026 Seat Plan is live. Check Venue, Room & Seat at ${DEFAULT_PUBLIC_PORTAL_URL} - MBP`
      );
    } else if (type === 'result') {
      setMessageTemplate(
        `Dear {name}, Math Quiz 2026 results & certificates are out! Check yours at ${DEFAULT_PUBLIC_PORTAL_URL} - MBP`
      );
    } else {
      setMessageTemplate(`Dear {name}, `);
    }
  };

  const toggleRecipient = (key: string) => {
    setExcludedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setExcludedKeys(prev => {
      const next = new Set(prev);
      for (const r of validRecipients) next.delete(r.key);
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setExcludedKeys(prev => {
      const next = new Set(prev);
      for (const r of validRecipients) next.add(r.key);
      return next;
    });
  };

  const copyText = async (label: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(label);
      setTimeout(() => setCopiedFeedback(null), 2200);
    } catch {
      onNotify?.('ক্লিপবোর্ডে কপি করা যায়নি।');
    }
  };

  // Dispatch via Server SMS Gateway (BulkSMSBD / GreenWeb / Twilio)
  const dispatchBulkViaServer = async (targets: ResolvedRecipient[]) => {
    const cleanTemplate = messageTemplate.trim();
    if (!cleanTemplate || targets.length === 0) return;

    setConfirmServerSend(false);
    setIsSendingBulk(true);
    cancelSendRef.current = false;

    setBulkProgress({ total: targets.length, done: 0, sent: 0, failed: 0 });
    setDeliveryMap(prev => {
      const next = { ...prev };
      for (const t of targets) {
        next[t.key] = { status: 'sending' };
      }
      return next;
    });

    const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
    let sentCount = 0;
    let failedCount = 0;
    let doneCount = 0;

    // Small sequential/2-way batching to avoid overloading the SMS gateway
    const CONCURRENCY = 2;
    let cursor = 0;

    const worker = async () => {
      while (cursor < targets.length && !cancelSendRef.current) {
        const idx = cursor++;
        const recipient = targets[idx];
        const personalizedMessage = applySmsTemplatePlaceholders(cleanTemplate, {
          name: recipient.smsName,
          regId: recipient.id,
          contestNameEn: settings.contestNameEn,
          organiserEn: settings.organiserEn
        });

        const result = await sendApprovalSms({
          to: recipient.normalizedMobile,
          message: personalizedMessage,
          registrationId: recipient.id,
          idToken
        });

        doneCount++;
        if (result.sent) {
          sentCount++;
          setDeliveryMap(prev => ({
            ...prev,
            [recipient.key]: { status: 'sent' }
          }));
        } else {
          failedCount++;
          setDeliveryMap(prev => ({
            ...prev,
            [recipient.key]: {
              status: 'failed',
              error: result.error || 'গেটওয়ে থেকে পাঠানো যায়নি'
            }
          }));
        }

        setBulkProgress({
          total: targets.length,
          done: doneCount,
          sent: sentCount,
          failed: failedCount
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
    );

    setIsSendingBulk(false);
    const stoppedEarly = cancelSendRef.current;
    onNotify?.(
      stoppedEarly
        ? `গণ-SMS প্রেরণ থামানো হয়েছে: ${sentCount} টি পাঠানো হয়েছে, ${failedCount} টি ব্যর্থ।`
        : `গণ-SMS সম্পন্ন: মোট ${targets.length} জনের মধ্যে ${sentCount} জনকে পাঠানো হয়েছে${failedCount > 0 ? `, ${failedCount} টি ব্যর্থ` : ''}।`
    );
  };

  const failedRecipients = useMemo(
    () => activeRecipients.filter(r => deliveryMap[r.key]?.status === 'failed'),
    [activeRecipients, deliveryMap]
  );

  return (
    <div className="space-y-6 font-['Hind_Siliguri',sans-serif] text-xs">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>গণ-বার্তা ও ইভেন্ট রিমাইন্ডার SMS (Bulk SMS Broadcaster)</span>
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-0.5">
              সকল নিবন্ধিত অংশগ্রহণকারীকে পরীক্ষার সময়সূচি, আসন বিন্যাস বা জরুরি আপডেট পাঠান — সার্ভার গেটওয়ে ও ফোনের SMS অ্যাপ উভয় মোডেই সচল।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 border ${
                serverSmsConfigured
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serverSmsConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {serverSmsConfigured
                ? 'সার্ভার Bulk SMS API সক্রিয়'
                : 'সার্ভার SMS API কনফিগার নেই (ফোন SMS অ্যাপ মোড সচল)'}
            </span>
          </div>
        </div>

        {/* Audience & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>প্রাপক গ্রুপ (Target Audience)</span>
            </label>
            <select
              value={audienceScope}
              onChange={e => setAudienceScope(e.target.value as AudienceScope)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 font-semibold"
            >
              <option value="verified_students">নিবন্ধিত সকল শিক্ষার্থী ({students.length} জন)</option>
              <option value="verified_online">অনলাইন নিবন্ধিত ({students.filter(s => s.source === 'online').length} জন)</option>
              <option value="pending_online">পেমেন্ট অপেক্ষমান আবেদন ({applications.filter(a => a.status === 'pending').length} জন)</option>
              <option value="all_active">সকল নিবন্ধিত + অপেক্ষমান আবেদনকারী</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-500" />
              <span>ক্যাটাগরি ফিল্টার</span>
            </label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as 'all' | CategoryCode)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 font-semibold"
            >
              <option value="all">সকল ক্যাটাগরি (ক, খ, গ)</option>
              <option value="01">{CATEGORIES['01'].nameBn} (৬ষ্ঠ-৭ম)</option>
              <option value="02">{CATEGORIES['02'].nameBn} (৮ম-৯ম)</option>
              <option value="03">{CATEGORIES['03'].nameBn} (১০ম-১২শ)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              পরীক্ষার ভেন্যু ফিল্টার
            </label>
            <select
              value={venueFilter}
              onChange={e => setVenueFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700 font-semibold"
            >
              <option value="all">সকল ভেন্যু</option>
              {venues.map(v => (
                <option key={v.id} value={v.id}>
                  {v.id} — {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              নাম / আইডি / নম্বর দিয়ে খুঁজুন
            </label>
            <input
              type="text"
              value={recipientSearch}
              onChange={e => setRecipientSearch(e.target.value)}
              placeholder="খুঁজুন..."
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Summary Stats & Deduplication Option */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-extrabold text-indigo-900 dark:text-indigo-200">
              নির্বাচিত প্রাপক: {toBengaliDigits(activeRecipients.length)} জন (মোট বৈধ: {toBengaliDigits(validRecipients.length)})
            </span>
            {duplicateSkippedCount > 0 && (
              <span className="px-2 py-0.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 rounded-md text-[11px] text-gray-600 dark:text-gray-300">
                ডুপ্লিকেট নম্বর বাদ: {toBengaliDigits(duplicateSkippedCount)}টি
              </span>
            )}
            {invalidRecipients.length > 0 && (
              <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-[11px] text-red-700 dark:text-red-300 font-semibold">
                ভুল/অসম্পূর্ণ নম্বর: {toBengaliDigits(invalidRecipients.length)}টি
              </span>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-700 dark:text-gray-300 select-none">
            <input
              type="checkbox"
              checked={deduplicatePhones}
              onChange={e => setDeduplicatePhones(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
            <span>একই নম্বরে একাধিকবার না পাঠিয়ে ডুপ্লিকেট বাদ দিন</span>
          </label>
        </div>
      </div>

      {/* Main Two-Column Grid: Composer + Dual Dispatch Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Message Composer (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>বার্তা লিখুন (Compose Update / Reminder)</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetTemplate('reminder')}
                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg font-semibold text-[11px]"
              >
                পরীক্ষার রিমাইন্ডার
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('seatplan')}
                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg font-semibold text-[11px]"
              >
                আসন বিন্যাস নোটিশ
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('result')}
                className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg font-semibold text-[11px]"
              >
                ফলাফল ঘোষণা
              </button>
              <button
                type="button"
                onClick={() => applyPresetTemplate('custom')}
                className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-[11px]"
              >
                খালি টেমপ্লেট
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value)}
            placeholder="অংশগ্রহণকারীদের জন্য আপডেট বা রিমাইন্ডার মেসেজ লিখুন..."
            className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>ডাইনামিক ট্যাগ:</span>
              <button
                type="button"
                onClick={() => setMessageTemplate(prev => `${prev} {name}`)}
                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-mono font-bold hover:bg-slate-200"
              >
                {'{name}'}
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate(prev => `${prev} {id}`)}
                className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-mono font-bold hover:bg-slate-200"
              >
                {'{id}'}
              </button>
              <span className="text-[10px] text-gray-400">
                (সার্ভার মোডে প্রতিটি শিক্ষার্থীর নাম/আইডি বসবে; ফোন ব্যাচে সাধারণ টেক্সট যাবে)
              </span>
            </div>

            <div className="font-mono font-bold text-gray-700 dark:text-gray-300">
              {smsMetrics.chars}/{smsMetrics.isUnicode ? 70 : 160} chars ({smsMetrics.isUnicode ? 'Unicode' : 'GSM-7'}) ·{' '}
              <span className={smsMetrics.parts > 1 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {smsMetrics.parts} SMS/recipient
              </span>
            </div>
          </div>

          {/* Live Preview */}
          {activeRecipients.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                <span>মেসেজ প্রিভিউ (উদাহরণ: {activeRecipients[0].smsName})</span>
                <button
                  type="button"
                  onClick={() => copyText('msg', genericBatchMessage)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-sans normal-case"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedFeedback === 'msg' ? 'বার্তা কপি হয়েছে!' : 'মেসেজ কপি করুন'}</span>
                </button>
              </div>
              <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {applySmsTemplatePlaceholders(messageTemplate.trim(), {
                  name: activeRecipients[0].smsName,
                  regId: activeRecipients[0].id,
                  contestNameEn: settings.contestNameEn,
                  organiserEn: settings.organiserEn
                })}
              </p>
            </div>
          )}

          {/* Mode A: Server SMS Gateway Automatic 1-Click Broadcast */}
          <div className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>পদ্ধতি ১: সার্ভার গেটওয়ে থেকে ১-ক্লিকে অটোমেটিক সবার কাছে পাঠান</span>
                </h4>
                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                  {serverSmsConfigured
                    ? 'BulkSMSBD / GreenWeb / Twilio গেটওয়ে প্রস্তুত আছে। Send চাপলে সব নির্বাচিত নম্বরে স্বয়ংক্রিয়ভাবে SMS যাবে।'
                    : 'সার্ভারে SMS_API_KEY যুক্ত থাকলে এই বাটনে ক্লিক করেই সব নম্বরে অটোমেটিক পাঠানো যাবে। বর্তমানে পদ্ধতি ২ (ফোন SMS অ্যাপ) ব্যবহার করুন।'}
                </p>
              </div>
            </div>

            {isSendingBulk ? (
              <div className="space-y-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    পাঠানো হচ্ছে: {toBengaliDigits(bulkProgress.done)} / {toBengaliDigits(bulkProgress.total)} জন...
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      cancelSendRef.current = true;
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>থামান</span>
                  </button>
                </div>
                <div className="w-full h-2.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{
                      width: `${bulkProgress.total > 0 ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0}%`
                    }}
                  />
                </div>
                <div className="flex gap-4 text-[11px]">
                  <span className="text-emerald-600 font-bold">সফল: {toBengaliDigits(bulkProgress.sent)}</span>
                  <span className="text-red-600 font-bold">ব্যর্থ: {toBengaliDigits(bulkProgress.failed)}</span>
                </div>
              </div>
            ) : confirmServerSend ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="text-amber-950 dark:text-amber-200 font-bold">
                  আপনি কি নিশ্চিত যে {toBengaliDigits(activeRecipients.length)} জন প্রাপককে এখনই সার্ভার গেটওয়ে দিয়ে SMS পাঠাবেন?
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmServerSend(false)}
                    className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg font-semibold"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchBulkViaServer(activeRecipients)}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>নিশ্চিত করে পাঠান</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!serverSmsConfigured || activeRecipients.length === 0 || !messageTemplate.trim()}
                  onClick={() => setConfirmServerSend(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    সার্ভার থেকে সবাইকে SMS পাঠান ({toBengaliDigits(activeRecipients.length)} জন)
                  </span>
                </button>

                {failedRecipients.length > 0 && serverSmsConfigured && (
                  <button
                    type="button"
                    onClick={() => dispatchBulkViaServer(failedRecipients)}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ব্যর্থ {toBengaliDigits(failedRecipients.length)} জনকে পুনরায় পাঠান</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Mode B (Admin's Phone SMS App Batch Launcher & Number Copy) (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>পদ্ধতি ২: অ্যাডমিনের ফোনের SMS অ্যাপ দিয়ে পাঠানো</span>
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              মোবাইল ব্রাউজারে নিচের প্রতিটি ব্যাচে ক্লিক করলে আপনার ফোনের মূল SMS অ্যাপে নম্বরগুলো ও মেসেজ অটো-লোড হবে, তারপর ফোনে Send চাপুন।
            </p>
          </div>

          {/* Quick Copy All Numbers + Settings */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                প্রতি ব্যাচে প্রাপক সংখ্যা
              </label>
              <select
                value={batchSize}
                onChange={e => setBatchSize(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-semibold text-xs"
              >
                <option value={10}>১০ জন প্রতি ব্যাচ</option>
                <option value={15}>১৫ জন প্রতি ব্যাচ (প্রস্তাবিত)</option>
                <option value={20}>২০ জন প্রতি ব্যাচ</option>
                <option value={30}>৩০ জন প্রতি ব্যাচ</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1">
                ফোন নম্বর সেপারেটর
              </label>
              <select
                value={smsSeparator}
                onChange={e => setSmsSeparator(e.target.value as ',' | ';')}
                className="w-full px-2.5 py-1.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 font-semibold text-xs"
              >
                <option value=",">কমা (,) — Android / iPhone</option>
                <option value=";">সেমিকোলন (;) — পুরোনো ফোন</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={activeRecipients.length === 0}
              onClick={() =>
                copyText(
                  'all-comma',
                  activeRecipients.map(r => r.normalizedMobile).join(', ')
                )
              }
              className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {copiedFeedback === 'all-comma'
                  ? 'কপি হয়েছে!'
                  : `সব নম্বর কপি (${toBengaliDigits(activeRecipients.length)}টি)`}
              </span>
            </button>

            <button
              type="button"
              disabled={!genericBatchMessage}
              onClick={() => copyText('msg-btn', genericBatchMessage)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" />
              <span>{copiedFeedback === 'msg-btn' ? 'কপি!' : 'বার্তা কপি'}</span>
            </button>
          </div>

          {/* Batch Launch List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {phoneBatches.length === 0 ? (
              <div className="p-4 text-center text-gray-500 border border-dashed rounded-xl">
                কোনো বৈধ মোবাইল নম্বর নির্বাচিত নেই।
              </div>
            ) : (
              phoneBatches.map(batch => {
                const startNum = batch.index * batchSize + 1;
                const endNum = startNum + batch.recipients.length - 1;
                const isOpened = openedBatches.has(batch.index);

                return (
                  <div
                    key={batch.index}
                    className={`p-3 rounded-xl border transition space-y-2 ${
                      isOpened
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : 'bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-gray-900 dark:text-white">
                          ব্যাচ {toBengaliDigits(batch.index + 1)} ({toBengaliDigits(startNum)}–{toBengaliDigits(endNum)} জন)
                        </span>
                        <span className="block text-[10px] text-gray-500 font-mono truncate max-w-[220px]">
                          {batch.phones.slice(0, 3).join(', ')}
                          {batch.phones.length > 3 ? ` +${batch.phones.length - 3}টি` : ''}
                        </span>
                      </div>

                      {isOpened && (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 rounded-md font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          খোলা হয়েছে
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={batch.smsHref}
                        onClick={() =>
                          setOpenedBatches(prev => {
                            const next = new Set(prev);
                            next.add(batch.index);
                            return next;
                          })
                        }
                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-white text-center flex items-center justify-center gap-1.5 shadow-xs transition ${
                          !genericBatchMessage
                            ? 'bg-gray-400 pointer-events-none'
                            : isOpened
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>ফোনের SMS অ্যাপে খুলুন</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyText(`batch-${batch.index}`, batch.phones.join(', '))}
                        className="px-2.5 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-100 rounded-lg font-semibold text-[11px] flex items-center gap-1"
                        title="এই ব্যাচের নম্বরগুলো কপি করুন"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedFeedback === `batch-${batch.index}` ? 'কপি!' : 'কপি'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[10px] text-amber-900 dark:text-amber-200 leading-relaxed flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              টিপস: কিছু ফোনের SMS অ্যাপে একসাথে ১৫–২০টির বেশি নম্বর দিলে MMS-এ রূপান্তর হতে পারে। কোনো ফোনে সমস্যা হলে প্রাপক সংখ্যা ১০–১৫ করে ব্যাচ আকারে অথবা <strong>সব নম্বর কপি</strong> ব্যবহার করুন।
            </span>
          </div>
        </div>
      </div>

      {/* Recipient List & Status Table */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-indigo-500" />
            <span>প্রাপক তালিকা ও ডেলিভারি স্ট্যাটাস ({toBengaliDigits(validRecipients.length)} জন)</span>
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded-lg font-bold text-[11px]"
            >
              সব নির্বাচন করুন
            </button>
            <button
              type="button"
              onClick={handleDeselectAllFiltered}
              className="px-3 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg font-bold text-[11px]"
            >
              সব আনচেক করুন
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 text-[11px] text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="p-2.5 w-8">✓</th>
                <th className="p-2.5">আইডি</th>
                <th className="p-2.5">নাম ও বিদ্যালয়</th>
                <th className="p-2.5">মোবাইল নম্বর</th>
                <th className="p-2.5">ক্যাটাগরি</th>
                <th className="p-2.5 text-right">স্ট্যাটাস / একক SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {validRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    ফিল্টার অনুযায়ী কোনো বৈধ প্রাপক পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                validRecipients.map(r => {
                  const isChecked = !excludedKeys.has(r.key);
                  const delivery = deliveryMap[r.key];
                  const individualMsg = applySmsTemplatePlaceholders(messageTemplate.trim(), {
                    name: r.smsName,
                    regId: r.id,
                    contestNameEn: settings.contestNameEn,
                    organiserEn: settings.organiserEn
                  });
                  const singleHref = buildSmsAnchorHref(r.normalizedMobile, individualMsg);

                  return (
                    <tr
                      key={r.key}
                      className={`hover:bg-gray-50 dark:hover:bg-slate-900/40 ${
                        !isChecked ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRecipient(r.key)}
                          className="w-4 h-4 accent-indigo-600 rounded"
                        />
                      </td>
                      <td className="p-2.5 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {r.id}
                      </td>
                      <td className="p-2.5">
                        <span className="font-bold text-gray-900 dark:text-white block">{r.name}</span>
                        <span className="text-[10px] text-gray-500">{r.schoolName} · {r.sourceLabel}</span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-gray-800 dark:text-gray-200">
                        {r.normalizedMobile}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-semibold">
                          {CATEGORIES[r.category]?.nameBn || r.category}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {delivery?.status === 'sending' && (
                            <span className="text-indigo-600 font-bold flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> পাঠাচ্ছে
                            </span>
                          )}
                          {delivery?.status === 'sent' && (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> পাঠানো হয়েছে
                            </span>
                          )}
                          {delivery?.status === 'failed' && (
                            <span
                              className="text-red-600 font-bold flex items-center gap-1"
                              title={delivery.error}
                            >
                              <XCircle className="w-3.5 h-3.5" /> ব্যর্থ
                            </span>
                          )}
                          <a
                            href={singleHref}
                            className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md font-bold text-[10px]"
                          >
                            SMS অ্যাপ
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {invalidRecipients.length > 0 && (
          <div className="p-3 bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-[11px] text-red-800 dark:text-red-200">
            <strong>বাদ পড়া নম্বরসমূহ ({toBengaliDigits(invalidRecipients.length)} জন — সঠিক ১১ সংখ্যার BD মোবাইল নয়):</strong>{' '}
            {invalidRecipients.map(r => `${r.name} (${r.rawMobile || 'খালি'})`).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};
