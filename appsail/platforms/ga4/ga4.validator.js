import { sendGa4DebugEvent } from "./ga4.service.js";

function makeClientId(store_id) {
  // GA4 requires client_id like digits.digits
  const digits = String(store_id || "").replace(/\D/g, "");
  const a = (digits.slice(0, 10) || String(Date.now()).slice(-10)).padEnd(10, "0");
  const b = String(Date.now()).slice(-10).padEnd(10, "0");
  return `${a}.${b}`;
}

function formatValidationMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  return messages
    .map((m) => {
      const code = m?.validationCode ? `[${m.validationCode}]` : "";
      const field = m?.fieldPath ? ` (${m.fieldPath})` : "";
      const desc = m?.description || JSON.stringify(m);
      return `${code}${field} ${desc}`.trim();
    })
    .join("; ");
}

function stringifyBody(data) {
  if (data == null) return "";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export async function validateGa4Connection({ store_id, measurement_id, api_secret }) {
  const mid = String(measurement_id || "").trim();
  const secret = String(api_secret || "").trim();

  if (!mid || !secret) {
    const e = new Error("measurement_id and api_secret are required");
    e.reason = "missing_credentials";
    throw e;
  }

  if (!/^G-[A-Z0-9]+$/i.test(mid)) {
    const e = new Error(
      `measurement_id must look like "G-XXXXXXX" (got "${mid}"). ` +
      `Use the Measurement ID from Admin → Data Streams → Web stream, not the Stream ID.`
    );
    e.reason = "bad_measurement_id_format";
    throw e;
  }

  const payload = {
    client_id: makeClientId(store_id),
    events: [
      {
        name: "ga4_connection_test",
        params: { engagement_time_msec: 1 }
      }
    ]
  };

  let result;
  try {
    result = await sendGa4DebugEvent({
      measurement_id: mid,
      api_secret: secret,
      payload
    });
  } catch (err) {
    const e = new Error(
      `Could not reach Google Analytics: ${err?.code || err?.message || "network error"}`
    );
    e.reason = "network_error";
    e.cause_detail = err?.message;
    throw e;
  }

  // Non-2xx from GA4 — surface body so the user sees the real reason.
  if (!result.ok) {
    const body = stringifyBody(result.data);
    const e = new Error(
      `GA4 rejected the request (HTTP ${result.status})${body ? `: ${body}` : ""}`
    );
    e.reason = "ga4_http_error";
    e.http_status = result.status;
    e.response_body = result.data;
    throw e;
  }

  // GA4 debug endpoint returns 200 even when credentials are wrong —
  // the actual errors live in validationMessages.
  const messages = result?.data?.validationMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    const e = new Error(`GA4 validation failed: ${formatValidationMessages(messages)}`);
    e.reason = "ga4_validation_messages";
    e.validation_messages = messages;
    throw e;
  }

  return result.data;
}
