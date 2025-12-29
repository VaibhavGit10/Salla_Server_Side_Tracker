import { sendGa4Event } from "./ga4.service.js";

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

  await sendGa4Event({
    measurement_id,
    api_secret,
    payload
  });
}
