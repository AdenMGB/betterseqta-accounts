import os from "node:os";
import { Worker } from "node:worker_threads";

type OutMessage =
  | { id: number; ok: true; buffer: ArrayBuffer }
  | { id: number; ok: false; error: string };

type Pending = {
  resolve: (buf: Buffer) => void;
  reject: (err: Error) => void;
  worker: Worker | null;
};

/** One sharp pipeline per worker thread — scales with CPU cores. */
export class PfpWorkerPool {
  private workers: Worker[] = [];
  private pending = new Map<number, Pending>();
  private nextId = 0;
  private idle: Worker[] = [];
  private waiters: Array<(worker: Worker) => void> = [];

  constructor(public readonly size: number) {
    const workerUrl = new URL("./admin-pfp-batch.worker.mts", import.meta.url);
    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerUrl, { type: "module" });
      worker.on("message", (msg: OutMessage) => this.onMessage(msg));
      worker.on("error", (err) => this.failAll(err));
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  private onMessage(msg: OutMessage) {
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (entry.worker) this.releaseWorker(entry.worker);
    if (msg.ok) {
      entry.resolve(Buffer.from(msg.buffer));
    } else {
      entry.reject(new Error(msg.error));
    }
  }

  private failAll(err: Error) {
    for (const [, entry] of this.pending) {
      if (entry.worker) this.releaseWorker(entry.worker);
      entry.reject(err);
    }
    this.pending.clear();
  }

  private acquireWorker(): Promise<Worker> {
    const w = this.idle.pop();
    if (w) return Promise.resolve(w);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private releaseWorker(worker: Worker) {
    const next = this.waiters.shift();
    if (next) next(worker);
    else this.idle.push(worker);
  }

  process(raw: Buffer): Promise<Buffer> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, worker: null });
      void this.acquireWorker().then((worker) => {
        const entry = this.pending.get(id);
        if (!entry) {
          this.releaseWorker(worker);
          return;
        }
        entry.worker = worker;
        const copy = Buffer.from(raw);
        const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
        worker.postMessage({ id, buffer: ab }, [ab]);
      });
    });
  }

  async close() {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idle = [];
  }
}

export function defaultJobConcurrency(): number {
  const cpus = os.cpus().length;
  const fromEnv = process.env.PFP_BATCH_JOBS ? Number(process.env.PFP_BATCH_JOBS) : NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(64, Math.floor(fromEnv));
  }
  return Math.min(32, Math.max(4, cpus * 2));
}

export function defaultWorkerCount(): number {
  const cpus = os.cpus().length;
  const fromEnv = process.env.PFP_BATCH_WORKERS ? Number(process.env.PFP_BATCH_WORKERS) : NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(64, Math.floor(fromEnv));
  }
  return Math.max(1, cpus);
}
