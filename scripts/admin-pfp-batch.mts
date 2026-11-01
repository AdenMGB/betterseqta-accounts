/**
 * Batch-encode hosted profile pictures on a senior admin machine (not on Cloudflare Worker).
 *
 *   pnpm admin:pfp-batch -- --cookie "bs_access_token=..." [--base-url URL] [--page 1]
 *   [--all] [--pages 5] [--jobs 24] [--workers 12]
 *
 * Parallel by default: `--workers` = CPU cores (sharp/libvips per thread), `--jobs` = concurrent
 * download→encode→upload pipelines (default ~2× cores). Override with PFP_BATCH_JOBS / PFP_BATCH_WORKERS.
 * Image work is CPU-only (no GPU in sharp); workers use all cores efficiently.
 *
 * Copy the `bs_access_token` cookie from a logged-in admin session (DevTools → Storage → Cookies).
 */
import os from "node:os";
import {
  defaultJobConcurrency,
  defaultWorkerCount,
  PfpWorkerPool,
} from "./admin-pfp-batch-pool.mts";

const DEFAULT_BASE = process.env.ACCOUNTS_BASE_URL?.replace(/\/$/, "") ?? "https://accounts.betterseqta.org";

function parseArgs(argv: string[]) {
  let cookie = "";
  let baseUrl = DEFAULT_BASE;
  let startPage = 1;
  let maxPages = 10;
  let allPages = false;
  let hasPfpOnly = true;
  let skipWebp = true;
  let pageSize = 50;
  let jobs = defaultJobConcurrency();
  let workers = defaultWorkerCount();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--" && argv[i + 1] === "--") {
      continue;
    }
    if (arg === "--cookie" && argv[i + 1]) {
      cookie = argv[++i]!;
    } else if (arg === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i]!.replace(/\/$/, "");
    } else if (arg === "--page" && argv[i + 1]) {
      startPage = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === "--pages" && argv[i + 1]) {
      maxPages = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === "--all") {
      allPages = true;
    } else if (arg === "--everyone") {
      allPages = true;
    } else if (arg === "--include-no-pfp") {
      hasPfpOnly = false;
    } else if (arg === "--reencode-webp") {
      skipWebp = false;
    } else if (arg === "--page-size" && argv[i + 1]) {
      pageSize = Math.min(100, Math.max(1, Number(argv[++i]) || 50));
    } else if (arg === "--jobs" && argv[i + 1]) {
      jobs = Math.min(64, Math.max(1, Number(argv[++i]) || jobs));
    } else if (arg === "--workers" && argv[i + 1]) {
      workers = Math.min(64, Math.max(1, Number(argv[++i]) || workers));
    }
  }

  if (!cookie) {
    console.error(`Missing --cookie (${ACCESS_COOKIE_NAME} from admin browser session)`);
    process.exit(1);
  }

  return { cookie, baseUrl, startPage, maxPages, allPages, hasPfpOnly, skipWebp, pageSize, jobs, workers };
}

const ACCESS_COOKIE_NAME = "bs_access_token";

function normalizeSessionCookie(cookie: string): string {
  const trimmed = cookie.trim();
  if (!trimmed.includes("=")) {
    return `${ACCESS_COOKIE_NAME}=${trimmed}`;
  }
  if (trimmed.startsWith("access_token=")) {
    return `${ACCESS_COOKIE_NAME}=${trimmed.slice("access_token=".length)}`;
  }
  return trimmed;
}

function sessionHeaders(cookie: string): { Cookie: string; Authorization?: string } {
  const normalized = normalizeSessionCookie(cookie);
  const jwt = normalized.startsWith(`${ACCESS_COOKIE_NAME}=`)
    ? normalized.slice(`${ACCESS_COOKIE_NAME}=`.length)
    : null;
  return {
    Cookie: normalized,
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

async function apiFetch(baseUrl: string, cookie: string, path: string, init?: RequestInit) {
  const session = sessionHeaders(cookie);
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...session,
      ...(init?.headers ?? {}),
    },
  });
}

type AdminUserRow = { id: string; pfpUrl?: string | null };

function isWebpBuffer(buf: Buffer): boolean {
  return buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
}

type Outcome = "converted" | "skipped_no_hosted" | "skipped_already_webp" | "failed";

async function runPoolWithResults<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  const n = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function fetchUserPage(
  opts: ReturnType<typeof parseArgs>,
  page: number,
): Promise<
  | { users: AdminUserRow[]; total: number; totalPages: number; page: number; ok: true }
  | { ok: false; status: number; body: string }
