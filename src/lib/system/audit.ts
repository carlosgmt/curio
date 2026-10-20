import { db, auditLogs, users } from "@/db";
import { eq, desc, and } from "drizzle-orm";

export interface LogAuditParams {
  operatorUserId: string;
  action: string;
  targetEntityId?: string | null;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
}

export interface GetAuditLogsOptions {
  limit?: number;
  offset?: number;
  action?: string;
  operatorUserId?: string;
}

/**
 * Persists an immutable administrative audit event into audit_logs.
 */
export async function logAuditEvent(params: LogAuditParams) {
  const [log] = await db
    .insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      operatorUserId: params.operatorUserId,
      action: params.action,
      targetEntityId: params.targetEntityId ?? null,
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return log;
}

/**
 * Retrieves recent audit logs joined with the operator user details.
 */
export async function getRecentAuditLogs(options?: GetAuditLogsOptions) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const conditions = [];
  if (options?.action) {
    conditions.push(eq(auditLogs.action, options.action));
  }
  if (options?.operatorUserId) {
    conditions.push(eq(auditLogs.operatorUserId, options.operatorUserId));
  }

  const query = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetEntityId: auditLogs.targetEntityId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      operator: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.operatorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}
