import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

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

function getAllowedAdminEmails(): Set<string> {
  const envList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set(envList.length > 0 ? envList : DEFAULT_ADMIN_EMAILS);
}

function getFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    return parsed.projectId || '';
  } catch {
    return process.env.FIREBASE_PROJECT_ID || '';
  }
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

interface NormalizedPhone {
  valid: boolean;
  local: string;
  bd88: string;
  e164: string;
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

type SmsProvider = 'bulksmsbd' | 'greenweb' | 'twilio' | 'webhook';

function detectProvider(): SmsProvider | null {
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

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.SMS_API_KEY?.trim()) {
    headers.Authorization = `Bearer ${process.env.SMS_API_KEY.trim()}`;
  }

  const resp = await fetch(webhookUrl, {
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

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const bodyToken = (req.body as { idToken?: string } | undefined)?.idToken;
  return typeof bodyToken === 'string' ? bodyToken.trim() : '';
}

app.get('/api/health', (_req: Request, res: Response) => {
  const provider = detectProvider();
  res.json({ ok: true, smsConfigured: Boolean(provider), provider });
});

app.post('/api/auth/verify-admin', async (req: Request, res: Response) => {
  const idToken = extractBearerToken(req);
  if (!idToken) {
    res.status(401).json({
      authorized: false,
      error: 'অ্যাডমিন যাচাইকরণের জন্য Google সেশন টোকেন পাওয়া যায়নি।'
    });
    return;
  }

  try {
    const verification = await verifyFirebaseAdminToken(idToken);
    if (!verification.authorized) {
      res.status(403).json(verification);
      return;
    }
    res.status(200).json(verification);
  } catch (err) {
    res.status(403).json({
      authorized: false,
      error: err instanceof Error ? err.message : 'অ্যাডমিন টোকেন যাচাই করা যায়নি।'
    });
  }
});

app.post('/api/send-sms', async (req: Request, res: Response) => {
  const idToken = extractBearerToken(req);
  if (!idToken) {
    res.status(401).json({
      sent: false,
      configured: Boolean(detectProvider()),
      error: 'Unauthorized: Admin authentication required to dispatch SMS.'
    });
    return;
  }

  const verification = await verifyFirebaseAdminToken(idToken).catch(() => ({
    authorized: false,
    error: 'Authentication token verification failed.'
  }));

  if (!verification.authorized) {
    res.status(403).json({
      sent: false,
      configured: Boolean(detectProvider()),
      error: verification.error || 'Forbidden: Admin access required.'
    });
    return;
  }

  const { to, message, applicationId, registrationId } = (req.body || {}) as {
    to?: string;
    message?: string;
    applicationId?: string;
    registrationId?: string;
  };

  if (!to || !message || !String(message).trim()) {
    res.status(400).json({
      sent: false,
      configured: Boolean(detectProvider()),
      error: 'Recipient phone number and message are required.'
    });
    return;
  }

  const normalized = normalizePhone(to);
  if (!normalized.valid) {
    res.status(400).json({
      sent: false,
      configured: Boolean(detectProvider()),
      to: normalized.local,
      error: 'Invalid recipient phone number.'
    });
    return;
  }

  const provider = detectProvider();
  if (!provider) {
    res.status(200).json({
      sent: false,
      configured: false,
      to: normalized.local,
      error: 'SMS gateway environment variables are not configured on the server.'
    });
    return;
  }

  try {
    let result;
    const cleanMessage = String(message).trim();
    if (provider === 'bulksmsbd') {
      result = await sendViaBulkSmsBd(normalized, cleanMessage);
    } else if (provider === 'greenweb') {
      result = await sendViaGreenWeb(normalized, cleanMessage);
    } else if (provider === 'twilio') {
      result = await sendViaTwilio(normalized, cleanMessage);
    } else {
      result = await sendViaWebhook(normalized, cleanMessage, { applicationId, registrationId });
    }

    const statusCode = !result.configured ? 200 : result.sent ? 200 : 502;
    res.status(statusCode).json({ ...result, to: normalized.local });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unexpected SMS gateway error';
    res.status(502).json({
      sent: false,
      configured: true,
      provider,
      to: normalized.local,
      error: errorMsg
    });
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.use((req: Request, res: Response, next) => {
        if (req.path.startsWith('/api/')) {
          next();
          return;
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}
