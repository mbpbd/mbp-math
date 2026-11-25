import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  deleteField,
  writeBatch
} from 'firebase/firestore';
import { db, testConnection } from '../config/firebase';
import {
  OnlineApplication,
  Student,
  ContestSettings,
  CategoryCode,
  School,
  Venue,
  NumberBlock
} from '../types';
import { DEFAULT_SETTINGS } from './defaultData';
import { allocateSchoolBlocks } from './blockAllocation';
import type { SeatPlanResult } from './seatPlanAlgorithm';

export { db, testConnection };

// Local Storage Cache Keys
export const LS_KEYS = {
  APPLICATIONS: 'mbp_applications_cache',
  STUDENTS: 'mbp_students_cache',
  TEACHER_MARKS: 'mbp_teacher_marks_cache',
  SETTINGS: 'mbp_settings_cache',
  SCHOOLS: 'mbp_schools_cache',
  VENUES: 'mbp_venues_cache',
  BLOCKS: 'mbp_blocks_cache',
  SEAT_PLANS: 'mbp_seat_plans_cache',
  META: 'mbp_dataset_meta'
};

export interface DatasetMeta {
  studentsWiped?: boolean;
  appsWiped?: boolean;
  teacherMarksWiped?: boolean;
  schoolsWiped?: boolean;
  venuesWiped?: boolean;
  blocksWiped?: boolean;
  seededOnce?: boolean;
  kamalganjSchoolsV1?: boolean;
  kamalganjSchoolsV2?: boolean;
  venuesV2V3Added?: boolean;
  schoolsVenueV02Migrated?: boolean;
  studentsVenueV02Migrated?: boolean;
  studentsQuestionMediumBackfilled?: boolean;
}

/**
 * Recursively strips `undefined` values from objects/arrays so Firestore setDoc/updateDoc never rejects payloads.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = stripUndefined(v);
      }
    }
    return cleaned as T;
  }
  return value;
}

/**
 * Helper to retrieve cached data from LocalStorage for instant rendering
 */
export function getCachedItem<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Helper to update LocalStorage cache
 */
export function setCachedItem<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function getLocalMeta(): DatasetMeta {
  const legacyWiped = localStorage.getItem('mbp_dataset_wiped') === 'true';
  const meta = getCachedItem<DatasetMeta>(LS_KEYS.META, {});
  if (legacyWiped) {
    return {
      studentsWiped: true,
      appsWiped: true,
      teacherMarksWiped: true,
      ...meta
    };
  }
  return meta;
}

async function updateDatasetMeta(patch: Partial<DatasetMeta>): Promise<void> {
  const current = getLocalMeta();
  const next = { ...current, ...patch };
  setCachedItem(LS_KEYS.META, next);
  try {
    await setDoc(doc(db, 'settings', 'dataset_meta'), stripUndefined(next), { merge: true });
  } catch (e) {
    console.warn('Failed to update dataset_meta in Firestore:', e);
  }
}

/**
 * Calculates the next reserved online registration number starting from onlineSerialStart (default 601).
 * Category '01' => 2601601, 2601602...
 * Category '02' => 2602601, 2602602...
 * Category '03' => 2603601, 2603602...
 */
export function getNextOnlineRegistrationId(
  category: CategoryCode,
  yearCode: string = '26',
  existingApps: OnlineApplication[] = [],
  existingStudents: Student[] = [],
  onlineSerialStart: number = 601
): { serial: number; fullId: string } {
  const prefix = `${yearCode}${category}`;
  const start = onlineSerialStart || 601;
  const usedSerials = new Set<number>();

  // Inspect existing registered students
  for (const s of existingStudents) {
    if (s.id && s.id.startsWith(prefix)) {
      const serialPart = parseInt(s.id.slice(prefix.length), 10);
      if (!isNaN(serialPart) && serialPart >= start) {
        usedSerials.add(serialPart);
      }
    }
  }

  // Inspect active online applications (pending and verified ONLY — rejected IDs are freed for reuse)
  for (const a of existingApps) {
    if (a.status === 'rejected') continue;
    if (a.assignedId && a.assignedId.startsWith(prefix)) {
      const serialPart = parseInt(a.assignedId.slice(prefix.length), 10);
      if (!isNaN(serialPart) && serialPart >= start) {
        usedSerials.add(serialPart);
      }
    }
  }

  let nextSerial = start;
  while (usedSerials.has(nextSerial)) {
    nextSerial++;
  }

  const fullId = `${prefix}${nextSerial}`;
  return { serial: nextSerial, fullId };
}

// -------------------------------------------------------------
// Real-time Subscriptions (onSnapshot with LocalStorage caching)
// -------------------------------------------------------------

