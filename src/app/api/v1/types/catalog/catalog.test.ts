import { describe, expect, it } from "bun:test";
import { db, users } from "@/db";
import { createSession } from "@/lib/auth/session";
import { NextRequest } from "next/server";
import { GET as GET_CATALOG, POST as POST_CATALOG, DELETE as DELETE_CATALOG } from "./route";
import { GET as GET_EXPORT } from "../[id]/export/route";
import { POST as POST_IMPORT } from "../import/route";

describe("Catalog & Schema Sharing API Routes", () => {
  it("manages catalog installation, export, and schema import via HTTP endpoints", async () => {
    const timestamp = Date.now();
    const [user] = await db
      .insert(users)
      .values({
        email: `catalog-api-${timestamp}@curio.local`,
        username: `catalog_api_${timestamp}`,
        displayName: "Catalog API Tester",
      })
      .returning();

    const { token } = await createSession(user.id);
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // 1. GET /api/v1/types/catalog
    const listReq = new NextRequest("http://localhost:3000/api/v1/types/catalog", {
      headers: authHeaders,
    });
    const listRes = await GET_CATALOG(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.catalog).toBeDefined();
    expect(listData.catalog.length).toBeGreaterThanOrEqual(5);

    const quoteItem = listData.catalog.find((c: any) => c.id === "quote");
    expect(quoteItem).toBeDefined();
    expect(quoteItem.isInstalled).toBe(false);

    // 2. POST /api/v1/types/catalog (install quote)
    const installReq = new NextRequest("http://localhost:3000/api/v1/types/catalog", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: "quote" }),
    });
    const installRes = await POST_CATALOG(installReq);
    expect(installRes.status).toBe(201);
    const installData = await installRes.json();
    expect(installData.success).toBe(true);
    expect(installData.type.typePath).toBe("/quote");
    const installedTypeId = installData.type.id;

    // Verify GET catalog now marks quote as installed
    const verifyListRes = await GET_CATALOG(listReq);
    const verifyListData = await verifyListRes.json();
    const updatedQuote = verifyListData.catalog.find((c: any) => c.id === "quote");
    expect(updatedQuote.isInstalled).toBe(true);
    expect(updatedQuote.installedTypeId).toBe(installedTypeId);

    // 3. GET /api/v1/types/[id]/export
    const exportReq = new NextRequest(`http://localhost:3000/api/v1/types/${installedTypeId}/export`, {
      headers: authHeaders,
    });
    const exportRes = await GET_EXPORT(exportReq, { params: Promise.resolve({ id: installedTypeId }) });
    expect(exportRes.status).toBe(200);
    const exportData = await exportRes.json();
    expect(exportData.success).toBe(true);
    expect(exportData.spec.schemaVersion).toBe("1.0");
    expect(exportData.spec.curioType.name).toBe("Quote");

    // 4. POST /api/v1/types/import
    const importPayload = {
      spec: {
        ...exportData.spec,
        curioType: {
          ...exportData.spec.curioType,
          fields: [
            ...exportData.spec.curioType.fields,
            { key: "contextPill", label: "Context Pill", type: "string" },
          ],
        },
      },
    };
    const importReq = new NextRequest("http://localhost:3000/api/v1/types/import", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(importPayload),
    });
    const importRes = await POST_IMPORT(importReq);
    expect(importRes.status).toBe(201);
    const importData = await importRes.json();
    expect(importData.success).toBe(true);

    // 5. DELETE /api/v1/types/catalog (uninstall quote)
    const deleteReq = new NextRequest("http://localhost:3000/api/v1/types/catalog?typePath=/quote", {
      method: "DELETE",
      headers: authHeaders,
    });
    const deleteRes = await DELETE_CATALOG(deleteReq);
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);

    // Verify GET catalog is now uninstalled
    const finalReq = new NextRequest("http://localhost:3000/api/v1/types/catalog", {
      headers: authHeaders,
    });
    const finalRes = await GET_CATALOG(finalReq);
    const finalData = await finalRes.json();
    const finalQuote = finalData.catalog.find((c: any) => c.id === "quote");
    expect(finalQuote.isInstalled).toBe(false);
  });
});
