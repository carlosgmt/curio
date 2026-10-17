import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities, smartLists, listItems, entryConnections } from "@/db";
import { getSaveDetails, updateSaveDetails, deleteSave } from "./service";
import { createConnection } from "@/lib/connections/service";
import { addItemToList, createList } from "@/lib/lists/service";

describe("Saves Service (Inspection, Editing & Deletion)", () => {
  it("retrieves full save details including entity, lists, and synaptic connections", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `savedetails-${timestamp}@curio.local`,
        username: `savedetails_${timestamp}`,
      })
      .returning();

    const [entity] = await db
      .insert(globalEntities)
      .values({
        canonicalUrl: `https://example.com/tokyo-story-${timestamp}`,
        urlHash: `hash-tokyo-${timestamp}`,
        entityKey: `key-tokyo-${timestamp}`,
        coreType: "MEDIA",
        title: "Tokyo Story (Ozu)",
        summary: "1953 masterpiece of domestic cinema",
        coreStructuredData: {},
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        entityId: entity.id,
        isPrivateMemo: false,
        personalNotes: "Favorite cinematic pacing",
      })
      .returning();

    // 1. Add to a list
    const list = await createList(user.id, { title: "Japanese Cinema Essentials" });
    await addItemToList(list.id, save.id, { sectionHeader: "Classics" });

    // 2. Create another save and connect them
    const [companionSave] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: false,
        personalNotes: "Companion note",
      })
      .returning();

    await createConnection({
      userId: user.id,
      sourceSaveId: save.id,
      targetSaveId: companionSave.id,
      connectionType: "INSPIRED_BY",
      contextNote: "Direct influence on modern style",
    });

    const details = await getSaveDetails(save.id);
    expect(details).not.toBeNull();
    expect(details?.save.id).toBe(save.id);
    expect(details?.entity?.title).toBe("Tokyo Story (Ozu)");
    expect(details?.lists.length).toBe(1);
    expect(details?.lists[0].title).toBe("Japanese Cinema Essentials");
    expect(details?.connections.length).toBe(1);
    expect(details?.connections[0].connectionType).toBe("INSPIRED_BY");
  });

  it("updates personal notes, title, and typePath override", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `saveupdate-${timestamp}@curio.local`,
        username: `saveupdate_${timestamp}`,
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: false,
        privateTitle: "Initial Title",
        personalNotes: "Initial note",
        typePath: "/media/film",
      })
      .returning();

    const updated = await updateSaveDetails(save.id, {
      privateTitle: "Edited Title",
      personalNotes: "Updated critical thoughts",
      typePath: "/media/music/vinyl",
    });

    expect(updated?.save.privateTitle).toBe("Edited Title");
    expect(updated?.save.personalNotes).toBe("Updated critical thoughts");
    expect(updated?.save.typePath).toBe("/media/music/vinyl");
  });

  it("deletes save and cascades list items and connections", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `savedelete-${timestamp}@curio.local`,
        username: `savedelete_${timestamp}`,
      })
      .returning();

    const [save] = await db
      .insert(userSaves)
      .values({
        userId: user.id,
        isPrivateMemo: false,
      })
      .returning();

    const list = await createList(user.id, { title: "Temp List" });
    await addItemToList(list.id, save.id);

    const deleted = await deleteSave(save.id);
    expect(deleted).toBe(true);

    const check = await getSaveDetails(save.id);
    expect(check).toBeNull();
  });

  it("PATCH and DELETE /api/v1/saves/[id] return 404 cleanly when save does not exist", async () => {
    const { PATCH, DELETE } = await import("@/app/api/v1/saves/[id]/route");
    const { NextRequest } = await import("next/server");

    const nonExistentId = "non-existent-save-id-12345";

    // Test DELETE 404
    const deleteReq = new NextRequest(`http://localhost:3000/api/v1/saves/${nonExistentId}`, {
      method: "DELETE",
    });
    const deleteRes = await DELETE(deleteReq, { params: Promise.resolve({ id: nonExistentId }) });
    expect(deleteRes.status).toBe(404);
    const deleteJson = await deleteRes.json();
    expect(deleteJson.error).toContain("Save not found");

    // Test PATCH 404
    const patchReq = new NextRequest(`http://localhost:3000/api/v1/saves/${nonExistentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privateTitle: "Ghost Update" }),
    });
    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: nonExistentId }) });
    expect(patchRes.status).toBe(404);
    const patchJson = await patchRes.json();
    expect(patchJson.error).toContain("not found");
  });
});
