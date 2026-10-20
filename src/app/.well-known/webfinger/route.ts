import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resource = searchParams.get("resource");

    if (!resource) {
      return NextResponse.json(
        { error: "Query parameter 'resource' is required" },
        { status: 400 }
      );
    }

    // Parse acct:username@domain or acct:username or URL
    let username = resource.trim();
    if (username.startsWith("acct:")) {
      username = username.slice(5);
    }
    if (username.includes("@")) {
      username = username.split("@")[0];
    } else if (username.includes("/")) {
      const parts = username.split("/");
      username = parts[parts.length - 1].replace(/^@/, "");
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(users)
      .where(or(eq(users.username, username), eq(users.id, username)))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${username}` },
        { status: 404 }
      );
    }

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");

    const origin = `${proto}://${host}`;
    const actorUrl = `${origin}/curio/api/v1/federation/actors/${user.username}`;
    const profileUrl = `${origin}/curio/@${user.username}`;

    const jrd = {
      subject: `acct:${user.username}@${host}`,
      aliases: [profileUrl, actorUrl],
      links: [
        {
          rel: "http://webfinger.net/rel/profile-page",
          type: "text/html",
          href: profileUrl,
        },
        {
          rel: "self",
          type: "application/activity+json",
          href: actorUrl,
        },
      ],
    };

    return new NextResponse(JSON.stringify(jrd), {
      status: 200,
      headers: {
        "Content-Type": "application/jrd+json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to resolve WebFinger" },
      { status: 500 }
    );
  }
}
