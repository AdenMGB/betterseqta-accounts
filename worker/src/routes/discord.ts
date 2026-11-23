import {
  corsHeaders,
  WEBSITE_REFRESH_EXPIRY_DAYS,
  APP_REFRESH_EXPIRY_DAYS,
} from "../constants";
import { createAccessToken } from "../lib/auth";
import { cleanEnvVar } from "../lib/env-util";
import {
  validateDesqtaClient,
  touchDesqtaReservedClient,
} from "../lib/desqta-client";
import { createSession } from "../lib/session";
import { deviceNameForNewSession } from "../lib/session-display";
import {
  createAccessTokenCookie,
  createRefreshTokenCookie,
} from "../lib/session-cookies";
import {
  createDiscordOAuthStart,
  consumeDiscordOAuthState,
  clearDiscordOAuthCookie,
} from "../lib/discord-oauth";
import {
  exchangeDiscordOAuthCode,
  fetchDiscordUser,
  resolveUserFromDiscord,
} from "../lib/discord-account";
import { isSafeInternalPath } from "../lib/safe-internal-path";
import type { RequestContext } from "../types/context";

function appBase(env: RequestContext["env"]): string {
  return env.APP_URL || "https://accounts.betterseqta.org";
}

function redirectWithCookies(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function appendPkceAndState(
  authUrl: URL,
  state: string,
  codeChallenge: string,
): void {
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
}

export async function handleDiscordOAuthStart({
  env,
  url,
  jwtSecret,
}: RequestContext): Promise<Response> {
  const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
  const discordRedirectUri =
    cleanEnvVar(env.DISCORD_REDIRECT_URI) ||
    `${appBase(env)}/api/oauth/discord/callback`;

  if (!discordClientId) {
    return new Response("Discord OAuth not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const rawRedirect = url.searchParams.get("redirect") || "";
  const postLoginRedirect = isSafeInternalPath(rawRedirect)
    ? rawRedirect
    : undefined;

  const { state, codeChallenge, setCookie } = await createDiscordOAuthStart(
    jwtSecret,
    {
      kind: "web",
      postLoginRedirect,
    },
  );

  const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
  discordAuthUrl.searchParams.set("client_id", discordClientId);
  discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
  discordAuthUrl.searchParams.set("response_type", "code");
  discordAuthUrl.searchParams.set("scope", "identify email");
  appendPkceAndState(discordAuthUrl, state, codeChallenge);

  return redirectWithCookies(discordAuthUrl.toString(), [setCookie]);
}

export async function handleDiscordOAuthCallback({
  env,
  request,
  url,
  jwtSecret,
}: RequestContext): Promise<Response> {
  const clearCookie = clearDiscordOAuthCookie();
  const base = appBase(env);

  try {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state");

    if (error) {
      return redirectWithCookies(
        `${base}/login?error=${encodeURIComponent(error)}`,
        [clearCookie],
      );
    }

    if (!code) {
      return redirectWithCookies(`${base}/login?error=no_code`, [clearCookie]);
    }

    const oauthState = await consumeDiscordOAuthState(
      request,
      jwtSecret,
      stateParam,
    );
    if (!oauthState || oauthState.kind !== "web") {
      return redirectWithCookies(`${base}/login?error=invalid_oauth_state`, [
        clearCookie,
      ]);
    }

    const discordRedirectUri =
      cleanEnvVar(env.DISCORD_REDIRECT_URI) ||
      `${base}/api/oauth/discord/callback`;

    const exchanged = await exchangeDiscordOAuthCode(
      env,
      code,
      discordRedirectUri,
      oauthState.codeVerifier,
    );
    if ("error" in exchanged) {
      return redirectWithCookies(`${base}/login?error=${exchanged.error}`, [
        clearCookie,
      ]);
    }

    const discordUser = await fetchDiscordUser(exchanged.accessToken);
    if (!discordUser) {
      return redirectWithCookies(`${base}/login?error=user_fetch_failed`, [
        clearCookie,
      ]);
    }

    const resolved = await resolveUserFromDiscord(env, discordUser);
    if (!resolved.ok) {
      const err = () => {
        switch (resolved.reason) {
          case "email_account_exists":
            return "discord_email_conflict";
          case "discord_linked_elsewhere":
            return "discord_account_conflict";
          case "discord_email_not_verified":
            return "discord_email_not_verified";
        }
      };
      return redirectWithCookies(`${base}/login?error=${err()}`, [clearCookie]);
    }

    const user = resolved.user;
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

    const postLoginRedirect =
      oauthState.postLoginRedirect &&
      isSafeInternalPath(oauthState.postLoginRedirect)
        ? oauthState.postLoginRedirect
        : "";

    const frontendCallbackUrl = new URL(`${base}/auth/discord/callback`);
    if (postLoginRedirect)
      frontendCallbackUrl.searchParams.set("redirect", postLoginRedirect);

    return redirectWithCookies(frontendCallbackUrl.toString(), [
      createAccessTokenCookie(token),
      createRefreshTokenCookie(session.refreshToken),
      clearCookie,
    ]);
  } catch (err) {
    console.error("Discord OAuth callback error:", err);
    return redirectWithCookies(`${base}/login?error=oauth_error`, [
      clearDiscordOAuthCookie(),
    ]);
  }
}

export async function handleBsplusDiscordForward({
  env,
  url,
}: RequestContext): Promise<Response> {
  const redirectUrl = new URL(`${appBase(env)}/api/oauth/desqta/discord`);
  url.searchParams.forEach((v, k) => redirectUrl.searchParams.set(k, v));
  return Response.redirect(redirectUrl.toString(), 302);
}

export async function handleDesqtaDiscordStart({
  env,
  url,
  jwtSecret,
}: RequestContext): Promise<Response> {
  try {
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing client_id or redirect_uri" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const clientValid = await validateDesqtaClient(env, clientId, redirectUri);
    if (!clientValid) {
      return new Response(
        JSON.stringify({
          error: "Invalid client_id or redirect_uri does not match",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    await touchDesqtaReservedClient(env, clientId);

    const discordClientId = cleanEnvVar(env.DISCORD_CLIENT_ID);
    const discordRedirectUri = `${appBase(env)}/api/oauth/desqta/discord/callback`;

    if (!discordClientId) {
      return new Response(
        JSON.stringify({ error: "Discord OAuth not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { state, codeChallenge, setCookie } = await createDiscordOAuthStart(
      jwtSecret,
      {
        kind: "desqta",
        client_id: clientId,
        redirect_uri: redirectUri,
      },
    );

    const discordAuthUrl = new URL("https://discord.com/api/oauth2/authorize");
    discordAuthUrl.searchParams.set("client_id", discordClientId);
    discordAuthUrl.searchParams.set("redirect_uri", discordRedirectUri);
    discordAuthUrl.searchParams.set("response_type", "code");
    discordAuthUrl.searchParams.set("scope", "identify email");
    appendPkceAndState(discordAuthUrl, state, codeChallenge);

    return redirectWithCookies(discordAuthUrl.toString(), [setCookie]);
  } catch (err) {
    console.error("DesQTA Discord OAuth initiation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleDesqtaDiscordCallback({
  env,
  request,
  url,
  jwtSecret,
}: RequestContext): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const clearCookie = clearDiscordOAuthCookie();

  try {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state");

    if (error) {
      return new Response(
        JSON.stringify({ error: `Discord OAuth error: ${error}` }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    if (!code || !stateParam) {
      return new Response(
        JSON.stringify({ error: "Missing code or state parameter" }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    const oauthState = await consumeDiscordOAuthState(
      request,
      jwtSecret,
      stateParam,
    );
    if (!oauthState || oauthState.kind !== "desqta") {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OAuth state" }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    const { client_id, redirect_uri } = oauthState;

    const clientValid = await validateDesqtaClient(
      env,
      client_id,
      redirect_uri,
    );
    if (!clientValid) {
      return new Response(
        JSON.stringify({ error: "Invalid client or redirect URI mismatch" }),
        {
          status: 401,
          headers: jsonHeaders,
        },
      );
    }
    await touchDesqtaReservedClient(env, client_id);

    const discordRedirectUri = `${appBase(env)}/api/oauth/desqta/discord/callback`;
    const exchanged = await exchangeDiscordOAuthCode(
      env,
      code,
      discordRedirectUri,
      oauthState.codeVerifier,
    );
    if ("error" in exchanged) {
      return new Response(
        JSON.stringify({ error: "Failed to exchange Discord code for token" }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    const discordUser = await fetchDiscordUser(exchanged.accessToken);
    if (!discordUser) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch Discord user info" }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    const resolved = await resolveUserFromDiscord(env, discordUser);
    if (!resolved.ok) {
      const message = () => {
        switch (resolved.reason) {
          case "email_account_exists":
            return "An account with this email already exists. Sign in with your password first, then link Discord from account settings.";
          case "discord_linked_elsewhere":
            return "This Discord account is already linked to another user.";
          case "discord_email_not_verified":
            return "Your Discord email is not verified. Please verify your email in Discord and try again.";
        }
      };
      return new Response(JSON.stringify({ error: message() }), {
        status: 409,
        headers: jsonHeaders,
      });
    }

    const user = resolved.user;
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

    return redirectWithCookies(desqtaCallbackUrl.toString(), [clearCookie]);
  } catch (err) {
    console.error("DesQTA Discord OAuth callback error:", err);
    return new Response(JSON.stringify({ error: "OAuth callback error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
}
