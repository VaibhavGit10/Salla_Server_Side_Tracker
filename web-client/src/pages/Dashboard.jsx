import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store";
import { fetchDashboardSummary } from "../api/platforms.api";
import { fetchEventLogs } from "../api/logs.api";

const PLATFORMS = [
  {
    key: "GA4",
    name: "GA4",
    desc: "Analytics events",
    pill: "Tracking",
    color: "#0D6EFD",
    accent: "linear-gradient(90deg,#4285F4,#34A853,#FBBC05,#EA4335)"
  },
  {
    key: "META",
    name: "Meta",
    desc: "CAPI events",
    pill: "Ads",
    color: "#7C3AED",
    accent: "linear-gradient(90deg,#7C3AED,#EC4899)"
  },
  {
    key: "TIKTOK",
    name: "TikTok",
    desc: "Pixel events",
    pill: "Ads",
    color: "#111827",
    accent: "linear-gradient(90deg,#111827,#14B8A6)"
  },
  {
    key: "SNAPCHAT",
    name: "Snapchat",
    desc: "Conversions API",
    pill: "Ads",
    color: "#F59E0B",
    accent: "linear-gradient(90deg,#F59E0B,#EF4444)"
  }
];

const EMPTY_7 = [0, 0, 0, 0, 0, 0, 0];

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

