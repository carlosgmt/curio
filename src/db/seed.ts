import { db, curioTypes } from "./index";
import { eq } from "drizzle-orm";

export interface CanonicalTypeDefinition {
  name: string;
  typePath: string;
  rootArchetype: string;
  defaultSilhouette: string;
  identityRules: {
    hardExternalIdKeys: string[];
    fingerprintFields: string[];
  };
  jsonSchema: Record<string, any>;
  publicFieldKeys: string[];
  extractionPrompt?: string;
}

export const CANONICAL_ARCHETYPES: CanonicalTypeDefinition[] = [
  {
    name: "Vinyl Album",
    typePath: "/media/music/vinyl",
    rootArchetype: "MEDIA",
    defaultSilhouette: "circle",
    identityRules: {
      hardExternalIdKeys: ["discogs", "spotify", "musicbrainz"],
      fingerprintFields: ["artist", "album", "releaseYear"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        artist: { type: "string" },
        album: { type: "string" },
        releaseYear: { type: "integer" },
        rpm: { type: "string", enum: ["33", "45", "78"], default: "33" },
        catalogNumber: { type: "string" },
        recordLabel: { type: "string" },
        gatefold: { type: "boolean" },
        vinylColor: { type: "string" },
      },
      required: ["artist", "album"],
    },
    publicFieldKeys: ["artist", "album", "releaseYear", "rpm", "recordLabel"],
    extractionPrompt: "Extract vinyl disc specifications including artist, album title, release year, RPM, label, and catalog number.",
  },
  {
    name: "Film / Cinema",
    typePath: "/media/film",
    rootArchetype: "MEDIA",
    defaultSilhouette: "tall_portrait",
    identityRules: {
      hardExternalIdKeys: ["tmdb", "imdb"],
      fingerprintFields: ["title", "director", "releaseYear"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        director: { type: "string" },
        releaseYear: { type: "integer" },
        runtimeMinutes: { type: "integer" },
        cinematographer: { type: "string" },
        aspectRatio: { type: "string" },
        distributor: { type: "string" },
        billingBlock: { type: "string" },
      },
      required: ["title", "director", "releaseYear"],
    },
    publicFieldKeys: ["title", "director", "releaseYear", "runtimeMinutes", "cinematographer", "aspectRatio"],
    extractionPrompt: "Extract Criterion-style film metadata: title, director, release year, runtime, cinematographer, and distributor.",
  },
  {
    name: "Book / Publication",
    typePath: "/product/book",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "book_jacket",
    identityRules: {
      hardExternalIdKeys: ["isbn", "goodreads", "openlibrary"],
      fingerprintFields: ["title", "author", "publisher"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        isbn: { type: "string" },
        pageCount: { type: "integer" },
        publisher: { type: "string" },
        edition: { type: "string" },
        obiText: { type: "string" },
        binding: { type: "string", enum: ["hardcover", "paperback", "slipcase"] },
      },
      required: ["title", "author"],
    },
    publicFieldKeys: ["title", "author", "isbn", "pageCount", "publisher", "binding"],
    extractionPrompt: "Extract book publication details: title, author, ISBN, pages, publisher, edition, and quote suitable for an obi belly-band.",
  },
  {
    name: "Estate Wine",
    typePath: "/product/beverage/wine",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "landscape_label",
    identityRules: {
      hardExternalIdKeys: ["vivino", "upc"],
      fingerprintFields: ["producer", "vintage", "cuvee", "region"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        producer: { type: "string" },
        cuvee: { type: "string" },
        vintage: { type: "string" },
        appellation: { type: "string" },
        region: { type: "string" },
        country: { type: "string" },
        varietal: { type: "string" },
        farming: { type: "string", enum: ["natural", "biodynamic", "organic", "conventional"] },
        abv: { type: "number" },
      },
      required: ["producer", "vintage", "appellation"],
    },
    publicFieldKeys: ["producer", "cuvee", "vintage", "appellation", "region", "country", "varietal", "farming", "abv"],
    extractionPrompt: "Extract natural/estate wine label details: producer, cuvée, vintage, appellation, region, varietals, and farming style.",
  },
  {
    name: "Fine Art & Print",
    typePath: "/product/art",
    rootArchetype: "PRODUCT",
    defaultSilhouette: "art_frame",
    identityRules: {
      hardExternalIdKeys: ["gallery_id"],
      fingerprintFields: ["artist", "title", "medium", "year"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        artist: { type: "string" },
        title: { type: "string" },
        year: { type: "string" },
        medium: { type: "string" },
        dimensions: { type: "string" },
        edition: { type: "string" },
        galleryOrMuseum: { type: "string" },
      },
      required: ["artist", "title"],
    },
    publicFieldKeys: ["artist", "title", "year", "medium", "dimensions", "edition", "galleryOrMuseum"],
    extractionPrompt: "Extract museum/gallery artwork attributes: artist, title, year, medium, dimensions, edition, and collection/gallery.",
  },
  {
    name: "Culinary Recipe",
    typePath: "/culinary/recipe",
    rootArchetype: "CULINARY",
    defaultSilhouette: "recipe_card",
    identityRules: {
      hardExternalIdKeys: ["source_url"],
      fingerprintFields: ["title", "cuisine", "yieldServings"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        cuisine: { type: "string" },
        prepTimeMinutes: { type: "integer" },
        cookTimeMinutes: { type: "integer" },
        yieldServings: { type: "integer", default: 4 },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              amount: { type: "number" },
              unit: { type: "string" },
            },
            required: ["item"],
          },
        },
        directions: { type: "array", items: { type: "string" } },
      },
      required: ["title", "ingredients", "directions"],
    },
    publicFieldKeys: ["title", "cuisine", "prepTimeMinutes", "cookTimeMinutes", "yieldServings", "ingredients", "directions"],
    extractionPrompt: "Extract culinary recipe index card: title, cuisine, prep/cook times, yield, structured ingredients list, and numbered steps.",
  },
  {
    name: "Transit & Trail Pass",
    typePath: "/place/transit_trail",
    rootArchetype: "PLACE",
    defaultSilhouette: "map_pass",
    identityRules: {
      hardExternalIdKeys: ["gpx_hash", "osm_id"],
      fingerprintFields: ["name", "elevationGainMeters", "coordinates"],
    },
    jsonSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        location: { type: "string" },
        coordinates: { type: "string" },
        distanceKm: { type: "number" },
        elevationGainMeters: { type: "integer" },
        passType: { type: "string", enum: ["rail_pass", "trail_permit", "ferry_ticket", "summit_log"] },
        validity: { type: "string" },
      },
      required: ["name"],
    },
    publicFieldKeys: ["name", "location", "coordinates", "distanceKm", "elevationGainMeters", "passType"],
    extractionPrompt: "Extract transit / hiking trail pass details: route name, coordinates, distance, elevation gain, and pass/ticket type.",
  },
  {
    name: "Private Vault Memo",
    typePath: "/private_memo",
    rootArchetype: "PRIVATE_MEMO",
    defaultSilhouette: "private_memo",
    identityRules: {
      hardExternalIdKeys: [],
      fingerprintFields: [],
    },
    jsonSchema: {
      type: "object",
      properties: {
        memoTitle: { type: "string" },
        personalNotes: { type: "string" },
        confidentialTag: { type: "string" },
      },
      required: ["personalNotes"],
    },
    publicFieldKeys: [],
    extractionPrompt: "Do not extract publicly; store verbatim in personal memory vault.",
  },
];

