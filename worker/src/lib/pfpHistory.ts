import type { Env } from "../types/env";
import type { PfpAuditRef } from "./auditPfpResolve";

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

export async function hasCurrentPfpBlob(env: Env, userId: string): Promise<boolean> {
  const key = `pfp/${userId}`;
  const current = await env.PFP_BUCKET.get(key);
  return !!current;
}

export async function prunePfpHistory(env: Env, userId: string, maxHistory = 3): Promise<number> {
  try {
    const rows = await env.DB.prepare(
      "SELECT id, r2_key FROM pfp_history WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(userId)
      .all();

    const all = (rows.results || []) as { id: string; r2_key: string }[];
    const toDelete = all.slice(maxHistory);
    for (const row of toDelete) {
      await env.PFP_BUCKET.delete(row.r2_key);
      await env.DB.prepare("DELETE FROM pfp_history WHERE id = ?").bind(row.id).run();
    }
    return toDelete.length;
  } catch {
    return 0;
  }
}

export async function saveCurrentPfpToHistory(env: Env, userId: string): Promise<string | null> {
  const key = `pfp/${userId}`;
  const current = await env.PFP_BUCKET.get(key);
  if (!current) return null;

  const historyId = crypto.randomUUID();
  const historyKey = `pfp/${userId}/hist/${historyId}`;
  await env.PFP_BUCKET.put(historyKey, await current.arrayBuffer(), {
    httpMetadata: current.httpMetadata,
  });
  await env.DB.prepare(
    "INSERT INTO pfp_history (id, user_id, r2_key, created_at) VALUES (?, ?, ?, unixepoch())",
  ).bind(historyId, userId, historyKey).run();
  return historyId;
}

export async function clearUserPfp(
  env: Env,
  userId: string,
): Promise<{ archivedHistoryId: string | null; hadPfp: boolean }> {
  const hadPfp = await hasCurrentPfpBlob(env, userId);
  const hadUrl = await env.DB.prepare("SELECT pfpUrl FROM users WHERE id = ?").bind(userId).first() as
    | { pfpUrl: string | null }
    | null;
  const archivedHistoryId = hadPfp ? await saveCurrentPfpToHistory(env, userId) : null;

  if (hadPfp) {
    await env.PFP_BUCKET.delete(`pfp/${userId}`);
  }

  await env.DB.prepare("UPDATE users SET pfpUrl = NULL WHERE id = ?").bind(userId).run();
  await prunePfpHistory(env, userId);

  return {
    archivedHistoryId,
    hadPfp: hadPfp || !!(hadUrl?.pfpUrl),
  };
}

export function pfpRefFromArchivedHistory(historyId: string | null, hadCurrent: boolean): PfpAuditRef {
  if (historyId) return { slot: "history", historyId };
  if (hadCurrent) return { slot: "current" };
  return { slot: "unavailable" };
}
