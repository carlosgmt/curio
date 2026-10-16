import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export const DEFAULT_MONTHLY_CREDITS = 25;

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  isPro: boolean;
  reason?: string;
  resetAt?: string | null;
}

export interface UserQuotaStatus {
  isPro: boolean;
  creditsRemaining: number;
  totalMonthlyCredits: number;
  resetAt: string | null;
  percentUsed: number;
}

/**
 * Calculates the next reset date (30 days from reference time)
 */
export function calculateNextResetDate(fromDate: Date = new Date()): string {
  const next = new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

/**
 * Checks and consumes AI credits for a user.
 * - Pro users bypass quota with unlimited remaining credits.
 * - Free users automatically reset to 25 credits every 30 days.
 * - Decrements credits on success or returns reason if quota exceeded.
 */
export async function checkAndConsumeCredit(
  userId: string,
  cost: number = 1,
  options?: { now?: Date }
): Promise<QuotaCheckResult> {
  const now = options?.now || new Date();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return {
      allowed: false,
      remaining: 0,
      isPro: false,
      reason: "User not found",
    };
  }

  // 1. Pro Tier Bypass
  if (user.isPro) {
    return {
      allowed: true,
      remaining: Infinity,
      isPro: true,
      resetAt: null,
    };
  }

  // 2. Monthly Reset Check
  let currentCredits = user.aiCreditsRemaining;
  let resetAt = user.aiCreditsResetAt;

  const isResetDue = !resetAt || new Date(resetAt) <= now;

  if (isResetDue) {
    currentCredits = DEFAULT_MONTHLY_CREDITS;
    resetAt = calculateNextResetDate(now);
  }

  // 3. Quota Evaluation
  if (currentCredits < cost) {
    // If we performed a reset, persist the reset state
    if (isResetDue) {
      await db
        .update(users)
        .set({
          aiCreditsRemaining: currentCredits,
          aiCreditsResetAt: resetAt,
        })
        .where(eq(users.id, userId));
    }

    return {
      allowed: false,
      remaining: currentCredits,
      isPro: false,
      resetAt,
      reason: "Monthly AI extraction quota exceeded",
    };
  }

  // 4. Consume Credits
  const newRemaining = currentCredits - cost;
  await db
    .update(users)
    .set({
      aiCreditsRemaining: newRemaining,
      aiCreditsResetAt: resetAt,
    })
    .where(eq(users.id, userId));

  return {
    allowed: true,
    remaining: newRemaining,
    isPro: false,
    resetAt,
  };
}

/**
 * Retrieves the current quota status, usage percentage, and reset schedule for a user.
 */
export async function getUserQuotaStatus(
  userId: string,
  options?: { now?: Date }
): Promise<UserQuotaStatus> {
  const now = options?.now || new Date();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  if (user.isPro) {
    return {
      isPro: true,
      creditsRemaining: Infinity,
      totalMonthlyCredits: Infinity,
      resetAt: null,
      percentUsed: 0,
    };
  }

  let creditsRemaining = user.aiCreditsRemaining;
  let resetAt = user.aiCreditsResetAt;

  // Handle lazy reset if date expired
  if (!resetAt || new Date(resetAt) <= now) {
    creditsRemaining = DEFAULT_MONTHLY_CREDITS;
    resetAt = calculateNextResetDate(now);

    await db
      .update(users)
      .set({
        aiCreditsRemaining: creditsRemaining,
        aiCreditsResetAt: resetAt,
      })
      .where(eq(users.id, userId));
  }

  const percentUsed = Math.max(
    0,
    Math.min(100, Math.round(((DEFAULT_MONTHLY_CREDITS - creditsRemaining) / DEFAULT_MONTHLY_CREDITS) * 100))
  );

  return {
    isPro: false,
    creditsRemaining,
    totalMonthlyCredits: DEFAULT_MONTHLY_CREDITS,
    resetAt,
    percentUsed,
  };
}
