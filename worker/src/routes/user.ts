import { corsHeaders } from "../constants";
import { getUser } from "../lib/auth";
import { processPfpUpload } from "../lib/pfpProcess";
import {
  buildUserPfpUrl,
  clearUserPfp,
  getPfpHistoryForUser,
  getUserPfpHash,
  prunePfpHistory,
  putCurrentPfp,
  saveCurrentPfpToHistory,
} from "../lib/pfpHistory";
import type { RequestContext } from "../types/context";

function isAccountsHostedPfpUrl(pfpUrl: string): boolean {
  return pfpUrl.includes("/api/user/pfp/") && !pfpUrl.includes("/hist/");
}

export async function handleUserUpdate({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const { displayName, username, pfpUrl } = (await request.json()) as {
      displayName?: string;
      username?: string;
      pfpUrl?: string;
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    if (displayName !== undefined) {
      updates.push("displayName = ?");
      values.push(displayName);
    }
    if (username !== undefined) {
      updates.push("username = ?");
      values.push(username);
    }
    if (pfpUrl !== undefined) {
      updates.push("pfpUrl = ?");
      values.push(pfpUrl);
      if (!pfpUrl || !isAccountsHostedPfpUrl(pfpUrl)) {
        updates.push("pfp_hash = ?");
        values.push(null);
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    values.push(user.id);
    await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleUserPfpHistory({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const pfpHistory = await getPfpHistoryForUser(env, user.id);
  return new Response(JSON.stringify({ pfpHistory }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleUserPfpMeta({ env, url }: RequestContext): Promise<Response> {
  const parts = url.pathname.split("/");
  const userId = parts[parts.length - 2];
  if (!userId || parts[parts.length - 1] !== "meta") {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const pfpHash = await getUserPfpHash(env, userId);
  return new Response(JSON.stringify({ pfpHash }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleUserPfp({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const preCropped = formData.get("preCropped") === "true";

    if (!file || !(file instanceof File)) {
      return new Response("No file uploaded", { status: 400, headers: corsHeaders });
    }

    if (!file.type.startsWith("image/")) {
      return new Response("Invalid file type", { status: 400, headers: corsHeaders });
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response("File too large (max 5MB)", { status: 400, headers: corsHeaders });
    }

    try {
      await saveCurrentPfpToHistory(env, user.id);
    } catch {
      // pfp_history table might not exist yet
    }

    const processed = await processPfpUpload(await file.arrayBuffer(), { preCropped });
    const { pfpUrl, pfpHash } = await putCurrentPfp(env, user.id, processed);

    try {
      await prunePfpHistory(env, user.id);
    } catch {
      // ignore
    }

    const pfpHistory = await getPfpHistoryForUser(env, user.id);

    return new Response(JSON.stringify({ pfpUrl, pfpHash, pfpHistory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleUserPfpRevert({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { historyId } = (await request.json()) as { historyId?: string };
  if (!historyId) {
    return new Response(JSON.stringify({ error: "historyId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const historyRow = await env.DB.prepare(
    "SELECT id, r2_key FROM pfp_history WHERE id = ? AND user_id = ?",
  ).bind(historyId, user.id).first() as { id: string; r2_key: string } | null;

  if (!historyRow) {
    return new Response(JSON.stringify({ error: "History entry not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const historyObject = await env.PFP_BUCKET.get(historyRow.r2_key);
  if (!historyObject) {
    return new Response(JSON.stringify({ error: "History image not found in storage" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await saveCurrentPfpToHistory(env, user.id);
  const processed = await processPfpUpload(await historyObject.arrayBuffer());
  const { pfpUrl, pfpHash } = await putCurrentPfp(env, user.id, processed);

  await env.PFP_BUCKET.delete(historyRow.r2_key);
  await env.DB.prepare("DELETE FROM pfp_history WHERE id = ?").bind(historyId).run();
  await prunePfpHistory(env, user.id);

  const pfpHistory = await getPfpHistoryForUser(env, user.id);

  return new Response(JSON.stringify({ pfpUrl, pfpHash, pfpHistory }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleUserPfpClear({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  await clearUserPfp(env, user.id);
  const pfpHistory = await getPfpHistoryForUser(env, user.id);

  return new Response(JSON.stringify({ pfpUrl: null, pfpHash: null, pfpHistory }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleUserPfpGet({ env, url, request }: RequestContext): Promise<Response> {
  const pathname = url.pathname;
  if (pathname.endsWith("/meta")) {
    return handleUserPfpMeta({ env, url, request } as RequestContext);
  }

  const r2Key = pathname.replace(/^\/api\/user\/pfp\//, "pfp/");
  if (!r2Key || r2Key === "pfp/" || r2Key.endsWith("/meta")) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const isHistory = r2Key.includes("/hist/");
  let pfpHash: string | null = null;
  if (!isHistory) {
    const userId = r2Key.replace(/^pfp\//, "");
    pfpHash = await getUserPfpHash(env, userId);
    const ifNoneMatch = request.headers.get("If-None-Match");
    if (pfpHash && ifNoneMatch && (ifNoneMatch === `"${pfpHash}"` || ifNoneMatch === pfpHash)) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          ETag: `"${pfpHash}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const object = await env.PFP_BUCKET.get(r2Key);

  if (!object) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/jpeg");
  headers.set(
    "Cache-Control",
    isHistory ? "private, max-age=31536000, immutable" : "public, max-age=31536000, immutable",
  );
  if (pfpHash) {
    headers.set("ETag", `"${pfpHash}"`);
    headers.set("X-Pfp-Hash", pfpHash);
  } else {
    headers.set("ETag", object.etag);
  }

  return new Response(object.body, { headers });
}
