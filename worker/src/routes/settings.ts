import { corsHeaders } from "../constants";
import { getUser } from "../lib/auth";
import { sha256HexCanonicalJson, stableStringify } from "../lib/json-stable";
import {
  buildDesqtaDownloadSettings,
  loadAndPersistHydratedDesqta,
  mergeDesqtaPatch,
} from "../lib/settings-store";
import { parseSettingsJson } from "../lib/settings-patch";
import type { RequestContext } from "../types/context";

async function ensureSettingsMetadata(
  env: RequestContext["env"],
  userId: string,
  settingsData: Record<string, unknown>,
): Promise<{ settings_revision: number; settings_updated_at: string } | null> {
  let metaRow = (await env.DB.prepare(
    "SELECT settings_revision, settings_updated_at, content_hash FROM settings_metadata WHERE user_id = ?",
  )
    .bind(userId)
    .first()) as {
    settings_revision: number;
    settings_updated_at: string;
    content_hash: string;
  } | null;

  if (!metaRow) {
    const hash = await sha256HexCanonicalJson(settingsData);
    const isoNow = new Date().toISOString();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO settings_metadata (user_id, settings_revision, settings_updated_at, content_hash) VALUES (?, 1, ?, ?)",
    )
      .bind(userId, isoNow, hash)
      .run();
    metaRow = (await env.DB.prepare(
      "SELECT settings_revision, settings_updated_at, content_hash FROM settings_metadata WHERE user_id = ?",
    )
      .bind(userId)
      .first()) as typeof metaRow;
  }

  return metaRow;
}

