import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

export async function GET(req?: NextRequest) {
  const isDeep = req?.nextUrl?.searchParams?.get("deep") === "true";

  if (!isDeep) {
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // 1. Database test query
    const dbTest = sqlite.prepare("SELECT 1 as alive").get() as { alive: number } | undefined;
    if (!dbTest || dbTest.alive !== 1) {
      throw new Error("Database query failed");
    }

    // 2. WAL mode validation
    const journalMode = (sqlite.pragma("journal_mode", { simple: true }) as string) || "";
    const isWal = journalMode.toLowerCase() === "wal";

    // 3. Ollama reachability check
    let ollamaStatus: "online" | "degraded" = "degraded";
    const ollamaRawUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const ollamaBase = ollamaRawUrl.replace(/\/+$/, "").replace(/\/v1$/, "");

    try {
      const res = await fetch(`${ollamaBase}/api/tags`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) {
        ollamaStatus = "online";
      }
    } catch {
      ollamaStatus = "degraded";
    }

    return NextResponse.json({
      status: "healthy",
      database: "ok",
      walMode: isWal,
      ollama: ollamaStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "error",
        error: err.message || "Deep health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