export async function seedCanonicalArchetypes() {
  console.log("Seeding canonical Curio archetypes...");
  for (const def of CANONICAL_ARCHETYPES) {
    const [existing] = await db
      .select()
      .from(curioTypes)
      .where(eq(curioTypes.typePath, def.typePath))
      .limit(1);

    if (existing) {
      await db
        .update(curioTypes)
        .set({
          name: def.name,
          rootArchetype: def.rootArchetype,
          defaultSilhouette: def.defaultSilhouette,
          identityRules: def.identityRules,
          jsonSchema: def.jsonSchema,
          publicFieldKeys: def.publicFieldKeys,
          extractionPrompt: def.extractionPrompt,
        })
        .where(eq(curioTypes.id, existing.id));
    } else {
      await db.insert(curioTypes).values({
        name: def.name,
        typePath: def.typePath,
        rootArchetype: def.rootArchetype,
        defaultSilhouette: def.defaultSilhouette,
        identityRules: def.identityRules,
        jsonSchema: def.jsonSchema,
        publicFieldKeys: def.publicFieldKeys,
        extractionPrompt: def.extractionPrompt,
      });
    }
  }
  console.log(`Successfully seeded ${CANONICAL_ARCHETYPES.length} canonical archetypes.`);
}

// Direct execution
if (import.meta.main) {
  seedCanonicalArchetypes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to seed archetypes:", err);
      process.exit(1);
    });
}
