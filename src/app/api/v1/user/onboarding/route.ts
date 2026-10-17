import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, type SmartList } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { requireAuth, toSafeUser, AuthError } from "@/lib/auth/service";
import { createList } from "@/lib/lists/service";

const onboardingSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z.string().min(3).max(30).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  archetypes: z.array(z.string()).default([]),
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
    title: "Private Vault & Field Notes",
    description: "Personal sketches, field notes & private memos",
    coreType: "PRIVATE_MEMO",
    tagsInclude: ["memo", "notes"],
  },
  private_memo: {
    title: "Private Vault & Field Notes",
    description: "Personal sketches, field notes & private memos",
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
