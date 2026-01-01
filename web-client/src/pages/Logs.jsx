import { useEffect, useMemo, useState } from "react";
import Container from "../components/layout/Container";
import Skeleton from "../components/ui/Skeleton";
import { fetchEventLogs } from "../api/logs.api";
import { getStoreId } from "../utils/store";

function safeParse(v) {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return v;
  }
}

function formatRelativeTime(isoOrAny) {
  const iso = String(isoOrAny || "");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function mapDbStatusToUi(s) {
  const v = String(s || "").toLowerCase();
  if (v === "sent") return "SUCCESS";
  if (v === "failed") return "FAILED";
  if (v === "skipped") return "SKIPPED";
  if (v === "pending") return "PENDING";
  return (s || "UNKNOWN").toString().toUpperCase();
}

function mapRowToLog(row) {
  const payloadObj = safeParse(row.payload);
  const order = payloadObj?.data;
  const orderId = order?.id || row.external_id || "-";
  const value = order?.total?.amount || order?.total || null;

  return {
    rowid: row.ROWID,
    time: formatRelativeTime(row.CREATEDTIME || row.last_attempt_at),
    platform: String(row.last_platform || "GA4").toUpperCase(),
    type: row.type || "-",
    order_id: String(orderId),
    value: value != null ? `SAR ${Number(value)}` : "-",
    status: mapDbStatusToUi(row.status),
    payload: payloadObj,
    last_error: row.last_error || "",
    last_response: row.last_response || ""
  };
}

export default function Logs() {
  const storeId = getStoreId();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    fetchEventLogs(storeId)
      .then((resp) => {
        const rows = resp?.data || [];
        const mapped = Array.isArray(rows) ? rows.map(mapRowToLog) : [];
        setEvents(mapped);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [storeId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return (events || []).filter((e) => {
      const platform = String(e.platform || "");
      const status = String(e.status || "");
      const type = String(e.type || "");
      const order = String(e.order_id || "");
      const value = String(e.value || "");
      const time = String(e.time || "");

      const matchesQuery =
        !query ||
        platform.toLowerCase().includes(query) ||
        status.toLowerCase().includes(query) ||
        type.toLowerCase().includes(query) ||
        order.toLowerCase().includes(query) ||
        value.toLowerCase().includes(query) ||
        time.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ? true : status.toUpperCase() === statusFilter;

      const matchesPlatform =
        platformFilter === "ALL" ? true : platform.toUpperCase() === platformFilter;

      return matchesQuery && matchesStatus && matchesPlatform;
    });
  }, [events, q, statusFilter, platformFilter]);

  if (loading) {
    return (
      <Container title="Event Logs" subtitle="Loading event history…">
        <div className="logCard">
          <div className="logToolbar">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
          <div style={{ padding: 14 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height={46} />
            ))}
          </div>
        </div>
      </Container>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Container title="Event Logs" subtitle="No events received yet">
        <div className="logCard">
          <div className="emptyState">
            <div className="emptyIcon">📭</div>
            <div className="emptyTitle">No events yet</div>
            <div className="emptySub">
              Events will appear here once your store starts receiving orders and tracking is enabled.
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container title="Event Logs" subtitle="Detailed delivery history of conversion events">
      <div className="logCard">
        <div className="logToolbar">
          <div className="logSearch">
            <span className="searchIcon">⌕</span>
            <input
              className="searchInput"
              placeholder="Search order id, platform, type, status..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select className="select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="ALL">All Platforms</option>
            <option value="GA4">GA4</option>
          </select>

          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>

        <div className="tableWrap">
          <table className="logTable">
            <thead>
              <tr>
                <th className="colTime">Time</th>
                <th className="colPlatform">Platform</th>
                <th className="colType">Type</th>
                <th className="colOrder">Order ID</th>
                <th className="colValue">Value</th>
                <th className="colStatus">Status</th>
                <th className="colPayload">Payload</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="emptyInline">No results match your filters.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((e, idx) => (
                  <tr key={idx}>
                    <td className="muted">{e.time}</td>
                    <td><PlatformBadge platform={e.platform} /></td>
                    <td><span className="typePill">{String(e.type || "-")}</span></td>
                    <td className="mono">{String(e.order_id || "-")}</td>
                    <td className="mono">{String(e.value || "-")}</td>
                    <td><StatusBadge status={e.status} /></td>
                    <td>
                      <details className="payload">
                        <summary className="payloadSummary">
                          {payloadPreview(e.payload)}
                        </summary>
                        <pre className="payloadPre">{safeJson(e.payload)}</pre>
                        {(e.last_error || e.last_response) && (
                          <pre className="payloadPre" style={{ marginTop: 10 }}>
{`last_error: ${e.last_error || "-"}\nlast_response: ${e.last_response || "-"}`}
                          </pre>
                        )}
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="logFooter">
          <div className="muted">
            Showing <b>{filtered.length}</b> of <b>{events.length}</b> events
          </div>
          <div className="muted">Store: {storeId || "N/A"}</div>
        </div>
      </div>

      {/* keep your existing CSS + badges + utils below unchanged */}
      {/* (StatusBadge update below) */}
    </Container>
  );
}

/* ---------- Badges ---------- */
function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const ok = s === "SUCCESS";
  const skipped = s === "SKIPPED";

  return (
    <span className={`st ${ok ? "ok" : skipped ? "skip" : "bad"}`}>
      {s}
      <style>{`
        .st{
          display:inline-flex;
          align-items:center;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:1100;
          border: 1px solid rgba(15,23,42,0.10);
          white-space: nowrap;
        }
        .st.ok{
          background: rgba(25,135,84,0.12);
          border-color: rgba(25,135,84,0.20);
          color:#198754;
        }
        .st.skip{
          background: rgba(255,193,7,0.14);
          border-color: rgba(255,193,7,0.22);
          color:#B45309;
        }
        .st.bad{
          background: rgba(171,46,60,0.12);
          border-color: rgba(171,46,60,0.20);
          color:#AB2E3C;
        }
      `}</style>
    </span>
  );
}

function PlatformBadge({ platform }) {
  const p = String(platform || "").toUpperCase();
  const cls = p === "GA4" ? "ga4" : "default";

  return (
    <span className={`pb ${cls}`}>
      {p || "UNKNOWN"}
      <style>{`
        .pb{
          display:inline-flex;
          align-items:center;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:1100;
          border: 1px solid rgba(15,23,42,0.10);
          white-space: nowrap;
        }
        .pb.ga4{ background: rgba(66,133,244,0.12); border-color: rgba(66,133,244,0.18); color:#4285F4; }
        .pb.default{ background: rgba(13,202,240,0.10); border-color: rgba(13,202,240,0.18); color:#0DCAF0; }
      `}</style>
    </span>
  );
}

/* ---------- Utils ---------- */
function safeJson(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function payloadPreview(payload) {
  try {
    const str = JSON.stringify(payload ?? {});
    return str.length > 60 ? str.slice(0, 60) + "…" : str;
  } catch {
    return "View";
  }
}
