import { corsHeaders } from "../constants";
import { cleanEnvVar } from "../lib/env-util";
import { checkRateLimit } from "../lib/rate-limit";
import type { RequestContext } from "../types/context";
import type { Env } from "../types/env";

export const MICROSOFT_CALENDAR_CALLBACK_URI =
  "https://accounts.betterseqta.org/auth/microsoft/calendar/callback";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
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

function getMicrosoftOAuthConfig(env: Env): { clientId: string | null; clientSecret: string | null } {
  return {
    clientId: cleanEnvVar(env.MICROSOFT_CALENDAR_CLIENT_ID),
    clientSecret: cleanEnvVar(env.MICROSOFT_CALENDAR_CLIENT_SECRET),
  };
}

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return value.trim();
}

function parseExpiresIn(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function postMicrosoftToken(
  env: Env,
  params: Record<string, string>,
): Promise<{ ok: true; data: MicrosoftTokenResponse } | { ok: false; status: number; message: string }> {
  const { clientId, clientSecret } = getMicrosoftOAuthConfig(env);
  if (!clientId || !clientSecret) {
    return { ok: false, status: 500, message: "Microsoft OAuth is not configured" };
  }

  const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...params,
    }),
  });

  const tokenData = (await tokenResponse.json().catch(() => ({}))) as MicrosoftTokenResponse;

  if (!tokenResponse.ok) {
    const detail =
      typeof tokenData.error_description === "string"
        ? tokenData.error_description
        : typeof tokenData.error === "string"
          ? tokenData.error
          : "Unknown error";
    console.error("Microsoft token request failed:", detail);
    return { ok: false, status: 502, message: "Microsoft token exchange failed" };
  }

  const expiresIn = parseExpiresIn(tokenData.expires_in);
  if (!tokenData.access_token || expiresIn === null) {
    console.error("Microsoft token response missing required fields");
    return { ok: false, status: 502, message: "Microsoft token exchange failed" };
  }

  return { ok: true, data: { ...tokenData, expires_in: expiresIn } };
}

export async function handleMicrosoftCalendarTokenExchange({ env, request }: RequestContext): Promise<Response> {
  const rateLimited = await checkRateLimit(env, request, "microsoft-calendar-token", { limit: 10, windowSec: 900 });
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
  if (redirectUri !== MICROSOFT_CALENDAR_CALLBACK_URI) {
    return jsonError("Invalid redirect_uri", 422);
  }
  if (!codeVerifier) {
    return jsonError("Missing or invalid code_verifier", 400);
  }

  const result = await postMicrosoftToken(env, {
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

export async function handleMicrosoftCalendarTokenRefresh({ env, request }: RequestContext): Promise<Response> {
  const rateLimited = await checkRateLimit(env, request, "microsoft-calendar-refresh", { limit: 10, windowSec: 900 });
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

  const result = await postMicrosoftToken(env, {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (!result.ok) {
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
