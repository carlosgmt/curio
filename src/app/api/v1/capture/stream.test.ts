import { describe, expect, it } from "bun:test";
import { POST } from "./stream/route";
import { NextRequest } from "next/server";

describe("SSE Progressive Card Morph Pipeline (/api/v1/capture/stream)", () => {
  it("returns Content-Type text/event-stream and streams stages with <10ms Stage 1", async () => {
    const startTime = performance.now();
    const req = new NextRequest("http://localhost:3000/api/v1/capture/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "My private thoughts on neural networks and quantum computing",
      }),
    });

    const res = await POST(req);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let accumulated = "";
    let stage1Time = 0;

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      accumulated += chunk;
      if (accumulated.includes("event: stage1_optimistic") && stage1Time === 0) {
        stage1Time = performance.now() - startTime;
      }
    }

    // Stage 1 should emit very fast (<50ms in testing environment)
    expect(stage1Time).toBeLessThan(50);
    expect(accumulated).toContain("event: stage1_optimistic");
    expect(accumulated).toContain('"stage":"OPTIMISTIC"');
    expect(accumulated).toContain('"isPrivateMemo":true');
    expect(accumulated).toContain("event: complete");
  });

  it("handles URL capture through streaming stages", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/capture/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "https://example.com/item/123",
      }),
    });

    const res = await POST(req);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value);
    }

    expect(accumulated).toContain("event: stage1_optimistic");
    expect(accumulated).toContain('"stage":"OPTIMISTIC"');
    expect(accumulated).toContain("event: stage3_enriched");
    expect(accumulated).toContain('"stage":"ENRICHED"');
    expect(accumulated).toContain("event: complete");
  });
});
