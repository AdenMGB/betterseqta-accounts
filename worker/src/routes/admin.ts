import bcrypt from "bcryptjs";
import { corsHeaders } from "../constants";
import {
  getAdminUser,
  getAdminUserWithLevel,
  getMaxAdminLevel,
} from "../lib/auth";
import { sendPasswordResetEmail } from "../lib/email";
import type { RequestContext } from "../types/context";

export async function handleAdminUsers({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ?")
    .bind(`%${query}%`, `%${query}%`)
    .first();
  const total = (countResult as { total: number }).total || 0;

  const users = await env.DB.prepare(
    "SELECT id, email, username, displayName, admin_level FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY username LIMIT ? OFFSET ?",
  )
    .bind(`%${query}%`, `%${query}%`, pageSize, offset)
    .all();

  const maxAdminLevel = await getMaxAdminLevel(env);

  return new Response(
    JSON.stringify({
      users: users.results,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      maxAdminLevel,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleAdminPromote({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { userId, adminLevel } = (await request.json()) as { userId?: string; adminLevel?: number };

  const maxAdminLevel = await getMaxAdminLevel(env);

  if (adminLevel! < 0 || adminLevel! > maxAdminLevel) {
    return new Response(
      JSON.stringify({ error: `Invalid admin level. Must be between 0 and ${maxAdminLevel}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const targetUser = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(userId).first();
  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const currentTargetLevel = (targetUser.admin_level as number) || 0;
  const adminLevelNum = admin.adminLevel || 0;

  if (adminLevel! > currentTargetLevel) {
    if (currentTargetLevel === 0 && adminLevelNum < maxAdminLevel) {
      return new Response(JSON.stringify({ error: "Only Senior Admins can promote regular users to admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (adminLevel! > adminLevelNum) {
      return new Response(JSON.stringify({ error: "Cannot promote user to a level higher than your own" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else if (adminLevel! < currentTargetLevel) {
    if (currentTargetLevel >= adminLevelNum) {
      return new Response(JSON.stringify({ error: "Cannot demote users at your level or higher" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await env.DB.prepare("UPDATE users SET admin_level = ? WHERE id = ?").bind(adminLevel, userId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminSendPasswordReset({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const user = (await env.DB.prepare("SELECT id, email, displayName FROM users WHERE id = ?").bind(userId).first()) as {
    id: string;
    email: string;
    displayName?: string;
  } | null;
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await env.DB.prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0").bind(user.id).run();
    const token = crypto.randomUUID();
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await env.DB.prepare("INSERT INTO password_reset_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)")
      .bind(hashedToken, user.id, expiresAt)
      .run();
    await sendPasswordResetEmail(user.email, token, env, user.displayName || null);
  } catch (emailError) {
    console.error("Admin send password reset email error:", emailError);
    return new Response(JSON.stringify({ error: "Failed to send reset email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, message: "Password reset email sent" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminDeleteUser({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const maxAdminLevel = await getMaxAdminLevel(env);
  if ((admin.adminLevel || 0) < maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Only Senior Admins can delete users" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (userId === admin.id) {
    return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetUser = await env.DB.prepare("SELECT id, admin_level FROM users WHERE id = ?").bind(userId).first();
  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (((targetUser.admin_level as number) || 0) >= maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Cannot delete Senior Admin users" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(userId).run();
    try {
      await env.DB.prepare("DELETE FROM settings_metadata WHERE user_id = ?").bind(userId).run();
    } catch {
      /* table may not exist on very old schemas */
    }
    try {
      await env.DB.prepare("DELETE FROM bsplus_settings_sync WHERE user_id = ?").bind(userId).run();
    } catch {
      /* table may not exist on very old schemas */
    }
    await env.DB.prepare("DELETE FROM settings WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM oauth_codes WHERE user_id = ?").bind(userId).run();
    const userSessions = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_sessions'").first();
    if (userSessions) {
      await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId).run();
    }
    const desqtaSessions = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='desqta_sessions'").first();
    if (desqtaSessions) {
      await env.DB.prepare("DELETE FROM desqta_sessions WHERE user_id = ?").bind(userId).run();
    }
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  } catch (err) {
    console.error("Delete user error:", err);
    return new Response(JSON.stringify({ error: "Failed to delete user" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminClientsGet({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const clients = await env.DB.prepare("SELECT * FROM oauth_clients ORDER BY created_at DESC").all();
  return new Response(JSON.stringify(clients.results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminDesqtaClientsCount({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const result = await env.DB.prepare("SELECT COUNT(*) as count FROM desqta_reserved_clients").first();
  return new Response(JSON.stringify({ count: (result?.count as number) ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminClientsPost({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { name, redirect_uri } = (await request.json()) as { name?: string; redirect_uri?: string };
  const id = crypto.randomUUID();
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  await env.DB.prepare("INSERT INTO oauth_clients (id, name, secret, redirect_uri) VALUES (?, ?, ?, ?)")
    .bind(id, name, secret, redirect_uri)
    .run();

  return new Response(JSON.stringify({ id, name, secret, redirect_uri }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminApiKeysGet({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const rows = await env.DB.prepare("SELECT id, name, created_at FROM api_keys ORDER BY created_at DESC").all();
  return new Response(
    JSON.stringify(
      (rows.results as { id: string; name: string; created_at: number }[]).map((r) => ({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
      })),
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleAdminApiKeysPost({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { name } = (await request.json()) as { name?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const id = crypto.randomUUID();
  const token = "bs_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await env.DB.prepare("INSERT INTO api_keys (id, name, token) VALUES (?, ?, ?)").bind(id, name.trim(), token).run();
  return new Response(JSON.stringify({ id, name: name.trim(), token, createdAt: Math.floor(Date.now() / 1000) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminApiKeysDelete({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return new Response(JSON.stringify({ error: "API key ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const result = await env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "API key not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminUpdateUser({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if ((admin.adminLevel || 0) < 2) {
    return new Response(
      JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { userId, email, username, displayName } = (await request.json()) as {
    userId?: string;
    email?: string;
    username?: string;
    displayName?: string;
  };

  if (!userId) {
    return new Response(JSON.stringify({ error: "User ID is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const targetUser = (await env.DB.prepare("SELECT id, email, username FROM users WHERE id = ?").bind(userId).first()) as {
    id: string;
    email: string;
    username: string;
  } | null;
  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (email !== undefined && email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== targetUser.email.toLowerCase()) {
      const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .bind(normalizedEmail, userId)
        .first();
      if (existingUser) {
        return new Response(JSON.stringify({ error: "Email already in use" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updates.push("email = ?");
      values.push(normalizedEmail);
    }
  }

  if (username !== undefined && username !== null) {
    if (username !== targetUser.username) {
      const existingUser = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?")
        .bind(username, userId)
        .first();
      if (existingUser) {
        return new Response(JSON.stringify({ error: "Username already in use" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      updates.push("username = ?");
      values.push(username);
    }
  }

  if (displayName !== undefined && displayName !== null) {
    updates.push("displayName = ?");
    values.push(displayName);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "No fields to update" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  values.push(userId);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
