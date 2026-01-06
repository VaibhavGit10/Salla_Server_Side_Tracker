import { useEffect, useMemo, useState } from "react";
import Container from "../components/layout/Container";
import Skeleton from "../components/ui/Skeleton";
import { fetchEventLogs } from "../api/logs.api";
import { getStoreId } from "../utils/store";
import { useTranslation } from "../utils/i18n";

const MAX_EVENTS_IN_UI = 1200;

/* ----------------------------- Safe helpers ----------------------------- */
function safeParse(v) {
  try {
    if (v == null) return null;
    if (typeof v === "object") return v;
    if (typeof v === "string" && !v.trim()) return null;
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return null;
  }
}

function parseDateish(input) {
  if (input == null) return null;

  // unix seconds / ms
  if (typeof input === "number" && Number.isFinite(input)) {
    const ms = input > 1e12 ? input : input * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(input || "").trim();
  if (!s) return null;

  // "1700000000" / "1700000000000"
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    const ms = s.length === 13 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ISO
  if (s.includes("T")) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const localTry = new Date(s.replace(" ", "T"));
    if (!Number.isNaN(localTry.getTime())) return localTry;

    const utcTry = new Date(s.replace(" ", "T") + "Z");
    return Number.isNaN(utcTry.getTime()) ? null : utcTry;
  }

  // JS date strings: "Mon Jan 05 2026 10:02:03 GMT+..."
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelativeTime(anyDate) {
  const d = parseDateish(anyDate);
  if (!d) return "-";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 0) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatAbsolute(anyDate) {
  const d = parseDateish(anyDate);
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return d.toString();
  }
}

