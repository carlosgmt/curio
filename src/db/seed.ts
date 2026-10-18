import { db, curioTypes } from "./index";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "@/lib/search/vector";

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
  localizedAliases?: Record<string, string>;
  ownJsonSchema?: Record<string, unknown>;
  effectiveJsonSchema?: Record<string, unknown>;
  uiFieldConfig?: Array<{ key: string; label: string; primitive: string; isPublicObjective: boolean }>;
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
    localizedAliases: {
      es: "Disco de Vinilo",
      fr: "Disque Vinyle",
      de: "Schallplatte",
      it: "Disco in Vinile",
      ja: "レコード",
      vinyl: "Vinyl LP",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "artist", label: "Artist", primitive: "string", isPublicObjective: true },
      { key: "album", label: "Album", primitive: "string", isPublicObjective: true },
      { key: "releaseYear", label: "Release Year", primitive: "integer", isPublicObjective: true },
      { key: "rpm", label: "RPM", primitive: "string", isPublicObjective: true },
      { key: "catalogNumber", label: "Catalog #", primitive: "string", isPublicObjective: true },
      { key: "recordLabel", label: "Record Label", primitive: "string", isPublicObjective: true },
      { key: "gatefold", label: "Gatefold", primitive: "boolean", isPublicObjective: true },
      { key: "vinylColor", label: "Vinyl Color", primitive: "string", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Película / Cine",
      fr: "Film / Cinéma",
      de: "Film / Kino",
      it: "Film / Cinema",
      ja: "映画",
      movie: "Movie",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "title", label: "Title", primitive: "string", isPublicObjective: true },
      { key: "director", label: "Director", primitive: "string", isPublicObjective: true },
      { key: "releaseYear", label: "Release Year", primitive: "integer", isPublicObjective: true },
      { key: "runtimeMinutes", label: "Runtime (min)", primitive: "integer", isPublicObjective: true },
      { key: "cinematographer", label: "Cinematographer", primitive: "string", isPublicObjective: true },
      { key: "aspectRatio", label: "Aspect Ratio", primitive: "string", isPublicObjective: true },
      { key: "distributor", label: "Distributor", primitive: "string", isPublicObjective: true },
      { key: "billingBlock", label: "Billing Block", primitive: "string", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Libro / Publicación",
      fr: "Livre / Publication",
      de: "Buch / Publikation",
      it: "Libro",
      ja: "本 / 書籍",
      novel: "Novel",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "title", label: "Title", primitive: "string", isPublicObjective: true },
      { key: "author", label: "Author", primitive: "string", isPublicObjective: true },
      { key: "isbn", label: "ISBN", primitive: "string", isPublicObjective: true },
      { key: "pageCount", label: "Page Count", primitive: "integer", isPublicObjective: true },
      { key: "publisher", label: "Publisher", primitive: "string", isPublicObjective: true },
      { key: "edition", label: "Edition", primitive: "string", isPublicObjective: true },
      { key: "obiText", label: "Obi Text", primitive: "string", isPublicObjective: true },
      { key: "binding", label: "Binding", primitive: "string", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Vino",
      fr: "Vin",
      de: "Wein",
      it: "Vino",
      ja: "ワイン",
      natural_wine: "Vinos Naturales",
      natural_wine_en: "Natural Wine",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "producer", label: "Producer", primitive: "string", isPublicObjective: true },
      { key: "cuvee", label: "Cuvée", primitive: "string", isPublicObjective: true },
      { key: "vintage", label: "Vintage", primitive: "string", isPublicObjective: true },
      { key: "appellation", label: "Appellation", primitive: "string", isPublicObjective: true },
      { key: "region", label: "Region", primitive: "string", isPublicObjective: true },
      { key: "country", label: "Country", primitive: "string", isPublicObjective: true },
      { key: "varietal", label: "Varietal", primitive: "string", isPublicObjective: true },
      { key: "farming", label: "Farming", primitive: "string", isPublicObjective: true },
      { key: "abv", label: "ABV %", primitive: "number", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Arte y Grabados",
      fr: "Beaux-Arts",
      de: "Bildende Kunst",
      it: "Arte e Stampe",
      ja: "美術品",
      painting: "Painting / Artwork",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "artist", label: "Artist", primitive: "string", isPublicObjective: true },
      { key: "title", label: "Title", primitive: "string", isPublicObjective: true },
      { key: "year", label: "Year", primitive: "string", isPublicObjective: true },
      { key: "medium", label: "Medium", primitive: "string", isPublicObjective: true },
      { key: "dimensions", label: "Dimensions", primitive: "string", isPublicObjective: true },
      { key: "edition", label: "Edition", primitive: "string", isPublicObjective: true },
      { key: "galleryOrMuseum", label: "Gallery / Museum", primitive: "string", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Receta Culinaria",
      fr: "Recette de Cuisine",
      de: "Kochrezept",
      it: "Ricetta Culinaria",
      ja: "料理レシピ",
      cookbook: "Recipe",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "title", label: "Title", primitive: "string", isPublicObjective: true },
      { key: "cuisine", label: "Cuisine", primitive: "string", isPublicObjective: true },
      { key: "prepTimeMinutes", label: "Prep Time (min)", primitive: "integer", isPublicObjective: true },
      { key: "cookTimeMinutes", label: "Cook Time (min)", primitive: "integer", isPublicObjective: true },
      { key: "yieldServings", label: "Servings", primitive: "integer", isPublicObjective: true },
      { key: "ingredients", label: "Ingredients", primitive: "array", isPublicObjective: true },
      { key: "directions", label: "Directions", primitive: "array", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Pase de Tránsito o Sendero",
      fr: "Passe Transit & Sentier",
      de: "Transit- & Wanderpass",
      it: "Pass Trasporti e Sentieri",
      ja: "交通・トレイルパス",
      hiking: "Trail Pass",
    },
    ownJsonSchema: {
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
    effectiveJsonSchema: {
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
    uiFieldConfig: [
      { key: "name", label: "Route Name", primitive: "string", isPublicObjective: true },
      { key: "location", label: "Location", primitive: "string", isPublicObjective: true },
      { key: "coordinates", label: "Coordinates", primitive: "string", isPublicObjective: true },
      { key: "distanceKm", label: "Distance (km)", primitive: "number", isPublicObjective: true },
      { key: "elevationGainMeters", label: "Elevation Gain (m)", primitive: "integer", isPublicObjective: true },
      { key: "passType", label: "Pass Type", primitive: "string", isPublicObjective: true },
      { key: "validity", label: "Validity", primitive: "string", isPublicObjective: true },
    ],
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
    localizedAliases: {
      es: "Nota Privada",
      fr: "Mémo Privé",
      de: "Private Notiz",
      it: "Nota Privata",
      ja: "プライベートメモ",
      secret: "Confidential Note",
    },
    ownJsonSchema: {
      type: "object",
      properties: {
        memoTitle: { type: "string" },
        personalNotes: { type: "string" },
        confidentialTag: { type: "string" },
      },
      required: ["personalNotes"],
    },
    effectiveJsonSchema: {
      type: "object",
      properties: {
        memoTitle: { type: "string" },
        personalNotes: { type: "string" },
        confidentialTag: { type: "string" },
      },
      required: ["personalNotes"],
    },
    uiFieldConfig: [
      { key: "memoTitle", label: "Memo Title", primitive: "string", isPublicObjective: false },
      { key: "personalNotes", label: "Notes", primitive: "string", isPublicObjective: false },
      { key: "confidentialTag", label: "Tag", primitive: "string", isPublicObjective: false },
    ],
  },
];

