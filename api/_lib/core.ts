import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_ADMIN_EMAILS = [
  'swarupks.eee@gmail.com',
  'sinha.brojen3@gmail.com',
  'kiransingha134@gmail.com',
  'sayaksinha997@gmail.com',
  'adityasingha659@gmail.com',
  'itsmechemicalarko@gmail.com',
  'bipulsinha1994cu@gmail.com',
  'soumit.srt88@gmail.com',
  'mbprojonmo@gmail.com'
];

export type SmsProvider = 'bulksmsbd' | 'greenweb' | 'twilio' | 'webhook';

export interface NormalizedPhone {
  valid: boolean;
  local: string;
  bd88: string;
  e164: string;
}

export interface ApiHandlerResponse {
  status: number;
  body: Record<string, unknown>;
}

const MAX_JSON_BODY_BYTES = 1024 * 1024; // 1 MB

function getAllowedAdminEmails(): Set<string> {
  const envList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(envList.length > 0 ? envList : DEFAULT_ADMIN_EMAILS);
}

function getFirebaseProjectId(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../firebase-applet-config.json')
  ];

  for (const cfgPath of candidatePaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const parsed = JSON.parse(raw) as { projectId?: string };
        if (parsed.projectId && parsed.projectId.trim()) {
          return parsed.projectId.trim();
        }
      }
    } catch {
      // Try next candidate or environment variable
    }
  }

  return (process.env.FIREBASE_PROJECT_ID || '').trim();
}

let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }

  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error(`Failed to fetch Google public certificates (${resp.status})`);
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  cachedCerts = certs;
  certsExpiresAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as T;
}

export async function verifyFirebaseAdminToken(idToken: string): Promise<{
  authorized: boolean;
  email?: string;
  role?: 'superadmin' | 'admin';
  error?: string;
}> {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) {
    return { authorized: false, error: 'Invalid authentication token format.' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };
  try {
    header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    return { authorized: false, error: 'Invalid authentication token format.' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { authorized: false, error: 'Unsupported token signing algorithm.' };
  }

  const projectId = getFirebaseProjectId();
  if (!projectId) {
    return { authorized: false, error: 'Firebase project ID is not configured on the server.' };
  }

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    return { authorized: false, error: 'Token signing key not found.' };
  }

  const sigNorm = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  const sigBuf = Buffer.from(
    sigNorm.padEnd(sigNorm.length + ((4 - (sigNorm.length % 4)) % 4), '='),
    'base64'
  );
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const signatureValid = verifier.verify(certPem, sigBuf);
  if (!signatureValid) {
    return { authorized: false, error: 'Invalid token signature.' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    return { authorized: false, error: 'Token audience or issuer mismatch.' };
  }
  if (!payload.sub || typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    return { authorized: false, error: 'Authentication session expired.' };
  }
  if (typeof payload.iat === 'number' && payload.iat > nowSec + 300) {
    return { authorized: false, error: 'Token issued-at timestamp is invalid.' };
  }
  if (!payload.email || payload.email_verified !== true) {
    return { authorized: false, error: 'Verified Google email address is required.' };
  }

  const normalizedEmail = payload.email.trim().toLowerCase();
  const allowed = getAllowedAdminEmails();
  if (!allowed.has(normalizedEmail)) {
    return {
      authorized: false,
      email: payload.email,
      error: 'এই Google ইমেইলটি অ্যাডমিন প্যানেলের জন্য অনুমোদিত নয়।'
    };
  }

  return {
    authorized: true,
    email: payload.email,
    role: normalizedEmail === 'mbprojonmo@gmail.com' ? 'superadmin' : 'admin'
  };
}

const BENGALI_TO_ENGLISH_DIGITS: Record<string, string> = {
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

function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, d => BENGALI_TO_ENGLISH_DIGITS[d] || d);
}

export function normalizePhone(rawPhone: string): NormalizedPhone {
  const cleaned = toAsciiDigits(String(rawPhone || ''))
    .trim()
    .replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+8801') && cleaned.length === 14) {
    const local = '0' + cleaned.slice(4);
    return { valid: /^01[3-9]\d{8}$/.test(local), local, bd88: '88' + local, e164: '+88' + local };
  }
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    const local = '0' + cleaned.slice(3);
    return { valid: /^01[3-9]\d{8}$/.test(local), local, bd88: '88' + local, e164: '+88' + local };
  }
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return {
      valid: /^01[3-9]\d{8}$/.test(cleaned),
      local: cleaned,
      bd88: '88' + cleaned,
      e164: '+88' + cleaned
    };
  }
  if (cleaned.startsWith('1') && cleaned.length === 10) {
    const local = '0' + cleaned;
    return { valid: /^01[3-9]\d{8}$/.test(local), local, bd88: '88' + local, e164: '+88' + local };
  }

  const e164Fallback = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  const isGeneralValid = /^\+[1-9]\d{9,14}$/.test(e164Fallback);
  return {
    valid: isGeneralValid,
    local: cleaned,
    bd88: cleaned.replace(/^\+/, ''),
    e164: e164Fallback
  };
}