export function subscribeToApplications(
  onData: (apps: OnlineApplication[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'applications');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const apps: OnlineApplication[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as OnlineApplication;
          apps.push({
            ...data,
            questionMedium: data.questionMedium === 'english' ? 'english' : 'bangla'
          });
        });
        apps.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setCachedItem(LS_KEYS.APPLICATIONS, apps);
        onData(apps);
      },
      (err) => {
        console.error('Firestore applications subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup applications listener:', err);
    return () => {};
  }
}

export function subscribeToStudents(
  onData: (students: Student[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'students');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const students: Student[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Student;
          students.push({
            ...data,
            questionMedium: data.questionMedium === 'english' ? 'english' : 'bangla'
          });
        });
        setCachedItem(LS_KEYS.STUDENTS, students);
        onData(students);
      },
      (err) => {
        console.error('Firestore students subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup students listener:', err);
    return () => {};
  }
}

export function subscribeToTeacherMarks(
  onData: (markedIds: string[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const docRef = doc(db, 'teacher_marks', 'marks');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const ids = (data.markedSchoolIds as string[]) || [];
          setCachedItem(LS_KEYS.TEACHER_MARKS, ids);
          onData(ids);
        } else {
          setCachedItem(LS_KEYS.TEACHER_MARKS, []);
          onData([]);
        }
      },
      (err) => {
        console.error('Firestore teacher marks subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup teacher marks listener:', err);
    return () => {};
  }
}

export function subscribeToSettings(
  onData: (settings: ContestSettings) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const docRef = doc(db, 'settings', 'contest_settings');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const settings = snap.data() as ContestSettings;
          setCachedItem(LS_KEYS.SETTINGS, settings);
          onData(settings);
        }
      },
      (err) => {
        console.error('Firestore settings subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup settings listener:', err);
    return () => {};
  }
}

export function subscribeToSchools(
  onData: (schools: School[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'schools');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const schools: School[] = [];
        snapshot.forEach((docSnap) => {
          schools.push(docSnap.data() as School);
        });
        schools.sort((a, b) => a.id.localeCompare(b.id));
        setCachedItem(LS_KEYS.SCHOOLS, schools);
        onData(schools);
      },
      (err) => {
        console.error('Firestore schools subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup schools listener:', err);
    return () => {};
  }
}

export function subscribeToVenues(
  onData: (venues: Venue[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'venues');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const venues: Venue[] = [];
        snapshot.forEach((docSnap) => {
          venues.push(docSnap.data() as Venue);
        });
        venues.sort((a, b) => a.id.localeCompare(b.id));
        setCachedItem(LS_KEYS.VENUES, venues);
        onData(venues);
      },
      (err) => {
        console.error('Firestore venues subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup venues listener:', err);
    return () => {};
  }
}

export function subscribeToBlocks(
  onData: (blocks: NumberBlock[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'blocks');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const blocks: NumberBlock[] = [];
        snapshot.forEach((docSnap) => {
          blocks.push(docSnap.data() as NumberBlock);
        });
        blocks.sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category);
          return a.firstSerial - b.firstSerial;
        });
        setCachedItem(LS_KEYS.BLOCKS, blocks);
        onData(blocks);
      },
      (err) => {
        console.error('Firestore blocks subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup blocks listener:', err);
    return () => {};
  }
}

export function subscribeToSeatPlans(
  onData: (seatPlans: SeatPlanResult[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const colRef = collection(db, 'seatPlans');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const plans: SeatPlanResult[] = [];
        snapshot.forEach((docSnap) => {
          plans.push(docSnap.data() as SeatPlanResult);
        });
        plans.sort((a, b) => a.venueId.localeCompare(b.venueId));
        setCachedItem(LS_KEYS.SEAT_PLANS, plans);
        onData(plans);
      },
      (err) => {
        console.error('Firestore seatPlans subscription error:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.error('Failed to setup seatPlans listener:', err);
    return () => {};
  }
}

// -------------------------------------------------------------
// Mutations (Persist to Firestore & mirror locally)
// -------------------------------------------------------------

export async function saveOnlineApplication(
  appData: Omit<OnlineApplication, 'id' | 'submittedAt' | 'status'>,
  assignedId: string
): Promise<OnlineApplication> {
  const appId = `app-${Date.now()}`;
  const newApp: OnlineApplication = stripUndefined({
    ...appData,
    questionMedium: appData.questionMedium === 'english' ? 'english' : 'bangla',
    id: appId,
    assignedId,
    status: 'pending',
    submittedAt: new Date().toISOString()
  });

  const cached = getCachedItem<OnlineApplication[]>(LS_KEYS.APPLICATIONS, []);
  setCachedItem(LS_KEYS.APPLICATIONS, [newApp, ...cached]);

  try {
    await setDoc(doc(db, 'applications', appId), newApp);
  } catch (e) {
    console.warn('Firestore setDoc failed for application:', e);
  }

  return newApp;
}

export async function verifyOnlineApplication(
  app: OnlineApplication,
  assignedId: string,
  venueId: string
): Promise<{ app: OnlineApplication; student: Student }> {
  const verifiedAt = new Date().toISOString();

  const updatedApp: OnlineApplication = stripUndefined({
    ...app,
    status: 'verified',
    assignedId,
    assignedVenueId: venueId,
    verifiedAt
  });

  const newStudent: Student = stripUndefined({
    id: assignedId,
    category: app.category,
    class: app.class,
    nameBn: app.nameBn,
    nameEn: app.nameEn,
    fatherName: app.fatherName,
    motherName: app.motherName,
    mobile: app.mobile,
    village: app.village,
    upazila: app.upazila,
    district: app.district,
    schoolName: app.schoolName,
    venueId,
    source: 'online',
    questionMedium: app.questionMedium === 'english' ? 'english' : 'bangla',
    photoPath: app.photoPath,
    createdAt: verifiedAt
  });

  const cachedApps = getCachedItem<OnlineApplication[]>(LS_KEYS.APPLICATIONS, []);
  setCachedItem(LS_KEYS.APPLICATIONS, cachedApps.map(a => a.id === app.id ? updatedApp : a));

  const cachedStudents = getCachedItem<Student[]>(LS_KEYS.STUDENTS, []);
  setCachedItem(LS_KEYS.STUDENTS, [newStudent, ...cachedStudents.filter(s => s.id !== assignedId)]);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'students', assignedId), newStudent);
    batch.set(doc(db, 'applications', app.id), updatedApp);
    await batch.commit();
  } catch (e) {
    console.warn('Firestore verify save failed:', e);
  }

  return { app: updatedApp, student: newStudent };
}

