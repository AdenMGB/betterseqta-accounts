import { deleteShare } from "./timetable-classmates-relay-store";
import type { Env } from "../types/env";
import { applyTqRelayStubObsHeaders } from "./tq-relay-observability";

/** Drop a student's relay share when they opt out via REST (no WebSocket). */
export async function relayRevokeStudentShare(
  env: Env,
  instanceHost: string,
  seqtaStudentId: number,
): Promise<void> {
  try {
    await deleteShare(env.DB, instanceHost, seqtaStudentId);
  } catch (err) {
    console.error("[tq-relay] revoke share D1 delete failed", instanceHost, seqtaStudentId, err);
  }

  const ns = env.TIMETABLE_CLASSMATES_RELAY;
  if (!ns) return;

  const stub = ns.get(ns.idFromName(instanceHost));
  try {
    const headers = new Headers({
      "X-TQ-Internal-Revoke": "1",
      "X-TQ-Seqta-Student-Id": String(seqtaStudentId),
    });
    applyTqRelayStubObsHeaders(env, instanceHost, headers);
    await stub.fetch(
      new Request("https://tq-relay/internal/revoke", {
        method: "POST",
        headers,
      }),
    );
  } catch (err) {
    console.error("[tq-relay] revoke share broadcast failed", instanceHost, seqtaStudentId, err);
  }
}