function formatSar(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  try {
    return `SAR ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
  } catch {
    return `SAR ${n}`;
  }
}

function mapDbStatusToUi(s) {
  const v = String(s || "").toLowerCase();
  if (v === "sent") return "SUCCESS";
  if (v === "failed") return "FAILED";
  if (v === "skipped") return "SKIPPED";
  if (v === "pending") return "PENDING";
  return (s || "UNKNOWN").toString().toUpperCase();
}

/**
 * Handles different API shapes safely:
 * - axios: { data: ... }
 * - { ok: true, data: { items: [] } }
 * - { items: [] }
 * - [] directly
 */
function unwrapEventLogResponse(resp) {
  const a = resp?.data;
  const b = resp;
  const candidates = [a?.data, a, b?.data, b].filter(Boolean);

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;

    if (c.ok === true && c.data && typeof c.data === "object") {
      const d = c.data;
      if (Array.isArray(d.items)) return d.items;
      if (Array.isArray(d.data)) return d.data;
      if (Array.isArray(d)) return d;
    }

    if (Array.isArray(c.items)) return c.items;
    if (Array.isArray(c.data)) return c.data;
    if (Array.isArray(c)) return c;
  }

  if (Array.isArray(a)) return a;
  if (Array.isArray(b)) return b;
  return [];
}

function stableRowId(row) {
  const rid = row?.ROWID || row?.rowid || row?.id;
  if (rid != null) return String(rid);

  // fallback key if DB doesn't provide id
  const t = String(row?.CREATEDTIME || row?.created_time || row?.created_at || row?.last_attempt_at || "");
  const ext = String(row?.external_id || "");
  const st = String(row?.status || "");
  const plat = String(row?.last_platform || row?.platform || "");
  const typ = String(row?.type || "");
  return `${t}::${ext}::${st}::${plat}::${typ}`;
}

/**
 * ✅ Fix for missing "Time" (showing "-"):
 * Some rows don't have CREATEDTIME/created_at in DB,
 * but the payload contains created_at like: "Mon Jan 05 2026 ...".
 * So we fallback to payload.created_at (and a few common variants).
 */
function getCreatedRaw(row, payloadObj) {
  return (
    row?.CREATEDTIME ||
    row?.created_time ||
    row?.created_at ||
    row?.last_attempt_at ||
    payloadObj?.created_at ||
    payloadObj?.createdAt ||
    payloadObj?.data?.created_at ||
    payloadObj?.data?.createdAt ||
    payloadObj?.data?.order?.created_at ||
    payloadObj?.data?.order?.createdAt ||
    null
  );
}

function mapRowToLog(row) {
  const payloadObj = safeParse(row?.payload);

  // Some payloads store order under payload.data, some under payload.order
  const data = payloadObj?.data ?? payloadObj ?? {};
  const order = data?.order ?? data;

  const createdRaw = getCreatedRaw(row, payloadObj);
  const created = parseDateish(createdRaw);
  const createdTs = created ? created.getTime() : 0;

  const orderId = order?.id || row?.external_id || "-";
  const value = order?.total?.amount ?? order?.total ?? null;

  const platform = String(row?.last_platform || row?.platform || "GA4").toUpperCase();

  return {
    rowid: stableRowId(row),
    createdTs,
    createdRaw,
    time: formatRelativeTime(createdRaw),
    timeAbs: formatAbsolute(createdRaw),

    platform,
    type: row?.type || data?.event || "-",
    order_id: String(orderId),
    value: value != null ? formatSar(value) : "-",
    status: mapDbStatusToUi(row?.status),

    payload: payloadObj,

    // keep these available for the payload panel (only shown if present)
    last_error: row?.last_error || "",
    last_response: row?.last_response || "",
  };
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function payloadPreview(payload) {
  try {
    const s = JSON.stringify(payload ?? {});
    if (!s) return "-";
    return s.length > 110 ? s.slice(0, 110) + "…" : s;
  } catch {
    return "-";
  }
}

/* ----------------------------- Icon (no deps) ---------------------------- */
function RefreshIcon({ spin = false }) {
  return (
    <svg className={`ri ${spin ? "spin" : ""}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 12a8 8 0 0 1-14.9 4H3v-6h6v2H6.3A6 6 0 1 0 12 6c1.7 0 3.2.7 4.3 1.7L14 10h7V3l-2.3 2.3A7.97 7.97 0 0 0 12 4a8 8 0 0 1 8 8z"
      />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg className={`chev ${open ? "open" : ""}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

/* ------------------------------ Main Page ------------------------------- */
export default function Logs() {
  const { t } = useTranslation();
  const [storeId, setStoreIdState] = useState(() => String(getStoreId() || "").trim());

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [platformFilter, setPlatformFilter] = useState("ALL");

  // ✅ Single payload UI (no "two payloads"):
  // We show ONLY one clickable JSON chip; clicking expands a row panel.
  const [openRowId, setOpenRowId] = useState(null);

  /* Keep store id in sync (same tab + other tabs) */
  useEffect(() => {
    const syncStore = () => setStoreIdState(String(getStoreId() || "").trim());

    const onStorage = (e) => {
      if (e.key === "selected_store_id") syncStore();
    };

    const onStoreChange = (e) => {
      const next = String(e?.detail?.storeId || "").trim();
      if (next) setStoreIdState(next);
      else syncStore();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("store_id_changed", onStoreChange);
    syncStore();

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("store_id_changed", onStoreChange);
    };
  }, []);

  /* Fetch once (NO polling / NO loop) */
  const loadLogs = async (sid, { silent } = { silent: false }) => {
    const cleanSid = String(sid || "").trim();

    if (!cleanSid) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await fetchEventLogs({ storeId: cleanSid, limit: MAX_EVENTS_IN_UI, cursor: null });
      const rows = unwrapEventLogResponse(resp);
      const mapped = Array.isArray(rows) ? rows.map(mapRowToLog) : [];

      // Dedup + sort newest first + cap
      const dedup = new Map();
      for (const item of mapped) dedup.set(String(item.rowid), item);
      const final = Array.from(dedup.values()).sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
      if (final.length > MAX_EVENTS_IN_UI) final.length = MAX_EVENTS_IN_UI;

      setEvents(final);

      // If the open row disappeared after refresh, close it
      if (openRowId && !final.some((x) => String(x.rowid) === String(openRowId))) setOpenRowId(null);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const sid = String(storeId || "").trim();
    if (!sid) {
      setEvents([]);
      setLoading(false);
      return;
    }
    loadLogs(sid, { silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const matchesStatus = statusFilter === "ALL" ? true : status.toUpperCase() === statusFilter;
      const matchesPlatform = platformFilter === "ALL" ? true : platform.toUpperCase() === platformFilter;

      return matchesQuery && matchesStatus && matchesPlatform;
    });
  }, [events, q, statusFilter, platformFilter]);

  if (loading) {
    return (
      <Container title={t("logsTitle")} subtitle={t("logsLoadingSubtitle")}>
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
        <style>{logsCss}</style>
      </Container>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Container title={t("logsTitle")} subtitle={t("logsEmptySubtitle")}>
        <div className="logCard">
          <div className="emptyState">
            <div className="emptyIcon">📭</div>
            <div className="emptyTitle">{t("logsEmptyTitle")}</div>
            <div className="emptySub">{t("logsEmptyBody")}</div>

            <button
              type="button"
              className="selectBtn"
              onClick={() => loadLogs(String(storeId || "").trim(), { silent: true })}
              disabled={refreshing}
              title={t("logsRefresh")}
            >
              <RefreshIcon spin={refreshing} />
              <span>{refreshing ? t("logsRefreshing") : t("logsRefresh")}</span>
            </button>
          </div>
        </div>
        <style>{logsCss}</style>
      </Container>
    );
  }

  return (
    <Container title={t("logsTitle")} subtitle={t("logsMainSubtitle")}>
      <div className="logCard">
        <div className="logToolbar">
          <div className="logSearch">
            <span className="searchIcon">⌕</span>
            <input
              className="searchInput"
              placeholder={t("logsSearchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select className="select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="ALL">{t("logsAllPlatforms")}</option>
            <option value="GA4">GA4</option>
            <option value="META">Meta</option>
            <option value="TIKTOK">TikTok</option>
            <option value="SNAPCHAT">Snapchat</option>
          </select>

          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">{t("logsAllStatus")}</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="SKIPPED">SKIPPED</option>
            <option value="PENDING">PENDING</option>
          </select>

          {/* Refresh button matches select */}
          <button
            type="button"
            className="selectBtn"
            onClick={() => loadLogs(String(storeId || "").trim(), { silent: true })}
            disabled={refreshing}
            title={t("logsRefresh")}
          >
            <RefreshIcon spin={refreshing} />
            <span>{refreshing ? t("logsRefreshing") : t("logsRefresh")}</span>
          </button>
        </div>

        <div className="tableWrap">
          <table className="logTable">
            <thead>
              <tr>
                <th className="colTime">{t("logsTime")}</th>
                <th className="colPlatform">{t("logsPlatform")}</th>
                <th className="colType">{t("logsType")}</th>
                <th className="colOrder">{t("logsOrderId")}</th>
                <th className="colValue">{t("logsValue")}</th>
                <th className="colStatus">{t("logsStatus")}</th>
                <th className="colPayload">{t("logsPayload")}</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="emptyInline">{t("logsNoResults")}</div>
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const isOpen = String(openRowId || "") === String(e.rowid || "");
                  const preview = payloadPreview(e.payload);

                  return (
                    <>
                      <tr key={e.rowid}>
                        {/* ✅ Time visible again (with absolute tooltip) */}
                        <td className="tdTime muted" title={e.timeAbs || ""}>
                          {e.time}
                        </td>

                        <td className="tdPlatform">
                          <PlatformBadge platform={e.platform} />
                        </td>

                        <td className="tdType" title={String(e.type || "")}>
                          <span className="typePill">{String(e.type || "-")}</span>
                        </td>

                        <td className="tdOrder mono" title={String(e.order_id || "")}>
                          {String(e.order_id || "-")}
                        </td>

                        <td className="tdValue mono">{String(e.value || "-")}</td>

                        <td className="tdStatus">
                          <StatusBadge status={e.status} />
                        </td>

                        {/* ✅ SINGLE payload UI: click the JSON itself (no second "Payload" pill) */}
                        <td className="tdPayload">
                          <button
                            type="button"
                            className={`payloadBtn ${isOpen ? "open" : ""}`}
                            onClick={() => setOpenRowId((prev) => (String(prev || "") === String(e.rowid) ? null : e.rowid))}
                            title={t("logsViewPayload")}
                          >
                            <span className="payloadBtnText">{preview}</span>
                            <ChevronIcon open={isOpen} />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded payload row (merged view + internal scroll) */}
                      {isOpen && (
                        <tr className="payloadRow" key={`${e.rowid}__payload`}>
                          <td colSpan={7} className="payloadCell">
                            <div className="payloadPanel">
                              <div className="payloadPanelHead">
                                <div className="payloadPanelTitle">{t("logsViewPayload")}</div>
                                {e.timeAbs ? <div className="payloadPanelSub muted">{e.timeAbs}</div> : null}
                              </div>

                              <pre className="payloadPre">{safeJson(e.payload)}</pre>

                              {(e.last_error || e.last_response) && (
                                <div className="payloadMeta">
                                  <div className="payloadMetaTitle">{t("logsLastAttemptInfo")}</div>
                                  <pre className="payloadPre small">
                                    {`last_error: ${e.last_error || "-"}\nlast_response: ${e.last_response || "-"}`}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="logFooter">
          <div className="muted">
            {t("logsShowing")} <b>{filtered.length}</b> {t("logsOf")} <b>{events.length}</b> {t("logsEvents")}
          </div>
          <div className="muted">Store: {storeId || "N/A"}</div>
        </div>
      </div>

      <style>{logsCss}</style>
    </Container>
  );
}

/* ------------------------------ Badges UI ------------------------------- */
function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const ok = s === "SUCCESS";
  const skipped = s === "SKIPPED";
  const pending = s === "PENDING";

  return (
    <span className={`st ${ok ? "ok" : skipped ? "skip" : pending ? "pend" : "bad"}`}>
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
        .st.pend{
          background: rgba(13,202,240,0.14);
          border-color: rgba(13,202,240,0.22);
          color:#055a66;
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
  let cls = "default";
  if (p === "GA4") cls = "ga4";
  else if (p === "META") cls = "meta";
  else if (p === "TIKTOK") cls = "tiktok";
  else if (p === "SNAPCHAT") cls = "snap";

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
        .pb.meta{ background: rgba(24,119,242,0.12); border-color: rgba(24,119,242,0.20); color:#1877F2; }
        .pb.tiktok{ background: rgba(37,244,238,0.14); border-color: rgba(37,244,238,0.22); color:#0E7490; }
        .pb.snap{ background: rgba(255,252,0,0.22); border-color: rgba(250,204,21,0.40); color:#92400E; }
        .pb.default{ background: rgba(13,202,240,0.10); border-color: rgba(13,202,240,0.18); color:#0DCAF0; }
      `}</style>
    </span>
  );
}

