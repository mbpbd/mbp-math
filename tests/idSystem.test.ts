import { describe, it, expect } from 'vitest';
import { 
  parseRegistrationId, 
  formatRegistrationId, 
  buildCategorywiseForms,
  getCategoryForClass, 
  isClassMatchingCategory, 
  makeQrPayload, 
  parseQrPayload,
  toBengaliDigits,
  toEnglishDigits
} from '../src/services/idSystem';
import { allocateSchoolBlocks, validateNoOverlaps, doBlocksOverlap } from '../src/services/blockAllocation';
import { School, Venue, OnlineApplication, Student, getSyllabusParagraphs } from '../src/types';
import { DEFAULT_SETTINGS, INITIAL_SCHOOLS, INITIAL_VENUES, getPreferredExamVenueId } from '../src/services/defaultData';
import { getNextOnlineRegistrationId } from '../src/services/firestoreService';
import { generateMultiVenueSeatPlan } from '../src/services/seatPlanAlgorithm';

describe('Phase 1a: Registration ID System', () => {
  it('parses valid 7-digit registration IDs accurately', () => {
    const res = parseRegistrationId('2601001', '26', 3);
    expect(res.valid).toBe(true);
    expect(res.year).toBe('26');
    expect(res.category).toBe('01');
    expect(res.serial).toBe(1);
  });

  it('supports Bengali numerals during ID parsing', () => {
    const res = parseRegistrationId('২৬০২০১৫', '26', 3);
    expect(res.valid).toBe(true);
    expect(res.category).toBe('02');
    expect(res.serial).toBe(15);
  });

  it('rejects invalid length or invalid year code', () => {
    const shortId = parseRegistrationId('2601', '26', 3);
    expect(shortId.valid).toBe(false);

    const wrongYear = parseRegistrationId('2501001', '26', 3);
    expect(wrongYear.valid).toBe(false);
  });

  it('correctly maps classes 3-10 to appropriate categories', () => {
    expect(getCategoryForClass(3)).toBe('01');
    expect(getCategoryForClass(5)).toBe('01');
    expect(getCategoryForClass(6)).toBe('02');
    expect(getCategoryForClass(8)).toBe('02');
    expect(getCategoryForClass(9)).toBe('03');
    expect(getCategoryForClass(10)).toBe('03');
    expect(getCategoryForClass(2)).toBe(null);
    expect(getCategoryForClass(11)).toBe(null);
  });

  it('validates class and category match and rejects mismatches', () => {
    expect(isClassMatchingCategory(4, '01')).toBe(true);
    expect(isClassMatchingCategory(7, '02')).toBe(true);
    expect(isClassMatchingCategory(10, '03')).toBe(true);
    // Mismatch
    expect(isClassMatchingCategory(7, '01')).toBe(false);
    expect(isClassMatchingCategory(4, '02')).toBe(false);
    expect(isClassMatchingCategory(5, '03')).toBe(false);
  });

  it('generates QR payload containing raw registration ID directly', () => {
    const payload = makeQrPayload('2601001');
    expect(payload).toBe('2601001');
    expect(parseQrPayload(payload)).toBe('2601001');
    expect(parseQrPayload('MBPQ26:2601001')).toBe('2601001');
  });

  it('formats registration IDs with zero-padding', () => {
    expect(formatRegistrationId('26', '01', 5, 3)).toBe('2601005');
    expect(formatRegistrationId('26', '02', 42, 3)).toBe('2602042');
    expect(formatRegistrationId('26', '03', 150, 3)).toBe('2603150');
  });

  it('generates sequential category-wise registration numbers up to admin-defined last number', () => {
    const all500 = buildCategorywiseForms({
      yearCode: '26',
      selectedCategory: 'all',
      ranges: {
        '01': { start: 1, end: 500 },
        '02': { start: 1, end: 500 },
        '03': { start: 1, end: 500 }
      },
      serialDigits: 3
    });

    expect(all500).toHaveLength(1500);
    expect(all500[0].id).toBe('2601001');
    expect(all500[499].id).toBe('2601500');
    expect(all500[500].id).toBe('2602001');
    expect(all500[999].id).toBe('2602500');
    expect(all500[1000].id).toBe('2603001');
    expect(all500[1499].id).toBe('2603500');

    const customRange = buildCategorywiseForms({
      yearCode: '26',
      selectedCategory: '02',
      ranges: {
        '01': { start: 1, end: 500 },
        '02': { start: 101, end: 250 },
        '03': { start: 1, end: 500 }
      },
      serialDigits: 3
    });
    expect(customRange).toHaveLength(150);
    expect(customRange[0].id).toBe('2602101');
    expect(customRange[149].id).toBe('2602250');
  });
});