export async function handleSettingsSyncInit({ env, request, jwtSecret }: RequestContext): Promise<Response> {
  const syncInitJsonHeaders = { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" };

  const payload = await getUser(request, jwtSecret);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: syncInitJsonHeaders });
  }

  const xUserId = request.headers.get("X-User-ID");
  if (!xUserId || String(xUserId).trim() === "") {
    return new Response(JSON.stringify({ error: "X-User-ID header is required" }), {
      status: 400,
      headers: syncInitJsonHeaders,
    });
  }
  if (String(xUserId) !== String(payload.id)) {
    return new Response(
      JSON.stringify({ error: "Forbidden", detail: "X-User-ID does not match token subject" }),
      { status: 403, headers: syncInitJsonHeaders },
    );
  }

  const userId = payload.id;

  let body: {
    client?: { app?: string };
    local?: { settings_revision?: number; settings?: unknown };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: syncInitJsonHeaders });
  }

  if (!body || typeof body !== "object" || !body.client || !body.local) {
    return new Response(
      JSON.stringify({ error: "Invalid body", detail: "client and local objects are required" }),
      { status: 400, headers: syncInitJsonHeaders },
    );
  }
  if (body.client.app !== "desqta") {
    return new Response(
      JSON.stringify({ error: "Invalid body", detail: 'client.app must be "desqta"' }),
      { status: 400, headers: syncInitJsonHeaders },
    );
  }

  let rClient = body.local.settings_revision;
  if (typeof rClient !== "number" || !Number.isFinite(rClient) || rClient < 0) {
    rClient = 0;
  }
  rClient = Math.floor(rClient);

  try {
    const { hydrated, rowExists } = await loadAndPersistHydratedDesqta(env.DB, userId);

    if (!rowExists) {
      return new Response(
        JSON.stringify({
          status: "no_remote_settings",
          server: { settings_revision: 0, settings_updated_at: null },
          settings: null,
        }),
        { headers: syncInitJsonHeaders },
      );
    }

    const metaRow = await ensureSettingsMetadata(env, userId, hydrated);
    if (!metaRow) {
      return new Response(
        JSON.stringify({
          error: "Settings metadata unavailable",
          detail: "settings_metadata row missing after insert; check migrations",
        }),
        { status: 500, headers: syncInitJsonHeaders },
      );
    }

    const rServer = metaRow.settings_revision;
    const serverInfo = { settings_revision: rServer, settings_updated_at: metaRow.settings_updated_at };

    if (rClient > rServer) {
      return new Response(
        JSON.stringify({
          status: "client_ahead",
          server: serverInfo,
          settings: null,
        }),
        { headers: syncInitJsonHeaders },
      );
    }

    if (rClient === rServer) {
      return new Response(
        JSON.stringify({
          status: "up_to_date",
          server: serverInfo,
          settings: null,
        }),
        { headers: syncInitJsonHeaders },
      );
    }

    const download = buildDesqtaDownloadSettings(hydrated, body.local.settings);

    return new Response(
      JSON.stringify({
        status: "server_has_newer",
        server: serverInfo,
        settings: download.settings,
        settings_format: download.settings_format,
      }),
      { headers: syncInitJsonHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isSchema = /no such table|no such column/i.test(msg);
    return new Response(
      JSON.stringify({
        error: isSchema ? "Database schema outdated. Run migration: pnpm db:migrate:remote" : "Sync failed",
        detail: msg,
      }),
      { status: 500, headers: syncInitJsonHeaders },
    );
  }
}

/** Non-GET/POST returns null so the outer router can fall through (matches original worker). */
export async function handleSettings({ env, request, jwtSecret }: RequestContext): Promise<Response | null> {
  const payload = await getUser(request, jwtSecret);
  if (!payload) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const userId = payload.id;

  try {
    if (request.method === "GET") {
      const existing = await env.DB.prepare("SELECT data FROM settings WHERE user_id = ?").bind(userId).first();
      if (!existing) {
        return new Response("{}", {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { hydrated } = await loadAndPersistHydratedDesqta(env.DB, userId);
      return new Response(JSON.stringify(hydrated), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST") {
      const incoming = (await request.json()) as Record<string, unknown>;
      const existing = await env.DB.prepare("SELECT data FROM settings WHERE user_id = ?").bind(userId).first();
      const stored = parseSettingsJson(existing ? (existing as { data: string }).data : null);
      const { hydrated } = await loadAndPersistHydratedDesqta(env.DB, userId);

      const { merged, effectivePatch, changed } = mergeDesqtaPatch(hydrated, incoming);

      if (!changed) {
        const meta = await ensureSettingsMetadata(env, userId, merged);
        const responseBody = {
          ok: true,
          server: {
            settings_revision: meta?.settings_revision ?? 1,
            settings_updated_at: meta?.settings_updated_at ?? null,
          },
          patch: effectivePatch,
          ...merged,
        };
        return new Response(JSON.stringify(responseBody), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mergedCanonical = stableStringify(merged);
      let existingCanonical: string | null = null;
      if (existing && (existing as { data: string }).data) {
        try {
          existingCanonical = stableStringify(JSON.parse((existing as { data: string }).data));
        } catch {
          existingCanonical = stableStringify(stored);
        }
      } else {
        existingCanonical = stableStringify(stored);
      }
      const unchanged = existing && existingCanonical !== null && mergedCanonical === existingCanonical;

      if (unchanged) {
        const meta = await ensureSettingsMetadata(env, userId, merged);
        const responseBody = {
          ok: true,
          server: {
            settings_revision: meta?.settings_revision ?? 1,
            settings_updated_at: meta?.settings_updated_at ?? null,
          },
          patch: effectivePatch,
          ...merged,
        };
        return new Response(JSON.stringify(responseBody), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mergedString = JSON.stringify(merged);
      const nowIso = new Date().toISOString();
      const contentHash = await sha256HexCanonicalJson(merged);

      await env.DB.batch([
        env.DB.prepare("INSERT OR REPLACE INTO settings (user_id, data) VALUES (?, ?)").bind(userId, mergedString),
        env.DB.prepare(
          `INSERT INTO settings_metadata (user_id, settings_revision, settings_updated_at, content_hash)
               VALUES (?, 1, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
                 settings_revision = settings_metadata.settings_revision + 1,
                 settings_updated_at = excluded.settings_updated_at,
                 content_hash = excluded.content_hash`,
        ).bind(userId, nowIso, contentHash),
      ]);

      const meta = await env.DB.prepare("SELECT settings_revision, settings_updated_at FROM settings_metadata WHERE user_id = ?")
        .bind(userId)
        .first();

      const responseBody = {
        ok: true,
        server: {
          settings_revision: (meta?.settings_revision as number) ?? 1,
          settings_updated_at: (meta?.settings_updated_at as string) ?? nowIso,
        },
        patch: effectivePatch,
        ...merged,
      };

      return new Response(JSON.stringify(responseBody), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isSchema = /no such table|no such column/i.test(msg);
    return new Response(
      JSON.stringify(
        isSchema
          ? { error: "Database schema outdated. Run migration: pnpm db:migrate:remote", detail: msg }
          : { error: msg },
      ),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return null;
}
