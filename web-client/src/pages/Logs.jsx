import { useEffect, useMemo, useState } from "react";
import Container from "../components/layout/Container";
import Skeleton from "../components/ui/Skeleton";
import { fetchEventLogs } from "../api/logs.api";
import { getStoreId } from "../utils/store";

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
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {
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
            platform: "Meta",
            type: "purchase",
            order_id: "ORDER_2000",
            value: "SAR 199",
            status: "FAILED",
            payload: { error: "Invalid token" }
          }
        ]);
      })
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
        platformFilter === "ALL"
          ? true
          : platform.toUpperCase() === platformFilter;

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
        {/* Toolbar */}
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

          <select
            className="select"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="ALL">All Platforms</option>
            <option value="GA4">GA4</option>
            <option value="META">Meta</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SNAP">Snap</option>
          </select>

          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>

        {/* ✅ Table: NO blank space */}
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

                    {/* ✅ Payload shows a short preview (no layout breaking) */}
                    <td>
                      <details className="payload">
                        <summary className="payloadSummary">
                          {payloadPreview(e.payload)}
                        </summary>
                        <pre className="payloadPre">{safeJson(e.payload)}</pre>
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

      {/* ✅ move this CSS to App.css */}
      <style>{`
        .logCard{
          width:100%;
          background:#fff;
          border:1px solid rgba(15,23,42,0.10);
          border-radius:22px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.10);
          overflow:hidden;
        }

        .logToolbar{
          display:grid;
          grid-template-columns: 1.4fr 0.7fr 0.7fr;
          gap:12px;
          padding:14px;
          border-bottom:1px solid rgba(15,23,42,0.06);
          background:
            radial-gradient(circle at 12% 20%, rgba(175,23,99,0.08), transparent 55%),
            radial-gradient(circle at 92% 20%, rgba(13,202,240,0.08), transparent 55%);
        }
        @media (max-width: 860px){
          .logToolbar{ grid-template-columns: 1fr; }
        }

        .logSearch{
          display:flex;
          align-items:center;
          gap:10px;
          padding:0 12px;
          height:44px;
          border-radius:16px;
          border:1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.96);
        }
        .searchIcon{ color: rgba(17,24,39,0.55); font-weight:900; }
        .searchInput{
          flex:1;
          border:0;
          outline:none;
          background:transparent;
          color:#111827;
          font-size:13px;
          font-weight:800;
        }
        .searchInput::placeholder{ color: rgba(17,24,39,0.45); font-weight:700; }

        .select{
          height:44px;
          border-radius:16px;
          border:1px solid rgba(15,23,42,0.10);
          padding:0 12px;
          font-size:13px;
          font-weight:900;
          color:#111827;
          background: rgba(255,255,255,0.96);
          outline:none;
        }

        /* ✅ Key: prevent blank space by allowing natural sizing */
        .tableWrap{
          width:100%;
          overflow-x:auto; /* only if needed on very small screens */
        }

        .logTable{
          width:100%;
          border-collapse: collapse;
          table-layout: auto;     /* ✅ fills space naturally */
        }

        .logTable thead th{
          text-align:left;
          padding:12px 14px;
          font-size:12px;
          font-weight:1000;
          color: rgba(17,24,39,0.72);
          background:#fff;
          border-bottom:1px solid rgba(15,23,42,0.06);
          position: sticky;
          top: 0;
          z-index: 1;
          white-space: nowrap;
        }

        .logTable tbody td{
          padding:12px 14px;
          border-bottom:1px solid rgba(15,23,42,0.06);
          font-size:13px;
          font-weight:800;
          color:#111827;
          vertical-align: middle;
        }

        .logTable tbody tr:hover td{
          background: rgba(13,110,253,0.03);
        }

        /* Controlled widths only for small columns */
        .colTime{ width: 110px; }
        .colPlatform{ width: 120px; }
        .colType{ width: 130px; }
        .colOrder{ width: 170px; }
        .colValue{ width: 120px; }
        .colStatus{ width: 120px; }
        .colPayload{ width: auto; } /* ✅ take remaining space */

        .muted{ color: rgba(17,24,39,0.60); font-weight:800; }
        .mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
          font-weight: 900;
          font-size: 12.5px;
          white-space: nowrap;
        }

        .typePill{
          display:inline-flex;
          align-items:center;
          padding:6px 10px;
          border-radius:999px;
          background: rgba(13,202,240,0.10);
          border: 1px solid rgba(13,202,240,0.18);
          color:#0DCAF0;
          font-size:12px;
          font-weight:1000;
          text-transform: lowercase;
          white-space: nowrap;
        }

        /* ✅ Payload preview stays single line and doesn't create empty space */
        .payload{
          max-width: 100%;
        }

        .payloadSummary{
          cursor:pointer;
          color:#0D6EFD;
          font-weight:1000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .payloadPre{
          margin-top:10px;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid rgba(15,23,42,0.10);
          background: rgba(25, 28, 36, 0.04);
          color:#111827;
          max-height:220px;
          overflow:auto;
          font-size:12px;
        }

        .logFooter{
          display:flex;
          justify-content:space-between;
          gap:12px;
          padding:12px 14px;
          background: rgba(25, 28, 36, 0.03);
        }

        .emptyInline{
          padding:22px 12px;
          text-align:center;
          font-size:13px;
          font-weight:900;
          color: rgba(17,24,39,0.60);
        }

        .emptyState{ padding:34px 18px; text-align:center; }
        .emptyIcon{ font-size:34px; }
        .emptyTitle{ margin-top:10px; font-size:16px; font-weight:1100; color:#111827; }
        .emptySub{
          margin-top:6px;
          font-size:13px;
          font-weight:800;
          color: rgba(17,24,39,0.62);
          max-width:520px;
          margin-left:auto;
          margin-right:auto;
        }
      `}</style>
    </Container>
  );
}

/* ---------- Badges ---------- */

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const ok = s === "SUCCESS";

  return (
    <span className={`st ${ok ? "ok" : "bad"}`}>
      {ok ? "SUCCESS" : "FAILED"}
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
  const cls =
    p === "GA4" ? "ga4" :
    p === "META" ? "meta" :
    p === "TIKTOK" ? "tiktok" :
    p === "SNAP" ? "snap" :
    "default";

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
        .pb.meta{ background: rgba(24,119,242,0.12); border-color: rgba(24,119,242,0.18); color:#1877F2; }
        .pb.tiktok{ background: rgba(254,44,85,0.10); border-color: rgba(254,44,85,0.18); color:#FE2C55; }
        .pb.snap{ background: rgba(255,193,7,0.14); border-color: rgba(255,193,7,0.20); color:#B45309; }
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
