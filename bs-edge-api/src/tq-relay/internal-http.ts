import type { Context } from "hono";
import { relayConfig } from "./config.js";
import { handleInternalRevoke } from "./ws-handler.js";
import { normalizeInstanceHost } from "./membership.js";
import { corsHeadersForRequest } from "../cors.js";

function jsonHeaders(req: Request): Record<string, string> {
  return {
    ...corsHeadersForRequest(req),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

export async function handleInternalRevokeHttp(c: Context): Promise<Response> {
  const req = c.req.raw;
  const secret = req.headers.get("X-Edge-Relay-Secret")?.trim();
  if (!secret || secret !== relayConfig.edgeRelaySecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders(req),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 422,
      headers: jsonHeaders(req),
    });
  }
  const payload = body as { instance_host?: unknown; seqta_student_id?: unknown };
  const instanceHost = normalizeInstanceHost(payload.instance_host);
  const seqtaStudentId = payload.seqta_student_id;
  if (!instanceHost || typeof seqtaStudentId !== "number" || !Number.isInteger(seqtaStudentId) || seqtaStudentId <= 0) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 422,
      headers: jsonHeaders(req),
    });
  }

  await handleInternalRevoke(instanceHost, seqtaStudentId);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders(req),
  });
}