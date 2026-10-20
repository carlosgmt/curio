import { NextRequest, NextResponse } from "next/server";
import { db, users, globalEntities } from "@/db";
import { eq } from "drizzle-orm";
import { generateDeterministicEmbedding } from "@/lib/search/vector";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export interface CalibratorCard {
  id: string;
  title: string;
  coreType: string;
  typePath: string;
  summary: string;
  brandOrCreator: string;
  heroImageUrl: string;
  embedding: number[];
}

export const CURATED_CALIBRATION_DECK: Omit<CalibratorCard, "embedding">[] = [
  {
    id: "calib-cinema-1",
    title: "In the Mood for Love (2000)",
    coreType: "MEDIA",
    typePath: "/media/film/auteur",
    summary: "Wong Kar-wai's poetic exploration of unspoken longing and melancholic intimacy in 1960s Hong Kong.",
    brandOrCreator: "Wong Kar-wai",
    heroImageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-cinema-2",
    title: "Stalker (1979)",
    coreType: "MEDIA",
    typePath: "/media/film/auteur",
    summary: "Andrei Tarkovsky's metaphysical expedition into the mysterious, telepathic Zone.",
    brandOrCreator: "Andrei Tarkovsky",
    heroImageUrl: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-cinema-3",
    title: "Drive My Car (2021)",
    coreType: "MEDIA",
    typePath: "/media/film/auteur",
    summary: "Ryusuke Hamaguchi's quiet, grief-laden adaptation of Haruki Murakami's introspective short story.",
    brandOrCreator: "Ryusuke Hamaguchi",
    heroImageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-lit-1",
    title: "Invisible Cities",
    coreType: "BOOK",
    typePath: "/book/literature/poetics",
    summary: "Italo Calvino's poetic dialogues between Marco Polo and Kublai Khan sketching phantom metropolises.",
    brandOrCreator: "Italo Calvino",
    heroImageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-lit-2",
    title: "The Book of Disquiet",
    coreType: "BOOK",
    typePath: "/book/literature/philosophy",
    summary: "Fernando Pessoa's posthumous Lisbon diary of existential solitude and wandering consciousness.",
    brandOrCreator: "Fernando Pessoa",
    heroImageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-lit-3",
    title: "Ficciones",
    coreType: "BOOK",
    typePath: "/book/literature/metafiction",
    summary: "Jorge Luis Borges' labyrinthine parables of infinite libraries, forking paths, and unreal encyclopedias.",
    brandOrCreator: "Jorge Luis Borges",
    heroImageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-vinyl-1",
    title: "Kind of Blue (1959)",
    coreType: "MEDIA",
    typePath: "/media/music/vinyl/jazz",
    summary: "Miles Davis' modal masterpiece recorded at Columbia 30th Street Studio with Bill Evans and Coltrane.",
    brandOrCreator: "Miles Davis",
    heroImageUrl: "https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-vinyl-2",
    title: "Selected Ambient Works 85-92",
    coreType: "MEDIA",
    typePath: "/media/music/vinyl/ambient",
    summary: "Richard D. James' seminal warm analog IDM soundscapes recorded on cassette and modified synthesizers.",
    brandOrCreator: "Aphex Twin",
    heroImageUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-vinyl-3",
    title: "A Love Supreme (1965)",
    coreType: "MEDIA",
    typePath: "/media/music/vinyl/jazz",
    summary: "John Coltrane Quartet's four-part spiritual suite of devotion and ecstatic post-bop modal expression.",
    brandOrCreator: "John Coltrane",
    heroImageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-gastronomy-1",
    title: "Domaine de la Romanée-Conti 2015",
    coreType: "PRODUCT",
    typePath: "/product/beverage/wine/burgundy",
    summary: "Sublime Vosne-Romanée grand cru pinot noir displaying ethereal violet perfume and mineral precision.",
    brandOrCreator: "Domaine de la Romanée-Conti",
    heroImageUrl: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-gastronomy-2",
    title: "The French Laundry Cookbook",
    coreType: "CULINARY",
    typePath: "/culinary/technique/haute",
    summary: "Thomas Keller's benchmark documentation of California-French culinary discipline and flavor precision.",
    brandOrCreator: "Thomas Keller",
    heroImageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-gastronomy-3",
    title: "Château Rayas Châteauneuf-du-Pape",
    coreType: "PRODUCT",
    typePath: "/product/beverage/wine/rhone",
    summary: "Pure sandy-terroir old-vine Grenache from the legendary Reynaud family in southern Rhône.",
    brandOrCreator: "Château Rayas",
    heroImageUrl: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-design-1",
    title: "Eames Lounge Chair & Ottoman (1956)",
    coreType: "PRODUCT",
    typePath: "/product/design/furniture",
    summary: "Charles & Ray Eames' molded rosewood plywood shell and supple leather tribute to nineteenth-century club chairs.",
    brandOrCreator: "Charles & Ray Eames",
    heroImageUrl: "https://images.unsplash.com/photo-1580481077195-c328a37db729?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-design-2",
    title: "Villa Savoye (1931)",
    coreType: "PLACE",
    typePath: "/place/architecture/modernist",
    summary: "Le Corbusier's definitive modernist manifesto manifesting the Five Points of a New Architecture in Poissy.",
    brandOrCreator: "Le Corbusier",
    heroImageUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "calib-design-3",
    title: "Braun ET66 Calculator (1987)",
    coreType: "PRODUCT",
    typePath: "/product/design/industrial",
    summary: "Dieter Rams & Dietrich Lubs' masterclass in functionalist minimalism and convex circular keypad ergonomics.",
    brandOrCreator: "Dieter Rams",
    heroImageUrl: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=800&q=80",
  },
];

