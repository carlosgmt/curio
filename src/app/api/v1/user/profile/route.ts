import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireAuth, toSafeUser, AuthError } from "@/lib/auth/service";

const affiliateTagsSchema = z.object({
  amazon: z.string().optional().nullable(),
  bookshop: z.string().optional().nullable(),
  ltk: z.string().optional().nullable(),
  skimlinks: z.string().optional().nullable(),
  customRef: z.string().optional().nullable(),
});

const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
  customDomain: z.string().max(255).optional().nullable(),
  affiliateTags: affiliateTagsSchema.optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: toSafeUser(dbUser),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid profile update payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { displayName, avatarUrl, customDomain, affiliateTags } = parsed.data;

    const updates: Partial<typeof users.$inferInsert> = {};

    if (displayName !== undefined) {
      updates.displayName = displayName ? displayName.trim() : null;
    }
    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl && avatarUrl.trim() ? avatarUrl.trim() : null;
    }
    if (customDomain !== undefined) {
      updates.customDomain = customDomain && customDomain.trim() ? customDomain.trim().toLowerCase() : null;
    }
    if (affiliateTags !== undefined) {
      if (affiliateTags === null) {
        updates.affiliateTags = null;
      } else {
        const cleaned: Record<string, string> = {};
        for (const [key, val] of Object.entries(affiliateTags)) {
          if (val && typeof val === "string" && val.trim().length > 0) {
            cleaned[key] = val.trim();
          }
        }
        updates.affiliateTags = cleaned;
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      success: true,
      user: toSafeUser(updatedUser),
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
