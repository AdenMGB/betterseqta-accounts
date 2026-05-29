import type { Env } from "../types/env";

export type PfpHistoryEntry = {
  id: string;
  r2Key: string;
  createdAt: number;
};

export function r2KeyToPfpUrl(r2Key: string): string {
  return r2Key.replace(/^pfp\//, "/api/user/pfp/");
}

export async function getPfpHistoryForUser(
  env: Env,
  userId: string,
  limit = 3,
): Promise<PfpHistoryEntry[]> {
  try {
    const rows = await env.DB.prepare(
      "SELECT id, r2_key, created_at FROM pfp_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    )
      .bind(userId, limit)
      .all();

    return ((rows.results || []) as { id: string; r2_key: string; created_at: number }[]).map(
      (row) => ({
        id: row.id,
        r2Key: r2KeyToPfpUrl(row.r2_key),
        createdAt: row.created_at,
      }),
    );
  } catch {
    return [];
  }
}

export async function prunePfpHistory(env: Env, userId: string, maxHistory = 3): Promise<void> {
  try {
    const rows = await env.DB.prepare(
      "SELECT id, r2_key FROM pfp_history WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(userId)
      .all();

    const all = (rows.results || []) as { id: string; r2_key: string }[];
    for (const row of all.slice(maxHistory)) {
      await env.PFP_BUCKET.delete(row.r2_key);
      await env.DB.prepare("DELETE FROM pfp_history WHERE id = ?").bind(row.id).run();
    }
  } catch {
    // pfp_history table may not exist yet
  }
}

export async function saveCurrentPfpToHistory(env: Env, userId: string): Promise<void> {
  const key = `pfp/${userId}`;
  const current = await env.PFP_BUCKET.get(key);
  if (!current) return;

  const historyId = crypto.randomUUID();
  const historyKey = `pfp/${userId}/hist/${historyId}`;
  await env.PFP_BUCKET.put(historyKey, await current.arrayBuffer(), {
    httpMetadata: current.httpMetadata,
  });
  await env.DB.prepare(
    "INSERT INTO pfp_history (id, user_id, r2_key, created_at) VALUES (?, ?, ?, unixepoch())",
  ).bind(historyId, userId, historyKey).run();
}
