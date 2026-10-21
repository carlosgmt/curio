import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { swapCandidateFallback } from "@/lib/ingest/disambiguation";
import { requireAuth, AuthError } from "@/lib/auth/service";
import { db, userSaves } from "@/db";
import { eq } from "drizzle-orm";

const disambiguateSchema = z.object({
  saveId: z.string().uuid(),
  targetUrl: z.string().min(1),
  newEntityId: z.string().uuid().optional(),
  targetCandidate: z
    .object({
      title: z.string(),
      subtitle: z.string().optional(),
      creator: z.string().nullable().optional(),
      year: z.number().nullable().optional(),
      typePath: z.string().optional(),
      badgeLabel: z.string().optional(),
      heroImageUrl: z.string().nullable().optional(),
      canonicalUrl: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const parsed = disambiguateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const [save] = await db
      .select({ userId: userSaves.userId })
      .from(userSaves)
      .where(eq(userSaves.id, parsed.data.saveId))
      .limit(1);

    if (!save) {
      return NextResponse.json({ error: "Save not found" }, { status: 404 });
    }

    if (save.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden: Not your save" }, { status: 403 });
    }

    const result = await swapCandidateFallback(
      parsed.data.saveId,
      parsed.data.targetUrl,
      parsed.data.newEntityId,
      parsed.data.targetCandidate
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
