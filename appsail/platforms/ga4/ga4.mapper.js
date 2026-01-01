function pickTransactionId(order, fallback) {
  return (
    order?.id ||
    order?.order_id ||
    order?.reference_id ||
    fallback
  );
}

function pickValue(order) {
  // Try common Salla shapes
  const v =
    order?.amounts?.total?.amount ??
    order?.amounts?.total ??
    order?.total?.amount ??
    order?.total ??
    order?.total_amount ??
    order?.total_price ??
    null;

  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function pickCurrency(order) {
  return (
    order?.currency ||
    order?.amounts?.total?.currency ||
    order?.total?.currency ||
    "SAR"
  );
}

/**
 * Input: { store_id, external_id, order }
 */
export function mapSallaOrderToGa4Purchase({ store_id, external_id, order }) {
  const transaction_id = pickTransactionId(order, external_id);
  const value = pickValue(order);
  const currency = pickCurrency(order);

  return {
    client_id: `server_${store_id}`,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id,
          value,
          currency,
          engagement_time_msec: 1
        }
      }
    ]
  };
}