export function detectSmsProvider(): SmsProvider | null {
  const explicit = (process.env.SMS_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'bulksmsbd' || explicit === 'greenweb' || explicit === 'twilio' || explicit === 'webhook') {
    return explicit;
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
    return 'twilio';
  }
  if (process.env.SMS_WEBHOOK_URL) {
    return 'webhook';
  }
  if (process.env.SMS_API_KEY) {
    return process.env.SMS_SENDER_ID ? 'bulksmsbd' : 'greenweb';
  }
  return null;
}

async function sendViaBulkSmsBd(phone: NormalizedPhone, message: string) {
  const apiKey = process.env.SMS_API_KEY?.trim();
  const senderId = process.env.SMS_SENDER_ID?.trim();
  if (!apiKey || !senderId) {
    return {
      sent: false,
      configured: false,
      provider: 'bulksmsbd' as const,
      error: 'SMS_API_KEY and SMS_SENDER_ID must be set for BulkSMSBD.'
    };
  }

  const url = new URL('https://bulksmsbd.net/api/smsapi');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('type', 'text');
  url.searchParams.set('number', phone.bd88);
  url.searchParams.set('senderid', senderId);
  url.searchParams.set('message', message);

  const resp = await fetch(url.toString(), { method: 'POST' });
  const text = await resp.text();
  let parsed: { response_code?: number; error_message?: string; success_message?: string } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (resp.ok && parsed && parsed.response_code === 202) {
    return {
      sent: true,
      configured: true,
      provider: 'bulksmsbd' as const,
      gatewayResponse: parsed.success_message || 'Submitted'
    };
  }

  return {
    sent: false,
    configured: true,
    provider: 'bulksmsbd' as const,
    error: parsed?.error_message || `BulkSMSBD HTTP ${resp.status}: ${text.slice(0, 160)}`
  };
}

async function sendViaGreenWeb(phone: NormalizedPhone, message: string) {
  const token = process.env.SMS_API_KEY?.trim();
  if (!token) {
    return {
      sent: false,
      configured: false,
      provider: 'greenweb' as const,
      error: 'SMS_API_KEY (GreenWeb token) must be set.'
    };
  }

  const body = new URLSearchParams({
    token,
    to: phone.local,
    message,
    json: '1'
  });

  const resp = await fetch('https://api.greenweb.com.bd/api.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const text = await resp.text();
  let parsed: Array<{ status?: string; statusmsg?: string }> | { status?: string; statusmsg?: string } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (resp.ok && entry && String(entry.status || '').toUpperCase() === 'SENT') {
    return {
      sent: true,
      configured: true,
      provider: 'greenweb' as const,
      gatewayResponse: entry.statusmsg || 'SENT'
    };
  }

  return {
    sent: false,
    configured: true,
    provider: 'greenweb' as const,
    error: entry?.statusmsg || `GreenWeb HTTP ${resp.status}: ${text.slice(0, 160)}`
  };
}

async function sendViaTwilio(phone: NormalizedPhone, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !authToken || !from) {
    return {
      sent: false,
      configured: false,
      provider: 'twilio' as const,
      error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set.'
    };
  }

  const body = new URLSearchParams({
    To: phone.e164,
    From: from,
    Body: message
  });

  const auth = Buffer.from(`${sid}:${authToken}`).toString('base64');
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const data = (await resp.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (resp.ok && data?.sid) {
    return {
      sent: true,
      configured: true,
      provider: 'twilio' as const,
      messageId: data.sid
    };
  }

  return {
    sent: false,
    configured: true,
    provider: 'twilio' as const,
    error: data?.message || `Twilio HTTP ${resp.status}`
  };
}

async function sendViaWebhook(
  phone: NormalizedPhone,
  message: string,
  meta: { applicationId?: string; registrationId?: string }
) {
  const webhookUrl = process.env.SMS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      sent: false,
      configured: false,
      provider: 'webhook' as const,
      error: 'SMS_WEBHOOK_URL must be set.'
    };
  }

  let parsedWebhook: URL;
  try {
    parsedWebhook = new URL(webhookUrl);
  } catch {
    return {
      sent: false,
      configured: false,
      provider: 'webhook' as const,
      error: 'SMS_WEBHOOK_URL is not a valid URL.'
    };
  }

  if (parsedWebhook.protocol !== 'https:' && parsedWebhook.protocol !== 'http:') {
    return {
      sent: false,
      configured: false,
      provider: 'webhook' as const,
      error: 'SMS_WEBHOOK_URL must use http or https.'
    };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.SMS_API_KEY?.trim()) {
    headers.Authorization = `Bearer ${process.env.SMS_API_KEY.trim()}`;
  }

  const resp = await fetch(parsedWebhook.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: phone.e164,
      localTo: phone.local,
      message,
      applicationId: meta.applicationId,
      registrationId: meta.registrationId
    })
  });

  const text = await resp.text();
  if (resp.ok) {
    return {
      sent: true,
      configured: true,
      provider: 'webhook' as const,
      gatewayResponse: text.slice(0, 120) || 'OK'
    };
  }

  return {
    sent: false,
    configured: true,
    provider: 'webhook' as const,
    error: `Webhook HTTP ${resp.status}: ${text.slice(0, 160)}`
  };
}

