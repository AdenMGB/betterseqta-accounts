import bcrypt from "bcryptjs";
import { corsHeaders, WEBSITE_REFRESH_EXPIRY_DAYS, APP_REFRESH_EXPIRY_DAYS } from "../constants";
import { createAccessToken, getUser } from "../lib/auth";
import { cleanEnvVar } from "../lib/env-util";
import { validateDesqtaClient, touchDesqtaReservedClient } from "../lib/desqta-client";
import { createSession } from "../lib/session";
import { deviceNameForNewSession } from "../lib/session-display";
import { ensureUserDesqtaSettings } from "../lib/settings-bootstrap";
import { createAccessTokenCookie, createRefreshTokenCookie } from "../lib/session-cookies";
import type { RequestContext } from "../types/context";

export async function handleDiscordOAuthStart({ env, url }: RequestContext): Promise<Response> {
  const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
  const discordRedirectUri =
    cleanEnvVar(env.DISCORD_REDIRECT_URI) ||
    `${env.APP_URL || "https://accounts.betterseqta.org"}/api/oauth/discord/callback`;

  if (!discordClientId) {
    return new Response("Discord OAuth not configured", { status: 500, headers: corsHeaders });
  }

  const postLoginRedirect = url.searchParams.get("redirect") || "";
  const state = postLoginRedirect ? btoa(JSON.stringify({ redirect: postLoginRedirect })) : undefined;

  const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
  discordAuthUrl.searchParams.set("client_id", discordClientId);
  discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify email");
  if (state) discordAuthUrl.searchParams.set("state", state);

  return Response.redirect(discordAuthUrl.toString(), 302);
}

