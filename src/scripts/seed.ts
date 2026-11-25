import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_SETTINGS, INITIAL_SCHOOLS, INITIAL_VENUES } from '../services/defaultData';
import { allocateSchoolBlocks } from '../services/blockAllocation';
import { hashPin } from '../services/idSystem';
import { stripUndefined, LS_KEYS, setCachedItem } from '../services/firestoreService';
import { School } from '../types';

export async function runSeedData(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('Seeding MBP Math Quiz initial configuration...');

    // 1. Settings (Private & Public)
    const seededSettings = stripUndefined({
      ...DEFAULT_SETTINGS,
      syllabusUpdatedV2: true,
      syllabusUpdatedV3: true,
      syllabusUpdatedV4: true,
      syllabusUpdatedV5: true,
      onlineSerialMigrated601: true,
      helplineSwitchedV1: true
    });
    await setDoc(doc(db, 'settings', 'contest_settings'), seededSettings);
    setCachedItem(LS_KEYS.SETTINGS, seededSettings);

    await setDoc(doc(db, 'settings', 'dataset_meta'), {
      seededOnce: true,
      kamalganjSchoolsV1: true,
      kamalganjSchoolsV2: true,
      venuesV2V3Added: true,
      schoolsVenueV02Migrated: true,
      schoolsWiped: false,
      venuesWiped: false,
      blocksWiped: false
    }, { merge: true });

    const publicSettings = {
      contestNameBn: DEFAULT_SETTINGS.contestNameBn,
      contestNameEn: DEFAULT_SETTINGS.contestNameEn,
      organiserBn: DEFAULT_SETTINGS.organiserBn,
      yearCode: DEFAULT_SETTINGS.yearCode,
      registrationOpens: DEFAULT_SETTINGS.registrationOpens,
      registrationCloses: DEFAULT_SETTINGS.registrationCloses,
      quizDateTime: DEFAULT_SETTINGS.quizDateTime,
      quizDateTextBn: DEFAULT_SETTINGS.quizDateTextBn,
      quizTimeTextBn: DEFAULT_SETTINGS.quizTimeTextBn,
      registrationFee: DEFAULT_SETTINGS.registrationFee,
      bkashNumber: DEFAULT_SETTINGS.bkashNumber,
      bkashAccountName: DEFAULT_SETTINGS.bkashAccountName,
      helplineNumbers: DEFAULT_SETTINGS.helplineNumbers,
      facebookPage: DEFAULT_SETTINGS.facebookPage,
      resultsPublished: DEFAULT_SETTINGS.resultsPublished,
      seatPlanPublished: DEFAULT_SETTINGS.seatPlanPublished,
      showWinnersList: DEFAULT_SETTINGS.showWinnersList,
      certDownloadEnabled: DEFAULT_SETTINGS.certDownloadEnabled
    };
    await setDoc(doc(db, 'publicSettings', 'contest'), publicSettings);

    // 2. Venues
    for (const v of INITIAL_VENUES) {
      await setDoc(doc(db, 'venues', v.id), v);
    }

    // 3. Schools with hashed PINs
    const preparedSchools: School[] = [];
    for (const s of INITIAL_SCHOOLS) {
      const pin = s.plainPin || '2601';
      const pinHash = await hashPin(pin);
      const schoolObj: School = {
        ...s,
        pinHash,
        plainPin: pin
      };
      preparedSchools.push(schoolObj);
      await setDoc(doc(db, 'schools', schoolObj.id), schoolObj);
    }

    // 4. Generate & Save initial blocks
    const allocation = allocateSchoolBlocks({
      schools: preparedSchools,
      venues: INITIAL_VENUES,
      contestYear: DEFAULT_SETTINGS.yearCode,
      onlineSerialStart: DEFAULT_SETTINGS.onlineSerialStart,
      serialDigits: DEFAULT_SETTINGS.serialDigits
    });

    if (allocation.success) {
      for (const block of allocation.blocks) {
        await setDoc(doc(db, 'blocks', block.id), block);
      }
    }

    // 5. Initial stats
    await setDoc(doc(db, 'stats', 'live'), {
      totalRegistered: 0,
      fromSchools: 0,
      onlineVerified: 0,
      onlinePending: 0,
      formsTypedIn: 0,
      attendanceTotal: 0,
      byCategory: { '01': 0, '02': 0, '03': 0 }
    });

    console.log('Seeding completed successfully!');
    return { success: true, message: 'ডাটাবেজে প্রাথমিক ভেন্যু, বিদ্যালয় ও ব্লক সফলভাবে সিড করা হয়েছে।' };
  } catch (error) {
    console.error('Seed script error:', error);
    return { success: false, message: `সিড করতে সমস্যা হয়েছে: ${error instanceof Error ? error.message : String(error)}` };
  }
}
