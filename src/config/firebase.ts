import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Persist Google login across reloads/sessions
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.warn('Firebase Auth persistence warning:', err);
  });
}

export interface AdminSessionUser {
  email: string;
  role: 'superadmin' | 'admin';
  displayName?: string | null;
  photoURL?: string | null;
}

export async function verifyAdminSession(firebaseUser: User): Promise<
  | { authorized: true; user: AdminSessionUser }
  | { authorized: false; error: string }
> {
  const idToken = await firebaseUser.getIdToken();
  const resp = await fetch('/api/auth/verify-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    }
  });

  const data = (await resp.json().catch(() => null)) as {
    authorized?: boolean;
    email?: string;
    role?: 'superadmin' | 'admin';
    error?: string;
  } | null;

  if (!resp.ok || !data?.authorized) {
    return {
      authorized: false,
      error: data?.error || 'এই Google ইমেইলটি অ্যাডমিন প্যানেলের জন্য অনুমোদিত নয়।'
    };
  }

  return {
    authorized: true,
    user: {
      email: data.email || firebaseUser.email || '',
      role: data.role || 'admin',
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL
    }
  };
}

export async function signInAdminWithGoogle(): Promise<AdminSessionUser> {
  const credential = await signInWithPopup(auth, googleProvider);
  const verification = await verifyAdminSession(credential.user);
  if (!verification.authorized) {
    await signOut(auth).catch(() => {});
    throw new Error(verification.error);
  }
  return verification.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial connection check
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'publicSettings', 'contest'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: Client is currently operating in offline mode.');
    }
    return false;
  }
}
