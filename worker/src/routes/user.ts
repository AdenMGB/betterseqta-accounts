import { corsHeaders } from "../constants";
import { getUser } from "../lib/auth";
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

    const imgbbForm = new FormData();
    imgbbForm.append("image", file);
    imgbbForm.append("key", env.IMGBB_API_KEY as string);

    const imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: imgbbForm,
    });

    const imgbbData = (await imgbbRes.json()) as { success?: boolean; data?: { url: string } };

    if (!imgbbData.success) {
      console.error("ImgBB Error:", imgbbData);
      return new Response("Failed to upload image to provider", { status: 502, headers: corsHeaders });
    }

    const pfpUrl = imgbbData.data!.url;

    await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(pfpUrl, user.id).run();

    return new Response(JSON.stringify({ pfpUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}
