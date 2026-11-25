export type CategoryCode = '01' | '02' | '03';

export type QuestionMedium = 'bangla' | 'english';

export const QUESTION_MEDIUM_LABELS: Record<QuestionMedium, { bn: string; en: string }> = {
  bangla: { bn: 'বাংলা মাধ্যম', en: 'Bangla Medium' },
  english: { bn: 'ইংরেজি মাধ্যম', en: 'English Medium' }
};

export interface CategoryInfo {
  code: CategoryCode;
  nameBn: string;
  nameEn: string;
  classes: number[];
  color: string;
  badgeBg: string;
  textColor: string;
  borderColor: string;
  syllabusBn: string;
  syllabusEn: string;
}

const COMMON_SYLLABUS_BN = 'বাংলা: স্ব স্ব শ্রেণীর গণিত বইয়ে অন্তর্ভুক্ত বিষয়সমূহ, বিভাজ্যতা, প্যাটার্ন, গুচ্ছবিন্যাসতত্ত্ব (কম্বিনেট্রিক্স)।';
const COMMON_SYLLABUS_EN = 'English: Topics included in respective class mathematics textbook, Divisibility, Pattern, Combinatorics.';

export const CATEGORIES: Record<CategoryCode, CategoryInfo> = {
  '01': {
    code: '01',
    nameBn: 'প্রাথমিক',
    nameEn: 'Primary',
    classes: [3, 4, 5],
    color: '#0284c7', // Sky-600
    badgeBg: 'bg-sky-50 dark:bg-sky-950/60',
    textColor: 'text-sky-700 dark:text-sky-300',
    borderColor: 'border-sky-500',
    syllabusBn: COMMON_SYLLABUS_BN,
    syllabusEn: COMMON_SYLLABUS_EN
  },
  '02': {
    code: '02',
    nameBn: 'নিম্ন মাধ্যমিক',
    nameEn: 'Lower Secondary',
    classes: [6, 7, 8],
    color: '#059669', // Emerald-600
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    textColor: 'text-emerald-700 dark:text-emerald-300',
    borderColor: 'border-emerald-500',
    syllabusBn: COMMON_SYLLABUS_BN,
    syllabusEn: COMMON_SYLLABUS_EN
  },
  '03': {
    code: '03',
    nameBn: 'মাধ্যমিক',
    nameEn: 'Secondary',
    classes: [9, 10],
    color: '#d97706', // Amber-600
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-500',
    syllabusBn: COMMON_SYLLABUS_BN,
    syllabusEn: COMMON_SYLLABUS_EN
  }
};

export function getSyllabusParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\s*(English\s*:)/gi, '\n$1')
    .replace(/\s*(বাংলা\s*:)/g, '\n$1')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

export interface RoomInvigilator {
  roomId: string;
  roomName: string;
  teacher1Name: string;
  teacher1Phone?: string;
  teacher2Name: string;
  teacher2Phone?: string;
}

export interface CategoryWinnerEntry {
  position: 1 | 2 | 3;
  studentId: string;
  marks: number;
  studentNameBn?: string;
  studentNameEn?: string;
  schoolName?: string;
  studentClass?: number;
}

export interface ContestSettings {
  contestNameBn: string;
  contestNameEn: string;
  organiserBn: string;
  organiserEn: string;
  yearCode: string; // '26'
  registrationOpens: string; // ISO
  registrationCloses: string; // ISO
  quizDateTime: string; // ISO
  quizDateTextBn: string;
  quizTimeTextBn: string;
  registrationFee: number;
  paymentMethod: string;
  bkashNumber: string;
  bkashAccountName: string;
  helplineNumbers: string;
  facebookPage: string;
  onlineSerialStart: number;
  serialDigits: number; // 3 or 4
  resultsPublished: boolean;
  resultsPublishAt?: string;
  seatPlanPublished: boolean;
  showWinnersList: boolean;
  certDownloadEnabled: boolean;
  altVerifyByFather: boolean;
  syllabuses: Record<CategoryCode, string>;
  totalMarks: Record<CategoryCode, number>;
  prizeCount: number;
  meritCount: number;
  tieBreakRule: 'shared' | 'extra';
  prizeVenueAndDateBn: string;
  invigilators?: RoomInvigilator[];
  podiumWinners?: Record<CategoryCode, CategoryWinnerEntry[]>;
  signatories: Array<{
    name: string;
    title: string;
    post?: string;
    signatureUrl?: string;
  }>;
  syllabusUpdatedV2?: boolean;
  syllabusUpdatedV3?: boolean;
  syllabusUpdatedV4?: boolean;
  syllabusUpdatedV5?: boolean;
  onlineSerialMigrated601?: boolean;
  helplineSwitchedV1?: boolean;
}

