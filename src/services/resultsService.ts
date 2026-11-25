import { CategoryCode, Student } from '../types';

export interface StudentResult {
  studentId: string;
  category: CategoryCode;
  studentNameBn: string;
  studentNameEn: string;
  studentClass: number;
  schoolName: string;
  schoolNameEn?: string;
  attendance: boolean;
  marks?: number;
  tieBreakMarks?: number;

  // Class-wise ranking (1st, 2nd, 3rd awarded per class)
  classRank?: number;
  classTotal?: number;
  isClassWinner?: boolean;
  classPositionTextBn?: string;
  classPositionTextEn?: string;
  classAwardTextBn?: string;
  classAwardTextEn?: string;

  // Category-wise ranking (overall in category)
  categoryRank?: number;
  categoryTotal?: number;
  categoryPositionTextBn?: string;
  categoryPositionTextEn?: string;

  // General award
  award: 'prize' | 'merit' | 'participation' | 'absent';
  awardTextBn: string;
  awardTextEn: string;
  certNo?: string;
}

export function computeAllRankings(
  students: Student[],
  prizeCountPerClass = 3
): Map<string, StudentResult> {
  const resultsMap = new Map<string, StudentResult>();

  // Group students by class (3 through 10)
  const classGroups = new Map<number, Student[]>();
  for (let c = 3; c <= 10; c++) {
    classGroups.set(c, []);
  }

  // Group students by category ('01', '02', '03')
  const categoryGroups = new Map<CategoryCode, Student[]>();
  categoryGroups.set('01', []);
  categoryGroups.set('02', []);
  categoryGroups.set('03', []);

  students.forEach(s => {
    const cList = classGroups.get(s.class) || [];
    cList.push(s);
    classGroups.set(s.class, cList);

    const catList = categoryGroups.get(s.category) || [];
    catList.push(s);
    categoryGroups.set(s.category, catList);
  });

  // Calculate category-wise ranks first
  const categoryRankMap = new Map<string, { rank: number; total: number }>();
  categoryGroups.forEach((catStudents, cat) => {
    const presentCat = catStudents.filter(s => s.attendance === true && typeof s.marks === 'number');
    presentCat.sort((a, b) => (b.marks || 0) - (a.marks || 0) || a.id.localeCompare(b.id));

    presentCat.forEach((s, idx) => {
      categoryRankMap.set(s.id, { rank: idx + 1, total: presentCat.length });
    });
  });

  // Calculate class-wise ranks (Primary awards are classwise)
  classGroups.forEach((classStudents, cls) => {
    const presentClass = classStudents.filter(s => s.attendance === true && typeof s.marks === 'number');
    const absentClass = classStudents.filter(s => s.attendance !== true || typeof s.marks !== 'number');

    presentClass.sort((a, b) => (b.marks || 0) - (a.marks || 0) || a.id.localeCompare(b.id));

    presentClass.forEach((s, idx) => {
      const classRank = idx + 1;
      const catRankInfo = categoryRankMap.get(s.id) || { rank: classRank, total: presentClass.length };

      const isClassWinner = classRank <= prizeCountPerClass;
      let award: StudentResult['award'] = 'participation';
      let awardTextBn = 'অংশগ্রহণমূলক সনদ';
      let awardTextEn = 'Certificate of Participation';

      let classPositionTextBn = `${classRank}ম স্থান`;
      let classPositionTextEn = getOrdinalEnglish(classRank);

      if (classRank === 1) {
        award = 'prize';
        classPositionTextBn = '১ম স্থান (বিজয় পুরস্কার)';
        classPositionTextEn = '1st Place Winner';
        awardTextBn = `শ্রেণি ${cls}-এ ১ম স্থান বিজয়ী`;
        awardTextEn = `1st Place in Class ${cls}`;
      } else if (classRank === 2) {
        award = 'prize';
        classPositionTextBn = '২য় স্থান (রানার-আপ)';
        classPositionTextEn = '2nd Place (Runner-Up)';
        awardTextBn = `শ্রেণি ${cls}-এ ২য় স্থান (রানার-আপ)`;
        awardTextEn = `2nd Place in Class ${cls}`;
      } else if (classRank === 3) {
        award = 'prize';
        classPositionTextBn = '৩য় স্থান';
        classPositionTextEn = '3rd Place';
        awardTextBn = `শ্রেণি ${cls}-এ ৩য় স্থান`;
        awardTextEn = `3rd Place in Class ${cls}`;
      } else if (classRank <= 10) {
        award = 'merit';
        awardTextBn = `শ্রেণি ${cls}-এ মেধা তালিকা (${classRank}ম স্থান)`;
        awardTextEn = `Merit Award (Rank ${classRank})`;
      }

      const enSchool = getEnglishSchoolName(s.schoolName);
      const enStudentName = (s.nameEn && /^[\x00-\x7F\s.,'-]+$/.test(s.nameEn.trim()))
        ? s.nameEn.trim().toUpperCase()
        : (s.nameEn?.trim() || `STUDENT (${s.id})`);

      resultsMap.set(s.id, {
        studentId: s.id,
        category: s.category,
        studentNameBn: s.nameBn,
        studentNameEn: enStudentName,
        studentClass: s.class,
        schoolName: s.schoolName,
        schoolNameEn: enSchool,
        attendance: true,
        marks: s.marks,
        classRank,
        classTotal: presentClass.length,
        isClassWinner,
        classPositionTextBn,
        classPositionTextEn,
        classAwardTextBn: `শ্রেণি ${cls}-এ ${classPositionTextBn}`,
        classAwardTextEn: `${classPositionTextEn} in Class ${cls}`,
        categoryRank: catRankInfo.rank,
        categoryTotal: catRankInfo.total,
        categoryPositionTextBn: `ক্যাটাগরিতে সার্বিক ${catRankInfo.rank}ম স্থান (মোট ${catRankInfo.total} জনের মধ্যে)`,
        categoryPositionTextEn: `Overall Rank ${catRankInfo.rank} of ${catRankInfo.total} in Category`,
        award,
        awardTextBn,
        awardTextEn,
        certNo: `MBP-C26-${s.id}`
      });
    });

    // Absent students
    absentClass.forEach(s => {
      resultsMap.set(s.id, {
        studentId: s.id,
        category: s.category,
        studentNameBn: s.nameBn,
        studentNameEn: s.nameEn || s.nameBn,
        studentClass: s.class,
        schoolName: s.schoolName,
        attendance: false,
        award: 'absent',
        awardTextBn: 'অনুপস্থিত',
        awardTextEn: 'Absent'
      });
    });
  });

  return resultsMap;
}

export function computeCategoryRankings(
  students: Student[],
  category: CategoryCode,
  prizeCount = 3,
  meritCount = 10,
  tieBreakRule: 'shared' | 'extra' = 'shared'
): StudentResult[] {
  const allMap = computeAllRankings(students, prizeCount);
  const catStudents = students.filter(s => s.category === category);
  
  const results: StudentResult[] = [];
  catStudents.forEach(s => {
    const res = allMap.get(s.id);
    if (res) results.push(res);
  });

  // Sort by marks descending
  results.sort((a, b) => (b.marks || 0) - (a.marks || 0) || a.studentId.localeCompare(b.studentId));
  return results;
}

export function getOrdinalEnglish(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const SCHOOL_NAME_EN_MAP: Record<string, string> = {
  'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়': 'Tetaigaon Rashid Uddin High School',
  'আদমপুর এম এ ওহাব উচ্চ বিদ্যালয়': 'Adampur M A Wahab High School',
  'মাঝেরগাঁও সরকারি প্রাথমিক বিদ্যালয়': 'Majhergaon Govt Primary School',
  'ভানুগাছ সরকারি প্রাথমিক বিদ্যালয়': 'Bhanugach Govt Primary School',
  'কমলগঞ্জ বহুমুখী সরকারি উচ্চ বিদ্যালয়': 'Kamalganj Govt High School',
  'নিজ উদ্যোগে (Self Initiative)': 'Self Initiative',
  'নিজ উদ্যোগে': 'Self Initiative'
};

export function getEnglishSchoolName(schoolName?: string): string {
  if (!schoolName) return 'Participating School';
  const clean = schoolName.trim();
  if (SCHOOL_NAME_EN_MAP[clean]) return SCHOOL_NAME_EN_MAP[clean];
  
  // Extract English text from parentheses e.g. "School (English Name)"
  const match = clean.match(/\(([^)]+)\)/);
  if (match && /[A-Za-z]/.test(match[1])) return match[1].trim();

  // If text is ASCII / English
  if (/^[\x00-\x7F\s.,'-]+$/.test(clean)) return clean;

  // Substring checks
  for (const [bn, en] of Object.entries(SCHOOL_NAME_EN_MAP)) {
    if (clean.includes(bn)) return en;
  }

  return 'Participating Institution';
}

export function getEnglishPositionText(res: { classRank?: number; isClassWinner?: boolean; classPositionTextEn?: string }): string {
  if (res.classRank === 1) return '1st Place Winner';
  if (res.classRank === 2) return '2nd Place (Runner-Up)';
  if (res.classRank === 3) return '3rd Place';
  if (res.classRank) {
    return `${getOrdinalEnglish(res.classRank)} Place`;
  }
  return res.classPositionTextEn || 'Merit Position';
}

