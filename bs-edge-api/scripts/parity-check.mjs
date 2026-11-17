const WORKER = process.env.WORKER_URL ?? "https://worker.accounts.betterseqta.org";
const EDGE = process.env.EDGE_URL ?? "https://bsapi.adenmgb.com";

async function call(base, method, path, init = {}) {
  const res = await fetch(`${base}${path}`, { method, ...init });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, text, headers: Object.fromEntries(res.headers.entries()) };
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const tests = [];

async function test(name, workerPath, edgePath, init) {
  const w = await call(WORKER, init?.method ?? "GET", workerPath, init);
  const e = await call(EDGE, init?.method ?? "GET", edgePath ?? workerPath, init);
  const bodyMatch = w.text === e.text;
  const statusMatch = w.status === e.status;
  tests.push({ name, statusMatch, bodyMatch, worker: w, edge: e, pass: statusMatch && bodyMatch });
}

await test("health", "/api/health");
await test("settings sync GET (no auth)", "/api/bsplus/settings/sync");
await test("peers GET (no auth)", "/api/bsplus/timetable-classmates/peers?instance_host=school.example.edu.au");
await test("peers GET invalid host (no auth)", "/api/bsplus/timetable-classmates/peers");
await test("proxy bsplus config", "/api/bsplus/config");
await test(
  "settings sync PUT (no auth)",
  "/api/bsplus/settings/sync",
  undefined,
  { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" },
);
await test(
  "login POST invalid",
  "/api/auth/login",
  undefined,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nope@example.com", password: "bad" }),
  },
);

const opts = await Promise.all([
  fetch(`${WORKER}/api/bsplus/settings/sync`, { method: "OPTIONS", headers: { Origin: "https://x.test", "Access-Control-Request-Method": "PUT" } }),
  fetch(`${EDGE}/api/bsplus/settings/sync`, { method: "OPTIONS", headers: { Origin: "https://x.test", "Access-Control-Request-Method": "PUT" } }),
]);

console.log("=== Parity: Worker vs Edge ===\n");
for (const t of tests) {
  const mark = t.pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${t.name}`);
  if (!t.pass) {
    console.log(`  status  worker=${t.worker.status} edge=${t.edge.status}`);
    if (t.worker.text !== t.edge.text) {
      console.log(`  worker body: ${t.worker.text.slice(0, 200)}`);
      console.log(`  edge body:   ${t.edge.text.slice(0, 200)}`);
    }
  }
}

console.log(`\nOPTIONS worker=${opts[0].status} edge=${opts[1].status}`);
const fail = tests.filter((t) => !t.pass).length;
process.exit(fail > 0 ? 1 : 0);