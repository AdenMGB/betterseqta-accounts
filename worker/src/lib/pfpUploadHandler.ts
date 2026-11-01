import type { Env } from "../types/env";
import { storeClientProcessedPfp } from "./pfpProcess";
import { validatePfpUploadFile } from "./pfpUploadLimits";
import {
  getPfpHistoryForUser,
  prunePfpHistory,
  putCurrentPfp,
  saveCurrentPfpToHistory,
  type PfpHistoryEntry,
} from "./pfpHistory";

export type PfpUploadResult = {
  pfpUrl: string;
  pfpHash: string;
  pfpHistory: PfpHistoryEntry[];
};

const CLIENT_REQUIRED_MSG =
  "Profile pictures must be prepared in the browser (512px square WebP/JPEG) with clientProcessed=true. Server-side image encoding is disabled.";

export async function uploadPfpFromFormData(
  env: Env,
  userId: string,
  formData: FormData,
  options?: { skipArchiveCurrent?: boolean },
): Promise<{ ok: true; data: PfpUploadResult } | { ok: false; status: number; message: string }> {
  const file = formData.get("file");
  const clientProcessed = formData.get("clientProcessed") === "true";

  if (!file || !(file instanceof File)) {
    return { ok: false, status: 400, message: "No file uploaded" };
  }

  if (!clientProcessed) {
    return { ok: false, status: 400, message: CLIENT_REQUIRED_MSG };
  }

  const validation = validatePfpUploadFile(file);
  if (!validation.ok) {
    return { ok: false, status: 400, message: validation.message };
  }

  try {
    if (!options?.skipArchiveCurrent) {
      await saveCurrentPfpToHistory(env, userId);
    }
  } catch {
    /* pfp_history may be missing on old DBs */
  }

  let processed;
  try {
    processed = await storeClientProcessedPfp(await file.arrayBuffer());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 400, message };
  }

  const { pfpUrl, pfpHash } = await putCurrentPfp(env, userId, processed);

  try {
    await prunePfpHistory(env, userId);
  } catch {
    /* ignore */
  }

  const pfpHistory = await getPfpHistoryForUser(env, userId);
  return { ok: true, data: { pfpUrl, pfpHash, pfpHistory } };
}

/** Re-store existing R2 bytes without re-encoding (revert / audit restore). */
export async function restagePfpBytes(
  env: Env,
  userId: string,
  raw: ArrayBuffer,
  options?: { skipArchiveCurrent?: boolean },
): Promise<PfpUploadResult> {
  if (!options?.skipArchiveCurrent) {
    await saveCurrentPfpToHistory(env, userId);
  }
  const processed = await storeClientProcessedPfp(raw);
  const { pfpUrl, pfpHash } = await putCurrentPfp(env, userId, processed);
  await prunePfpHistory(env, userId);
  const pfpHistory = await getPfpHistoryForUser(env, userId);
  return { pfpUrl, pfpHash, pfpHistory };
}
