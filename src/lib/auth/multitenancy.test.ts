import { describe, expect, it } from "bun:test";
import { db, users, userSaves, globalEntities, smartLists } from "@/db";
import { createSession } from "@/lib/auth/session";
import { createList } from "@/lib/lists/service";
import { registerCustomType } from "@/lib/types/service";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

describe("Tenant Data Isolation & Multi-Tenancy Engine", () => {
  it("strictly isolates user saves from cross-tenant inspection and mutation", async () => {
    const { GET: getSave, PATCH: patchSave, DELETE: deleteSave } = await import(
      "@/app/api/v1/saves/[id]/route"
    );
    const { POST: postCustomFields, GET: getCustomFields } = await import(
      "@/app/api/v1/saves/[id]/custom-fields/route"
    );

    const ts = Date.now();

    // 1. Create User A
    const [userA] = await db
      .insert(users)
      .values({
        email: `usera-${ts}@curio.local`,
        username: `usera_${ts}`,
        displayName: "User Alpha",
      })
      .returning();
    const sessionA = await createSession(userA.id);

    // 2. Create User B
    const [userB] = await db
      .insert(users)
      .values({
        email: `userb-${ts}@curio.local`,
        username: `userb_${ts}`,
        displayName: "User Beta",
      })
      .returning();
    const sessionB = await createSession(userB.id);

    // 3. User A creates a personal save
    const [saveA] = await db
      .insert(userSaves)
      .values({
        userId: userA.id,
        isPrivateMemo: true,
        privateTitle: "Alpha Private Secret Note",
        personalNotes: "Top secret thought",
      })
      .returning();

    // User A accesses their own save -> 200 OK
    const getOwnReq = new NextRequest(`http://localhost:3000/api/v1/saves/${saveA.id}`, {
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const getOwnRes = await getSave(getOwnReq, { params: Promise.resolve({ id: saveA.id }) });
    expect(getOwnRes.status).toBe(200);

    // User B attempts to read User A's save -> 403 Forbidden
    const getBReq = new NextRequest(`http://localhost:3000/api/v1/saves/${saveA.id}`, {
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const getBRes = await getSave(getBReq, { params: Promise.resolve({ id: saveA.id }) });
    expect(getBRes.status).toBe(403);
    const getBJson = await getBRes.json();
    expect(getBJson.error).toContain("Forbidden");

    // User B attempts to update User A's save -> 403 Forbidden
    const patchBReq = new NextRequest(`http://localhost:3000/api/v1/saves/${saveA.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionB.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ privateTitle: "Hacked Title" }),
    });
    const patchBRes = await patchSave(patchBReq, { params: Promise.resolve({ id: saveA.id }) });
    expect(patchBRes.status).toBe(403);

    // User B attempts to mutate custom attributes on User A's save -> 403 Forbidden
    const postCustomReq = new NextRequest(
      `http://localhost:3000/api/v1/saves/${saveA.id}/custom-fields`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionB.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customValues: { rating: 5 } }),
      }
    );
    const postCustomRes = await postCustomFields(postCustomReq, {
      params: Promise.resolve({ id: saveA.id }),
    });
    expect(postCustomRes.status).toBe(403);

    // User B attempts to read custom attributes on User A's save -> 403 Forbidden
    const getCustomReq = new NextRequest(
      `http://localhost:3000/api/v1/saves/${saveA.id}/custom-fields`,
      {
        headers: { Authorization: `Bearer ${sessionB.token}` },
      }
    );
    const getCustomRes = await getCustomFields(getCustomReq, {
      params: Promise.resolve({ id: saveA.id }),
    });
    expect(getCustomRes.status).toBe(403);

    // User B attempts to delete User A's save -> 403 Forbidden
    const deleteBReq = new NextRequest(`http://localhost:3000/api/v1/saves/${saveA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const deleteBRes = await deleteSave(deleteBReq, { params: Promise.resolve({ id: saveA.id }) });
    expect(deleteBRes.status).toBe(403);

    // Save should still exist unchanged
    const [checkSave] = await db.select().from(userSaves).where(eq(userSaves.id, saveA.id));
    expect(checkSave.privateTitle).toBe("Alpha Private Secret Note");
  });

  it("strictly isolates private Smart Lists from cross-tenant access and mutation", async () => {
    const { GET: getList } = await import("@/app/api/v1/lists/[slug]/route");
    const { POST: addItem, DELETE: removeItem } = await import(
      "@/app/api/v1/lists/[slug]/items/route"
    );
    const { PUT: reorderList } = await import("@/app/api/v1/lists/[slug]/reorder/route");

    const ts = Date.now();

    // User A & User B
    const [userA] = await db
      .insert(users)
      .values({
        email: `list-usera-${ts}@curio.local`,
        username: `list_usera_${ts}`,
      })
      .returning();
    const sessionA = await createSession(userA.id);

    const [userB] = await db
      .insert(users)
      .values({
        email: `list-userb-${ts}@curio.local`,
        username: `list_userb_${ts}`,
      })
      .returning();
    const sessionB = await createSession(userB.id);

    // User A creates a PRIVATE Smart List
    const privateList = await createList(userA.id, {
      title: "Confidential Strategy Board",
      visibility: "PRIVATE",
    });

    // User A views own list -> 200 OK
    const getOwnReq = new NextRequest(`http://localhost:3000/api/v1/lists/${privateList.slug}`, {
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const getOwnRes = await getList(getOwnReq, {
      params: Promise.resolve({ slug: privateList.slug }),
    });
    expect(getOwnRes.status).toBe(200);

    // User B attempts to view User A's private list -> 403 Forbidden
    const getBReq = new NextRequest(`http://localhost:3000/api/v1/lists/${privateList.slug}`, {
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const getBRes = await getList(getBReq, {
      params: Promise.resolve({ slug: privateList.slug }),
    });
    expect(getBRes.status).toBe(403);

    // User B attempts to inject an item into User A's list -> 403 Forbidden
    const addBReq = new NextRequest(`http://localhost:3000/api/v1/lists/${privateList.slug}/items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionB.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ saveId: "some-save-id" }),
    });
    const addBRes = await addItem(addBReq, {
      params: Promise.resolve({ slug: privateList.slug }),
    });
    expect(addBRes.status).toBe(403);

    // User B attempts to reorder User A's list -> 403 Forbidden
    const reorderBReq = new NextRequest(
      `http://localhost:3000/api/v1/lists/${privateList.slug}/reorder`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${sessionB.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemsOrder: [] }),
      }
    );
    const reorderBRes = await reorderList(reorderBReq, {
      params: Promise.resolve({ slug: privateList.slug }),
    });
    expect(reorderBRes.status).toBe(403);

    // User B attempts to remove an item from User A's list -> 403 Forbidden
    const removeBReq = new NextRequest(
      `http://localhost:3000/api/v1/lists/${privateList.slug}/items?saveId=some-save-id`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionB.token}` },
      }
    );
    const removeBRes = await removeItem(removeBReq, {
      params: Promise.resolve({ slug: privateList.slug }),
    });
    expect(removeBRes.status).toBe(403);
  });

  it("strictly scopes GET /api/v1/capture feed so tenants never see foreign saves", async () => {
    const { GET: getCapture } = await import("@/app/api/v1/capture/route");

    const ts = Date.now();

    const [userA] = await db
      .insert(users)
      .values({ email: `feed-a-${ts}@curio.local`, username: `feed_a_${ts}` })
      .returning();
    const sessionA = await createSession(userA.id);

    const [userB] = await db
      .insert(users)
      .values({ email: `feed-b-${ts}@curio.local`, username: `feed_b_${ts}` })
      .returning();
    const sessionB = await createSession(userB.id);

    // User A has 3 saves
    await db.insert(userSaves).values([
      { userId: userA.id, privateTitle: "Alpha Save 1", isPrivateMemo: true },
      { userId: userA.id, privateTitle: "Alpha Save 2", isPrivateMemo: true },
      { userId: userA.id, privateTitle: "Alpha Save 3", isPrivateMemo: true },
    ]);

    // User B has 2 saves
    await db.insert(userSaves).values([
      { userId: userB.id, privateTitle: "Beta Save 1", isPrivateMemo: true },
      { userId: userB.id, privateTitle: "Beta Save 2", isPrivateMemo: true },
    ]);

    // Query feed for User A
    const reqA = new NextRequest("http://localhost:3000/api/v1/capture", {
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const resA = await getCapture(reqA);
    const dataA = await resA.json();
    expect(dataA.totalCount).toBe(3);
    expect(dataA.saves.length).toBe(3);
    expect(dataA.saves.every((s: any) => s.save.userId === userA.id)).toBe(true);

    // Query feed for User B
    const reqB = new NextRequest("http://localhost:3000/api/v1/capture", {
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const resB = await getCapture(reqB);
    const dataB = await resB.json();
    expect(dataB.totalCount).toBe(2);
    expect(dataB.saves.length).toBe(2);
    expect(dataB.saves.every((s: any) => s.save.userId === userB.id)).toBe(true);
  });

  it("strictly scopes custom Curio types and protects foreign type deletion", async () => {
    const { GET: getTypes } = await import("@/app/api/v1/types/route");
    const { DELETE: deleteType } = await import("@/app/api/v1/types/[id]/route");

    const ts = Date.now();

    const [userA] = await db
      .insert(users)
      .values({ email: `type-a-${ts}@curio.local`, username: `type_a_${ts}` })
      .returning();
    const sessionA = await createSession(userA.id);

    const [userB] = await db
      .insert(users)
      .values({ email: `type-b-${ts}@curio.local`, username: `type_b_${ts}` })
      .returning();
    const sessionB = await createSession(userB.id);

    // User A registers custom specialized subtype
    const typeA = await registerCustomType(userA.id, {
      name: `Vintage Watch ${ts}`,
      parentTypePath: "/product/watch",
      fields: [{ key: "movement", label: "Movement", type: "string" }],
    });

    // User A sees their custom type
    const reqA = new NextRequest("http://localhost:3000/api/v1/types", {
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const resA = await getTypes(reqA);
    const dataA = await resA.json();
    expect(dataA.types.some((t: any) => t.id === typeA.id)).toBe(true);

    // User B does NOT see User A's custom type
    const reqB = new NextRequest("http://localhost:3000/api/v1/types", {
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const resB = await getTypes(reqB);
    const dataB = await resB.json();
    expect(dataB.types.some((t: any) => t.id === typeA.id)).toBe(false);

    // User B attempts to delete User A's custom type -> 403 Forbidden
    const delBReq = new NextRequest(`http://localhost:3000/api/v1/types/${typeA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionB.token}` },
    });
    const delBRes = await deleteType(delBReq, { params: Promise.resolve({ id: typeA.id }) });
    expect(delBRes.status).toBe(403);

    // User A deletes their own custom type -> 200 OK
    const delAReq = new NextRequest(`http://localhost:3000/api/v1/types/${typeA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionA.token}` },
    });
    const delARes = await deleteType(delAReq, { params: Promise.resolve({ id: typeA.id }) });
    expect(delARes.status).toBe(200);
  });
});
