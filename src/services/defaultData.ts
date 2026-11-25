import { ContestSettings, School, Venue } from '../types';

export const DEFAULT_SETTINGS: ContestSettings = {
  contestNameBn: 'ম্যাথ কুইজ কনটেস্ট ২০২৬',
  contestNameEn: 'Math Quiz Contest 2026',
  organiserBn: 'মণিপুরি বিজ্ঞান প্রজন্ম',
  organiserEn: 'Manipuri Biggan Projonmo',
  yearCode: '26',
  registrationOpens: '2026-11-15T00:00:00+06:00',
  registrationCloses: '2026-12-15T23:59:59+06:00',
  quizDateTime: '2026-12-26T10:30:00+06:00',
  quizDateTextBn: '২৬ ডিসেম্বর ২০২৬, শনিবার',
  quizTimeTextBn: 'সকাল ১০:৩০ মিনিট',
  registrationFee: 100,
  paymentMethod: 'bKash Send Money to 01753253127 (account name: Kiran Singha, personal account)',
  bkashNumber: '01753253127',
  bkashAccountName: 'Kiran Singha',
  helplineNumbers: '01753-253127, 01717-557419 (সকাল ১০টা থেকে বিকাল ৪টা)',
  facebookPage: 'www.facebook.com/mbprojonmo',
  onlineSerialStart: 601,
  serialDigits: 3,
  resultsPublished: false,
  resultsPublishAt: '2026-12-27T18:00:00+06:00',
  seatPlanPublished: false,
  showWinnersList: false,
  certDownloadEnabled: false,
  altVerifyByFather: true,
  syllabuses: {
    '01': 'বাংলা: স্ব স্ব শ্রেণীর গণিত বইয়ে অন্তর্ভুক্ত বিষয়সমূহ, বিভাজ্যতা, প্যাটার্ন, গুচ্ছবিন্যাসতত্ত্ব (কম্বিনেট্রিক্স)।\nEnglish: Topics included in respective class mathematics textbook, Divisibility, Pattern, Combinatorics.',
    '02': 'বাংলা: স্ব স্ব শ্রেণীর গণিত বইয়ে অন্তর্ভুক্ত বিষয়সমূহ, বিভাজ্যতা, প্যাটার্ন, গুচ্ছবিন্যাসতত্ত্ব (কম্বিনেট্রিক্স)।\nEnglish: Topics included in respective class mathematics textbook, Divisibility, Pattern, Combinatorics.',
    '03': 'বাংলা: স্ব স্ব শ্রেণীর গণিত বইয়ে অন্তর্ভুক্ত বিষয়সমূহ, বিভাজ্যতা, প্যাটার্ন, গুচ্ছবিন্যাসতত্ত্ব (কম্বিনেট্রিক্স)।\nEnglish: Topics included in respective class mathematics textbook, Divisibility, Pattern, Combinatorics.'
  },
  totalMarks: {
    '01': 100,
    '02': 100,
    '03': 100
  },
  prizeCount: 3,
  meritCount: 10,
  tieBreakRule: 'shared',
  prizeVenueAndDateBn: 'দয়াময় সিংহ উচ্চ বিদ্যালয় মিলনায়তন, ২৬ ডিসেম্বর ২০২৬ বিকাল ৪:০০',
  invigilators: [
    { roomId: 'V02-R101', roomName: 'কক্ষ ১০১ (দয়াময়)', teacher1Name: 'শান্তনু সিংহ', teacher1Phone: '01717-557419', teacher2Name: 'দীপঙ্কর শর্মা', teacher2Phone: '01712-334455' },
    { roomId: 'V02-R102', roomName: 'কক্ষ ১০২ (দয়াময়)', teacher1Name: 'বিমল সিংহ', teacher1Phone: '01723-456789', teacher2Name: 'সুজিত সিনহা', teacher2Phone: '01819-223344' },
    { roomId: 'V02-R103', roomName: 'কক্ষ ১০৩ (দয়াময়)', teacher1Name: 'প্রশান্ত সিনহা', teacher1Phone: '01734-567890', teacher2Name: 'নির্মল সিংহ', teacher2Phone: '01912-345678' },
    { roomId: 'V02-R104', roomName: 'কক্ষ ১০৪ (দয়াময়)', teacher1Name: 'অনিল সিনহা', teacher1Phone: '01745-678901', teacher2Name: 'উত্তম সিংহ', teacher2Phone: '01711-998877' },
    { roomId: 'V02-R105', roomName: 'কক্ষ ১০৫ (দয়াময়)', teacher1Name: 'রতন সিংহ', teacher1Phone: '01756-789012', teacher2Name: 'সঞ্জীব শর্মা', teacher2Phone: '01822-445566' },
    { roomId: 'V03-R201', roomName: 'কক্ষ ২০১ (রাণীর বাজার)', teacher1Name: '', teacher1Phone: '', teacher2Name: '', teacher2Phone: '' },
    { roomId: 'V03-R202', roomName: 'কক্ষ ২০২ (রাণীর বাজার)', teacher1Name: '', teacher1Phone: '', teacher2Name: '', teacher2Phone: '' }
  ],
  podiumWinners: {
    '01': [
      { position: 1, studentId: '2601001', marks: 95, studentNameBn: 'শুভজিৎ সিংহ', studentNameEn: 'SHUVAJIT SINGHA', schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়', studentClass: 4 },
      { position: 2, studentId: '2601002', marks: 90, studentNameBn: 'ক্ষিতীশ সিংহ', studentNameEn: 'KHITISH SINGHA', schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়', studentClass: 5 },
      { position: 3, studentId: '2601003', marks: 87, studentNameBn: 'অনন্যা সিংহ', studentNameEn: 'ANANYA SINGHA', schoolName: 'মাঝেরগাঁও সরকারি প্রাথমিক বিদ্যালয়', studentClass: 3 }
    ],
    '02': [
      { position: 1, studentId: '2602001', marks: 98, studentNameBn: 'প্রজ্ঞা সিনহা', studentNameEn: 'PROGNA SINHA', schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়', studentClass: 7 },
      { position: 2, studentId: '2602002', marks: 93, studentNameBn: 'সোহাগ সিংহ', studentNameEn: 'SOHAG SINGHA', schoolName: 'আদমপুর এম এ ওহাব উচ্চ বিদ্যালয়', studentClass: 8 },
      { position: 3, studentId: '2602003', marks: 89, studentNameBn: 'বৃষ্টি সিনহা', studentNameEn: 'BRISTI SINHA', schoolName: 'কমলগঞ্জ বহুমুখী সরকারি উচ্চ বিদ্যালয়', studentClass: 6 }
    ],
    '03': [
      { position: 1, studentId: '2603001', marks: 96, studentNameBn: 'শান্তনু সিংহ', studentNameEn: 'SANTANU SINGHA', schoolName: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়', studentClass: 10 },
      { position: 2, studentId: '2603002', marks: 92, studentNameBn: 'জয়ন্ত সিংহ', studentNameEn: 'JAYANTA SINGHA', schoolName: 'আদমপুর এম এ ওহাব উচ্চ বিদ্যালয়', studentClass: 9 },
      { position: 3, studentId: '2603003', marks: 88, studentNameBn: 'দীপিকা সিনহা', studentNameEn: 'DIPIKA SINHA', schoolName: 'কমলগঞ্জ বহুমুখী সরকারি উচ্চ বিদ্যালয়', studentClass: 10 }
    ]
  },
  signatories: [
    { name: 'Brojendro Kumar Singha', title: 'Director General, MBP', post: 'Director General, MBP' },
    { name: 'Kiran Singha', title: 'Exam Controller, MBP', post: 'Exam Controller, MBP' },
    { name: 'Sujit Kumar Singha', title: 'Director', post: 'Director' }
  ]
};

export const INITIAL_VENUES: Venue[] = [
  {
    id: 'V01',
    name: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
    nameEn: 'Tetaigaon Rashid Uddin High School',
    address: 'আদমপুর বাজার, কমলগঞ্জ, মৌলভীবাজার',
    mapUrl: 'https://maps.google.com/?q=Tetaigaon+Rashid+Uddin+High+School',
    contactPerson: 'শান্তনু সিংহ',
    contactPhone: '01717-557419',
    rooms: [
      { id: 'R101', name: 'কক্ষ ১০১', benches: 12, perBench: 2 },
      { id: 'R102', name: 'কক্ষ ১০২', benches: 12, perBench: 2 },
      { id: 'R103', name: 'কক্ষ ১০৩', benches: 12, perBench: 2 },
      { id: 'R104', name: 'কক্ষ ১০৪', benches: 14, perBench: 2 },
      { id: 'R105', name: 'কক্ষ ১০৫', benches: 14, perBench: 2 }
    ]
  },
  {
    id: 'V02',
    name: 'দয়াময় সিংহ উচ্চ বিদ্যালয়',
    nameEn: 'Dayamay Singha High School',
    address: 'তিলকপুর, কমলগঞ্জ, মৌলভীবাজার',
    mapUrl: 'https://maps.google.com/?q=Dayamay+Singha+High+School+Kamalganj',
    contactPerson: 'শান্তনু সিংহ',
    contactPhone: '01753-253127',
    rooms: [
      { id: 'V02-R101', name: 'কক্ষ ১০১', benches: 14, perBench: 2 },
      { id: 'V02-R102', name: 'কক্ষ ১০২', benches: 14, perBench: 2 },
      { id: 'V02-R103', name: 'কক্ষ ১০৩', benches: 14, perBench: 2 },
      { id: 'V02-R104', name: 'কক্ষ ১০৪', benches: 14, perBench: 2 },
      { id: 'V02-R105', name: 'কক্ষ ১০৫', benches: 14, perBench: 2 }
    ]
  },
  {
    id: 'V03',
    name: 'রাণীর বাজার সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Ranir Bazar Govt. Primary School',
    address: 'রাণীর বাজার (দয়াময় সিংহ উচ্চ বিদ্যালয় সংলগ্ন), কমলগঞ্জ, মৌলভীবাজার',
    mapUrl: 'https://maps.google.com/?q=Ranir+Bazar+Govt+Primary+School+Kamalganj',
    contactPerson: 'কিরণ সিংহ',
    contactPhone: '01717-557419',
    rooms: [
      { id: 'V03-R201', name: 'কক্ষ ২০১', benches: 12, perBench: 2 },
      { id: 'V03-R202', name: 'কক্ষ ২০২', benches: 12, perBench: 2 },
      { id: 'V03-R203', name: 'কক্ষ ২০৩', benches: 12, perBench: 2 },
      { id: 'V03-R204', name: 'কক্ষ ২০৪', benches: 12, perBench: 2 }
    ]
  }
];

export function getPreferredExamVenueId(venues: Venue[]): string {
  if (venues.some(v => v.id === 'V02')) return 'V02';
  return venues[0]?.id || 'V02';
}

export const INITIAL_SCHOOLS: Omit<School, 'pinHash'>[] = [
  // =========================================================================
  // 1. Primary Schools inside Kamalganj Thana (ক্যাটাগরি ০১: ২০ আসন ডিফল্ট)
  // =========================================================================
  {
    id: 'S001',
    name: 'ভানুগাছ সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Bhanugach Govt. Primary School',
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2601',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S002',
    name: 'কমলগঞ্জ মডেল সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Kamalganj Model Govt. Primary School',
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2602',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S003',
    name: 'আম্বিয়া কেজি স্কুল',
    nameEn: 'Ambiya KG School',
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2603',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S004',
    name: 'কুমড়াকাপন সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Kumrakapon Govt. Primary School',
    upazila: 'কমলগঞ্জ পৌরসভা (৩২২০)',
    venueId: 'V02',
    plainPin: '2604',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S005',
    name: 'রাণীর বাজার সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Ranir Bazar Govt. Primary School',
    upazila: 'কমলগঞ্জ (আলীনগর)',
    venueId: 'V02',
    plainPin: '2605',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S006',
    name: 'তেতইগাঁও সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Tetaigaon Govt. Primary School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2606',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S007',
    name: 'মাঝেরগাঁও সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Majhergaon Govt. Primary School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2607',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S008',
    name: 'আদমপুর সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Adampur Govt. Primary School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2608',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S009',
    name: 'আধকানি সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Adhkani Govt. Primary School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2609',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S010',
    name: 'আলীনগর সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Alinagar Govt. Primary School',
    upazila: 'কমলগঞ্জ (আলীনগর)',
    venueId: 'V02',
    plainPin: '2610',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S011',
    name: 'মাধবপুর সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Madhabpur Govt. Primary School',
    upazila: 'কমলগঞ্জ (মাধবপুর)',
    venueId: 'V02',
    plainPin: '2611',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S012',
    name: 'তিলকপুর সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Tilakpur Govt. Primary School',
    upazila: 'কমলগঞ্জ (তিলকপুর)',
    venueId: 'V02',
    plainPin: '2612',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S013',
    name: 'পতনঊষার সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Patanushar Govt. Primary School',
    upazila: 'কমলগঞ্জ (পতনঊষার)',
    venueId: 'V02',
    plainPin: '2613',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S014',
    name: 'মুন্সিবাজার সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Munshibazar Govt. Primary School',
    upazila: 'কমলগঞ্জ (মুন্সিবাজার)',
    venueId: 'V02',
    plainPin: '2614',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },
  {
    id: 'S015',
    name: 'ইসলামপুর সরকারি প্রাথমিক বিদ্যালয়',
    nameEn: 'Islampur Govt. Primary School',
    upazila: 'কমলগঞ্জ (ইসলামপুর)',
    venueId: 'V02',
    plainPin: '2615',
    formsNeeded: { '01': 20, '02': 0, '03': 0 }
  },

  // =========================================================================
  // 2. Junior High Schools inside Kamalganj Thana (ক্যাটাগরি ০২: ২০ আসন ডিফল্ট)
  // =========================================================================
  {
    id: 'S016',
    name: 'কমলগঞ্জ আইডিয়াল জুনিয়র হাই স্কুল',
    nameEn: 'Kamalganj Ideal Junior High School',
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2616',
    formsNeeded: { '01': 0, '02': 20, '03': 0 }
  },
  {
    id: 'S017',
    name: 'ডালুয়া ছড়া নিম্ন মাধ্যমিক বিদ্যালয়',
    nameEn: 'Dalua Chhara Junior High School',
    upazila: 'কমলগঞ্জ (৩২২০)',
    venueId: 'V02',
    plainPin: '2617',
    formsNeeded: { '01': 0, '02': 20, '03': 0 }
  },
  {
    id: 'S018',
    name: 'মকবুল আলী নিম্ন মাধ্যমিক বিদ্যালয়',
    nameEn: 'Mokbul Ali Junior High School',
    upazila: 'কমলগঞ্জ পৌরসভা (৩২২০)',
    venueId: 'V02',
    plainPin: '2618',
    formsNeeded: { '01': 0, '02': 20, '03': 0 }
  },

  // =========================================================================
  // 3. Secondary High Schools inside Kamalganj Thana (ক্যাটাগরি ০২ ও ০৩: ২০ আসন)
  // =========================================================================
  {
    id: 'S019',
    name: 'কমলগঞ্জ সরকারি বহুমুখী মডেল উচ্চ বিদ্যালয়',
    nameEn: 'Kamalganj Govt. Multilateral Model High School',
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2619',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S020',
    name: 'কমলগঞ্জ সরকারি বহুমুখী বালিকা উচ্চ বিদ্যালয়',
    nameEn: "Kamalganj Govt. Girls' High School",
    upazila: 'কমলগঞ্জ সদর (৩২২০)',
    venueId: 'V02',
    plainPin: '2620',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S021',
    name: 'দয়াময় সিংহ উচ্চ বিদ্যালয়',
    nameEn: 'Dayamay Singha High School',
    upazila: 'কমলগঞ্জ (তিলকপুর)',
    venueId: 'V02',
    plainPin: '2621',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S022',
    name: 'তেতইগাঁও রশীদ উদ্দিন উচ্চ বিদ্যালয়',
    nameEn: 'Tetaigaon Rashid Uddin High School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2622',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S023',
    name: 'আদমপুর এম এ ওহাব উচ্চ বিদ্যালয়',
    nameEn: 'Adampur M A Wahab High School',
    upazila: 'কমলগঞ্জ (আদমপুর)',
    venueId: 'V02',
    plainPin: '2623',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S024',
    name: 'মাধবপুর উচ্চ বিদ্যালয়',
    nameEn: 'Madhabpur High School',
    upazila: 'কমলগঞ্জ (মাধবপুর)',
    venueId: 'V02',
    plainPin: '2624',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S025',
    name: 'আলীনগর উচ্চ বিদ্যালয়',
    nameEn: 'Alinagar High School',
    upazila: 'কমলগঞ্জ (আলীনগর)',
    venueId: 'V02',
    plainPin: '2625',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S026',
    name: 'কামুদপুর উচ্চ বিদ্যালয়',
    nameEn: 'Kamudpur High School',
    upazila: 'কমলগঞ্জ (কামুদপুর)',
    venueId: 'V02',
    plainPin: '2626',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S027',
    name: 'কালেঙ্গা উচ্চ বিদ্যালয়',
    nameEn: 'Kalenga High School',
    upazila: 'কমলগঞ্জ (কালেঙ্গা)',
    venueId: 'V02',
    plainPin: '2627',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S028',
    name: 'ইউনিয়ন আদর্শ উচ্চ বিদ্যালয়',
    nameEn: 'Union Adarsha High School',
    upazila: 'কমলগঞ্জ (রামপুর)',
    venueId: 'V02',
    plainPin: '2628',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S029',
    name: 'আবুল ফজল চৌধুরী উচ্চ বিদ্যালয়',
    nameEn: 'Abul Fazal Chowdhury High School',
    upazila: 'কমলগঞ্জ (বৃন্দাবনপুর)',
    venueId: 'V02',
    plainPin: '2629',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S030',
    name: 'আহমেদ ইকবাল মেমোরিয়াল হাই স্কুল',
    nameEn: 'Ahmed Iqbal Memorial High School',
    upazila: 'কমলগঞ্জ (বনগাঁও)',
    venueId: 'V02',
    plainPin: '2630',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S031',
    name: 'আব্দুল মছব্বির একাডেমী',
    nameEn: 'Abdul Mosobbir Academy',
    upazila: 'কমলগঞ্জ (ভাদাইর দেউল)',
    venueId: 'V02',
    plainPin: '2631',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S032',
    name: 'পতনঊষার উচ্চ বিদ্যালয় ও কলেজ',
    nameEn: 'Patanushar High School & College',
    upazila: 'কমলগঞ্জ (পতনঊষার)',
    venueId: 'V02',
    plainPin: '2632',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S033',
    name: 'কালী প্রসাদ উচ্চ বিদ্যালয়',
    nameEn: 'Kali Prasad High School',
    upazila: 'কমলগঞ্জ (মুন্সিবাজার)',
    venueId: 'V02',
    plainPin: '2633',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S034',
    name: 'মুন্সিবাজার লুৎফুর রহমান উচ্চ বিদ্যালয়',
    nameEn: 'Munshibazar Lutfur Rahman High School',
    upazila: 'কমলগঞ্জ (মুন্সিবাজার)',
    venueId: 'V02',
    plainPin: '2634',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S035',
    name: 'ভাণ্ডারীগাঁও উচ্চ বিদ্যালয়',
    nameEn: 'Bhandarigaon High School',
    upazila: 'কমলগঞ্জ (ইসলামপুর)',
    venueId: 'V02',
    plainPin: '2635',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S036',
    name: 'ইসলামপুর পদ্মা মেমোরিয়াল পাবলিক উচ্চ বিদ্যালয়',
    nameEn: 'Islampur Padma Memorial Public High School',
    upazila: 'কমলগঞ্জ (ইসলামপুর)',
    venueId: 'V02',
    plainPin: '2636',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S037',
    name: 'এ. এ. টি. এম. বহুমুখী উচ্চ বিদ্যালয়',
    nameEn: 'A. A. T. M. Multilateral High School',
    upazila: 'কমলগঞ্জ (বাদার দেউল)',
    venueId: 'V02',
    plainPin: '2637',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },
  {
    id: 'S038',
    name: 'তৌহিদুল ইসলাম চৌধুরী বালিকা উচ্চ বিদ্যালয়',
    nameEn: 'Tawhidul Islam Chowdhury Girls High School',
    upazila: 'কমলগঞ্জ (৩২২০)',
    venueId: 'V02',
    plainPin: '2638',
    formsNeeded: { '01': 0, '02': 20, '03': 20 }
  },

  // =========================================================================
  // 4. Outside Kamalganj Thana
  // =========================================================================
  {
    id: 'S039',
    name: 'বিএএফ শাহীন কলেজ শমশেরনগর',
    nameEn: 'BAF Shaheen College Shamshernagar',
    upazila: 'শমসেরনগর (কমলগঞ্জ থানার বাইরে)',
    venueId: 'V02',
    plainPin: '2639',
    formsNeeded: { '01': 20, '02': 20, '03': 20 }
  }
];
