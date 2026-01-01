import { sendGa4DebugEvent } from "./ga4.service.js";

function makeClientId(store_id) {
  // GA4 requires client_id like digits.digits
  const digits = String(store_id || "").replace(/\D/g, "");
  const a = (digits.slice(0, 10) || String(Date.now()).slice(-10)).padEnd(10, "0");
  const b = String(Date.now()).slice(-10).padEnd(10, "0");
  return `${a}.${b}`;
}

export async function validateGa4Connection({ store_id, measurement_id, api_secret }) {
  const payload = {
    client_id: makeClientId(store_id),
    events: [
      {
        name: "ga4_connection_test",
        params: { engagement_time_msec: 1 }
      }
    ]
  };

  const result = await sendGa4DebugEvent({
    measurement_id: String(measurement_id || "").trim(),
    api_secret: String(api_secret || "").trim(),
    payload
  });

  if (!result.ok) {
    const msg = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
    throw new Error(`GA4 validation failed: ${msg}`);
  }

  return result.data;
}
