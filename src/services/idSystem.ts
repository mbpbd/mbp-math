import bcrypt from 'bcryptjs';
import { CategoryCode, CATEGORIES } from '../types';

/**
 * Converts English digits (0-9) to Bengali digits (০-৯)
 */
export function toBengaliDigits(input: number | string): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).replace(/[0-9]/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

/**
 * Converts Bengali digits (০-৯) to English digits (0-9)
 */
export function toEnglishDigits(input: string): string {
  const bengaliDigits = '০১২৩৪৫৬৭৮৯';
  return input.replace(/[০-৯]/g, (char) => String(bengaliDigits.indexOf(char)));
}

/**
 * Validates and parses a 7-digit (or 8-digit) registration ID
 * Format: YY CC SSS (e.g. 2601001)
 */
export interface ParsedId {
  valid: boolean;
  rawId: string;
  year?: string;
  category?: CategoryCode;
  serial?: number;
  error?: string;
}

export function parseRegistrationId(raw: string, expectedYear = '26', serialDigits = 3): ParsedId {
  const cleaned = toEnglishDigits(raw.trim());
  const expectedLen = 2 + 2 + serialDigits;

  if (cleaned.length !== expectedLen) {
    return {
      valid: false,
      rawId: raw,
      error: `রেজিস্ট্রেশন নম্বরটি অবশ্যই ${expectedLen} অঙ্কের হতে হবে (যেমন: ${expectedYear}01001)`
    };
  }

  const year = cleaned.slice(0, 2);
  const category = cleaned.slice(2, 4) as CategoryCode;
  const serialPart = cleaned.slice(4);
  const serial = parseInt(serialPart, 10);

  if (expectedYear && year !== expectedYear) {
    return {
      valid: false,
      rawId: raw,
      error: `ভুল বছর কোড: '${year}' (প্রত্যাশিত '${expectedYear}')`
    };
  }

  if (!['01', '02', '03'].includes(category)) {
    return {
      valid: false,
      rawId: raw,
      error: `অজানা ক্যাটাগরি কোড '${category}'। বৈধ ক্যাটাগরি: 01 (প্রাথমিক), 02 (নিম্ন মাধ্যমিক), 03 (মাধ্যমিক)`
    };
  }

  if (isNaN(serial) || serial <= 0) {
    return {
      valid: false,
      rawId: raw,
      error: `অকার্যকর ক্রমিক নম্বর: '${serialPart}'`
    };
  }

  return {
    valid: true,
    rawId: cleaned,
    year,
    category,
    serial
  };
}

/**
 * Formats a registration ID from its components
 */
export function formatRegistrationId(
  year: string,
  category: CategoryCode,
  serial: number,
  serialDigits = 3
): string {
  const paddedSerial = String(serial).padStart(serialDigits, '0');
  return `${year}${category}${paddedSerial}`;
}

export interface CategorySerialRange {
  start: number;
  end: number;
}

export interface GeneratedCategoryForm {
  id: string;
  category: CategoryCode;
  serial: number;
}

/**
 * Generates sequential category-wise registration IDs up to admin-defined last serial numbers.
 * Example: yearCode='26', category='01', start=1, end=500 => 2601001 .. 2601500
 */
export function buildCategorywiseForms(params: {
  yearCode: string;
  selectedCategory: 'all' | CategoryCode;
  ranges: Record<CategoryCode, CategorySerialRange>;
  serialDigits?: number;
}): GeneratedCategoryForm[] {
  const yearPrefix = (params.yearCode || '26').slice(0, 2);
  const digits = params.serialDigits || 3;
  const targetCategories: CategoryCode[] =
    params.selectedCategory === 'all' ? ['01', '02', '03'] : [params.selectedCategory];

  const result: GeneratedCategoryForm[] = [];
  for (const cat of targetCategories) {
    const range = params.ranges[cat];
    const start = Math.max(1, Math.floor(Number(range?.start) || 1));
    const end = Math.floor(Number(range?.end) || 0);
    if (end < start) continue;

    for (let serial = start; serial <= end; serial++) {
      result.push({
        id: formatRegistrationId(yearPrefix, cat, serial, digits),
        category: cat,
        serial
      });
    }
  }
  return result;
}

/**
 * Maps student class (3 to 10) to the corresponding category
 */
export function getCategoryForClass(studentClass: number): CategoryCode | null {
  if (studentClass >= 3 && studentClass <= 5) return '01';
  if (studentClass >= 6 && studentClass <= 8) return '02';
  if (studentClass >= 9 && studentClass <= 10) return '03';
  return null;
}

/**
 * Validates if the student's class matches the category
 */
export function isClassMatchingCategory(studentClass: number, category: CategoryCode): boolean {
  const info = CATEGORIES[category];
  return info ? info.classes.includes(studentClass) : false;
}

/**
 * Creates QR payload: encodes the registration number directly so scanning
 * with any standard smartphone camera immediately shows the registration number.
 */
export function makeQrPayload(id: string): string {
  return toEnglishDigits(id.trim());
}

/**
 * Parses scanned QR code content
 */
export function parseQrPayload(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith('MBPQ26:')) {
    return trimmed.substring('MBPQ26:'.length).trim();
  }
  if (/^\d{7,8}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/\b\d{7,8}\b/);
  if (match) return match[0];
  return trimmed;
}

/**
 * Generates a random 4-digit numeric school PIN
 */
export function generate4DigitPin(): string {
  const pin = Math.floor(1000 + Math.random() * 9000);
  return String(pin);
}

/**
 * Hashes a 4-digit PIN for secure storage
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(pin.trim(), salt);
}

/**
 * Verifies a teacher PIN against a stored bcrypt hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return bcrypt.compareSync(pin.trim(), hash);
  } catch {
    return false;
  }
}
