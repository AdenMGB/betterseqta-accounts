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
import {
  createSession,
  getSessionByRefreshToken,
  touchUserSession,
  revokeSessionById,
} from "../lib/session";
import type { RequestContext } from "../types/context";

export async function handleRegister({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  try {
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

    const id = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, password, username, displayName, admin_level) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, normalizedEmail, hashedPassword, username, displayName || username, 0)
        .run();
    } catch {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await createAccessToken({ id, email: normalizedEmail, username }, jwtSecret);
    const session = await createSession(env, {
      userId: id,
      platform: "web",
      deviceName: "Website",
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
        user: { id, email: normalizedEmail, username, displayName, admin_level: 0 },
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
    const { login, password } = (await request.json()) as { login?: string; password?: string };
    const normalizedLogin = login!.includes("@") ? login!.toLowerCase().trim() : login!;
    const user = (await env.DB.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR username = ?")
      .bind(normalizedLogin, login)
      .first()) as Record<string, string> | null;

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
      deviceName: "Website",
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
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
          admin_level: (user as unknown as { admin_level?: number }).admin_level || 0,
        },
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

  const user = await env.DB.prepare("SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?")
    .bind(payload.id)
    .first();
  return new Response(JSON.stringify(user), {
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

    const user = await env.DB.prepare(
      "SELECT id, email, username, displayName, pfpUrl, admin_level FROM users WHERE id = ?",
    )
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

    const u = user as Record<string, unknown>;
    return authJson(
      {
        token: accessToken,
        expires_in: WEBSITE_ACCESS_EXPIRES_IN,
        user: {
          id: u.id,
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          pfpUrl: u.pfpUrl,
          admin_level: (u.admin_level as number) || 0,
        },
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const existingUser = await env.DB.prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?)")
      .bind(normalizedNewEmail)
      .first();
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
    const { login } = (await request.json()) as { login?: string };
    if (!login) {
      return new Response(JSON.stringify({ error: "Missing email or username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedLogin = login.includes("@") ? login.toLowerCase().trim() : login;
    const user = (await env.DB.prepare("SELECT id, email, displayName FROM users WHERE LOWER(email) = LOWER(?) OR username = ?")
      .bind(normalizedLogin, login)
      .first()) as { id: string; email: string; displayName?: string } | null;

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

    await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?").bind(validToken.token).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
