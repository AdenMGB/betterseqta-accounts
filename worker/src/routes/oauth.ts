import { SignJWT } from "jose";
import { corsHeaders, APP_REFRESH_EXPIRY_DAYS } from "../constants";
import { getUser, createAccessToken } from "../lib/auth";
import { touchDesqtaReservedClient } from "../lib/desqta-client";
import { createSession } from "../lib/session";
import type { RequestContext } from "../types/context";

export async function handleOAuthClient({ env, url }: RequestContext): Promise<Response> {
  const clientId = url.searchParams.get("client_id");
  if (!clientId) return new Response("Missing client_id", { status: 400, headers: corsHeaders });

  const client = await env.DB.prepare("SELECT name, redirect_uri FROM oauth_clients WHERE id = ?").bind(clientId).first();
  if (client) {
    return new Response(JSON.stringify(client), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reserved = await env.DB.prepare("SELECT id, redirect_uri, expires_at FROM desqta_reserved_clients WHERE id = ?")
    .bind(clientId)
    .first();
  if (reserved) {
    const now = Math.floor(Date.now() / 1000);
    const expAt = reserved.expires_at as number | null;
    if (expAt != null && expAt < now) {
      return new Response("Invalid Client", { status: 404, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ name: "BetterSEQTA+", redirect_uri: reserved.redirect_uri }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Invalid Client", { status: 404, headers: corsHeaders });
}

export async function handleOAuthApprove({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const user = await getUser(request, jwtSecret);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, redirect_uri } = (await request.json()) as { client_id?: string; redirect_uri?: string };

    const client = await env.DB.prepare("SELECT id FROM oauth_clients WHERE id = ? AND redirect_uri = ?")
      .bind(client_id, redirect_uri)
      .first();

    if (client) {
      const code = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + 600;

      await env.DB.prepare("INSERT INTO oauth_codes (code, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)")
        .bind(code, client_id, user.id, expiresAt)
        .run();

      const redirectUrl = new URL(redirect_uri!);
      redirectUrl.searchParams.set("code", code);

      return new Response(JSON.stringify({ redirectUrl: redirectUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reserved = await env.DB.prepare(
      "SELECT id, redirect_uri, expires_at FROM desqta_reserved_clients WHERE id = ? AND redirect_uri = ?",
    )
      .bind(client_id, redirect_uri)
      .first();
    if (reserved) {
      const now = Math.floor(Date.now() / 1000);
      const expAtR = reserved.expires_at as number | null;
      if (expAtR != null && expAtR < now) {
        return new Response(JSON.stringify({ error: "Client expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await touchDesqtaReservedClient(env, client_id!);

      const fullUser = await env.DB.prepare(
        "SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?",
      )
        .bind(user.id)
        .first();
      if (!fullUser) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = await createAccessToken(fullUser as { id: string; email?: string | null; username?: string | null }, jwtSecret);
      const platform = redirect_uri!.startsWith("desqta://") ? "desqta" : "bsplus";
      const session = await createSession(env, {
        userId: (fullUser as { id: string }).id,
        platform,
        clientId: client_id!,
        deviceName: "BetterSEQTA Plus",
        request,
        refreshDays: APP_REFRESH_EXPIRY_DAYS,
      });

      const callbackUrl = new URL(redirect_uri!);
      callbackUrl.searchParams.set("token", accessToken);
      callbackUrl.searchParams.set("refresh_token", session.refreshToken);
      callbackUrl.searchParams.set("user_id", (fullUser as { id: string }).id);

      return new Response(JSON.stringify({ redirectUrl: callbackUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid Client or Redirect URI" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("OAuth approve error:", err);
    return new Response(JSON.stringify({ error: "Authorization failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleOAuthToken({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const { code, client_id, client_secret } = (await request.json()) as {
    code?: string;
    client_id?: string;
    client_secret?: string;
  };

  const client = await env.DB.prepare("SELECT id FROM oauth_clients WHERE id = ? AND secret = ?")
    .bind(client_id, client_secret)
    .first();
  if (!client) {
    return new Response(JSON.stringify({ error: "invalid_client" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const oauthCode = await env.DB.prepare("SELECT user_id, expires_at FROM oauth_codes WHERE code = ? AND client_id = ?")
    .bind(code, client_id)
    .first();
  if (!oauthCode) {
    return new Response(JSON.stringify({ error: "invalid_grant" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((oauthCode.expires_at as number) < Math.floor(Date.now() / 1000)) {
    return new Response(JSON.stringify({ error: "code_expired" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await env.DB.prepare("DELETE FROM oauth_codes WHERE code = ?").bind(code).run();

  const user = await env.DB.prepare("SELECT id, email, username FROM users WHERE id = ?")
    .bind(oauthCode.user_id as string)
    .first();

  const access_token = await new SignJWT({
    id: (user as { id: string }).id,
    email: (user as { email: string }).email,
    username: (user as { username: string }).username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(jwtSecret);

  return new Response(
    JSON.stringify({
      access_token,
      token_type: "Bearer",
      expires_in: 3600,
      user: { id: (user as { id: string }).id, username: (user as { username: string }).username },
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleOAuthUserinfo({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const userData = await env.DB.prepare(
    "SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?",
  )
    .bind(user.id)
    .first();
  return new Response(JSON.stringify(userData), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
