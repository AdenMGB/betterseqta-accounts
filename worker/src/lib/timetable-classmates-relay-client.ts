import type { Env } from "../types/env";

/** Drop a student's relay share when they opt out via REST (no WebSocket). */
export async function relayRevokeStudentShare(
  env: Env,
  instanceHost: string,
  seqtaStudentId: number,
): Promise<void> {
  const ns = env.TIMETABLE_CLASSMATES_RELAY;
  if (!ns) return;

  const stub = ns.get(ns.idFromName(instanceHost));
  try {
    await stub.fetch(
      new Request("https://tq-relay/internal/revoke", {
        method: "POST",
        headers: {
          "X-TQ-Internal-Revoke": "1",
          "X-TQ-Seqta-Student-Id": String(seqtaStudentId),
        },
      }),
    );
  } catch (err) {
    console.error("[tq-relay] revoke share failed", instanceHost, seqtaStudentId, err);
  }
}
