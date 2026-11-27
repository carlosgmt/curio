import { sqlite } from "@/db";
import {
  DEFAULT_MCP_SCOPES,
  MCP_DOMAIN_DEFS,
  resolveBoardMcpDomain,
  resolveItemMcpDomain,
  type McpDomainId,
  type McpDomainMeta,
  type McpScopeMap,
} from "./scopeDefs";

export {
  DEFAULT_MCP_SCOPES,
  MCP_DOMAIN_DEFS,
  resolveBoardMcpDomain,
  resolveItemMcpDomain,
  type McpDomainId,
  type McpDomainMeta,
  type McpScopeMap,
};

let tableReady = false;
function ensureMcpScopesTable() {
  if (tableReady) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_mcp_scopes (
      user_id TEXT PRIMARY KEY,
      scopes_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  tableReady = true;
}

export function getUserMcpScopes(userId: string): {
  scopes: McpScopeMap;
  isConfigured: boolean;
} {
  ensureMcpScopesTable();
  const row = sqlite
    .prepare("SELECT scopes_json FROM user_mcp_scopes WHERE user_id = ?")
    .get(userId) as { scopes_json: string } | undefined;

  if (!row) {
    return { scopes: { ...DEFAULT_MCP_SCOPES }, isConfigured: false };
  }

  try {
    const parsed = JSON.parse(row.scopes_json) as Partial<McpScopeMap>;
    const merged: McpScopeMap = { ...DEFAULT_MCP_SCOPES };
    for (const def of MCP_DOMAIN_DEFS) {
      if (typeof parsed[def.id] === "boolean") {
        merged[def.id] = Boolean(parsed[def.id]);
      }
    }
    return { scopes: merged, isConfigured: true };
  } catch {
    return { scopes: { ...DEFAULT_MCP_SCOPES }, isConfigured: false };
  }
}

export function setUserMcpScopes(
  userId: string,
  partial: Partial<Record<string, boolean>>
): McpScopeMap {
  ensureMcpScopesTable();
  const current = getUserMcpScopes(userId).scopes;
  const next: McpScopeMap = { ...current };
  for (const def of MCP_DOMAIN_DEFS) {
    if (typeof partial[def.id] === "boolean") {
      next[def.id] = Boolean(partial[def.id]);
    }
  }
  sqlite
    .prepare(
      `INSERT INTO user_mcp_scopes (user_id, scopes_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         scopes_json = excluded.scopes_json,
         updated_at = excluded.updated_at`
    )
    .run(userId, JSON.stringify(next), new Date().toISOString());

  return next;
}
