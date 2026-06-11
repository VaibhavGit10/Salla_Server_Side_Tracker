/**
 * Webhook functional test — sends signed Salla events and verifies the full pipeline.
 * Usage: SALLA_WEBHOOK_SECRET=<your_secret> node test_webhook.mjs
 */

import crypto from "crypto";

const BASE = "https://appsail-50037240850.development.catalystappsail.in";
const SECRET = process.env.SALLA_WEBHOOK_SECRET;
const STORE_ID = "1253554554"; // has GA4 configured

if (!SECRET) {
  console.error("ERROR: set SALLA_WEBHOOK_SECRET before running");
  process.exit(1);
}

function sign(payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(Buffer.from(body, "utf8")).digest("hex");
  return { body, sig };
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body
  });
  return { status: res.status, data: await res.json() };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, data: await res.json() };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const testEvents = [
  {
    event: "order.created",
    merchant: Number(STORE_ID),
    created_at: new Date().toISOString(),
    data: {
      id: 9100001,
      amounts: { total: { amount: 149.00, currency: "SAR" } },
      items: [{ name: "Test Product A", price: 149.00, quantity: 1 }]
    }
  },
  {
    event: "order.created",
    merchant: Number(STORE_ID),
    created_at: new Date().toISOString(),
    data: {
      id: 9100002,
      amounts: { total: { amount: 299.50, currency: "SAR" } },
      items: [{ name: "Test Product B", price: 299.50, quantity: 1 }]
    }
  },
  {
    event: "order.created",
    merchant: Number(STORE_ID),
    created_at: new Date().toISOString(),
    data: {
      id: 9100003,
      amounts: { total: { amount: 75.00, currency: "SAR" } },
      items: [{ name: "Test Product C", price: 75.00, quantity: 1 }]
    }
  }
];

console.log(`\n${"=".repeat(60)}`);
console.log("  Salla Webhook Pipeline Test");
console.log(`${"=".repeat(60)}\n`);

// --- Step 1: Send webhooks ---
console.log("STEP 1 — Sending 3 signed webhook events...\n");

const sentIds = [];
for (const payload of testEvents) {
  const orderId = payload.data.id;
  const { body, sig } = sign(payload);

  const { status, data } = await post("/webhooks/salla", body, {
    "x-salla-signature": sig
  });

  const icon = status === 200 ? "✅" : "❌";
  console.log(`  ${icon} order #${orderId} → HTTP ${status} | ${JSON.stringify(data)}`);
  sentIds.push(String(orderId));
}

// --- Step 2: Wait for async GA4 dispatch ---
console.log("\nSTEP 2 — Waiting 4s for async GA4 dispatch...");
await sleep(4000);

// --- Step 3: Fetch events and verify ---
console.log("\nSTEP 3 — Checking events table for new records...\n");

const { data: eventsResp } = await get(`/platforms/events?store_id=${STORE_ID}&limit=20`);
const events = eventsResp.data || [];

let found = 0;
for (const id of sentIds) {
  const row = events.find(e => String(e.external_id) === id);
  if (row) {
    found++;
    const ga4Status = row.last_http_status;
    const ga4Icon = ga4Status === "204" ? "✅" : ga4Status ? "⚠️ " : "⏳";
    console.log(`  ${ga4Icon} order #${id} → stored | GA4 HTTP: ${ga4Status ?? "pending"} | retries: ${row.retries ?? 0}`);
  } else {
    console.log(`  ❌ order #${id} → NOT found in events table`);
  }
}

// --- Step 4: Deduplication check ---
console.log("\nSTEP 4 — Testing deduplication (resend same events)...\n");

let dedupCount = 0;
for (const payload of testEvents.slice(0, 1)) {
  const { body, sig } = sign(payload);
  const { status, data } = await post("/webhooks/salla", body, {
    "x-salla-signature": sig
  });
  if (data.deduplicated) {
    dedupCount++;
    console.log(`  ✅ order #${payload.data.id} correctly deduplicated`);
  } else {
    console.log(`  ❌ order #${payload.data.id} should have been deduplicated — got: ${JSON.stringify(data)}`);
  }
}

// --- Step 5: Stats check ---
console.log("\nSTEP 5 — Checking stats (last 1h)...\n");
const { data: statsResp } = await get(`/platforms/stats?store_id=${STORE_ID}&hours=1`);
const stats = statsResp.data;
console.log(`  Total events (1h): ${stats.total}`);
console.log(`  By status: ${JSON.stringify(stats.by_status)}`);
console.log(`  By platform: ${JSON.stringify(stats.dispatch_by_platform)}`);

// --- Summary ---
console.log(`\n${"=".repeat(60)}`);
console.log("  SUMMARY");
console.log(`${"=".repeat(60)}`);
console.log(`  Events sent:    3`);
console.log(`  Events stored:  ${found}/3`);
console.log(`  Dedup working:  ${dedupCount === 1 ? "YES" : "NO"}`);

const ga4Sent = events.filter(e => sentIds.includes(String(e.external_id)) && e.last_http_status === "204").length;
console.log(`  GA4 dispatched: ${ga4Sent}/3 (HTTP 204)`);
console.log(`${"=".repeat(60)}\n`);
