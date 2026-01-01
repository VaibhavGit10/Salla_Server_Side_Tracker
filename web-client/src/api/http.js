// web-client/src/api/http.js

function joinUrl(base, path) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  if (!b) return `/${p}`;
  return `${b}/${p}`;
}

const BASE_URL =
  window.__API_BASE__ ||            // runtime injected via index.html
  process.env.REACT_APP_API_BASE || // optional build-time (CRA)
  "";                               // fallback (same origin)

async function parseJson(res) {
  return res.json().catch(() => null);
}

export async function apiGet(path) {
  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "API error");
  return data;
}

export async function apiPost(path, body) {
  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body || {})
  });

  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || data?.message || "API error");
  return data;
}
