import { corsHeaders } from "../constants";
import { cleanEnvVar } from "../lib/env-util";
import { checkRateLimit } from "../lib/rate-limit";
import type { RequestContext } from "../types/context";
import type { Env } from "../types/env";

export const GOOGLE_CALENDAR_CALLBACK_URI = "https://accounts.betterseqta.org/auth/google/calendar/callback";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getGoogleOAuthConfig(env: Env): { clientId: string | null; clientSecret: string | null } {
  return {
    clientId: cleanEnvVar(env.GOOGLE_OAUTH_CLIENT_ID),
    clientSecret: cleanEnvVar(env.GOOGLE_OAUTH_CLIENT_SECRET),
  };
}

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

async function postGoogleToken(
  env: Env,
  params: Record<string, string>,
): Promise<{ ok: true; data: GoogleTokenResponse } | { ok: false; status: number; message: string }> {
  const { clientId, clientSecret } = getGoogleOAuthConfig(env);
  if (!clientId || !clientSecret) {
    return { ok: false, status: 500, message: "Google OAuth is not configured" };
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...params,
    }),
  });

  const tokenData = (await tokenResponse.json().catch(() => ({}))) as GoogleTokenResponse;

  if (!tokenResponse.ok) {
    const detail =
      typeof tokenData.error_description === "string"
        ? tokenData.error_description
        : typeof tokenData.error === "string"
          ? tokenData.error
          : "Unknown error";
    console.error("Google token request failed:", detail);
    return { ok: false, status: 502, message: "Google token exchange failed" };
  }

  if (!tokenData.access_token || typeof tokenData.expires_in !== "number") {
    console.error("Google token response missing required fields");
    return { ok: false, status: 502, message: "Google token exchange failed" };
  }

  return { ok: true, data: tokenData };
}

export async function handleGoogleCalendarTokenExchange({ env, request }: RequestContext): Promise<Response> {
  const rateLimited = await checkRateLimit(env, request, "google-calendar-token", { limit: 10, windowSec: 900 });
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const code = requireNonEmptyString(body.code);
  const redirectUri = requireNonEmptyString(body.redirect_uri);
  const codeVerifier = requireNonEmptyString(body.code_verifier);

  if (!code) {
    return jsonError("Missing or invalid code", 400);
  }
  if (!redirectUri) {
    return jsonError("Missing or invalid redirect_uri", 400);
  }
  if (redirectUri !== GOOGLE_CALENDAR_CALLBACK_URI) {
    return jsonError("Invalid redirect_uri", 422);
  }
  if (!codeVerifier) {
    return jsonError("Missing or invalid code_verifier", 400);
  }

  const result = await postGoogleToken(env, {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  const { data } = result;
  const response: Record<string, unknown> = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type ?? "Bearer",
  };
  if (data.refresh_token) {
    response.refresh_token = data.refresh_token;
  }

  return jsonOk(response);
}

export async function handleGoogleCalendarTokenRefresh({ env, request }: RequestContext): Promise<Response> {
  const rateLimited = await checkRateLimit(env, request, "google-calendar-refresh", { limit: 10, windowSec: 900 });
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const refreshToken = requireNonEmptyString(body.refresh_token);
  if (!refreshToken) {
    return jsonError("Missing or invalid refresh_token", 400);
  }

  const result = await postGoogleToken(env, {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (!result.ok) {
    // Google may reject expired/revoked refresh tokens — extension should prompt reconnect.
    return jsonError(result.message, result.status === 502 ? 401 : result.status);
  }

  const { data } = result;
  const response: Record<string, unknown> = {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type ?? "Bearer",
  };
  if (data.refresh_token) {
    response.refresh_token = data.refresh_token;
  }

  return jsonOk(response);
}
