import React, { useState } from 'react';
import { OnlineApplication, Student, Venue, CATEGORIES, ContestSettings, QUESTION_MEDIUM_LABELS } from '../../types';
import { formatRegistrationId, toBengaliDigits } from '../../services/idSystem';
import { getNextOnlineRegistrationId } from '../../services/firestoreService';
import { getPreferredExamVenueId } from '../../services/defaultData';
import { Check, X, AlertTriangle, Search, Eye, MessageSquare, Copy, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import {
  buildApprovalSmsMessage,
  buildRejectionSmsMessage,
  buildSmsAnchorHref,
  normalizeBdMobile,
  openSmsApp
} from '../../services/smsService';

interface PaymentsManagerProps {
  applications: OnlineApplication[];
  students: Student[];
  venues: Venue[];
  settings: ContestSettings;
  serverSmsConfigured?: boolean;
  onVerifyApplication: (appId: string, assignedId: string, venueId: string) => Promise<void>;
  onRejectApplication: (appId: string, reason: string) => Promise<void>;
  onResendSms?: (app: OnlineApplication) => Promise<void>;
}

interface DispatchedSmsBanner {
  type: 'approved' | 'rejected';
  appId: string;
  name: string;
  mobile: string;
  assignedId?: string;
  reason?: string;
  smsText: string;
  smsHref: string;
}

export const PaymentsManager: React.FC<PaymentsManagerProps> = ({
  applications,
  students,
  venues,
  settings,
  serverSmsConfigured = false,
  onVerifyApplication,
  onRejectApplication,
  onResendSms
}) => {
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Reject modal
  const [rejectingApp, setRejectingApp] = useState<OnlineApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('TrxID খুঁজে পাওয়া যায়নি (TrxID not found)');
  const [customReason, setCustomReason] = useState('');

  // Venue selection for verification (defaults to V02 Dayamay)
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => getPreferredExamVenueId(venues));
  const [hasUserSelectedVenue, setHasUserSelectedVenue] = useState<boolean>(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [resendingSmsId, setResendingSmsId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastDispatchedSms, setLastDispatchedSms] = useState<DispatchedSmsBanner | null>(null);
  const [smsValidationError, setSmsValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    if (venues.length === 0) return;
    const preferredId = getPreferredExamVenueId(venues);
    if (!hasUserSelectedVenue && selectedVenueId !== preferredId) {
      setSelectedVenueId(preferredId);
    } else if (!venues.some(v => v.id === selectedVenueId)) {
      setSelectedVenueId(preferredId);
    }
  }, [venues, selectedVenueId, hasUserSelectedVenue]);

  // Filter and search applications
  const filteredApps = applications.filter(app => {
    if (filter !== 'all' && app.status !== filter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.nameBn?.toLowerCase().includes(q) ||
      app.nameEn?.toLowerCase().includes(q) ||
      app.txnId?.toLowerCase().includes(q) ||
      app.mobile?.includes(q) ||
      app.payerMobile?.includes(q)
    );
  });

  // Calculate next online serial for a category starting from onlineSerialStart (default 601)
  const getNextOnlineId = (category: '01' | '02' | '03') => {
    return getNextOnlineRegistrationId(
      category,
      settings.yearCode || '26',
      applications,
      students,
      settings.onlineSerialStart || 601
    ).fullId;
  };

  const handleVerify = async (app: OnlineApplication) => {
    setSmsValidationError(null);
    const recipientMobile = normalizeBdMobile(app.mobile);
    if (!/^01[3-9]\d{8}$/.test(recipientMobile)) {
      setSmsValidationError(
        `${app.nameBn || app.nameEn}-এর আবেদন ফরমে প্রদত্ত মোবাইল নম্বর (${app.mobile || 'খালি'}) সঠিক নয়! অনুগ্রহ করে সঠিক ১১ সংখ্যার মোবাইল নম্বর নিশ্চিত করুন।`
      );
      return;
    }

    setVerifyingId(app.id);
    const nextId = app.assignedId || getNextOnlineId(app.category);
    const applicantDisplayName = (app.nameBn || app.nameEn || '').trim();
    const smsText = buildApprovalSmsMessage({
      applicantName: (app.nameEn || app.nameBn || '').trim(),
      registrationId: nextId,
      contestNameEn: settings.contestNameEn,
      organiserEn: settings.organiserEn
    });
    const smsHref = buildSmsAnchorHref(recipientMobile, smsText);

    try {
      const verifyPromise = onVerifyApplication(app.id, nextId, selectedVenueId);

      if (!serverSmsConfigured) {
        openSmsApp(smsHref);
        setLastDispatchedSms({
          type: 'approved',
          appId: app.id,
          name: applicantDisplayName,
          mobile: recipientMobile,
          assignedId: nextId,
          smsText,
          smsHref
        });
      }

      await verifyPromise;
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingApp) return;
    setSmsValidationError(null);
    const targetApp = rejectingApp;
    const finalReason = customReason.trim() ? `${rejectReason} - ${customReason.trim()}` : rejectReason;
    const recipientMobile = normalizeBdMobile(targetApp.mobile);
    const applicantName = (targetApp.nameBn || targetApp.nameEn || '').trim();
    const smsText = buildRejectionSmsMessage({
      applicantName,
      registrationId: targetApp.assignedId,
      txnId: targetApp.txnId,
      reason: finalReason,
      contestNameBn: settings.contestNameBn,
      organiserBn: settings.organiserBn
    });
    const hasValidMobile = /^01[3-9]\d{8}$/.test(recipientMobile);
    const smsHref = hasValidMobile ? buildSmsAnchorHref(recipientMobile, smsText) : '';

    setRejectingId(targetApp.id);
    try {
      const rejectPromise = onRejectApplication(targetApp.id, finalReason);

      if (!serverSmsConfigured && hasValidMobile) {
        openSmsApp(smsHref);
        setLastDispatchedSms({
          type: 'rejected',
          appId: targetApp.id,
          name: applicantName,
          mobile: recipientMobile,
          assignedId: targetApp.assignedId,
          reason: finalReason,
          smsText,
          smsHref
        });
      }

      await rejectPromise;
      setRejectingApp(null);
      setCustomReason('');
    } finally {
      setRejectingId(null);
    }
  };

  const handleResendSmsClick = async (app: OnlineApplication) => {
    if (!onResendSms) return;
    setResendingSmsId(app.id);
    try {
      await onResendSms(app);
    } finally {
      setResendingSmsId(null);
    }
  };

  const handleCopySms = async (appId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(appId);
      setTimeout(() => setCopiedId(prev => (prev === appId ? null : prev)), 2000);
    } catch {
      // Ignore clipboard failures in restricted browsers
    }
  };

  return (
    <div className="space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Header and Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>অনলাইন পেমেন্ট ভেরিফিকেশন (bKash Payments)</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            বিকাশ TrxID এবং স্ক্রিনশট মিলিয়ে আবেদন অনুমোদন করুন ও স্বয়ংক্রিয় অনলাইন আইডি বরাদ্দ দিন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="TrxID, মোবাইল বা নাম..."
              className="w-full pl-8 pr-3 py-1.5 border rounded-lg dark:bg-slate-900 dark:border-slate-700 text-xs"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
            {(['pending', 'verified', 'rejected', 'all'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {tab === 'pending' ? 'অপেক্ষমান' : tab === 'verified' ? 'যাচাইকৃত' : tab === 'rejected' ? 'বাতিল' : 'সকল'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {smsValidationError && (
        <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl p-3.5 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{smsValidationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSmsValidationError(null)}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Phone SMS App Banner for Just-Approved or Just-Rejected Applicant */}
      {lastDispatchedSms && (
        <div
          className={`border-2 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            lastDispatchedSms.type === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-700'
              : 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700'
          }`}
        >
          <div className="space-y-1">
            <div
              className={`flex items-center gap-1.5 font-bold text-sm ${
                lastDispatchedSms.type === 'approved'
                  ? 'text-emerald-900 dark:text-emerald-200'
                  : 'text-red-900 dark:text-red-200'
              }`}
            >
              {lastDispatchedSms.type === 'approved' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>
                {lastDispatchedSms.type === 'approved' ? (
                  <>
                    {lastDispatchedSms.name} অনুমোদিত! (রেজিস্ট্রেশন নম্বর:{' '}
                    <span className="font-mono">{lastDispatchedSms.assignedId}</span>)
                  </>
                ) : (
                  <>
                    {lastDispatchedSms.name}-এর আবেদন বাতিল হয়েছে
                    {lastDispatchedSms.assignedId ? (
                      <>
                        {' '}
                        (নম্বর <span className="font-mono">{lastDispatchedSms.assignedId}</span> মুক্ত করা হয়েছে)
                      </>
                    ) : null}
                  </>
                )}
              </span>
            </div>
            <p
              className={`text-[11px] m-0 ${
                lastDispatchedSms.type === 'approved'
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-red-800 dark:text-red-300'
              }`}
            >
              প্রাপক নম্বর: <strong className="font-mono">{lastDispatchedSms.mobile}</strong> — ফোনের SMS অ্যাপ অটো-খুলে থাকলে শুধু Send চাপুন, অথবা নিচের বাটনে ট্যাপ করুন।
            </p>
            <p
              className={`text-[11px] bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border m-0 ${
                lastDispatchedSms.type === 'approved'
                  ? 'text-emerald-900/90 dark:text-emerald-200/90 border-emerald-200 dark:border-emerald-800'
                  : 'text-red-900/90 dark:text-red-200/90 border-red-200 dark:border-red-800'
              }`}
            >
              {lastDispatchedSms.smsText}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={lastDispatchedSms.smsHref}
              className={`px-3.5 py-2 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm ${
                lastDispatchedSms.type === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS অ্যাপে পাঠান</span>
            </a>
            <button
              type="button"
              onClick={() => handleCopySms(lastDispatchedSms.appId, lastDispatchedSms.smsText)}
              className={`px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg font-semibold text-xs flex items-center gap-1 ${
                lastDispatchedSms.type === 'approved'
                  ? 'border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedId === lastDispatchedSms.appId ? 'কপি হয়েছে!' : 'বার্তা কপি'}</span>
            </button>
            <button
              type="button"
              onClick={() => setLastDispatchedSms(null)}
              className="p-1.5 text-gray-700 hover:text-gray-950 dark:text-gray-300 rounded-lg"
              aria-label="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Applications Cards Grid */}
      {filteredApps.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-gray-200 dark:border-slate-700 text-center text-gray-500">
          কোনো আবেদন পাওয়া যায়নি।
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map(app => {
            // Check for duplicate TrxIDs
            const isDuplicate = app.txnId && applications.filter(a => a.txnId === app.txnId).length > 1;
            const catInfo = CATEGORIES[app.category];

            return (
              <div
                key={app.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Top Row: TrxID and Status */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] text-gray-500 font-semibold block">বিকাশ TrxID:</span>
                      <span className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                        {app.txnId || 'কোনো TrxID নেই'}
                      </span>
                      {isDuplicate && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                          <AlertTriangle className="w-3 h-3" /> ডুপ্লিকেট TrxID!
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      app.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : app.status === 'rejected'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {app.status === 'verified' ? '✓ অনুমোদিত' : app.status === 'rejected' ? '✕ বাতিল' : '● যাচাই অপেক্ষমান'}
                    </span>
                  </div>

                  {/* Applicant Details */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 block text-[10px]">আবেদনকারীর নাম:</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {app.nameBn} ({app.nameEn})
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px]">শ্রেণি ও ক্যাটাগরি:</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded font-semibold text-[11px] ${catInfo.badgeBg} ${catInfo.textColor}`}>
                        শ্রেণি {toBengaliDigits(app.class)} ({catInfo.nameBn})
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px]">প্রেরক মোবাইল:</span>
                      <span className="font-mono font-semibold">{app.payerMobile}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px]">SMS পাঠানোর নম্বর:</span>
                      <span className="font-mono font-semibold text-indigo-600">{app.mobile}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px]">বিদ্যালয়:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{app.schoolName}</span>
                    </div>

                    <div>
                      <span className="text-gray-500 block text-[10px]">প্রশ্নের ধরন:</span>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          app.questionMedium === 'english'
                            ? 'bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                            : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {QUESTION_MEDIUM_LABELS[app.questionMedium === 'english' ? 'english' : 'bangla'].bn}
                      </span>
                    </div>
                  </div>

                  {/* Payment Screenshot Thumbnail if attached */}
                  {app.screenshotPath && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                      <img
                        src={app.screenshotPath}
                        alt="Screenshot"
                        className="w-12 h-12 object-cover rounded cursor-pointer border"
                        onClick={() => setZoomedImage(app.screenshotPath!)}
                      />
                      <button
                        type="button"
                        onClick={() => setZoomedImage(app.screenshotPath!)}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>স্ক্রিনশট বড় করে দেখুন</span>
                      </button>
                    </div>
                  )}

                  {/* If verified, show assigned ID & SMS dispatch controls */}
                  {app.status === 'verified' && app.assignedId && (() => {
                    const recipientMobile = normalizeBdMobile(app.mobile);
                    const smsText = buildApprovalSmsMessage({
                      applicantName: (app.nameEn || app.nameBn || '').trim(),
                      registrationId: app.assignedId,
                      contestNameEn: settings.contestNameEn,
                      organiserEn: settings.organiserEn
                    });
                    const smsHref = buildSmsAnchorHref(recipientMobile, smsText);

                    return (
                      <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-300 dark:border-emerald-800 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            বরাদ্দকৃত আইডি: <span className="font-mono text-sm">{app.assignedId}</span>
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            app.smsStatus === 'sent'
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : app.smsStatus === 'failed'
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {app.smsStatus === 'sent'
                              ? '✓ SMS পাঠানো হয়েছে'
                              : app.smsStatus === 'failed'
                                ? 'SMS ব্যর্থ (পুনরায় চেষ্টা করুন)'
                                : 'ফোনের SMS অ্যাপ দিয়ে পাঠান'}
                          </span>
                        </div>

                        <p className="text-[10px] text-emerald-900/90 dark:text-emerald-200/90 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded border border-emerald-200 dark:border-emerald-800 m-0 leading-relaxed">
                          <span className="font-bold">প্রাপক ({recipientMobile}):</span> {smsText}
                        </p>

                        {app.smsStatus === 'failed' && app.smsError && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 m-0">
                            কারণ: {app.smsError}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <a
                            href={smsHref}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>SMS অ্যাপে পাঠান</span>
                          </a>

                          {onResendSms && (serverSmsConfigured || app.smsStatus === 'failed') && (
                            <button
                              type="button"
                              onClick={() => handleResendSmsClick(app)}
                              disabled={resendingSmsId === app.id}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${resendingSmsId === app.id ? 'animate-spin' : ''}`} />
                              <span>{resendingSmsId === app.id ? 'পাঠানো হচ্ছে...' : app.smsStatus === 'sent' ? 'আবার SMS পাঠান' : 'সার্ভার থেকে SMS পাঠান'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopySms(app.id, smsText)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 rounded-md text-[10px] font-semibold flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedId === app.id ? 'কপি হয়েছে!' : 'বার্তা কপি'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* If rejected, show reason & Rejection SMS dispatch controls */}
                  {app.status === 'rejected' && (() => {
                    const recipientMobile = normalizeBdMobile(app.mobile);
                    const hasValidMobile = /^01[3-9]\d{8}$/.test(recipientMobile);
                    const smsText = buildRejectionSmsMessage({
                      applicantName: (app.nameBn || app.nameEn || '').trim(),
                      registrationId: app.assignedId,
                      txnId: app.txnId,
                      reason: app.reason || 'TrxID মেলেনি বা পাওয়া যায়নি',
                      contestNameBn: settings.contestNameBn,
                      organiserBn: settings.organiserBn
                    });
                    const smsHref = hasValidMobile ? buildSmsAnchorHref(recipientMobile, smsText) : '#';

                    return (
                      <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-300 dark:border-red-800 space-y-2">
                        <div className="flex justify-between items-center gap-2 text-[11px] text-red-800 dark:text-red-200">
                          <span>
                            বাতিলের কারণ: <strong>{app.reason || 'TrxID মেলেনি'}</strong>
                          </span>
                          <span className="text-[10px] font-semibold">
                            {app.smsStatus === 'sent'
                              ? '✓ বাতিল SMS পাঠানো হয়েছে'
                              : app.smsStatus === 'failed'
                                ? 'SMS ব্যর্থ'
                                : 'ফোনের SMS অ্যাপ দিয়ে পাঠান'}
                          </span>
                        </div>

                        {app.assignedId && (
                          <p className="text-[10px] text-red-700 dark:text-red-300 m-0">
                            পূর্বের নম্বর <strong className="font-mono">{app.assignedId}</strong> মুক্ত করা হয়েছে (পরবর্তী আবেদনকারী এটি পাবেন)।
                          </p>
                        )}

                        <p className="text-[10px] text-red-900/90 dark:text-red-200/90 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded border border-red-200 dark:border-red-800 m-0 leading-relaxed">
                          <span className="font-bold">প্রাপক ({recipientMobile || app.mobile}):</span> {smsText}
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {hasValidMobile && (
                            <a
                              href={smsHref}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>SMS অ্যাপে পাঠান</span>
                            </a>
                          )}

                          {onResendSms && (serverSmsConfigured || app.smsStatus === 'failed') && hasValidMobile && (
                            <button
                              type="button"
                              onClick={() => handleResendSmsClick(app)}
                              disabled={resendingSmsId === app.id}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${resendingSmsId === app.id ? 'animate-spin' : ''}`} />
                              <span>{resendingSmsId === app.id ? 'পাঠানো হচ্ছে...' : app.smsStatus === 'sent' ? 'আবার SMS পাঠান' : 'সার্ভার থেকে SMS পাঠান'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopySms(app.id, smsText)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 rounded-md text-[10px] font-semibold flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedId === app.id ? 'কপি হয়েছে!' : 'বার্তা কপি'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Actions for Pending Applications */}
                {app.status === 'pending' && (
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center gap-2">
                    <div className="flex-1">
                      <select
                        value={selectedVenueId}
                        onChange={e => {
                          setHasUserSelectedVenue(true);
                          setSelectedVenueId(e.target.value);
                        }}
                        className="w-full px-2 py-1.5 border rounded-lg text-[11px] dark:bg-slate-900"
                      >
                        {[...venues]
                          .sort((a, b) => {
                            const rank = (id: string) => (id === 'V02' ? 0 : id === 'V03' ? 1 : id === 'V01' ? 2 : 3);
                            return rank(a.id) - rank(b.id) || a.id.localeCompare(b.id);
                          })
                          .map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                      </select>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setRejectingApp(app)}
                        className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-semibold flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>বাতিল</span>
                      </button>

                      <button
                        onClick={() => handleVerify(app)}
                        disabled={verifyingId === app.id}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{verifyingId === app.id ? 'যাচাই হচ্ছে...' : 'অনুমোদন করুন'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Zoom Image Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img src={zoomedImage} alt="Payment Screenshot Zoom" className="rounded-xl shadow-2xl max-h-[85vh] object-contain" />
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-md w-full shadow-2xl border space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              আবেদন বাতিলের কারণ নির্ধারণ
            </h3>
            <p className="text-xs text-gray-500">
              {rejectingApp.nameBn}-এর আবেদন বাতিল করতে কারণ নির্বাচন করুন (আবেদনকারীকে SMS এ পাঠানো হবে):
            </p>

            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full p-2 border rounded-xl text-xs dark:bg-slate-800"
            >
              <option value="TrxID খুঁজে পাওয়া যায়নি (TrxID not found)">TrxID খুঁজে পাওয়া যায়নি (TrxID not found)</option>
              <option value="প্রেরিত টাকার পরিমাণ কম (Wrong amount)">প্রেরিত টাকার পরিমাণ কম (Wrong amount)</option>
              <option value="ডুপ্লিকেট ট্রানজ্যাকশন (Duplicate TrxID)">ডুপ্লিকেট ট্রানজ্যাকশন (Duplicate TrxID)</option>
              <option value="স্ক্রিনশট অস্পষ্ট (Unreadable screenshot)">স্ক্রিনশট অস্পষ্ট (Unreadable screenshot)</option>
            </select>

            <input
              type="text"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="অতিরিক্ত বিস্তারিত বিবরণ (ঐচ্ছিক)..."
              className="w-full p-2 border rounded-xl text-xs dark:bg-slate-800"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingApp(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                ফিরে যান
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectingId === rejectingApp.id}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {rejectingId === rejectingApp.id ? 'বাতিল হচ্ছে...' : 'বাতিল নিশ্চিত করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
