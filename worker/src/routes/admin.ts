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

  const sortParam = url.searchParams.get("sort") || "username:asc";
  const sortParts = sortParam.split(":");
  const sortColumn = sortParts[0];
  const sortDir = sortParts[1] === "desc" ? "DESC" : "ASC";

  const allowedSorts: Record<string, string> = {
    username: "username",
    email: "email",
    displayName: "displayName",
    admin_level: "admin_level",
    created_at: "created_at",
  };

  const orderBy = allowedSorts[sortColumn] || "username";
  const orderDir = sortColumn === "admin_level" ? "DESC" : sortDir;

  const countResult = await env.DB.prepare("SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR email LIKE ?")
    .bind(`%${query}%`, `%${query}%`)
    .first();
  const total = (countResult as { total: number }).total || 0;

  const users = await env.DB.prepare(
    `SELECT id, email, username, displayName, pfpUrl, admin_level, created_at FROM users WHERE username LIKE ? OR email LIKE ? ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
  )
    .bind(`%${query}%`, `%${query}%`, pageSize, offset)
    .all();

  // Fetch PFP history for all returned users
  const userIds = ((users.results || []) as { id: string }[]).map((u) => u.id);
  const pfpHistoryMap: Record<string, { id: string; r2Key: string; createdAt: number }[]> = {};
  if (userIds.length > 0) {
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
          // Convert R2 key back to serving URL
          const pfpPath = row.r2_key.replace(/^pfp\//, "/api/user/pfp/");
          pfpHistoryMap[row.user_id].push({ id: row.id, r2Key: pfpPath, createdAt: row.created_at });
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

  await env.DB.prepare("INSERT INTO oauth_clients (id, name, secret, redirect_uri, created_by) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, secret, redirect_uri, admin.id)
    .run();

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

  const client = await env.DB.prepare("SELECT id, created_by FROM oauth_clients WHERE id = ?").bind(clientId).first() as {
    id: string;
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

    const targetUser = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = `pfp/${userId}`;

    // Save current PFP to history
    const current = await env.PFP_BUCKET.get(key);
    if (current) {
      const historyId = crypto.randomUUID();
      const historyKey = `pfp/${userId}/hist/${historyId}`;
      await env.PFP_BUCKET.put(historyKey, await current.arrayBuffer(), {
        httpMetadata: current.httpMetadata,
      });
      await env.DB.prepare(
        "INSERT INTO pfp_history (id, user_id, r2_key, created_at) VALUES (?, ?, ?, unixepoch())",
      ).bind(historyId, userId, historyKey).run();
    }

    await env.PFP_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const pfpUrl = `/api/user/pfp/${userId}`;
    await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(pfpUrl, userId).run();

    return new Response(JSON.stringify({ pfpUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(message, { status: 500, headers: corsHeaders });
  }
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

  const currentKey = `pfp/${userId}`;

  // Save current PFP to history before swapping
  const current = await env.PFP_BUCKET.get(currentKey);
  if (current) {
    const newHistoryId = crypto.randomUUID();
    const newHistoryKey = `pfp/${userId}/hist/${newHistoryId}`;
    await env.PFP_BUCKET.put(newHistoryKey, await current.arrayBuffer(), {
      httpMetadata: current.httpMetadata,
    });
    await env.DB.prepare(
      "INSERT INTO pfp_history (id, user_id, r2_key, created_at) VALUES (?, ?, ?, unixepoch())",
    ).bind(newHistoryId, userId, newHistoryKey).run();
  }

  // Copy history entry back to current
  const historyObject = await env.PFP_BUCKET.get(historyRow.r2_key);
  if (!historyObject) {
    return new Response(JSON.stringify({ error: "History image not found in storage" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await env.PFP_BUCKET.put(currentKey, await historyObject.arrayBuffer(), {
    httpMetadata: historyObject.httpMetadata,
  });

  const pfpUrl = `/api/user/pfp/${userId}`;
  await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(pfpUrl, userId).run();

  return new Response(JSON.stringify({ pfpUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const results: { userId: string; oldUrl: string; success: boolean; error?: string }[] = [];

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

      const contentType = response.headers.get("content-type") || "image/png";
      const buffer = await response.arrayBuffer();
      const key = `pfp/${user.id}`;

      await env.PFP_BUCKET.put(key, buffer, { httpMetadata: { contentType } });

      const newUrl = `/api/user/pfp/${user.id}`;
      await env.DB.prepare("UPDATE users SET pfpUrl = ? WHERE id = ?").bind(newUrl, user.id).run();

      results.push({ userId: user.id, oldUrl: user.pfpUrl, success: true });
    } catch (e) {
      results.push({ userId: user.id, oldUrl: user.pfpUrl, success: false, error: String(e) });
    }
  }

  return new Response(
    JSON.stringify({
      total: rows.length,
      migrated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
