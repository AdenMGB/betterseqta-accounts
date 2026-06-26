import bcrypt from "bcryptjs";
import {
  corsHeaders,
  REFRESH_COOKIE_NAME,
  WEBSITE_ACCESS_EXPIRES_IN,
  WEBSITE_REFRESH_EXPIRY_DAYS,
} from "../constants";
import {
  getUser,
  createAccessToken,
  authJson,
  authError,
} from "../lib/auth";
import { parseCookies, createCookie, clearCookie } from "../lib/cookies";
import { sendPasswordResetEmail } from "../lib/email";
import { checkRateLimit } from "../lib/rate-limit";
import {
  createSession,
  getSessionByRefreshToken,
  touchUserSession,
  revokeSessionById,
  revokeAllUserSessions,
} from "../lib/session";
import { findUserByCredentialsLogin, findUserProfileByLogin } from "../lib/user-by-login";
import { ensureUserDesqtaSettings } from "../lib/settings-bootstrap";
import {
  deviceNameForNewSession,
  resolveSessionDeviceName,
  sessionSubtitle,
  sessionTitle,
} from "../lib/session-display";
import { mapUserPublic, publicUserFromCredentials, USER_PUBLIC_SELECT } from "../lib/userPublic";
import type { RequestContext } from "../types/context";

