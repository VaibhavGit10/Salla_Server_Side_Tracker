// Holds the app session token (the JWT our backend returns from /auth/embedded).
// Kept in memory + sessionStorage so a reload within the embedded session reuses it.
const KEY = "mo_session_token";
let memToken = null;

export function getSessionToken() {
  if (memToken) return memToken;
  try {
    memToken = sessionStorage.getItem(KEY) || null;
  } catch {
    memToken = null;
  }
  return memToken;
}

export function setSessionToken(token) {
  memToken = token || null;
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sessionStorage unavailable — memory copy still works */
  }
}

export function clearSessionToken() {
  setSessionToken(null);
}
