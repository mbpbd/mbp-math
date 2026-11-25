import { describe, expect, it } from 'vitest';
import { GET as healthGet } from '../api/health';
import { POST as verifyAdminPost } from '../api/auth/verify-admin';
import { POST as sendSmsPost } from '../api/send-sms';

describe('Vercel Serverless API Routes', () => {
  it('GET /api/health returns 200 with ok and smsConfigured status', async () => {
    const response = healthGet();
    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean; smsConfigured: boolean; provider: string | null };
    expect(data.ok).toBe(true);
    expect(typeof data.smsConfigured).toBe('boolean');
  });

  it('POST /api/auth/verify-admin returns 401 when no token is provided', async () => {
    const request = new Request('https://math.mbprojonmo.com/api/auth/verify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const response = await verifyAdminPost(request);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { authorized: boolean; error?: string };
    expect(data.authorized).toBe(false);
    expect(data.error).toBeTruthy();
  });

  it('POST /api/auth/verify-admin returns 403 for malformed bearer token', async () => {
    const request = new Request('https://math.mbprojonmo.com/api/auth/verify-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.jwt.token'
      }
    });
    const response = await verifyAdminPost(request);
    expect(response.status).toBe(403);
    const data = (await response.json()) as { authorized: boolean; error?: string };
    expect(data.authorized).toBe(false);
  });

  it('POST /api/auth/verify-admin returns 400 on invalid JSON body', async () => {
    const request = new Request('https://math.mbprojonmo.com/api/auth/verify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json'
    });
    const response = await verifyAdminPost(request);
    expect(response.status).toBe(400);
    const data = (await response.json()) as { authorized: boolean; error?: string };
    expect(data.authorized).toBe(false);
  });

  it('POST /api/send-sms returns 401 when unauthenticated', async () => {
    const request = new Request('https://math.mbprojonmo.com/api/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '01712345678', message: 'Test' })
    });
    const response = await sendSmsPost(request);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { sent: boolean; error?: string };
    expect(data.sent).toBe(false);
  });

  it('POST /api/send-sms returns 403 when bearer token is invalid', async () => {
    const request = new Request('https://math.mbprojonmo.com/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not.a.jwt'
      },
      body: JSON.stringify({ to: '01712345678', message: 'Test' })
    });
    const response = await sendSmsPost(request);
    expect(response.status).toBe(403);
    const data = (await response.json()) as { sent: boolean; error?: string };
    expect(data.sent).toBe(false);
  });
});
