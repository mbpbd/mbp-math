export interface SmsDispatchResult {
  sent: boolean;
  configured: boolean;
  provider?: string;
  to?: string;
  messageId?: string;
  error?: string;
}

const BENGALI_TO_ASCII_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

export function normalizeBdMobile(rawPhone: string): string {
  const cleaned = String(rawPhone || '')
    .replace(/[০-৯]/g, d => BENGALI_TO_ASCII_DIGITS[d] || d)
    .trim()
    .replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+8801') && cleaned.length === 14) {
    return '0' + cleaned.slice(4);
  }
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    return '0' + cleaned;
  }
  return cleaned;
}

export const DEFAULT_PUBLIC_PORTAL_URL = 'https://mbp-math.ai.studio/#public';

export function getPortalUrl(explicitUrl?: string): string {
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_PUBLIC_PORTAL_URL;
}

function toGsmAscii(input: string | undefined, fallback: string): string {
  const cleaned = String(input || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function buildApprovalSmsMessage(params: {
  applicantName: string;
  registrationId: string;
  contestNameEn?: string;
  contestNameBn?: string;
  organiserEn?: string;
  organiserBn?: string;
  portalUrl?: string;
}): string {
  let name = toGsmAscii(params.applicantName, 'Participant');
  const cleanRegId = toGsmAscii(params.registrationId, '');
  const portal = toGsmAscii(getPortalUrl(params.portalUrl), DEFAULT_PUBLIC_PORTAL_URL);

  const rawContest = toGsmAscii(params.contestNameEn, 'Math Quiz Contest 2026');
  let contest = rawContest.length <= 24 ? rawContest : 'Math Quiz 2026';

  const rawOrg = toGsmAscii(params.organiserEn, 'MBP');
  const signOff = rawOrg.length <= 8 ? ` - ${rawOrg}` : ' - MBP';

  const formatMsg = (n: string, c: string) =>
    `Congrats ${n}! ${c} payment accepted. Reg ID: ${cleanRegId}. Admit Card: ${portal}${signOff}`;

  let msg = formatMsg(name, contest);
  if (msg.length > 160 && contest !== 'Math Quiz 2026') {
    contest = 'Math Quiz 2026';
    msg = formatMsg(name, contest);
  }
  if (msg.length > 160) {
    const excess = msg.length - 160;
    const maxNameLen = Math.max(4, name.length - excess - 3);
    name = `${name.slice(0, maxNameLen).trimEnd()}...`;
    msg = formatMsg(name, contest);
  }
  return msg.slice(0, 160);
}

export function buildRejectionSmsMessage(params: {
  applicantName: string;
  registrationId?: string;
  txnId?: string;
  reason: string;
  contestNameBn: string;
  organiserBn?: string;
  portalUrl?: string;
}): string {
  const cleanName = (params.applicantName || '').trim() || 'শিক্ষার্থী';
  const cleanReason = (params.reason || '').trim() || 'TrxID মেলেনি বা পাওয়া যায়নি';
  const portal = getPortalUrl(params.portalUrl);
  const signOff = params.organiserBn ? ` - ${params.organiserBn}` : '';
  const refParts: string[] = [];
  if (params.txnId?.trim()) refParts.push(`TrxID: ${params.txnId.trim()}`);
  if (params.registrationId?.trim()) refParts.push(`পূর্বের নম্বর: ${params.registrationId.trim()} (বাতিল/মুক্ত)`);
  const refText = refParts.length > 0 ? ` (${refParts.join(', ')})` : '';

  return `প্রিয় ${cleanName}, ${params.contestNameBn}-এ আপনার আবেদনটি বাতিল করা হয়েছে${refText}। কারণ: ${cleanReason}। সঠিক তথ্যসহ পোর্টালে (${portal}) পুনরায় আবেদন করুন অথবা হেল্পলাইনে যোগাযোগ করুন।${signOff}`;
}

export function buildSmsAnchorHref(phone: string, message: string): string {
  const normalized = normalizeBdMobile(phone);
  return `sms:${normalized}?body=${encodeURIComponent(message)}`;
}

export function buildBatchSmsAnchorHref(
  phones: string[],
  message: string,
  separator: ',' | ';' = ','
): string {
  const normalized = Array.from(
    new Set(
      phones
        .map(p => normalizeBdMobile(p))
        .filter(p => /^01[3-9]\d{8}$/.test(p))
    )
  );
  if (normalized.length === 0) return '';
  return `sms:${normalized.join(separator)}?body=${encodeURIComponent(message)}`;
}

export function estimateSmsParts(message: string): {
  chars: number;
  isUnicode: boolean;
  parts: number;
} {
  const text = message || '';
  const chars = text.length;
  if (chars === 0) {
    return { chars: 0, isUnicode: false, parts: 0 };
  }
  const isUnicode = /[^\x00-\x7F]/.test(text);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;
  const parts = chars <= singleLimit ? 1 : Math.ceil(chars / multiLimit);
  return { chars, isUnicode, parts };
}

export function applySmsTemplatePlaceholders(
  template: string,
  params: {
    name?: string;
    regId?: string;
    contestNameBn?: string;
    contestNameEn?: string;
    organiserBn?: string;
    organiserEn?: string;
  }
): string {
  return (template || '')
    .replace(/\{name\}|\[নাম\]/gi, (params.name || '').trim() || 'Participant')
    .replace(/\{id\}|\[আইডি\]/gi, (params.regId || '').trim() || '')
    .replace(
      /\{contest\}|\[প্রতিযোগিতা\]/gi,
      (params.contestNameEn || params.contestNameBn || '').trim()
    )
    .replace(
      /\{organiser\}|\[আয়োজক\]/gi,
      (params.organiserEn || params.organiserBn || '').trim()
    );
}

export function openSmsApp(smsHref: string): void {
  if (typeof document === 'undefined' || !smsHref) return;
  const link = document.createElement('a');
  link.href = smsHref;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function checkServerSmsConfigured(): Promise<boolean> {
  try {
    const resp = await fetch('/api/health');
    if (!resp.ok) return false;
    const data = (await resp.json().catch(() => null)) as { smsConfigured?: boolean } | null;
    return Boolean(data?.smsConfigured);
  } catch {
    return false;
  }
}

export async function sendApprovalSms(params: {
  to: string;
  message: string;
  applicationId?: string;
  registrationId?: string;
  idToken?: string;
}): Promise<SmsDispatchResult> {
  const to = normalizeBdMobile(params.to);
  if (!to) {
    return {
      sent: false,
      configured: false,
      error: 'আবেদনকারীর মোবাইল নম্বর পাওয়া যায়নি।'
    };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (params.idToken) {
      headers.Authorization = `Bearer ${params.idToken}`;
    }

    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to,
        message: params.message,
        applicationId: params.applicationId,
        registrationId: params.registrationId
      })
    });

    const data = (await response.json().catch(() => null)) as SmsDispatchResult | null;
    if (!data) {
      return {
        sent: false,
        configured: false,
        to,
        error: `SMS সার্ভার থেকে অপ্রত্যাশিত উত্তর পাওয়া গেছে (HTTP ${response.status})।`
      };
    }
    return data;
  } catch (err) {
    return {
      sent: false,
      configured: false,
      to,
      error: err instanceof Error ? err.message : 'SMS সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।'
    };
  }
}
