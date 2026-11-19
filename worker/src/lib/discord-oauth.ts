import { SignJWT, jwtVerify } from "jose";
import { createCookie, parseCookies } from "./cookies";

export const DISCORD_OAUTH_COOKIE = "bs_discord_oauth";
const DISCORD_OAUTH_TTL_SEC = 15 * 60;

export type DiscordOAuthFlow = {
  kind: "web";
  postLoginRedirect?: string;
} | {
  kind: "desqta";
  client_id: string;
  redirect_uri: string;
};

type DiscordOAuthJwt = DiscordOAuthFlow & {
  st: string;
  cv: string;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateCodeVerifier(): string {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(verifierBytes);
}

export async function codeChallengeS256Async(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function discordOAuthCookie(token: string, maxAge = DISCORD_OAUTH_TTL_SEC): string {
  return createCookie(DISCORD_OAUTH_COOKIE, token, {
    path: "/api/oauth",
    maxAge,
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

export function clearDiscordOAuthCookie(): string {
  return createCookie(DISCORD_OAUTH_COOKIE, "", {
    path: "/api/oauth",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

export async function createDiscordOAuthStart(
  jwtSecret: Uint8Array,
  flow: DiscordOAuthFlow,
): Promise<{ state: string; codeChallenge: string; setCookie: string }> {
  const state = crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await codeChallengeS256Async(codeVerifier);

  const payload: DiscordOAuthJwt =
    flow.kind === "web"
      ? { kind: "web", postLoginRedirect: flow.postLoginRedirect, st: state, cv: codeVerifier }
      : {
          kind: "desqta",
          client_id: flow.client_id,
          redirect_uri: flow.redirect_uri,
          st: state,
          cv: codeVerifier,
        };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${DISCORD_OAUTH_TTL_SEC}s`)
    .sign(jwtSecret);

  return { state, codeChallenge, setCookie: discordOAuthCookie(token) };
}

export type ConsumedDiscordOAuth = DiscordOAuthFlow & { codeVerifier: string };

export async function consumeDiscordOAuthState(
  request: Request,
  jwtSecret: Uint8Array,
  stateParam: string | null,
): Promise<ConsumedDiscordOAuth | null> {
  if (!stateParam?.trim()) return null;
  const raw = parseCookies(request)[DISCORD_OAUTH_COOKIE];
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(raw, jwtSecret);
    const st = String(payload.st ?? "");
    const cv = String(payload.cv ?? "");
    const kind = payload.kind;
    if (st !== stateParam.trim() || !cv) return null;

    if (kind === "web") {
      return {
        kind: "web",
        postLoginRedirect: typeof payload.postLoginRedirect === "string" ? payload.postLoginRedirect : undefined,
        codeVerifier: cv,
      };
    }
    if (kind === "desqta") {
      const client_id = typeof payload.client_id === "string" ? payload.client_id : "";
      const redirect_uri = typeof payload.redirect_uri === "string" ? payload.redirect_uri : "";
      if (!client_id || !redirect_uri) return null;
      return { kind: "desqta", client_id, redirect_uri, codeVerifier: cv };
    }
    return null;
  } catch {
    return null;
  }
}