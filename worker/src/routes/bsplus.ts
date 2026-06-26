import { corsHeaders, WEBSITE_ACCESS_EXPIRES_IN, APP_REFRESH_EXPIRY_DAYS } from "../constants";
import { authJson, authError, createAccessToken } from "../lib/auth";
import { expiresAtForReservedClient, getDesqtaClient, validateDesqtaClient, touchDesqtaReservedClient } from "../lib/desqta-client";
import { isValidBsplusRedirectUri, bsplusRedirectUriError } from "../lib/redirect-uri";
import { checkRateLimit } from "../lib/rate-limit";
import bcrypt from "bcryptjs";
import { createSession, getSessionByRefreshToken, touchUserSession, revokeSessionById } from "../lib/session";
import { deviceNameForNewSession } from "../lib/session-display";
import { findUserByCredentialsLogin } from "../lib/user-by-login";
import { mapUserPublic, publicUserFromCredentials, USER_PUBLIC_SELECT } from "../lib/userPublic";
import type { RequestContext } from "../types/context";

export async function handleBsplusReserve({ env, request }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "bsplus-reserve", { limit: 5, windowSec: 3600 });
    if (rateLimited) return rateLimited;

    const body = (await request.json().catch(() => ({}))) as { redirect_uri?: string };
    const redirectUri = body?.redirect_uri || "https://accounts.betterseqta.org/auth/bsplus/callback";
    if (typeof redirectUri !== "string" || !redirectUri.trim()) {
      return new Response(JSON.stringify({ error: "redirect_uri must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmedUri = redirectUri.trim();
    if (!isValidBsplusRedirectUri(trimmedUri, env.APP_URL)) {
      return new Response(JSON.stringify({ error: bsplusRedirectUriError() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clientId = crypto.randomUUID();
    const expiresAt = expiresAtForReservedClient(trimmedUri, env.APP_URL);
    await env.DB.prepare("INSERT INTO desqta_reserved_clients (id, redirect_uri, expires_at) VALUES (?, ?, ?)")
      .bind(clientId, trimmedUri, expiresAt)
      .run();

    const baseUrl = env.APP_URL || "https://accounts.betterseqta.org";
    return new Response(
      JSON.stringify({
        client_id: clientId,
        redirect_uri: trimmedUri,
        api_url: baseUrl,
        config_url: `${baseUrl}/api/bsplus/config`,
        refresh_url: `${baseUrl}/api/bsplus/refresh`,
        login_url: `${baseUrl}/api/bsplus/login`,
        discord_auth_url: `${baseUrl}/api/oauth/bsplus/discord`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("BS Plus reserve client error:", err);
    return new Response(JSON.stringify({ error: "Failed to reserve client" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleBsplusConfig({ env, url }: RequestContext): Promise<Response> {
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
      refresh_url: `${baseUrl}/api/bsplus/refresh`,
      login_url: `${baseUrl}/api/bsplus/login`,
      discord_auth_url: `${baseUrl}/api/oauth/bsplus/discord`,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleBsplusRefresh({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const body = (await request.json()) as { refresh_token?: string; client_id?: string };
    const { refresh_token, client_id } = body || {};
    const sessionResult = await getSessionByRefreshToken(env, refresh_token);
    if ("error" in sessionResult) {
      return authError(sessionResult.error, sessionResult.status);
    }
    const { session, sessionId, now } = sessionResult;
    if (session.platform !== "bsplus") {
      return authError("Invalid refresh_token", 401);
    }

    const effectiveClientId = client_id || (session.client_id as string);
    const user = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
      .bind(session.user_id as string)
      .first();
    if (!user) {
      await revokeSessionById(env, sessionId);
      return authError("User not found", 401);
    }

    const accessToken = await createAccessToken(user as { id: string; email?: string | null; username?: string | null }, jwtSecret);
    const newExpiresAt = now + APP_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
    await touchUserSession(env, sessionId, now, request, { expiresAt: newExpiresAt, clientId: effectiveClientId });

    return authJson({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: WEBSITE_ACCESS_EXPIRES_IN,
      refresh_token: refresh_token,
      user: mapUserPublic(user as Record<string, unknown>),
    });
  } catch (err) {
    console.error("BS Plus refresh error:", err);
    return new Response(JSON.stringify({ error: "Refresh failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleBsplusLogin({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const body = (await request.json()) as {
      client_id?: string;
      redirect_uri?: string;
      login?: string;
      password?: string;
      device_name?: string;
    };
    const { client_id, redirect_uri, login, password, device_name } = body || {};
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

    const user = (await findUserByCredentialsLogin(env.DB, login)) as Record<string, string> | null;

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
      platform: "bsplus",
      clientId: client_id,
      deviceName: deviceNameForNewSession(request, device_name),
      request,
      refreshDays: APP_REFRESH_EXPIRY_DAYS,
    });

    return authJson({
      access_token: accessToken,
      refresh_token: session.refreshToken,
      expires_in: WEBSITE_ACCESS_EXPIRES_IN,
      user: publicUserFromCredentials(user),
    });
  } catch (err) {
    console.error("BS Plus login error:", err);
    return new Response(JSON.stringify({ error: "Login failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
