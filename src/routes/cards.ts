import { Hono } from "hono";
import { db } from "../db";
import { cards, lists, listRules, cardEvents } from "../db/schema";
import { eq, and, inArray, sql, like, gte, lte, desc, asc } from "drizzle-orm";

export const cardRoutes = new Hono();

// ── List / filter cards ────────────────────────────────────────────────

cardRoutes.get("/", async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit ?? "20"), 100);
  const offset = parseInt(q.offset ?? "0");

  const conditions: any[] = [];

  if (q.intent) {
    conditions.push(inArray(cards.intent, q.intent.split(",")));
  }
  if (q.status) {
    conditions.push(inArray(cards.status, q.status.split(",")));
  }
  if (q.list) {
    conditions.push(inArray(cards.listId, q.list.split(",")));
  }
  if (q.tags) {
    for (const tag of q.tags.split(",")) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${cards.tags}) WHERE json_each.value = ${tag})`
      );
    }
  }
  if (q.from) {
    conditions.push(gte(cards.createdAt, q.from));
  }
  if (q.to) {
    conditions.push(lte(cards.createdAt, q.to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderCol =
    q.sort === "updated_at" ? cards.updatedAt :
    q.sort === "due_at" ? cards.dueAt :
    cards.createdAt;
  const orderDir = q.sort === "due_at" ? asc(orderCol) : desc(orderCol);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(cards)
      .where(where)
      .orderBy(orderDir)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(cards)
      .where(where),
  ]);

  return c.json({
    cards: rows.map(deserializeCard),
    total: countResult[0].count,
  });
});

// ── Create card ────────────────────────────────────────────────────────

cardRoutes.post("/", async (c) => {
  const body = await c.req.json();
  if (!body.intent || !body.title) {
    return c.json({ error: "intent and title are required" }, 400);
  }

  // Auto-assign list from rules if not provided
  let listId = body.list_id ?? body.listId;
  if (!listId) {
    const rule = db
      .select({ listId: listRules.listId })
      .from(listRules)
      .where(eq(listRules.intent, body.intent))
      .get();
    listId = rule?.listId ?? "inbox";
  }

  const row = db
    .insert(cards)
    .values({
      intent: body.intent,
      status: body.status ?? "active",
      title: body.title,
      rawText: body.raw_text ?? body.rawText ?? body.title,
      data: JSON.stringify(body.data ?? {}),
      tags: JSON.stringify(body.tags ?? []),
      listId,
      parentId: body.parent_id ?? body.parentId ?? null,
      subtype: body.subtype ?? null,
      dueAt: body.due_at ?? body.dueAt ?? null,
    })
    .returning()
    .get();

  // Audit event
  db.insert(cardEvents)
    .values({ cardId: row.id, actor: body.actor ?? "user", action: "created" })
    .run();

  return c.json(deserializeCard(row), 201);
});

// ── Smart Context Action (Append to existing card/list or attach to parent) ──

cardRoutes.post("/smart", async (c) => {
  const body = await c.req.json();
  const rawText = (body.text ?? "").trim();
  const actor = body.actor ?? "user";

  if (!rawText) return c.json({ error: "Missing text" }, 400);

  // Fetch candidate active cards and lists for entity matching
  const [allCards, allLists] = await Promise.all([
    db
      .select({
        id: cards.id,
        title: cards.title,
        intent: cards.intent,
        listId: cards.listId,
        data: cards.data,
      })
      .from(cards)
      .where(eq(cards.status, "active"))
      .all(),
    db.select({ id: lists.id, name: lists.name }).from(lists).all(),
  ]);

  const cardsParsed = allCards.map((c) => ({
    ...c,
    data: JSON.parse(c.data),
  }));

  const { analyzeSmartInput } = await import("../lib/smartInput");
  const action = analyzeSmartInput(rawText, cardsParsed, allLists);

  if (!action) {
    return c.json({ matched: false });
  }

  // 1. Append to existing card (e.g. "add milk and eggs to groceries")
  if (action.kind === "append_card" && action.targetId) {
    const target = cardsParsed.find((c) => c.id === action.targetId);
    if (!target) return c.json({ matched: false });

    const existingData = target.data || {};
    const newItems = action.itemsToAppend || [action.content];

    // Check if target is a TodoList or has items
    let updatedData = { ...existingData };
    if (Array.isArray(existingData.items)) {
      const added = newItems.map((item, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        text: item,
        done: false,
      }));
      updatedData.items = [...existingData.items, ...added];
    } else if (Array.isArray(existingData.blocks)) {
      // Find checklist block or append new checklist item
      const blocks = [...existingData.blocks];
      const checkBlockIdx = blocks.findIndex((b: any) => b.kind === "checklist");
      if (checkBlockIdx >= 0) {
        const added = newItems.map((item, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          text: item,
          done: false,
        }));
        blocks[checkBlockIdx] = {
          ...blocks[checkBlockIdx],
          items: [...(blocks[checkBlockIdx].items || []), ...added],
        };
        updatedData.blocks = blocks;
      } else {
        blocks.push({
          kind: "checklist",
          title: "Added items",
          items: newItems.map((item, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            text: item,
            done: false,
          })),
        });
        updatedData.blocks = blocks;
      }
    } else {
      // Append text
          updatedData.rawAppend = (updatedData.rawAppend ? updatedData.rawAppend + "\n" : "") + action.content;
    }

    const updatedRow = db
      .update(cards)
      .set({
        data: JSON.stringify(updatedData),
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(cards.id, target.id))
      .returning()
      .get();

    db.insert(cardEvents)
      .values({
        cardId: target.id,
        actor,
        action: "appended",
        diff: JSON.stringify({ appended: newItems }),
      })
      .run();

    return c.json({
      matched: true,
      kind: "append_card",
      message: `Appended ${newItems.join(", ")} to "${target.title}"`,
      card: deserializeCard(updatedRow),
    });
  }

  // 2. Attach note/child to parent card (e.g. "I liked the ending of Norwegian Wood")
  if (action.kind === "attach_to_parent" && action.targetId) {
    const parent = cardsParsed.find((c) => c.id === action.targetId);
    if (!parent) return c.json({ matched: false });

    const newChild = db
      .insert(cards)
      .values({
        listId: parent.listId,
        parentId: parent.id,
        subtype: "note",
        intent: "note",
        status: "active",
        title: `Note on ${parent.title}`,
        rawText: action.content,
        data: JSON.stringify({
          summary: action.content,
          parentTitle: parent.title,
        }),
      })
      .returning()
      .get();

    db.insert(cardEvents)
      .values({
        cardId: parent.id,
        actor,
        action: "child_attached",
        diff: JSON.stringify({ childId: newChild.id, text: action.content }),
      })
      .run();

    return c.json({
      matched: true,
      kind: "attach_to_parent",
      message: `Attached note to "${parent.title}"`,
      card: deserializeCard(newChild),
      parentCard: parent,
    });
  }

  // 3. Create in specific list (e.g. "add buy tickets to tasks")
  if (action.kind === "create_in_list" && action.targetListId) {
    const newCard = db
      .insert(cards)
      .values({
        listId: action.targetListId,
        intent: "todo",
        status: "active",
        title: action.content,
        rawText: action.content,
        data: JSON.stringify({ summary: action.content }),
      })
      .returning()
      .get();

    return c.json({
      matched: true,
      kind: "create_in_list",
      message: `Added "${action.content}" to ${action.targetTitle}`,
      card: deserializeCard(newCard),
    });
  }

  return c.json({ matched: false });
});


// ── Brain Dump / Batch Ingestion ────────────────────────────────────────

cardRoutes.post("/dump", async (c) => {
  const body = await c.req.json();
  const rawText = (body.text ?? "").trim();
  const actor = body.actor ?? "user";

  const { splitBrainDump } = await import("../lib/brainDump");
  const items: string[] = Array.isArray(body.items) && body.items.length > 0 
    ? body.items 
    : splitBrainDump(rawText);

  if (items.length === 0) {
    return c.json({ error: "No items provided" }, 400);
  }

  const { analyzeSmartInput } = await import("../lib/smartInput");
  const { mockClassify } = await import("../lib/jev/mock");
  const { parseFor } = await import("../lib/parse");
  const { customTypes } = await import("../db/schema");
  const { matchCustomType } = await import("../lib/customTypes");

  const [allCards, allLists, customTypesRaw, rules] = await Promise.all([
    db.select().from(cards).where(eq(cards.status, "active")).all(),
    db.select().from(lists).all(),
    db.select().from(customTypes).all(),
    db.select().from(listRules).all(),
  ]);

  const ruleMap = new Map(rules.map((r) => [r.intent, r.listId]));
  const customTypeList = customTypesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    fields: JSON.parse(r.fields),
    patterns: JSON.parse(r.patterns),
  }));

  const created: any[] = [];
  const appended: any[] = [];

  for (const itemText of items) {
    const trimmed = itemText.trim();
    if (!trimmed) continue;

    const smartAction = analyzeSmartInput(
      trimmed,
      allCards.map((c) => ({
        id: c.id,
        title: c.title,
        intent: c.intent,
        listId: c.listId,
        data: JSON.parse(c.data),
      })),
      allLists
    );

    if (smartAction?.kind === "append_card" && smartAction.targetId) {
      const target = allCards.find((c) => c.id === smartAction.targetId);
      if (target) {
        const existingData = JSON.parse(target.data);
        const newItems = smartAction.itemsToAppend || [smartAction.content];
        let updatedData = { ...existingData };
        if (Array.isArray(existingData.items)) {
          const added = newItems.map((it: string, idx: number) => ({
            id: `item-${Date.now()}-${idx}`,
            text: it,
            done: false,
          }));
          updatedData.items = [...existingData.items, ...added];
        } else {
          updatedData.rawAppend = (updatedData.rawAppend ? updatedData.rawAppend + "\n" : "") + smartAction.content;
        }

        db.update(cards)
          .set({ data: JSON.stringify(updatedData), updatedAt: sql`datetime('now')` })
          .where(eq(cards.id, target.id))
          .run();

        db.insert(cardEvents)
          .values({
            cardId: target.id,
            actor,
            action: "appended_via_dump",
            diff: JSON.stringify({ appended: newItems }),
          })
          .run();

        appended.push({ targetId: target.id, targetTitle: target.title, items: newItems });
        continue;
      }
    }

    if (smartAction?.kind === "attach_to_parent" && smartAction.targetId) {
      const parent = allCards.find((c) => c.id === smartAction.targetId);
      if (parent) {
        const newChild = db
          .insert(cards)
          .values({
            listId: parent.listId,
            parentId: parent.id,
            subtype: "note",
            intent: "note",
            status: "active",
            title: `Note on ${parent.title}`,
            rawText: smartAction.content,
            data: JSON.stringify({ summary: smartAction.content, parentTitle: parent.title }),
          })
          .returning()
          .get();

        db.insert(cardEvents)
          .values({
            cardId: parent.id,
            actor,
            action: "child_attached_via_dump",
            diff: JSON.stringify({ childId: newChild.id, text: smartAction.content }),
          })
          .run();

        created.push(deserializeCard(newChild));
        continue;
      }
    }

    const customMatch = matchCustomType(trimmed, customTypeList);
    if (customMatch) {
      const ct = customMatch.type;
      const newCard = db
        .insert(cards)
        .values({
          listId: "inbox",
          intent: "note",
          subtype: ct.id,
          status: "active",
          title: trimmed,
          rawText: trimmed,
          data: JSON.stringify({
            summary: trimmed,
            customTypeId: ct.id,
            customTypeName: ct.name,
          }),
        })
        .returning()
        .get();

      created.push(deserializeCard(newCard));
      continue;
    }

    const classified = mockClassify(trimmed);
    const intentVal = classified.intent.value === "none" ? "note" : classified.intent.value;
    const intent = intentVal as any;
    const parsedData = parseFor(intent as any, trimmed);
    const assignedList = smartAction?.kind === "create_in_list" && smartAction.targetListId
      ? smartAction.targetListId
      : ruleMap.get(intentVal) ?? "inbox";

    const newCard = db
      .insert(cards)
      .values({
        listId: assignedList,
        intent,
        status: "active",
        title: trimmed,
        rawText: trimmed,
        data: JSON.stringify(parsedData),
      })
      .returning()
      .get();

    created.push(deserializeCard(newCard));
  }

  return c.json({
    total: items.length,
    createdCount: created.length,
    appendedCount: appended.length,
    created,
    appended,
    message: `Processed ${items.length} items (${created.length} created, ${appended.length} appended)`,
  });
});

// ── Get card ───────────────────────────────────────────────────────────

cardRoutes.get("/:id", async (c) => {
  const row = db.select().from(cards).where(eq(cards.id, c.req.param("id"))).get();
  if (!row) return c.json({ error: "card not found" }, 404);
  return c.json(deserializeCard(row));
});

// ── Get child cards attached to a parent ───────────────────────────────

cardRoutes.get("/:id/children", async (c) => {
  const rows = db
    .select()
    .from(cards)
    .where(and(eq(cards.parentId, c.req.param("id")), eq(cards.status, "active")))
    .orderBy(desc(cards.createdAt))
    .all();
  return c.json(rows.map(deserializeCard));
});

// ── Update card ────────────────────────────────────────────────────────

cardRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const sets: Record<string, any> = { updatedAt: sql`datetime('now')` };
  const diff: Record<string, any> = {};

  if (body.title !== undefined) { sets.title = body.title; diff.title = body.title; }
  if (body.status !== undefined) {
    sets.status = body.status;
    diff.status = body.status;
    if (body.status === "archived") sets.archivedAt = sql`datetime('now')`;
    if (body.status === "active") sets.archivedAt = null;
  }
  if (body.list_id !== undefined || body.listId !== undefined) {
    const lid = body.list_id ?? body.listId;
    sets.listId = lid;
    diff.list_id = lid;
  }
  if (body.data !== undefined) { sets.data = JSON.stringify(body.data); diff.data = body.data; }
  if (body.tags !== undefined) { sets.tags = JSON.stringify(body.tags); diff.tags = body.tags; }
  if (body.due_at !== undefined || body.dueAt !== undefined) {
    const d = body.due_at ?? body.dueAt;
    sets.dueAt = d;
    diff.due_at = d;
  }

  const row = db.update(cards).set(sets).where(eq(cards.id, id)).returning().get();
  if (!row) return c.json({ error: "card not found" }, 404);

  const action = body.status === "archived" ? "archived" :
    diff.list_id ? "moved" : "updated";
  db.insert(cardEvents)
    .values({
      cardId: id,
      actor: body.actor ?? "user",
      action,
      diff: JSON.stringify(diff),
    })
    .run();

  return c.json(deserializeCard(row));
});

// ── Delete card ────────────────────────────────────────────────────────

cardRoutes.delete("/:id", async (c) => {
  const deleted = db
    .delete(cards)
    .where(eq(cards.id, c.req.param("id")))
    .returning()
    .get();
  if (!deleted) return c.json({ error: "card not found" }, 404);
  return c.body(null, 204);
});

// ── Helpers ────────────────────────────────────────────────────────────

function deserializeCard(row: typeof cards.$inferSelect) {
  return {
    ...row,
    data: JSON.parse(row.data),
    tags: JSON.parse(row.tags),
  };
}
