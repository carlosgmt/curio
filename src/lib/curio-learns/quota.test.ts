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
});
