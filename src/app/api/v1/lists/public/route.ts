import { NextRequest, NextResponse } from "next/server";
import { db, smartLists, listItems, users } from "@/db";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const lists = await db
      .select({
        id: smartLists.id,
        title: smartLists.title,
        slug: smartLists.slug,
        description: smartLists.description,
        createdAt: smartLists.createdAt,
        ownerUsername: users.username,
        ownerDisplayName: users.displayName,
        itemCount: sql<number>`(SELECT COUNT(*) FROM ${listItems} WHERE ${listItems.listId} = ${smartLists.id})`,
      })
      .from(smartLists)
      .leftJoin(users, eq(smartLists.userId, users.id))
      .where(eq(smartLists.visibility, "PUBLIC"))
      .orderBy(desc(smartLists.createdAt))
      .limit(6);

    return NextResponse.json({ success: true, lists });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