function parseDateish(input) {
  const s = String(input || "").trim();
  if (!s) return null;

  if (s.includes("T")) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T") + "Z");
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

function unwrapStatsResponse(resp) {
  const a = resp?.data;
  const b = resp;
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

function clampNonNeg(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
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

function normPlatform(p) {
  const s = String(p || "GA4").trim().toUpperCase();
  if (s === "FB" || s === "FACEBOOK" || s === "METAADS" || s === "META_ADS") return "META";
  if (s === "TIKTOKADS" || s === "TIKTOK_ADS") return "TIKTOK";
  if (s === "SNAP" || s === "SNAP_ADS") return "SNAPCHAT";
  return s;
}

function getAny(obj, keys = []) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  const lowerKeys = Object.keys(obj).reduce((m, k) => {
    m[k.toLowerCase()] = obj[k];
    return m;
  }, {});
  for (const k of keys) {
    const v = lowerKeys[String(k).toLowerCase()];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function normalizeRow(r) {
  if (!r) return null;
  if (r.data && typeof r.data === "object") return r.data;
  if (r.item && typeof r.item === "object") return r.item;
  return r;
}

function unwrapEventRows(evResp) {
  const a = evResp?.data;
  const b = evResp;
  const candidates = [a?.data, a, b?.data, b].filter(Boolean);

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;

    if (c.ok === true && c.data) {
      const d = c.data;
      if (Array.isArray(d.items)) return d.items.map(normalizeRow).filter(Boolean);
      if (Array.isArray(d.data)) return d.data.map(normalizeRow).filter(Boolean);
      if (Array.isArray(d)) return d.map(normalizeRow).filter(Boolean);
    }

    if (Array.isArray(c.items)) return c.items.map(normalizeRow).filter(Boolean);
    if (Array.isArray(c.data)) return c.data.map(normalizeRow).filter(Boolean);

    if (c.data && typeof c.data === "object") {
      if (Array.isArray(c.data.items)) return c.data.items.map(normalizeRow).filter(Boolean);
      if (Array.isArray(c.data.data)) return c.data.data.map(normalizeRow).filter(Boolean);
    }
  }

  return [];
}

export default function Dashboard() {
 const [storeId, setStoreIdState] = useState(() => String(getStoreId() || "").trim());
  const storeRef = useRef(storeId);
  const [loading, setLoading] = useState(true);

  const [stats24, setStats24] = useState({ total: 0, by_status: {} });
  const [statsPrev24, setStatsPrev24] = useState({ total: 0, by_status: {} });

  const [platformDist, setPlatformDist] = useState(() =>
    PLATFORMS.map((p) => ({ platform: p.key, value: 0, color: p.color }))
  );

  const [revenueSar, setRevenueSar] = useState(0);

  const [trafficByPlatform, setTrafficByPlatform] = useState(() => {
    const obj = {};
    for (const p of PLATFORMS) obj[p.key] = [...EMPTY_7];
    return obj;
  });

  const [platformMetrics, setPlatformMetrics] = useState(() => {
    const obj = {};
    for (const p of PLATFORMS) obj[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
    return obj;
  });

  useEffect(() => {
  const syncStore = () => {
    const next = String(getStoreId() || "").trim();
    setStoreIdState((prev) => (prev === next ? prev : next));
  };

  const onStorage = (e) => {
    if (e.key === "selected_store_id") syncStore();
  };

  const onStoreChange = (e) => {
    const next = String(e?.detail?.storeId || "").trim();
    if (next) setStoreIdState((prev) => (prev === next ? prev : next));
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

    const resetAll = () => {
      setStats24({ total: 0, by_status: {} });
      setStatsPrev24({ total: 0, by_status: {} });
      setRevenueSar(0);

      const t = {};
      for (const p of PLATFORMS) t[p.key] = [...EMPTY_7];
      setTrafficByPlatform(t);

      const m = {};
      for (const p of PLATFORMS) m[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      setPlatformMetrics(m);

      setPlatformDist(PLATFORMS.map((p) => ({ platform: p.key, value: 0, color: p.color })));
    };

    const hydrateFromEvents = (rawRows, nowMs, fallbackTotal = 0) => {
      const rows = (rawRows || []).map(normalizeRow).filter(Boolean);

      const last7Ms = nowMs - 7 * 24 * 3600 * 1000;
      const last24Ms = nowMs - 24 * 3600 * 1000;

      const bucketsByPlat = {};
      for (const p of PLATFORMS) bucketsByPlat[p.key] = [...EMPTY_7];

      const byPlatform = new Map();

      const metrics = {};
      for (const p of PLATFORMS) {
        metrics[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      }

      let parsedCount = 0;

      for (const row of rows) {
        const createdRaw = getAny(row, [
          "last_attempt_at",
          "lastattemptat",
          "CREATEDTIME",
          "createdtime",
          "created_time",
          "created_at",
          "MODIFIEDTIME",
          "modifiedtime",
          "modified_time",
          "timestamp",
          "time"
        ]);

        const created = parseDateish(createdRaw);
        if (!created) continue;
        parsedCount++;

        const t = created.getTime();
        const platform = normPlatform(getAny(row, ["last_platform", "platform", "source"]));
        const platKey = PLATFORMS.some((p) => p.key === platform) ? platform : "GA4";

        if (t >= last24Ms) {
          byPlatform.set(platKey, (byPlatform.get(platKey) || 0) + 1);
          metrics[platKey].total += 1;

          const status = String(getAny(row, ["status"]) ?? "").toLowerCase();
          if (status === "sent") metrics[platKey].sent += 1;
          else if (status === "failed") metrics[platKey].failed += 1;
          else if (status === "skipped") metrics[platKey].skipped += 1;
          else if (status === "pending") metrics[platKey].pending += 1;

          if (status === "sent") {
            const payload = safeParse(getAny(row, ["payload"]));
            const amount =
              payload?.data?.amounts?.total?.amount ??
              payload?.data?.amounts?.sub_total?.amount ??
              payload?.data?.total?.amount ??
              payload?.data?.total ??
              payload?.total?.amount ??
              payload?.total ??
              payload?.value ??
              null;

            const num = Number(amount);
            if (Number.isFinite(num)) metrics[platKey].revenue += num;
          }
        }

        if (t >= last7Ms) {
          const idx = dayIndexMonFirst(created);
          bucketsByPlat[platKey][idx] += 1;
        }
      }

      const bucketsSum = Object.values(bucketsByPlat).flat().reduce((a, b) => a + b, 0);
      const distSum = Array.from(byPlatform.values()).reduce((a, b) => a + b, 0);

      if ((parsedCount === 0 || (bucketsSum === 0 && distSum === 0)) && fallbackTotal > 0) {
        const fallback = {};
        for (const p of PLATFORMS) fallback[p.key] = [...EMPTY_7];
        fallback.GA4[dayIndexMonFirst(new Date())] = fallbackTotal;

        setTrafficByPlatform(fallback);
        setPlatformMetrics((prev) => ({
          ...prev,
          GA4: { ...prev.GA4, total: fallbackTotal }
        }));

        setPlatformDist(
          PLATFORMS.map((p) => ({
            platform: p.key,
            value: p.key === "GA4" ? fallbackTotal : 0,
            color: p.color
          }))
        );

        setRevenueSar(0);
        return;
      }

      setTrafficByPlatform(bucketsByPlat);
      setPlatformMetrics(metrics);

      const distItems = PLATFORMS.map((p) => ({
        platform: p.key,
        value: byPlatform.get(p.key) || 0,
        color: p.color
      })).sort((a, b) => b.value - a.value);

      setPlatformDist(distItems);

      const totalRevenue = Object.values(metrics).reduce((s, m) => s + (Number(m.revenue) || 0), 0);
      setRevenueSar(totalRevenue);
    };

    const tick = async (initial) => {
      try {
        if (!storeId || !String(storeId).trim()) {
          if (alive) {
            resetAll();
            setLoading(false);
          }
          return;
        }

        if (initial) setLoading(true);

        const [r24, r48, ev] = await Promise.all([
          fetchDashboardSummary(storeId, 24),
          fetchDashboardSummary(storeId, 48),
          fetchEventLogs({ storeId, limit: 2000 })
        ]);

        if (!alive || storeRef.current !== storeId) return;

        const s24 = unwrapStatsResponse(r24) || { total: 0, by_status: {} };
        const s48 = unwrapStatsResponse(r48) || { total: 0, by_status: {} };
        const prev = diffStats(s24, s48);

        setStats24(s24);
        setStatsPrev24(prev);

        const rows = unwrapEventRows(ev);
        hydrateFromEvents(rows, Date.now(), Number(s24.total || 0));

        if (initial) setLoading(false);
//scheduleNext(computeDelayMs());
      } catch {
        if (initial) setLoading(false);
       // scheduleNext(9000);
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
      { label: "Skipped", value: summary.skipped, delta: pctDelta(summary.skipped, prevSummary.skipped), icon: "⏭️", tone: "yellow" },
      { label: "Revenue", value: `SAR ${formatMoney(revenueSar)}`, delta: 0, icon: "💰", tone: "blue", isMoney: true }
    ];
  }, [summary, prevSummary, revenueSar]);

  const trafficTrend = useMemo(() => {
    return {
      labels: dayLabelsLast7(),
      series: PLATFORMS.map((p) => ({
        name: p.name,
        color: p.color,
        data: trafficByPlatform[p.key] || EMPTY_7
      }))
    };
  }, [trafficByPlatform]);

  const platformCards = useMemo(() => {
    return PLATFORMS.map((p) => {
      const m = platformMetrics[p.key] || { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      const delivered = (m.sent || 0) + (m.failed || 0);
      const successRate = delivered > 0 ? (m.sent / delivered) * 100 : 0;
      const loss = m.total > 0 ? (m.skipped / m.total) * 100 : 0;

      return {
        name: p.name,
        desc: p.desc,
        pill: p.pill,
        tone: p.color,
        accent: p.accent,
        stats: {
          forwarded: m.total || 0,
          successRate: Number(successRate.toFixed(1)),
          revenue: Number((m.revenue || 0).toFixed(2)),
          loss: Number(loss.toFixed(1))
        }
      };
    });
  }, [platformMetrics]);

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

      <div className="grid5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
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
                <BarLegend series={trafficTrend.series} />
                <GroupedBarChart labels={trafficTrend.labels} series={trafficTrend.series} />
                {trafficTrend.series.every((s) => (s.data || []).every((x) => Number(x || 0) === 0)) && (
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
              <AnimatedDonutDistribution items={platformDist} centerTitle="Total Events" centerValue={formatMoney(summary.total)} />
            )}
          </div>
        </div>
      </div>

      <div className="platformGrid">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div className="pCard" key={i}>
              <Skeleton height={10} width="45%" />
              <div style={{ marginTop: 10 }}>
                <Skeleton height={18} width="65%" />
              </div>
              <div style={{ marginTop: 14 }}>
                <Skeleton height={110} />
              </div>
            </div>
          ))
        ) : (
          platformCards.map((p) => <PlatformCard key={p.name} {...p} />)
        )}
      </div>

      <style>{css}</style>
    </div>
  );
}

function KPI({ label, value, delta, icon, tone, isMoney }) {
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
        <div className={`delta ${isUp ? "up" : "down"}`}>{isMoney ? "—" : `${isUp ? "▲" : "▼"} ${abs.toFixed(0)}%`}</div>
        <div className="kpiHint">vs previous 24h</div>
      </div>
    </div>
  );
}

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
          <div className="pPill" style={{ color: tone, background: `${tone}12`, borderColor: `${tone}26` }}>
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

function BarLegend({ series = [] }) {
  return (
    <div className="barLegend">
      {series.map((s) => (
        <div key={s.name} className="barLegendItem">
          <span className="dot" style={{ background: s.color }} />
          {s.name}
        </div>
      ))}
    </div>
  );
}

function GroupedBarChart({ labels = [], series = [] }) {
  const W = 980,
    H = 300;
  const PAD_X = 44,
    PAD_TOP = 18,
    PAD_BOTTOM = 40;

  const max = Math.max(1, ...series.flatMap((s) => s.data || []));
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const groups = labels.length || 1;
  const groupW = innerW / groups;

  const barCount = Math.max(1, series.length);
  const gap = Math.max(6, Math.floor(groupW * 0.06));
  const barW = Math.max(8, Math.floor((groupW - gap * (barCount + 1)) / barCount));

  const x0 = (i) => PAD_X + i * groupW;
  const barX = (i, j) => x0(i) + gap + j * (barW + gap);

  const y = (v) => PAD_TOP + (1 - v / max) * innerH;
  const barH = (v) => PAD_TOP + innerH - y(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="300" style={{ display: "block" }}>
      {labels.map((lb, i) => (
        <text key={lb} x={x0(i) + groupW / 2} y={H - 12} textAnchor="middle" fontSize="12" fill="rgba(15,23,42,0.55)" fontWeight="900">
          {lb}
        </text>
      ))}

      {labels.map((_, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const v = s.data?.[i] ?? 0;
            return <rect key={`${i}-${j}`} x={barX(i, j)} y={y(v)} width={barW} height={barH(v)} rx="10" fill={s.color} opacity={0.95} />;
          })}
        </g>
      ))}
    </svg>
  );
}

