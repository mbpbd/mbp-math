import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Firestore Security Rules Analysis', () => {
  const rulesPath = path.resolve(__dirname, '../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('contains the default deny-all catch-all rule', () => {
    expect(rulesContent).toContain("match /{document=**} {\n      allow read, write: if false;\n    }");
  });

  it('allows access to publicSettings, stats, and settings', () => {
    expect(rulesContent).toContain('match /publicSettings/{docId}');
    expect(rulesContent).toContain('match /stats/{docId}');
    expect(rulesContent).toContain('match /settings/{docId}');
  });

  it('contains security rules for core contest collections', () => {
    expect(rulesContent).toContain('match /venues/{venueId}');
    expect(rulesContent).toContain('match /schools/{schoolId}');
    expect(rulesContent).toContain('match /blocks/{blockId}');
    expect(rulesContent).toContain('match /students/{studentId}');
    expect(rulesContent).toContain('match /applications/{appId}');
    expect(rulesContent).toContain('match /teacher_marks/{docId}');
  });

  it('defines administrative auth helpers and all 9 authorized admin emails', () => {
    expect(rulesContent).toContain('function isSignedIn()');
    expect(rulesContent).toContain('function isSuperAdmin()');
    expect(rulesContent).toContain('function isAdmin()');
    const expectedAdmins = [
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
    for (const email of expectedAdmins) {
      expect(rulesContent.toLowerCase()).toContain(email);
    }
  });

  it('keeps the identical 9-email allowlist on the backend server', async () => {
    const serverModule = await import('../server');
    expect(serverModule.DEFAULT_ADMIN_EMAILS).toEqual([
      'swarupks.eee@gmail.com',
      'sinha.brojen3@gmail.com',
      'kiransingha134@gmail.com',
      'sayaksinha997@gmail.com',
      'adityasingha659@gmail.com',
      'itsmechemicalarko@gmail.com',
      'bipulsinha1994cu@gmail.com',
      'soumit.srt88@gmail.com',
      'mbprojonmo@gmail.com'
    ]);

    const invalidCheck = await serverModule.verifyFirebaseAdminToken('not.a.valid.jwt');
    expect(invalidCheck.authorized).toBe(false);
  });
});
