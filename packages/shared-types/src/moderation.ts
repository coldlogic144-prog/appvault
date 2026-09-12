import type { Timestamp } from './user';

export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'inappropriate' | 'other';
export type ReportTargetType = 'user' | 'post' | 'comment' | 'message';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  reviewedBy: string | null;
  createdAt: Timestamp;
}

export type AuditAction = string;

export interface AuditLog {
  logId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  ipHash: string | null;
  createdAt: Timestamp;
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}