export async function rejectOnlineApplication(appId: string, reason: string): Promise<void> {
  const updateData = stripUndefined({
    status: 'rejected' as const,
    reason,
    verifiedAt: new Date().toISOString()
  });

  const cachedApps = getCachedItem<OnlineApplication[]>(LS_KEYS.APPLICATIONS, []);
  setCachedItem(LS_KEYS.APPLICATIONS, cachedApps.map(a => a.id === appId ? { ...a, ...updateData } : a));

  try {
    await updateDoc(doc(db, 'applications', appId), updateData);
  } catch (e) {
    console.warn('Firestore reject update failed:', e);
  }
}

export async function updateApplicationSmsStatus(
  appId: string,
  smsPatch: {
    smsStatus: 'sent' | 'failed' | 'not_configured' | 'phone_app';
    smsSentAt?: string;
    smsMessage?: string;
    smsProvider?: string;
    smsError?: string;
    to?: string;
    registrationId?: string;
  }
): Promise<void> {
  const appFields = stripUndefined({
    smsStatus: smsPatch.smsStatus,
    smsSentAt: smsPatch.smsSentAt,
    smsMessage: smsPatch.smsMessage,
    smsProvider: smsPatch.smsProvider,
    smsError: smsPatch.smsError
  });

  const cachedApps = getCachedItem<OnlineApplication[]>(LS_KEYS.APPLICATIONS, []);
  setCachedItem(
    LS_KEYS.APPLICATIONS,
    cachedApps.map(a => (a.id === appId ? { ...a, ...appFields } : a))
  );

  try {
    await updateDoc(doc(db, 'applications', appId), appFields);
    await setDoc(
      doc(db, 'smsLog', `${appId}-${Date.now()}`),
      stripUndefined({
        applicationId: appId,
        registrationId: smsPatch.registrationId,
        to: smsPatch.to,
        status: smsPatch.smsStatus,
        provider: smsPatch.smsProvider,
        message: smsPatch.smsMessage,
        error: smsPatch.smsError,
        at: new Date().toISOString()
      })
    );
  } catch (e) {
    console.warn('Firestore SMS status update failed:', e);
  }
}

