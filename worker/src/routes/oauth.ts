import { corsHeaders, APP_REFRESH_EXPIRY_DAYS, WEBSITE_ACCESS_EXPIRES_IN } from "../constants";
import { getUser, createAccessToken, authJson, authError } from "../lib/auth";
import { getDesqtaClient, isReservedClientExpired, touchDesqtaReservedClient } from "../lib/desqta-client";
import { checkRateLimit } from "../lib/rate-limit";
import { createSession, getSessionByRefreshToken, touchUserSession, revokeSessionById } from "../lib/session";
import { deviceNameForNewSession } from "../lib/session-display";
import { mapUserPublic, USER_PUBLIC_SELECT } from "../lib/userPublic";
import type { RequestContext } from "../types/context";

async function validateOAuthClient(
  env: RequestContext["env"],
  clientId: string | undefined,
  clientSecret: string | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!clientId || !clientSecret) return null;
  const client = await env.DB.prepare("SELECT id, name FROM oauth_clients WHERE id = ? AND secret = ?")
    .bind(clientId, clientSecret)
    .first();
  return client ? (client as { id: string; name: string }) : null;
}

export async function handleOAuthClient({ env, url }: RequestContext): Promise<Response> {
  const clientId = url.searchParams.get("client_id");
  if (!clientId) return new Response("Missing client_id", { status: 400, headers: corsHeaders });

  const client = await env.DB.prepare("SELECT name, redirect_uri FROM oauth_clients WHERE id = ?").bind(clientId).first();
  if (client) {
    return new Response(JSON.stringify(client), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reservedClient = await getDesqtaClient(env, clientId);
  if (reservedClient.valid && reservedClient.isReserved) {
    return new Response(JSON.stringify({ name: "BetterSEQTA+", redirect_uri: reservedClient.redirect_uri }), {
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
      if (isReservedClientExpired(redirect_uri!, reserved.expires_at as number | null, env.APP_URL)) {
        return new Response(JSON.stringify({ error: "Client expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await touchDesqtaReservedClient(env, client_id!);

      const fullUser = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
        .bind(user.id)
        .first();
      if (!fullUser) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = await createAccessToken(
        fullUser as { id: string; email?: string | null; username?: string | null },
        jwtSecret,
      );
      const platform = redirect_uri!.startsWith("desqta://") ? "desqta" : "bsplus";
      const session = await createSession(env, {
        userId: (fullUser as { id: string }).id,
        platform,
        clientId: client_id!,
        deviceName: deviceNameForNewSession(request),
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
  try {
    const rateLimited = await checkRateLimit(env, request, "oauth-token", { limit: 30, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const { code, client_id, client_secret } = (await request.json()) as {
      code?: string;
      client_id?: string;
      client_secret?: string;
    };

    const client = await validateOAuthClient(env, client_id, client_secret);
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

    const user = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
      .bind(oauthCode.user_id as string)
      .first();
    if (!user) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const access_token = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );
    const session = await createSession(env, {
      userId: (user as { id: string }).id,
      platform: "oauth",
      clientId: client_id!,
      deviceName: deviceNameForNewSession(request),
      request,
      refreshDays: APP_REFRESH_EXPIRY_DAYS,
    });

    return new Response(
      JSON.stringify({
        access_token,
        refresh_token: session.refreshToken,
        token_type: "Bearer",
        expires_in: WEBSITE_ACCESS_EXPIRES_IN,
        user: {
          id: (user as { id: string }).id,
          username: (user as { username: string }).username,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("OAuth token error:", err);
    return new Response(JSON.stringify({ error: "token_exchange_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleOAuthRefresh({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "oauth-refresh", { limit: 60, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as {
      refresh_token?: string;
      client_id?: string;
      client_secret?: string;
    };
    const { refresh_token, client_id, client_secret } = body || {};

    const client = await validateOAuthClient(env, client_id, client_secret);
    if (!client) {
      return authError("invalid_client", 401);
    }

    const sessionResult = await getSessionByRefreshToken(env, refresh_token);
    if ("error" in sessionResult) {
      return authError(sessionResult.error, sessionResult.status);
    }

    const { session, sessionId, now } = sessionResult;
    if (session.platform !== "oauth") {
      return authError("Invalid refresh_token", 401);
    }
    if ((session.client_id as string | null) !== client_id) {
      return authError("Invalid refresh_token", 401);
    }

    const user = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
      .bind(session.user_id as string)
      .first();
    if (!user) {
      await revokeSessionById(env, sessionId);
      return authError("User not found", 401);
    }

    const newExpiresAt = now + APP_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
    await touchUserSession(env, sessionId, now, request, { expiresAt: newExpiresAt, clientId: client_id });

    const accessToken = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );

    return authJson({
      access_token: accessToken,
      refresh_token: refresh_token,
      token_type: "Bearer",
      expires_in: WEBSITE_ACCESS_EXPIRES_IN,
    });
  } catch (err) {
    console.error("OAuth refresh error:", err);
    return authError("Refresh failed", 500);
  }
}

export async function handleOAuthRevoke({ env, request }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "oauth-revoke", { limit: 30, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as {
      refresh_token?: string;
      client_id?: string;
      client_secret?: string;
    };
    const { refresh_token, client_id, client_secret } = body || {};

    const client = await validateOAuthClient(env, client_id, client_secret);
    if (!client) {
      return authError("invalid_client", 401);
    }

    const sessionResult = await getSessionByRefreshToken(env, refresh_token);
    if (!("error" in sessionResult)) {
      const { session, sessionId } = sessionResult;
      if (session.platform === "oauth" && (session.client_id as string | null) === client_id) {
        await revokeSessionById(env, sessionId);
      }
    }

    return authJson({ success: true });
  } catch (err) {
    console.error("OAuth revoke error:", err);
    return authJson({ success: true });
  }
}

export async function handleOAuthUserinfo({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const user = await getUser(request, jwtSecret);
  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const userData = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
    .bind(user.id)
    .first();
  return new Response(JSON.stringify(mapUserPublic(userData as Record<string, unknown>)), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
