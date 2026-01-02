// web-client/src/pages/Dashboard.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store";
import { fetchDashboardSummary } from "../api/platforms.api";
import { fetchEventLogs } from "../api/logs.api";

/* ---------------- Helpers ---------------- */

function computeDelayMs() {
  const hidden = document.hidden;
  const base = hidden ? 12000 : 5000;
  const jitter = Math.floor(Math.random() * 600) - 300;
  return Math.max(1500, base + jitter);
}

function safeParse(v) {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return null;
  }
}

/**
 * ✅ Robust date parser:
 * - Date object
 * - epoch ms/seconds (number or numeric string)
 * - ISO strings
 * - "YYYY-MM-DD HH:mm:ss" (Catalyst style) as UTC
 */
function parseDateish(input) {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "number") {
    const ms = input > 1e12 ? input : input > 1e9 ? input * 1000 : null;
    if (!ms) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(input).trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n > 1e12 ? n : n > 1e9 ? n * 1000 : null;
    if (!ms) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (s.includes("T")) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "Z"); // treat as UTC
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMoney(n) {
  try {
    return new Intl.NumberFormat("en-US").format(Number(n || 0));
  } catch {
    return String(n ?? 0);
  }
}

function clampNonNeg(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

/**
 * ✅ Stats endpoint unwrap
 */
function unwrapStatsResponse(resp) {
  const a = resp?.data; // axios
  const b = resp; // apiGet direct

  const candidates = [a?.data, a, b?.data, b];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;

    if (c.ok === true && c.data && typeof c.data === "object") {
      return {
        total: Number(c.data.total || 0),
        by_status: c.data.by_status || {}
      };
    }

    if ("total" in c || "by_status" in c) {
      return {
        total: Number(c.total || 0),
        by_status: c.by_status || {}
      };
    }
  }
  return null;
}

/**
 * ✅ Events response unwrap (super defensive)
 */
function unwrapEventsResponse(resp) {
  const root = resp?.data ?? resp;

  const seen = new Set();
  const queue = [root];

  const push = (v) => {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);
    queue.push(v);
  };

  while (queue.length) {
    const cur = queue.shift();

    if (Array.isArray(cur)) return cur;

    if (cur?.ok === true && cur?.data) push(cur.data);

    const maybe =
      cur?.items ??
      cur?.records ??
      cur?.rows ??
      cur?.result ??
      cur?.data;

    if (Array.isArray(maybe)) return maybe;
    if (Array.isArray(cur?.data?.items)) return cur.data.items;

    push(cur?.data);
    push(cur?.data?.data);
    push(cur?.data?.data?.data);
    push(cur?.items);
    push(cur?.records);
    push(cur?.rows);
    push(cur?.result);
  }

  return [];
}

/**
 * ✅ Catalyst ZCQL rows often come like: { events: { ...columns } }
 * This unwrap makes sure we always work with the actual row data object.
 */
function normalizeRow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  // common ZCQL shape:
  if (raw.events && typeof raw.events === "object" && !Array.isArray(raw.events)) {
    return raw.events;
  }

  const keys = Object.keys(raw);
  if (keys.length === 1) {
    const v = raw[keys[0]];
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  }

  return raw;
}

/**
 * ✅ case-insensitive getter
 */
function getAny(row, keysLower) {
  if (!row || typeof row !== "object") return undefined;

  // direct match first
  for (const k of keysLower) {
    if (k in row) return row[k];
  }

  // map lower -> value
  const map = {};
  for (const k of Object.keys(row)) map[k.toLowerCase()] = row[k];

  for (const k of keysLower) {
    const v = map[k.toLowerCase()];
    if (v !== undefined) return v;
  }

  return undefined;
}

function diffStats(cur24, stats48) {
  const curBy = cur24?.by_status || {};
  const b48By = stats48?.by_status || {};

  const mk = (key) => clampNonNeg((b48By[key] || 0) - (curBy[key] || 0));

  const prevBy = {
    sent: mk("sent"),
    failed: mk("failed"),
    skipped: mk("skipped"),
    pending: mk("pending")
  };

  const prevTotal = clampNonNeg((stats48?.total || 0) - (cur24?.total || 0));
  return { total: prevTotal, by_status: prevBy };
}

