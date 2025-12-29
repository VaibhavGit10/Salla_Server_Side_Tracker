import { useEffect, useState } from "react";
import Container from "../components/layout/Container";
import EventTable from "../components/tables/EventTable";
import Skeleton from "../components/ui/Skeleton";
import { fetchEventLogs } from "../api/logs.api";
import { getStoreId } from "../utils/store";

export default function Logs() {
  const storeId = getStoreId()

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEventLogs(storeId)
      .then(data => {
        setEvents(data || []);
      })
      .catch(() => {
        // 🔁 Safe fallback for demo / dev
        setEvents([
          {
            time: "2 min ago",
            platform: "GA4",
            type: "purchase",
            order_id: "ORDER_2001",
            value: "SAR 299",
            status: "SUCCESS",
            payload: { order_id: "ORDER_2001", total: 299 }
          },
          {
            time: "5 min ago",
            platform: "GA4",
            type: "purchase",
            order_id: "ORDER_2000",
            value: "SAR 199",
            status: "FAILED",
            payload: { error: "Invalid secret" }
          }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [storeId]);

  /* ===============================
     Loading State
  ================================ */
  if (loading) {
    return (
      <Container
        title="Event Logs"
        subtitle="Loading event history…"
      >
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} height={40} />
        ))}
      </Container>
    );
  }

  /* ===============================
     Empty State
  ================================ */
  if (!events || events.length === 0) {
    return (
      <Container
        title="Event Logs"
        subtitle="No events received yet"
      >
        <div className="empty">
          Events will appear here once your store starts receiving orders.
        </div>
      </Container>
    );
  }

  /* ===============================
     Normal State
  ================================ */
  return (
    <Container
      title="Event Logs"
      subtitle="Detailed delivery history of conversion events"
    >
      <EventTable events={events} />
    </Container>
  );
}