export async function seedCanonicalArchetypes() {
  console.log("Seeding canonical Curio archetypes...");
  for (const def of CANONICAL_ARCHETYPES) {
    const aliasValues = def.localizedAliases ? Object.values(def.localizedAliases).join(" ") : "";
    const embedText = `${def.name} ${def.typePath} ${def.rootArchetype} ${def.extractionPrompt ?? ""} ${aliasValues}`;
    const embedding = await generateEmbedding(embedText);
    const typeEmbedding = JSON.stringify(embedding);

    const [existing] = await db
      .select()
      .from(curioTypes)
      .where(eq(curioTypes.typePath, def.typePath))
      .limit(1);

    const updatePayload = {
      name: def.name,
      rootArchetype: def.rootArchetype,
      defaultSilhouette: def.defaultSilhouette,
      identityRules: def.identityRules,
      jsonSchema: def.jsonSchema,
      publicFieldKeys: def.publicFieldKeys,
      extractionPrompt: def.extractionPrompt,
      typeEmbedding,
      localizedAliases: def.localizedAliases ?? {},
      ownJsonSchema: def.ownJsonSchema ?? def.jsonSchema,
      effectiveJsonSchema: def.effectiveJsonSchema ?? def.jsonSchema,
      uiFieldConfig: def.uiFieldConfig ?? [],
    };

    if (existing) {
      await db
        .update(curioTypes)
        .set(updatePayload)
        .where(eq(curioTypes.id, existing.id));
    } else {
      await db.insert(curioTypes).values({
        ...updatePayload,
        typePath: def.typePath,
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