export async function handleRegister({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "auth-register", { limit: 10, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const { email, password, username, displayName } = (await request.json()) as {
      email?: string;
      password?: string;
      username?: string;
      displayName?: string;
    };
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return new Response(JSON.stringify({ error: "Username is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRow = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(normalizedEmail).first();
    if (emailRow) {
      return new Response(JSON.stringify({ error: "Email is already registered" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usernameRow = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(trimmedUsername).first();
    if (usernameRow) {
      return new Response(JSON.stringify({ error: "Username is already taken" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const id = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, password, username, displayName, admin_level) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, normalizedEmail, hashedPassword, trimmedUsername, displayName || trimmedUsername, 0)
        .run();
      await ensureUserDesqtaSettings(env.DB, id);
    } catch {
      return new Response(JSON.stringify({ error: "This email or username is already in use" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await createAccessToken({ id, email: normalizedEmail, username: trimmedUsername }, jwtSecret);
    const session = await createSession(env, {
      userId: id,
      platform: "web",
      deviceName: deviceNameForNewSession(request),
      request,
      refreshDays: WEBSITE_REFRESH_EXPIRY_DAYS,
    });
    const refreshCookie = createCookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      maxAge: WEBSITE_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return authJson(
      {
        token,
        expires_in: WEBSITE_ACCESS_EXPIRES_IN,
        user: { id, email: normalizedEmail, username: trimmedUsername, displayName, admin_level: 0 },
      },
      {
        "Set-Cookie": refreshCookie,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleLogin({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "auth-login", { limit: 10, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const { login, password } = (await request.json()) as { login?: string; password?: string };
    const user = (await findUserByCredentialsLogin(env.DB, login!)) as Record<string, string> | null;

    if (!user || !(await bcrypt.compare(password!, user.password))) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await createAccessToken(
      user as { id: string; email?: string | null; username?: string | null },
      jwtSecret,
    );
    const session = await createSession(env, {
      userId: user.id,
      platform: "web",
      deviceName: deviceNameForNewSession(request),
      request,
      refreshDays: WEBSITE_REFRESH_EXPIRY_DAYS,
    });
    const refreshCookie = createCookie(REFRESH_COOKIE_NAME, session.refreshToken, {
      maxAge: WEBSITE_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return authJson(
      {
        token,
        expires_in: WEBSITE_ACCESS_EXPIRES_IN,
        user: publicUserFromCredentials(user),
      },
      {
        "Set-Cookie": refreshCookie,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleMe({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const user = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
    .bind(payload.id)
    .first();
  return new Response(JSON.stringify(mapUserPublic(user as Record<string, unknown>)), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleRefresh({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
    const cookies = parseCookies(request);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    const sessionResult = await getSessionByRefreshToken(env, refreshToken);
    if ("error" in sessionResult) {
      return authError(sessionResult.error, sessionResult.status, {
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      });
    }

    const { session, sessionId, now } = sessionResult;
    if (session.platform !== "web") {
      return authError("Invalid session platform", 401, {
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      });
    }

    const user = await env.DB.prepare(`SELECT ${USER_PUBLIC_SELECT} FROM users WHERE id = ?`)
      .bind(session.user_id as string)
      .first();
    if (!user) {
      await revokeSessionById(env, sessionId);
      return authError("User not found", 401, {
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      });
    }

    const newExpiresAt = now + WEBSITE_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
    await touchUserSession(env, sessionId, now, request, { expiresAt: newExpiresAt });
    const accessToken = await createAccessToken(user as { id: string; email?: string | null; username?: string | null }, jwtSecret);
    const refreshCookie = createCookie(REFRESH_COOKIE_NAME, refreshToken!, {
      maxAge: WEBSITE_REFRESH_EXPIRY_DAYS * 24 * 60 * 60,
    });

    return authJson(
      {
        token: accessToken,
        expires_in: WEBSITE_ACCESS_EXPIRES_IN,
        user: mapUserPublic(user as Record<string, unknown>),
      },
      {
        "Set-Cookie": refreshCookie,
      },
    );
  } catch (err) {
    console.error("Website refresh error:", err);
    return authError("Refresh failed", 500, {
      "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
    });
  }
}

export async function handleLogout({ env, request }: RequestContext): Promise<Response> {
  try {
    const cookies = parseCookies(request);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    const sessionResult = await getSessionByRefreshToken(env, refreshToken);
    if (!("error" in sessionResult)) {
      await revokeSessionById(env, sessionResult.sessionId);
    }
    return authJson(
      { success: true },
      {
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      },
    );
  } catch (err) {
    console.error("Website logout error:", err);
    return authJson(
      { success: true },
      {
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      },
    );
  }
}

export async function handleLogoutAll({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) {
    return authError("Unauthorized", 401, {
      "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
    });
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    "UPDATE user_sessions SET revoked_at = ?, expires_at = MIN(expires_at, ?) WHERE user_id = ? AND platform = 'web' AND revoked_at IS NULL",
  )
    .bind(now, now, payload.id)
    .run();

  return authJson(
    { success: true },
    {
      "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
    },
  );
}

export async function handleChangePassword({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const userPayload = await getUser(request, jwtSecret);
  if (!userPayload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await env.DB.prepare("SELECT password FROM users WHERE id = ?").bind(userPayload.id).first();
    if (!user) return new Response("User not found", { status: 404, headers: corsHeaders });

    const valid = await bcrypt.compare(currentPassword, user.password as string);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid current password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await env.DB.prepare("UPDATE users SET password = ? WHERE id = ?").bind(hashedPassword, userPayload.id).run();
    await revokeAllUserSessions(env, userPayload.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleChangeEmail({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const userPayload = await getUser(request, jwtSecret);
  if (!userPayload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    const { newEmail, password } = (await request.json()) as { newEmail?: string; password?: string };
    if (!newEmail || !password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();

    const user = (await env.DB.prepare("SELECT password, email FROM users WHERE id = ?").bind(userPayload.id).first()) as
      | { password: string; email: string }
      | null;
    if (!user) return new Response("User not found", { status: 404, headers: corsHeaders });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.email.toLowerCase() === normalizedNewEmail) {
      return new Response(JSON.stringify({ error: "New email must be different from current email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(normalizedNewEmail).first();
    if (existingUser) {
      return new Response(JSON.stringify({ error: "Email already in use" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(normalizedNewEmail, userPayload.id).run();

    return new Response(JSON.stringify({ success: true, email: normalizedNewEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message && message.includes("UNIQUE constraint")) {
      return new Response(JSON.stringify({ error: "Email already in use" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleForgotPassword({ env, request }: RequestContext): Promise<Response> {
  try {
    const rateLimited = await checkRateLimit(env, request, "auth-forgot-password", { limit: 10, windowSec: 900 });
    if (rateLimited) return rateLimited;

    const { login } = (await request.json()) as { login?: string };
    if (!login) {
      return new Response(JSON.stringify({ error: "Missing email or username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await findUserProfileByLogin(env.DB, login);

    if (user) {
      const recentToken = await env.DB.prepare(
        "SELECT created_at FROM password_reset_tokens WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
      )
        .bind(user.id)
        .first();

      if (recentToken) {
        const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
        if ((recentToken.created_at as number) > fiveMinutesAgo) {
          const secondsRemaining = (recentToken.created_at as number) - fiveMinutesAgo;
          return new Response(
            JSON.stringify({
              error: "Please wait before requesting another reset email",
              retryAfter: secondsRemaining,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    if (user) {
      await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(user.id).run();

      const token = crypto.randomUUID();
      const hashedToken = await bcrypt.hash(token, 10);
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      await env.DB.prepare("INSERT INTO password_reset_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)")
        .bind(hashedToken, user.id, expiresAt)
        .run();

      try {
        await sendPasswordResetEmail(user.email, token, env, user.displayName || null);
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "If an account exists, a reset email has been sent. Please check your inbox, spam, and other folders.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Forgot password error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleVerifyResetToken({ env, request, url }: RequestContext): Promise<Response> {
  try {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ valid: false, reason: "missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = await env.DB.prepare(
      "SELECT token, expires_at, used FROM password_reset_tokens WHERE expires_at > ? AND used = 0",
    )
      .bind(Math.floor(Date.now() / 1000))
      .all();

    let validToken: { token: string; expires_at: number; used: number } | null = null;
    for (const dbToken of tokens.results ?? []) {
      const row = dbToken as { token: string; expires_at: number; used: number };
      if (await bcrypt.compare(token, row.token)) {
        validToken = row;
        break;
      }
    }

    if (!validToken) {
      return new Response(JSON.stringify({ valid: false, reason: "invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (validToken.expires_at < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ valid: false, reason: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (validToken.used) {
      return new Response(JSON.stringify({ valid: false, reason: "used" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false, reason: "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

export async function handleResetPassword({ env, request }: RequestContext): Promise<Response> {
  try {
    const { token, newPassword } = (await request.json()) as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      return new Response(JSON.stringify({ error: "Missing token or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = await env.DB.prepare(
      "SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE expires_at > ? AND used = 0",
    )
      .bind(Math.floor(Date.now() / 1000))
      .all();

    let validToken: { token: string; user_id: string; expires_at: number; used: number } | null = null;
    let userId: string | null = null;
    for (const dbToken of tokens.results ?? []) {
      const row = dbToken as { token: string; user_id: string; expires_at: number; used: number };
      if (await bcrypt.compare(token, row.token)) {
        validToken = row;
        userId = row.user_id;
        break;
      }
    }

    if (!validToken) {
      return new Response(JSON.stringify({ error: "Invalid or expired reset token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (validToken.expires_at < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: "Reset token has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (validToken.used) {
      return new Response(JSON.stringify({ error: "This reset token has already been used" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await env.DB.prepare("UPDATE users SET password = ? WHERE id = ?").bind(hashedPassword, userId).run();
    await revokeAllUserSessions(env, userId!);

    await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?").bind(validToken.token).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Set-Cookie": clearCookie(REFRESH_COOKIE_NAME),
      },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function sessionIdFromRefreshToken(refreshToken: string | undefined): string | null {
  if (!refreshToken) return null;
  const colonIdx = refreshToken.indexOf(":");
  if (colonIdx < 1) return null;
  return refreshToken.substring(0, colonIdx);
}

export async function handleListSessions({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) {
    return authError("Unauthorized", 401);
  }

  const cookies = parseCookies(request);
  const currentSessionId = sessionIdFromRefreshToken(cookies[REFRESH_COOKIE_NAME]);

  const now = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.platform, s.client_id, s.device_name, s.user_agent,
            s.created_at, s.last_used_at, s.last_ip,
            o.name AS client_name
     FROM user_sessions s
     LEFT JOIN oauth_clients o ON s.platform = 'oauth' AND s.client_id = o.id
     WHERE s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
     ORDER BY s.last_used_at DESC, s.created_at DESC`,
  )
    .bind(payload.id, now)
    .all();

  const sessions = (results || []).map((row) => {
    const r = row as Record<string, unknown>;
    const platform = String(r.platform || "");
    const clientName = (r.client_name as string | null) || null;
    const storedDeviceName = (r.device_name as string | null) || null;
    const userAgent = (r.user_agent as string | null) || null;
    return {
      id: r.id,
      platform,
      device_name: resolveSessionDeviceName(storedDeviceName, userAgent, platform),
      client_id: r.client_id,
      client_name: clientName,
      label: sessionTitle(platform),
      subtitle: sessionSubtitle(platform),
      user_agent: r.user_agent,
      created_at: r.created_at,
      last_used_at: r.last_used_at,
      last_ip: r.last_ip,
      is_current: currentSessionId !== null && r.id === currentSessionId,
    };
  });

  sessions.sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
    const aTime = (a.last_used_at as number | null) ?? (a.created_at as number);
    const bTime = (b.last_used_at as number | null) ?? (b.created_at as number);
    return bTime - aTime;
  });

  return authJson({ sessions });
}

export async function handleRevokeSession({ env, request, jwtSecret, url }: RequestContext): Promise<Response> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) {
    return authError("Unauthorized", 401);
  }

  const parts = url.pathname.split("/");
  const sessionId = parts[parts.length - 1];
  if (!sessionId || sessionId === "sessions") {
    return authError("Missing session id", 400);
  }

  const session = await env.DB.prepare(
    "SELECT id, user_id, revoked_at FROM user_sessions WHERE id = ?",
  )
    .bind(sessionId)
    .first();

  if (!session) {
    return authError("Session not found", 404);
  }
  if ((session.user_id as string) !== payload.id) {
    return authError("Forbidden", 403);
  }
  if (session.revoked_at) {
    return authJson({ success: true });
  }

  await revokeSessionById(env, sessionId);
  return authJson({ success: true });
}

export async function handleRevokeOtherSessions({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) {
    return authError("Unauthorized", 401);
  }

  const cookies = parseCookies(request);
  const currentSessionId = sessionIdFromRefreshToken(cookies[REFRESH_COOKIE_NAME]);
  const now = Math.floor(Date.now() / 1000);

  if (currentSessionId) {
    await env.DB.prepare(
      `UPDATE user_sessions SET revoked_at = ?, expires_at = MIN(expires_at, ?)
       WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
    )
      .bind(now, now, payload.id, currentSessionId)
      .run();
  } else {
    await revokeAllUserSessions(env, payload.id);
  }

  return authJson({ success: true });
}