export async function saveTeacherMarks(allMarkedIds: string[]): Promise<void> {
  setCachedItem(LS_KEYS.TEACHER_MARKS, allMarkedIds);
  try {
    await setDoc(doc(db, 'teacher_marks', 'marks'), {
      markedSchoolIds: allMarkedIds,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Firestore teacher marks save failed:', e);
  }
}

export async function saveStudent(student: Student): Promise<void> {
  const cleanStudent = stripUndefined(student);
  const cachedStudents = getCachedItem<Student[]>(LS_KEYS.STUDENTS, []);
  const idx = cachedStudents.findIndex(s => s.id === cleanStudent.id);
  if (idx >= 0) {
    cachedStudents[idx] = cleanStudent;
  } else {
    cachedStudents.unshift(cleanStudent);
  }
  setCachedItem(LS_KEYS.STUDENTS, cachedStudents);

  try {
    await setDoc(doc(db, 'students', cleanStudent.id), cleanStudent);
  } catch (e) {
    console.warn('Firestore save student failed:', e);
  }
}

export async function saveStudentsBatch(studentsList: Student[]): Promise<void> {
  const cleanList = studentsList.map(s => stripUndefined(s));
  setCachedItem(LS_KEYS.STUDENTS, cleanList);

  try {
    const batch = writeBatch(db);
    for (const st of cleanList) {
      batch.set(doc(db, 'students', st.id), st);
    }
    await batch.commit();
  } catch (e) {
    console.warn('Firestore batch save students failed, falling back to individual writes:', e);
    for (const st of cleanList) {
      try {
        await setDoc(doc(db, 'students', st.id), st);
      } catch (innerErr) {
        console.warn(`Failed to save student ${st.id}:`, innerErr);
      }
    }
  }
}

export async function deleteStudent(studentId: string): Promise<void> {
  const cachedStudents = getCachedItem<Student[]>(LS_KEYS.STUDENTS, []);
  setCachedItem(LS_KEYS.STUDENTS, cachedStudents.filter(s => s.id !== studentId));
  await updateDatasetMeta({ studentsWiped: true });

  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (e) {
    console.warn('Firestore delete student failed:', e);
  }
}

export async function saveSchool(school: School): Promise<void> {
  const cleanSchool = stripUndefined(school);
  const cachedSchools = getCachedItem<School[]>(LS_KEYS.SCHOOLS, []);
  const idx = cachedSchools.findIndex(s => s.id === cleanSchool.id);
  if (idx >= 0) {
    cachedSchools[idx] = cleanSchool;
  } else {
    cachedSchools.push(cleanSchool);
  }
  setCachedItem(LS_KEYS.SCHOOLS, cachedSchools);
  await updateDatasetMeta({ schoolsWiped: false, seededOnce: true });

  try {
    await setDoc(doc(db, 'schools', cleanSchool.id), cleanSchool);
  } catch (e) {
    console.warn('Firestore save school failed:', e);
  }
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const cachedSchools = getCachedItem<School[]>(LS_KEYS.SCHOOLS, []);
  setCachedItem(LS_KEYS.SCHOOLS, cachedSchools.filter(s => s.id !== schoolId));
  await updateDatasetMeta({ schoolsWiped: true });

  try {
    await deleteDoc(doc(db, 'schools', schoolId));
  } catch (e) {
    console.warn('Firestore delete school failed:', e);
  }
}

export async function saveVenue(venue: Venue): Promise<void> {
  const cleanVenue = stripUndefined(venue);
  const cachedVenues = getCachedItem<Venue[]>(LS_KEYS.VENUES, []);
  const idx = cachedVenues.findIndex(v => v.id === cleanVenue.id);
  if (idx >= 0) {
    cachedVenues[idx] = cleanVenue;
  } else {
    cachedVenues.push(cleanVenue);
  }
  setCachedItem(LS_KEYS.VENUES, cachedVenues);
  await updateDatasetMeta({ venuesWiped: false, seededOnce: true });

  try {
    await setDoc(doc(db, 'venues', cleanVenue.id), cleanVenue);
  } catch (e) {
    console.warn('Firestore save venue failed:', e);
  }
}

export async function deleteVenue(venueId: string): Promise<void> {
  const cachedVenues = getCachedItem<Venue[]>(LS_KEYS.VENUES, []);
  setCachedItem(LS_KEYS.VENUES, cachedVenues.filter(v => v.id !== venueId));
  await updateDatasetMeta({ venuesWiped: true });

  try {
    await deleteDoc(doc(db, 'venues', venueId));
  } catch (e) {
    console.warn('Firestore delete venue failed:', e);
  }
}

export async function saveBlocks(blocks: NumberBlock[]): Promise<void> {
  const cleanBlocks = blocks.map(b => stripUndefined(b));
  setCachedItem(LS_KEYS.BLOCKS, cleanBlocks);
  await updateDatasetMeta({ blocksWiped: false, seededOnce: true });

  try {
    const existingSnap = await getDocs(collection(db, 'blocks'));
    const batch = writeBatch(db);
    existingSnap.docs.forEach(d => batch.delete(d.ref));
    cleanBlocks.forEach(b => batch.set(doc(db, 'blocks', b.id), b));
    await batch.commit();
  } catch (e) {
    console.warn('Firestore save blocks failed:', e);
  }
}

export async function saveSeatPlan(plan: SeatPlanResult): Promise<void> {
  const cleanPlan = stripUndefined(plan);
  const cachedPlans = getCachedItem<SeatPlanResult[]>(LS_KEYS.SEAT_PLANS, []);
  const nextPlans = [cleanPlan, ...cachedPlans.filter(p => p.venueId !== cleanPlan.venueId)];
  setCachedItem(LS_KEYS.SEAT_PLANS, nextPlans);

  try {
    await setDoc(doc(db, 'seatPlans', cleanPlan.venueId), cleanPlan);
  } catch (e) {
    console.warn('Firestore save seat plan failed:', e);
  }
}

export async function saveSeatPlansBatch(plans: SeatPlanResult[]): Promise<void> {
  const cleanPlans = plans.map(p => stripUndefined(p));
  const cachedPlans = getCachedItem<SeatPlanResult[]>(LS_KEYS.SEAT_PLANS, []);
  const replacedIds = new Set(cleanPlans.map(p => p.venueId));
  const nextPlans = [
    ...cleanPlans,
    ...cachedPlans.filter(p => !replacedIds.has(p.venueId))
  ];
  setCachedItem(LS_KEYS.SEAT_PLANS, nextPlans);

  try {
    const batch = writeBatch(db);
    cleanPlans.forEach(p => {
      batch.set(doc(db, 'seatPlans', p.venueId), p);
    });
    await batch.commit();
  } catch (e) {
    console.warn('Firestore batch save seat plans failed:', e);
  }
}

export async function saveContestSettings(settings: ContestSettings): Promise<void> {
  const cleanSettings = stripUndefined({
    ...settings,
    syllabusUpdatedV2: true,
    syllabusUpdatedV3: true,
    syllabusUpdatedV4: true,
    syllabusUpdatedV5: true,
    onlineSerialMigrated601: true,
    helplineSwitchedV1: true
  });
  setCachedItem(LS_KEYS.SETTINGS, cleanSettings);

  try {
    await setDoc(doc(db, 'settings', 'contest_settings'), cleanSettings);
  } catch (e) {
    console.warn('Firestore save settings failed:', e);
    throw e;
  }
}

/**
 * Populates initial sample data to Firestore ONLY on first boot when collections are empty
 * and have NOT been explicitly wiped/modified by admins.
 * NEVER overwrites existing settings, schools, venues, blocks, or teacher marks.
 */
export async function seedInitialFirestoreData(params: {
  defaultStudents: Student[];
  defaultApplications: OnlineApplication[];
  defaultMarkedIds: string[];
  defaultSettings: ContestSettings;
  defaultSchools: School[];
  defaultVenues: Venue[];
  defaultBlocks: NumberBlock[];
}): Promise<DatasetMeta> {
  let meta: DatasetMeta = getLocalMeta();

  try {
    await testConnection();

    // Load authoritative dataset_meta from Firestore if it exists
    const metaSnap = await getDoc(doc(db, 'settings', 'dataset_meta'));
    if (metaSnap.exists()) {
      meta = { ...meta, ...(metaSnap.data() as DatasetMeta) };
      setCachedItem(LS_KEYS.META, meta);
    }

    // 1. Seed Settings ONLY if contest_settings document does not exist
    const settingsRef = doc(db, 'settings', 'contest_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      const initialSettings = stripUndefined({
        ...params.defaultSettings,
        syllabusUpdatedV2: true,
        syllabusUpdatedV3: true,
        syllabusUpdatedV4: true,
        syllabusUpdatedV5: true,
        onlineSerialMigrated601: true,
        helplineSwitchedV1: true
      });
      await setDoc(settingsRef, initialSettings);
      setCachedItem(LS_KEYS.SETTINGS, initialSettings);
    }

    // 2. Seed Venues if empty and not explicitly wiped, plus idempotently add any missing default venues (V02 & V03) while keeping V01 intact
    if (!meta.venuesWiped) {
      const venuesSnap = await getDocs(collection(db, 'venues'));
      if (venuesSnap.empty && params.defaultVenues.length > 0) {
        for (const v of params.defaultVenues) {
          await setDoc(doc(db, 'venues', v.id), stripUndefined(v));
        }
        setCachedItem(LS_KEYS.VENUES, params.defaultVenues);
        await updateDatasetMeta({ venuesV2V3Added: true });
        meta.venuesV2V3Added = true;
      } else if (params.defaultVenues.length > 0) {
        const existingVenueIds = new Set(venuesSnap.docs.map(d => d.id));
        const mergedVenues = venuesSnap.docs.map(d => d.data() as Venue);
        let addedAny = false;
        for (const v of params.defaultVenues) {
          if (!existingVenueIds.has(v.id)) {
            await setDoc(doc(db, 'venues', v.id), stripUndefined(v));
            mergedVenues.push(v);
            addedAny = true;
          }
        }
        if (addedAny) {
          mergedVenues.sort((a, b) => a.id.localeCompare(b.id));
          setCachedItem(LS_KEYS.VENUES, mergedVenues);
        }
        if (!meta.venuesV2V3Added || addedAny) {
          await updateDatasetMeta({ venuesV2V3Added: true });
          meta.venuesV2V3Added = true;
        }
      }
    }

    // 3. Seed or upgrade Schools to curated Kamalganj Thana Primary -> Junior -> Secondary -> Outside (BAF Shaheen) list
    let migratedKamalganjSchools = false;
    if (!meta.schoolsWiped) {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      if (schoolsSnap.empty && params.defaultSchools.length > 0) {
        const batch = writeBatch(db);
        for (const s of params.defaultSchools) {
          batch.set(doc(db, 'schools', s.id), stripUndefined(s));
        }
        await batch.commit();
        setCachedItem(LS_KEYS.SCHOOLS, params.defaultSchools);
        migratedKamalganjSchools = true;
      } else if (!meta.kamalganjSchoolsV2 && params.defaultSchools.length > 0) {
        const defaultIds = new Set(params.defaultSchools.map(s => s.id));
        const obsoleteV1Ids = new Set(['S040', 'S041', 'S042', 'S043', 'S044', 'S045', 'S046', 'S047']);
        const customSchools = schoolsSnap.docs
          .map(d => d.data() as School)
          .filter(s => !defaultIds.has(s.id) && !obsoleteV1Ids.has(s.id));
        const mergedSchools = [...params.defaultSchools, ...customSchools].sort((a, b) => a.id.localeCompare(b.id));

        const batch = writeBatch(db);
        for (const oldDoc of schoolsSnap.docs) {
          if (obsoleteV1Ids.has(oldDoc.id)) {
            batch.delete(oldDoc.ref);
          }
        }
        for (const s of params.defaultSchools) {
          batch.set(doc(db, 'schools', s.id), stripUndefined(s));
        }
        await batch.commit();
        setCachedItem(LS_KEYS.SCHOOLS, mergedSchools);
        migratedKamalganjSchools = true;

        // Re-allocate school blocks to match curated Primary -> Junior -> Secondary -> Outside order
        if (!meta.blocksWiped) {
          const existingBlocksSnap = await getDocs(collection(db, 'blocks'));
          const nonSchoolBlocks = existingBlocksSnap.docs
            .map(d => d.data() as NumberBlock)
            .filter(b => b.type !== 'school');
          const venuesSnap = await getDocs(collection(db, 'venues'));
          const liveVenues = venuesSnap.empty
            ? params.defaultVenues
            : venuesSnap.docs.map(d => d.data() as Venue);
          const alloc = allocateSchoolBlocks({
            schools: mergedSchools,
            venues: liveVenues,
            contestYear: params.defaultSettings.yearCode,
            onlineSerialStart: params.defaultSettings.onlineSerialStart,
            serialDigits: params.defaultSettings.serialDigits
          });
          if (alloc.success) {
            const finalBlocks = [...alloc.blocks, ...nonSchoolBlocks];
            const blkBatch = writeBatch(db);
            existingBlocksSnap.docs.forEach(d => blkBatch.delete(d.ref));
            finalBlocks.forEach(b => blkBatch.set(doc(db, 'blocks', b.id), stripUndefined(b)));
            await blkBatch.commit();
            setCachedItem(LS_KEYS.BLOCKS, finalBlocks);
          }
        }
      } else if (!meta.schoolsVenueV02Migrated) {
        // Non-destructively update schools & blocks still pointing to V01 -> V02 (Dayamay) for Math Quiz 2026 forms
        const dayamayVenue = params.defaultVenues.find(v => v.id === 'V02');
        const dayamayName = dayamayVenue?.name || 'দয়াময় সিংহ উচ্চ বিদ্যালয়';
        const batch = writeBatch(db);
        let updatedSchoolsCount = 0;
        const nextSchools = schoolsSnap.docs.map(d => {
          const s = d.data() as School;
          if (s.venueId === 'V01') {
            updatedSchoolsCount++;
            const nextS = { ...s, venueId: 'V02' };
            batch.set(d.ref, stripUndefined(nextS));
            return nextS;
          }
          return s;
        });
        if (updatedSchoolsCount > 0) {
          await batch.commit();
          nextSchools.sort((a, b) => a.id.localeCompare(b.id));
          setCachedItem(LS_KEYS.SCHOOLS, nextSchools);
        }

        if (!meta.blocksWiped) {
          const blocksSnap = await getDocs(collection(db, 'blocks'));
          const blkBatch = writeBatch(db);
          let updatedBlocksCount = 0;
          const nextBlocks = blocksSnap.docs.map(d => {
            const b = d.data() as NumberBlock;
            if (b.venueId === 'V01') {
              updatedBlocksCount++;
              const nextB = { ...b, venueId: 'V02', venueName: dayamayName };
              blkBatch.set(d.ref, stripUndefined(nextB));
              return nextB;
            }
            return b;
          });
          if (updatedBlocksCount > 0) {
            await blkBatch.commit();
            setCachedItem(LS_KEYS.BLOCKS, nextBlocks);
          }
        }
      }

      if (!meta.kamalganjSchoolsV1 || !meta.kamalganjSchoolsV2 || !meta.schoolsVenueV02Migrated) {
        await updateDatasetMeta({
          kamalganjSchoolsV1: true,
          kamalganjSchoolsV2: true,
          schoolsVenueV02Migrated: true
        });
        meta.kamalganjSchoolsV1 = true;
        meta.kamalganjSchoolsV2 = true;
        meta.schoolsVenueV02Migrated = true;
      }
    }

    // 4. Seed Blocks if empty and not explicitly wiped
    if (!meta.blocksWiped && !migratedKamalganjSchools) {
      const blocksSnap = await getDocs(collection(db, 'blocks'));
      if (blocksSnap.empty && params.defaultBlocks.length > 0) {
        const batch = writeBatch(db);
        for (const b of params.defaultBlocks) {
          batch.set(doc(db, 'blocks', b.id), stripUndefined(b));
        }
        await batch.commit();
        setCachedItem(LS_KEYS.BLOCKS, params.defaultBlocks);
      }
    }

    // 5. Seed Students ONLY if empty and not wiped; otherwise migrate existing unseated V01 students -> V02 once non-destructively
    if (!meta.studentsWiped) {
      const studentsSnap = await getDocs(collection(db, 'students'));
      if (studentsSnap.empty && !meta.seededOnce) {
        for (const st of params.defaultStudents) {
          await setDoc(doc(db, 'students', st.id), stripUndefined(st));
        }
        setCachedItem(LS_KEYS.STUDENTS, params.defaultStudents);
      } else if (!meta.studentsVenueV02Migrated || !meta.studentsQuestionMediumBackfilled) {
        const stBatch = writeBatch(db);
        let updatedStCount = 0;
        const nextStudents = studentsSnap.docs.map(d => {
          const st = d.data() as Student;
          const patch: Partial<Student> = {};
          if (!meta.studentsVenueV02Migrated && st.venueId === 'V01' && !st.seatVenueId) {
            patch.venueId = 'V02';
          }
          if (!st.questionMedium) {
            patch.questionMedium = 'bangla';
          }
          if (Object.keys(patch).length > 0) {
            updatedStCount++;
            stBatch.update(d.ref, stripUndefined(patch));
            return { ...st, ...patch };
          }
          return st;
        });
        if (updatedStCount > 0) {
          await stBatch.commit();
          setCachedItem(LS_KEYS.STUDENTS, nextStudents);
        }
      }
    }

    // 6. Seed Applications ONLY if empty and not wiped; migrate verified applications with assignedVenueId === 'V01' -> 'V02' and backfill missing questionMedium -> 'bangla'
    if (!meta.appsWiped) {
      const appsSnap = await getDocs(collection(db, 'applications'));
      if (appsSnap.empty && !meta.seededOnce) {
        for (const ap of params.defaultApplications) {
          await setDoc(doc(db, 'applications', ap.id), stripUndefined(ap));
        }
        setCachedItem(LS_KEYS.APPLICATIONS, params.defaultApplications);
      } else if (!meta.studentsVenueV02Migrated || !meta.studentsQuestionMediumBackfilled) {
        const appBatch = writeBatch(db);
        let updatedAppCount = 0;
        const nextApps = appsSnap.docs.map(d => {
          const ap = d.data() as OnlineApplication;
          const patch: Partial<OnlineApplication> = {};
          if (!meta.studentsVenueV02Migrated && ap.assignedVenueId === 'V01') {
            patch.assignedVenueId = 'V02';
          }
          if (!ap.questionMedium) {
            patch.questionMedium = 'bangla';
          }
          if (Object.keys(patch).length > 0) {
            updatedAppCount++;
            appBatch.update(d.ref, stripUndefined(patch));
            return { ...ap, ...patch };
          }
          return ap;
        });
        if (updatedAppCount > 0) {
          await appBatch.commit();
          setCachedItem(LS_KEYS.APPLICATIONS, nextApps);
        }
      }
    }

    if (!meta.studentsVenueV02Migrated || !meta.studentsQuestionMediumBackfilled) {
      await updateDatasetMeta({
        studentsVenueV02Migrated: true,
        studentsQuestionMediumBackfilled: true
      });
      meta.studentsVenueV02Migrated = true;
      meta.studentsQuestionMediumBackfilled = true;
    }

    // 7. Seed Teacher Marks ONLY if doc does not exist and not wiped
    if (!meta.teacherMarksWiped) {
      const marksRef = doc(db, 'teacher_marks', 'marks');
      const marksSnap = await getDoc(marksRef);
      if (!marksSnap.exists() && !meta.seededOnce) {
        await setDoc(marksRef, {
          markedSchoolIds: params.defaultMarkedIds,
          updatedAt: new Date().toISOString()
        });
        setCachedItem(LS_KEYS.TEACHER_MARKS, params.defaultMarkedIds);
      }
    }

    if (!meta.seededOnce) {
      await updateDatasetMeta({ seededOnce: true });
      meta.seededOnce = true;
    }
  } catch (e) {
    console.warn('Firestore initial seeding error (continuing with local cache):', e);
  }

  return meta;
}

