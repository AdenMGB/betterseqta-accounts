import { corsHeaders } from "../constants";
import { getUser } from "../lib/auth";
import { prunePfpHistory, saveCurrentPfpToHistory } from "../lib/pfpHistory";
import type { RequestContext } from "../types/context";

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

export async function handleUserPfp({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response("No file uploaded", { status: 400, headers: corsHeaders });
    }

    if (!file.type.startsWith("image/")) {
      return new Response("Invalid file type", { status: 400, headers: corsHeaders });
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response("File too large (max 5MB)", { status: 400, headers: corsHeaders });
    }

    const key = `pfp/${user.id}`;

    try {
      await saveCurrentPfpToHistory(env, user.id);
    } catch {
      // pfp_history table might not exist yet (migration not run) — ignore
    }

    await env.PFP_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    try {
      await prunePfpHistory(env, user.id);
    } catch {
      // pfp_history table might not exist yet — ignore
    }

    const pfpUrl = `/api/user/pfp/${user.id}`;

    await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(pfpUrl, user.id).run();

    return new Response(JSON.stringify({ pfpUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleUserPfpGet({ env, url }: RequestContext): Promise<Response> {
  // Path: /api/user/pfp/{userId} or /api/user/pfp/{userId}/hist/{historyId}
  // Map to R2 key: pfp/{userId} or pfp/{userId}/hist/{historyId}
  const r2Key = url.pathname.replace(/^\/api\/user\/pfp\//, "pfp/");
  if (!r2Key || r2Key === "pfp/") {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const object = await env.PFP_BUCKET.get(r2Key);

  if (!object) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", object.httpMetadata?.contentType || "image/png");
  headers.set("Cache-Control", "private, max-age=86400");
  headers.set("ETag", object.etag);

  return new Response(object.body, { headers });
}