export function extractBearerToken(authorizationHeader: string | null | undefined, body: unknown): string {
  if (typeof authorizationHeader === 'string' && authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return authorizationHeader.slice(7).trim();
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const bodyToken = (body as { idToken?: unknown }).idToken;
    if (typeof bodyToken === 'string') {
      return bodyToken.trim();
    }
  }
  return '';
}

export async function readJsonBody(
  request: Request
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const declaredLength = Number(contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
      return { ok: false, status: 413, error: 'Request payload exceeds 1 MB limit.' };
    }
  }

  let text = '';
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Unable to read request body.' };
  }

  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Request payload exceeds 1 MB limit.' };
  }

  if (!text.trim()) {
    return { ok: true, body: {} };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: 'JSON request body must be an object.' };
    }
    return { ok: true, body: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON request body.' };
  }
}

export function getHealthPayload() {
  const provider = detectSmsProvider();
  return { ok: true, smsConfigured: Boolean(provider), provider };
}

export async function handleVerifyAdminRequest(params: {
  authorizationHeader?: string | null;
  body: unknown;
}): Promise<ApiHandlerResponse> {
  const idToken = extractBearerToken(params.authorizationHeader, params.body);
  if (!idToken) {
    return {
      status: 401,
      body: {
        authorized: false,
        error: 'অ্যাডমিন যাচাইকরণের জন্য Google সেশন টোকেন পাওয়া যায়নি।'
      }
    };
  }

  try {
    const verification = await verifyFirebaseAdminToken(idToken);
    if (!verification.authorized) {
      return { status: 403, body: verification };
    }
    return { status: 200, body: verification };
  } catch (err) {
    return {
      status: 403,
      body: {
        authorized: false,
        error: err instanceof Error ? err.message : 'অ্যাডমিন টোকেন যাচাই করা যায়নি।'
      }
    };
  }
}

export async function handleSendSmsRequest(params: {
  authorizationHeader?: string | null;
  body: unknown;
}): Promise<ApiHandlerResponse> {
  const idToken = extractBearerToken(params.authorizationHeader, params.body);
  if (!idToken) {
    return {
      status: 401,
      body: {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        error: 'Unauthorized: Admin authentication required to dispatch SMS.'
      }
    };
  }

  const verification = await verifyFirebaseAdminToken(idToken).catch(() => ({
    authorized: false,
    error: 'Authentication token verification failed.'
  }));

  if (!verification.authorized) {
    return {
      status: 403,
      body: {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        error: verification.error || 'Forbidden: Admin access required.'
      }
    };
  }

  const rawBody = params.body && typeof params.body === 'object' && !Array.isArray(params.body) ? params.body : {};
  const { to, message, applicationId, registrationId } = rawBody as {
    to?: unknown;
    message?: unknown;
    applicationId?: unknown;
    registrationId?: unknown;
  };

  if (typeof to !== 'string' || typeof message !== 'string' || !to.trim() || !message.trim()) {
    return {
      status: 400,
      body: {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        error: 'Recipient phone number and message are required.'
      }
    };
  }

  const cleanMessage = message.trim();
  if (cleanMessage.length > 1000) {
    return {
      status: 400,
      body: {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        error: 'Message exceeds maximum length of 1000 characters.'
      }
    };
  }

  const normalized = normalizePhone(to);
  if (!normalized.valid) {
    return {
      status: 400,
      body: {
        sent: false,
        configured: Boolean(detectSmsProvider()),
        to: normalized.local,
        error: 'Invalid recipient phone number.'
      }
    };
  }

  const provider = detectSmsProvider();
  if (!provider) {
    return {
      status: 200,
      body: {
        sent: false,
        configured: false,
        to: normalized.local,
        error: 'SMS gateway environment variables are not configured on the server.'
      }
    };
  }

  try {
    let result;
    const cleanApplicationId = typeof applicationId === 'string' ? applicationId.trim() : undefined;
    const cleanRegistrationId = typeof registrationId === 'string' ? registrationId.trim() : undefined;

    if (provider === 'bulksmsbd') {
      result = await sendViaBulkSmsBd(normalized, cleanMessage);
    } else if (provider === 'greenweb') {
      result = await sendViaGreenWeb(normalized, cleanMessage);
    } else if (provider === 'twilio') {
      result = await sendViaTwilio(normalized, cleanMessage);
    } else {
      result = await sendViaWebhook(normalized, cleanMessage, {
        applicationId: cleanApplicationId,
        registrationId: cleanRegistrationId
      });
    }

    const statusCode = !result.configured ? 200 : result.sent ? 200 : 502;
    return {
      status: statusCode,
      body: { ...result, to: normalized.local }
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unexpected SMS gateway error';
    return {
      status: 502,
      body: {
        sent: false,
        configured: true,
        provider,
        to: normalized.local,
        error: errorMsg
      }
    };
  }
}
