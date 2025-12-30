import { sendGa4DebugEvent } from "./ga4.service.js";

export async function validateGa4Connection({
  store_id,
  measurement_id,
  api_secret
}) {
  const payload = {
    client_id: `server_${store_id}`,
    events: [
      {
        name: "ga4_connection_test",
        params: {
          engagement_time_msec: 1
        }
      }
    ]
  };

  const result = await sendGa4DebugEvent({
    measurement_id,
    api_secret,
    payload
  });

  // GA4 debug returns validationMessages when something is wrong
  if (!result.ok) {
    const msg =
      typeof result.data === "string"
        ? result.data
        : JSON.stringify(result.data);

    throw new Error(`GA4 validation failed: ${msg}`);
  }

  return result.data; // includes validationMessages (often empty if ok)
}
