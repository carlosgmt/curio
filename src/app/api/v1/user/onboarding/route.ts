import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, userSaves, globalEntities, type SmartList } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, toSafeUser, AuthError } from "@/lib/auth/service";
import { createList } from "@/lib/lists/service";
import { generateEntityKey } from "@/lib/ingest/cascade";

const onboardingSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  archetypes: z.array(z.string()).default([]),
  seedClassics: z.boolean().optional(),
});

interface ArchetypeTemplate {
  title: string;
  description: string;
  coreType: string;
  tagsInclude: string[];
}

const ARCHETYPE_MAP: Record<string, ArchetypeTemplate> = {
  cinema: {
    title: "Cinema Watchlist",
    description: "Curated films, directors & cinema notes",
    coreType: "MEDIA",
    tagsInclude: ["cinema", "film"],
  },
  book: {
    title: "The Library",
    description: "Books to read, annotations & literary collections",
    coreType: "BOOK",
    tagsInclude: ["book", "reading"],
  },
  books: {
    title: "The Library",
    description: "Books to read, annotations & literary collections",
    coreType: "BOOK",
    tagsInclude: ["book", "reading"],
  },
  vinyl: {
    title: "Vinyl & Sound Rotation",
    description: "Analog records, pressing notes & sound pairings",
    coreType: "MEDIA",
    tagsInclude: ["vinyl", "music"],
  },
  wine: {
    title: "Cellar & Vintages",
    description: "Notable vintages, pairings & tasting notes",
    coreType: "PRODUCT",
    tagsInclude: ["wine", "cellar"],
  },
  recipes: {
    title: "Culinary Laboratory",
    description: "Tried recipes, techniques & dining records",
    coreType: "CULINARY",
    tagsInclude: ["recipe", "culinary"],
  },
  art: {
    title: "Gallery & Art Objets",
    description: "Exhibitions, sculptures & visual inspirations",
    coreType: "PRODUCT",
    tagsInclude: ["art", "design"],
  },
  places: {
    title: "Cartography & Places",
    description: "Architectural spots, coffee bars & destinations",
    coreType: "PLACE",
    tagsInclude: ["place", "travel"],
  },
  memos: {
    title: "Text notes",
    description: "Personal sketches, field notes & text memos",
    coreType: "PRIVATE_MEMO",
    tagsInclude: ["memo", "notes"],
  },
  private_memo: {
    title: "Text notes",
    description: "Personal sketches, field notes & text memos",
    coreType: "PRIVATE_MEMO",
    tagsInclude: ["memo", "notes"],
  },
};

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid onboarding payload", details: parsed.error },
        { status: 400 }
      );
    }

    const { displayName, avatarUrl, archetypes } = parsed.data;
    let username = parsed.data.username;

    // Check handle uniqueness if supplied and changed
    if (username) {
      username = username.toLowerCase().trim().replace(/^@+/, "");
      if (!/^[a-z0-9_-]+$/.test(username)) {
        return NextResponse.json(
          { error: "Handle contains invalid characters" },
          { status: 400 }
        );
      }

      const [existingUsername] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, user.id)))
        .limit(1);

      if (existingUsername) {
        return NextResponse.json(
          { error: "This handle is already taken" },
          { status: 409 }
        );
      }
    }

    // Update user record
    const updates: Partial<typeof users.$inferInsert> = {
      onboardingCompleted: true,
    };
    if (displayName) updates.displayName = displayName.trim();
    if (username) updates.username = username;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    // Auto-generate starter Smart Lists for selected archetypes
    const createdLists: SmartList[] = [];
    const seenTemplates = new Set<string>();

    for (const rawArchetype of archetypes) {
      const key = rawArchetype.toLowerCase().trim();
      const template = ARCHETYPE_MAP[key];
      if (template && !seenTemplates.has(template.title)) {
        seenTemplates.add(template.title);
        const list = await createList(user.id, {
          title: template.title,
          description: template.description,
          visibility: "PRIVATE",
          autoRules: {
            coreType: template.coreType,
            tagsInclude: template.tagsInclude,
          },
        });
        createdLists.push(list);
      }
    }

    // Seed 4 Cultural Classics if requested
    if (parsed.data.seedClassics) {
      const CLASSICS = [
        {
          canonicalUrl: "https://mubi.com/films/in-the-mood-for-love",
          title: "In the Mood for Love",
          summary: "Two neighbors form a delicate bond after discovering the infidelity of their respective spouses in 1962 British Hong Kong.",
          heroImageUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80",
          coreType: "MEDIA",
          typePath: "/media/film",
          coreStructuredData: {
            director: "Wong Kar-wai",
            releaseYear: "2000",
            runtimeMinutes: 98,
            cinematographer: "Christopher Doyle & Mark Lee Ping-bin",
            distributor: "CRITERION COLLECTION № 147",
          },
          autoTags: ["cinema", "film", "criterion"],
        },
        {
          canonicalUrl: "https://open.spotify.com/album/1weenldZZHIcu659YuYDY5",
          title: "Kind of Blue",
          summary: "Miles Davis Quintet with John Coltrane and Bill Evans.",
          heroImageUrl: "https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=800&auto=format&fit=crop&q=80",
          coreType: "VINYL",
          typePath: "/media/music/vinyl",
          coreStructuredData: {
            artist: "Miles Davis",
            releaseYear: "1959",
            rpm: "33 ⅓ RPM",
            recordLabel: "Columbia Masterworks",
          },
          autoTags: ["vinyl", "music", "jazz"],
        },
        {
          canonicalUrl: "https://openlibrary.org/works/OL1991428W",
          title: "The Days of Abandonment",
          summary: "A ferocious, razor-sharp meditation on grief, obsession, and the unraveling of a marriage in Turin.",
          heroImageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&auto=format&fit=crop&q=80",
          coreType: "BOOK",
          typePath: "/product/book",
          coreStructuredData: {
            author: "Elena Ferrante",
            publisher: "Europa Editions",
            isbn: "978-1933372006",
            obiText: "A masterclass in domestic catastrophe and transcendent reclamation.",
          },
          autoTags: ["book", "reading", "literature"],
        },
        {
          canonicalUrl: "https://www.vivino.com/wines/giacomo-conterno-monfortino-barolo-riserva",
          title: "Barolo Riserva Monfortino",
          summary: "Unfined and unfiltered monumental expression of Nebbiolo from the legendary Cascina Francia vineyard.",
          heroImageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop&q=80",
          coreType: "PRODUCT",
          typePath: "/product/beverage/wine",
          coreStructuredData: {
            producer: "Giacomo Conterno",
            cuvee: "Barolo Riserva Monfortino",
            vintage: "2013",
            appellation: "DOCG",
            region: "Serralunga d'Alba, Piedmont",
            varietal: "100% Nebbiolo",
          },
          autoTags: ["wine", "cellar", "barolo"],
        },
      ];

      for (const item of CLASSICS) {
        const { urlHash, entityKey } = generateEntityKey(item.canonicalUrl, item.title);
        let [entity] = await db
          .select()
          .from(globalEntities)
          .where(eq(globalEntities.canonicalUrl, item.canonicalUrl))
          .limit(1);

        if (!entity) {
          [entity] = await db
            .insert(globalEntities)
            .values({
              urlHash,
              entityKey,
              canonicalUrl: item.canonicalUrl,
              title: item.title,
              summary: item.summary,
              heroImageUrl: item.heroImageUrl,
              coreType: item.coreType,
              typePath: item.typePath,
              coreStructuredData: item.coreStructuredData,
            })
            .returning();
        }

        const [existingSave] = await db
          .select({ id: userSaves.id })
          .from(userSaves)
          .where(and(eq(userSaves.userId, user.id), eq(userSaves.entityId, entity.id)))
          .limit(1);

        if (!existingSave) {
          await db.insert(userSaves).values({
            userId: user.id,
            entityId: entity.id,
            isPrivateMemo: false,
            autoTags: item.autoTags,
            enrichmentStatus: "COMPLETE",
            visibility: "PRIVATE",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: toSafeUser(updatedUser),
      createdLists,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
