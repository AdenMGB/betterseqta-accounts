import bcrypt from "bcryptjs";
import { corsHeaders } from "../constants";
import {
  getAdminUser,
  getAdminUserWithLevel,
  getMaxAdminLevel,
} from "../lib/auth";
import { sendPasswordResetEmail } from "../lib/email";
import { recordAdminAction, AUDIT_HIDE_NOOP_UPDATES, isDisplayableAuditEntry } from "../lib/adminAudit";
import { buildPfpAuditContext, resolvePfpAuditRefs, type PfpAuditRef } from "../lib/auditPfpResolve";
import { auditTargetForUser, labelFromDetails, resolveAuditTargets } from "../lib/auditTarget";
import { processPfpUpload } from "../lib/pfpProcess";
import {
  buildUserPfpUrl,
  clearUserPfp,
  getAppBaseUrl,
  getPfpHistoryForUser,
  hasCurrentPfpBlob,
  prunePfpHistory,
  putCurrentPfp,
  pfpRefFromArchivedHistory,
  r2KeyToPfpUrl,
  saveCurrentPfpToHistory,
} from "../lib/pfpHistory";
import type { RequestContext } from "../types/context";

async function audit(
  env: RequestContext["env"],
  admin: { id?: string; username?: string },
  input: Omit<Parameters<typeof recordAdminAction>[1], "actorId" | "actorUsername">,
) {
  await recordAdminAction(env, {
    actorId: admin.id!,
    actorUsername: admin.username ?? null,
    ...input,
  });
}

