import React, { useState, useEffect } from 'react';
import { 
  ContestSettings, 
  NumberBlock, 
  School, 
  Venue, 
  Student, 
  OnlineApplication, 
  CategoryCode 
} from './types';
import { DEFAULT_SETTINGS, INITIAL_SCHOOLS, INITIAL_VENUES, getPreferredExamVenueId } from './services/defaultData';
import { allocateSchoolBlocks } from './services/blockAllocation';
import { hashPin, formatRegistrationId } from './services/idSystem';
import { SeatPlanResult } from './services/seatPlanAlgorithm';
import { 
  LS_KEYS,
  subscribeToApplications, 
  subscribeToStudents, 
  subscribeToTeacherMarks, 
  subscribeToSettings,
  subscribeToSchools,
  subscribeToVenues,
  subscribeToBlocks,
  subscribeToSeatPlans,
  saveOnlineApplication,
  verifyOnlineApplication,
  rejectOnlineApplication,
  updateApplicationSmsStatus,
  saveTeacherMarks,
  saveStudent,
  saveStudentsBatch,
  deleteStudent,
  saveSchool,
  deleteSchool,
  saveVenue,
  deleteVenue,
  saveBlocks,
  saveSeatPlansBatch,
  saveContestSettings,
  seedInitialFirestoreData,
  partialResetDataset,
  PartialResetOptions,
  getCachedItem
} from './services/firestoreService';
import {
  buildApprovalSmsMessage,
  buildRejectionSmsMessage,
  checkServerSmsConfigured,
  normalizeBdMobile,
  sendApprovalSms
} from './services/smsService';
import {
  auth,
  AdminSessionUser,
  subscribeToAuthChanges,
  verifyAdminSession,
  signOutAdmin
} from './config/firebase';

// Phase 1a Components
import { VenuesManager } from './components/admin/VenuesManager';
import { SchoolsManager } from './components/admin/SchoolsManager';
import { BlockGeneratorModal } from './components/admin/BlockGeneratorModal';
import { PrintBundleView } from './components/admin/PrintBundleView';
import { SettingsManager } from './components/admin/SettingsManager';

// Phase 1b Components
import { PaymentsManager } from './components/admin/PaymentsManager';
import { BulkSmsManager } from './components/admin/BulkSmsManager';
import { TeacherPanel } from './components/teacher/TeacherPanel';
import { OnlineRegistrationModal } from './components/public/OnlineRegistrationModal';
import { CheckStatusModal } from './components/public/CheckStatusModal';
import { PublicPortal } from './components/public/PublicPortal';

// Phase 2 Components
import { DataEntryView } from './components/admin/DataEntryView';
import { StudentsDirectory } from './components/admin/StudentsDirectory';
import { SeatPlanGenerator } from './components/admin/SeatPlanGenerator';
import { OnlineGeneralDataset } from './components/admin/OnlineGeneralDataset';

// Phase 3 Components
import { AttendanceScanner } from './components/admin/AttendanceScanner';

// Phase 4 Components
import { ResultsManager } from './components/admin/ResultsManager';

// Auth & Admin Action Components
import { AdminLoginModal } from './components/auth/AdminLoginModal';
import { ResetDataModal } from './components/admin/ResetDataModal';
import { PublicResultsModal } from './components/public/PublicResultsModal';

// Common
import { NetworkBackground } from './components/common/NetworkBackground';
import { runSeedData } from './scripts/seed';
import { 
  Printer, 
  Layers, 
  School as SchoolIcon, 
  MapPin, 
  Settings as SettingsIcon, 
  Database, 
  Sun, 
  Moon, 
  WifiOff, 
  CheckCircle2,
  FileCheck,
  CreditCard,
  Keyboard,
  Users,
  Armchair,
  QrCode,
  Trophy,
  Globe,
  Lock,
  LogOut,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  RotateCcw
} from 'lucide-react';

