import { parentPort } from "node:worker_threads";
import sharp from "sharp";

const PFP_MAX_SIDE = 512;
const WEBP_QUALITY = 78;

sharp.concurrency(1);

async function processPfpBytes(raw: Buffer): Promise<Buffer> {
  const meta = await sharp(raw).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    throw new Error("Invalid image dimensions");
  }
  const side = Math.min(width, height);
  const left = Math.floor((width - side) / 2);
  const top = Math.floor((height - side) / 2);

  return sharp(raw)
    .extract({ left, top, width: side, height: side })
    .resize(PFP_MAX_SIDE, PFP_MAX_SIDE, { fit: "fill" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

type InMessage = { id: number; buffer: ArrayBuffer };
type OutMessage =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

if (!parentPort) {
  throw new Error("admin-pfp-batch worker must run as a worker thread");
}

parentPort.on("message", (msg: InMessage) => {
  void (async () => {
    try {
      const out = await processPfpBytes(Buffer.from(msg.buffer));
      const reply: OutMessage = {
        id: msg.id,
        ok: true,
        buffer: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
      };
      parentPort!.postMessage(reply);
    } catch (err) {
      const reply: OutMessage = {
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      parentPort!.postMessage(reply);
    }
  })();
});
