// web-client/src/api/http.js
import { getSessionToken } from "../auth/session";
import { inEmbeddedMode, refreshEmbeddedAuth } from "../auth/embedded";

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  if (!b) return `/${p}`;
  return `${b}/${p}`;
}

// Attach the embedded-session bearer token (when present) to every request, so
// the backend can derive the merchant server-side instead of trusting a client id.
function withAuth(headers = {}) {
  const token = getSessionToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
}

// On an expired/invalid session, ask Salla to reload the iframe with a fresh token.
function onUnauthorized(res) {
  if (res && res.status === 401 && inEmbeddedMode()) refreshEmbeddedAuth();
}

const BASE_URL =
  window.__API_BASE__ ||            // runtime injected via index.html
  process.env.REACT_APP_API_BASE || // optional build-time (CRA)
  "";                               // fallback (same origin)

async function parseJson(res) {
  return res.json().catch(() => null);
}

// ── GET de-duplication + optional short-TTL cache ──────────────────────
// Coalesces identical concurrent GETs into ONE network request, so multiple
// components mounting together (e.g. Sidebar + the active page both loading
// the store list) — and React StrictMode's double-invoke in dev — share a
// single request instead of firing 2–4 of them. When `ttl` is provided, the
// result is briefly cached so quick re-mounts / route changes don't refetch.
// Plain JS, behaves identically in dev and prod (does not rely on StrictMode),
// and leaves the per-environment BASE_URL resolution untouched.
const _inflight = new Map(); // path -> in-flight Promise
const _cache = new Map();    // path -> { value, expires }

/** Drop cached GET responses (all, or those whose path starts with `prefix`). */
export function invalidate(prefix = "") {
  for (const k of [..._cache.keys()]) if (k.startsWith(prefix)) _cache.delete(k);
  for (const k of [..._inflight.keys()]) if (k.startsWith(prefix)) _inflight.delete(k);
}

export async function apiGet(path, { ttl = 0, dedupe = true } = {}) {
  const key = path;

  // 1) serve a still-fresh cached response
  if (ttl > 0) {
    const hit = _cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
  }

  // 2) reuse an identical request already in flight
  if (dedupe && _inflight.has(key)) return _inflight.get(key);

  const req = (async () => {
    const res = await fetch(joinUrl(BASE_URL, path), {
      method: "GET",
      headers: withAuth({ "Accept": "application/json" })
    });
    const data = await parseJson(res);
    if (!res.ok) {
      onUnauthorized(res);
      throw new Error(data?.error || data?.message || "API error");
    }
    if (ttl > 0) _cache.set(key, { value: data, expires: Date.now() + ttl });
    return data;
  })();

  if (dedupe) {
    _inflight.set(key, req);
    // release the in-flight slot once settled so later calls fetch fresh
    const release = () => { if (_inflight.get(key) === req) _inflight.delete(key); };
    req.then(release, release);
  }
  return req;
}

export async function apiPost(path, body) {
  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json", "Accept": "application/json" }),
    body: JSON.stringify(body || {})
  });

  const data = await parseJson(res);
  if (!res.ok) {
    onUnauthorized(res);
    const err = new Error(data?.error || data?.message || "API error");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  invalidate(); // a mutation may have changed server state — drop cached GETs
  return data;
}

export async function apiDelete(path) {
  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "DELETE",
    headers: withAuth({ "Accept": "application/json" })
  });

  const data = await parseJson(res);
  if (!res.ok) {
    onUnauthorized(res);
    throw new Error(data?.error || data?.message || "API error");
  }
  invalidate(); // a mutation may have changed server state — drop cached GETs
  return data;
}
