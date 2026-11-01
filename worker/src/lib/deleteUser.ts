import type { Env } from "../types/env";

async function tableExists(db: D1Database, name: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .bind(name)
    .first();
  return !!row;
}

async function deletePfpObjectsForUser(env: Env, userId: string): Promise<void> {
  try {
    await env.PFP_BUCKET.delete(`pfp/${userId}`);
  } catch {
    /* ignore missing object */
  }
  const rows = await env.DB.prepare("SELECT r2_key FROM pfp_history WHERE user_id = ?")
    .bind(userId)
    .all<{ r2_key: string }>();
  for (const row of rows.results ?? []) {
    try {
      await env.PFP_BUCKET.delete(row.r2_key);
    } catch {
      /* ignore */
    }
  }
}

/** Remove all D1 (and PFP R2) data for a user so `DELETE FROM users` succeeds. */
export async function deleteUserRecords(env: Env, userId: string): Promise<void> {
  await deletePfpObjectsForUser(env, userId);

  const runOptional = async (sql: string) => {
    try {
      await env.DB.prepare(sql).bind(userId).run();
    } catch {
      /* table/column may be missing on older schemas */
    }
  };

  await runOptional("DELETE FROM tq_relay_share WHERE cloud_user_id = ?");
  await runOptional("DELETE FROM tq_membership WHERE cloud_user_id = ?");
  await env.DB.prepare(
    "UPDATE tq_instance SET coordinator_cloud_user_id = NULL WHERE coordinator_cloud_user_id = ?",
  )
    .bind(userId)
    .run();

  await env.DB.prepare(
    "DELETE FROM pfp_audit_decisions WHERE subject_user_id = ? OR admin_user_id = ?",
  )
    .bind(userId, userId)
    .run()
    .catch(() => undefined);
  await env.DB.prepare(
    "DELETE FROM pfp_audit_admin_views WHERE subject_user_id = ? OR admin_user_id = ?",
  )
    .bind(userId, userId)
    .run()
    .catch(() => undefined);
  await env.DB.prepare(
    "DELETE FROM pfp_audit_acceptances WHERE subject_user_id = ? OR admin_user_id = ?",
  )
    .bind(userId, userId)
    .run()
    .catch(() => undefined);
  await runOptional("DELETE FROM pfp_history WHERE user_id = ?");
  await runOptional("DELETE FROM user_badges WHERE user_id = ?");

  await env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(userId).run();
  await runOptional("DELETE FROM settings_metadata WHERE user_id = ?");
  await runOptional("DELETE FROM bsplus_settings_sync WHERE user_id = ?");
  await env.DB.prepare("DELETE FROM settings WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM oauth_codes WHERE user_id = ?").bind(userId).run();

  if (await tableExists(env.DB, "user_sessions")) {
    await env.DB.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId).run();
  }
  if (await tableExists(env.DB, "desqta_sessions")) {
    await env.DB.prepare("DELETE FROM desqta_sessions WHERE user_id = ?").bind(userId).run();
  }

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
}
