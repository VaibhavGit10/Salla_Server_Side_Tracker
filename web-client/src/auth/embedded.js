import { setSessionToken } from "./session";
import { setStoreId } from "../utils/store";

// Salla Embedded SDK integration.
//
// When the app runs inside the Salla dashboard iframe, Salla passes a short-lived
// token in the iframe URL. We: init the SDK -> read that token -> verify it with
// our backend (/auth/embedded) -> store the returned session JWT -> ready().
// Outside Salla (standalone / dev), this resolves { embedded: false } so the app
// falls back to its existing behavior.

let sdk = null;
let embeddedMode = false;

const INIT_TIMEOUT_MS = 2500;

export function getEmbeddedSDK() {
  return sdk;
}

export function inEmbeddedMode() {
  return embeddedMode;
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access throws → we're framed
  }
}

async function loadSdk() {
  try {
    const mod = await import("@salla.sa/embedded-sdk");
    return mod.embedded || mod.default?.embedded || (window.Salla && window.Salla.embedded) || null;
  } catch {
    return (window.Salla && window.Salla.embedded) || null;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("init timeout")), ms))
  ]);
}

/**
 * Establish the embedded session. Returns { embedded: boolean, storeId? }.
 * Never throws — callers can render regardless.
 */
export async function bootstrapEmbedded(apiBase) {
  // Not framed → definitely standalone; skip the SDK entirely (instant).
  if (!inIframe()) return { embedded: false };

  const embedded = await loadSdk();
  if (!embedded) return { embedded: false };
  sdk = embedded;

  try {
    await withTimeout(embedded.init({ debug: false }), INIT_TIMEOUT_MS);
  } catch {
    return { embedded: false }; // framed, but not by Salla
  }

  let emToken = null;
  try {
    emToken = embedded.auth?.getToken?.() || null;
  } catch {
    emToken = null;
  }
  if (!emToken) return { embedded: false };

  try {
    const base = String(apiBase || "").replace(/\/+$/, "");
    const res = await fetch(`${base}/auth/embedded`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: emToken })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) throw new Error(data?.error || "verification failed");

    setSessionToken(data.token);
    if (data.store_id) setStoreId(String(data.store_id));
    embeddedMode = true;

    try {
      embedded.ready();
    } catch {
      /* ready is best-effort */
    }
    return { embedded: true, storeId: data.store_id };
  } catch (err) {
    try {
      embedded.destroy();
    } catch {
      /* destroy is best-effort */
    }
    return { embedded: false, error: err?.message };
  }
}

/** Ask Salla to reload the iframe with a fresh token (on session expiry / 401). */
export function refreshEmbeddedAuth() {
  try {
    sdk?.auth?.refresh?.();
  } catch {
    /* no-op outside Salla */
  }
}
