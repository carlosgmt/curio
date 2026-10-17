import { NextRequest, NextResponse } from "next/server";
import { parseLetterboxdCSV } from "@/lib/importers/letterboxd";
import { parseGoodreadsCSV } from "@/lib/importers/goodreads";
import { parseBookmarksHTML, hydrateTopBookmarks } from "@/lib/importers/bookmarks";
import { parseGoogleKeepTakeout, parseGoogleMapsSavedPlaces } from "@/lib/importers/takeout";
import { ingestImportedItems, type AnyImportedItem } from "@/lib/importers/batchIngest";
import { requireAuth, AuthError } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json();
    const platform = (body.platform || "auto").toLowerCase();
    const rawContent = body.payload || body.csvText || "";

    if (!rawContent || (typeof rawContent !== "string" && !Array.isArray(rawContent))) {
      return NextResponse.json({ error: "Missing or invalid payload / csvText" }, { status: 400 });
    }

    let items: AnyImportedItem[] = [];
    let detectedPlatform = platform;

    // 1. Explicit or auto-detected parsing
    if (platform === "letterboxd") {
      items = parseLetterboxdCSV(String(rawContent));
    } else if (platform === "goodreads") {
      items = parseGoodreadsCSV(String(rawContent));
    } else if (platform === "bookmarks") {
      const parsed = parseBookmarksHTML(String(rawContent));
      items = await hydrateTopBookmarks(parsed, 20);
    } else if (platform === "keep") {
      if (Array.isArray(rawContent)) {
        items = parseGoogleKeepTakeout(rawContent);
      } else {
        items = parseGoogleKeepTakeout([{ name: "keep_import.json", content: String(rawContent) }]);
      }
    } else if (platform === "maps") {
      items = parseGoogleMapsSavedPlaces(String(rawContent), body.format || "auto");
    } else {
      // Auto-detection engine
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      if (contentStr.includes("<DL>") || contentStr.includes("NETSCAPE-Bookmark-file-1")) {
        detectedPlatform = "bookmarks";
        const parsed = parseBookmarksHTML(contentStr);
        items = await hydrateTopBookmarks(parsed, 20);
      } else if (contentStr.includes("Letterboxd URI") || (contentStr.includes("Name") && contentStr.includes("Year"))) {
        detectedPlatform = "letterboxd";
        items = parseLetterboxdCSV(contentStr);
      } else if (contentStr.includes("Goodreads") || contentStr.includes("Book Id") || contentStr.includes("ISBN")) {
        detectedPlatform = "goodreads";
        items = parseGoodreadsCSV(contentStr);
      } else if (contentStr.includes("FeatureCollection") || (contentStr.includes('"features"') && contentStr.includes('"geometry"'))) {
        detectedPlatform = "maps";
        items = parseGoogleMapsSavedPlaces(contentStr, "geojson");
      } else if (contentStr.includes("userEditedTimestampUsec") || contentStr.includes('<div class="note">') || contentStr.includes('"listContent"')) {
        detectedPlatform = "keep";
        items = parseGoogleKeepTakeout([{ name: "takeout.json", content: contentStr }]);
      } else if (contentStr.includes("Google Maps URL") || (contentStr.includes("Address") && contentStr.includes("Place Name"))) {
        detectedPlatform = "maps";
        items = parseGoogleMapsSavedPlaces(contentStr, "csv");
      } else {
        return NextResponse.json(
          {
            error:
              "Could not auto-detect format. Specify platform as 'letterboxd', 'goodreads', 'bookmarks', 'keep', or 'maps'.",
          },
          { status: 400 }
        );
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid records found in payload." }, { status: 400 });
    }

    const result = await ingestImportedItems(items, user.id);

    return NextResponse.json({
      success: true,
      platform: detectedPlatform,
      parsedCount: items.length,
      insertedCount: result.insertedCount,
      cacheHitCount: result.cacheHitCount,
      errors: result.errors,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Import processing error:", error);
    return NextResponse.json({ error: error.message || "Failed to process import" }, { status: 500 });
  }
}
