import { corsHeaders } from "./constants";
import { runSettingsBootstrapIfNeeded } from "./lib/settings-bootstrap";
import { dispatch } from "./router";
import type { Env } from "./types/env";

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    executionCtx.waitUntil(
      runSettingsBootstrapIfNeeded(env).catch((err) => {
        console.error("[settings-bootstrap] failed", err);
      }),
    );

    const url = new URL(request.url);
    const jwtSecretRaw = env.JWT_SECRET?.trim();
    if (!jwtSecretRaw) {
      return new Response(
        JSON.stringify({
          error: "JWT_SECRET is not configured. Run pnpm cf:dev (syncs .dev.vars) or set JWT_SECRET in .env",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const jwtSecret = new TextEncoder().encode(jwtSecretRaw);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders } });
    }

    const ctx = { env, request, url, jwtSecret };
    const out = await dispatch(ctx);
    if (out !== null) return out;
    return env.ASSETS.fetch(request);
  },
};
