/**
 * Top client IPs for GET /api/health on a host (Cloudflare GraphQL).
 * Usage (token from env, not argv):
 *   CF_TOKEN=... node scripts/cf-health-spam-by-ip.mjs
 */
const TOKEN = process.env.CF_TOKEN;
const ZONE_TAG = process.env.CF_ZONE_TAG ?? "15eae19edb2d84416313eed1a34262a3";
const HOST = process.env.CF_HOST ?? "accounts.betterseqta.org";
const PATH_PREFIX = process.env.CF_PATH ?? "/api/health";
const DAYS = Number(process.env.CF_DAYS ?? "7");

if (!TOKEN) {
  console.error("Set CF_TOKEN");
  process.exit(1);
}

const until = new Date();
const since = new Date(until.getTime() - DAYS * 86400_000);

const query = `
query ($zoneTag: string, $since: Time, $until: Time, $host: string) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: {
          datetime_geq: $since
          datetime_leq: $until
          clientRequestHTTPHost: $host
          clientRequestPath_like: "${PATH_PREFIX}%"
        }
        limit: 10000
        orderBy: [count_DESC]
      ) {
        count
        dimensions {
          clientIP
          clientRequestPath
          clientRequestHTTPMethodName
          userAgent
        }
      }
    }
  }
}`;

const variables = {
  zoneTag: ZONE_TAG,
  host: HOST,
  since: since.toISOString(),
  until: until.toISOString(),
};

const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query, variables }),
});
const json = await res.json();
if (json.errors?.length) {
  console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
  process.exit(1);
}

const rows = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
const byIp = new Map();
let total = 0;
for (const r of rows) {
  if (r.dimensions.clientRequestHTTPMethodName !== "GET") continue;
  const path = r.dimensions.clientRequestPath ?? "";
  if (!path.startsWith(PATH_PREFIX)) continue;
  total += r.count;
  const ip = r.dimensions.clientIP ?? "unknown";
  const prev = byIp.get(ip) ?? { count: 0, ua: new Set() };
  prev.count += r.count;
  if (r.dimensions.userAgent) prev.ua.add(r.dimensions.userAgent);
  byIp.set(ip, prev);
}

const sorted = [...byIp.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`Host: ${HOST}  Path: ${PATH_PREFIX}  Window: ${DAYS}d  Total GET health (approx): ${total}\n`);
console.log("IP\trequests\tshare\tuser-agents (sample)");
for (const [ip, { count, ua }] of sorted.slice(0, 40)) {
  const share = total ? ((100 * count) / total).toFixed(1) : "0";
  const uaList = [...ua].slice(0, 2).join(" | ");
  console.log(`${ip}\t${count}\t${share}%\t${uaList.slice(0, 120)}`);
}