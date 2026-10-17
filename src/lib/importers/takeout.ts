import { parseCSV } from "./csvParser";

export interface ImportedKeepNote {
  title: string;
  textContent: string;
  labels: string[];
  isPinned: boolean;
  isPrivateMemo: boolean;
  enrichmentStatus: "LOCAL_ONLY" | "OPTIMISTIC";
  externalUrl?: string;
  tags: string[];
  createdAt?: string;
  typePath: string;
  coreType: string;
  canonicalExternalId: string;
}

export interface ImportedPlace {
  title: string;
  address?: string;
  lat?: number;
  lng?: number;
  googleMapsUrl?: string;
  comment?: string;
  tags: string[];
  typePath: "/place";
  coreType: "PLACE";
  canonicalExternalId: string;
  coreStructuredData: {
    title: string;
    address?: string;
    lat?: number;
    lng?: number;
    googleMapsUrl?: string;
  };
}

const URL_REGEX = /https?:\/\/[^\s<>"')]+[^\s<>"').,]/i;

/**
 * Parses Google Keep Takeout exports (.json or .html).
 * Strict Step 0 Privacy Guarantee:
 * Notes without URLs are marked isPrivateMemo=true and enrichmentStatus='LOCAL_ONLY',
 * triggering zero outbound requests and zero global cache writes.
 */
export function parseGoogleKeepTakeout(
  files: Array<{ name: string; content: string }>
): ImportedKeepNote[] {
  const notes: ImportedKeepNote[] = [];

  for (const file of files) {
    const isJson = file.name.endsWith(".json") || file.content.trim().startsWith("{");
    const isHtml = file.name.endsWith(".html") || file.content.includes("<div");

    let title = "";
    let textContent = "";
    const labels: string[] = [];
    let isPinned = false;
    let createdAt: string | undefined;

    if (isJson) {
      try {
        const data = JSON.parse(file.content);
        title = data.title?.trim() || "";

        let bodyText = data.textContent || "";
        if (Array.isArray(data.listContent)) {
          const checklist = data.listContent
            .map((item: any) => `- [${item.isChecked ? "x" : " "}] ${item.text || ""}`)
            .join("\n");
          bodyText = bodyText ? `${bodyText}\n\n${checklist}` : checklist;
        }
        textContent = bodyText.trim();

        if (Array.isArray(data.labels)) {
          for (const l of data.labels) {
            const name = typeof l === "string" ? l : l.name;
            if (name) labels.push(name.trim());
          }
        }

        if (data.isPinned) isPinned = true;
        if (data.userEditedTimestampUsec) {
          createdAt = new Date(Math.floor(data.userEditedTimestampUsec / 1000)).toISOString();
        }
      } catch {
        continue;
      }
    } else if (isHtml) {
      const headingMatch = file.content.match(/<div class="heading">([\s\S]*?)<\/div>/i);
      const titleMatch = file.content.match(/<title>([\s\S]*?)<\/title>/i);
      title = (headingMatch?.[1] || titleMatch?.[1] || "").replace(/<[^>]*>/g, "").trim();

      const contentMatch = file.content.match(/<div class="content">([\s\S]*?)<\/div>/i);
      textContent = (contentMatch?.[1] || file.content)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .trim();

      const labelMatches = file.content.matchAll(/<span class="label">([\s\S]*?)<\/span>/gi);
      for (const m of labelMatches) {
        if (m[1]) labels.push(m[1].replace(/<[^>]*>/g, "").trim());
      }
    }

    if (!title && !textContent) continue;

    // Check for external URL
    const urlMatch = textContent.match(URL_REGEX);
    const externalUrl = urlMatch ? urlMatch[0] : undefined;

    const isPrivateMemo = !externalUrl;
    const enrichmentStatus = isPrivateMemo ? "LOCAL_ONLY" : "OPTIMISTIC";

    if (!title) {
      title = textContent.slice(0, 48).split("\n")[0] || "Untitled Memo";
    }

    const autoTags = Array.from(
      new Set(["keep", ...labels.map((l) => l.toLowerCase()), isPrivateMemo ? "memo" : "save"])
    );

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const canonicalExternalId = isPrivateMemo
      ? `keep:memo:${crypto.randomUUID().slice(0, 8)}`
      : `keep:url:${externalUrl}`;

    notes.push({
      title,
      textContent,
      labels,
      isPinned,
      isPrivateMemo,
      enrichmentStatus,
      externalUrl,
      tags: autoTags,
      createdAt: createdAt || new Date().toISOString(),
      typePath: isPrivateMemo ? "/memo" : "/article",
      coreType: isPrivateMemo ? "PRIVATE_MEMO" : "ARTICLE",
      canonicalExternalId,
    });
  }

  return notes;
}

/**
 * Parses Google Maps Saved Places exports (GeoJSON or CSV).
 * Generates canonical /place entities with coordinates and metadata.
 */
export function parseGoogleMapsSavedPlaces(
  content: string,
  format?: "geojson" | "csv" | "auto"
): ImportedPlace[] {
  const trimmed = content.trim();
  const detectedFormat =
    format && format !== "auto"
      ? format
      : trimmed.startsWith("{")
      ? "geojson"
      : "csv";

  const places: ImportedPlace[] = [];

  if (detectedFormat === "geojson") {
    try {
      const parsed = JSON.parse(trimmed);
      const features: any[] = parsed.features || (parsed.type === "Feature" ? [parsed] : []);

      for (const feature of features) {
        const props = feature.properties || {};
        const geom = feature.geometry || {};

        let lng: number | undefined;
        let lat: number | undefined;
        if (Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
          lng = Number(geom.coordinates[0]);
          lat = Number(geom.coordinates[1]);
        }

        const title =
          props.Title || props.title || props.name || props["Place Name"] || "Untitled Place";
        const address =
          props["Location.Address"] ||
          props["Address"] ||
          (typeof props.Location === "object" ? props.Location.Address : props.Location) ||
          undefined;
        const googleMapsUrl = props["Google Maps URL"] || props["URL"] || props.url || undefined;
        const comment = props["Comment"] || props["Note"] || props.comment || undefined;

        let cityTag: string | undefined;
        if (address && typeof address === "string") {
          const parts = address.split(",");
          if (parts.length >= 2) {
            cityTag = parts[parts.length - 2]?.trim().toLowerCase();
          }
        }

        const tags = Array.from(
          new Set(["maps", "travel", "place", ...(cityTag ? [cityTag] : [])])
        );

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const canonicalExternalId = `place:maps:${slug}${lat ? `-${lat.toFixed(4)}` : ""}`;

        places.push({
          title,
          address,
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
          googleMapsUrl,
          comment,
          tags,
          typePath: "/place",
          coreType: "PLACE",
          canonicalExternalId,
          coreStructuredData: {
            title,
            address,
            lat: Number.isFinite(lat) ? lat : undefined,
            lng: Number.isFinite(lng) ? lng : undefined,
            googleMapsUrl,
          },
        });
      }
    } catch (err) {
      console.error("GeoJSON parse error:", err);
    }
  } else {
    // CSV format
    const rows = parseCSV(trimmed);
    for (const row of rows) {
      const title = row["Title"] || row["Name"] || row["Place Name"];
      if (!title) continue;

      const address = row["Address"] || row["Formatted Address"] || undefined;
      const googleMapsUrl = row["URL"] || row["Google Maps URL"] || undefined;
      const comment = row["Comment"] || row["Notes"] || undefined;

      let lat: number | undefined;
      let lng: number | undefined;

      // Try extract coordinates from URL (e.g. @35.6585805,139.7454329)
      if (googleMapsUrl) {
        const coordsMatch = googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordsMatch) {
          lat = parseFloat(coordsMatch[1]);
          lng = parseFloat(coordsMatch[2]);
        }
      }

      let cityTag: string | undefined;
      if (address) {
        const parts = address.split(",");
        if (parts.length >= 2) {
          cityTag = parts[parts.length - 2]?.trim().toLowerCase();
        }
      }

      const tags = Array.from(
        new Set(["maps", "travel", "place", ...(cityTag ? [cityTag] : [])])
      );

      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const canonicalExternalId = `place:maps:${slug}${lat ? `-${lat.toFixed(4)}` : ""}`;

      places.push({
        title,
        address,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
        googleMapsUrl,
        comment,
        tags,
        typePath: "/place",
        coreType: "PLACE",
        canonicalExternalId,
        coreStructuredData: {
          title,
          address,
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
          googleMapsUrl,
        },
      });
    }
  }

  return places;
}