export interface PartialResetOptions {
  resetResults?: boolean;
  resetStudents?: boolean;
  resetApplications?: boolean;
  resetTeacherMarks?: boolean;
  resetSchools?: boolean;
  resetVenues?: boolean;
  resetSettings?: boolean;
}

/**
 * Granularly resets selected portions of the dataset decided by admins.
 */
export async function partialResetDataset(options: PartialResetOptions): Promise<void> {
  const metaPatch: Partial<DatasetMeta> = { seededOnce: true };

  if (options.resetStudents) {
    localStorage.setItem('mbp_dataset_wiped', 'true');
    setCachedItem(LS_KEYS.STUDENTS, []);
    setCachedItem(LS_KEYS.SEAT_PLANS, []);
    metaPatch.studentsWiped = true;
    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      await Promise.all(studentsSnap.docs.map(d => deleteDoc(d.ref)));
      const seatPlansSnap = await getDocs(collection(db, 'seatPlans'));
      await Promise.all(seatPlansSnap.docs.map(d => deleteDoc(d.ref)));
    } catch (e) {
      console.warn('Error clearing Firestore students/seatPlans:', e);
    }
  } else if (options.resetResults) {
    const cached = getCachedItem<Student[]>(LS_KEYS.STUDENTS, []);
    const updatedCached = cached.map(s => {
      const copy = { ...s };
      delete copy.marks;
      delete copy.position;
      copy.attendance = false;
      return copy;
    });
    setCachedItem(LS_KEYS.STUDENTS, updatedCached);

    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      await Promise.all(
        studentsSnap.docs.map(d =>
          updateDoc(d.ref, {
            marks: deleteField(),
            position: deleteField(),
            attendance: false
          })
        )
      );
    } catch (e) {
      console.warn('Error resetting results on Firestore students:', e);
    }
  }

  if (options.resetApplications) {
    setCachedItem(LS_KEYS.APPLICATIONS, []);
    metaPatch.appsWiped = true;
    try {
      const appsSnap = await getDocs(collection(db, 'applications'));
      await Promise.all(appsSnap.docs.map(d => deleteDoc(d.ref)));
    } catch (e) {
      console.warn('Error clearing Firestore applications:', e);
    }
  }

  if (options.resetTeacherMarks) {
    setCachedItem(LS_KEYS.TEACHER_MARKS, []);
    metaPatch.teacherMarksWiped = true;
    try {
      await setDoc(doc(db, 'teacher_marks', 'marks'), {
        markedSchoolIds: [],
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Error resetting Firestore teacher marks:', e);
    }
  }

  if (options.resetSchools) {
    setCachedItem(LS_KEYS.SCHOOLS, []);
    setCachedItem(LS_KEYS.BLOCKS, []);
    metaPatch.schoolsWiped = true;
    metaPatch.blocksWiped = true;
    metaPatch.kamalganjSchoolsV1 = true;
    metaPatch.kamalganjSchoolsV2 = true;
    metaPatch.schoolsVenueV02Migrated = true;
    try {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      await Promise.all(schoolsSnap.docs.map(d => deleteDoc(d.ref)));
      const blocksSnap = await getDocs(collection(db, 'blocks'));
      await Promise.all(blocksSnap.docs.map(d => deleteDoc(d.ref)));
    } catch (e) {
      console.warn('Error clearing Firestore schools/blocks:', e);
    }
  }

  if (options.resetVenues) {
    setCachedItem(LS_KEYS.VENUES, []);
    setCachedItem(LS_KEYS.SEAT_PLANS, []);
    metaPatch.venuesWiped = true;
    metaPatch.venuesV2V3Added = true;
    try {
      const venuesSnap = await getDocs(collection(db, 'venues'));
      await Promise.all(venuesSnap.docs.map(d => deleteDoc(d.ref)));
      const seatPlansSnap = await getDocs(collection(db, 'seatPlans'));
      await Promise.all(seatPlansSnap.docs.map(d => deleteDoc(d.ref)));
    } catch (e) {
      console.warn('Error clearing Firestore venues/seatPlans:', e);
    }
  }

  if (options.resetSettings) {
    const freshSettings = stripUndefined({
      ...DEFAULT_SETTINGS,
      syllabusUpdatedV2: true,
      syllabusUpdatedV3: true,
      syllabusUpdatedV4: true,
      syllabusUpdatedV5: true,
      onlineSerialMigrated601: true,
      helplineSwitchedV1: true
    });
    setCachedItem(LS_KEYS.SETTINGS, freshSettings);
    try {
      await setDoc(doc(db, 'settings', 'contest_settings'), freshSettings);
    } catch (e) {
      console.warn('Error resetting Firestore settings:', e);
    }
  }

  await updateDatasetMeta(metaPatch);
}

/**
 * Full dataset wipe helper
 */
export async function wipeAndCleanDataset(): Promise<void> {
  return partialResetDataset({
    resetStudents: true,
    resetApplications: true,
    resetTeacherMarks: true
  });
}
