import { db, FieldValue } from './admin';

export interface AuditLogData {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  ipHash?: string;
  createdAt?: any;
}

export async function writeAuditLog(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, any>,
  ipHash?: string
): Promise<void> {
  const logData: AuditLogData = {
    actorId,
    action,
    targetType,
    targetId,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (metadata) {
    logData.metadata = metadata;
  }
  
  if (ipHash) {
    logData.ipHash = ipHash;
  }

  await db.collection('auditLogs').add(logData);
}
