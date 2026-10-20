import { describe, expect, it } from "bun:test";
import { db, users } from "@/db";
import { logAuditEvent, getRecentAuditLogs } from "../audit";

describe("Operator Audit Logging (Phase 8 / Audit Trail)", () => {
  it("persists and retrieves immutable administrative audit events", async () => {
    const timestamp = Date.now();

    const [adminUser] = await db
      .insert(users)
      .values({
        email: `admin-audit-${timestamp}@curio.local`,
        username: `admin_auditor_${timestamp}`,
        displayName: "Operator Admin",
        isAdmin: true,
      })
      .returning();

    // 1. Log an event
    const log = await logAuditEvent({
      operatorUserId: adminUser.id,
      action: "CACHE_PURGE",
      targetEntityId: "ent_all",
      metadata: { scope: "global_entities", purgedCount: 42 },
      ipAddress: "192.168.1.100",
    });

    expect(log).toBeDefined();
    expect(log.action).toBe("CACHE_PURGE");
    expect(log.operatorUserId).toBe(adminUser.id);

    // 2. Query recent logs
    const recent = await getRecentAuditLogs({
      action: "CACHE_PURGE",
      operatorUserId: adminUser.id,
    });

    expect(recent.length).toBeGreaterThanOrEqual(1);
    expect(recent[0].action).toBe("CACHE_PURGE");
    expect(recent[0].operator.username).toBe(`admin_auditor_${timestamp}`);
    expect(recent[0].metadata).toEqual({ scope: "global_entities", purgedCount: 42 });
  });
});
