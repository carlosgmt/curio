import {
  getAdapterSyncCacheEntry,
  runSyncAdapter,
  type SyncAdapter,
  type SyncOptions,
  type SyncRunResult,
} from "./engine";

const registry = new Map<string, SyncAdapter<any>>();

export function registerSyncAdapter<TOptions extends SyncOptions>(
  adapter: SyncAdapter<TOptions>
): SyncAdapter<TOptions> {
  registry.set(adapter.sourceId, adapter);
  return adapter;
}

export function getSyncAdapter(sourceId: string): SyncAdapter<any> | undefined {
  return registry.get(sourceId);
}

export function listSyncAdapters(): SyncAdapter<any>[] {
  return [...registry.values()];
}

export async function runRegisteredSync(
  userId: string,
  sourceId: string,
  options?: SyncOptions
): Promise<SyncRunResult> {
  const adapter = registry.get(sourceId);
  if (!adapter) {
    throw new Error(`Unknown sync adapter: ${sourceId}`);
  }
  return runSyncAdapter(userId, adapter, options);
}

export async function listAllSyncStatuses(userId: string): Promise<
  Array<{
    sourceId: string;
    displayName: string;
    supportsWishlistPromotion: boolean;
    supportsPruning: boolean;
    cache: ReturnType<typeof getAdapterSyncCacheEntry>;
    status: Record<string, unknown>;
  }>
> {
  const adapters = listSyncAdapters();
  const out = [];
  for (const adapter of adapters) {
    const status = adapter.getStatus ? await adapter.getStatus(userId) : {};
    out.push({
      sourceId: adapter.sourceId,
      displayName: adapter.displayName,
      supportsWishlistPromotion: Boolean(adapter.supportsWishlistPromotion),
      supportsPruning: Boolean(adapter.supportsPruning),
      cache: getAdapterSyncCacheEntry(adapter.sourceId, userId),
      status,
    });
  }
  return out;
}
