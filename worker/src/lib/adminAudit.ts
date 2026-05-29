import type { Env } from "../types/env";

export type AdminAuditInput = {
  actorId: string;
  actorUsername?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
  success?: boolean;
};

export async function recordAdminAction(env: Env, input: AdminAuditInput): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_username, action, target_type, target_id, details, success, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    )
      .bind(
        id,
        input.actorId,
        input.actorUsername ?? null,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.details ? JSON.stringify(input.details) : null,
        input.success === false ? 0 : 1,
      )
      .run();
  } catch {
    // audit table may not exist yet
  }
}
