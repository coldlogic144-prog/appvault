export interface AuditLogData {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any>;
    ipHash?: string;
    createdAt?: any;
}
export declare function writeAuditLog(actorId: string, action: string, targetType: string, targetId: string, metadata?: Record<string, any>, ipHash?: string): Promise<void>;
//# sourceMappingURL=audit.d.ts.map