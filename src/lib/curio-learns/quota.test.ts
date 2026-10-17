import { describe, expect, it } from "bun:test";
import { db, users } from "@/db";
import { checkAndConsumeCredit, getUserQuotaStatus, calculateNextResetDate, DEFAULT_MONTHLY_CREDITS } from "./quota";

describe("AI Credit & Quota Metering Service", () => {
  it("deducts credits for free tier users from 25 credits", async () => {
    const timestamp = Date.now();
    const [freeUser] = await db
      .insert(users)
      .values({
        email: `free-${timestamp}@curio.local`,
        username: `free_user_${timestamp}`,
        displayName: "Free User",
        isPro: false,
        aiCreditsRemaining: 25,
        aiCreditsResetAt: calculateNextResetDate(new Date()),
      })
      .returning();

    // Deduct 1 credit
    const res1 = await checkAndConsumeCredit(freeUser.id, 1);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(24);
    expect(res1.isPro).toBe(false);

    // Deduct 4 more credits
    const res2 = await checkAndConsumeCredit(freeUser.id, 4);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(20);

    const status = await getUserQuotaStatus(freeUser.id);
    expect(status.creditsRemaining).toBe(20);
    expect(status.percentUsed).toBe(20);
    expect(status.isPro).toBe(false);
  });

  it("bypasses quota completely for Pro tier users", async () => {
    const timestamp = Date.now();
    const [proUser] = await db
      .insert(users)
      .values({
        email: `pro-${timestamp}@curio.local`,
        username: `pro_user_${timestamp}`,
        displayName: "Pro User",
        isPro: true,
        aiCreditsRemaining: 0,
      })
      .returning();

    const res = await checkAndConsumeCredit(proUser.id, 10);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(Infinity);
    expect(res.isPro).toBe(true);

    const status = await getUserQuotaStatus(proUser.id);
    expect(status.isPro).toBe(true);
    expect(status.creditsRemaining).toBe(Infinity);
    expect(status.percentUsed).toBe(0);
  });

  it("rejects credit consumption when quota reaches zero", async () => {
    const timestamp = Date.now();
    const [depletedUser] = await db
      .insert(users)
      .values({
        email: `depleted-${timestamp}@curio.local`,
        username: `depleted_${timestamp}`,
        displayName: "Depleted User",
        isPro: false,
        aiCreditsRemaining: 2,
        aiCreditsResetAt: calculateNextResetDate(new Date()),
      })
      .returning();

    // Consume 2 remaining credits
    const res1 = await checkAndConsumeCredit(depletedUser.id, 2);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(0);

    // Attempting to consume another credit should be rejected
    const res2 = await checkAndConsumeCredit(depletedUser.id, 1);
    expect(res2.allowed).toBe(false);
    expect(res2.remaining).toBe(0);
    expect(res2.reason).toContain("Monthly AI extraction quota exceeded");

    const status = await getUserQuotaStatus(depletedUser.id);
    expect(status.creditsRemaining).toBe(0);
    expect(status.percentUsed).toBe(100);
  });

  it("automatically performs monthly reset after 30 days have elapsed", async () => {
    const timestamp = Date.now();
    const pastResetDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

    const [expiredUser] = await db
      .insert(users)
      .values({
        email: `expired-${timestamp}@curio.local`,
        username: `expired_${timestamp}`,
        displayName: "Expired User",
        isPro: false,
        aiCreditsRemaining: 0,
        aiCreditsResetAt: pastResetDate,
      })
      .returning();

    // Calling checkAndConsumeCredit with current date should trigger reset to 25 and deduct 1 -> 24
    const res = await checkAndConsumeCredit(expiredUser.id, 1, { now: new Date() });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(24);
    expect(new Date(res.resetAt!).getTime()).toBeGreaterThan(Date.now());

    // Status should also reflect the reset
    const status = await getUserQuotaStatus(expiredUser.id);
    expect(status.creditsRemaining).toBe(24);
    expect(status.totalMonthlyCredits).toBe(DEFAULT_MONTHLY_CREDITS);
  });

  it("rejects negative, zero, and non-integer credit costs", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `negative-cost-${timestamp}@curio.local`,
        username: `negative_cost_${timestamp}`,
        displayName: "Negative Cost User",
        isPro: false,
        aiCreditsRemaining: 25,
      })
      .returning();

    await expect(checkAndConsumeCredit(user.id, -100)).rejects.toThrow("Cost must be a positive integer");
    await expect(checkAndConsumeCredit(user.id, 0)).rejects.toThrow("Cost must be a positive integer");
    await expect(checkAndConsumeCredit(user.id, 1.5)).rejects.toThrow("Cost must be a positive integer");
    await expect(checkAndConsumeCredit(user.id, -1)).rejects.toThrow("Cost must be a positive integer");

    // Ensure credits were not modified
    const status = await getUserQuotaStatus(user.id);
    expect(status.creditsRemaining).toBe(25);
  });

  it("handles concurrent credit consumption atomically without overdrafting", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `concurrent-${timestamp}@curio.local`,
        username: `concurrent_${timestamp}`,
        displayName: "Concurrent User",
        isPro: false,
        aiCreditsRemaining: 5,
        aiCreditsResetAt: calculateNextResetDate(new Date()),
      })
      .returning();

    // 10 concurrent requests of cost 1 for an account with only 5 credits
    const requests = Array.from({ length: 10 }, () => checkAndConsumeCredit(user.id, 1));
    const results = await Promise.all(requests);

    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(rejectedCount).toBe(5);

    const status = await getUserQuotaStatus(user.id);
    expect(status.creditsRemaining).toBe(0);
  });

  it("POST /api/v1/user/quota rejects negative cost with 400 Bad Request", async () => {
    const { POST } = await import("@/app/api/v1/user/quota/route");
    const { NextRequest } = await import("next/server");

    const req = new NextRequest("http://localhost:3000/api/v1/user/quota", {
      method: "POST",
      body: JSON.stringify({ cost: -100 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Cost must be at least 1");
  });
});
