import type { Env } from "../types/env";
import { processPfpUpload } from "./pfpProcess";
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

export async function uploadPfpFromFormData(
  env: Env,
  userId: string,
  formData: FormData,
): Promise<{ ok: true; data: PfpUploadResult } | { ok: false; status: number; message: string }> {
  const file = formData.get("file");
  const preCropped = formData.get("preCropped") === "true";

  if (!file || !(file instanceof File)) {
    return { ok: false, status: 400, message: "No file uploaded" };
  }

  const validation = validatePfpUploadFile(file);
  if (!validation.ok) {
    return { ok: false, status: 400, message: validation.message };
  }

  try {
    await saveCurrentPfpToHistory(env, userId);
  } catch {
    /* pfp_history may be missing on old DBs */
  }

  const processed = await processPfpUpload(await file.arrayBuffer(), { preCropped });
  const { pfpUrl, pfpHash } = await putCurrentPfp(env, userId, processed);

  try {
    await prunePfpHistory(env, userId);
  } catch {
    /* ignore */
  }

  const pfpHistory = await getPfpHistoryForUser(env, userId);
  return { ok: true, data: { pfpUrl, pfpHash, pfpHistory } };
}