describe('Phase 1a: Block Allocation Engine', () => {
  const sampleVenues: Venue[] = [
    {
      id: 'V01',
      name: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
      nameEn: 'Tetaigaon Rashid Uddin High School',
      address: 'কমলগঞ্জ',
      contactPerson: 'শান্তনু সিংহ',
      contactPhone: '01717-557419',
      rooms: [{ id: 'R1', name: '১০১', benches: 20, perBench: 2 }]
    }
  ];

  const sampleSchools: School[] = [
    {
      id: 'S001',
      name: 'School A',
      nameEn: 'School A',
      upazila: 'কমলগঞ্জ',
      venueId: 'V01',
      pinHash: 'hash1',
      formsNeeded: { '01': 40, '02': 35, '03': 30 }
    },
    {
      id: 'S002',
      name: 'School B',
      nameEn: 'School B',
      upazila: 'কমলগঞ্জ',
      venueId: 'V01',
      pinHash: 'hash2',
      formsNeeded: { '01': 25, '02': 30, '03': 20 }
    }
  ];

  it('allocates continuous sequential blocks without gaps or overlaps', () => {
    const result = allocateSchoolBlocks({
      schools: sampleSchools,
      venues: sampleVenues,
      contestYear: '26',
      onlineSerialStart: 901
    });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);

    // School A checks
    const a01 = result.blocks.find(b => b.schoolId === 'S001' && b.category === '01');
    expect(a01).toBeDefined();
    expect(a01?.firstSerial).toBe(1);
    expect(a01?.lastSerial).toBe(40);
    expect(a01?.firstId).toBe('2601001');
    expect(a01?.lastId).toBe('2601040');

    // School B in Cat 01 must continue directly from 41
    const b01 = result.blocks.find(b => b.schoolId === 'S002' && b.category === '01');
    expect(b01).toBeDefined();
    expect(b01?.firstSerial).toBe(41);
    expect(b01?.lastSerial).toBe(65);
    expect(b01?.firstId).toBe('2601041');
    expect(b01?.lastId).toBe('2601065');
  });

  it('strictly detects any overlapping block ranges', () => {
    const block1 = { category: '01', firstSerial: 1, lastSerial: 50 };
    const block2 = { category: '01', firstSerial: 45, lastSerial: 90 };
    const block3 = { category: '02', firstSerial: 1, lastSerial: 50 }; // different category

    expect(doBlocksOverlap(block1, block2)).toBe(true);
    expect(doBlocksOverlap(block1, block3)).toBe(false);

    const validation = validateNoOverlaps([block1, block2]);
    expect(validation.valid).toBe(false);
  });

  it('enforces capacity limit and rejects blocks touching reserved online block 901', () => {
    const hugeSchool: School = {
      id: 'S003',
      name: 'Huge School',
      nameEn: 'Huge School',
      upazila: 'কমলগঞ্জ',
      venueId: 'V01',
      pinHash: 'hash3',
      formsNeeded: { '01': 950, '02': 0, '03': 0 }
    };

    const result = allocateSchoolBlocks({
      schools: [hugeSchool],
      venues: sampleVenues,
      onlineSerialStart: 901
    });

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('অনলাইন সংরক্ষিত ক্রমিক'))).toBe(true);
  });

  it('orders Kamalganj schools Primary -> Junior -> Secondary -> Outside (BAF Shaheen) with 20 seats default & switched helpline', () => {
    const prepared: School[] = INITIAL_SCHOOLS.map(s => ({
      ...s,
      pinHash: 'test-hash'
    }));
    const result = allocateSchoolBlocks({
      schools: prepared,
      venues: INITIAL_VENUES,
      contestYear: DEFAULT_SETTINGS.yearCode,
      onlineSerialStart: DEFAULT_SETTINGS.onlineSerialStart,
      serialDigits: DEFAULT_SETTINGS.serialDigits
    });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    for (const s of INITIAL_SCHOOLS) {
      (['01', '02', '03'] as const).forEach(cat => {
        expect([0, 20]).toContain(s.formsNeeded[cat]);
      });
    }

    const names = INITIAL_SCHOOLS.map(s => s.name);
    expect(names).toContain('দয়াময় সিংহ উচ্চ বিদ্যালয়');
    expect(names).toContain('রাণীর বাজার সরকারি প্রাথমিক বিদ্যালয়');
    expect(names).toContain('আম্বিয়া কেজি স্কুল');
    expect(INITIAL_SCHOOLS[INITIAL_SCHOOLS.length - 1].name).toBe('বিএএফ শাহীন কলেজ শমশেরনগর');

    // Verify helpline contact order: 1st 01753-253127, then 01717-557419
    expect(DEFAULT_SETTINGS.helplineNumbers.startsWith('01753-253127, 01717-557419')).toBe(true);

    // Verify unified bilingual syllabus with separate বাংলা: and English: lines for all categories
    (['01', '02', '03'] as const).forEach(cat => {
      expect(DEFAULT_SETTINGS.syllabuses[cat]).toContain('বাংলা: স্ব স্ব শ্রেণীর গণিত বইয়ে অন্তর্ভুক্ত বিষয়সমূহ, বিভাজ্যতা, প্যাটার্ন, গুচ্ছবিন্যাসতত্ত্ব (কম্বিনেট্রিক্স)।');
      expect(DEFAULT_SETTINGS.syllabuses[cat]).toContain('English: Topics included in respective class mathematics textbook, Divisibility, Pattern, Combinatorics.');
      const paras = getSyllabusParagraphs(DEFAULT_SETTINGS.syllabuses[cat]);
      expect(paras.length).toBe(2);
      expect(paras[0].startsWith('বাংলা:')).toBe(true);
      expect(paras[1].startsWith('English:')).toBe(true);
    });
    expect(
      getSyllabusParagraphs('বাংলা: ক খ গ। English: A B C.')
    ).toEqual(['বাংলা: ক খ গ।', 'English: A B C.']);
  });
});

