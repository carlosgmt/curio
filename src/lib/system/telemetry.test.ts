import { describe, expect, it, beforeEach } from "bun:test";
import { getDatabaseTelemetry } from "./telemetry";
import { requireAdmin } from "@/lib/auth/admin";
import { registerUser } from "@/lib/auth/service";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { GET as getTelemetryRoute } from "@/app/api/v1/system/telemetry/route";
import { NextRequest } from "next/server";

describe("Database Telemetry & Admin Engine", () => {
  it("getDatabaseTelemetry returns complete system metrics", async () => {
    const telemetry = await getDatabaseTelemetry();

    // Storage
    expect(telemetry.storage).toBeDefined();
    expect(telemetry.storage.journalMode.toLowerCase()).toBe("wal");
    expect(typeof telemetry.storage.pageCount).toBe("number");
    expect(telemetry.storage.integrityCheck).toBe("ok");

    // Counts
    expect(telemetry.counts).toBeDefined();
    expect(typeof telemetry.counts.users).toBe("number");
    expect(typeof telemetry.counts.userSaves).toBe("number");
    expect(typeof telemetry.counts.globalEntities).toBe("number");

    // Cache
    expect(telemetry.cache).toBeDefined();
    expect(typeof telemetry.cache.cacheHitRatePercent).toBe("number");
    expect(typeof telemetry.cache.cacheHitCount).toBe("number");

    // Enrichment
    expect(telemetry.enrichment.byStatus).toBeDefined();
    expect(typeof telemetry.enrichment.byStatus.ENRICHED).toBe("number");

    // Archetypes
    expect(telemetry.archetypes).toBeDefined();
    expect(typeof telemetry.archetypes.PRODUCT).toBe("number");
    expect(typeof telemetry.archetypes.MEDIA).toBe("number");
    expect(typeof telemetry.archetypes.PRIVATE_MEMO).toBe("number");

    // Host & Process
    expect(telemetry.process).toBeDefined();
    expect(telemetry.process.nodeVersion).toBeDefined();
    expect(typeof telemetry.process.uptimeSeconds).toBe("number");
  });

  describe("Admin Authorization Guard", () => {
    const originalToken = process.env.CURIO_ADMIN_TOKEN;

    beforeEach(() => {
      process.env.CURIO_ADMIN_TOKEN = "test-secret-admin-token-12345";
    });

    it("authorizes via x-admin-token header", async () => {
      const headers = new Headers();
      headers.set("x-admin-token", "test-secret-admin-token-12345");

      const auth = await requireAdmin(headers);
      expect(auth.user.isAdmin).toBe(true);
      expect(auth.user.username).toBe("admin");
    });

    it("authorizes via Bearer token matching CURIO_ADMIN_TOKEN", async () => {
      const headers = new Headers();
      headers.set("authorization", "Bearer test-secret-admin-token-12345");

      const auth = await requireAdmin(headers);
      expect(auth.user.isAdmin).toBe(true);
    });

    it("authorizes user session when user has isAdmin = true", async () => {
      const rand = Math.random().toString(36).substring(7);
      const { user, token } = await registerUser({
        email: `admin_${rand}@curio.local`,
        username: `admin_user_${rand}`,
        password: "AdminPassword123!",
      });

      // Promote to admin
      await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));

      const headers = new Headers();
      headers.set("authorization", `Bearer ${token}`);

      const auth = await requireAdmin(headers);
      expect(auth.user.id).toBe(user.id);
      expect(auth.user.isAdmin).toBe(true);
    });

    it("rejects non-admin user session with 403 Forbidden", async () => {
      const rand = Math.random().toString(36).substring(7);
      const { token } = await registerUser({
        email: `regular_${rand}@curio.local`,
        username: `regular_${rand}`,
        password: "RegularPassword123!",
      });

      const headers = new Headers();
      headers.set("authorization", `Bearer ${token}`);

      expect(requireAdmin(headers)).rejects.toThrow("Forbidden");
    });

    it("rejects unauthenticated request with 401 Unauthorized", async () => {
      const headers = new Headers();
      expect(requireAdmin(headers)).rejects.toThrow("Authentication required");
    });
  });

  describe("GET /api/v1/system/telemetry API route", () => {
    it("returns 401 when unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/curio/api/v1/system/telemetry");
      const res = await getTelemetryRoute(req);
      expect(res.status).toBe(401);
    });

    it("returns telemetry json when authorized with admin token", async () => {
      process.env.CURIO_ADMIN_TOKEN = "valid-telemetry-token";
      const req = new NextRequest("http://localhost:3000/curio/api/v1/system/telemetry", {
        headers: {
          "x-admin-token": "valid-telemetry-token",
        },
      });

      const res = await getTelemetryRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.storage.journalMode.toLowerCase()).toBe("wal");
      expect(data.counts).toBeDefined();
      expect(data.cache).toBeDefined();
    });
  });
});
