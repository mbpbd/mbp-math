import React, { useState, useEffect } from 'react';
import { ContestSettings, CATEGORIES, CategoryCode, getSyllabusParagraphs } from '../../types';
import { toBengaliDigits } from '../../services/idSystem';
import { 
  FileEdit, 
  Search, 
  Trophy, 
  School as SchoolIcon, 
  Lock, 
  Clock, 
  Calendar, 
  CreditCard, 
  Phone, 
  ChevronRight,
  BookOpen,
  Shield,
  Sparkles
} from 'lucide-react';

interface PublicPortalProps {
  settings: ContestSettings;
  totalRegistered: number;
  categoryCounts: Record<CategoryCode, number>;
  onOpenOnlineRegistration: () => void;
  onOpenCheckStatus: () => void;
  onOpenTeacherPanel: () => void;
  onOpenResultsCheck: () => void;
  onOpenAdminLogin?: () => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  settings,
  totalRegistered,
  categoryCounts,
  onOpenOnlineRegistration,
  onOpenCheckStatus,
  onOpenTeacherPanel,
  onOpenResultsCheck,
  onOpenAdminLogin
}) => {
  // Countdown to quiz date (26 Dec 2026, 10:30 AM)
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date('2026-12-26T10:30:00+06:00').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-['Hind_Siliguri',sans-serif] max-w-5xl mx-auto py-6 px-3 sm:px-4 space-y-8">
      
      {/* Light Theme Container Wrapper with Warm Yellow Background (User Requirement) */}
      <div className="bg-amber-100 dark:bg-slate-900 border-2 border-amber-300 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 transition-colors">
        
        {/* Hero Section with MBP Logo & High-Contrast Black Headings */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <img 
              src="/assets/aistudio/mbp_d0333f88.jpg" 
              alt="MBP Logo" 
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain mx-auto rounded-2xl shadow-md border-2 border-slate-900/10 dark:border-white/20 bg-white p-1"
            />
            <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-950 text-amber-300 text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
              ২০২৬
            </span>
          </div>

          <div>
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-amber-400 uppercase tracking-widest">
              {settings.organiserBn}
            </p>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight mt-1">
              {settings.contestNameBn}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-gray-300 max-w-xl mx-auto mt-2 leading-relaxed">
              মেধা বিকাশ, গণিতের আনন্দ ও সৃজনশীলতার বিকাশ ঘটাতে মণিপুরি বিজ্ঞান প্রজন্মের বার্ষিক আয়োজন। ৩য় থেকে ১০ম শ্রেণির সকল শিক্ষার্থীর জন্য উন্মুক্ত।
            </p>
          </div>
        </div>

        {/* 4 Large Action Cards (High Contrast & Clear Purpose) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* 1. Online Registration */}
          <button
            onClick={onOpenOnlineRegistration}
            className="text-left bg-indigo-900 hover:bg-indigo-950 text-white p-5 rounded-2xl shadow-lg hover:scale-[1.01] transition duration-200 flex flex-col justify-between min-h-[140px] group border border-indigo-700"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center mb-2 font-bold">
                <FileEdit className="w-5 h-5 text-slate-950" />
              </div>
              <h3 className="text-lg font-extrabold text-white">অনলাইন রেজিস্ট্রেশন</h3>
              <p className="text-xs text-indigo-100 mt-1 font-medium">
                বিদ্যালয়ে ফরম না পেলে অনলাইনে বিকাশ পেমেন্টের মাধ্যমে রেজিস্ট্রেশন সম্পন্ন করুন।
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-300 group-hover:text-amber-200 mt-3">
              <span>আবেদন ফরম পূরণ করুন</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* 2. Registration Status & Admit Card */}
          <button
            onClick={onOpenCheckStatus}
            className="text-left bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-slate-900/20 dark:border-slate-700 shadow-md hover:border-indigo-600 hover:scale-[1.01] transition duration-200 flex flex-col justify-between min-h-[140px] group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mb-2 text-indigo-900 dark:text-indigo-300">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">রেজিস্ট্রেশন যাচাই ও প্রবেশপত্র</h3>
              <p className="text-xs text-slate-700 dark:text-gray-300 mt-1 font-medium">
                আইডি ও মোবাইল নম্বর দিয়ে নিবন্ধনের স্থিতি জানুন ও অফিসিয়াল প্রবেশপত্র ডাউনলোড করুন।
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 mt-3">
              <span>যাচাই ও প্রবেশপত্র ডাউনলোড</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* 3. Results (Locked until published) */}
          <button
            onClick={onOpenResultsCheck}
            className={`text-left p-5 rounded-2xl border-2 transition duration-200 flex flex-col justify-between min-h-[140px] ${
              settings.resultsPublished
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:scale-[1.01] border-amber-500'
                : 'bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-gray-300 hover:scale-[1.01]'
            }`}
          >
            <div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                settings.resultsPublished ? 'bg-white text-amber-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-gray-200'
              }`}>
                {settings.resultsPublished ? <Trophy className="w-5 h-5 text-amber-600" /> : <Lock className="w-5 h-5 text-slate-700 dark:text-slate-200" />}
              </div>
              <h3 className={`text-lg font-extrabold ${settings.resultsPublished ? 'text-white' : 'text-slate-950 dark:text-white'}`}>
                ফলাফল ও সনদ ডাউনলোড
              </h3>
              <p className={`text-xs mt-1 font-medium ${settings.resultsPublished ? 'text-amber-100' : 'text-slate-700 dark:text-gray-300'}`}>
                {settings.resultsPublished
                  ? 'ফলাফল প্রকাশিত হয়েছে! আইডি লিখে আপনার ফলাফল ও ইংরেজি সনদ ডাউনলোড করুন।'
                  : 'ফলাফল পরীক্ষা শেষে অ্যাডমিন কর্তৃক উন্মুক্ত করার সাথে সাথে এখানে পাওয়া যাবে।'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold mt-3">
              <span>{settings.resultsPublished ? 'ফলাফল ও সনদ দেখুন' : '🔒 ফলাফল লক করা আছে'}</span>
            </div>
          </button>

          {/* 4. Teacher Panel Launcher (Strictly for submitting numbers) */}
          <button
            onClick={onOpenTeacherPanel}
            className="text-left bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-slate-900/20 dark:border-slate-700 shadow-md hover:border-purple-600 hover:scale-[1.01] transition duration-200 flex flex-col justify-between min-h-[140px] group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 flex items-center justify-center mb-2 text-purple-900 dark:text-purple-300">
                <SchoolIcon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-950 dark:text-white">শিক্ষক প্যানেল</h3>
              <p className="text-xs text-slate-700 dark:text-gray-300 mt-1 font-medium">
                বিদ্যালয়ের শিক্ষক প্রতিনিধিবৃন্দ ৪-ডিজিট পিন দিয়ে শিক্ষার্থীকে দেওয়া ফরমের নম্বরগুলো রিপোর্ট করুন।
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-400 mt-3">
              <span>নম্বর জমা দিতে প্রবেশ করুন</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </button>

        </div>

        {/* Countdown to Quiz Clock in Lower Section (User Requirement) */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border-2 border-slate-900/10 dark:border-slate-700 shadow-sm text-center space-y-3">
          <span className="text-xs font-extrabold text-slate-950 dark:text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>কুইজ অনুষ্ঠিত হতে সময় বাকি: ২৬ ডিসেম্বর ২০২৬, সকাল ১০:৩০</span>
          </span>

          <div className="flex justify-center items-center gap-3 sm:gap-6 font-mono">
            <div className="text-center">
              <span className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white block">
                {toBengaliDigits(timeLeft.days)}
              </span>
              <span className="text-[10px] text-slate-700 dark:text-gray-400 uppercase font-sans font-bold">দিন</span>
            </div>
            <span className="text-xl text-slate-400">:</span>
            <div className="text-center">
              <span className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white block">
                {toBengaliDigits(timeLeft.hours)}
              </span>
              <span className="text-[10px] text-slate-700 dark:text-gray-400 uppercase font-sans font-bold">ঘণ্টা</span>
            </div>
            <span className="text-xl text-slate-400">:</span>
            <div className="text-center">
              <span className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white block">
                {toBengaliDigits(timeLeft.minutes)}
              </span>
              <span className="text-[10px] text-slate-700 dark:text-gray-400 uppercase font-sans font-bold">মিনিট</span>
            </div>
            <span className="text-xl text-slate-400">:</span>
            <div className="text-center">
              <span className="text-2xl sm:text-4xl font-extrabold text-slate-950 dark:text-white block">
                {toBengaliDigits(timeLeft.seconds)}
              </span>
              <span className="text-[10px] text-slate-700 dark:text-gray-400 uppercase font-sans font-bold">সেকেন্ড</span>
            </div>
          </div>
        </div>

        {/* Syllabus & Category Details with Solid Contrast */}
        <div className="space-y-3">
          <h3 className="font-extrabold text-lg text-slate-950 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <span>ক্যাটাগরিভিত্তিক কুইজ সিলেবাস</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['01', '02', '03'] as CategoryCode[]).map(cat => {
              const info = CATEGORIES[cat];
              const syllabusText = settings.syllabuses?.[cat] || `${info.syllabusBn}\n${info.syllabusEn}`;

              return (
                <div 
                  key={cat} 
                  className="p-4 rounded-2xl border-2 border-slate-900/10 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs space-y-2"
                >
                  <div className="flex justify-between items-center border-b pb-1">
                    <span className="font-extrabold text-sm text-slate-950 dark:text-white">{info.nameBn}</span>
                    <span className="text-[11px] font-bold text-slate-700 dark:text-gray-300 font-mono">
                      শ্রেণি: {info.classes.map(c => toBengaliDigits(c)).join(', ')}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-800 dark:text-gray-200 leading-relaxed font-medium">
                    {getSyllabusParagraphs(syllabusText).map((para, idx) => (
                      <p key={idx} className="m-0">
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact & Helpline Facts */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-900/10 dark:border-slate-700 flex flex-wrap justify-between items-center text-xs font-bold text-slate-900 dark:text-gray-200 gap-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-indigo-600" />
            <span>হেল্পলাইন: {settings.helplineNumbers}</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-pink-600" />
            <span>বিকাশ নম্বর: {settings.bkashNumber} ({settings.bkashAccountName})</span>
          </div>
          {onOpenAdminLogin && (
            <button
              onClick={onOpenAdminLogin}
              className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>অ্যাডমিন পোর্টাল লগইন</span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
