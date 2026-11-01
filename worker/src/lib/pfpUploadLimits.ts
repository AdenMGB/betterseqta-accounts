/** Max upload size after client-side WebP compression (or raw on legacy browsers). */
export const PFP_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const IMAGE_EXT =
  /\.(heic|heif|jpe?g|png|gif|webp|bmp|avif|tiff?|svg)$/i;

export function isLikelyImageUpload(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type === "application/octet-stream" || type === "") {
    return IMAGE_EXT.test(file.name);
  }
  return false;
}

export function validatePfpUploadFile(
  file: File,
): { ok: true } | { ok: false; message: string } {
  if (!isLikelyImageUpload(file)) {
    return { ok: false, message: "Invalid file type — upload an image" };
  }
  if (file.size > PFP_MAX_UPLOAD_BYTES) {
    return { ok: false, message: "File too large (max 20MB)" };
  }
  return { ok: true };
}
