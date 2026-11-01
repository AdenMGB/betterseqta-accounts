import { authError, authJson, getUser } from "../lib/auth";
import { checkRateLimitKeyed } from "../lib/rate-limit";
import {
  clearUserPfp,
  getPfpHistoryForUser,
  getUserPfpHash,
  saveCurrentPfpToHistory,
} from "../lib/pfpHistory";
import { uploadPfpFromFormData, restagePfpBytes } from "../lib/pfpUploadHandler";
import type { RequestContext } from "../types/context";
import type { Env } from "../types/env";

async function requireUser(ctx: RequestContext) {
  return getUser(ctx.request, ctx.jwtSecret);
}

async function rateLimitUser(env: Env, userId: string, bucket: string, limit: number, windowSec: number) {
  return checkRateLimitKeyed(env, `${bucket}:${userId}`, { limit, windowSec });
}

/** Current user's hosted profile picture metadata (BetterSEQTA+). */
export async function handleBsplusPfpGet(ctx: RequestContext): Promise<Response> {
  const user = await requireUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const row = await ctx.env.DB.prepare("SELECT pfpUrl FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ pfpUrl: string | null }>();
  const pfpHash = await getUserPfpHash(ctx.env, user.id);
  const pfpHistory = await getPfpHistoryForUser(ctx.env, user.id);

  return authJson({
    pfpUrl: row?.pfpUrl ?? null,
    pfpHash,
    pfpHistory,
  });
}

/** Multipart upload — same processing as web `/api/user/pfp`. */
export async function handleBsplusPfpUpload(ctx: RequestContext): Promise<Response> {
  const user = await requireUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "bsplus-pfp-upload", 60, 3600);
  if (limited) return limited;

  try {
    const formData = await ctx.request.formData();
    const result = await uploadPfpFromFormData(ctx.env, user.id, formData);
    if (!result.ok) {
      return authError(result.message, result.status);
    }
    return authJson(result.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return authError(message, 500);
  }
}

export async function handleBsplusPfpHistory(ctx: RequestContext): Promise<Response> {
  const user = await requireUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const pfpHistory = await getPfpHistoryForUser(ctx.env, user.id);
  return authJson({ pfpHistory });
}

export async function handleBsplusPfpClear(ctx: RequestContext): Promise<Response> {
  const user = await requireUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "bsplus-pfp-clear", 30, 3600);
  if (limited) return limited;

  await clearUserPfp(ctx.env, user.id);
  const pfpHistory = await getPfpHistoryForUser(ctx.env, user.id);
  return authJson({ pfpUrl: null, pfpHash: null, pfpHistory });
}

export async function handleBsplusPfpRevert(ctx: RequestContext): Promise<Response> {
  const user = await requireUser(ctx);
  if (!user) return authError("Unauthorized", 401);

  const limited = await rateLimitUser(ctx.env, user.id, "bsplus-pfp-revert", 30, 3600);
  if (limited) return limited;

  const { historyId } = (await ctx.request.json()) as { historyId?: string };
  if (!historyId) {
    return authError("historyId is required", 400);
  }

  const historyRow = await ctx.env.DB.prepare(
    "SELECT id, r2_key FROM pfp_history WHERE id = ? AND user_id = ?",
  )
    .bind(historyId, user.id)
    .first() as { id: string; r2_key: string } | null;

  if (!historyRow) {
    return authError("History entry not found", 404);
  }

  const historyObject = await ctx.env.PFP_BUCKET.get(historyRow.r2_key);
  if (!historyObject) {
    return authError("History image not found in storage", 404);
  }

  await saveCurrentPfpToHistory(ctx.env, user.id);
  const { pfpUrl, pfpHash, pfpHistory } = await restagePfpBytes(
    ctx.env,
    user.id,
    await historyObject.arrayBuffer(),
    { skipArchiveCurrent: true },
  );

  await ctx.env.PFP_BUCKET.delete(historyRow.r2_key);
  await ctx.env.DB.prepare("DELETE FROM pfp_history WHERE id = ?").bind(historyId).run();

  return authJson({ pfpUrl, pfpHash, pfpHistory });
}
