import { addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import { AuditLogEntry } from '../types';

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'at'>): Promise<void> {
  const fullEntry: AuditLogEntry = {
    ...entry,
    at: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'auditLog'), fullEntry);
  } catch (error) {
    // Audit logging should gracefully fall back to console if permission fails
    console.warn('Audit log write error:', error);
  }
}
