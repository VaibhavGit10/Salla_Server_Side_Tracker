import { useEffect, useMemo, useState } from "react";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store";
import { fetchDashboardSummary } from "../api/platforms.api";
import { fetchEventLogs } from "../api/logs.api";
import { useTranslation } from "../utils/i18n";
import metaIcon from "../assets/metaIcon.webp";

const PLATFORMS = [
  {
    key: "GA4",
    name: "GA4",
    desc: "Analytics events",
    pill: "Tracking",
    color: "#0D6EFD",
    accent: "linear-gradient(90deg,#4285F4,#34A853,#FBBC05,#EA4335)",
  },
  {
    key: "META",
    name: "Meta",
    desc: "CAPI events",
    pill: "Ads",
    color: "#7C3AED",
    accent: "linear-gradient(90deg,#7C3AED,#EC4899)",
  },
  {
    key: "TIKTOK",
    name: "TikTok",
    desc: "Pixel events",
    pill: "Ads",
    color: "#111827",
    accent: "linear-gradient(90deg,#111827,#14B8A6)",
  },
  {
    key: "SNAPCHAT",
    name: "Snapchat",
    desc: "Conversions API",
    pill: "Ads",
    color: "#F59E0B",
    accent: "linear-gradient(90deg,#F59E0B,#EF4444)",
  },
];

const EMPTY_7 = [0, 0, 0, 0, 0, 0, 0];

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
      const d = c.data?.data && typeof c.data.data === "object" ? c.data.data : c.data;
      return {
        total: Number(d.total || 0),
        by_status: d.by_status || d.byStatus || {},
      };
    }

    if ("total" in c || "by_status" in c || "byStatus" in c) {
      return {
        total: Number(c.total || 0),
        by_status: c.by_status || c.byStatus || {},
      };
    }
  }
  return null;
}

function clampNonNeg(n) {
  const x = Number(n || 0);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function pctDelta(current, previous) {
  const c = clampNonNeg(current);
  const p = clampNonNeg(previous);
  if (p <= 0) return c > 0 ? 100 : 0;
  return ((c - p) / p) * 100;
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
      if (d.data && typeof d.data === "object") {
        if (Array.isArray(d.data.items)) return d.data.items.map(normalizeRow).filter(Boolean);
        if (Array.isArray(d.data.data)) return d.data.data.map(normalizeRow).filter(Boolean);
      }
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

function PlatformIcon({ platform, size = 18 }) {
  const key = String(platform || "").toUpperCase();

  if (key === "GA4") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 20.1v7.7h10.7c-.4 2-1.6 3.7-3.3 4.8v5h5.4c3.2-2.9 5-7.2 5-12.5 0-1.2-.1-2.1-.3-3H24Z"
        />
        <path
          fill="#34A853"
          d="M24 42c4.6 0 8.5-1.5 11.3-4.1l-5.4-5c-1.5 1-3.4 1.7-5.9 1.7-4.5 0-8.2-3-9.6-7.1H8.9v5.2C11.7 38.2 17.4 42 24 42Z"
        />
        <path
          fill="#4285F4"
          d="M14.4 27.5c-.4-1.1-.6-2.2-.6-3.5s.2-2.4.6-3.5V15.3H8.9C7.7 17.7 7 20.7 7 24s.7 6.3 1.9 8.7l5.5-5.2Z"
        />
        <path
          fill="#FBBC05"
          d="M24 13.5c2.5 0 4.7.9 6.5 2.6l4.8-4.8C32.4 8.5 28.6 7 24 7 17.4 7 11.7 10.8 8.9 15.3l5.5 5.2c1.4-4.1 5.1-7 9.6-7Z"
        />
      </svg>
    );
  }

  if (key === "META") {
    return (
      <img
        src={metaIcon}
        alt="Meta"
        className="platImg"
        style={{ width: size, height: size }}
        loading="eager"
      />
    );
  }

  if (key === "TIKTOK") {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: "block" }}>
        <circle cx="32" cy="32" r="30" fill="#0B0F19" />
        <path
          d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
          fill="#25F4EE"
          opacity="0.95"
          transform="translate(-1.2,1.2)"
        />
        <path
          d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
          fill="#FE2C55"
          opacity="0.9"
          transform="translate(1.1,-1.0)"
        />
        <path
          d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (key === "SNAPCHAT") {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 14
             c-7.2 0-12.3 5.6-12.3 13.5
             0 2.4.6 4.6 1 6.1
             .4 1.4-.3 2.2-1.3 2.8
             -1.2.8-3.4 1.7-5.3 2.1
             -1.2.3-1.6 1.7-.9 2.6
             1.2 1.6 3.6 2.7 6.2 3.1
             .7 4.5 4.1 8.6 7.8 10.4
             1.6.8 3.2 1 4.8 1
             1.6 0 3.2-.2 4.8-1
             3.7-1.8 7.1-5.9 7.8-10.4
             2.6-.4 5-1.5 6.2-3.1
             .7-.9.3-2.3-.9-2.6
             -1.9-.4-4.1-1.3-5.3-2.1
             -1-.6-1.7-1.4-1.3-2.8
             .4-1.5 1-3.7 1-6.1
             C44.3 19.6 39.2 14 32 14Z"
          fill="#FFFFFF"
          stroke="#111827"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return <span />;
}

