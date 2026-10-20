import { executeClusteringJob } from "@/lib/graph/clustering";

export type JobHandler = (payload: any) => Promise<any>;

const registry = new Map<string, JobHandler>();

// Register default handlers
registry.set("clustering", async (payload: { userId: string }) => {
  return executeClusteringJob(payload.userId);
});

registry.set("test", async (payload: any) => {
  return { processed: true, payload };
});

registry.set("echo", async (payload: any) => {
  return payload;
});

export function registerJobHandler(queueName: string, handler: JobHandler) {
  registry.set(queueName, handler);
}

export async function executeJobPayload(queueName: string, payload: any): Promise<any> {
  const handler = registry.get(queueName);
  if (!handler) {
    // If no specific handler registered, treat as generic success
    return { executed: true, queueName, payload };
  }
  return handler(payload);
}
