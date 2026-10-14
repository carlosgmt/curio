import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { swapCandidateFallback } from "@/lib/ingest/disambiguation";

const disambiguateSchema = z.object({
  saveId: z.string().uuid(),
  targetUrl: z.string().url(),
  newEntityId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = disambiguateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error }, { status: 400 });
    }

    const result = await swapCandidateFallback(
      parsed.data.saveId,
      parsed.data.targetUrl,
      parsed.data.newEntityId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
