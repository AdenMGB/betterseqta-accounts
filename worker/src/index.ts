import { corsHeaders } from "./constants";
import { dispatch } from "./router";
import type { Env } from "./types/env";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...corsHeaders } });
    }

    const ctx = { env, request, url, jwtSecret };
    const out = await dispatch(ctx);
    if (out !== null) return out;
    return env.ASSETS.fetch(request);
  },
};
