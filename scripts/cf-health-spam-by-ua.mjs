const TOKEN = process.env.CF_TOKEN;
const ZONE = process.env.CF_ZONE_TAG ?? "15eae19edb2d84416313eed1a34262a3";
const HOST = process.env.CF_HOST ?? "accounts.betterseqta.org";
const since = process.env.CF_SINCE ?? "2026-11-03T00:00:00Z";
const until = process.env.CF_UNTIL ?? "2026-11-17T23:59:59Z";

const query = `
query ($zoneTag: string, $since: Time, $until: Time, $host: string) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: {
          datetime_geq: $since
          datetime_leq: $until
          clientRequestHTTPHost: $host
          clientRequestPath: "/api/health"
        }
        limit: 10000
      ) {
        count
        dimensions {
          userAgent
          clientRequestHTTPMethodName
        }
      }
    }
  }
}`;

const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query,
    variables: { zoneTag: ZONE, host: HOST, since, until },
  }),
});
const json = await res.json();
if (json.errors?.length) {
  console.error(json.errors);
  process.exit(1);
}
const rows = json.data.viewer.zones[0].httpRequestsAdaptiveGroups;
const byUa = new Map();
let total = 0;
for (const r of rows) {
  if (r.dimensions.clientRequestHTTPMethodName !== "GET") continue;
  total += r.count;
  const ua = (r.dimensions.userAgent || "(empty)").slice(0, 100);
  byUa.set(ua, (byUa.get(ua) || 0) + r.count);
}
console.log(`GET /api/health total: ${total}\n--- Top user-agents ---`);
[...byUa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, c]) => console.log(c, k));