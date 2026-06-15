import crypto from "crypto";

/**
 * Minimal HS256 session tokens (JWT-compatible) for the embedded-app session.
 *
 * After we verify Salla's short-lived embedded token via the Introspection API,
 * we mint one of these bound to the verified store_id. Every API request carries
 * it as `Authorization: Bearer <token>`, and the auth middleware derives
 * req.store_id from it — the client never supplies the store id.
 *
 * Signed with ENCRYPTION_KEY (already configured) unless SESSION_SECRET is set.
 */
const SECRET = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || "";
const TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 2 * 60 * 60); // default 2h

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** Mint a signed session token for a verified merchant. */
export function signSession({ store_id, user_id = null }) {
  if (!SECRET) throw new Error("Session secret not configured (ENCRYPTION_KEY/SESSION_SECRET)");
  if (!store_id) throw new Error("signSession: store_id required");

  const head = b64urlJson({ alg: "HS256", typ: "JWT" });
  const iat = nowSeconds();
  const body = b64urlJson({
    store_id: String(store_id),
    user_id: user_id ? String(user_id) : null,
    iat,
    exp: iat + TTL_SECONDS
  });

  const data = `${head}.${body}`;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Verify a session token. Returns the payload, or null if invalid/expired. */
export function verifySession(token) {
  if (!SECRET || !token) return null;

  const parts = String(token).split(".");
  if (parts.length !== 3) return null;

  const [head, body, sig] = parts;
  const expected = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload?.store_id) return null;
  if (payload.exp && nowSeconds() > Number(payload.exp)) return null;

  return payload;
}