function pctDelta(current, previous) {
  const c = clampNonNeg(current);
  const p = clampNonNeg(previous);
  if (p <= 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
}

function dayLabelsLast7() {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
}

function dayIndexMonFirst(date) {
  const d = date.getUTCDay();
  return d === 0 ? 6 : d - 1;
}

/* ---------------- Page ---------------- */

export default function Dashboard() {
  const [storeId, setStoreIdState] = useState(() => getStoreId() || "");
  const storeRef = useRef(storeId);

  const [loading, setLoading] = useState(true);

  const [stats24, setStats24] = useState({ total: 0, by_status: {} });
  const [statsPrev24, setStatsPrev24] = useState({ total: 0, by_status: {} });

  const [trafficSeries, setTrafficSeries] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [platformDist, setPlatformDist] = useState([{ platform: "GA4", value: 0, color: "#0D6EFD" }]);
  const [revenueSar, setRevenueSar] = useState(0);

  /* ✅ store changes */
  useEffect(() => {
    const syncStore = () => setStoreIdState(getStoreId() || "");

    const onStorage = (e) => {
      if (e.key === "selected_store_id") syncStore();
    };

    const onStoreChange = (e) => {
      const next = e?.detail?.storeId;
      if (next) setStoreIdState(String(next));
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

  /* ✅ polling */
  useEffect(() => {
    storeRef.current = storeId;

    let alive = true;
    let timer = null;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const scheduleNext = (ms) => {
      stop();
      timer = setTimeout(() => tick(false), ms);
    };

    const applyFallback = (fallbackTotal) => {
      const buckets = [0, 0, 0, 0, 0, 0, 0];
      buckets[dayIndexMonFirst(new Date())] = fallbackTotal;

      setTrafficSeries(buckets);
      setPlatformDist([{ platform: "GA4", value: fallbackTotal, color: "#0D6EFD" }]);
      setRevenueSar(0);
    };

    const hydrateFromEvents = (rawRows, nowMs, fallbackTotal = 0) => {
      const rows = (rawRows || []).map(normalizeRow).filter(Boolean);

      const last7Ms = nowMs - 7 * 24 * 3600 * 1000;
      const last24Ms = nowMs - 24 * 3600 * 1000;

      const buckets = [0, 0, 0, 0, 0, 0, 0];
      const byPlatform = new Map();
      let revenue = 0;

      let parsedCount = 0;

      for (const row of rows) {
        // ✅ IMPORTANT: prioritize last_attempt_at (this is what your stats likely uses)
        const createdRaw = getAny(row, [
          "last_attempt_at",
          "lastattemptat",
          "createdtime",
          "created_time",
          "created_at",
          "modifiedtime",
          "modified_time",
          "timestamp",
          "time"
        ]);

        const created = parseDateish(createdRaw);
        if (!created) continue;
        parsedCount++;

        const t = created.getTime();

        const platform = String(getAny(row, ["last_platform", "platform", "source"]) ?? "GA4").toUpperCase();

        if (t >= last24Ms) {
          byPlatform.set(platform, (byPlatform.get(platform) || 0) + 1);
        }

        if (t >= last7Ms) {
          buckets[dayIndexMonFirst(created)] += 1;
        }

        const status = String(getAny(row, ["status"]) ?? "").toLowerCase();
        if (t >= last24Ms && status === "sent") {
          const payload = safeParse(getAny(row, ["payload"]));
          const amount =
            payload?.data?.total?.amount ??
            payload?.data?.total ??
            payload?.total?.amount ??
            payload?.total ??
            payload?.value ??
            null;

          const num = Number(amount);
          if (Number.isFinite(num)) revenue += num;
        }
      }

      const bucketsSum = buckets.reduce((a, b) => a + b, 0);

      const distItems = Array.from(byPlatform.entries())
        .map(([p, v]) => ({
          platform: p,
          value: v,
          color: p === "GA4" ? "#0D6EFD" : "#0DCAF0"
        }))
        .sort((a, b) => b.value - a.value);

      const distSum = distItems.reduce((s, it) => s + (Number(it.value) || 0), 0);

      // ✅ if parsing fails or results still empty but KPI says events exist → fallback
      if ((parsedCount === 0 || (bucketsSum === 0 && distSum === 0)) && fallbackTotal > 0) {
        applyFallback(fallbackTotal);
        return;
      }

      setTrafficSeries(buckets);
      setPlatformDist(distItems.length ? distItems : [{ platform: "GA4", value: 0, color: "#0D6EFD" }]);
      setRevenueSar(revenue);
    };

    const tick = async (initial) => {
      try {
        if (!storeId || !String(storeId).trim()) {
          if (alive) {
            setStats24({ total: 0, by_status: {} });
            setStatsPrev24({ total: 0, by_status: {} });
            setTrafficSeries([0, 0, 0, 0, 0, 0, 0]);
            setPlatformDist([{ platform: "GA4", value: 0, color: "#0D6EFD" }]);
            setRevenueSar(0);
            setLoading(false);
          }
          return;
        }

        if (initial) setLoading(true);

        const [r24, r48, ev] = await Promise.all([
          fetchDashboardSummary(storeId, 24),
          fetchDashboardSummary(storeId, 48),
          fetchEventLogs({ storeId, limit: 500 })
        ]);

        if (!alive || storeRef.current !== storeId) return;

        const s24 = unwrapStatsResponse(r24) || { total: 0, by_status: {} };
        const s48 = unwrapStatsResponse(r48) || { total: 0, by_status: {} };
        const prev = diffStats(s24, s48);

        setStats24(s24);
        setStatsPrev24(prev);

        const rows = unwrapEventsResponse(ev);
        hydrateFromEvents(rows, Date.now(), s24.total);

        if (initial) setLoading(false);
        scheduleNext(computeDelayMs());
      } catch {
        if (initial) setLoading(false);
        scheduleNext(9000);
      }
    };

    const onVis = () => {
      if (!document.hidden) tick(false);
    };

    document.addEventListener("visibilitychange", onVis);
    tick(true);

    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [storeId]);

  /* -------- Derived metrics -------- */

  const summary = useMemo(() => {
    const by = stats24.by_status || {};
    const total = clampNonNeg(stats24.total);

    const sent = clampNonNeg(by.sent);
    const failed = clampNonNeg(by.failed);
    const skipped = clampNonNeg(by.skipped);
    const pending = clampNonNeg(by.pending);

    const delivered = sent + failed;
    const successRate = delivered > 0 ? (sent / delivered) * 100 : 0;

    return { total, sent, failed, skipped, pending, successRate };
  }, [stats24]);

  const prevSummary = useMemo(() => {
    const by = statsPrev24.by_status || {};
    const total = clampNonNeg(statsPrev24.total);

    return {
      total,
      sent: clampNonNeg(by.sent),
      failed: clampNonNeg(by.failed),
      skipped: clampNonNeg(by.skipped),
      pending: clampNonNeg(by.pending)
    };
  }, [statsPrev24]);

  const kpis = useMemo(() => {
    return [
      { label: "Total Events", value: summary.total, delta: pctDelta(summary.total, prevSummary.total), icon: "📤", tone: "blue" },
      { label: "Sent", value: summary.sent, delta: pctDelta(summary.sent, prevSummary.sent), icon: "✅", tone: "green" },
      { label: "Failed", value: summary.failed, delta: pctDelta(summary.failed, prevSummary.failed), icon: "❌", tone: "pink" },
      { label: "Skipped", value: summary.skipped, delta: pctDelta(summary.skipped, prevSummary.skipped), icon: "⏭️", tone: "yellow" }
    ];
  }, [summary, prevSummary]);

  const trafficTrend = useMemo(() => {
    return {
      labels: dayLabelsLast7(),
      series: [{ name: "Events", color: "#0D6EFD", data: trafficSeries }]
    };
  }, [trafficSeries]);

  const lossPct = summary.total > 0 ? (summary.skipped / summary.total) * 100 : 0;

  const platformCards = useMemo(() => {
    return [
      {
        name: "GA4",
        desc: "Analytics events",
        pill: "Tracking",
        tone: "#0D6EFD",
        accent: "linear-gradient(90deg,#4285F4,#34A853,#FBBC05,#EA4335)",
        stats: {
          forwarded: summary.total,
          successRate: Number(summary.successRate.toFixed(1)),
          revenue: Number(revenueSar.toFixed(2)),
          loss: Number(lossPct.toFixed(1))
        }
      }
    ];
  }, [summary, revenueSar, lossPct]);

  /* -------- Render -------- */

  return (
    <div className="dash">
      <div className="topbar">
        <div className="brandArea">
          <div className="logoBubble">∿</div>
          <div>
            <div className="brandTitle">Salla Hub</div>
            <div className="brandSub">Server-side tracking overview</div>
          </div>
        </div>

        <div className="topbarRight">
          <div className="storeChip">
            <span className="dotLive" />
            Store: <b>{storeId || "N/A"}</b>
          </div>
          <div className="rangeChip">Last 24 hours</div>
        </div>
      </div>

      <div className="grid4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="kpi" key={i}>
                <Skeleton height={14} width="55%" />
                <div style={{ marginTop: 12 }}>
                  <Skeleton height={34} width="65%" />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Skeleton height={12} width="45%" />
                </div>
              </div>
            ))
          : kpis.map((k) => <KPI key={k.label} {...k} />)}
      </div>

      <div className="mainGrid">
        <div className="card premium">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Traffic Trend</div>
              <div className="cardSub">Last 7 days (events/day)</div>
            </div>
            <span className="pill blue">Traffic</span>
          </div>

          <div className="cardBody">
            {loading ? (
              <Skeleton height={300} />
            ) : (
              <>
                <GroupedBarChart labels={trafficTrend.labels} series={trafficTrend.series} />
                {trafficTrend.series[0].data.every((x) => Number(x || 0) === 0) && (
                  <div className="emptyChartNote">No traffic yet for the last 7 days.</div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Platform Distribution</div>
              <div className="cardSub">Last 24 hours</div>
            </div>
            <span className="pill cyan">Sources</span>
          </div>

          <div className="cardBody cardBodyDist">
            {loading ? (
              <>
                <Skeleton height={240} />
                <div style={{ marginTop: 12 }}>
                  <Skeleton height={12} width="70%" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Skeleton height={12} width="55%" />
                </div>
              </>
            ) : (
              <AnimatedDonutDistribution
                items={platformDist}
                centerTitle="Total Events"
                centerValue={formatMoney(summary.total)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="platformRow">
        {loading ? (
          <div className="pCard">
            <Skeleton height={10} width="45%" />
            <div style={{ marginTop: 10 }}>
              <Skeleton height={18} width="65%" />
            </div>
            <div style={{ marginTop: 14 }}>
              <Skeleton height={110} />
            </div>
          </div>
        ) : (
          platformCards.map((p) => <PlatformCard key={p.name} {...p} />)
        )}
      </div>

      <style>{css}</style>
    </div>
  );
}

/* KPI */
function KPI({ label, value, delta, icon, tone }) {
  const d = Number(delta || 0);
  const isUp = d >= 0;
  const abs = Math.abs(d);

  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpiTop">
        <div className="kpiLabel">{label}</div>
        <div className="kpiIcon">{icon}</div>
      </div>

      <div className="kpiValue">{value}</div>

      <div className="kpiBottom">
        <div className={`delta ${isUp ? "up" : "down"}`}>
          {isUp ? "▲" : "▼"} {abs.toFixed(0)}%
        </div>
        <div className="kpiHint">vs previous 24h</div>
      </div>
    </div>
  );
}

/* Platform Card */
function PlatformCard({ name, desc, pill, tone, accent, stats }) {
  return (
    <div className="pCard">
      <div className="pAccent" style={{ background: accent }} />
      <div className="pBody">
        <div className="pTop">
          <div>
            <div className="pName">{name}</div>
            <div className="pDesc">{desc}</div>
          </div>
          <div
            className="pPill"
            style={{
              color: tone,
              background: `${tone}12`,
              borderColor: `${tone}26`
            }}
          >
            {pill}
          </div>
        </div>

        <div className="pStats">
          <StatMini label="Forwarded" value={stats.forwarded} />
          <StatMini label="Success" value={`${stats.successRate}%`} />
          <StatMini label="Revenue" value={`SAR ${formatMoney(stats.revenue)}`} />
          <StatMini label="Loss" value={`${stats.loss}%`} />
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value }) {
  return (
    <div className="mini">
      <div className="miniLabel">{label}</div>
      <div className="miniValue">{value}</div>
    </div>
  );
}

/* Bar Chart */
function GroupedBarChart({ labels = [], series = [] }) {
  const [hover, setHover] = useState(null);

  const W = 980,
    H = 300;
  const PAD_X = 44,
    PAD_TOP = 20,
    PAD_BOTTOM = 40;

  const max = Math.max(1, ...series.flatMap((s) => s.data || []));
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const groups = labels.length || 1;
  const groupW = innerW / groups;

  const barCount = Math.max(1, series.length);
  const gap = Math.max(6, Math.floor(groupW * 0.06));
  const barW = Math.max(10, Math.floor((groupW - gap * (barCount + 1)) / barCount));

  const x0 = (i) => PAD_X + i * groupW;
  const barX = (i, j) => x0(i) + gap + j * (barW + gap);

  const y = (v) => PAD_TOP + (1 - v / max) * innerH;
  const barH = (v) => PAD_TOP + innerH - y(v);

  const onMove = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    const idx = Math.min(labels.length - 1, Math.max(0, Math.floor((mx - PAD_X) / groupW)));
    setHover({ idx });
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="300"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      style={{ display: "block" }}
    >
      {labels.map((lb, i) => (
        <text
          key={lb}
          x={x0(i) + groupW / 2}
          y={H - 12}
          textAnchor="middle"
          fontSize="12"
          fill="rgba(15,23,42,0.55)"
          fontWeight="900"
        >
          {lb}
        </text>
      ))}

      {labels.map((_, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const v = s.data?.[i] ?? 0;
            return (
              <rect
                key={`${i}-${j}`}
                x={barX(i, j)}
                y={y(v)}
                width={barW}
                height={barH(v)}
                rx="10"
                fill={s.color}
                opacity={hover && hover.idx !== i ? 0.45 : 0.95}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/* Donut */
function AnimatedDonutDistribution({ items = [], centerTitle, centerValue }) {
  const [active, setActive] = useState(null);

  const sum = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
  const total = Math.max(1, sum);

  const arcs = items.map((it) => ({ ...it, value: Number(it.value) || 0 }));
  const size = 230;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const slices = arcs.map((it) => {
    const pct = it.value / total;
    const len = pct * c;
    const obj = { ...it, pct, len, offset };
    offset += len;
    return obj;
  });

  const activeSlice = typeof active === "number" ? slices[active] : null;

  return (
    <div className="donutWrap">
      <div className="donutLeft">
        <div className="donutStage">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(15,23,42,0.08)"
              strokeWidth={stroke}
            />

            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {slices.map((a, i) => (
                <circle
                  key={a.platform}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${a.len} ${c - a.len}`}
                  strokeDashoffset={-a.offset}
                  className="donutArc"
                  style={{ opacity: active === null || active === i ? 1 : 0.35 }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              ))}
            </g>

            <foreignObject x="52" y="78" width="126" height="90">
              <div className="donutCenter">
                <div className="donutTitle">{centerTitle}</div>
                <div className="donutValue">{centerValue}</div>
                {activeSlice ? (
                  <div className="donutActive">
                    <span className="dot" style={{ background: activeSlice.color }} />
                    {activeSlice.platform}: <b>{Math.round(activeSlice.pct * 100)}%</b>
                  </div>
                ) : (
                  <div className="donutActive muted">{sum > 0 ? "Hover a slice" : "No events yet"}</div>
                )}
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>

      <div className="donutRight">
        <div className="donutLegend">
          {slices.map((a, i) => (
            <div
              key={a.platform}
              className="donutItem"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="dot" style={{ background: a.color }} />
              <div className="donutItemText">
                <div className="donutItemName">{a.platform}</div>
                <div className="donutItemSub">
                  {formatMoney(a.value)} • <b>{Math.round(a.pct * 100)}%</b>
                </div>
              </div>
              <div className="donutPill">{Math.round(a.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- CSS ---------------- */

const css = `
:root{
  --a:#AF1763;
  --b:#0D6EFD;
  --g:#198754;
  --c:#0DCAF0;
  --y:#FFC107;
}

.dash{
  width:100%;
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:14px;
  background:
    radial-gradient(circle at 12% 10%, rgba(175,23,99,0.12), transparent 60%),
    radial-gradient(circle at 90% 10%, rgba(13,202,240,0.12), transparent 55%),
    #f3f4f6;
}

.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
.brandArea{display:flex;align-items:center;gap:10px;}
.logoBubble{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--a),var(--b));font-weight:1200;}
.brandTitle{font-size:16px;font-weight:1100;color:#0f172a;}
.brandSub{margin-top:2px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.topbarRight{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
.storeChip{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;background:rgba(255,255,255,0.90);border:1px solid rgba(15,23,42,0.10);font-size:12px;font-weight:950;color:rgba(15,23,42,0.72);}
.dotLive{width:10px;height:10px;border-radius:999px;background:var(--g);box-shadow:0 0 0 6px rgba(25,135,84,0.14);}
.rangeChip{padding:10px 12px;border-radius:999px;background:rgba(13,202,240,0.12);border:1px solid rgba(13,202,240,0.22);font-size:12px;font-weight:950;color:#055a66;}

.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
@media (max-width:1100px){.grid4{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:560px){.dash{padding:12px;}.grid4{grid-template-columns:1fr;}}

.mainGrid{
  display:grid;
  grid-template-columns: 2fr 1fr;
  gap:14px;
  align-items: stretch;
}
@media (max-width:980px){.mainGrid{grid-template-columns:1fr;}}

.card{
  border-radius:22px;
  padding:14px;
  background:rgba(255,255,255,0.86);
  border:1px solid rgba(15,23,42,0.10);
  display:flex;
  flex-direction:column;
}
.cardBody{
  flex:1;
  padding-top:10px;
  min-height: 320px;
  position: relative;
}
.emptyChartNote{
  position:absolute;
  left:14px;
  bottom:12px;
  font-size:12px;
  font-weight:900;
  color:rgba(15,23,42,0.45);
}
.cardBodyDist{
  display:flex;
  align-items:center;
  justify-content:center;
}
.cardHead{display:flex;justify-content:space-between;gap:12px;}
.cardTitle{font-size:15px;font-weight:1150;color:#0f172a;}
.cardSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.card.premium{background:rgba(255,255,255,0.90);}

.pill{padding:7px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);}
.pill.blue{background:rgba(13,110,253,0.14);border-color:rgba(13,110,253,0.22);color:#083b8a;}
.pill.cyan{background:rgba(13,202,240,0.14);border-color:rgba(13,202,240,0.22);color:#055a66;}

.kpi{border-radius:22px;padding:16px;background:rgba(255,255,255,0.90);border:1px solid rgba(15,23,42,0.10);}
.kpiTop{display:flex;justify-content:space-between;align-items:center;}
.kpiLabel{font-size:13px;font-weight:950;color:rgba(15,23,42,0.65);}
.kpiIcon{width:44px;height:44px;border-radius:18px;display:grid;place-items:center;background:rgba(15,23,42,0.05);}
.kpiValue{margin-top:10px;font-size:28px;font-weight:1200;color:#0f172a;}
.kpiBottom{margin-top:10px;display:flex;justify-content:space-between;align-items:center;}
.kpiHint{font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.delta{font-size:12px;font-weight:1100;padding:7px 10px;border-radius:999px;border:1px solid rgba(15,23,42,0.10);}
.delta.up{background:rgba(25,135,84,0.14);border-color:rgba(25,135,84,0.22);color:#0b3d1f;}
.delta.down{background:rgba(171,46,60,0.14);border-color:rgba(171,46,60,0.22);color:#6b0d16;}

.donutWrap{
  width:100%;
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:center;
}
.donutLeft{
  flex: 0 0 240px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.donutRight{
  flex:1;
  min-width: 0;
  display:flex;
  justify-content:center;
}
@media (max-width:980px){
  .donutWrap{ flex-direction:column; }
  .donutLeft{ flex: 0 0 auto; }
  .donutRight{ width:100%; }
}
.donutStage{display:grid;place-items:center;}
.donutArc{transform-origin:50% 50%;animation:donutIn 900ms cubic-bezier(.2,.9,.2,1) both;}
@keyframes donutIn{from{stroke-dasharray:0 9999;opacity:0.2;}to{opacity:1;}}
.donutCenter{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;}
.donutTitle{font-size:12px;font-weight:950;color:rgba(15,23,42,0.55);}
.donutValue{font-size:16px;font-weight:1200;color:#0f172a;}
.donutActive{font-size:12px;font-weight:950;color:rgba(15,23,42,0.75);display:flex;align-items:center;gap:8px;}
.donutActive.muted{color:rgba(15,23,42,0.45);}
.dot{width:10px;height:10px;border-radius:999px;display:inline-block;}

.donutLegend{
  width:100%;
  max-width: 320px;
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height: 260px;
  overflow:auto;
  padding-right: 4px;
}
.donutItem{display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.donutItemText{flex:1;}
.donutItemName{font-size:13px;font-weight:1100;color:#0f172a;}
.donutItemSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.donutPill{padding:7px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.75);color:rgba(15,23,42,0.75);}

.platformRow{
  display:flex;
  gap:14px;
}
.platformRow .pCard{
  width: 360px;
  max-width: 100%;
}

.pCard{border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.86);}
.pAccent{height:6px;width:100%;}
.pBody{padding:14px 16px 16px;}
.pTop{display:flex;justify-content:space-between;gap:10px;}
.pName{font-size:14px;font-weight:1100;color:#0f172a;}
.pDesc{margin-top:3px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.pPill{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:1050;border:1px solid rgba(15,23,42,0.10);}
.pStats{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.mini{border-radius:16px;padding:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.miniLabel{font-size:11px;font-weight:950;color:rgba(15,23,42,0.55);}
.miniValue{margin-top:6px;font-size:14px;font-weight:1150;color:#0f172a;}
`;
