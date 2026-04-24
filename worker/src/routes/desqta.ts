import { corsHeaders, WEBSITE_ACCESS_EXPIRES_IN, DESQTA_CLIENT_TTL_DAYS, APP_REFRESH_EXPIRY_DAYS } from "../constants";
import { authJson, authError, createAccessToken } from "../lib/auth";
import { getDesqtaClient, validateDesqtaClient, touchDesqtaReservedClient } from "../lib/desqta-client";
import bcrypt from "bcryptjs";
import { createSession, getSessionByRefreshToken, touchUserSession, revokeSessionById } from "../lib/session";
import type { RequestContext } from "../types/context";

export async function handleDesqtaReserve({ env, request }: RequestContext): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as { redirect_uri?: string };
    const redirectUri = body?.redirect_uri || "desqta://auth/callback";
    if (typeof redirectUri !== "string" || !redirectUri.trim()) {
      return new Response(JSON.stringify({ error: "redirect_uri must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clientId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + DESQTA_CLIENT_TTL_DAYS * 24 * 60 * 60;
    await env.DB.prepare("INSERT INTO desqta_reserved_clients (id, redirect_uri, expires_at) VALUES (?, ?, ?)")
      .bind(clientId, redirectUri.trim(), expiresAt)
      .run();

    const baseUrl = env.APP_URL || "https://accounts.betterseqta.org";
    return new Response(
      JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri.trim(),
        api_url: baseUrl,
        config_url: `${baseUrl}/api/desqta/config`,
        refresh_url: `${baseUrl}/api/desqta/refresh`,
        login_url: `${baseUrl}/api/desqta/login`,
        discord_auth_url: `${baseUrl}/api/oauth/desqta/discord`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Desqta reserve client error:", err);
    return new Response(JSON.stringify({ error: "Failed to reserve client" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleDesqtaConfig({ env, url }: RequestContext): Promise<Response> {
  const clientId = url.searchParams.get("client_id");
  if (!clientId) {
    return new Response(JSON.stringify({ error: "Missing client_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const client = await getDesqtaClient(env, clientId);
  if (!client.valid) {
    return new Response(JSON.stringify({ error: "Invalid client_id" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  await touchDesqtaReservedClient(env, clientId);
  const baseUrl = env.APP_URL || "https://accounts.betterseqta.org";
  return new Response(
    JSON.stringify({
      client_id: clientId,
      api_url: baseUrl,
      refresh_url: `${baseUrl}/api/desqta/refresh`,
      discord_auth_url: `${baseUrl}/api/oauth/desqta/discord`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleDesqtaRefresh({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const body = (await request.json()) as { refresh_token?: string; client_id?: string };
    const { refresh_token, client_id } = body || {};
    const sessionResult = await getSessionByRefreshToken(env, refresh_token);
    if ("error" in sessionResult) {
      return authError(sessionResult.error, sessionResult.status);
    }
    const { session, sessionId, now } = sessionResult;
    if (session.platform !== "desqta") {
      return authError("Invalid refresh_token", 401);
    }

    const effectiveClientId = client_id || (session.client_id as string);
    const user = await env.DB.prepare(
      "SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?",
    )
      .bind(session.user_id as string)
      .first();
    if (!user) {
      await revokeSessionById(env, sessionId);
      return authError("User not found", 401);
    }

    const accessToken = await createAccessToken(user as { id: string; email?: string | null; username?: string | null }, jwtSecret);
    const newExpiresAt = now + APP_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
    await touchUserSession(env, sessionId, now, request, { expiresAt: newExpiresAt, clientId: effectiveClientId });

    const u = user as Record<string, unknown>;
    return authJson({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: WEBSITE_ACCESS_EXPIRES_IN,
      refresh_token: refresh_token,
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        pfpUrl: u.pfpUrl,
        admin_level: (u.admin_level as number) || 0,
      },
    });
  } catch (err) {
    console.error("Desqta refresh error:", err);
    return new Response(JSON.stringify({ error: "Refresh failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleDesqtaLogin({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const body = (await request.json()) as {
      client_id?: string;
      redirect_uri?: string;
      login?: string;
      password?: string;
    };
    const { client_id, redirect_uri, login, password } = body || {};
    if (!client_id || !redirect_uri || !login || !password) {
      return new Response(JSON.stringify({ error: "Missing client_id, redirect_uri, login, or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientValid = await validateDesqtaClient(env, client_id, redirect_uri);
    if (!clientValid) {
      return new Response(JSON.stringify({ error: "Invalid client_id or redirect_uri" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await touchDesqtaReservedClient(env, client_id);

    const normalizedLogin = login.includes("@") ? login.toLowerCase().trim() : login;
    const user = (await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR username = ?")
      .bind(normalizedLogin, login)
      .first()) as Record<string, string> | null;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );
    const session = await createSession(env, {
      userId: user.id,
      platform: "desqta",
      clientId: client_id,
      deviceName: "DesQTA",
      request,
      refreshDays: APP_REFRESH_EXPIRY_DAYS,
    });

    return authJson({
      access_token: accessToken,
      refresh_token: session.refreshToken,
      expires_in: WEBSITE_ACCESS_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        pfpUrl: user.pfpUrl,
        admin_level: (user as unknown as { admin_level?: number }).admin_level || 0,
      },
    });
  } catch (err) {
    console.error("Desqta login error:", err);
    return new Response(JSON.stringify({ error: "Login failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
