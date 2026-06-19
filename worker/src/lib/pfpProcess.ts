import { ensureJsquashReady } from "./jsquashInit";
import { sha256HexBytes } from "./sha256";

const MAX_SIDE = 256;
const JPEG_QUALITY = 78;

export type ProcessedPfp = {
  bytes: ArrayBuffer;
  hash: string;
  contentType: "image/jpeg";
};

function isPng(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, 8);
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

function isJpeg(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, 2);
  return b[0] === 0xff && b[1] === 0xd8;
}

async function decodeImage(buffer: ArrayBuffer): Promise<ImageData> {
  if (isJpeg(buffer)) {
    const { default: decode } = await import("@jsquash/jpeg/decode");
    return decode(buffer);
  }
  if (isPng(buffer)) {
    const { default: decode } = await import("@jsquash/png/decode");
    return decode(buffer);
  }
  // Fallback: try JPEG then PNG
  try {
    const { default: decode } = await import("@jsquash/jpeg/decode");
    return decode(buffer);
  } catch {
    const { default: decode } = await import("@jsquash/png/decode");
    return decode(buffer);
  }
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
  if (maxSide <= MAX_SIDE) return image;

  const scale = MAX_SIDE / maxSide;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const { default: resize } = await import("@jsquash/resize");
  return resize(image, { width, height, method: "lanczos3", fitMethod: "stretch" });
}

async function encodeJpeg(image: ImageData): Promise<ArrayBuffer> {
  const { default: encode } = await import("@jsquash/jpeg/encode");
  return encode(image, { quality: JPEG_QUALITY });
}

/**
 * Normalize profile picture bytes: square crop (unless pre-cropped 1:1), downscale only, JPEG.
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
  const bytes = await encodeJpeg(image);
  const hash = await sha256HexBytes(bytes);

  return { bytes, hash, contentType: "image/jpeg" };
}