export type ActivePhase = '1a' | '1b' | '2' | '3' | '4' | 'public' | 'teacher_standalone';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('mbp_theme');
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Admin Auth State (Google Auth verified against server-side allowlist)
  const [adminUser, setAdminUser] = useState<AdminSessionUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  
  // Master Phase Switcher (1a, 1b, 2, 3, 4, public)
  // Always starts on public/teacher until Firebase Google Auth session is verified
  const [activePhase, setActivePhase] = useState<ActivePhase>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#teacher') return 'teacher_standalone';
    }
    return 'public';
  });
  
  // Phase 1a Sub-tabs
  const [tab1a, setTab1a] = useState<'print' | 'blocks' | 'schools' | 'venues' | 'settings'>('print');
  // Phase 1b Sub-tabs
  const [tab1b, setTab1b] = useState<'payments' | 'bulk-sms' | 'teacher' | 'check'>('payments');
  // Phase 2 Sub-tabs
  const [tab2, setTab2] = useState<'data-entry' | 'students' | 'seat-plan' | 'general-dataset'>('data-entry');
  // Phase 3 Sub-tabs
  const [tab3, setTab3] = useState<'scanner' | 'walkin'>('scanner');
  // Phase 4 Sub-tabs
  const [tab4, setTab4] = useState<'results' | 'certificates'>('results');

  // Shared Master Data State with persistent LocalStorage hydration
  const [settings, setSettings] = useState<ContestSettings>(() => {
    let cached = getCachedItem<ContestSettings>(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (!cached.syllabusUpdatedV5) {
      cached = {
        ...cached,
        syllabuses: { ...DEFAULT_SETTINGS.syllabuses },
        syllabusUpdatedV2: true,
        syllabusUpdatedV3: true,
        syllabusUpdatedV4: true,
        syllabusUpdatedV5: true
      };
    }
    if (!cached.helplineSwitchedV1) {
      const currentHelpline = cached.helplineNumbers || DEFAULT_SETTINGS.helplineNumbers;
      const updatedHelpline = currentHelpline.includes('01717-557419, 01753-253127')
        ? currentHelpline.replace('01717-557419, 01753-253127', '01753-253127, 01717-557419')
        : DEFAULT_SETTINGS.helplineNumbers;
      cached = {
        ...cached,
        helplineNumbers: updatedHelpline,
        helplineSwitchedV1: true
      };
    }
    return cached;
  });
  const [venues, setVenues] = useState<Venue[]>(() => getCachedItem(LS_KEYS.VENUES, []));
  const [schools, setSchools] = useState<School[]>(() => getCachedItem(LS_KEYS.SCHOOLS, []));
  const [blocks, setBlocks] = useState<NumberBlock[]>(() => getCachedItem(LS_KEYS.BLOCKS, []));
  const [students, setStudents] = useState<Student[]>(() => getCachedItem(LS_KEYS.STUDENTS, []));
  const [applications, setApplications] = useState<OnlineApplication[]>(() => getCachedItem(LS_KEYS.APPLICATIONS, []));
  const [seatPlans, setSeatPlans] = useState<SeatPlanResult[]>(() => getCachedItem(LS_KEYS.SEAT_PLANS, []));
  const [markedSchoolIds, setMarkedSchoolIds] = useState<Set<string>>(() => new Set(getCachedItem<string[]>(LS_KEYS.TEACHER_MARKS, [])));
  const [checkStatusPrefillId, setCheckStatusPrefillId] = useState<string>('');

  // Modals for Public Interaction
  const [showOnlineRegModal, setShowOnlineRegModal] = useState(false);
  const [showCheckStatusModal, setShowCheckStatusModal] = useState(false);
  const [showPublicResultsModal, setShowPublicResultsModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Hamburger Menu Navigation State (User Request #4)
  const [isHamburgerOpen, setIsHamburgerOpen] = useState<boolean>(false);
  const [expandedMenu, setExpandedMenu] = useState<'1a' | '1b' | '2' | '3' | '4' | null>('1a');
  const [serverSmsConfigured, setServerSmsConfigured] = useState<boolean>(false);

  useEffect(() => {
    checkServerSmsConfigured().then(configured => {
      setServerSmsConfigured(configured);
    });
  }, []);

  // Restore and continuously verify persisted Firebase Google Auth session
  useEffect(() => {
    let active = true;
    // Remove any legacy insecure localStorage auth payload if present
    try {
      localStorage.removeItem('mbp_admin_auth');
    } catch {
      // Ignore storage errors
    }

    const unsubscribe = subscribeToAuthChanges(async (fbUser) => {
      if (!active) return;

      if (!fbUser) {
        setAdminUser(null);
        setActivePhase(prev => (prev === 'public' || prev === 'teacher_standalone' ? prev : 'public'));
        return;
      }

      try {
        const verification = await verifyAdminSession(fbUser);
        if (!active) return;

        if (verification.authorized) {
          setAdminUser(verification.user);
          setAuthError(null);
          setShowAdminLoginModal(false);

          const hash = window.location.hash;
          if (hash === '#admin' || hash === '#1a') {
            setActivePhase('1a');
          } else if (hash === '#1b' || hash === '#2' || hash === '#3' || hash === '#4') {
            setActivePhase(hash.slice(1) as ActivePhase);
          } else if (hash !== '#public' && hash !== '#teacher' && localStorage.getItem('mbp_admin_active') === '1') {
            setActivePhase('1a');
          }
        } else {
          await signOutAdmin().catch(() => {});
          try {
            localStorage.removeItem('mbp_admin_active');
          } catch {
            // Ignore storage errors
          }
          setAdminUser(null);
          setAuthError(verification.error);
          setActivePhase(prev => (prev === 'public' || prev === 'teacher_standalone' ? prev : 'public'));
          setToastMessage(verification.error);
          setTimeout(() => setToastMessage(null), 4500);
        }
      } catch {
        if (!active) return;
        setAdminUser(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Initialize and synchronize with Firestore in real-time
  useEffect(() => {
    let isMounted = true;
    let unsubscribeApps: () => void = () => {};
    let unsubscribeStudents: () => void = () => {};
    let unsubscribeTeacherMarks: () => void = () => {};
    let unsubscribeSettings: () => void = () => {};
    let unsubscribeSchools: () => void = () => {};
    let unsubscribeVenues: () => void = () => {};
    let unsubscribeBlocks: () => void = () => {};
    let unsubscribeSeatPlans: () => void = () => {};

    const initData = async () => {
      const preparedSchools: School[] = [];
      for (const s of INITIAL_SCHOOLS) {
        const pin = s.plainPin || '2601';
        const pinHash = await hashPin(pin);
        preparedSchools.push({
          ...s,
          pinHash,
          plainPin: pin
        });
      }

      // Initial block allocation
      const allocation = allocateSchoolBlocks({
        schools: preparedSchools,
        venues: INITIAL_VENUES,
        contestYear: DEFAULT_SETTINGS.yearCode,
        onlineSerialStart: DEFAULT_SETTINGS.onlineSerialStart,
        serialDigits: DEFAULT_SETTINGS.serialDigits
      });
      const initialBlocks = allocation.success ? allocation.blocks : [];

      // Default baseline students (only seeded if database is completely fresh and never seeded/wiped)
      const defaultStudentsList: Student[] = [
        {
          id: '2601001',
          category: '01',
          class: 4,
          nameBn: 'শুভজিৎ সিংহ',
          nameEn: 'SHUVAJIT SINGHA',
          fatherName: 'রবীন্দ্রনাথ সিংহ',
          motherName: 'অনিতা সিংহ',
          mobile: '01712345678',
          schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
          schoolId: 'S022',
          venueId: 'V02',
          source: 'school',
          createdAt: new Date().toISOString(),
          attendance: true,
          marks: 95,
          position: 1
        },
        {
          id: '2601002',
          category: '01',
          class: 5,
          nameBn: 'ক্ষিতীশ সিংহ',
          nameEn: 'KHITISH SINGHA',
          fatherName: 'সুনীল সিংহ',
          mobile: '01798765432',
          schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
          schoolId: 'S022',
          venueId: 'V02',
          source: 'school',
          createdAt: new Date().toISOString(),
          attendance: true,
          marks: 90,
          position: 2
        },
        {
          id: '2602001',
          category: '02',
          class: 7,
          nameBn: 'প্রজ্ঞা সিনহা',
          nameEn: 'PROGNA SINHA',
          fatherName: 'বিমল সিনহা',
          mobile: '01811223344',
          schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
          schoolId: 'S022',
          venueId: 'V02',
          source: 'school',
          createdAt: new Date().toISOString(),
          attendance: true,
          marks: 96,
          position: 1
        },
        {
          id: '2603001',
          category: '03',
          class: 10,
          nameBn: 'শান্তনু সিংহ',
          nameEn: 'SANTANU SINGHA',
          fatherName: 'যোগেন্দ্র সিংহ',
          mobile: '01755667788',
          schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
          schoolId: 'S022',
          venueId: 'V02',
          source: 'school',
          createdAt: new Date().toISOString(),
          attendance: true,
          marks: 94,
          position: 1
        }
      ];

      const defaultMarked = ['2601001', '2601002', '2602001', '2603001'];

      // Seed Firestore ONLY on first boot when empty and NOT previously wiped
      const meta = await seedInitialFirestoreData({
        defaultStudents: defaultStudentsList,
        defaultApplications: [],
        defaultMarkedIds: defaultMarked,
        defaultSettings: DEFAULT_SETTINGS,
        defaultSchools: preparedSchools,
        defaultVenues: INITIAL_VENUES,
        defaultBlocks: initialBlocks
      });

      if (!isMounted) return;

      // Hydrate from updated LocalStorage cache if available (useful when offline)
      setVenues(getCachedItem(LS_KEYS.VENUES, meta.venuesWiped ? [] : INITIAL_VENUES));
      setSchools(getCachedItem(LS_KEYS.SCHOOLS, meta.schoolsWiped ? [] : preparedSchools));
      setBlocks(getCachedItem(LS_KEYS.BLOCKS, meta.blocksWiped ? [] : initialBlocks));

      // Subscribe to real-time collections (always reflect empty snapshots accurately)
      unsubscribeApps = subscribeToApplications((liveApps) => {
        if (isMounted) setApplications(liveApps);
      });

      unsubscribeStudents = subscribeToStudents((liveStudents) => {
        if (isMounted) setStudents(liveStudents);
      });

      unsubscribeTeacherMarks = subscribeToTeacherMarks((liveMarks) => {
        if (isMounted) setMarkedSchoolIds(new Set(liveMarks));
      });

      unsubscribeSchools = subscribeToSchools((liveSchools) => {
        if (isMounted) setSchools(liveSchools);
      });

      unsubscribeVenues = subscribeToVenues((liveVenues) => {
        if (isMounted) setVenues(liveVenues);
      });

      unsubscribeBlocks = subscribeToBlocks((liveBlocks) => {
        if (isMounted) setBlocks(liveBlocks);
      });

      unsubscribeSeatPlans = subscribeToSeatPlans((livePlans) => {
        if (isMounted) setSeatPlans(livePlans);
      });

      let migratedSettingsOnce = false;
      unsubscribeSettings = subscribeToSettings(async (liveSettings) => {
        if (!liveSettings || !isMounted) return;
        let needsMigration = false;
        const next: ContestSettings = { ...liveSettings };

        // One-time migration: onlineSerialStart 901 -> 601
        if (!next.onlineSerialMigrated601 && next.onlineSerialStart === 901) {
          next.onlineSerialStart = 601;
          next.onlineSerialMigrated601 = true;
          needsMigration = true;
        }

        // One-time migration: set unified bilingual syllabus with separate বাংলা: and English: lines
        if (!next.syllabusUpdatedV5) {
          next.syllabuses = {
            '01': DEFAULT_SETTINGS.syllabuses['01'],
            '02': DEFAULT_SETTINGS.syllabuses['02'],
            '03': DEFAULT_SETTINGS.syllabuses['03']
          };
          next.syllabusUpdatedV2 = true;
          next.syllabusUpdatedV3 = true;
          next.syllabusUpdatedV4 = true;
          next.syllabusUpdatedV5 = true;
          needsMigration = true;
        }

        // One-time migration: switch helpline contact positions (01753-253127 first, then 01717-557419)
        if (!next.helplineSwitchedV1) {
          const currentHelpline = next.helplineNumbers || '';
          next.helplineNumbers = currentHelpline.includes('01717-557419, 01753-253127')
            ? currentHelpline.replace('01717-557419, 01753-253127', '01753-253127, 01717-557419')
            : DEFAULT_SETTINGS.helplineNumbers;
          next.helplineSwitchedV1 = true;
          needsMigration = true;
        }

        setSettings(next);

        if (needsMigration && !migratedSettingsOnce) {
          migratedSettingsOnce = true;
          try {
            await saveContestSettings(next);
          } catch (e) {
            console.warn('Settings one-time migration save failed:', e);
          }
        }
      });
    };

    initData();

    return () => {
      isMounted = false;
      unsubscribeApps();
      unsubscribeStudents();
      unsubscribeTeacherMarks();
      unsubscribeSettings();
      unsubscribeSchools();
      unsubscribeVenues();
      unsubscribeBlocks();
      unsubscribeSeatPlans();
    };
  }, []);

  // Hash route listener
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#public') {
        setActivePhase('public');
      } else if (hash === '#teacher') {
        setActivePhase('teacher_standalone');
      } else if (hash === '#admin') {
        if (!adminUser) {
          setShowAdminLoginModal(true);
        } else {
          setActivePhase('1a');
        }
      } else if (hash === '#1a' || hash === '#1b' || hash === '#2' || hash === '#3' || hash === '#4') {
        const targetPhase = hash.replace('#', '') as ActivePhase;
        if (!adminUser) {
          setShowAdminLoginModal(true);
        } else {
          setActivePhase(targetPhase);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [adminUser]);

  // Theme effect
  useEffect(() => {
    try {
      localStorage.setItem('mbp_theme', theme);
    } catch {
      // Ignore storage errors
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Phase selection with access check
  const handleSelectPhase = (phase: ActivePhase) => {
    if (phase === 'public') {
      setActivePhase('public');
      window.location.hash = 'public';
      return;
    }
    if (phase === 'teacher_standalone') {
      setActivePhase('teacher_standalone');
      window.location.hash = 'teacher';
      return;
    }
    // Admin check for private phases 1a, 1b, 2, 3, 4
    if (!adminUser) {
      setShowAdminLoginModal(true);
      return;
    }
    try {
      localStorage.setItem('mbp_admin_active', '1');
    } catch {
      // Ignore storage errors
    }
    setActivePhase(phase);
    window.location.hash = phase;
  };

  const handleAdminLogout = async () => {
    try {
      localStorage.removeItem('mbp_admin_auth');
      localStorage.removeItem('mbp_admin_active');
    } catch {
      // Ignore storage errors
    }
    await signOutAdmin().catch(() => {});
    setAdminUser(null);
    setActivePhase('public');
    window.location.hash = 'public';
    showNotification('অ্যাডমিন লগআউট সম্পন্ন হয়েছে। পাবলিক পোর্টালে ফেরত পাঠানো হয়েছে।');
  };

  // Partial / Granular dataset reset (requires verified Google Admin + RESET confirmation)
  const handlePartialReset = async (options: PartialResetOptions) => {
    await partialResetDataset(options);

    if (options.resetStudents) {
      setStudents([]);
      setSeatPlans([]);
    } else if (options.resetResults) {
      setStudents(prev => prev.map(s => {
        const copy = { ...s };
        delete copy.marks;
        delete copy.position;
        copy.attendance = false;
        return copy;
      }));
    }

    if (options.resetApplications) {
      setApplications([]);
    }

    if (options.resetTeacherMarks) {
      setMarkedSchoolIds(new Set());
    }

    if (options.resetSchools) {
      setSchools([]);
      setBlocks([]);
    }

    if (options.resetVenues) {
      setVenues([]);
      setSeatPlans([]);
    }

    if (options.resetSettings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        syllabusUpdatedV2: true,
        syllabusUpdatedV3: true,
        syllabusUpdatedV4: true,
        syllabusUpdatedV5: true,
        onlineSerialMigrated601: true,
        helplineSwitchedV1: true
      });
    }

    showNotification('নির্বাচিত ডেটাসেট অংশ সফলভাবে রিসেট করা হয়েছে!');
  };

  // State Mutators (persisted to Firestore & LocalStorage)
  const handleSaveVenue = async (venue: Venue) => {
    setVenues(prev => {
      const idx = prev.findIndex(v => v.id === venue.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = venue;
        return next;
      }
      return [...prev, venue];
    });
    await saveVenue(venue);
    showNotification('ভেন্যু সফলভাবে সংরক্ষিত হয়েছে!');
  };

  const handleDeleteVenue = async (venueId: string) => {
    setVenues(prev => prev.filter(v => v.id !== venueId));
    await deleteVenue(venueId);
    showNotification('ভেন্যু সফলভাবে মুছে ফেলা হয়েছে!');
  };

  const handleSaveSchool = async (school: School) => {
    setSchools(prev => {
      const idx = prev.findIndex(s => s.id === school.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = school;
        return next;
      }
      return [...prev, school];
    });
    await saveSchool(school);
    showNotification('বিদ্যালয় ও পিন তথ্য সংরক্ষিত হয়েছে!');
  };

  const handleDeleteSchool = async (schoolId: string) => {
    setSchools(prev => prev.filter(s => s.id !== schoolId));
    await deleteSchool(schoolId);
    showNotification('বিদ্যালয় সফলভাবে মুছে ফেলা হয়েছে!');
  };

  const handleCommitBlocks = async (newBlocks: NumberBlock[]) => {
    setBlocks(newBlocks);
    await saveBlocks(newBlocks);
    showNotification('ব্লক জেনারেশন চূড়ান্ত ও সংরক্ষিত করা হয়েছে!');
  };

  const handleSaveSettings = async (newSettings: ContestSettings) => {
    const withFlags: ContestSettings = {
      ...newSettings,
      syllabusUpdatedV2: true,
      syllabusUpdatedV3: true,
      syllabusUpdatedV4: true,
      syllabusUpdatedV5: true,
      onlineSerialMigrated601: true,
      helplineSwitchedV1: true
    };
    setSettings(withFlags);
    await saveContestSettings(withFlags);
    showNotification('প্রতিযোগিতা সেটিংস ও সিলেবাস সংরক্ষিত হয়েছে!');
  };

  // Teacher Send Numbers Handler (Phase 1b)
  const handleTeacherSendNumbers = async (schoolId: string, ids: string[]) => {
    const updatedMarked = new Set(markedSchoolIds);
    ids.forEach(id => updatedMarked.add(id));
    setMarkedSchoolIds(updatedMarked);
    await saveTeacherMarks(Array.from(updatedMarked));
    showNotification(`শিক্ষক প্যানেল থেকে ${ids.length}টি ফরম নম্বর জমা হয়েছে!`);
  };

  // Submit Online Application Handler (Phase 1b)
  const handleSubmitOnlineApplication = async (
    appData: Omit<OnlineApplication, 'id' | 'submittedAt' | 'status'>,
    assignedId: string
  ) => {
    const newApp = await saveOnlineApplication(appData, assignedId);
    setApplications(prev => [newApp, ...prev.filter(a => a.id !== newApp.id)]);
    showNotification(`অনলাইন আবেদন সফলভাবে জমা হয়েছে! বরাদ্দকৃত আইডি: ${assignedId}`);
    return newApp.id;
  };

  const dispatchApprovalSmsForApp = async (targetApp: OnlineApplication, regId: string) => {
    const recipientMobile = normalizeBdMobile(targetApp.mobile);
    const applicantName = (targetApp.nameEn || targetApp.nameBn || '').trim();
    const message = buildApprovalSmsMessage({
      applicantName,
      registrationId: regId,
      contestNameEn: settings.contestNameEn,
      organiserEn: settings.organiserEn
    });

    const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);

    const result = await sendApprovalSms({
      to: recipientMobile,
      message,
      applicationId: targetApp.id,
      registrationId: regId,
      idToken
    });

    const smsStatus: 'sent' | 'failed' | 'not_configured' = result.sent
      ? 'sent'
      : result.configured
        ? 'failed'
        : 'not_configured';

    const smsPatch = {
      smsStatus,
      smsSentAt: result.sent ? new Date().toISOString() : undefined,
      smsMessage: message,
      smsProvider: result.provider,
      smsError: result.sent ? undefined : result.error
    };

    setApplications(prev =>
      prev.map(a => (a.id === targetApp.id ? { ...a, ...smsPatch } : a))
    );

    await updateApplicationSmsStatus(targetApp.id, {
      ...smsPatch,
      to: result.to || recipientMobile,
      registrationId: regId
    });

    return result;
  };

  // Admin Verify Application Handler (Phase 1b)
  const handleVerifyApplication = async (appId: string, assignedId: string, venueId: string) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;

    const recipientMobile = normalizeBdMobile(app.mobile);
    if (!/^01[3-9]\d{8}$/.test(recipientMobile)) {
      showNotification(`আবেদনকারী ${app.nameBn || app.nameEn}-এর মোবাইল নম্বর (${app.mobile || 'খালি'}) সঠিক নয়!`);
      return;
    }

    const { app: updatedApp, student: newStudent } = await verifyOnlineApplication(app, assignedId, venueId);

    setStudents(prev => [newStudent, ...prev.filter(s => s.id !== assignedId)]);
    setApplications(prev => prev.map(a => a.id === appId ? updatedApp : a));

    if (!serverSmsConfigured) {
      const applicantName = (updatedApp.nameEn || updatedApp.nameBn || '').trim();
      const message = buildApprovalSmsMessage({
        applicantName,
        registrationId: assignedId,
        contestNameEn: settings.contestNameEn,
        organiserEn: settings.organiserEn
      });
      const smsPatch = {
        smsStatus: 'phone_app' as const,
        smsMessage: message
      };
      setApplications(prev =>
        prev.map(a => (a.id === updatedApp.id ? { ...a, ...smsPatch } : a))
      );
      await updateApplicationSmsStatus(updatedApp.id, {
        ...smsPatch,
        to: recipientMobile,
        registrationId: assignedId
      });
      showNotification(`আবেদন অনুমোদিত (আইডি: ${assignedId})! ${recipientMobile} নম্বরের জন্য ফোনের SMS অ্যাপ খোলা হয়েছে — শুধু Send চাপুন।`);
      return;
    }

    const smsResult = await dispatchApprovalSmsForApp(updatedApp, assignedId);
    if (smsResult.sent) {
      showNotification(`আবেদন অনুমোদিত! আইডি ${assignedId} বরাদ্দ ও ${recipientMobile} নম্বরে SMS পাঠানো হয়েছে।`);
    } else if (!smsResult.configured) {
      showNotification(`আবেদন অনুমোদিত (আইডি: ${assignedId})! আপনার ফোনের SMS অ্যাপ থেকে Send চাপুন।`);
    } else {
      showNotification(`আবেদন অনুমোদিত (আইডি: ${assignedId}), তবে SMS পাঠানো যায়নি: ${smsResult.error || 'গেটওয়ে ত্রুটি'}।`);
    }
  };

  const dispatchRejectionSmsForApp = async (targetApp: OnlineApplication, reason: string) => {
    const recipientMobile = normalizeBdMobile(targetApp.mobile);
    const applicantName = (targetApp.nameBn || targetApp.nameEn || '').trim();
    const message = buildRejectionSmsMessage({
      applicantName,
      registrationId: targetApp.assignedId,
      txnId: targetApp.txnId,
      reason,
      contestNameBn: settings.contestNameBn,
      organiserBn: settings.organiserBn
    });

    const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);

    const result = await sendApprovalSms({
      to: recipientMobile,
      message,
      applicationId: targetApp.id,
      registrationId: targetApp.assignedId,
      idToken
    });

    const smsStatus: 'sent' | 'failed' | 'not_configured' = result.sent
      ? 'sent'
      : result.configured
        ? 'failed'
        : 'not_configured';

    const smsPatch = {
      smsStatus,
      smsSentAt: result.sent ? new Date().toISOString() : undefined,
      smsMessage: message,
      smsProvider: result.provider,
      smsError: result.sent ? undefined : result.error
    };

    setApplications(prev =>
      prev.map(a => (a.id === targetApp.id ? { ...a, ...smsPatch } : a))
    );

    await updateApplicationSmsStatus(targetApp.id, {
      ...smsPatch,
      to: result.to || recipientMobile,
      registrationId: targetApp.assignedId
    });

    return result;
  };

  const handleResendApplicationSms = async (app: OnlineApplication) => {
    if (app.status === 'rejected') {
      const smsResult = await dispatchRejectionSmsForApp(
        app,
        app.reason || 'প্রদত্ত TrxID মেলেনি অথবা পেমেন্ট পাওয়া যায়নি'
      );
      if (smsResult.sent) {
        showNotification(`${app.mobile} নম্বরে আবেদন বাতিলের SMS পাঠানো হয়েছে!`);
      } else if (!smsResult.configured) {
        showNotification('সার্ভার SMS গেটওয়ে কনফিগার করা নেই — কার্ডের "SMS অ্যাপে পাঠান" বাটনে ক্লিক করে ফোন থেকে পাঠান।');
      } else {
        showNotification(`SMS পাঠানো ব্যর্থ হয়েছে: ${smsResult.error || 'গেটওয়ে ত্রুটি'}।`);
      }
      return;
    }

    const regId = app.assignedId;
    if (!regId) return;
    const smsResult = await dispatchApprovalSmsForApp(app, regId);
    if (smsResult.sent) {
      showNotification(`${app.mobile} নম্বরে নিশ্চিতকরণ SMS পাঠানো হয়েছে!`);
    } else if (!smsResult.configured) {
      showNotification('সার্ভার SMS গেটওয়ে কনফিগার করা নেই — কার্ডের "SMS অ্যাপ" বাটনে ক্লিক করে ফোন থেকে পাঠান।');
    } else {
      showNotification(`SMS পাঠানো ব্যর্থ হয়েছে: ${smsResult.error || 'গেটওয়ে ত্রুটি'}।`);
    }
  };

  // Admin Reject Application Handler (Phase 1b)
  const handleRejectApplication = async (appId: string, reason: string) => {
    const app = applications.find(a => a.id === appId);
    await rejectOnlineApplication(appId, reason);
    const updatedApp: OnlineApplication | undefined = app
      ? {
          ...app,
          status: 'rejected',
          reason,
          verifiedAt: new Date().toISOString()
        }
      : undefined;

    setApplications(prev =>
      prev.map(a =>
        a.id === appId
          ? {
              ...a,
              status: 'rejected',
              reason
            }
          : a
      )
    );

    if (!updatedApp) {
      showNotification('আবেদন বাতিল করা হয়েছে।');
      return;
    }

    const recipientMobile = normalizeBdMobile(updatedApp.mobile);
    if (!/^01[3-9]\d{8}$/.test(recipientMobile)) {
      showNotification(
        `আবেদন বাতিল করা হয়েছে${updatedApp.assignedId ? ` এবং নম্বর ${updatedApp.assignedId} উন্মুক্ত হয়েছে` : ''}।`
      );
      return;
    }

    if (!serverSmsConfigured) {
      const applicantName = (updatedApp.nameBn || updatedApp.nameEn || '').trim();
      const message = buildRejectionSmsMessage({
        applicantName,
        registrationId: updatedApp.assignedId,
        txnId: updatedApp.txnId,
        reason,
        contestNameBn: settings.contestNameBn,
        organiserBn: settings.organiserBn
      });
      const smsPatch = {
        smsStatus: 'phone_app' as const,
        smsMessage: message
      };
      setApplications(prev =>
        prev.map(a => (a.id === updatedApp.id ? { ...a, ...smsPatch } : a))
      );
      await updateApplicationSmsStatus(updatedApp.id, {
        ...smsPatch,
        to: recipientMobile,
        registrationId: updatedApp.assignedId
      });
      showNotification(
        `আবেদন বাতিল করা হয়েছে${updatedApp.assignedId ? ` (নম্বর ${updatedApp.assignedId} উন্মুক্ত হয়েছে)` : ''}! ${recipientMobile} নম্বরের জন্য ফোনের SMS অ্যাপ খোলা হয়েছে — শুধু Send চাপুন।`
      );
      return;
    }

    const smsResult = await dispatchRejectionSmsForApp(updatedApp, reason);
    if (smsResult.sent) {
      showNotification(
        `আবেদন বাতিল ও ${recipientMobile} নম্বরে SMS পাঠানো হয়েছে${updatedApp.assignedId ? ` (নম্বর ${updatedApp.assignedId} উন্মুক্ত হয়েছে)` : ''}।`
      );
    } else if (!smsResult.configured) {
      showNotification(
        `আবেদন বাতিল করা হয়েছে${updatedApp.assignedId ? ` (নম্বর ${updatedApp.assignedId} উন্মুক্ত হয়েছে)` : ''}! ফোনের SMS অ্যাপ থেকে Send চাপুন।`
      );
    } else {
      showNotification(
        `আবেদন বাতিল হয়েছে, তবে SMS পাঠানো যায়নি: ${smsResult.error || 'গেটওয়ে ত্রুটি'}।`
      );
    }
  };

  // Persist Seat Plans & Student Seat Metadata (Phase 2)
  const handleSaveSeatPlans = async (plans: SeatPlanResult[], updatedStudents: Student[]) => {
    const replacedIds = new Set(plans.map(p => p.venueId));
    setSeatPlans(prev => [
      ...plans,
      ...prev.filter(p => !replacedIds.has(p.venueId))
    ]);
    await saveSeatPlansBatch(plans);

    if (updatedStudents.length > 0) {
      const updatedMap = new Map(updatedStudents.map(s => [s.id, s]));
      const mergedStudents = students.map(s => updatedMap.get(s.id) || s);
      setStudents(mergedStudents);
      await saveStudentsBatch(mergedStudents);
    }
    showNotification('সিট প্ল্যান এবং প্রকৃত ভেন্যু/আসন তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // Save Student (Phase 2 Data Entry & Directory)
  const handleSaveStudent = async (student: Student) => {
    await saveStudent(student);
    setStudents(prev => {
      const idx = prev.findIndex(s => s.id === student.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = student;
        return next;
      }
      return [student, ...prev];
    });

    const updatedMarked = new Set(markedSchoolIds).add(student.id);
    setMarkedSchoolIds(updatedMarked);
    await saveTeacherMarks(Array.from(updatedMarked));
  };

  // Delete Student
  const handleDeleteStudent = async (studentId: string) => {
    await deleteStudent(studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    showNotification(`শিক্ষার্থী ${studentId} সফলভাবে মুছে ফেলা হয়েছে।`);
  };

  // Mark Attendance (Phase 3)
  const handleMarkAttendance = async (studentId: string, volunteerName: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const updated = { ...student, attendance: true };
      await saveStudent(updated);
      setStudents(prev => prev.map(s => s.id === studentId ? updated : s));
    }
  };

  // Register Walk-In (Phase 3)
  const handleRegisterWalkIn = async (studentData: Omit<Student, 'id' | 'createdAt'>) => {
    const existingIds = new Set(students.map(s => s.id));
    const yearCode = settings.yearCode || '26';
    const digits = settings.serialDigits || 3;
    let serial = 501;
    while (existingIds.has(formatRegistrationId(yearCode, studentData.category, serial, digits))) {
      serial++;
    }
    const walkInId = formatRegistrationId(yearCode, studentData.category, serial, digits);
    const newStudent: Student = {
      ...studentData,
      id: walkInId,
      source: 'walkin',
      attendance: true,
      createdAt: new Date().toISOString()
    };
    setStudents(prev => [newStudent, ...prev]);
    await saveStudent(newStudent);
    showNotification(`ওয়াক-ইন শিক্ষার্থী ${walkInId} নিবন্ধিত ও উপস্থিত মার্ক করা হয়েছে!`);
    return walkInId;
  };

  // Save Marks (Phase 4)
  const handleSaveMarks = async (updatedList: Student[]) => {
    setStudents(updatedList);
    await saveStudentsBatch(updatedList);
    showNotification('শিক্ষার্থীদের নম্বর ও ফলাফল সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // Database Seed
  const handleSeedDatabase = async () => {
    showNotification('ডাটাবেজ সিডার চলছে...');
    const res = await runSeedData();
    showNotification(res.message);
  };

  // Real-Time Registration Counts
  const totalRegisteredCount = new Set([
    ...Array.from(markedSchoolIds),
    ...students.map(s => s.id)
  ]).size;

  const categoryCounts: Record<CategoryCode, number> = {
    '01': students.filter(s => s.category === '01').length + Array.from(markedSchoolIds).filter(id => id.slice(2, 4) === '01' && !students.some(s => s.id === id)).length,
    '02': students.filter(s => s.category === '02').length + Array.from(markedSchoolIds).filter(id => id.slice(2, 4) === '02' && !students.some(s => s.id === id)).length,
    '03': students.filter(s => s.category === '03').length + Array.from(markedSchoolIds).filter(id => id.slice(2, 4) === '03' && !students.some(s => s.id === id)).length
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} relative flex flex-col transition-colors duration-200 print:min-h-0 print:bg-white print:text-black`}>
      <NetworkBackground />

      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-sm z-50">
          <WifiOff className="w-4 h-4" />
          <span>অফলাইন মোড: ডাটা ডিভাইসে সংরক্ষিত থাকবে এবং সংযোগ ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।</span>
        </div>
      )}

      {/* Navigation Header */}
      <nav aria-label="Main Navigation" className="print:hidden sticky top-0 z-50 bg-slate-900 text-white border-b border-indigo-950 shadow-md">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between h-14 overflow-x-auto scrollbar-none gap-2">
          
          {/* Logo and Brand */}
          <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-slate-700">
            <img 
              src="/assets/aistudio/mbp_d0333f88.jpg" 
              alt="MBP Logo" 
              className="w-8 h-8 object-contain rounded bg-white p-0.5"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-xs text-amber-300">
                মণিপুরি বিজ্ঞান প্রজন্ম
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Math Quiz 2026
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {adminUser && (
              <>
                <button
                  onClick={() => setIsHamburgerOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition flex items-center gap-2 shadow-sm ring-2 ring-indigo-400 cursor-pointer"
                  title="সকল ৫টি ফেজ ও সাব-মেনু খুলুন"
                >
                  <Menu className="w-4 h-4 text-amber-300" />
                  <span>মেনু (Menu)</span>
                </button>

                <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-amber-300 text-xs font-bold">
                  {activePhase === '1a' ? '১ক. ফরম ও ব্লক' :
                   activePhase === '1b' ? '১খ. পেমেন্ট ও শিক্ষক' :
                   activePhase === '2' ? '২. সিট প্ল্যান ও ডাটা' :
                   activePhase === '3' ? '৩. লাইভ হাজিরা' :
                   activePhase === '4' ? '৪. ফলাফল ও সনদ' : 'পাবলিক ভিউ'}
                </span>
              </>
            )}

            {activePhase === 'teacher_standalone' && (
              <button
                onClick={() => handleSelectPhase('public')}
                className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>পাবলিক পোর্টালে ফেরত</span>
              </button>
            )}

            {/* Public Portal Button Always Visible */}
            <button
              onClick={() => handleSelectPhase('public')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activePhase === 'public' 
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400' 
                  : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>পাবলিক পোর্টাল</span>
            </button>
          </div>

          {/* User Controls & Actions */}
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-700">
            {adminUser ? (
              <>
                <button
                  onClick={() => setShowResetModal(true)}
                  title="ডামি ডেটা ও ডেটাসেট ক্লিন করুন (Reset Dataset)"
                  className="px-2.5 py-1.5 bg-rose-600/90 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">রিসেট ডেটাসেট</span>
                </button>

                <button
                  onClick={handleAdminLogout}
                  title="অ্যাডমিন লগআউট"
                  className="px-2.5 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">লগআউট</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAdminLoginModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>অ্যাডমিন লগইন</span>
              </button>
            )}

            {/* Database Seeder (Admin only) */}
            {adminUser && (
              <button
                onClick={handleSeedDatabase}
                title="ডাটাবেজ সিডার চালান"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                <Database className="w-4 h-4 text-indigo-400" />
              </button>
            )}

            {/* Dark / Light Mode Toggle */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              aria-label="Toggle theme"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>

        </div>
      </nav>

      {/* Secondary Phase Sub-Navigation (Hidden during print or public) */}
      {activePhase !== 'public' && adminUser && (
        <div className="print:hidden bg-white/95 dark:bg-slate-900/95 border-b border-gray-200 dark:border-slate-800 backdrop-blur-md px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex overflow-x-auto gap-2 py-2 text-xs font-semibold scrollbar-none">
            
            {/* Phase 1a Sub-tabs */}
            {activePhase === '1a' && (
              <>
                <button
                  onClick={() => setTab1a('print')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1a === 'print' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  মুদ্রণযোগ্য ফরম ও কভার শীট (Print & Download Forms)
                </button>
                <button
                  onClick={() => setTab1a('blocks')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1a === 'blocks' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  ব্লক জেনারেশন ({blocks.length})
                </button>
                <button
                  onClick={() => setTab1a('schools')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1a === 'schools' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  বিদ্যালয়সমূহ ও কোটা ({schools.length})
                </button>
                <button
                  onClick={() => setTab1a('venues')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1a === 'venues' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  ভেন্যু ও কক্ষ ব্যবস্থাপনা ({venues.length})
                </button>
                <button
                  onClick={() => setTab1a('settings')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1a === 'settings' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  কনটেস্ট সেটিংস ও সিলেবাস ইনপুট
                </button>
              </>
            )}

            {/* Phase 1b Sub-tabs */}
            {activePhase === '1b' && (
              <>
                <button
                  onClick={() => setTab1b('payments')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1b === 'payments' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  অনলাইন পেমেন্ট ভেরিফিকেশন ({applications.filter(a => a.status === 'pending').length} অপেক্ষমান)
                </button>
                <button
                  onClick={() => setTab1b('bulk-sms')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1b === 'bulk-sms' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  গণ-বার্তা ও রিমাইন্ডার SMS (Bulk SMS)
                </button>
                <button
                  onClick={() => setTab1b('teacher')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1b === 'teacher' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  শিক্ষক প্যানেল সিমুলেটর (Teacher Panel)
                </button>
                <button
                  onClick={() => setTab1b('check')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab1b === 'check' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  রেজিস্ট্রেশন স্ট্যাটাস ও প্রবেশপত্র যাচাই
                </button>
              </>
            )}

            {/* Phase 2 Sub-tabs */}
            {activePhase === '2' && (
              <>
                <button
                  onClick={() => setTab2('seat-plan')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab2 === 'seat-plan' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  সিট প্ল্যান জেনারেটর ও পরিদর্শক শিক্ষক (Seat Plan & Invigilators)
                </button>
                <button
                  onClick={() => setTab2('data-entry')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab2 === 'data-entry' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  কাগজের ফরম দ্রুত ডাটা এন্ট্রি (Data Entry)
                </button>
                <button
                  onClick={() => setTab2('students')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab2 === 'students' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  শিক্ষার্থী ডিরেক্টরি ({students.length} জন) & Excel
                </button>
                <button
                  onClick={() => setTab2('general-dataset')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab2 === 'general-dataset' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  অনলাইন সাধারণ ডেটাসেট ({applications.length} জন)
                </button>
              </>
            )}

            {/* Phase 3 Sub-tabs */}
            {activePhase === '3' && (
              <>
                <button
                  onClick={() => setTab3('scanner')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab3 === 'scanner' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  লাইভ বিরতিহীন হাজিরা স্ক্যানার (Continuous Scanner)
                </button>
                <button
                  onClick={() => setTab3('walkin')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab3 === 'walkin' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  জরুরি স্পট / ওয়াক-ইন নিবন্ধন ({students.filter(s => s.source === 'walkin').length})
                </button>
              </>
            )}

            {/* Phase 4 Sub-tabs */}
            {activePhase === '4' && (
              <>
                <button
                  onClick={() => setTab4('results')}
                  className={`py-1.5 px-3 rounded-lg transition ${tab4 === 'results' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                >
                  ১ম, ২য়, ৩য় নির্ধারণ, ৩ স্বাক্ষরকারী ও ইংরেজি সনদ
                </button>
              </>
            )}

          </div>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-6 z-10 overflow-x-hidden print:p-0 print:m-0 print:max-w-none print:overflow-visible">
        
        {/* Floating Toast */}
        {toastMessage && (
          <div className="print:hidden mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* =========================================================================
            PHASE 1A: PRINT-READY FORMS & BLOCKS
           ========================================================================= */}
        {activePhase === '1a' && adminUser && (
          <div className="space-y-6">
            {tab1a === 'print' && (
              <PrintBundleView
                schools={schools}
                venues={venues}
                blocks={blocks}
                settings={settings}
                onBack={() => setTab1a('blocks')}
              />
            )}

            {tab1a === 'blocks' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-950 dark:text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <span>বরাদ্দকৃত ব্লক তালিকা ({blocks.length} টি ব্লক)</span>
                    </h2>
                    <p className="text-xs text-gray-500">
                      বিদ্যালয়ের ক্রম অনুযায়ী ধারাবাহিক ও নন-ওভারল্যাপিং নম্বর বরাদ্দ।
                    </p>
                  </div>
                  <button
                    onClick={() => setShowBlockModal(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Layers className="w-4 h-4" />
                    <span>স্বয়ংক্রিয় ব্লক পুনঃবণ্টন ও পূর্বরূপ</span>
                  </button>
                </div>

                {/* Blocks Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-gray-300 uppercase tracking-wider font-semibold border-b">
                        <tr>
                          <th className="py-2.5 px-3">টাইপ</th>
                          <th className="py-2.5 px-3">বিদ্যালয়</th>
                          <th className="py-2.5 px-3">ক্যাটাগরি</th>
                          <th className="py-2.5 px-2 text-center">সংখ্যা</th>
                          <th className="py-2.5 px-3 text-center">প্রথম আইডি</th>
                          <th className="py-2.5 px-3 text-center">শেষ আইডি</th>
                          <th className="py-2.5 px-3">ভেন্যু</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-gray-800 dark:text-gray-200">
                        {blocks.map(b => (
                          <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                b.type === 'school' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' :
                                b.type === 'online' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200' :
                                'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                              }`}>
                                {b.type === 'school' ? 'স্কুল' : b.type === 'online' ? 'অনলাইন' : 'স্পেয়ার'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold">{b.schoolName}</td>
                            <td className="py-2.5 px-3 font-semibold">{b.category === '01' ? 'প্রাথমিক' : b.category === '02' ? 'নিম্ন মাধ্যমিক' : 'মাধ্যমিক'}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold">{b.count}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">{b.firstId}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">{b.lastId}</td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{b.venueName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab1a === 'schools' && (
              <SchoolsManager
                schools={schools}
                venues={venues}
                onSaveSchool={handleSaveSchool}
                onDeleteSchool={handleDeleteSchool}
              />
            )}

            {tab1a === 'venues' && (
              <VenuesManager
                venues={venues}
                onSaveVenue={handleSaveVenue}
                onDeleteVenue={handleDeleteVenue}
              />
            )}

            {tab1a === 'settings' && (
              <SettingsManager
                settings={settings}
                onSaveSettings={handleSaveSettings}
                onOpenResetModal={() => setShowResetModal(true)}
              />
            )}
          </div>
        )}

        {/* =========================================================================
            PHASE 1B: ONLINE REGISTRATION & TEACHER PANEL (ADMIN VIEW)
           ========================================================================= */}
        {activePhase === '1b' && adminUser && (
          <div className="space-y-6">
            {tab1b === 'payments' && (
              <PaymentsManager
                applications={applications}
                students={students}
                venues={venues}
                settings={settings}
                serverSmsConfigured={serverSmsConfigured}
                onVerifyApplication={handleVerifyApplication}
                onRejectApplication={handleRejectApplication}
                onResendSms={handleResendApplicationSms}
              />
            )}

            {tab1b === 'bulk-sms' && (
              <BulkSmsManager
                students={students}
                applications={applications}
                venues={venues}
                seatPlans={seatPlans}
                settings={settings}
                serverSmsConfigured={serverSmsConfigured}
                onNotify={showNotification}
              />
            )}

            {tab1b === 'teacher' && (
              <TeacherPanel
                schools={schools}
                venues={venues}
                blocks={blocks}
                markedIds={markedSchoolIds}
                onSendNumbers={handleTeacherSendNumbers}
                onClose={() => setTab1b('payments')}
              />
            )}

            {tab1b === 'check' && (
              <div className="max-w-xl mx-auto">
                <CheckStatusModal
                  students={students}
                  applications={applications}
                  markedSchoolIds={markedSchoolIds}
                  blocks={blocks}
                  venues={venues}
                  seatPlans={seatPlans}
                  settings={settings}
                  onClose={() => setTab1b('payments')}
                />
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            PHASE 2: DATA ENTRY, STUDENTS & SEAT PLAN
           ========================================================================= */}
        {activePhase === '2' && adminUser && (
          <div className="space-y-6">
            {tab2 === 'seat-plan' && (
              <SeatPlanGenerator
                venues={venues}
                students={students}
                settings={settings}
                seatPlans={seatPlans}
                onSaveSettings={handleSaveSettings}
                onSaveVenue={handleSaveVenue}
                onSaveSeatPlans={handleSaveSeatPlans}
              />
            )}

            {tab2 === 'data-entry' && (
              <DataEntryView
                blocks={blocks}
                existingStudents={students}
                onSaveStudent={handleSaveStudent}
              />
            )}

            {tab2 === 'students' && (
              <StudentsDirectory
                students={students}
                venues={venues}
                onSaveStudent={handleSaveStudent}
                onDeleteStudent={handleDeleteStudent}
              />
            )}

            {tab2 === 'general-dataset' && (
              <OnlineGeneralDataset applications={applications} />
            )}
          </div>
        )}

        {/* =========================================================================
            PHASE 3: QUIZ DAY & CONTINUOUS ATTENDANCE
           ========================================================================= */}
        {activePhase === '3' && adminUser && (
          <div className="space-y-6">
            {tab3 === 'scanner' && (
              <AttendanceScanner
                venues={venues}
                students={students}
                onMarkAttendance={handleMarkAttendance}
                onRegisterWalkIn={handleRegisterWalkIn}
              />
            )}

            {tab3 === 'walkin' && (
              <div className="max-w-md mx-auto bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm space-y-4 text-xs">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  জরুরি স্পট / ওয়াক-ইন রেজিস্ট্রেশন
                </h3>
                <p className="text-gray-500">
                  পরীক্ষার দিন স্পেয়ার ব্লক (501-600) থেকে তাৎক্ষণিক নতুন শিক্ষার্থী নিবন্ধন করে হাজিরা নিশ্চিত করুন।
                </p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const target = e.target as any;
                  await handleRegisterWalkIn({
                    category: target.category.value,
                    class: parseInt(target.studentClass.value, 10),
                    nameBn: target.nameBn.value,
                    nameEn: target.nameEn.value,
                    fatherName: target.fatherName.value,
                    mobile: target.mobile.value,
                    schoolName: target.schoolName.value,
                    venueId: getPreferredExamVenueId(venues),
                    source: 'walkin'
                  });
                  target.reset();
                  setTab3('scanner');
                }} className="space-y-3">
                  <div>
                    <label className="block font-bold mb-1">ক্যাটাগরি</label>
                    <select name="category" className="w-full p-2 border rounded-lg dark:bg-slate-900">
                      <option value="01">প্রাথমিক (০১)</option>
                      <option value="02">নিম্ন মাধ্যমিক (০২)</option>
                      <option value="03">মাধ্যমিক (০৩)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">শ্রেণি</label>
                    <input type="number" min={3} max={10} defaultValue={5} name="studentClass" className="w-full p-2 border rounded-lg dark:bg-slate-900" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">বাংলা নাম</label>
                    <input type="text" required name="nameBn" placeholder="শিক্ষার্থীর নাম" className="w-full p-2 border rounded-lg dark:bg-slate-900" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">English Name</label>
                    <input type="text" required name="nameEn" placeholder="NAME IN CAPITALS" className="w-full p-2 border rounded-lg dark:bg-slate-900 uppercase" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">পিতার নাম</label>
                    <input type="text" required name="fatherName" placeholder="পিতার নাম" className="w-full p-2 border rounded-lg dark:bg-slate-900" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">বিদ্যালয়ের নাম</label>
                    <input type="text" required name="schoolName" placeholder="বিদ্যালয়" className="w-full p-2 border rounded-lg dark:bg-slate-900" />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">মোবাইল নম্বর</label>
                    <input type="tel" name="mobile" placeholder="01XXXXXXXXX" className="w-full p-2 border rounded-lg dark:bg-slate-900 font-mono" />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md">
                    স্পট নিবন্ধন ও হাজিরা দিন
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            PHASE 4: RESULTS & CERTIFICATES
           ========================================================================= */}
        {activePhase === '4' && adminUser && (
          <div className="space-y-6">
            <ResultsManager
              students={students}
              settings={settings}
              onSaveMarks={handleSaveMarks}
              onSaveSettings={handleSaveSettings}
            />
          </div>
        )}

        {/* =========================================================================
            PUBLIC PORTAL VIEW (ALWAYS OPEN & ACCESSIBLE)
           ========================================================================= */}
        {activePhase === 'public' && (
          <PublicPortal
            settings={settings}
            totalRegistered={totalRegisteredCount}
            categoryCounts={categoryCounts}
            onOpenOnlineRegistration={() => setShowOnlineRegModal(true)}
            onOpenCheckStatus={() => setShowCheckStatusModal(true)}
            onOpenTeacherPanel={() => {
              setActivePhase('teacher_standalone');
              window.location.hash = 'teacher';
            }}
            onOpenAdminLogin={() => setShowAdminLoginModal(true)}
            onOpenResultsCheck={() => setShowPublicResultsModal(true)}
          />
        )}

        {/* =========================================================================
            STANDALONE TEACHER PORTAL (FOR PUBLIC / TEACHERS - User Request #3)
            Renders identically to admin view with full width & zero clipping
           ========================================================================= */}
        {activePhase === 'teacher_standalone' && (
          <div className="space-y-4">
            <TeacherPanel
              schools={schools}
              venues={venues}
              blocks={blocks}
              markedIds={markedSchoolIds}
              onSendNumbers={handleTeacherSendNumbers}
              onClose={() => {
                setActivePhase('public');
                window.location.hash = 'public';
              }}
            />
          </div>
        )}

      </main>

      {/* =========================================================================
          HAMBURGER MENU DRAWER (User Request #4)
          All 5 heading menus:
          ১ক. ফরম ও ব্লক, ১খ. পেমেন্ট ও শিক্ষক, ২. সিট প্ল্যান ও ডাটা, ৩. লাইভ হাজিরা, ৪. ফলাফল ও সনদ
          appear inside hamburger menu. Selecting a menu reveals the sub-menus under it.
         ========================================================================= */}
      {isHamburgerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-start animate-fade-in font-['Hind_Siliguri',sans-serif]">
          <div className="fixed inset-0" onClick={() => setIsHamburgerOpen(false)}></div>

          <div className="relative w-84 sm:w-96 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col border-r border-indigo-950 z-10 overflow-y-auto">
            
            {/* Drawer Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img 
                  src="/assets/aistudio/mbp_d0333f88.jpg" 
                  alt="MBP Logo" 
                  className="w-8 h-8 object-contain rounded bg-white p-0.5"
                />
                <div>
                  <h3 className="font-extrabold text-sm text-white leading-tight">অ্যাডমিন নেভিগেশন মেনু</h3>
                  <p className="text-[10px] text-amber-300 font-mono">MBP Math Quiz 2026</p>
                </div>
              </div>
              <button
                onClick={() => setIsHamburgerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 5 Main Heading Menus */}
            <div className="p-3 sm:p-4 space-y-2.5 flex-1">
              
              {/* Heading 1: ১ক. ফরম ও ব্লক */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(prev => prev === '1a' ? null : '1a')}
                  className={`w-full p-3 flex items-center justify-between text-left transition ${
                    activePhase === '1a' ? 'bg-indigo-900/60 text-white font-black' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                      <Printer className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block">১ক. ফরম ও ব্লক</span>
                      <span className="text-[10px] text-slate-400">মুদ্রণযোগ্য ফরম, ব্লক ও সিলেবাস</span>
                    </div>
                  </div>
                  {expandedMenu === '1a' ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedMenu === '1a' && (
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 space-y-1 text-xs">
                    <button
                      onClick={() => { setTab1a('print'); setActivePhase('1a'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1a === 'print' && activePhase === '1a' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>মুদ্রণযোগ্য ফরম ও কভার শীট (Print & PDF)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1a('blocks'); setActivePhase('1a'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1a === 'blocks' && activePhase === '1a' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>ব্লক জেনারেশন ({blocks.length} টি ব্লক)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1a('schools'); setActivePhase('1a'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1a === 'schools' && activePhase === '1a' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>বিদ্যালয়সমূহ ও কোটা ({schools.length} টি)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1a('venues'); setActivePhase('1a'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1a === 'venues' && activePhase === '1a' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>ভেন্যু ও কক্ষ ব্যবস্থাপনা ({venues.length} টি)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1a('settings'); setActivePhase('1a'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1a === 'settings' && activePhase === '1a' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>কনটেস্ট সেটিংস ও সিলেবাস ইনপুট</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Heading 2: ১খ. পেমেন্ট ও শিক্ষক */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(prev => prev === '1b' ? null : '1b')}
                  className={`w-full p-3 flex items-center justify-between text-left transition ${
                    activePhase === '1b' ? 'bg-indigo-900/60 text-white font-black' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-pink-600/30 text-pink-400 flex items-center justify-center font-bold">
                      <CreditCard className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block">১খ. পেমেন্ট ও শিক্ষক</span>
                      <span className="text-[10px] text-slate-400">অনলাইন পেমেন্ট ও শিক্ষক প্যানেল</span>
                    </div>
                  </div>
                  {expandedMenu === '1b' ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedMenu === '1b' && (
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 space-y-1 text-xs">
                    <button
                      onClick={() => { setTab1b('payments'); setActivePhase('1b'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1b === 'payments' && activePhase === '1b' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>অনলাইন পেমেন্ট ভেরিফিকেশন ({applications.filter(a => a.status === 'pending').length} অপেক্ষমান)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1b('bulk-sms'); setActivePhase('1b'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1b === 'bulk-sms' && activePhase === '1b' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>গণ-বার্তা ও রিমাইন্ডার SMS (Bulk SMS)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1b('teacher'); setActivePhase('1b'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1b === 'teacher' && activePhase === '1b' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>শিক্ষক প্যানেল সিমুলেটর (Teacher Panel)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab1b('check'); setActivePhase('1b'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab1b === 'check' && activePhase === '1b' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>রেজিস্ট্রেশন স্ট্যাটাস ও প্রবেশপত্র যাচাই</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Heading 3: ২. সিট প্ল্যান ও ডাটা */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(prev => prev === '2' ? null : '2')}
                  className={`w-full p-3 flex items-center justify-between text-left transition ${
                    activePhase === '2' ? 'bg-indigo-900/60 text-white font-black' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold">
                      <Armchair className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block">২. সিট প্ল্যান ও ডাটা</span>
                      <span className="text-[10px] text-slate-400">সিট প্ল্যান, পরিদর্শক ও নম্বর এন্ট্রি</span>
                    </div>
                  </div>
                  {expandedMenu === '2' ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedMenu === '2' && (
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 space-y-1 text-xs">
                    <button
                      onClick={() => { setTab2('seat-plan'); setActivePhase('2'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab2 === 'seat-plan' && activePhase === '2' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>সিট প্ল্যান জেনারেটর ও পরিদর্শক শিক্ষক</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab2('data-entry'); setActivePhase('2'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab2 === 'data-entry' && activePhase === '2' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>কাগজের ফরম দ্রুত ডাটা এন্ট্রি</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab2('students'); setActivePhase('2'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab2 === 'students' && activePhase === '2' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>শিক্ষার্থী ডিরেক্টরি ও নম্বর এন্ট্রি ({students.length} জন)</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab2('general-dataset'); setActivePhase('2'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab2 === 'general-dataset' && activePhase === '2' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>অনলাইন সাধারণ ডেটাসেট (আসন্ন ইভেন্ট) ({applications.length})</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Heading 4: ৩. লাইভ হাজিরা */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(prev => prev === '3' ? null : '3')}
                  className={`w-full p-3 flex items-center justify-between text-left transition ${
                    activePhase === '3' ? 'bg-indigo-900/60 text-white font-black' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-cyan-600/30 text-cyan-400 flex items-center justify-center font-bold">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block">৩. লাইভ হাজিরা</span>
                      <span className="text-[10px] text-slate-400">QR স্ক্যানার ও স্পট রেজিস্ট্রেশন</span>
                    </div>
                  </div>
                  {expandedMenu === '3' ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedMenu === '3' && (
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 space-y-1 text-xs">
                    <button
                      onClick={() => { setTab3('scanner'); setActivePhase('3'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab3 === 'scanner' && activePhase === '3' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>লাইভ বিরতিহীন হাজিরা স্ক্যানার</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    <button
                      onClick={() => { setTab3('walkin'); setActivePhase('3'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab3 === 'walkin' && activePhase === '3' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>জরুরি স্পট / ওয়াক-ইন নিবন্ধন</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Heading 5: ৪. ফলাফল ও সনদ */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(prev => prev === '4' ? null : '4')}
                  className={`w-full p-3 flex items-center justify-between text-left transition ${
                    activePhase === '4' ? 'bg-indigo-900/60 text-white font-black' : 'text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-600/30 text-amber-400 flex items-center justify-center font-bold">
                      <Trophy className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block">৪. ফলাফল ও সনদ</span>
                      <span className="text-[10px] text-slate-400">১ম-২য়-৩য়, PNG স্বাক্ষর ও ইংরেজি সনদ</span>
                    </div>
                  </div>
                  {expandedMenu === '4' ? <ChevronDown className="w-4 h-4 text-amber-300" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>

                {expandedMenu === '4' && (
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 space-y-1 text-xs">
                    <button
                      onClick={() => { setTab4('results'); setActivePhase('4'); setIsHamburgerOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition ${tab4 === 'results' && activePhase === '4' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
                    >
                      <span>১ম, ২য়, ৩য় শ্রেণিভিত্তিক ফলাফল, ৩ জনের PNG স্বাক্ষর ও সনদ</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Actions inside Drawer */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-2">
              <button
                onClick={() => { setActivePhase('public'); setIsHamburgerOpen(false); }}
                className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Globe className="w-4 h-4" />
                <span>পাবলিক পোর্টাল দেখুন</span>
              </button>

              {adminUser && (
                <button
                  onClick={() => { setIsHamburgerOpen(false); setShowResetModal(true); }}
                  className="w-full py-2 px-3 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>রিসেট ও ক্লিন ডেটাসেট</span>
                </button>
              )}

              <button
                onClick={() => { setIsHamburgerOpen(false); handleAdminLogout(); }}
                className="w-full py-2 px-3 bg-red-950 hover:bg-red-900 border border-red-800 text-red-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>অ্যাডমিন লগআউট</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Public Individual Results & Certificate Modal (User Request #1) */}
      {showPublicResultsModal && (
        <PublicResultsModal
          students={students}
          settings={settings}
          onClose={() => setShowPublicResultsModal(false)}
        />
      )}

      {/* Admin Login Modal */}
      {showAdminLoginModal && (
        <AdminLoginModal
          initialError={authError}
          onLoginSuccess={(user) => {
            setAdminUser(user);
            setAuthError(null);
            setShowAdminLoginModal(false);
            try {
              localStorage.setItem('mbp_admin_active', '1');
            } catch {
              // Ignore storage errors
            }
            setActivePhase('1a');
            window.location.hash = '1a';
            showNotification(`স্বাগতম, ${user.email}! Google অ্যাডমিন প্যানেল সক্রিয় হয়েছে।`);
          }}
          onClose={() => setShowAdminLoginModal(false)}
        />
      )}

      {/* Clean / Partial Reset Dataset Modal (Requires verified Google Admin + RESET confirmation) */}
      {showResetModal && adminUser && (
        <ResetDataModal
          adminEmail={adminUser.email}
          onConfirmPartialReset={handlePartialReset}
          onClose={() => setShowResetModal(false)}
        />
      )}

      {/* Online Registration Modal (English Form) */}
      {showOnlineRegModal && (
        <OnlineRegistrationModal
          settings={settings}
          existingApplications={applications}
          existingStudents={students}
          onSubmitApplication={handleSubmitOnlineApplication}
          onClose={() => setShowOnlineRegModal(false)}
          onOpenCheckStatus={(prefillId) => {
            setCheckStatusPrefillId(prefillId || '');
            setShowOnlineRegModal(false);
            setShowCheckStatusModal(true);
          }}
        />
      )}

      {/* Check Status Modal */}
      {showCheckStatusModal && (
        <CheckStatusModal
          students={students}
          applications={applications}
          markedSchoolIds={markedSchoolIds}
          blocks={blocks}
          venues={venues}
          seatPlans={seatPlans}
          settings={settings}
          initialRegId={checkStatusPrefillId}
          onOpenOnlineRegistration={() => setShowOnlineRegModal(true)}
          onClose={() => {
            setShowCheckStatusModal(false);
            setCheckStatusPrefillId('');
          }}
        />
      )}

      {/* Block Generator Modal */}
      {showBlockModal && (
        <BlockGeneratorModal
          schools={schools}
          venues={venues}
          existingBlocks={blocks}
          contestYear={settings.yearCode}
          onlineSerialStart={settings.onlineSerialStart}
          onCommitBlocks={handleCommitBlocks}
          onClose={() => setShowBlockModal(false)}
        />
      )}

      {/* Responsive Footer */}
      <footer className="print:hidden border-t border-gray-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          © ২০২৬ {settings.organiserBn} ({settings.organiserEn}) · সর্বস্বত্ব সংরক্ষিত।
        </p>
      </footer>
    </div>
  );
}
