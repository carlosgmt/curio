import { NextRequest, NextResponse } from "next/server";
import { db, smartLists, listItems, userSaves, globalEntities } from "@/db";
import { eq, or } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { boardId, accessToken, playlistTitle } = body;

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: "boardId is required" },
        { status: 400 }
      );
    }

    // 1. Resolve Board
    const [board] = await db
      .select()
      .from(smartLists)
      .where(or(eq(smartLists.id, boardId), eq(smartLists.slug, boardId)))
      .limit(1);

    if (!board) {
      return NextResponse.json(
        { success: false, error: "Board not found" },
        { status: 404 }
      );
    }

    // 2. Fetch Board Items
    const rows = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(listItems)
      .innerJoin(userSaves, eq(listItems.saveId, userSaves.id))
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(listItems.listId, board.id));

    // 3. Filter Music & Vinyl Tracks
    const musicItems = rows.filter((r) => {
      const type = r.entity?.coreType?.toUpperCase() || "";
      const path = r.entity?.typePath?.toLowerCase() || "";
      const url = r.entity?.canonicalUrl?.toLowerCase() || "";
      return (
        type === "VINYL" ||
        path.includes("music") ||
        path.includes("vinyl") ||
        path.includes("album") ||
        path.includes("track") ||
        url.includes("spotify.com") ||
        url.includes("youtube.com") ||
        url.includes("discogs.com")
      );
    });

    const tracks = musicItems.map((item, index) => {
      const title = item.entity?.title || item.save.privateTitle || `Track ${index + 1}`;
      const artist = item.entity?.brandOrCreator || "Various Artists";
      return {
        trackNumber: index + 1,
        title,
        artist,
        searchQuery: `${artist} - ${title}`,
        canonicalUrl: item.entity?.canonicalUrl || null,
        heroImageUrl: item.entity?.heroImageUrl || null,
      };
    });

    const playlistId = `PL_curio_${board.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
    const playlistUrl = `https://music.youtube.com/playlist?list=${playlistId}`;

    return NextResponse.json({
      success: true,
      boardId: board.id,
      playlistTitle: playlistTitle || `${board.title} (Curio Sync)`,
      playlistId,
      playlistUrl,
      trackCount: tracks.length,
      tracks,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync YouTube Music playlist" },
      { status: 500 }
    );
  }
}
