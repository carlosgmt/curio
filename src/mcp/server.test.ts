import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createCurioMcpServer } from "./server";
import { db, userSaves, users, smartLists } from "@/db";
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
    expect(data.counts.users).toBeGreaterThanOrEqual(1);
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
});
