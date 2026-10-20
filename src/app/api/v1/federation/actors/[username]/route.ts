import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq, or } from "drizzle-orm";
import { generateActivityPubActor } from "@/lib/federation/activitypub";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(or(eq(users.username, username), eq(users.id, username)))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Actor not found" }, { status: 404 });
    }

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    const actor = generateActivityPubActor(user, baseUrl);

    return new NextResponse(JSON.stringify(actor), {
      status: 200,
      headers: {
        "Content-Type": "application/activity+json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=1800",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate ActivityPub actor" },
      { status: 500 }
    );
  }
}
