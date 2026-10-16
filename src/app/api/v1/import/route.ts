import { NextRequest, NextResponse } from "next/server";
import { parseLetterboxdCSV } from "@/lib/importers/letterboxd";
import { parseGoodreadsCSV } from "@/lib/importers/goodreads";
import { ingestImportedItems } from "@/lib/importers/batchIngest";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, csvText } = body;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "Missing or invalid csvText" }, { status: 400 });
    }

    let items = [];
    if (platform === "letterboxd") {
      items = parseLetterboxdCSV(csvText);
    } else if (platform === "goodreads") {
      items = parseGoodreadsCSV(csvText);
    } else {
      // Auto-detect based on headers
      if (csvText.includes("Letterboxd URI") || (csvText.includes("Name") && csvText.includes("Year"))) {
        items = parseLetterboxdCSV(csvText);
      } else if (csvText.includes("Goodreads") || csvText.includes("Book Id") || csvText.includes("ISBN")) {
        items = parseGoodreadsCSV(csvText);
      } else {
        return NextResponse.json(
          { error: "Could not auto-detect CSV format. Specify platform as 'letterboxd' or 'goodreads'." },
          { status: 400 }
        );
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV." }, { status: 400 });
    }

    const result = await ingestImportedItems(items);

    return NextResponse.json({
      success: true,
      parsedCount: items.length,
      insertedCount: result.insertedCount,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("CSV import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
