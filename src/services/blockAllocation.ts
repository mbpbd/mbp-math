import { CategoryCode, NumberBlock, School, Venue } from '../types';
import { formatRegistrationId, parseRegistrationId } from './idSystem';

export interface AllocationInput {
  schools: School[];
  venues: Venue[];
  contestYear?: string;
  onlineSerialStart?: number;
  serialDigits?: number;
  existingBlocks?: NumberBlock[];
}

export interface AllocationResult {
  success: boolean;
  blocks: NumberBlock[];
  previewRows: Array<{
    schoolId: string;
    schoolName: string;
    schoolNameEn?: string;
    category: CategoryCode;
    count: number;
    firstSerial: number;
    lastSerial: number;
    firstId: string;
    lastId: string;
    venueId: string;
    venueName: string;
  }>;
  summaryByCategory: Record<CategoryCode, { totalSchoolForms: number; lastSchoolSerial: number; capacityLeft: number }>;
  errors: string[];
}

/**
 * Checks if two blocks in the same category overlap
 */
export function doBlocksOverlap(
  blockA: { category: string; firstSerial: number; lastSerial: number },
  blockB: { category: string; firstSerial: number; lastSerial: number }
): boolean {
  if (blockA.category !== blockB.category) return false;
  return Math.max(blockA.firstSerial, blockB.firstSerial) <= Math.min(blockA.lastSerial, blockB.lastSerial);
}

/**
 * Verifies that a list of blocks has no overlapping ranges in any category
 */
export function validateNoOverlaps(blocks: Array<{ category: string; firstSerial: number; lastSerial: number; id?: string }>): { valid: boolean; conflict?: string } {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (doBlocksOverlap(blocks[i], blocks[j])) {
        return {
          valid: false,
          conflict: `ক্যাটাগরি ${blocks[i].category}-এ ব্লক সংঘর্ষ: (${blocks[i].firstSerial}-${blocks[i].lastSerial}) বনাম (${blocks[j].firstSerial}-${blocks[j].lastSerial})`
        };
      }
    }
  }
  return { valid: true };
}

/**
 * Allocates continuous sequential blocks per category for all schools
 */
export function allocateSchoolBlocks(input: AllocationInput): AllocationResult {
  const contestYear = input.contestYear || '26';
  const onlineSerialStart = input.onlineSerialStart || 601;
  const serialDigits = input.serialDigits || 3;
  const existingBlocks = input.existingBlocks || [];
  const errors: string[] = [];

  const venueMap = new Map<string, Venue>();
  for (const v of input.venues) {
    venueMap.set(v.id, v);
  }

  const categories: CategoryCode[] = ['01', '02', '03'];
  const generatedBlocks: NumberBlock[] = [];
  const previewRows: AllocationResult['previewRows'] = [];

  const summaryByCategory: AllocationResult['summaryByCategory'] = {
    '01': { totalSchoolForms: 0, lastSchoolSerial: 0, capacityLeft: onlineSerialStart - 1 },
    '02': { totalSchoolForms: 0, lastSchoolSerial: 0, capacityLeft: onlineSerialStart - 1 },
    '03': { totalSchoolForms: 0, lastSchoolSerial: 0, capacityLeft: onlineSerialStart - 1 },
  };

  for (const cat of categories) {
    // Find highest used serial from existing blocks in this category that are not online/spare
    let currentSerial = 1;

    const existingInCat = existingBlocks.filter(b => b.category === cat && b.type === 'school');
    for (const b of existingInCat) {
      if (b.lastSerial >= currentSerial) {
        currentSerial = b.lastSerial + 1;
      }
    }

    let totalCatForms = 0;

    for (const school of input.schools) {
      const count = school.formsNeeded?.[cat] || 0;
      if (count <= 0) continue;

      const firstSerial = currentSerial;
      const lastSerial = currentSerial + count - 1;

      // Check capacity boundary against reserved online block
      if (lastSerial >= onlineSerialStart) {
        errors.push(
          `ক্যাটাগরি ${cat} এর ফরম সংখ্যা সীমা অতিক্রম করেছে! শেষ ক্রমিক ${lastSerial} অনলাইন সংরক্ষিত ক্রমিক ${onlineSerialStart} স্পর্শ করেছে। অনুগ্রহ করে ৪-অঙ্কের ক্রমিক মোড চালু করুন বা ফরম সংখ্যা কমান।`
        );
      }

      const firstId = formatRegistrationId(contestYear, cat, firstSerial, serialDigits);
      const lastId = formatRegistrationId(contestYear, cat, lastSerial, serialDigits);

      const venue = venueMap.get(school.venueId);
      const venueName = venue?.name || 'অজানা ভেন্যু';

      const block: NumberBlock = {
        id: `blk-${school.id}-${cat}-${firstSerial}`,
        schoolId: school.id,
        schoolName: school.name,
        schoolNameEn: school.nameEn,
        type: 'school',
        category: cat,
        firstSerial,
        lastSerial,
        firstId,
        lastId,
        count,
        venueId: school.venueId,
        venueName,
        createdAt: new Date().toISOString()
      };

      generatedBlocks.push(block);
      previewRows.push({
        schoolId: school.id,
        schoolName: school.name,
        schoolNameEn: school.nameEn,
        category: cat,
        count,
        firstSerial,
        lastSerial,
        firstId,
        lastId,
        venueId: school.venueId,
        venueName
      });

      totalCatForms += count;
      currentSerial = lastSerial + 1;
    }

    const lastSchoolSerial = currentSerial > 1 ? currentSerial - 1 : 0;
    summaryByCategory[cat] = {
      totalSchoolForms: totalCatForms,
      lastSchoolSerial,
      capacityLeft: Math.max(0, (onlineSerialStart - 1) - lastSchoolSerial)
    };
  }

  // Combined overlap check across all generated blocks and existing blocks
  const allBlocksToCheck = [...existingBlocks, ...generatedBlocks];
  const overlapCheck = validateNoOverlaps(allBlocksToCheck);
  if (!overlapCheck.valid) {
    errors.push(overlapCheck.conflict || 'ব্লক ওভারল্যাপ সনাক্ত করা হয়েছে!');
  }

  return {
    success: errors.length === 0,
    blocks: generatedBlocks,
    previewRows,
    summaryByCategory,
    errors
  };
}

/**
 * Finds which school, category, and venue an ID belongs to from the blocks table alone
 */
export function findBlockForId(
  rawId: string,
  blocks: NumberBlock[],
  contestYear = '26',
  serialDigits = 3
): NumberBlock | null {
  const parsed = parseRegistrationId(rawId, contestYear, serialDigits);
  if (!parsed.valid || !parsed.category || !parsed.serial) return null;

  for (const block of blocks) {
    if (block.category === parsed.category) {
      if (parsed.serial >= block.firstSerial && parsed.serial <= block.lastSerial) {
        return block;
      }
    }
  }

  return null;
}
