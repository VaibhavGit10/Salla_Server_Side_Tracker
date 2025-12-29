import { useState } from "react";
import "./EventTable.css";

export default function EventTable({ events }) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <table className="event-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Platform</th>
            <th>Event</th>
            <th>Order ID</th>
            <th>Value</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i}>
              <td>{e.time}</td>
              <td>{e.platform}</td>
              <td>{e.type}</td>
              <td>{e.order_id}</td>
              <td>{e.value}</td>
              <td>
                <span className={`status ${e.status.toLowerCase()}`}>
                  {e.status}
                </span>
              </td>
              <td>
                <button className="link" onClick={() => setSelected(e)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Event Payload</h3>
            <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