export async function handleDiscordOAuthCallback({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state");

    let postLoginRedirect = "";
    if (stateParam) {
      try {
        const stateData = JSON.parse(atob(stateParam)) as { redirect?: string };
        postLoginRedirect = stateData.redirect || "";
      } catch {
        /* ignore */
      }
    }

    if (error) {
      return Response.redirect(
        `${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=${encodeURIComponent(error)}`,
        302,
      );
    }

    if (!code) {
      return Response.redirect(`${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=no_code`, 302);
    }

    const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
    const discordClientSecret = cleanEnvVar(env.DISCORD_CLIENT_SECRET);
    const discordRedirectUri =
      cleanEnvVar(env.DISCORD_REDIRECT_URI) ||
      `${env.APP_URL || "https://accounts.betterseqta.org"}/api/oauth/discord/callback`;

    if (!discordClientId || !discordClientSecret) {
      return Response.redirect(
        `${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=not_configured`,
        302,
      );
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: discordRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Discord token exchange failed:", errorText);
      return Response.redirect(
        `${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=token_exchange_failed`,
        302,
      );
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const discordAccessToken = tokenData.access_token;

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${discordAccessToken}`,
      },
    });

    if (!userResponse.ok) {
      return Response.redirect(
        `${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=user_fetch_failed`,
        302,
      );
    }

    const discordUser = (await userResponse.json()) as {
      id: string;
      email?: string;
      username?: string;
      global_name?: string;
      avatar?: string;
    };

    let normalizedEmail = discordUser.email ? discordUser.email.toLowerCase().trim() : null;

    if (!normalizedEmail) {
      normalizedEmail = `discord_${discordUser.id}@discord.local`;
    }

    let user = (await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalizedEmail).first()) as Record<
      string,
      unknown
    > | null;

    if (!user) {
      const userId = crypto.randomUUID();
      const username = discordUser.username || `discord_${discordUser.id}`;
      const displayName = discordUser.global_name || discordUser.username || username;
      const pfpUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      await env.DB.prepare(
        "INSERT INTO users (id, email, password, username, displayName, pfpUrl, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(userId, normalizedEmail, hashedPassword, username, displayName, pfpUrl, 0)
        .run();
      await ensureUserDesqtaSettings(env.DB, userId);

      user = (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first()) as Record<string, unknown>;
    } else {
      const pfpUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : user.pfpUrl;
      const displayName =
        discordUser.global_name || discordUser.username || (user.displayName as string) || (user.username as string);

      await env.DB.prepare("UPDATE users SET displayName = ?, pfpUrl = ? WHERE id = ?")
        .bind(displayName, pfpUrl, user.id)
        .run();
    }

    const token = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );
    const session = await createSession(env, {
      userId: user.id as string,
      platform: "web",
      deviceName: deviceNameForNewSession(request),
      request,
      refreshDays: WEBSITE_REFRESH_EXPIRY_DAYS,
    });
    const frontendCallbackUrl = new URL(
      `${env.APP_URL || "https://accounts.betterseqta.org"}/auth/discord/callback`,
    );
    if (postLoginRedirect) frontendCallbackUrl.searchParams.set("redirect", postLoginRedirect);

    const headers = new Headers({
      Location: frontendCallbackUrl.toString(),
    });
    headers.append("Set-Cookie", createAccessTokenCookie(token));
    headers.append("Set-Cookie", createRefreshTokenCookie(session.refreshToken));

    return new Response(null, {
      status: 302,
      headers,
    });
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    return Response.redirect(`${env.APP_URL || "https://accounts.betterseqta.org"}/login?error=oauth_error`, 302);
  }
}

export async function handleBsplusDiscordForward({ env, url }: RequestContext): Promise<Response> {
  const baseUrl = env.APP_URL || "https://accounts.betterseqta.org";
  const redirectUrl = new URL(`${baseUrl}/api/oauth/desqta/discord`);
  url.searchParams.forEach((v, k) => redirectUrl.searchParams.set(k, v));
  return Response.redirect(redirectUrl.toString(), 302);
}

export async function handleDesqtaDiscordStart({ env, url }: RequestContext): Promise<Response> {
  try {
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");

    if (!clientId || !redirectUri) {
      return new Response(JSON.stringify({ error: "Missing client_id or redirect_uri" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientValid = await validateDesqtaClient(env, clientId, redirectUri);
    if (!clientValid) {
      return new Response(JSON.stringify({ error: "Invalid client_id or redirect_uri does not match" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await touchDesqtaReservedClient(env, clientId);

    const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
    const discordRedirectUri = `${env.APP_URL || "https://accounts.betterseqta.org"}/api/oauth/desqta/discord/callback`;

    if (!discordClientId) {
      return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = btoa(JSON.stringify({ client_id: clientId, redirect_uri: redirectUri }));

    const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
    discordAuthUrl.searchParams.set("client_id", discordClientId);
    discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
    discordAuthUrl.searchParams.set("response_type", "code");
    discordAuthUrl.searchParams.set("scope", "identify email");
    discordAuthUrl.searchParams.set("state", state);

    return Response.redirect(discordAuthUrl.toString(), 302);
  } catch (err) {
    console.error("DesQTA Discord OAuth initiation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleDesqtaDiscordCallback({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    if (error) {
      return new Response(JSON.stringify({ error: `Discord OAuth error: ${error}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "Missing code or state parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let stateData: { client_id?: string; redirect_uri?: string };
    try {
      stateData = JSON.parse(atob(state)) as { client_id?: string; redirect_uri?: string };
    } catch {
      return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, redirect_uri } = stateData;

    if (!client_id || !redirect_uri) {
      return new Response(JSON.stringify({ error: "Invalid state data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientValid = await validateDesqtaClient(env, client_id, redirect_uri);
    if (!clientValid) {
      return new Response(JSON.stringify({ error: "Invalid client or redirect URI mismatch" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await touchDesqtaReservedClient(env, client_id);

    const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
    const discordClientSecret = cleanEnvVar(env.DISCORD_CLIENT_SECRET);
    const discordRedirectUri = `${env.APP_URL || "https://accounts.betterseqta.org"}/api/oauth/desqta/discord/callback`;

    if (!discordClientId || !discordClientSecret) {
      return new Response(JSON.stringify({ error: "Discord OAuth not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: discordRedirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Discord token exchange failed:", errorText);
      return new Response(JSON.stringify({ error: "Failed to exchange Discord code for token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch Discord user info" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const discordUser = (await userResponse.json()) as {
      id: string;
      email?: string;
      username?: string;
      global_name?: string;
      avatar?: string;
    };

    let normalizedEmail = discordUser.email ? discordUser.email.toLowerCase().trim() : null;

    if (!normalizedEmail) {
      normalizedEmail = `discord_${discordUser.id}@discord.local`;
    }

    let user = (await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(normalizedEmail).first()) as Record<
      string,
      unknown
    > | null;

    if (!user) {
      const userId = crypto.randomUUID();
      const username = discordUser.username || `discord_${discordUser.id}`;
      const displayName = discordUser.global_name || discordUser.username || username;
      const pfpUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : null;

      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      await env.DB.prepare(
        "INSERT INTO users (id, email, password, username, displayName, pfpUrl, admin_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(userId, normalizedEmail, hashedPassword, username, displayName, pfpUrl, 0)
        .run();
      await ensureUserDesqtaSettings(env.DB, userId);

      user = (await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first()) as Record<string, unknown>;
    } else {
      const pfpUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : user.pfpUrl;
      const displayName =
        discordUser.global_name || discordUser.username || (user.displayName as string) || (user.username as string);

      await env.DB.prepare("UPDATE users SET displayName = ?, pfpUrl = ? WHERE id = ?")
        .bind(displayName, pfpUrl, user.id)
        .run();
    }

    const apiToken = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );
    const platform = redirect_uri.startsWith("desqta://") ? "desqta" : "bsplus";
    const session = await createSession(env, {
      userId: user.id as string,
      platform,
      clientId: client_id,
      deviceName: deviceNameForNewSession(request),
      request,
      refreshDays: APP_REFRESH_EXPIRY_DAYS,
    });

    const desqtaCallbackUrl = new URL(redirect_uri);
    desqtaCallbackUrl.searchParams.set("token", apiToken);
    desqtaCallbackUrl.searchParams.set("user_id", user.id as string);
    desqtaCallbackUrl.searchParams.set("refresh_token", session.refreshToken);

    return Response.redirect(desqtaCallbackUrl.toString(), 302);
  } catch (err) {
    console.error("DesQTA Discord OAuth callback error:", err);
    return new Response(JSON.stringify({ error: "OAuth callback error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
