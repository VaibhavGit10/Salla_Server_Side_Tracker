export function mapSallaOrderToGa4Purchase(event) {
  const order = event.payload;

  return {
    client_id: `server_${event.store_id}`,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: order.order_id,
          value: order.total,
          currency: order.currency || "SAR",
          engagement_time_msec: 1
        }
      }
    ]
  };
}
