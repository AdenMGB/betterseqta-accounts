import type { Env } from "../types/env";

export type AuditLogEntry = {
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
};

export type ResolvedAuditTarget = {
  type: string | null;
  id: string | null;
  label: string;
  sublabel?: string;
};

function ctx(details: Record<string, unknown>): Record<string, unknown> {
  const c = details.context;
  return c && typeof c === "object" ? (c as Record<string, unknown>) : {};
}

export function labelFromDetails(entry: AuditLogEntry): ResolvedAuditTarget | null {
  const stored = entry.details.target;
  if (stored && typeof stored === "object") {
    const t = stored as Record<string, unknown>;
    if (typeof t.label === "string" && t.label) {
      return {
        type: (t.type as string) ?? entry.targetType,
        id: (t.id as string) ?? entry.targetId,
        label: t.label,
        sublabel: typeof t.sublabel === "string" ? t.sublabel : undefined,
      };
    }
  }

  const c = ctx(entry.details);
  const type = entry.targetType;

  if (type === "user") {
    const username = c.targetUsername ?? c.username;
    const displayName = c.displayName;
    const email = c.email;
    if (username || displayName) {
      return {
        type,
        id: entry.targetId,
        label: String(displayName || username),
        sublabel: username && displayName ? String(username) : email ? String(email) : entry.targetId ?? undefined,
      };
    }
  }

  if (type === "client") {
    const name = c.name;
    if (name) {
      return {
        type,
        id: entry.targetId,
        label: String(name),
        sublabel: c.clientId ? String(c.clientId) : entry.targetId ?? undefined,
      };
    }
  }

  if (type === "api_key") {
    const name = c.name;
    if (name) {
      return {
        type,
        id: entry.targetId,
        label: String(name),
        sublabel: c.keyId ? String(c.keyId) : entry.targetId ?? undefined,
      };
    }
  }

  if (type === "system") {
    return { type, id: null, label: "System" };
  }

  return null;
}

export async function resolveAuditTargets(
  env: Env,
  entries: AuditLogEntry[],
): Promise<Map<string, ResolvedAuditTarget>> {
  const result = new Map<string, ResolvedAuditTarget>();

  const userIds = [...new Set(entries.filter((e) => e.targetType === "user" && e.targetId).map((e) => e.targetId!))];
  const clientIds = [...new Set(entries.filter((e) => e.targetType === "client" && e.targetId).map((e) => e.targetId!))];
  const keyIds = [...new Set(entries.filter((e) => e.targetType === "api_key" && e.targetId).map((e) => e.targetId!))];

  const userMap = new Map<string, { username: string; displayName: string | null; email: string }>();
  for (const uid of userIds) {
    const row = await env.DB.prepare("SELECT username, displayName, email FROM users WHERE id = ?")
      .bind(uid)
      .first() as { username: string; displayName: string | null; email: string } | null;
    if (row) userMap.set(uid, row);
  }

  const clientMap = new Map<string, string>();
  for (const cid of clientIds) {
    const row = await env.DB.prepare("SELECT name FROM oauth_clients WHERE id = ?").bind(cid).first() as { name: string } | null;
    if (row) clientMap.set(cid, row.name);
  }

  const keyMap = new Map<string, string>();
  for (const kid of keyIds) {
    const row = await env.DB.prepare("SELECT name FROM api_keys WHERE id = ?").bind(kid).first() as { name: string } | null;
    if (row) keyMap.set(kid, row.name);
  }

  for (const entry of entries) {
    const key = `${entry.targetType ?? ""}:${entry.targetId ?? ""}`;
    if (!entry.targetType && !entry.targetId) continue;

    const fromDetails = labelFromDetails(entry);
    if (fromDetails) {
      result.set(key, fromDetails);
      continue;
    }

    if (entry.targetType === "user" && entry.targetId) {
      const user = userMap.get(entry.targetId);
      if (user) {
        result.set(key, {
          type: "user",
          id: entry.targetId,
          label: user.displayName || user.username,
          sublabel: user.displayName ? user.username : user.email,
        });
        continue;
      }
    }

    if (entry.targetType === "client" && entry.targetId) {
      const name = clientMap.get(entry.targetId);
      if (name) {
        result.set(key, { type: "client", id: entry.targetId, label: name, sublabel: entry.targetId });
        continue;
      }
    }

    if (entry.targetType === "api_key" && entry.targetId) {
      const name = keyMap.get(entry.targetId);
      if (name) {
        result.set(key, { type: "api_key", id: entry.targetId, label: name, sublabel: entry.targetId });
        continue;
      }
    }

    if (entry.targetType === "system") {
      result.set(key, { type: "system", id: null, label: "System" });
      continue;
    }

    if (entry.targetId) {
      result.set(key, {
        type: entry.targetType,
        id: entry.targetId,
        label: entry.targetId,
      });
    }
  }

  return result;
}

export function auditTargetForUser(user: {
  id: string;
  username: string;
  displayName?: string | null;
  email?: string;
}): { target: ResolvedAuditTarget } {
  return {
    target: {
      type: "user",
      id: user.id,
      label: user.displayName || user.username,
      sublabel: user.displayName ? user.username : user.email,
    },
  };
}