export interface PublicSettings {
  contestNameBn: string;
  contestNameEn: string;
  organiserBn: string;
  yearCode: string;
  registrationOpens: string;
  registrationCloses: string;
  quizDateTime: string;
  quizDateTextBn: string;
  quizTimeTextBn: string;
  registrationFee: number;
  bkashNumber: string;
  bkashAccountName: string;
  helplineNumbers: string;
  facebookPage: string;
  resultsPublished: boolean;
  resultsPublishAt?: string;
  seatPlanPublished: boolean;
  showWinnersList: boolean;
  certDownloadEnabled: boolean;
}

export interface RoomConfig {
  id: string;
  name: string;
  benches: number;
  perBench: number; // 1, 2, or 3
}

export interface Venue {
  id: string;
  name: string;
  nameEn: string;
  address: string;
  mapUrl?: string;
  contactPerson: string;
  contactPhone: string;
  rooms: RoomConfig[];
}

export interface School {
  id: string;
  name: string;
  nameEn: string;
  upazila: string;
  venueId: string;
  pinHash: string;
  plainPin?: string; // transient for display/printing
  formsNeeded: Record<CategoryCode, number>;
  lastReportAt?: string;
}

export type BlockType = 'school' | 'online' | 'spare';

export interface NumberBlock {
  id: string;
  schoolId?: string;
  schoolName?: string;
  schoolNameEn?: string;
  type: BlockType;
  category: CategoryCode;
  firstSerial: number;
  lastSerial: number;
  firstId: string;
  lastId: string;
  count: number;
  venueId: string;
  venueName?: string;
  createdAt: string;
}

export interface Student {
  id: string; // e.g. '2601001'
  category: CategoryCode;
  class: number;
  nameBn: string;
  nameEn: string;
  fatherName: string;
  motherName?: string;
  mobile: string;
  village?: string;
  upazila?: string;
  district?: string;
  schoolName: string;
  schoolId?: string;
  venueId: string;
  source: 'school' | 'online' | 'walkin';
  questionMedium?: QuestionMedium;
  photoPath?: string;
  photoUrl?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  attendance?: boolean;
  marks?: number;
  position?: number;
  seatVenueId?: string;
  seatVenueName?: string;
  seatRoomId?: string;
  seatRoomName?: string;
  seatColumn?: 'left' | 'right';
  seatRow?: number;
  seatPosition?: number;
}

export interface OnlineApplication {
  id: string;
  nameBn: string;
  nameEn: string;
  fatherName: string;
  motherName?: string;
  class: number;
  category: CategoryCode;
  mobile: string;
  schoolName: string;
  village?: string;
  upazila?: string;
  district?: string;
  txnId: string;
  payerMobile: string;
  questionMedium?: QuestionMedium;
  screenshotPath?: string;
  photoPath?: string;
  status: 'pending' | 'verified' | 'rejected';
  reason?: string;
  assignedId?: string;
  assignedVenueId?: string;
  submittedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  smsStatus?: 'sent' | 'failed' | 'not_configured' | 'phone_app';
  smsSentAt?: string;
  smsMessage?: string;
  smsProvider?: string;
  smsError?: string;
}

export interface LiveStats {
  totalRegistered: number;
  fromSchools: number;
  onlineVerified: number;
  onlinePending: number;
  formsTypedIn: number;
  attendanceTotal: number;
  byCategory: Record<CategoryCode, number>;
  byVenue: Record<string, { registered: number; capacity: number }>;
  bySchool: Record<string, { allotted: number; used: number; typed: number }>;
}

export interface AuditLogEntry {
  id?: string;
  at: string;
  uid: string;
  role: 'superadmin' | 'admin' | 'volunteer' | 'teacher' | 'system';
  action: string;
  collection: string;
  docId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}