/**
 * Computes a unit-length normalized mean 768-d vector across accepted items.
 */
export function calculateTasteVector(
  embeddings: (number[] | Float32Array)[],
  dimensions = 768
): Float32Array {
  const sum = new Float32Array(dimensions);
  if (!embeddings || embeddings.length === 0) {
    return sum;
  }

  let validCount = 0;
  for (const emb of embeddings) {
    if (!emb || emb.length === 0) continue;
    validCount++;
    for (let i = 0; i < dimensions; i++) {
      sum[i] += emb[i] || 0;
    }
  }

  if (validCount === 0) return sum;

  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += sum[i] * sum[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      sum[i] /= norm;
    }
  }

  return sum;
}

export function getCuratedDeckWithEmbeddings(): CalibratorCard[] {
  return CURATED_CALIBRATION_DECK.map((card) => {
    const textToEmbed = `${card.title} ${card.brandOrCreator} ${card.typePath} ${card.summary}`;
    const embedding = generateDeterministicEmbedding(textToEmbed, 768);
    return {
      ...card,
      embedding,
    };
  });
}

export async function GET() {
  try {
    const cards = getCuratedDeckWithEmbeddings();
    return NextResponse.json({ cards, count: cards.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { acceptedIds = [], acceptedCards = [], userId } = body;

    let targetUser = null;
    if (userId) {
      const [found] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      targetUser = found;
    }
    if (!targetUser) {
      targetUser = await getOrCreateDefaultUser();
    }

    const deck = getCuratedDeckWithEmbeddings();
    const deckMap = new Map(deck.map((c) => [c.id, c.embedding]));

    const vectorsToAverage: number[][] = [];

    // 1. Collect embeddings from acceptedIds
    for (const id of acceptedIds) {
      const emb = deckMap.get(id);
      if (emb) {
        vectorsToAverage.push(emb);
      }
    }

    // 2. Also collect embeddings from acceptedCards if passed directly
    for (const card of acceptedCards) {
      if (Array.isArray(card.embedding) && card.embedding.length === 768) {
        vectorsToAverage.push(card.embedding);
      }
    }

    // 3. If no items accepted, fallback to neutral mean across the whole deck
    if (vectorsToAverage.length === 0) {
      for (const card of deck) {
        vectorsToAverage.push(card.embedding);
      }
    }

    const tasteVectorFloat32 = calculateTasteVector(vectorsToAverage, 768);
    const tasteVectorArray = Array.from(tasteVectorFloat32);

    await db
      .update(users)
      .set({
        tasteVector: tasteVectorArray,
      })
      .where(eq(users.id, targetUser.id));

    return NextResponse.json({
      success: true,
      tasteVector: tasteVectorArray,
      dimensions: tasteVectorArray.length,
      userId: targetUser.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
