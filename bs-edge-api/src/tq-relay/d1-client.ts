import { relayConfig } from "./config.js";

type D1QueryResponse = {
  success: boolean;
  errors?: { message: string }[];
  result?: Array<{ results?: unknown[]; meta?: { changes?: number } }>;
};

export async function d1Run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
  const rows = await d1Query<{ changes?: number }>(sql, params, true);
  const changes = rows[0]?.changes ?? 0;
  return { changes: typeof changes === "number" ? changes : 0 };
}

export async function d1All<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const data = await d1Query<T>(sql, params, false);
  return data;
}

export async function d1First<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await d1All<T>(sql, ...params);
  return rows[0] ?? null;
}

async function d1Query<T>(
  sql: string,
  params: unknown[],
  metaOnly: boolean,
): Promise<T[]> {
  const { accountId, apiToken, databaseId } = relayConfig;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const json = (await res.json()) as D1QueryResponse;
  if (!res.ok || !json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || res.statusText;
    throw new Error(`D1 query failed: ${msg}`);
  }
  const block = json.result?.[0];
  if (metaOnly && block?.meta) {
    return [{ changes: block.meta.changes ?? 0 } as T];
  }
  return (block?.results ?? []) as T[];
}