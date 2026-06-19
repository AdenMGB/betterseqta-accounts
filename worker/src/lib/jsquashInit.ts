import { init as initJpegDecode } from "@jsquash/jpeg/decode";
import { init as initJpegEncode } from "@jsquash/jpeg/encode";
import { init as initPngDecode } from "@jsquash/png/decode";
import { initResize } from "@jsquash/resize";

// Cloudflare Workers cannot fetch WASM at runtime; static imports let wrangler bundle them.
import JPEG_DEC_WASM from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
import JPEG_ENC_WASM from "@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm";
// @ts-expect-error wasm-bindgen typings omit the default export wrangler expects
import PNG_DEC_WASM from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
// @ts-expect-error wasm-bindgen typings omit the default export wrangler expects
import RESIZE_WASM from "@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm";

let ready: Promise<void> | null = null;

/** One-time WASM init for @jsquash codecs used by profile picture processing. */
export function ensureJsquashReady(): Promise<void> {
  if (!ready) {
    ready = Promise.all([
      initJpegDecode(JPEG_DEC_WASM),
      initJpegEncode(JPEG_ENC_WASM),
      initPngDecode(PNG_DEC_WASM),
      initResize(RESIZE_WASM),
    ]).then(() => undefined);
  }
  return ready;
}