export async function handleAdminUsers({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = 50;
  const offset = (page - 1) * pageSize;
  const hasPfp = url.searchParams.get("has_pfp") === "true";
  const includeHistory = url.searchParams.get("include_history") !== "false";

  const sortParam = url.searchParams.get("sort") || "username:asc";
  const sortParts = sortParam.split(":");
  const sortColumn = sortParts[0];
  const sortDir = sortParts[1] === "desc" ? "DESC" : "ASC";

  const allowedSorts: Record<string, string> = {
    username: "username",
    email: "email",
    displayName: "displayName",
    admin_level: "admin_level",
    created_at: "createdAt",
  };

  const orderBy = allowedSorts[sortColumn] || "username";
  const orderDir = sortColumn === "admin_level" ? "DESC" : sortDir;

  const conditions: string[] = [];
  const params: unknown[] = [];

  conditions.push("(username LIKE ? OR email LIKE ?)");
  params.push(`%${query}%`, `%${query}%`);

  if (hasPfp) {
    conditions.push("pfpUrl IS NOT NULL AND pfpUrl != ''");
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
  )
    .bind(...params)
    .first();
  const total = (countResult as { total: number }).total || 0;

  const users = await env.DB.prepare(
    `SELECT id, email, username, displayName, pfpUrl, admin_level, createdAt FROM users WHERE ${whereClause} ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();

  const userIds = ((users.results || []) as { id: string }[]).map((u) => u.id);
  const pfpHistoryMap: Record<string, { id: string; r2Key: string; createdAt: number }[]> = {};
  if (includeHistory && userIds.length > 0) {
    try {
      const placeholders = userIds.map(() => "?").join(",");
      const historyRows = await env.DB.prepare(
        `SELECT id, user_id, r2_key, created_at FROM pfp_history WHERE user_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`,
      )
        .bind(...userIds, userIds.length * 3)
        .all();
      for (const row of (historyRows.results || []) as { id: string; user_id: string; r2_key: string; created_at: number }[]) {
        if (!pfpHistoryMap[row.user_id]) pfpHistoryMap[row.user_id] = [];
        if (pfpHistoryMap[row.user_id].length < 3) {
          pfpHistoryMap[row.user_id].push({
            id: row.id,
            r2Key: r2KeyToPfpUrl(row.r2_key, env),
            createdAt: row.created_at,
          });
        }
      }
    } catch {
      // pfp_history table may not exist yet
    }
  }

  const usersWithPfp = ((users.results || []) as { id: string; pfpUrl?: string }[]).map((u) => ({
    ...u,
    pfpHistory: pfpHistoryMap[u.id] || [],
  }));

  const maxAdminLevel = await getMaxAdminLevel(env);

  return new Response(
    JSON.stringify({
      users: usersWithPfp,
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

  const targetUser = await env.DB.prepare("SELECT admin_level, username, displayName, email FROM users WHERE id = ?").bind(userId).first() as {
    admin_level: number;
    username: string;
    displayName: string | null;
    email: string;
  } | null;
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
      await audit(env, admin, {
        action: "user.promote",
        targetType: "user",
        targetId: userId!,
        details: { context: { fromLevel: currentTargetLevel, toLevel: adminLevel, targetUsername: targetUser.username }, error: "Only Senior Admins can promote regular users to admin" },
        success: false,
      });
      return new Response(JSON.stringify({ error: "Only Senior Admins can promote regular users to admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (adminLevel! > adminLevelNum) {
      await audit(env, admin, {
        action: "user.promote",
        targetType: "user",
        targetId: userId!,
        details: { context: { fromLevel: currentTargetLevel, toLevel: adminLevel, targetUsername: targetUser.username }, error: "Cannot promote user to a level higher than your own" },
        success: false,
      });
      return new Response(JSON.stringify({ error: "Cannot promote user to a level higher than your own" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else if (adminLevel! < currentTargetLevel) {
    if (currentTargetLevel >= adminLevelNum) {
      await audit(env, admin, {
        action: "user.demote",
        targetType: "user",
        targetId: userId!,
        details: { context: { fromLevel: currentTargetLevel, toLevel: adminLevel, targetUsername: targetUser.username }, error: "Cannot demote users at your level or higher" },
        success: false,
      });
      return new Response(JSON.stringify({ error: "Cannot demote users at your level or higher" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  await env.DB.prepare("UPDATE users SET admin_level = ? WHERE id = ?").bind(adminLevel, userId).run();

  const action = adminLevel! < currentTargetLevel ? "user.demote" : "user.promote";
  await audit(env, admin, {
    action,
    targetType: "user",
    targetId: userId!,
    details: {
      ...auditTargetForUser({ id: userId!, username: targetUser.username, displayName: targetUser.displayName, email: targetUser.email }),
      context: { fromLevel: currentTargetLevel, toLevel: adminLevel, targetUsername: targetUser.username },
    },
    success: true,
  });

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

  const user = (await env.DB.prepare("SELECT id, email, username, displayName FROM users WHERE id = ?").bind(userId).first()) as {
    id: string;
    email: string;
    username: string;
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
    await audit(env, admin, {
      action: "user.password_reset",
      targetType: "user",
      targetId: user.id,
      details: { context: { email: user.email, username: user.username, displayName: user.displayName || null }, error: "Failed to send reset email" },
      success: false,
    });
    return new Response(JSON.stringify({ error: "Failed to send reset email" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await audit(env, admin, {
    action: "user.password_reset",
    targetType: "user",
    targetId: user.id,
    details: {
      ...auditTargetForUser(user),
      context: { email: user.email, username: user.username, displayName: user.displayName || null },
    },
    success: true,
  });

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

  const targetUser = await env.DB.prepare("SELECT id, admin_level, email, username, displayName FROM users WHERE id = ?").bind(userId).first() as {
    id: string;
    admin_level: number;
    email: string;
    username: string;
    displayName?: string;
  } | null;
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
    await audit(env, admin, {
      action: "user.delete",
      targetType: "user",
      targetId: userId,
      details: { context: { email: targetUser.email, username: targetUser.username, displayName: targetUser.displayName }, error: "Failed to delete user" },
      success: false,
    });
    return new Response(JSON.stringify({ error: "Failed to delete user" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await audit(env, admin, {
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    details: {
      ...auditTargetForUser({ id: userId, username: targetUser.username, displayName: targetUser.displayName ?? null, email: targetUser.email }),
      context: { email: targetUser.email, username: targetUser.username, displayName: targetUser.displayName },
    },
    success: true,
  });

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

  await env.DB.prepare("INSERT INTO oauth_clients (id, name, secret, redirect_uri, created_by) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, secret, redirect_uri, admin.id)
    .run();

  await audit(env, admin, {
    action: "client.create",
    targetType: "client",
    targetId: id,
    details: { context: { clientId: id, name, redirectUri: redirect_uri } },
    success: true,
  });

  return new Response(JSON.stringify({ id, name, secret, redirect_uri, created_by: admin.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminClientsDelete({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { clientId } = (await request.json()) as { clientId?: string };
  if (!clientId) {
    return new Response(JSON.stringify({ error: "clientId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = await env.DB.prepare("SELECT id, name, created_by FROM oauth_clients WHERE id = ?").bind(clientId).first() as {
    id: string;
    name: string;
    created_by?: string | null;
  } | null;

  if (!client) {
    return new Response(JSON.stringify({ error: "Client not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const maxAdminLevel = await getMaxAdminLevel(env);
  const currentLevel = await (async () => {
    const row = await env.DB.prepare("SELECT admin_level FROM users WHERE id = ?").bind(admin.id).first();
    return (row as { admin_level: number } | null)?.admin_level || 0;
  })();

  const isSeniorAdmin = currentLevel >= maxAdminLevel;
  const isCreator = client.created_by === admin.id;

  if (!isSeniorAdmin && !isCreator) {
    return new Response(
      JSON.stringify({ error: "You can only delete clients you created. Contact a Senior Admin." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  await env.DB.prepare("DELETE FROM oauth_codes WHERE client_id = ?").bind(clientId).run();
  await env.DB.prepare("DELETE FROM oauth_clients WHERE id = ?").bind(clientId).run();

  await audit(env, admin, {
    action: "client.delete",
    targetType: "client",
    targetId: clientId,
    details: { context: { clientId, name: client.name } },
    success: true,
  });

  return new Response(JSON.stringify({ success: true }), {
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

  await audit(env, admin, {
    action: "api_key.create",
    targetType: "api_key",
    targetId: id,
    details: { context: { keyId: id, name: name.trim() } },
    success: true,
  });

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
  const keyRow = await env.DB.prepare("SELECT id, name FROM api_keys WHERE id = ?").bind(id).first() as {
    id: string;
    name: string;
  } | null;

  const result = await env.DB.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "API key not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await audit(env, admin, {
    action: "api_key.delete",
    targetType: "api_key",
    targetId: id,
    details: { context: { keyId: id, name: keyRow?.name ?? id } },
    success: true,
  });

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

  const targetUser = (await env.DB.prepare("SELECT id, email, username, displayName FROM users WHERE id = ?").bind(userId).first()) as {
    id: string;
    email: string;
    username: string;
    displayName?: string | null;
  } | null;
  if (!targetUser) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const changes: Record<string, { from: string; to: string }> = {};

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
      changes.email = { from: targetUser.email, to: normalizedEmail };
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
      changes.username = { from: targetUser.username, to: username };
    }
  }

  if (displayName !== undefined && displayName !== null) {
    const prev = targetUser.displayName ?? "";
    if (displayName !== prev) {
      changes.displayName = { from: prev, to: displayName };
      updates.push("displayName = ?");
      values.push(displayName);
    }
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ success: true, unchanged: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  values.push(userId);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  await audit(env, admin, {
    action: "user.update",
    targetType: "user",
    targetId: userId,
    details: {
      ...auditTargetForUser({ id: userId, username: targetUser.username, displayName: targetUser.displayName ?? null, email: targetUser.email }),
      context: { changes, targetUsername: targetUser.username },
    },
    success: true,
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminUserPfpGet({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if ((admin.adminLevel || 0) < 2) {
    return new Response(JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = url.searchParams.get("userId");
  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userRow = await env.DB.prepare("SELECT pfpUrl, pfp_hash FROM users WHERE id = ?")
    .bind(userId)
    .first() as { pfpUrl: string | null; pfp_hash: string | null } | null;

  if (!userRow) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const pfpHistory = await getPfpHistoryForUser(env, userId);

  return new Response(JSON.stringify({
    pfpUrl: userRow.pfpUrl,
    pfpHash: userRow.pfp_hash,
    pfpHistory,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminUserPfpUpload({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if ((admin.adminLevel || 0) < 2) {
    return new Response(JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string | null;
    const file = formData.get("file");

    if (!userId || !file || !(file instanceof File)) {
      return new Response("Missing userId or file", { status: 400, headers: corsHeaders });
    }

    if (!file.type.startsWith("image/")) {
      return new Response("Invalid file type", { status: 400, headers: corsHeaders });
    }
    if (file.size > 5 * 1024 * 1024) {
      return new Response("File too large (max 5MB)", { status: 400, headers: corsHeaders });
    }

    const targetUser = await env.DB.prepare("SELECT id, username, displayName, email FROM users WHERE id = ?").bind(userId).first() as {
      id: string;
      username: string;
      displayName: string | null;
      email: string;
    } | null;
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const preCropped = formData.get("preCropped") === "true";

    const archivedHistoryId = await saveCurrentPfpToHistory(env, userId);
    const fromRef = pfpRefFromArchivedHistory(archivedHistoryId, archivedHistoryId !== null);

    const processed = await processPfpUpload(await file.arrayBuffer(), { preCropped });
    const { pfpUrl, pfpHash } = await putCurrentPfp(env, userId, processed);

    await prunePfpHistory(env, userId);

    const pfpHistory = await getPfpHistoryForUser(env, userId);

    await audit(env, admin, {
      action: "pfp.upload",
      targetType: "user",
      targetId: userId,
      details: {
        ...(targetUser ? auditTargetForUser(targetUser) : {}),
        context: buildPfpAuditContext(fromRef, { slot: "current" }),
      },
      success: true,
    });

    return new Response(JSON.stringify({ pfpUrl, pfpHash, pfpHistory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await audit(env, admin, {
      action: "pfp.upload",
      targetType: "user",
      targetId: undefined,
      details: { error: message },
      success: false,
    });
    return new Response(message, { status: 500, headers: corsHeaders });
  }
}

export async function handleAdminUserPfpClear({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if ((admin.adminLevel || 0) < 2) {
    return new Response(JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const hadBlob = await hasCurrentPfpBlob(env, userId);
  const { archivedHistoryId, hadPfp } = await clearUserPfp(env, userId);
  const pfpHistory = await getPfpHistoryForUser(env, userId);

  const fromRef = pfpRefFromArchivedHistory(archivedHistoryId, hadBlob || hadPfp);
  const targetUser = await env.DB.prepare("SELECT id, username, displayName, email FROM users WHERE id = ?").bind(userId).first() as {
    id: string;
    username: string;
    displayName: string | null;
    email: string;
  } | null;

  await audit(env, admin, {
    action: "pfp.clear",
    targetType: "user",
    targetId: userId,
    details: {
      ...(targetUser ? auditTargetForUser(targetUser) : {}),
      context: buildPfpAuditContext(fromRef, { slot: "cleared" }),
    },
    success: true,
  });

  return new Response(JSON.stringify({ pfpUrl: null, pfpHash: null, pfpHistory }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminUserPfpRevert({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  if ((admin.adminLevel || 0) < 2) {
    return new Response(JSON.stringify({ error: "Moderator controls require Middle Admin level (2) or higher" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId, historyId } = (await request.json()) as { userId?: string; historyId?: string };

  if (!userId || !historyId) {
    return new Response(JSON.stringify({ error: "userId and historyId are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const historyRow = await env.DB.prepare(
    "SELECT id, r2_key FROM pfp_history WHERE id = ? AND user_id = ?",
  ).bind(historyId, userId).first() as { id: string; r2_key: string } | null;

  if (!historyRow) {
    return new Response(JSON.stringify({ error: "History entry not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const historyObject = await env.PFP_BUCKET.get(historyRow.r2_key);
  if (!historyObject) {
    return new Response(JSON.stringify({ error: "History image not found in storage" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const archivedHistoryId = await saveCurrentPfpToHistory(env, userId);
  const fromRef = pfpRefFromArchivedHistory(archivedHistoryId, archivedHistoryId !== null);

  const processed = await processPfpUpload(await historyObject.arrayBuffer());
  const { pfpUrl, pfpHash } = await putCurrentPfp(env, userId, processed);

  await env.PFP_BUCKET.delete(historyRow.r2_key);
  await env.DB.prepare("DELETE FROM pfp_history WHERE id = ?").bind(historyId).run();

  await prunePfpHistory(env, userId);

  const pfpHistory = await getPfpHistoryForUser(env, userId);
  const targetUser = await env.DB.prepare("SELECT id, username, displayName, email FROM users WHERE id = ?").bind(userId).first() as {
    id: string;
    username: string;
    displayName: string | null;
    email: string;
  } | null;

  await audit(env, admin, {
    action: "pfp.restore",
    targetType: "user",
    targetId: userId,
    details: {
      ...(targetUser ? auditTargetForUser(targetUser) : {}),
      context: buildPfpAuditContext(fromRef, { slot: "current" }),
    },
    success: true,
  });

  return new Response(JSON.stringify({ pfpUrl, pfpHash, pfpHistory }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleAdminFixPfpUrls({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const maxAdminLevel = await getMaxAdminLevel(env);
  if ((admin.adminLevel || 0) < maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Only Senior Admins can fix PFP URLs" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const baseUrl = getAppBaseUrl(env);

  const users = await env.DB.prepare(
    "SELECT id, pfpUrl FROM users WHERE pfpUrl LIKE ?",
  )
    .bind("/api/user/pfp/%")
    .all();

  const rows = (users.results || []) as { id: string; pfpUrl: string }[];
  const results: { userId: string; oldUrl: string; newUrl: string; success: boolean }[] = [];

  for (const user of rows) {
    try {
      if (user.pfpUrl.startsWith(baseUrl)) {
        results.push({ userId: user.id, oldUrl: user.pfpUrl, newUrl: user.pfpUrl, success: true });
        continue;
      }
      const newUrl = `${baseUrl}${user.pfpUrl}`;
      await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(newUrl, user.id).run();
      results.push({ userId: user.id, oldUrl: user.pfpUrl, newUrl, success: true });
    } catch (e) {
      results.push({ userId: user.id, oldUrl: user.pfpUrl, newUrl: "", success: false });
    }
  }

  const payload = {
    total: rows.length,
    fixed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  await audit(env, admin, {
    action: "pfp.fix_urls",
    targetType: "system",
    targetId: null,
    details: {
      context: {
        total: payload.total,
        fixed: payload.fixed,
        failed: payload.failed,
        succeeded: payload.fixed,
      },
    },
    success: true,
  });

  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function handleAdminMigratePfps({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const maxAdminLevel = await getMaxAdminLevel(env);
  if ((admin.adminLevel || 0) < maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Only Senior Admins can migrate profile pictures" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const users = await env.DB.prepare(
    "SELECT id, pfpUrl FROM users WHERE pfpUrl IS NOT NULL AND pfpUrl != '' AND pfpUrl NOT LIKE ?",
  )
    .bind("/api/user/pfp/%")
    .all();

  const rows = (users.results || []) as { id: string; pfpUrl: string }[];
  const results: { userId: string; oldUrl: string; success: boolean; error?: string; pfpHash?: string }[] = [];

  for (const user of rows) {
    try {
      const response = await fetch(user.pfpUrl);
      if (!response.ok) {
        results.push({
          userId: user.id,
          oldUrl: user.pfpUrl,
          success: false,
          error: `Download failed: HTTP ${response.status}`,
        });
        continue;
      }

      const buffer = await response.arrayBuffer();
      const processed = await processPfpUpload(buffer);
      await putCurrentPfp(env, user.id, processed);

      results.push({
        userId: user.id,
        oldUrl: user.pfpUrl,
        success: true,
        pfpHash: processed.hash,
      });
    } catch (e) {
      results.push({ userId: user.id, oldUrl: user.pfpUrl, success: false, error: String(e) });
    }
  }

  const payload = {
    total: rows.length,
    migrated: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  await audit(env, admin, {
    action: "pfp.migrate",
    targetType: "system",
    targetId: null,
    details: {
      context: {
        total: payload.total,
        migrated: payload.migrated,
        failed: payload.failed,
        succeeded: payload.migrated,
      },
    },
    success: true,
  });

  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function handleAdminPrunePfpHistory({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const maxAdminLevel = await getMaxAdminLevel(env);
  if ((admin.adminLevel || 0) < maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Only Senior Admins can prune PFP history" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userRows = await env.DB.prepare("SELECT DISTINCT user_id FROM pfp_history").all();
  const userIds = ((userRows.results || []) as { user_id: string }[]).map((r) => r.user_id);
  let rowsDeleted = 0;

  for (const userId of userIds) {
    rowsDeleted += await prunePfpHistory(env, userId);
  }

  await audit(env, admin, {
    action: "pfp.prune_history",
    targetType: "system",
    targetId: null,
    details: {
      context: {
        usersProcessed: userIds.length,
        rowsDeleted,
        total: userIds.length,
        succeeded: userIds.length,
        failed: 0,
      },
    },
    success: true,
  });

  return new Response(JSON.stringify({ usersProcessed: userIds.length, rowsDeleted }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function auditSummaryFromDetails(details: Record<string, unknown>): string {
  const ctx = details.context as Record<string, unknown> | undefined;
  if (ctx && typeof ctx === "object") {
    const parts: string[] = [];
    if (typeof ctx.changes === "string") parts.push(ctx.changes);
    if (typeof ctx.targetUsername === "string") parts.push(ctx.targetUsername);
    if (typeof ctx.total === "number") parts.push(`${ctx.total} total`);
    if (parts.length) return parts.join(" · ");
  }
  if (typeof details.error === "string") return details.error;
  const label = details.displayName ?? details.username ?? details.email;
  if (typeof label === "string") return label;
  return "";
}

export async function handleAdminProcessPfps({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUserWithLevel(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const maxAdminLevel = await getMaxAdminLevel(env);
  if ((admin.adminLevel || 0) < maxAdminLevel) {
    return new Response(JSON.stringify({ error: "Only Senior Admins can process profile pictures" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { offset?: number; limit?: number; includeHistory?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const offset = Math.max(0, body.offset ?? 0);
  const limit = Math.min(50, Math.max(1, body.limit ?? 20));
  const includeHistory = body.includeHistory === true;

  const userRows = await env.DB.prepare(
    `SELECT id, pfp_hash FROM users
     WHERE pfpUrl IS NOT NULL AND pfpUrl != '' AND pfpUrl LIKE '%/api/user/pfp/%' AND pfpUrl NOT LIKE '%/hist/%'
     ORDER BY id LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();

  const users = (userRows.results || []) as { id: string; pfp_hash: string | null }[];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const currentKey = `pfp/${user.id}`;
    const current = await env.PFP_BUCKET.get(currentKey);

    if (!current) {
      if (user.pfp_hash) {
        await env.DB.prepare("UPDATE users SET pfp_hash = NULL WHERE id = ?").bind(user.id).run();
      }
      skipped++;
      continue;
    }

    if (user.pfp_hash) {
      skipped++;
      continue;
    }

    try {
      const processedPfp = await processPfpUpload(await current.arrayBuffer());
      await putCurrentPfp(env, user.id, processedPfp);
      processed++;
    } catch {
      failed++;
    }

    if (includeHistory) {
      const histRows = await env.DB.prepare(
        "SELECT r2_key FROM pfp_history WHERE user_id = ?",
      )
        .bind(user.id)
        .all();
      for (const row of (histRows.results || []) as { r2_key: string }[]) {
        try {
          const obj = await env.PFP_BUCKET.get(row.r2_key);
          if (!obj) continue;
          const histProcessed = await processPfpUpload(await obj.arrayBuffer());
          await env.PFP_BUCKET.put(row.r2_key, histProcessed.bytes, {
            httpMetadata: { contentType: histProcessed.contentType },
          });
        } catch {
          // ignore per-history failures
        }
      }
    }
  }

  const nextOffset = users.length < limit ? null : offset + limit;

  return new Response(
    JSON.stringify({ processed, skipped, failed, nextOffset }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function handleAdminAuditLog({ env, request, url, jwtSecret }: RequestContext): Promise<Response> {
  const admin = await getAdminUser(env, request, jwtSecret);
  if (!admin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const light = url.searchParams.get("light") !== "false";
  const since = parseInt(url.searchParams.get("since") || "0", 10);
  const cursor = url.searchParams.get("cursor") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const actionFilter = url.searchParams.get("action") || "";
  const actorFilter = url.searchParams.get("actor_id") || "";
  const q = url.searchParams.get("q") || "";

  const conditions: string[] = [AUDIT_HIDE_NOOP_UPDATES];
  const params: unknown[] = [];

  if (actionFilter) {
    conditions.push("action = ?");
    params.push(actionFilter);
  }
  if (actorFilter) {
    conditions.push("actor_id = ?");
    params.push(actorFilter);
  }
  if (q) {
    conditions.push("(actor_username LIKE ? OR target_id LIKE ? OR details LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (since > 0) {
    conditions.push("created_at >= ?");
    params.push(since);
  } else if (cursor) {
    const [cursorTs, cursorId] = cursor.split(":");
    const ts = parseInt(cursorTs || "0", 10);
    if (ts > 0 && cursorId) {
      conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
      params.push(ts, ts, cursorId);
    }
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const useOffset = since <= 0 && !cursor && page > 1;
  const offset = useOffset ? (page - 1) * limit : 0;

  const countRow = since <= 0 && !cursor
    ? await env.DB.prepare(`SELECT COUNT(*) as total FROM admin_audit_log ${where}`)
        .bind(...params)
        .first()
    : null;
  const total = since > 0 || cursor ? 0 : (countRow as { total: number })?.total || 0;

  const rows = await env.DB.prepare(
    `SELECT id, actor_id, actor_username, action, target_type, target_id, details, success, created_at
     FROM admin_audit_log ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, since > 0 ? Math.min(limit, 50) : limit, offset)
    .all();

  type AuditRow = {
    id: string;
    actor_id: string;
    actor_username: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    details: string | null;
    success: number;
    created_at: number;
  };

  const parsedRows = ((rows.results || []) as AuditRow[]).map((row) => {
    let details: Record<string, unknown> = {};
    if (row.details) {
      try {
        details = JSON.parse(row.details);
      } catch {
        details = {};
      }
    }
    return {
      id: row.id,
      actorId: row.actor_id,
      actorUsername: row.actor_username,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      success: row.success === 1,
      createdAt: row.created_at,
      details,
    };
  }).filter(isDisplayableAuditEntry);

  const rawEntries = parsedRows.map((row) => {
    const base = {
      id: row.id,
      actorId: row.actorId,
      actorUsername: row.actorUsername,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      success: row.success,
      createdAt: row.createdAt,
    };
    if (light) {
      const target = labelFromDetails({
        targetType: row.targetType,
        targetId: row.targetId,
        details: row.details,
      });
      return {
        ...base,
        details: row.details,
        summary: auditSummaryFromDetails(row.details),
        ...(target ? { target } : {}),
      };
    }
    return {
      ...base,
      details: row.details,
    };
  });

  let entries: typeof rawEntries = rawEntries;

  if (!light) {
    const fullEntries = rawEntries as (typeof rawEntries[number] & { details: Record<string, unknown> })[];
    const targetMap = await resolveAuditTargets(
      env,
      fullEntries.map((e) => ({
        targetType: e.targetType,
        targetId: e.targetId,
        details: e.details,
      })),
    );

    const entriesWithTarget = fullEntries.map((entry) => {
      const key = `${entry.targetType ?? ""}:${entry.targetId ?? ""}`;
      const target = targetMap.get(key);
      return target ? { ...entry, target } : entry;
    });

    const pfpUserIds = [
      ...new Set(
        entriesWithTarget
          .filter((e) => e.action.startsWith("pfp.") && e.targetType === "user" && e.targetId)
          .map((e) => e.targetId as string),
      ),
    ];

    const stackMap: Record<string, { pfpUrl: string | null; pfpHistory: Awaited<ReturnType<typeof getPfpHistoryForUser>> }> = {};
    for (const uid of pfpUserIds) {
      const userRow = await env.DB.prepare("SELECT pfpUrl FROM users WHERE id = ?").bind(uid).first() as
        | { pfpUrl: string | null }
        | null;
      stackMap[uid] = {
        pfpUrl: userRow?.pfpUrl ?? null,
        pfpHistory: await getPfpHistoryForUser(env, uid),
      };
    }

    entries = entriesWithTarget.map((entry) => {
      if (!entry.action.startsWith("pfp.") || entry.targetType !== "user" || !entry.targetId) {
        return entry;
      }
      const ctx = entry.details?.context as { from?: unknown; to?: unknown } | undefined;
      if (!ctx?.from || !ctx?.to) return entry;
      const stack = stackMap[entry.targetId];
      if (!stack) return entry;
      const contextResolved = resolvePfpAuditRefs(entry.targetId, ctx as { from: PfpAuditRef; to: PfpAuditRef }, {
        userId: entry.targetId,
        pfpUrl: stack.pfpUrl,
        pfpHistory: stack.pfpHistory,
      });
      return { ...entry, contextResolved };
    }) as typeof rawEntries;
  }

  const last = rawEntries[rawEntries.length - 1];
  const nextCursor =
    rawEntries.length >= limit && last ? `${last.createdAt}:${last.id}` : null;

  const payload: Record<string, unknown> = {
    entries,
    nextCursor,
    hasMore: nextCursor !== null,
  };

  if (since <= 0 && !cursor) {
    payload.total = total;
    payload.page = page;
    payload.pageSize = limit;
    payload.totalPages = Math.ceil(total / limit);
  }

  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
