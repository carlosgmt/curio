import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { eq } from "drizzle-orm";
import { createCurioMcpServer } from "./server";
import { db, sqlite, userSaves, users, smartLists } from "@/db";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

describe("Curio Model Context Protocol (MCP) Server", () => {
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createCurioMcpServer();
    await server.connect(serverTransport);

    client = new Client({ name: "test-gemini-agent", version: "1.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists all 4 operator taste tools", async () => {
    const res = await client.listTools();
    const toolNames = res.tools.map((t) => t.name);

    expect(toolNames).toContain("curio_capture_item");
    expect(toolNames).toContain("curio_search_taste");
    expect(toolNames).toContain("curio_get_telemetry");
    expect(toolNames).toContain("curio_list_boards");
  });

  it("curio_get_telemetry returns valid system metrics", async () => {
    const res = (await client.callTool({
      name: "curio_get_telemetry",
      arguments: { detailed: false },
    })) as any;

    expect(res.content).toBeDefined();
    expect(res.content[0].type).toBe("text");

    const data = JSON.parse(res.content[0].text);
    expect(data.storage.journalMode.toLowerCase()).toBe("wal");
    expect(data.counts.users).toBeGreaterThanOrEqual(0);
    expect(data.cacheEfficiency).toBeDefined();
    expect(data.ollama).toBeDefined();
  });

  it("curio_capture_item isolates private memos without external scraping", async () => {
    const res = (await client.callTool({
      name: "curio_capture_item",
      arguments: {
        content: "Top secret coffee recipe and roasting curves",
        title: "Secret Roasting Notes",
        isPrivateMemo: true,
        tags: ["coffee", "secret"],
      },
    })) as any;

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(res.content[0].text);

    expect(data.success).toBe(true);
    expect(data.isPrivateMemo).toBe(true);
    expect(data.status).toBe("LOCAL_ONLY");
    expect(data.title).toBe("Secret Roasting Notes");
    expect(data.typePath).toBe("/memo");
  });

  it("curio_search_taste filters out private memos by default and includes when requested", async () => {
    const user = await getOrCreateDefaultUser();

    // Insert public item
    await client.callTool({
      name: "curio_capture_item",
      arguments: {
        content: "https://example.com/tokyo-natural-wine",
        title: "Tokyo Natural Wine Bar",
        isPrivateMemo: false,
        tags: ["wine", "tokyo"],
      },
    });

    // 1. Search without includePrivate (default: false)
    const publicRes = (await client.callTool({
      name: "curio_search_taste",
      arguments: {
        query: "coffee roasting recipe",
        includePrivate: false,
      },
    })) as any;

    const publicData = JSON.parse(publicRes.content[0].text);
    const hasSecretMemo = publicData.items.some(
      (item: any) => item.title === "Secret Roasting Notes"
    );
    expect(hasSecretMemo).toBe(false);

    // 2. Search with includePrivate: true
    const privateRes = (await client.callTool({
      name: "curio_search_taste",
      arguments: {
        query: "coffee roasting recipe",
        includePrivate: true,
      },
    })) as any;

    const privateData = JSON.parse(privateRes.content[0].text);
    const hasFoundSecret = privateData.items.some(
      (item: any) => item.title === "Secret Roasting Notes"
    );
    expect(hasFoundSecret).toBe(true);
  });

  it("curio_list_boards returns user boards with counts", async () => {
    const user = await getOrCreateDefaultUser();

    // Ensure at least one test board exists
    const rand = Math.random().toString(36).substring(7);
    await db.insert(smartLists).values({
      userId: user.id,
      title: `Board ${rand}`,
      slug: `board-${rand}`,
      visibility: "PUBLIC",
    });

    const res = (await client.callTool({
      name: "curio_list_boards",
      arguments: { visibility: "ALL" },
    })) as any;

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(res.content[0].text);
    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.boards)).toBe(true);

    const found = data.boards.find((b: any) => b.title === `Board ${rand}`);
    expect(found).toBeDefined();
    expect(found.visibility).toBe("PUBLIC");
    expect(typeof found.itemCount).toBe("number");
  });

  it("enforces Modular MCP domain scopes in curio_search_taste and curio_list_boards", async () => {
    const { setUserMcpScopes, getUserMcpScopes } = await import("@/lib/mcp/scopes");
    const rand = Math.random().toString(36).slice(2, 8);
    const { userSaves: savesTbl, globalEntities: entitiesTbl, smartLists: listsTbl } = await import(
      "@/db"
    );

    const defaultUser = await getOrCreateDefaultUser();
    const bookTitle = `Viridian Archive ${rand}`;
    const recipeTitle = `ViridianGazpacho ${rand}`;
    const hiddenBoardId = `mcp_scope_board_${rand}`;
    const hiddenSlug = `recipes-${rand}`;

    const prevConfig = getUserMcpScopes(defaultUser.id);
    const createdSaveIds: string[] = [];
    const createdEntityIds: string[] = [];
    try {
      const capBook = (await client.callTool({
        name: "curio_capture_item",
        arguments: {
          content: `https://example.org/book-${rand}`,
          title: bookTitle,
          typePath: "/product/book",
          isPrivateMemo: false,
        },
      })) as any;
      const capBookJson = JSON.parse(capBook.content[0].text);
      if (capBookJson.saveId) createdSaveIds.push(capBookJson.saveId);
      if (capBookJson.entityId) createdEntityIds.push(capBookJson.entityId);

      const capRecipe = (await client.callTool({
        name: "curio_capture_item",
        arguments: {
          content: `https://example.org/recipe-${rand}`,
          title: recipeTitle,
          typePath: "/culinary/recipe",
          isPrivateMemo: false,
        },
      })) as any;
      const capRecipeJson = JSON.parse(capRecipe.content[0].text);
      if (capRecipeJson.saveId) createdSaveIds.push(capRecipeJson.saveId);
      if (capRecipeJson.entityId) createdEntityIds.push(capRecipeJson.entityId);

      await db.insert(listsTbl).values({
        id: hiddenBoardId,
        userId: defaultUser.id,
        title: `Recipes Secret ${rand}`,
        slug: hiddenSlug,
        visibility: "PRIVATE",
      });

      // Seal `recipes` while keeping `books` open
      setUserMcpScopes(defaultUser.id, { books: true, recipes: false });

      const searchRes = (await client.callTool({
        name: "curio_search_taste",
        arguments: { query: recipeTitle, includePrivate: false },
      })) as any;
      const searchData = JSON.parse(searchRes.content[0].text);
      const returnedTitles = (searchData.items || []).map((r: any) => r.title);
      expect(returnedTitles).not.toContain(recipeTitle);

      const openBookRes = (await client.callTool({
        name: "curio_search_taste",
        arguments: { query: bookTitle, includePrivate: false },
      })) as any;
      const openBookData = JSON.parse(openBookRes.content[0].text);
      const openBookTitles = (openBookData.items || []).map((r: any) => r.title);
      expect(openBookTitles).toContain(bookTitle);

      const boardsRes = (await client.callTool({
        name: "curio_list_boards",
        arguments: { visibility: "ALL" },
      })) as any;
      const boardsData = JSON.parse(boardsRes.content[0].text);
      const slugs = (boardsData.boards || []).map((b: any) => b.slug);
      expect(slugs).not.toContain(hiddenSlug);
    } finally {
      if (prevConfig.isConfigured) {
        setUserMcpScopes(defaultUser.id, prevConfig.scopes);
      } else {
        sqlite.prepare("DELETE FROM user_mcp_scopes WHERE user_id = ?").run(defaultUser.id);
      }
      await db.delete(listsTbl).where(eq(listsTbl.id, hiddenBoardId));
      for (const sid of createdSaveIds) {
        await db.delete(savesTbl).where(eq(savesTbl.id, sid));
      }
      for (const eid of createdEntityIds) {
        await db.delete(entitiesTbl).where(eq(entitiesTbl.id, eid));
      }
    }
  });
});
