import React, { useState, useEffect, useRef } from 'react';
import { Student, Venue, CATEGORIES, CategoryCode } from '../../types';
import { parseQrPayload, toBengaliDigits } from '../../services/idSystem';
import { getPreferredExamVenueId } from '../../services/defaultData';
import { Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { 
  QrCode, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  UserPlus, 
  Users, 
  Search, 
  PhoneCall, 
  Download, 
  Volume2, 
  VolumeX,
  UserX,
  FileSpreadsheet
} from 'lucide-react';

interface AttendanceScannerProps {
  venues: Venue[];
  students: Student[];
  onMarkAttendance: (studentId: string, volunteerName: string) => Promise<void>;
  onRegisterWalkIn: (student: Omit<Student, 'id' | 'createdAt'>) => Promise<string>;
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  venues,
  students,
  onMarkAttendance,
  onRegisterWalkIn
}) => {
  const [selectedVenueId, setSelectedVenueId] = useState<string>(() => getPreferredExamVenueId(venues));
  const [volunteerName, setVolunteerName] = useState<string>('স্বেচ্ছাসেবক');
  const [manualId, setManualId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active view tab: 'present' or 'absent'
  const [activeTableTab, setActiveTableTab] = useState<'present' | 'absent'>('present');
  const [searchFilter, setSearchFilter] = useState('');

  // Scan feedback state
  type FeedbackState = 
    | { status: 'SUCCESS'; student: Student; time: string }
    | { status: 'ALREADY_MARKED'; student: Student; time: string }
    | { status: 'WRONG_VENUE'; student: Student; correctVenue: string }
    | { status: 'UNKNOWN_ID'; id: string }
    | null;

  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);

  // Scan cooldown map to prevent duplicate fires while holding the same QR in front of lens
  const lastScannedTimeRef = useRef<Record<string, number>>({});
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const venue = venues.find(v => v.id === selectedVenueId) || venues[0];
  const venueStudents = students.filter(s => s.venueId === venue?.id);
  const presentStudents = venueStudents.filter(s => s.attendance === true);
  const absentStudents = venueStudents.filter(s => !s.attendance);

  // Pleasant audio feedback
  const playBeep = (type: 'success' | 'warn' | 'error') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'warn') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  // Continuous Attendance Processor
  const processAttendanceScan = async (rawScannedText: string) => {
    const studentId = parseQrPayload(rawScannedText);
    if (!studentId) {
      setFeedback({ status: 'UNKNOWN_ID', id: rawScannedText });
      playBeep('error');
      return;
    }

    // Cooldown check: if scanned in last 2.5 seconds, ignore to avoid spamming
    const now = Date.now();
    const lastScan = lastScannedTimeRef.current[studentId] || 0;
    if (now - lastScan < 2500) {
      return;
    }
    lastScannedTimeRef.current[studentId] = now;

    const student = students.find(s => s.id === studentId);
    if (!student) {
      setFeedback({ status: 'UNKNOWN_ID', id: studentId });
      playBeep('error');
      return;
    }

    // Check wrong venue
    if (student.venueId !== selectedVenueId) {
      const correctV = venues.find(v => v.id === student.venueId)?.name || student.venueId;
      setFeedback({ status: 'WRONG_VENUE', student, correctVenue: correctV });
      playBeep('warn');
      return;
    }

    // Check already marked
    if (student.attendance) {
      setFeedback({ status: 'ALREADY_MARKED', student, time: new Date().toLocaleTimeString('bn-BD') });
      playBeep('warn');
      return;
    }

    // Mark attendance
    await onMarkAttendance(student.id, volunteerName);
    const timeStr = new Date().toLocaleTimeString('bn-BD');
    setFeedback({ status: 'SUCCESS', student, time: timeStr });
    playBeep('success');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    await processAttendanceScan(manualId.trim());
    setManualId('');
  };

  // Start Camera QR scanner (Continuous scan without closing)
  const startCamera = async () => {
    setIsScanning(true);
    setScannerError(null);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-target');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          // Process scan continuously without stopping camera
          processAttendanceScan(decodedText);
        },
        () => {
          // frame parse drop - ignore
        }
      );
    } catch {
      setScannerError('ক্যামেরা চালু করা সম্ভব হয়নি। ডিভাইসে ক্যামেরা পারমিশন অনুমোদন করুন অথবা সরাসরি ৭-ডিজিট আইডি লিখুন।');
      setIsScanning(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch {
        // ignore
      }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Export Attended List to Excel (.xlsx)
  const handleExportPresentExcel = () => {
    const dataRows = presentStudents.map((s, idx) => ({
      'ক্রম': idx + 1,
      'রেজিস্ট্রেশন আইডি': s.id,
      'শিক্ষার্থীর নাম (বাংলা)': s.nameBn,
      'নাম (English)': s.nameEn,
      'ক্যাটাগরি': s.category === '01' ? 'প্রাথমিক' : s.category === '02' ? 'নিম্ন মাধ্যমিক' : 'মাধ্যমিক',
      'শ্রেণি': s.class,
      'বিদ্যালয়': s.schoolName,
      'পিতার নাম': s.fatherName,
      'মোবাইল নম্বর': s.mobile,
      'কেন্দ্র': venue.name,
      'স্ট্যাটাস': 'উপস্থিত (Present)'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'হাজিরা তালিকা');
    XLSX.writeFile(workbook, `MBP_Math_Quiz_Present_List_${venue.name}.xlsx`);
  };

  // Filtered lists
  const filteredPresent = presentStudents.filter(s => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.id.includes(q) || s.nameBn.toLowerCase().includes(q) || s.nameEn.toLowerCase().includes(q) || s.schoolName.toLowerCase().includes(q);
  });

  const filteredAbsent = absentStudents.filter(s => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.id.includes(q) || s.nameBn.toLowerCase().includes(q) || s.nameEn.toLowerCase().includes(q) || s.schoolName.toLowerCase().includes(q) || s.mobile.includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-xs font-['Hind_Siliguri',sans-serif]">
      
      {/* Top Banner and Venue Selector */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>লাইভ অবিরাম QR কোড হাজিরা গ্রহণ (Continuous Attendance Scanner)</span>
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            ক্যামেরা অন রেখে বিরতিহীনভাবে প্রবেশপত্র স্ক্যান করুন। তাৎক্ষণিক হাজিরা ও অনুপস্থিতদের যোগাযোগের তালিকা আপডেট হবে।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'সাউন্ড বন্ধ করুন' : 'সাউন্ড চালু করুন'}
            className="p-2 border rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
          </button>

          <button
            onClick={() => setShowWalkInModal(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>ওয়াক-ইন স্পট রেজিস্ট্রেশন</span>
          </button>
        </div>
      </div>

      {/* Live Venue Attendance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border">
          <span className="text-[10px] text-gray-500 block font-bold">নির্বাচিত ভেন্যু</span>
          <select
            value={selectedVenueId}
            onChange={e => setSelectedVenueId(e.target.value)}
            className="w-full mt-1 px-2 py-1 border rounded-lg dark:bg-slate-900 text-xs font-bold text-indigo-600 truncate"
          >
            {venues.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/20">
          <span className="text-[10px] text-emerald-700 font-bold block">বর্তমান উপস্থিতি (Attended)</span>
          <span className="font-mono font-extrabold text-2xl text-emerald-700">
            {toBengaliDigits(presentStudents.length)} <span className="text-xs font-normal text-gray-500">/ {toBengaliDigits(venueStudents.length)} জন</span>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-red-200 bg-red-50/20">
          <span className="text-[10px] text-red-600 font-bold block">এখনও আসেনি (Not Attended)</span>
          <span className="font-mono font-extrabold text-2xl text-red-600">
            {toBengaliDigits(absentStudents.length)} <span className="text-xs font-normal text-gray-500">জন</span>
          </span>
        </div>
      </div>

      {/* Main Continuous Scanner Box */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-md space-y-4">
        
        {/* Camera Feed Target */}
        <div className="flex flex-col items-center justify-center">
          <div
            id="qr-reader-target"
            className="w-full max-w-sm min-h-[250px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-indigo-500 relative flex items-center justify-center text-white shadow-inner"
          >
            {!isScanning && (
              <div className="text-center p-6 space-y-2">
                <Camera className="w-12 h-12 text-indigo-400 mx-auto opacity-80 animate-pulse" />
                <p className="text-xs text-slate-200 font-bold">ক্যামেরা বর্তমানে বন্ধ রয়েছে</p>
                <p className="text-[11px] text-slate-400">
                  নিচের বোতাম চেপে ক্যামেরা চালু করুন এবং বিরতিহীনভাবে স্ক্যান করতে থাকুন
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            {!isScanning ? (
              <button
                onClick={startCamera}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition"
              >
                <Camera className="w-4 h-4" />
                <span>ক্যামেরা অন করুন ও বিরতিহীন স্ক্যান করুন</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition"
              >
                <span>ক্যামেরা বন্ধ করুন</span>
              </button>
            )}
          </div>

          {scannerError && (
            <p className="text-red-600 text-xs mt-2 font-semibold">{scannerError}</p>
          )}
        </div>

        {/* Manual ID Alternative Input */}
        <form onSubmit={handleManualSubmit} className="pt-3 border-t border-gray-200 dark:border-slate-700 flex gap-2 items-center">
          <input
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            placeholder="ক্যামেরা ব্যবহার না করতে চাইলে সরাসরি আইডি লিখুন (যেমন: 2601001)"
            className="flex-1 px-3 py-2 border rounded-xl dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs"
          >
            <span>হাজিরা দিন</span>
          </button>
        </form>

        {/* Real-time Feedback Toast */}
        {feedback && (
          <div className="pt-1 animate-fade-in">
            {feedback.status === 'SUCCESS' && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 block">
                      হাজিরা গৃহীত: {feedback.student.nameBn} ({feedback.student.nameEn})
                    </span>
                    <span className="text-[11px] text-gray-600 dark:text-gray-400 font-mono">
                      আইডি: {feedback.student.id} · শ্রেণি {toBengaliDigits(feedback.student.class)} · {feedback.student.schoolName} · সময়: {feedback.time}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold text-[10px] rounded-full uppercase">
                  উপস্থিত
                </span>
              </div>
            )}

            {feedback.status === 'ALREADY_MARKED' && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 rounded-xl flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs block">ইতিপূর্বেই হাজিরা নেওয়া হয়েছে!</span>
                  <span className="text-[11px]">{feedback.student.nameBn} (আইডি: {feedback.student.id})</span>
                </div>
              </div>
            )}

            {feedback.status === 'WRONG_VENUE' && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border-2 border-red-500 rounded-xl flex items-center gap-2.5 text-red-900 dark:text-red-200">
                <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs block">ভুল কেন্দ্র! শিক্ষার্থী অন্য কেন্দ্রের।</span>
                  <span className="text-[11px]">{feedback.student.nameBn} (আইডি: {feedback.student.id}) · সঠিক কেন্দ্র: <strong>{feedback.correctVenue}</strong></span>
                </div>
              </div>
            )}

            {feedback.status === 'UNKNOWN_ID' && (
              <div className="p-3.5 bg-gray-100 dark:bg-slate-900 border-2 border-gray-400 rounded-xl text-gray-800 dark:text-gray-200">
                <span className="font-bold text-xs text-red-600 block">অপরিচিত আইডি: {feedback.id}</span>
                <span className="text-[11px] text-gray-500">ডাটাবেজে এই আইডির কোন শিক্ষার্থী পাওয়া যায়নি।</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Real-time Generated Spreadsheets / Tables (Section 3 Requirement) */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        
        {/* Table Selector & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTableTab('present')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                activeTableTab === 'present'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>উপস্থিত তালিকা ({presentStudents.length} জন)</span>
            </button>

            <button
              onClick={() => setActiveTableTab('absent')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                activeTableTab === 'absent'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>অনুপস্থিত তালিকা ({absentStudents.length} জন)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="নাম বা আইডি খুঁজুন..."
                className="w-full pl-8 pr-2 py-1.5 border rounded-lg dark:bg-slate-900 text-xs"
              />
            </div>

            {activeTableTab === 'present' && (
              <button
                onClick={handleExportPresentExcel}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel ডাউনলোড</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Attended Students Spreadsheet */}
        {activeTableTab === 'present' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-semibold border-b">
                <tr>
                  <th className="py-2 px-3 text-center w-12">ক্রম</th>
                  <th className="py-2 px-3">রেজিস্ট্রেশন আইডি</th>
                  <th className="py-2 px-3">শিক্ষার্থীর নাম</th>
                  <th className="py-2 px-2 text-center">শ্রেণি</th>
                  <th className="py-2 px-3">বিদ্যালয়</th>
                  <th className="py-2 px-3 text-right">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
                {filteredPresent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-400">
                      এখনও কোনো শিক্ষার্থীর হাজিরা নেওয়া হয়নি
                    </td>
                  </tr>
                ) : (
                  filteredPresent.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-center font-mono text-gray-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{s.id}</td>
                      <td className="py-2 px-3 font-bold">{s.nameBn} ({s.nameEn})</td>
                      <td className="py-2 px-2 text-center font-mono">{toBengaliDigits(s.class)}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.schoolName}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded font-bold text-[10px]">
                          ✓ উপস্থিত
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Did Not Attend (Absent) List with Contact Numbers for Immediate Phone Calling */}
        {activeTableTab === 'absent' && (
          <div className="overflow-x-auto space-y-2">
            <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
              * যেসব পরীক্ষার্থী এখনও কেন্দ্রে পৌঁছায়নি, তাদের অভিভাবকদের সরাসরি ফোন করতে ডানপাশের বোতামে ট্যাপ করুন।
            </p>
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50/50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 font-semibold border-b">
                <tr>
                  <th className="py-2 px-3 text-center w-12">ক্রম</th>
                  <th className="py-2 px-3">আইডি</th>
                  <th className="py-2 px-3">নাম</th>
                  <th className="py-2 px-2 text-center">শ্রেণি</th>
                  <th className="py-2 px-3">বিদ্যালয়</th>
                  <th className="py-2 px-3">অভিভাবকের মোবাইল</th>
                  <th className="py-2 px-3 text-right">জরুরি কল</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
                {filteredAbsent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-emerald-600 font-bold">
                      সকল নিবন্ধিত শিক্ষার্থী কেন্দ্রে উপস্থিত হয়েছেন!
                    </td>
                  </tr>
                ) : (
                  filteredAbsent.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-red-50/30 dark:hover:bg-slate-700/30">
                      <td className="py-2 px-3 text-center font-mono text-gray-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-gray-700 dark:text-gray-300">{s.id}</td>
                      <td className="py-2 px-3 font-bold">{s.nameBn}</td>
                      <td className="py-2 px-2 text-center font-mono">{toBengaliDigits(s.class)}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.schoolName}</td>
                      <td className="py-2 px-3 font-mono text-slate-800 dark:text-slate-200">
                        {s.mobile || 'নম্বর নেই'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {s.mobile ? (
                          <a
                            href={`tel:${s.mobile}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>কল করুন</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

    </div>
  );
};