/* ------------------------------- Page CSS ------------------------------- */
const logsCss = `
.logCard{
  background: rgba(255,255,255,0.86);
  border: 1px solid rgba(15,23,42,0.10);
  border-radius: 22px;
  overflow: hidden;
  max-width: 100%;
}

.logToolbar{
  display:flex;
  gap:10px;
  align-items:center;
  padding: 14px;
  border-bottom: 1px solid rgba(15,23,42,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72));
  flex-wrap: wrap;
  max-width: 100%;
}

.logSearch{
  flex: 1;
  min-width: 260px;
  display:flex;
  align-items:center;
  gap:10px;
  background: rgba(255,255,255,0.92);
  border: 1px solid rgba(15,23,42,0.10);
  border-radius: 14px;
  padding: 10px 12px;
  min-width: 0;
}

.searchIcon{
  opacity: 0.65;
  font-weight: 1000;
  user-select:none;
}

.searchInput{
  width: 100%;
  border: 0;
  outline: none;
  font-weight: 900;
  font-size: 13px;
  background: transparent;
  color: rgba(15,23,42,0.82);
}

/* Select */
.select{
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.92);
  font-weight: 950;
  font-size: 13px;
  color: rgba(15,23,42,0.78);
  outline: none;
  max-width: 100%;
}

/* Refresh button styled EXACTLY like select */
.selectBtn{
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.92);
  font-weight: 950;
  font-size: 13px;
  color: rgba(15,23,42,0.78);
  outline: none;
  max-width: 100%;
  display:inline-flex;
  align-items:center;
  gap:8px;
  cursor:pointer;
  white-space: nowrap;
}
.selectBtn:disabled{ opacity: 0.6; cursor: not-allowed; }

/* Refresh icon */
.ri{ opacity: 0.85; }
.spin{ animation: spin 0.85s linear infinite; }
@keyframes spin{ from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

.tableWrap{
  width: 100%;
  max-width: 100%;
  overflow: auto;
}

.logTable{
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 980px;
  table-layout: fixed;
}

.logTable thead th{
  text-align: left;
  font-size: 12px;
  font-weight: 1100;
  color: rgba(15,23,42,0.72);
  padding: 12px 14px;
  position: sticky;
  top: 0;
  background: rgba(255,255,255,0.92);
  border-bottom: 1px solid rgba(15,23,42,0.08);
  z-index: 1;
}

.logTable tbody td{
  padding: 12px 14px;
  border-bottom: 1px solid rgba(15,23,42,0.06);
  vertical-align: top;
  font-size: 13px;
  font-weight: 900;
  color: rgba(15,23,42,0.82);
}

.logTable tbody tr:hover td{ background: rgba(15,23,42,0.02); }

/* Neat column alignment */
.colTime{ width: 110px; }
.colPlatform{ width: 120px; }
.colType{ width: 180px; }
.colOrder{ width: 160px; }
.colValue{ width: 130px; }
.colStatus{ width: 130px; }
.colPayload{ width: 430px; }

.tdTime{ white-space: nowrap; }
.tdPlatform, .tdStatus{ white-space: nowrap; }
.tdType{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tdOrder{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tdValue{ white-space: nowrap; }
.tdPayload{ padding-right: 18px; }

.muted{ color: rgba(15,23,42,0.55); font-weight: 900; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.typePill{
  display:inline-flex;
  align-items:center;
  padding:6px 10px;
  border-radius:999px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(15,23,42,0.04);
  font-size: 12px;
  font-weight: 1100;
}

/* ✅ Single payload chip/button (click JSON => expand) */
.payloadBtn{
  width: 100%;
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap:10px;
  cursor:pointer;
  user-select:none;

  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.85);

  color: rgba(15,23,42,0.78);
  font-weight: 950;
  font-size: 12px;
  text-align: left;
}
.payloadBtn:hover{ background: rgba(15,23,42,0.04); }
.payloadBtn.open{ background: rgba(15,23,42,0.05); }
.payloadBtnText{
  flex: 1;
  min-width: 0;
  color: rgba(15,23,42,0.58);
  font-weight: 900;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.chev{ opacity: 0.65; margin-top: 1px; transition: transform 160ms ease; }
.chev.open{ transform: rotate(180deg); }

/* Expanded payload row */
.payloadRow td{ background: rgba(15,23,42,0.01); }
.payloadCell{ padding: 12px 14px 16px; }

.payloadPanel{
  border-radius: 16px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(15,23,42,0.03);
  padding: 12px;
  max-height: 340px;          /* ✅ internal scroll area */
  overflow: auto;             /* ✅ scroll inside panel */
}

.payloadPanelHead{
  display:flex;
  align-items:flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.payloadPanelTitle{
  font-size: 12px;
  font-weight: 1100;
  color: rgba(15,23,42,0.78);
}
.payloadPanelSub{
  font-size: 12px;
  font-weight: 900;
}

.payloadPre{
  margin: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid rgba(15,23,42,0.10);
  background: rgba(255,255,255,0.75);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 900;
  overflow:auto;
  max-height: 220px;          /* ✅ scroll inside JSON block too */
}
.payloadPre.small{ max-height: 120px; }

.payloadMeta{ margin-top: 10px; }
.payloadMetaTitle{
  font-size: 12px;
  font-weight: 1100;
  color: rgba(15,23,42,0.70);
  margin-bottom: 8px;
}

.logFooter{
  display:flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.84);
  flex-wrap: wrap;
}

.emptyInline{
  padding: 18px;
  text-align: center;
  color: rgba(15,23,42,0.60);
  font-weight: 950;
}

.emptyState{
  padding: 44px 18px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  gap: 10px;
}

.emptyIcon{ font-size: 32px; }
.emptyTitle{
  font-size: 16px;
  font-weight: 1150;
  color: rgba(15,23,42,0.82);
}
.emptySub{
  max-width: 560px;
  font-size: 13px;
  font-weight: 900;
  color: rgba(15,23,42,0.55);
}

@media (max-width: 820px){
  .logToolbar{ padding: 12px; }
  .logSearch{ min-width: 100%; }
  .select{ flex:1; min-width: 160px; }
  .selectBtn{ flex:1; justify-content:center; min-width: 160px; }
}
`;
