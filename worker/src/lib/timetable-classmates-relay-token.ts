import { SignJWT, jwtVerify } from "jose";

const RELAY_TTL = "15m";

export type RelayTokenPayload = {
  typ: "tq_relay";
  instance_host: string;
  cloud_user_id: string;
  seqta_student_id: number;
  share_code: string;
};

export async function createRelayToken(
  payload: RelayTokenPayload,
  jwtSecret: Uint8Array,
): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(RELAY_TTL)
    .sign(jwtSecret);
}

export async function verifyRelayToken(
  token: string,
  jwtSecret: Uint8Array,
): Promise<RelayTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret);
    if (payload.typ !== "tq_relay") return null;
    const instance_host = payload.instance_host;
    const cloud_user_id = payload.cloud_user_id;
    const seqta_student_id = payload.seqta_student_id;
    const share_code = payload.share_code;
    if (
      typeof instance_host !== "string" ||
      typeof cloud_user_id !== "string" ||
      typeof seqta_student_id !== "number" ||
      typeof share_code !== "string"
    ) {
      return null;
    }
    return {
      typ: "tq_relay",
      instance_host,
      cloud_user_id,
      seqta_student_id,
      share_code,
    };
  } catch {
    return null;
  }
}
