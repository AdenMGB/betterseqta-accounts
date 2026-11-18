import { deleteShare } from "./timetable-classmates-relay-store";
import type { Env } from "../types/env";

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

  const edgeSecret = env.EDGE_RELAY_SECRET?.trim();
  const publicBase = (env.APP_URL?.trim() || "https://accounts.betterseqta.org").replace(/\/$/, "");
  if (!edgeSecret) {
    console.error("[tq-relay] EDGE_RELAY_SECRET not set; relay revoke broadcast skipped");
    return;
  }

  try {
    await fetch(`${publicBase}/internal/tq-relay/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Edge-Relay-Secret": edgeSecret,
      },
      body: JSON.stringify({ instance_host: instanceHost, seqta_student_id: seqtaStudentId }),
    });
  } catch (err) {
    console.error("[tq-relay] revoke share broadcast failed", instanceHost, seqtaStudentId, err);
  }
}