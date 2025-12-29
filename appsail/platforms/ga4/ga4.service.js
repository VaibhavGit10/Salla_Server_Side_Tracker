import axios from "axios";

export async function sendGa4Event({
  measurement_id,
  api_secret,
  payload
}) {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`;

  await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json"
    },
    timeout: 5000
  });
}
