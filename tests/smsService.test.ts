import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  normalizeBdMobile,
  buildApprovalSmsMessage,
  buildRejectionSmsMessage,
  buildSmsAnchorHref,
  buildBatchSmsAnchorHref,
  estimateSmsParts,
  applySmsTemplatePlaceholders,
  openSmsApp,
  checkServerSmsConfigured,
  sendApprovalSms
} from '../src/services/smsService';

describe('smsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes Bangladeshi mobile numbers including Bengali digits and +880 prefixes', () => {
    expect(normalizeBdMobile('+8801753-253127')).toBe('01753253127');
    expect(normalizeBdMobile('8801717557419')).toBe('01717557419');
    expect(normalizeBdMobile('০১৭৫৩-২৫৩১২৭')).toBe('01753253127');
    expect(normalizeBdMobile('1717557419')).toBe('01717557419');
  });

  it('builds English payment-accepted confirmation SMS within 160 GSM-7 chars', () => {
    const msg = buildApprovalSmsMessage({
      applicantName: 'ARUN SINHA',
      registrationId: '2601601',
      contestNameEn: 'Math Quiz Contest 2026',
      organiserEn: 'Manipuri Biggan Projonmo',
      portalUrl: 'https://mbp-quiz.example.com/'
    });

    expect(msg).toContain('ARUN SINHA');
    expect(msg).toContain('payment accepted');
    expect(msg).toContain('2601601');
    expect(msg).toContain('https://mbp-quiz.example.com');
    expect(msg.length).toBeLessThanOrEqual(160);
    expect(/[^\x00-\x7F]/.test(msg)).toBe(false);
    expect(estimateSmsParts(msg)).toEqual({ chars: msg.length, isUnicode: false, parts: 1 });
  });

  it('caps even very long applicant names at <= 160 ASCII characters', () => {
    const msg = buildApprovalSmsMessage({
      applicantName: 'SYED MUHAMMAD ABDUR RAHMAN CHOWDHURY AL MAHMUD',
      registrationId: '2603999',
      contestNameEn: 'Math Quiz Contest 2026',
      organiserEn: 'Manipuri Biggan Projonmo'
    });

    expect(msg.length).toBeLessThanOrEqual(160);
    expect(/[^\x00-\x7F]/.test(msg)).toBe(false);
    expect(estimateSmsParts(msg).parts).toBe(1);
    expect(msg).toContain('2603999');
  });

  it('creates a valid sms: anchor href for native messaging fallback', () => {
    const href = buildSmsAnchorHref('+8801753-253127', 'Test ID 2601601');
    expect(href).toBe('sms:01753253127?body=Test%20ID%202601601');
  });

  it('checks server SMS configuration via /api/health', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, smsConfigured: false, provider: null })
      })
    );
    expect(await checkServerSmsConfigured()).toBe(false);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, smsConfigured: true, provider: 'greenweb' })
      })
    );
    expect(await checkServerSmsConfigured()).toBe(true);
  });

  it('triggers anchor click cleanly in openSmsApp when document exists', () => {
    const click = vi.fn();
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const mockLink = { href: '', style: { display: '' }, click };
    vi.stubGlobal('document', {
      createElement: vi.fn().mockReturnValue(mockLink),
      body: { appendChild, removeChild }
    });

    openSmsApp('sms:01753253127?body=Hello');
    expect(mockLink.href).toBe('sms:01753253127?body=Hello');
    expect(click).toHaveBeenCalledTimes(1);
    expect(appendChild).toHaveBeenCalledWith(mockLink);
    expect(removeChild).toHaveBeenCalledWith(mockLink);
  });

  it('dispatches SMS via /api/send-sms and surfaces server gateway result honestly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sent: true,
        configured: true,
        provider: 'bulksmsbd',
        to: '01753253127'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendApprovalSms({
      to: '০১৭৫৩-২৫৩১২৭',
      message: 'Approved 2601601',
      applicationId: 'app-1',
      registrationId: '2601601'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/send-sms',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
    expect(res.sent).toBe(true);
    expect(res.configured).toBe(true);
    expect(res.provider).toBe('bulksmsbd');
  });

  it('reports not configured when /api/send-sms returns configured: false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          sent: false,
          configured: false,
          to: '01753253127',
          error: 'SMS gateway environment variables are not configured on the server.'
        })
      })
    );

    const res = await sendApprovalSms({
      to: '01753253127',
      message: 'Approved 2601601'
    });

    expect(res.sent).toBe(false);
    expect(res.configured).toBe(false);
  });

  it('produces distinct dynamic English SMS messages and sms: links for different applicants within 160 chars using https://mbp-math.ai.studio/#public', () => {
    const firstMsg = buildApprovalSmsMessage({
      applicantName: 'SUMON SINHA',
      registrationId: '2602604',
      contestNameEn: 'Math Quiz Contest 2026',
      organiserEn: 'Manipuri Biggan Projonmo'
    });
    const secondMsg = buildApprovalSmsMessage({
      applicantName: 'RIYA DEVI',
      registrationId: '2603612',
      contestNameEn: 'Math Quiz Contest 2026',
      organiserEn: 'Manipuri Biggan Projonmo'
    });

    expect(firstMsg).toBe(
      'Congrats SUMON SINHA! Math Quiz Contest 2026 payment accepted. Reg ID: 2602604. Admit Card: https://mbp-math.ai.studio/#public - MBP'
    );
    expect(secondMsg).toBe(
      'Congrats RIYA DEVI! Math Quiz Contest 2026 payment accepted. Reg ID: 2603612. Admit Card: https://mbp-math.ai.studio/#public - MBP'
    );
    expect(firstMsg.length).toBeLessThanOrEqual(160);
    expect(secondMsg.length).toBeLessThanOrEqual(160);

    expect(buildSmsAnchorHref('01812-345678', firstMsg)).toMatch(/^sms:01812345678\?body=/);
    expect(buildSmsAnchorHref('01987-654321', secondMsg)).toMatch(/^sms:01987654321\?body=/);
  });

  it('builds rejection SMS message with reason, TrxID, freed ID notice, and public portal URL', () => {
    const msg = buildRejectionSmsMessage({
      applicantName: 'রাহুল সিনহা',
      registrationId: '2601605',
      txnId: 'BK12345XYZ',
      reason: 'TrxID খুঁজে পাওয়া যায়নি',
      contestNameBn: 'ম্যাথ কুইজ কনটেস্ট ২০২৬',
      organiserBn: 'মণিপুরি বিজ্ঞান প্রজন্ম'
    });

    expect(msg).toContain('রাহুল সিনহা');
    expect(msg).toContain('বাতিল করা হয়েছে');
    expect(msg).toContain('TrxID খুঁজে পাওয়া যায়নি');
    expect(msg).toContain('BK12345XYZ');
    expect(msg).toContain('2601605');
    expect(msg).toContain('https://mbp-math.ai.studio/#public');
    expect(msg).toContain('মণিপুরি বিজ্ঞান প্রজন্ম');
  });

  it('builds deduplicated batch sms: URIs with configurable separator and ignores invalid numbers', () => {
    const commaHref = buildBatchSmsAnchorHref(
      ['+8801711-223344', '01711223344', '০১৮১২-৩৪৫৬৭৮', 'invalid-num', '123'],
      'Exam tomorrow at 10 AM'
    );
    expect(commaHref).toBe('sms:01711223344,01812345678?body=Exam%20tomorrow%20at%2010%20AM');

    const semiHref = buildBatchSmsAnchorHref(
      ['01711223344', '01911223344'],
      'Reminder',
      ';'
    );
    expect(semiHref).toBe('sms:01711223344;01911223344?body=Reminder');

    expect(buildBatchSmsAnchorHref(['invalid'], 'Hello')).toBe('');
  });

  it('estimates GSM vs Unicode SMS part counts accurately and replaces dynamic placeholders', () => {
    expect(estimateSmsParts('Hello Math Quiz 2026')).toEqual({
      chars: 20,
      isUnicode: false,
      parts: 1
    });

    const unicodeShort = estimateSmsParts('প্রিয় শিক্ষার্থী, আগামীকাল পরীক্ষা।');
    expect(unicodeShort.isUnicode).toBe(true);
    expect(unicodeShort.parts).toBe(1);

    const unicodeMulti = estimateSmsParts('ক'.repeat(140));
    expect(unicodeMulti.isUnicode).toBe(true);
    expect(unicodeMulti.parts).toBe(3);

    const rendered = applySmsTemplatePlaceholders('প্রিয় {name}, আইডি: {id} - {contest} ({organiser})', {
      name: 'অনন্যা সিংহ',
      regId: '2601609',
      contestNameBn: 'ম্যাথ কুইজ কনটেস্ট ২০২৬',
      organiserBn: 'মণিপুরি বিজ্ঞান প্রজন্ম'
    });
    expect(rendered).toBe('প্রিয় অনন্যা সিংহ, আইডি: 2601609 - ম্যাথ কুইজ কনটেস্ট ২০২৬ (মণিপুরি বিজ্ঞান প্রজন্ম)');
  });
});