function AnimatedDonutDistribution({ items = [], centerTitle, centerValue }) {
  const [activePlatform, setActivePlatform] = useState(null);

  const normalized = items.map((it) => ({ ...it, value: Number(it.value) || 0 }));
  const sum = normalized.reduce((s, it) => s + it.value, 0);
  const total = Math.max(1, sum);

  const nonZero = normalized.filter((x) => x.value > 0);

  const size = 230;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const slices = nonZero.map((it) => {
    const pct = it.value / total;
    const len = pct * c;
    const obj = { ...it, pct, len, offset };
    offset += len;
    return obj;
  });

  const activeSlice = activePlatform ? slices.find((s) => s.platform === activePlatform) : null;

  return (
    <div className="donutWrap">
      <div className="donutLeft">
        <div className="donutStage">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth={stroke} />

            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {slices.map((a) => (
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
                  style={{ opacity: !activePlatform || activePlatform === a.platform ? 1 : 0.35 }}
                  onMouseEnter={() => setActivePlatform(a.platform)}
                  onMouseLeave={() => setActivePlatform(null)}
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
          {normalized.map((a) => {
            const pct = sum > 0 ? Math.round((a.value / total) * 100) : 0;
            const hoverable = a.value > 0;

            return (
              <div
                key={a.platform}
                className="donutItem"
                onMouseEnter={() => hoverable && setActivePlatform(a.platform)}
                onMouseLeave={() => setActivePlatform(null)}
                style={{ opacity: !activePlatform || activePlatform === a.platform ? 1 : 0.6 }}
              >
                <span className="dot" style={{ background: a.color }} />
                <div className="donutItemText">
                  <div className="donutItemName">{a.platform}</div>
                  <div className="donutItemSub">
                    {formatMoney(a.value)} • <b>{pct}%</b>
                  </div>
                </div>
                <div className="donutPill">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

.grid5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;}
@media (max-width:1250px){.grid5{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:560px){.dash{padding:12px;}.grid5{grid-template-columns:1fr;}}

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

.barLegend{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin: 2px 0 10px;
  padding-left: 2px;
}
.barLegendItem{
  display:flex;
  align-items:center;
  gap:8px;
  font-size:12px;
  font-weight:900;
  color: rgba(15,23,42,0.65);
}

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

.platformGrid{
  display:grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap:14px;
  align-items: stretch;
}
@media (max-width:1200px){
  .platformGrid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width:640px){
  .platformGrid{ grid-template-columns: 1fr; }
}

.pCard{border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.86);display:flex;flex-direction:column;}
.pAccent{height:6px;width:100%;}
.pBody{padding:14px 16px 16px;flex:1;display:flex;flex-direction:column;}
.pTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}
.pName{font-size:14px;font-weight:1100;color:#0f172a;}
.pDesc{margin-top:3px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.pPill{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:1050;border:1px solid rgba(15,23,42,0.10);white-space:nowrap;}
.pStats{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.mini{border-radius:16px;padding:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.miniLabel{font-size:11px;font-weight:950;color:rgba(15,23,42,0.55);}
.miniValue{margin-top:6px;font-size:14px;font-weight:1150;color:#0f172a;}
`;
