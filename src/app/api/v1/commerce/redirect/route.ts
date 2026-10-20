import { NextRequest, NextResponse } from "next/server";
import { db, auditLogs } from "@/db";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url") || searchParams.get("target");
    const curatorId = searchParams.get("curatorId");
    const saveId = searchParams.get("saveId");
    const entityId = searchParams.get("entityId");
    const seller = searchParams.get("seller");

    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: "Destination 'url' query parameter is required" },
        { status: 400 }
      );
    }

    // Validate URL protocol
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json(
          { success: false, error: "Invalid URL protocol: must be http or https" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid target URL" },
        { status: 400 }
      );
    }

    // Log outbound commercial attribution event
    try {
      let operatorUserId = curatorId;
      if (!operatorUserId) {
        const defaultUser = await getOrCreateDefaultUser();
        operatorUserId = defaultUser.id;
      }

      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        operatorUserId,
        action: "COMMERCE_OUTBOUND_CLICK",
        targetEntityId: entityId || saveId || null,
        metadata: {
          destinationUrl: targetUrl,
          sellerName: seller || null,
          saveId: saveId || null,
          entityId: entityId || null,
          curatorId: curatorId || null,
          referer: req.headers.get("referer") || null,
          userAgent: req.headers.get("user-agent") || null,
        },
        ipAddress: req.headers.get("x-forwarded-for") || null,
        createdAt: new Date().toISOString(),
      });
    } catch (logErr) {
      console.warn("Failed to log commerce click audit event:", logErr);
    }

    return NextResponse.redirect(targetUrl, 302);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process redirect" },
      { status: 500 }
    );
  }
}