describe('Venues V01/V02/V03, Freed Rejected IDs & Multi-Venue Seat Plan', () => {
  it('keeps V01 intact for future events while adding V02 Dayamay and V03 Ranir Bazar', () => {
    const ids = INITIAL_VENUES.map(v => v.id);
    expect(ids).toContain('V01');
    expect(ids).toContain('V02');
    expect(ids).toContain('V03');

    const v01 = INITIAL_VENUES.find(v => v.id === 'V01');
    const v02 = INITIAL_VENUES.find(v => v.id === 'V02');
    const v03 = INITIAL_VENUES.find(v => v.id === 'V03');
    expect(v01?.name).toContain('তেতইগাঁও');
    expect(v02?.name).toContain('দয়াময়');
    expect(v03?.name).toContain('রাণীর বাজার');
    expect(getPreferredExamVenueId(INITIAL_VENUES)).toBe('V02');
  });

  it('immediately frees rejected registration IDs for the next applicant while protecting active IDs', () => {
    const apps: OnlineApplication[] = [
      {
        id: 'app-1',
        nameBn: 'আবেদন ১',
        nameEn: 'APP ONE',
        fatherName: 'পিতা ১',
        class: 4,
        category: '01',
        mobile: '01711111111',
        schoolName: 'School 1',
        txnId: 'TRX1',
        payerMobile: '01711111111',
        status: 'rejected',
        reason: 'TrxID not found',
        assignedId: '2601601',
        submittedAt: '2026-04-01T10:00:00Z'
      },
      {
        id: 'app-2',
        nameBn: 'আবেদন ২',
        nameEn: 'APP TWO',
        fatherName: 'পিতা ২',
        class: 5,
        category: '01',
        mobile: '01722222222',
        schoolName: 'School 2',
        txnId: 'TRX2',
        payerMobile: '01722222222',
        status: 'pending',
        assignedId: '2601602',
        submittedAt: '2026-04-01T11:00:00Z'
      }
    ];

    const students: Student[] = [
      {
        id: '2601603',
        category: '01',
        class: 3,
        nameBn: 'নিবন্ধিত ৩',
        nameEn: 'VERIFIED THREE',
        fatherName: 'পিতা ৩',
        mobile: '01733333333',
        schoolName: 'School 3',
        venueId: 'V02',
        source: 'online',
        createdAt: '2026-04-01T12:00:00Z'
      }
    ];

    // 2601601 belonged to rejected app-1, so it must be reused first before picking 2601604
    const next = getNextOnlineRegistrationId('01', '26', apps, students, 601);
    expect(next.serial).toBe(601);
    expect(next.fullId).toBe('2601601');

    // Once 601 is taken by a pending app, next free slot must skip 602 and 603 -> 604
    const appsAfterReuse: OnlineApplication[] = [
      ...apps,
      { ...apps[0], id: 'app-4', status: 'pending', assignedId: '2601601', txnId: 'TRX4' }
    ];
    const nextAfterReuse = getNextOnlineRegistrationId('01', '26', appsAfterReuse, students, 601);
    expect(nextAfterReuse.serial).toBe(604);
    expect(nextAfterReuse.fullId).toBe('2601604');
  });

  it('allocates seats across V02 and overflows into V03 with exact venue metadata on each assignment', () => {
    const smallV02: Venue = {
      id: 'V02',
      name: 'দয়াময় সিংহ উচ্চ বিদ্যালয়',
      nameEn: 'Dayamay Singha High School',
      address: 'কমলগঞ্জ',
      contactPerson: 'A',
      contactPhone: '01700000000',
      rooms: [{ id: 'V02-R101', name: 'কক্ষ ১০১', benches: 1, perBench: 2 }]
    };
    const smallV03: Venue = {
      id: 'V03',
      name: 'রাণীর বাজার সরকারি প্রাথমিক বিদ্যালয়',
      nameEn: 'Ranir Bazar Govt. Primary School',
      address: 'কমলগঞ্জ',
      contactPerson: 'B',
      contactPhone: '01700000001',
      rooms: [{ id: 'V03-R201', name: 'কক্ষ ২০১', benches: 2, perBench: 2 }]
    };

    const sampleStudents: Student[] = [
      { id: '2601001', category: '01', class: 4, nameBn: 'ক', nameEn: 'A', fatherName: 'F', mobile: '0171', schoolName: 'S1', venueId: 'V02', source: 'school', createdAt: '' },
      { id: '2602001', category: '02', class: 7, nameBn: 'খ', nameEn: 'B', fatherName: 'F', mobile: '0172', schoolName: 'S1', venueId: 'V02', source: 'school', createdAt: '' },
      { id: '2603001', category: '03', class: 9, nameBn: 'গ', nameEn: 'C', fatherName: 'F', mobile: '0173', schoolName: 'S1', venueId: 'V01', source: 'school', createdAt: '' },
      { id: '2601002', category: '01', class: 5, nameBn: 'ঘ', nameEn: 'D', fatherName: 'F', mobile: '0174', schoolName: 'S2', venueId: 'V02', source: 'school', createdAt: '' }
    ];

    const res = generateMultiVenueSeatPlan(sampleStudents, [smallV02, smallV03], false);
    expect(res.combined.summary.seatedCount).toBe(4);
    expect(res.byVenue['V02'].assignments).toHaveLength(2);
    expect(res.byVenue['V03'].assignments).toHaveLength(2);
    expect(res.byVenue['V02'].assignments.every(a => a.venueId === 'V02' && a.venueName.includes('দয়াময়'))).toBe(true);
    expect(res.byVenue['V03'].assignments.every(a => a.venueId === 'V03' && a.venueName.includes('রাণীর বাজার'))).toBe(true);
  });
});