const __DASHBOARD_FETCHED_FOR = new Set();

export default function Dashboard() {
  const { t } = useTranslation();
  const [storeId] = useState(() => String(getStoreId() || "").trim());
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

  const [trafficByPlatformPrevWeek, setTrafficByPlatformPrevWeek] = useState(() => {
    const obj = {};
    for (const p of PLATFORMS) obj[p.key] = [...EMPTY_7];
    return obj;
  });

  const [trafficMode, setTrafficMode] = useState("daily");
  const [trafficTimeframe, setTrafficTimeframe] = useState("current");
  const [trafficAnchorMs, setTrafficAnchorMs] = useState(() => Date.now());

  const [platformMetrics, setPlatformMetrics] = useState(() => {
    const obj = {};
    for (const p of PLATFORMS) obj[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
    return obj;
  });

  useEffect(() => {
    let cancelled = false;

    const resetAll = () => {
      setStats24({ total: 0, by_status: {} });
      setStatsPrev24({ total: 0, by_status: {} });
      setRevenueSar(0);

      const t1 = {};
      for (const p of PLATFORMS) t1[p.key] = [...EMPTY_7];
      setTrafficByPlatform(t1);

      const tPrev = {};
      for (const p of PLATFORMS) tPrev[p.key] = [...EMPTY_7];
      setTrafficByPlatformPrevWeek(tPrev);

      const m = {};
      for (const p of PLATFORMS) {
        m[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      }
      setPlatformMetrics(m);

      setPlatformDist(PLATFORMS.map((p) => ({ platform: p.key, value: 0, color: p.color })));
      setTrafficAnchorMs(Date.now());
    };

    const hydrateFromEvents = (rawRows, nowMs, fallbackTotal = 0) => {
      const rows = (rawRows || []).map(normalizeRow).filter(Boolean);

      const oneDayMs = 24 * 3600 * 1000;
      const last7Ms = nowMs - 7 * oneDayMs;
      const last14Ms = nowMs - 14 * oneDayMs;
      const last24Ms = nowMs - 24 * oneDayMs;
      const last48Ms = nowMs - 48 * oneDayMs;

      const startCur = last7Ms;
      const startPrev = last14Ms;

      const bucketsByPlatCur = {};
      const bucketsByPlatPrev = {};
      for (const p of PLATFORMS) {
        bucketsByPlatCur[p.key] = [...EMPTY_7];
        bucketsByPlatPrev[p.key] = [...EMPTY_7];
      }

      const byPlatform = new Map();

      const metrics = {};
      for (const p of PLATFORMS) {
        metrics[p.key] = { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      }

      const curBy = { sent: 0, failed: 0, skipped: 0, pending: 0 };
      const prevBy = { sent: 0, failed: 0, skipped: 0, pending: 0 };
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
          "time",
        ]);

        const created = parseDateish(createdRaw);
        if (!created) continue;

        parsedCount++;
        const tm = created.getTime();

        const platform = normPlatform(getAny(row, ["last_platform", "platform", "source"]));
        const platKey = PLATFORMS.some((p) => p.key === platform) ? platform : "GA4";

        const statusRaw = String(getAny(row, ["status"]) ?? "").toLowerCase();
        const status =
          statusRaw === "sent" || statusRaw === "failed" || statusRaw === "skipped" || statusRaw === "pending"
            ? statusRaw
            : "";

        if (tm >= last24Ms) {
          byPlatform.set(platKey, (byPlatform.get(platKey) || 0) + 1);
          metrics[platKey].total += 1;

          if (status) metrics[platKey][status] += 1;
          if (status) curBy[status] += 1;

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
        } else if (tm >= last48Ms) {
          if (status) prevBy[status] += 1;
        }

        if (tm >= last7Ms) {
          const idx = Math.floor((tm - startCur) / oneDayMs);
          if (idx >= 0 && idx < 7) bucketsByPlatCur[platKey][idx] += 1;
        } else if (tm >= last14Ms) {
          const idx = Math.floor((tm - startPrev) / oneDayMs);
          if (idx >= 0 && idx < 7) bucketsByPlatPrev[platKey][idx] += 1;
        }
      }

      const bucketsSum = Object.values(bucketsByPlatCur).flat().reduce((a, b) => a + b, 0);
      const distSum = Array.from(byPlatform.values()).reduce((a, b) => a + b, 0);

      if ((parsedCount === 0 || (bucketsSum === 0 && distSum === 0)) && fallbackTotal > 0) {
        const fallbackCur = {};
        const fallbackPrev = {};
        for (const p of PLATFORMS) {
          fallbackCur[p.key] = [...EMPTY_7];
          fallbackPrev[p.key] = [...EMPTY_7];
        }

        fallbackCur.GA4[6] = fallbackTotal;

        setTrafficByPlatform(fallbackCur);
        setTrafficByPlatformPrevWeek(fallbackPrev);

        setPlatformMetrics((prev) => ({
          ...prev,
          GA4: { ...prev.GA4, total: fallbackTotal },
        }));

        setPlatformDist(
          PLATFORMS.map((p) => ({
            platform: p.key,
            value: p.key === "GA4" ? fallbackTotal : 0,
            color: p.color,
          }))
        );

        setRevenueSar(0);
        setTrafficAnchorMs(nowMs);

        return {
          cur24: { total: fallbackTotal, by_status: { sent: 0, failed: 0, skipped: 0, pending: 0 } },
          prev24: { total: 0, by_status: { sent: 0, failed: 0, skipped: 0, pending: 0 } },
        };
      }

      setTrafficByPlatform(bucketsByPlatCur);
      setTrafficByPlatformPrevWeek(bucketsByPlatPrev);
      setPlatformMetrics(metrics);

      const distItems = PLATFORMS.map((p) => ({
        platform: p.key,
        value: byPlatform.get(p.key) || 0,
        color: p.color,
      })).sort((a, b) => b.value - a.value);

      setPlatformDist(distItems);

      const totalRevenue = Object.values(metrics).reduce((s, m) => s + (Number(m.revenue) || 0), 0);
      setRevenueSar(totalRevenue);
      setTrafficAnchorMs(nowMs);

      const curTotal = curBy.sent + curBy.failed + curBy.skipped + curBy.pending;
      const prevTotal = prevBy.sent + prevBy.failed + prevBy.skipped + prevBy.pending;

      return {
        cur24: { total: curTotal, by_status: curBy },
        prev24: { total: prevTotal, by_status: prevBy },
      };
    };

    const loadOnce = async () => {
      const guardKey = storeId || "__NO_STORE__";
      if (__DASHBOARD_FETCHED_FOR.has(guardKey)) {
        setLoading(false);
        return;
      }
      __DASHBOARD_FETCHED_FOR.add(guardKey);

      try {
        setLoading(true);

        if (!storeId) {
          resetAll();
          setLoading(false);
          return;
        }

        const ts = Date.now();

        const [r24, r48, ev] = await Promise.all([
          fetchDashboardSummary(storeId, 24),
          fetchDashboardSummary(storeId, 48),
          fetchEventLogs({ storeId, limit: 2000, cursor: null, _ts: ts }),
        ]);

        if (cancelled) return;

        const s24 = unwrapStatsResponse(r24) || { total: 0, by_status: {} };
        const s48 = unwrapStatsResponse(r48) || { total: 0, by_status: {} };

        const rows = unwrapEventRows(ev);
        const computed = hydrateFromEvents(rows, ts, Number(s24.total || 0));

        const useComputed = (computed?.cur24?.total || 0) > 0 || rows.length > 0 || Number(s24.total || 0) === 0;

        if (useComputed) {
          setStats24(computed.cur24);
          setStatsPrev24(computed.prev24);
        } else {
          const curBy = s24.by_status || {};
          const b48By = s48.by_status || {};
          const mk = (key) => clampNonNeg((b48By[key] || 0) - (curBy[key] || 0));

          setStats24(s24);
          setStatsPrev24({
            total: clampNonNeg((s48?.total || 0) - (s24?.total || 0)),
            by_status: { sent: mk("sent"), failed: mk("failed"), skipped: mk("skipped"), pending: mk("pending") },
          });
        }

        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoading(false);
      }
    };

    loadOnce();

    return () => {
      cancelled = true;
    };
  }, []);

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
      pending: clampNonNeg(by.pending),
    };
  }, [statsPrev24]);

  const kpis = useMemo(() => {
    const IconTotal = (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z" fill="currentColor" opacity="0.18" />
        <path
          d="M7 3h10a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 8h6M9 12h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );

    const IconSent = (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

    const IconFailed = (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" fill="currentColor" opacity="0.18" />
        <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15 9 9 15M9 9l6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );

    const IconSkipped = (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7v10l8-5-8-5Z" fill="currentColor" opacity="0.18" />
        <path d="M7 7v10l8-5-8-5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M17 7v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );

    const IconRevenue = (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 7v10" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" />
        <path
          d="M15 9.2c0-1.3-1.3-2.2-3-2.2s-3 .9-3 2.2 1.1 2 3 2.3 3 1 3 2.3-1.3 2.2-3 2.2-3-.9-3-2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );

    return [
      { label: t("kpiTotalEvents"), value: summary.total, delta: pctDelta(summary.total, prevSummary.total), icon: IconTotal, tone: "blue" },
      { label: t("kpiSent"), value: summary.sent, delta: pctDelta(summary.sent, prevSummary.sent), icon: IconSent, tone: "green" },
      { label: t("kpiFailed"), value: summary.failed, delta: pctDelta(summary.failed, prevSummary.failed), icon: IconFailed, tone: "pink" },
      { label: t("kpiSkipped"), value: summary.skipped, delta: pctDelta(summary.skipped, prevSummary.skipped), icon: IconSkipped, tone: "yellow" },
      { label: t("kpiRevenue"), value: `SAR ${formatMoney(revenueSar)}`, delta: 0, icon: IconRevenue, tone: "blue", isMoney: true },
    ];
  }, [summary, prevSummary, revenueSar, t]);

  const trafficTrend = useMemo(() => {
    const activeBuckets = trafficTimeframe === "current" ? trafficByPlatform : trafficByPlatformPrevWeek;
    const dayMs = 24 * 3600 * 1000;

    if (trafficMode === "weekly") {
      const labels = PLATFORMS.map((p) => p.name);

      const curTotals = PLATFORMS.map((p) => (trafficByPlatform[p.key] || EMPTY_7).reduce((a, b) => a + b, 0));
      const prevTotals = PLATFORMS.map((p) => (trafficByPlatformPrevWeek[p.key] || EMPTY_7).reduce((a, b) => a + b, 0));

      return {
        mode: "weekly",
        subtitle: t("trafficWeeklySubtitle"),
        labels,
        series: [
          { name: t("trafficCurWeek"), color: "#0D6EFD", data: curTotals },
          { name: t("trafficPrevWeek"), color: "#94A3B8", data: prevTotals },
        ],
      };
    }

    const subtitle = trafficTimeframe === "current" ? t("trafficCurWeekDaily") : t("trafficPrevWeekDaily");

    const labels = [];
    if (trafficTimeframe === "current") {
      const start = trafficAnchorMs - 7 * dayMs;
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start + i * dayMs);
        labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      }
    } else {
      const start = trafficAnchorMs - 14 * dayMs;
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start + i * dayMs);
        labels.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      }
    }

    return {
      mode: "daily",
      subtitle,
      labels,
      series: PLATFORMS.map((p) => ({
        platformKey: p.key,
        name: p.name,
        color: p.color,
        data: activeBuckets[p.key] || EMPTY_7,
      })),
    };
  }, [trafficByPlatform, trafficByPlatformPrevWeek, trafficMode, trafficTimeframe, trafficAnchorMs, t]);

  const platformCards = useMemo(() => {
    return PLATFORMS.map((p) => {
      const m = platformMetrics[p.key] || { total: 0, sent: 0, failed: 0, skipped: 0, pending: 0, revenue: 0 };
      const delivered = (m.sent || 0) + (m.failed || 0);
      const successRate = delivered > 0 ? (m.sent / delivered) * 100 : 0;
      const loss = m.total > 0 ? (m.skipped / m.total) * 100 : 0;

      return {
        platformKey: p.key,
        name: p.name,
        desc: p.desc,
        pill: p.pill,
        tone: p.color,
        accent: p.accent,
        stats: {
          forwarded: m.total || 0,
          successRate: Number(successRate.toFixed(1)),
          revenue: Number((m.revenue || 0).toFixed(2)),
          loss: Number(loss.toFixed(1)),
        },
      };
    });
  }, [platformMetrics]);

  return (
    <div className="dash">
      <div className="topbar">
        <div className="brandArea">
          <div className="logoBubble">∿</div>
          <div>
            <div className="brandTitle">{t("dashTitle")}</div>
            <div className="brandSub">{t("dashSubtitle")}</div>
          </div>
        </div>

        <div className="topbarRight">
          <div className="storeChip">
            <span className="dotLive" />
            {t("dashStore")}: <b>{storeId || "N/A"}</b>
          </div>
          <div className="rangeChip">{t("dashLast24h")}</div>
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
              <div className="cardTitle">{t("trafficTrendTitle")}</div>
              <div className="cardSub">{trafficTrend.subtitle}</div>
            </div>
            <span className="pill blue">{t("trafficPill")}</span>
          </div>

          <div className="cardBody">
            {loading ? (
              <Skeleton height={300} />
            ) : (
              <>
                <div className="trafficControls">
                  <div className="trafficToggle">
                    <button
                      type="button"
                      className={`toggleBtn ${trafficMode === "daily" ? "active" : ""}`}
                      onClick={() => setTrafficMode("daily")}
                    >
                      {t("trafficDaily")}
                    </button>
                    <button
                      type="button"
                      className={`toggleBtn ${trafficMode === "weekly" ? "active" : ""}`}
                      onClick={() => setTrafficMode("weekly")}
                    >
                      {t("trafficWeekly")}
                    </button>
                  </div>

                  {trafficMode === "daily" && (
                    <div className="weekScroller">
                      <div className="weekStrip">
                        <button
                          type="button"
                          className={`toggleBtn ${trafficTimeframe === "current" ? "active" : ""}`}
                          onClick={() => setTrafficTimeframe("current")}
                        >
                          {t("trafficThisWeek")}
                        </button>
                        <button
                          type="button"
                          className={`toggleBtn ${trafficTimeframe === "previous" ? "active" : ""}`}
                          onClick={() => setTrafficTimeframe("previous")}
                        >
                          {t("trafficPreviousWeek")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <BarLegend series={trafficTrend.series} />

                <div className="chartScroll">
                  <div className="chartInner">
                    <GroupedBarChart labels={trafficTrend.labels} series={trafficTrend.series} />
                  </div>
                </div>

                {trafficTrend.series.every((s) => (s.data || []).every((x) => Number(x || 0) === 0)) && (
                  <div className="emptyChartNote">{t("trafficEmpty")}</div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">{t("platformDistTitle")}</div>
              <div className="cardSub">{t("platformDistSubtitle")}</div>
            </div>
            <span className="pill cyan">{t("platformDistPill")}</span>
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
        <div className={`delta ${isUp ? "up" : "down"}`}>
          {isMoney ? "—" : `${isUp ? "▲" : "▼"} ${abs.toFixed(0)}%`}
        </div>
        <div className="kpiHint">vs previous 24h</div>
      </div>
    </div>
  );
}

function PlatformCard({ platformKey, name, desc, pill, tone, accent, stats }) {
  const { t } = useTranslation();
  return (
    <div className="pCard">
      <div className="pBody">
        <div className="pTop">
          <div className="pLeft">
            <div className="pLogo" style={{ background: accent }}>
              <span className="pLogoInner">
                <PlatformIcon platform={platformKey} size={20} />
              </span>
            </div>

            <div>
              <div className="pName">{name}</div>
              <div className="pDesc">{desc}</div>
            </div>
          </div>

          <div className="pPill" style={{ color: tone, background: `${tone}12`, borderColor: `${tone}26` }}>
            {pill}
          </div>
        </div>

        <div className="pStats">
          <StatMini label={t("platformCardForwarded")} value={stats.forwarded} />
          <StatMini label={t("platformCardSuccess")} value={`${stats.successRate}%`} />
          <StatMini label={t("platformCardRevenue")} value={`SAR ${formatMoney(stats.revenue)}`} />
          <StatMini label={t("platformCardLoss")} value={`${stats.loss}%`} />
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
          {s.platformKey ? (
            <span className="platIcon sm">
              <PlatformIcon platform={s.platformKey} size={16} />
            </span>
          ) : (
            <span className="dot" style={{ background: s.color }} />
          )}
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
                opacity={0.95}
              />
            );
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

            <foreignObject x="44" y="74" width="142" height="96">
              <div className="donutCenter">
                <div className="donutTitle">{centerTitle}</div>
                <div className="donutValue">{centerValue}</div>

                {activeSlice ? (
                  <div className="donutActive">
                    <span className="platIcon sm">
                      <PlatformIcon platform={activeSlice.platform} size={16} />
                    </span>
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
                <span className="platIcon">
                  <PlatformIcon platform={a.platform} size={16} />
                </span>

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

.mainGrid {
  width: 100%;
  max-width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}

.mainGrid > .card {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.cardHead,
.cardBody,
.cardBodyDist {
  min-width: 0;
  max-width: 100%;
}

.chartScroll {
  max-width: 100%;
  overflow-x: auto;
}

.chartInner {
  min-width: 720px;
  max-width: 100%;
}

.donutWrap,
.donutLeft,
.donutRight,
.donutLegend {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 980px) {
  .mainGrid {
    grid-template-columns: 1fr;
  }
}

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
.chartScroll{
  width:100%;
  overflow-x:auto;
  padding-bottom:6px;
  margin-top:4px;
}
.chartInner{min-width:720px;}
.emptyChartNote{
  position:absolute;
  left:14px;
  bottom:12px;
  font-size:12px;
  font-weight:900;
  color:rgba(15,23,42,0.45);
}
.cardBodyDist{display:flex;align-items:center;justify-content:center;}
.cardHead{display:flex;justify-content:space-between;gap:12px;}
.cardTitle{font-size:15px;font-weight:1150;color:#0f172a;}
.cardSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.card.premium{background:rgba(255,255,255,0.90);}

.pill{padding:7px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);}
.pill.blue{background:rgba(13,110,253,0.14);border-color:rgba(13,110,253,0.22);color:#083b8a;}
.pill.cyan{background:rgba(13,202,240,0.14);border-color:rgba(13,202,240,0.22);color:#055a66;}

.trafficControls{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin-bottom:8px;
  flex-wrap:wrap;
}
.trafficToggle{
  display:flex;
  gap:6px;
  padding:3px;
  border-radius:999px;
  background:rgba(15,23,42,0.04);
}
.weekScroller{flex:1;min-width:0;}
.weekStrip{
  display:flex;
  gap:6px;
  overflow-x:auto;
  padding:3px 0 2px;
}
.weekStrip::-webkit-scrollbar{height:4px;}
.weekStrip::-webkit-scrollbar-thumb{background:rgba(15,23,42,0.25);border-radius:999px;}
.toggleBtn{
  border:0;
  background:transparent;
  padding:6px 11px;
  border-radius:999px;
  font-size:11px;
  font-weight:1000;
  color:rgba(15,23,42,0.60);
  cursor:pointer;
  white-space:nowrap;
}
.toggleBtn.active{
  background:#0f172a;
  color:#f9fafb;
  box-shadow:0 10px 30px rgba(15,23,42,0.35);
}

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
.pBody{padding:14px 16px 16px;flex:1;display:flex;flex-direction:column;}
.pTop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}
.pLeft{display:flex;align-items:center;gap:10px;min-width:0;}
.pName{font-size:14px;font-weight:1100;color:#0f172a;}
.pDesc{margin-top:3px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.pPill{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:1050;border:1px solid rgba(15,23,42,0.10);white-space:nowrap;}
.pStats{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.mini{border-radius:16px;padding:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.miniLabel{font-size:11px;font-weight:950;color:rgba(15,23,42,0.55);}
.miniValue{margin-top:6px;font-size:14px;font-weight:1150;color:#0f172a;}

.platIcon{
  width: 28px;
  height: 28px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(15,23,42,0.10);
  box-shadow: 0 8px 16px rgba(2,6,23,0.10);
  flex: 0 0 auto;
}
.platIcon.sm{
  width: 22px;
  height: 22px;
  border-radius: 10px;
  box-shadow: 0 6px 14px rgba(2,6,23,0.10);
}
.platImg{
  object-fit: contain;
  display: block;
}

.pLogo{
  width: 40px;
  height: 40px;
  border-radius: 16px;
  padding: 1px;
  box-shadow: 0 12px 22px rgba(2,6,23,0.14);
  border: 1px solid rgba(15,23,42,0.10);
  flex: 0 0 auto;
  display:grid;
  place-items:center;
}
.pLogoInner{
  width: 100%;
  height: 100%;
  border-radius: 15px;
  background: rgba(255,255,255,0.92);
  display:grid;
  place-items:center;
}
`;