> {
  const hasPfp = opts.hasPfpOnly ? "&has_pfp=true" : "";
  const listRes = await apiFetch(
    opts.baseUrl,
    opts.cookie,
    `/api/admin/users?q=&page=${page}&sort=username:asc&include_history=false${hasPfp}`,
  );
  if (!listRes.ok) {
    return { ok: false, status: listRes.status, body: await listRes.text() };
  }
  const listJson = (await listRes.json()) as {
    users?: AdminUserRow[];
    total?: number;
    totalPages?: number;
    page?: number;
  };
  return {
    ok: true,
    users: listJson.users ?? [],
    total: listJson.total ?? 0,
    totalPages: listJson.totalPages ?? 0,
    page: listJson.page ?? page,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cores = os.cpus().length;
  console.log(
    `Parallel batch: ${opts.workers} encode worker(s), ${opts.jobs} job(s), ${cores} logical CPU(s)` +
      (opts.allPages ? ", scanning ALL pages" : `, max ${opts.maxPages} page(s)`) +
      (opts.hasPfpOnly ? ", users with pfp only" : ", all users") +
      (opts.skipWebp ? ", skip existing WebP" : ", re-encode WebP"),
  );

  const pool = new PfpWorkerPool(opts.workers);

  const processUser = async (user: AdminUserRow): Promise<Outcome> => {
    const pfpUrl = user.pfpUrl ?? "";
    if (!pfpUrl.includes("/api/user/pfp/") || pfpUrl.includes("/hist/")) {
      return "skipped_no_hosted";
    }

    try {
      const absolute = pfpUrl.startsWith("http") ? pfpUrl : `${opts.baseUrl}${pfpUrl}`;
      const imgRes = await fetch(absolute, {
        headers: sessionHeaders(opts.cookie),
      });
      if (!imgRes.ok) {
        return "failed";
      }
      const raw = Buffer.from(await imgRes.arrayBuffer());
      if (opts.skipWebp && isWebpBuffer(raw)) {
        return "skipped_already_webp";
      }
      const processed = await pool.process(raw);
      const blob = new Blob([processed], { type: "image/webp" });
      const form = new FormData();
      form.append("userId", user.id);
      form.append("file", blob, "profile.webp");
      form.append("clientProcessed", "true");
      form.append("preCropped", "true");

      const upRes = await apiFetch(opts.baseUrl, opts.cookie, "/api/admin/user/pfp", {
        method: "POST",
        body: form,
      });
      if (!upRes.ok) {
        const err = await upRes.text();
        console.warn(`Upload failed ${user.id}: ${upRes.status} ${err.slice(0, 120)}`);
        return "failed";
      }
      return "converted";
    } catch (err) {
      console.warn(`Failed ${user.id}:`, err);
      return "failed";
    }
  };

  let converted = 0;
  let skippedNoHosted = 0;
  let skippedAlreadyWebp = 0;
  let failed = 0;
  let directoryTotal = 0;
  let directoryPages = 0;

  try {
    for (let pageOffset = 0; ; pageOffset++) {
      if (!opts.allPages && pageOffset >= opts.maxPages) break;

      const page = opts.startPage + pageOffset;
      const result = await fetchUserPage(opts, page);
      if (!result.ok) {
        console.error(`List users failed page ${page}: HTTP ${result.status}`);
        if (result.status === 401 || result.status === 403) {
          console.error("Check admin cookie (middle admin+ for user list). Token may be expired.");
        }
        console.error(result.body.slice(0, 200));
        break;
      }

      if (pageOffset === 0 && result.total > 0) {
        directoryTotal = result.total;
        directoryPages = result.totalPages;
        const pagesPlanned = opts.allPages
          ? Math.max(0, directoryPages - opts.startPage + 1)
          : Math.min(opts.maxPages, Math.max(0, directoryPages - opts.startPage + 1));
        console.log(
          `Directory: ${directoryTotal} user(s) match filter, ${directoryPages} page(s) of 50` +
            (pagesPlanned > 0 ? `, will scan ${pagesPlanned} page(s) from page ${opts.startPage}` : ""),
        );
      }

      const users = result.users;
      if (users.length === 0) break;

      const t0 = performance.now();
      const outcomes = await runPoolWithResults(opts.jobs, users, processUser);
      for (const o of outcomes) {
        if (o === "converted") converted++;
        else if (o === "skipped_no_hosted") skippedNoHosted++;
        else if (o === "skipped_already_webp") skippedAlreadyWebp++;
        else failed++;
      }
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(
        `Page ${page}/${directoryPages || "?"}: ${users.length} users in ${sec}s (${converted} converted total)`,
      );

      if (directoryPages > 0 && page >= directoryPages) break;
      if (users.length < 50) break;
    }
  } finally {
    await pool.close();
  }

  const skipped = skippedNoHosted + skippedAlreadyWebp;
  console.log(
    `Done: ${converted} converted, ${skipped} skipped (${skippedNoHosted} no hosted PFP, ${skippedAlreadyWebp} already WebP), ${failed} failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
