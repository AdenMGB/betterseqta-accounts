/**
 * Batch-encode hosted profile pictures on a senior admin machine (not on Cloudflare Worker).
 *
 *   pnpm admin:pfp-batch -- --cookie "access_token=..." [--base-url https://accounts.betterseqta.org] [--page 1] [--pages 5]
 *
 * Copy the `access_token` cookie from a logged-in senior admin session in the browser.
 */
import { ensureJsquashReady } from "../worker/src/lib/jsquashInit.ts";
import { processPfpUpload } from "../worker/src/lib/pfpProcess.ts";

const DEFAULT_BASE = process.env.ACCOUNTS_BASE_URL?.replace(/\/$/, "") ?? "https://accounts.betterseqta.org";

function parseArgs(argv: string[]) {
  let cookie = "";
  let baseUrl = DEFAULT_BASE;
  let startPage = 1;
  let maxPages = 10;
  let pageSize = 40;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cookie" && argv[i + 1]) {
      cookie = argv[++i]!;
    } else if (arg === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i]!.replace(/\/$/, "");
    } else if (arg === "--page" && argv[i + 1]) {
      startPage = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === "--pages" && argv[i + 1]) {
      maxPages = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === "--page-size" && argv[i + 1]) {
      pageSize = Math.min(100, Math.max(1, Number(argv[++i]) || 40));
    }
  }

  if (!cookie) {
    console.error("Missing --cookie (access_token from admin browser session)");
    process.exit(1);
  }

  return { cookie, baseUrl, startPage, maxPages, pageSize };
}

async function apiFetch(baseUrl: string, cookie: string, path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Cookie: cookie.includes("=") ? cookie : `access_token=${cookie}`,
    },
  });
  return res;
}

type AdminUserRow = { id: string; pfpUrl?: string | null };

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await ensureJsquashReady();

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (let pageOffset = 0; pageOffset < opts.maxPages; pageOffset++) {
    const page = opts.startPage + pageOffset;
    const listRes = await apiFetch(
      opts.baseUrl,
      opts.cookie,
      `/api/admin/users?q=&page=${page}&sort=username:asc&include_history=false`,
    );
    if (!listRes.ok) {
      console.error(`List users failed page ${page}: HTTP ${listRes.status}`);
      break;
    }
    const listJson = (await listRes.json()) as { users?: AdminUserRow[] };
    const users = listJson.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const pfpUrl = user.pfpUrl ?? "";
      if (!pfpUrl.includes("/api/user/pfp/") || pfpUrl.includes("/hist/")) {
        skipped++;
        continue;
      }

      try {
        const imgRes = await fetch(pfpUrl.startsWith("http") ? pfpUrl : `${opts.baseUrl}${pfpUrl}`);
        if (!imgRes.ok) {
          failed++;
          continue;
        }
        const raw = await imgRes.arrayBuffer();
        const processed = await processPfpUpload(raw, { preCropped: false });
        const blob = new Blob([processed.bytes], { type: processed.contentType });
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
          failed++;
          continue;
        }
        converted++;
        console.log(`OK ${user.id}`);
      } catch (err) {
        console.warn(`Failed ${user.id}:`, err);
        failed++;
      }
    }
  }

  console.log(`Done: ${converted} converted, ${skipped} skipped, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
