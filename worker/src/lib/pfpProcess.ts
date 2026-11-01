import { ensureJsquashReady } from "./jsquashInit";
import { sha256HexBytes } from "./sha256";

export const PFP_MAX_SIDE = 512;
const WEBP_QUALITY = 78;
/** Max bytes for client-prepared uploads (already cropped/resized in browser). */
export const PFP_CLIENT_PROCESSED_MAX_BYTES = 3 * 1024 * 1024;

export type ProcessedPfp = {
  bytes: ArrayBuffer;
  hash: string;
  contentType: "image/webp" | "image/jpeg";
};

function isPng(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, 8);
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function isJpeg(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, 2);
  return b[0] === 0xff && b[1] === 0xd8;
}

function isWebp(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const b = new Uint8Array(buffer, 0, 12);
  return (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  );
}

async function decodeImage(buffer: ArrayBuffer): Promise<ImageData> {
  if (isWebp(buffer)) {
    const { default: decode } = await import("@jsquash/webp/decode");
    return decode(buffer);
  }
  if (isJpeg(buffer)) {
    const { default: decode } = await import("@jsquash/jpeg/decode");
    return decode(buffer);
  }
  if (isPng(buffer)) {
    const { default: decode } = await import("@jsquash/png/decode");
    return decode(buffer);
  }

  const attempts: Array<() => Promise<ImageData>> = [
    async () => {
      const { default: decode } = await import("@jsquash/webp/decode");
      return decode(buffer);
    },
    async () => {
      const { default: decode } = await import("@jsquash/jpeg/decode");
      return decode(buffer);
    },
    async () => {
      const { default: decode } = await import("@jsquash/png/decode");
      return decode(buffer);
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Unsupported image format");
}

/** Center square crop-to-fill: side = min(w, h). */
function centerSquareCrop(image: ImageData): ImageData {
  const { width, height, data } = image;
  if (width === height) return image;

  const side = Math.min(width, height);
  const sx = Math.floor((width - side) / 2);
  const sy = Math.floor((height - side) / 2);
  const out = new Uint8ClampedArray(side * side * 4);

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const src = ((sy + y) * width + (sx + x)) * 4;
      const dst = (y * side + x) * 4;
      out[dst] = data[src]!;
      out[dst + 1] = data[src + 1]!;
      out[dst + 2] = data[src + 2]!;
      out[dst + 3] = data[src + 3]!;
    }
  }

  return new ImageData(out, side, side);
}

async function downscaleIfNeeded(image: ImageData): Promise<ImageData> {
  const maxSide = Math.max(image.width, image.height);
  if (maxSide <= PFP_MAX_SIDE) return image;

  const scale = PFP_MAX_SIDE / maxSide;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const { default: resize } = await import("@jsquash/resize");
  return resize(image, { width, height, method: "lanczos3", fitMethod: "stretch" });
}

async function encodeWebp(image: ImageData): Promise<ArrayBuffer> {
  const { default: encode } = await import("@jsquash/webp/encode");
  return encode(image, { quality: WEBP_QUALITY });
}

/**
 * Normalize profile picture bytes: square crop (unless pre-cropped 1:1), downscale, WebP.
 */
export async function processPfpUpload(
  raw: ArrayBuffer,
  options?: { preCropped?: boolean },
): Promise<ProcessedPfp> {
  await ensureJsquashReady();
  let image = await decodeImage(raw);

  const skipSquare =
    options?.preCropped === true && image.width === image.height;
  if (!skipSquare) {
    image = centerSquareCrop(image);
  }

  image = await downscaleIfNeeded(image);
  const bytes = await encodeWebp(image);
  const hash = await sha256HexBytes(bytes);

  return { bytes, hash, contentType: "image/webp" };
}

/** Store browser-prepared WebP/JPEG without Worker CPU (no decode/resize). */
export async function storeClientProcessedPfp(raw: ArrayBuffer): Promise<ProcessedPfp> {
  if (raw.byteLength === 0) {
    throw new Error("Empty upload");
  }
  if (raw.byteLength > PFP_CLIENT_PROCESSED_MAX_BYTES) {
    throw new Error(`Processed file too large (max ${PFP_CLIENT_PROCESSED_MAX_BYTES} bytes)`);
  }
  if (isWebp(raw)) {
    const hash = await sha256HexBytes(raw);
    return { bytes: raw, hash, contentType: "image/webp" };
  }
  if (isJpeg(raw)) {
    const hash = await sha256HexBytes(raw);
    return { bytes: raw, hash, contentType: "image/jpeg" };
  }
  throw new Error("clientProcessed upload must be WebP or JPEG prepared at 512px square");
}
