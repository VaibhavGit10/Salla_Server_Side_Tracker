
# DSV AdSync — Salla Server-Side Tracking App

A multi-tenant Salla Marketplace App that captures e-commerce events from Salla stores via webhooks and forwards them server-side to Meta CAPI, TikTok Events API, Snapchat Conversions API, and Google GA4 Measurement Protocol.

Built on **Zoho Catalyst** (AppSail + Datastore + Static hosting).

---

## Table of Contents

1. [What This App Does](#what-this-app-does)
2. [Architecture Overview](#architecture-overview)
3. [How Multiple Merchants Use This App](#how-multiple-merchants-use-this-app)
4. [Full User Journey](#full-user-journey)
5. [Where the Dashboard Lives](#where-the-dashboard-lives)
6. [Infrastructure Layout](#infrastructure-layout)
7. [API Reference](#api-reference)
8. [Data Model](#data-model)
9. [Event Pipeline](#event-pipeline)
10. [PII Hashing & Security](#pii-hashing--security)
11. [Retry System](#retry-system)
12. [Environment Variables](#environment-variables)
13. [Development Commands](#development-commands)
14. [Deployment](#deployment)
15. [Known Gaps & Roadmap](#known-gaps--roadmap)

---

## What This App Does

When a customer places an order on a Salla store, Salla fires a webhook to this app. The app:

1. Verifies the webhook signature (HMAC-SHA256)
2. Deduplicates the event (prevents double-counting if Salla retries)
3. Saves it to Catalyst Datastore
4. Forwards it **server-side** to every ad platform the merchant has connected (GA4, Meta, TikTok, Snap)
5. Logs every dispatch attempt with HTTP status, response body, and retry state

The merchant sees a real-time dashboard inside their Salla admin panel showing event counts, per-platform delivery stats, and a full event log.

---

## Architecture Overview

```
Salla Store (merchant's customers)
        │ order placed
        ▼
Salla Platform
        │ webhook: POST /webhooks/salla
        │ signed with HMAC-SHA256
        ▼
┌─────────────────────────────────────────────┐
│              Zoho Catalyst                  │
│                                             │
│  AppSail (Node.js/Express)                  │
│  ├── Verify signature                       │
│  ├── Normalize + deduplicate event          │
│  ├── Save to Datastore (events table)       │
│  ├── Dispatch to GA4     (async)            │
│  └── Dispatch to Meta/TikTok/Snap (async)   │
│                                             │
│  Catalyst Datastore (ZCQL)                  │
│  ├── stores              (per merchant)     │
│  ├── events              (all events)       │
│  ├── event_dispatch_logs (per platform)     │
│  ├── platform_connections (credentials)     │
│  └── ga4_settings                           │
│                                             │
│  Catalyst Static (React SPA)                │
│  └── Dashboard → loads inside Salla iframe  │
└─────────────────────────────────────────────┘
        │                │               │
        ▼                ▼               ▼
     Meta CAPI     TikTok Events    Snap CAPI    GA4 Measurement Protocol
```

---

## How Multiple Merchants Use This App

This is a **multi-tenant** app. All merchants share the same backend infrastructure (one AppSail instance, one Datastore), but their data is completely isolated.

### Isolation mechanism

Every database table has a `store_id` column. Every ZCQL query filters on it:

```sql
SELECT * FROM events WHERE store_id = '569527'
```

Merchant A (`store_id: 569527`) can never see merchant B's (`store_id: 890123`) data.

### Tenant lifecycle

| Event | What happens |
|---|---|
| Merchant installs app | `stores` row created with `status: active` |
| Merchant authorizes OAuth | OAuth tokens encrypted + stored in `stores` row |
| Merchant connects Meta | Row in `platform_connections` for `store_id + platform: meta` |
| Order webhook arrives | Event saved under `store_id`, dispatched to their connected platforms |
| Merchant uninstalls | `stores` row updated to `status: uninstalled`, webhooks rejected with 403 |

---

## Full User Journey

### Day 0 — Installation

```
1. Merchant finds "DSV AdSync" on Salla Partner App Store
2. Clicks Install
3. Salla fires webhook:  POST /webhooks/salla  { event: "app.installed" }
   → stores table: INSERT { store_id, status: "active" }

4. Salla fires webhook:  POST /webhooks/salla  { event: "app.store.authorize" }
   → stores table: UPDATE { access_token_enc, refresh_token_enc, token_expires_at }

5. Salla redirects merchant to:
   https://[catalyst-static-url]/#/?store_id=569527
   (this is the dashboard, shown in an iframe inside Salla admin)
```

### Day 0 — Connecting Ad Platforms

```
Merchant opens "Connections" tab in the dashboard
  → GET /api/connections?store_id=569527
  → (empty — no platforms connected yet)

Merchant enters Meta Pixel ID + Access Token → clicks Connect
  → POST /api/connections
     { store_id, platform: "meta", pixel_id, api_token }
  → Backend validates token live against Meta Graph API debug_token endpoint
  → Saves to platform_connections table (Catalyst Encrypted Text column)
  → Returns { validation_status: "ok" } or { validation_status: "error", validation_error: "..." }

Merchant repeats for TikTok, Snap, GA4
```

### Day 1+ — Orders Arrive

```
Customer buys something on the merchant's Salla store
  → Salla fires: POST /webhooks/salla
    {
      event: "order.paid",
      merchant: 569527,
      data: { id, amounts, customer, ... }
    }

webhook.controller.js:
  1. Extract signature from X-Salla-Signature header
  2. Verify HMAC-SHA256(rawBody, SALLA_WEBHOOK_SECRET) == signature
  3. Check stores table → store_id 569527 → status: active ✓
  4. Dedup: has this external_id + type been seen? → no → proceed
  5. normalizer.js → canonical InternalEvent { store_id, type, external_id, payload, ... }
  6. Save to events table (status: "pending")
  7. ASYNC: ga4.dispatcher.js → reads ga4_settings → POSTs to GA4 Measurement Protocol
  8. ASYNC: dispatcher.js → reads platform_connections for store 569527
           → fires Meta CAPI, TikTok Events API, Snap CAPI in parallel
           → writes event_dispatch_logs rows (one per platform)
  9. Return 200 to Salla immediately

Events dispatched in ~50-300ms. Salla never waits for platform responses.
```

### Anytime — Merchant Checks Dashboard

```
Merchant opens the app from Salla admin panel

Dashboard loads:
  GET /platforms/stats?store_id=569527&hours=24
  → {
      total: 47,
      by_status: { sent: 44, failed: 3, pending: 0 },
      dispatch_by_platform: {
        meta:    { success: 40, failed: 2, retrying: 1 },
        tiktok:  { success: 38, failed: 0 },
        snap:    { success: 35, failed: 2 }
      }
    }

  GET /platforms/events?store_id=569527&limit=200
  → recent event rows for this store only

Logs page:
  → same event rows, filterable by platform + status
  → click any row to expand full JSON payload + last error
```

---

## Where the Dashboard Lives

The React SPA is hosted on **Catalyst Static** — a CDN-backed static host within the same Zoho Catalyst project.

```
Catalyst Static URL:   https://[your-domain].catalystserverless.in/app/index.html
AppSail URL:           https://appsail-XXXX.development.catalystappsail.in
```

### How Salla shows the dashboard

In your Salla Partner app settings, you set:
- **App URL**: your Catalyst Static URL
- When a merchant opens your app, Salla loads `{App URL}?store_id={merchant_id}` in an iframe

The React app reads `store_id` from the URL query param on first load:

```js
// store.js
const params = new URLSearchParams(window.location.search);
const urlStore = params.get("store_id");  // → "569527"
localStorage.setItem("selected_store_id", urlStore);
```

All subsequent API calls append `?store_id=569527` to every request. The backend uses this to scope all DB queries.

### `window.__API_BASE__`

`public/index.html` injects the AppSail URL at build time:

```html
<script>
  window.__API_BASE__ = "https://appsail-XXXX.catalystappsail.in";
</script>
```

Every `fetch()` call in the React app prepends this base URL. Change it here before deploying.

---

## Infrastructure Layout

```
Salla_Server_Side_Tracker/
├── appsail/                    ← Node.js/Express backend (Catalyst AppSail)
│   ├── server.js               ← Express app, CORS, route mounting
│   ├── index.js                ← Catalyst AppSail entry point
│   ├── controllers/
│   │   ├── webhook.controller.js    ← Main inbound webhook handler
│   │   ├── connections.controller.js ← CRUD for platform connections
│   │   ├── platform.controller.js   ← Stats, events, stores endpoints
│   │   ├── ga4.controller.js        ← GA4 validate/save/retry
│   │   └── oauth.controller.js      ← Salla OAuth callback
│   ├── pipeline/
│   │   ├── normalizer.js       ← Salla payload → InternalEvent
│   │   ├── deduplicator.js     ← Idempotency check
│   │   ├── dispatcher.js       ← Fan-out to Meta/TikTok/Snap
│   │   └── ga4.dispatcher.js   ← GA4-specific dispatch
│   ├── platforms/
│   │   ├── meta/               ← mapper, service, validator
│   │   ├── tiktok/             ← mapper, service, validator
│   │   ├── snap/               ← mapper, service, validator
│   │   └── ga4/                ← mapper, service, validator
│   ├── datastore/
│   │   ├── client.js           ← Catalyst SDK (initialized per-request)
│   │   ├── stores.repo.js      ← stores table CRUD
│   │   ├── events.repo.js      ← events table CRUD + stats
│   │   ├── connections.repo.js ← platform_connections table CRUD
│   │   ├── dispatch.repo.js    ← event_dispatch_logs table CRUD
│   │   ├── ga4.repo.js         ← ga4_settings table CRUD
│   │   └── tokens.repo.js      ← tokens table CRUD
│   ├── security/
│   │   ├── signature.js        ← HMAC-SHA256 webhook verification
│   │   ├── encryption.js       ← AES-256-GCM for OAuth tokens
│   │   └── pii.js              ← SHA-256 PII hashing (email, phone, name)
│   ├── jobs/
│   │   └── retry.job.js        ← Retry failed dispatch logs (called by Cron)
│   └── routes/
│       ├── webhook.routes.js
│       ├── connections.routes.js
│       ├── platform.routes.js
│       ├── ga4.routes.js
│       ├── jobs.routes.js
│       ├── oauth.routes.js
│       └── health.routes.js
│
├── web-client/                 ← React 19 SPA (Catalyst Static)
│   ├── public/index.html       ← Sets window.__API_BASE__
│   └── src/
│       ├── App.js              ← HashRouter: /, /connections, /logs
│       ├── pages/
│       │   ├── Dashboard.jsx   ← KPI cards + per-platform charts
│       │   ├── Platforms.jsx   ← Connect/disconnect/test ad platforms
│       │   └── Logs.jsx        ← Event log table with payload viewer
│       ├── api/
│       │   ├── http.js         ← fetch wrappers (apiGet, apiPost, apiDelete)
│       │   ├── platforms.api.js ← /platforms/* endpoints
│       │   ├── connections.api.js ← /api/connections/* endpoints
│       │   └── logs.api.js     ← /platforms/events endpoint
│       └── utils/
│           ├── store.js        ← store_id from URL param / localStorage
│           └── i18n.js         ← EN/AR translations
│
├── catalyst.json               ← Catalyst build config (links appsail + web-client)
├── app-config.json             ← AppSail runtime config (node18, 256MB)
└── README.md                   ← This file
```

---

## API Reference

### Webhook (Salla → App)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/salla` | Receives all Salla events. Verifies HMAC-SHA256 signature. |

**Handled event types:**

| Event | Action |
|-------|--------|
| `app.installed` / `app.updated` | Mark store active |
| `app.store.authorize` | Save OAuth tokens |
| `app.uninstalled` / `app.store.uninstalled` | Mark store uninstalled |
| `order.created` | Normalize, dedup, save, dispatch |
| `order.paid` | Normalize, dedup, save, dispatch |
| `order.status.updated` | Normalize, dedup, save, dispatch |

### Platform Connections (Dashboard → App)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connections?store_id=` | List connected platforms (credentials stripped) |
| POST | `/api/connections` | Connect a platform (validates credentials live) |
| DELETE | `/api/connections/:platform?store_id=` | Disconnect a platform |
| POST | `/api/connections/:platform/test?store_id=` | Fire a test event |
| GET | `/api/connections/:platform/health?store_id=` | Get validation status |
| GET | `/api/connections/logs?event_rowid=` | Get dispatch logs for an event |

### Dashboard Data

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platforms/stats?store_id=&hours=24` | Event counts by status + per-platform dispatch stats |
| GET | `/platforms/events?store_id=&limit=50` | Recent event log rows |
| GET | `/platforms/stores` | List of authorized stores (for dropdown) |

### GA4

| Method | Path | Description |
|--------|------|-------------|
| POST | `/platforms/ga4/connect` | Save GA4 Measurement ID + API secret |
| GET | `/platforms/ga4/:store_id` | Fetch GA4 config |
| POST | `/platforms/ga4/validate` | Validate GA4 credentials |
| POST | `/platforms/ga4/retry/:rowid` | Retry a failed GA4 event |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/oauth/callback` | Salla OAuth 2.0 callback |
| POST | `/jobs/retry` | Retry job (called by Catalyst Cron every 60s) |

---

## Data Model

### `stores` table

| Column | Type | Description |
|--------|------|-------------|
| store_id | Text | Salla merchant ID (tenant key) |
| status | Text | `active` / `uninstalled` |
| access_token_enc | Text | AES-256-GCM encrypted OAuth access token |
| refresh_token_enc | Text | AES-256-GCM encrypted refresh token |
| scope | Text | OAuth scopes |
| token_expires_at | DateTime | Token expiry |
| installed_at | DateTime | First install timestamp |

### `events` table

| Column | Type | Description |
|--------|------|-------------|
| store_id | Text | Tenant key |
| event_id | Text | Salla event UUID |
| external_id | Text | Order ID (dedup key) |
| type | Text | `order.paid`, `order.created`, etc. |
| source | Text | `salla` |
| status | Text | `pending` / `sent` / `failed` / `skipped` |
| payload | Long Text | Full raw Salla webhook payload (JSON) |
| retries | Integer | GA4 retry count |
| last_platform | Text | Last platform that processed this event |
| last_error | Text | Last error message |

### `platform_connections` table

| Column | Type | Description |
|--------|------|-------------|
| store_id | Text | Tenant key |
| platform | Text | `meta` / `tiktok` / `snap` / `google` |
| pixel_id | Encrypted Text | Pixel ID / Measurement ID |
| api_token | Encrypted Text | Access token / API secret |
| test_event_code | Text | Meta test event code (optional) |
| is_enabled | Boolean | Whether this connection is active |
| validation_status | Text | `ok` / `error` |
| last_validated_at | Text | ISO timestamp of last validation |

### `event_dispatch_logs` table

| Column | Type | Description |
|--------|------|-------------|
| event_rowid | Integer | FK to events.ROWID |
| store_id | Text | Tenant key |
| platform | Text | `meta` / `tiktok` / `snap` |
| status | Text | `pending` / `success` / `failed` / `retrying` / `dead` |
| http_status | Integer | HTTP response code from platform |
| platform_response | Text | Platform response body (truncated to 5000 chars) |
| error_message | Text | Error description |
| attempt_count | Integer | How many times dispatched |
| next_retry_at | Text | ISO timestamp for next retry |
| dispatched_at | Text | ISO timestamp of last attempt |

### `ga4_settings` table

| Column | Type | Description |
|--------|------|-------------|
| store_id | Text | Tenant key |
| measurement_id | Encrypted Text | GA4 Measurement ID (G-XXXXXXX) |
| api_secret | Encrypted Text | GA4 API secret |
| enabled | Boolean | Whether GA4 is active |

---

## Event Pipeline

```
POST /webhooks/salla
        │
        ▼
1. extractSallaSignature(req)
   → X-Salla-Signature header (or Authorization: Bearer fallback)

2. verifyWebhookSignature(rawBody, signature, SALLA_WEBHOOK_SECRET)
   → HMAC-SHA256 comparison (constant-time)
   → 401 if invalid

3. Route lifecycle events:
   app.store.authorize  → upsertStoreAuth()
   app.installed        → markStoreInstalled()
   app.uninstalled      → markStoreUninstalled()

4. normalizer.js → InternalEvent {
     store_id, type, external_id, event_id,
     payload (raw JSON string)
   }

5. getStore(store_id)
   → 403 if status === "uninstalled"
   → auto-create minimal row if store not found yet

6. findByExternalId(store_id, external_id, type)
   → 200 { deduplicated: true } if already seen

7. saveEvent(event) → events table row

8. ASYNC (non-blocking):
   ga4.dispatcher.js:
     → getGa4Settings(store_id) → skip if not configured
     → ga4.mapper.js → GA4 purchase event payload
     → POST https://www.google-analytics.com/mp/collect
     → updateEventStatus(events.ROWID, "sent"/"failed")

   dispatcher.js:
     → listEnabledConnections(store_id) → platform_connections
     → for each [meta, tiktok, snap]:
         → createDispatchLog(event_dispatch_logs)
         → mapper.js → platform-specific payload
         → service.js → HTTPS POST to platform API
         → updateDispatchLog(status: "success"/"retrying"/"failed")

9. Return 200 { received: true } to Salla
```

---

## PII Hashing & Security

All customer personal data is SHA-256 hashed before being sent to ad platforms, per GDPR/PDPL and platform requirements.

```
Email:  lowercase → trim → SHA-256
Phone:  strip non-digits → normalize to E.164 → SHA-256
        (defaults to Saudi country code 966 if local number)
Name:   lowercase → trim → remove spaces → SHA-256
City:   same as name
ZIP:    same as name

Dedup event ID:  SHA-256( store_id + ":" + order_id + ":" + event_type )
```

**Token encryption**: OAuth tokens in the `stores` table are encrypted with AES-256-GCM using the `ENCRYPTION_KEY` env var before writing to Datastore. Platform credentials in `platform_connections` use Catalyst's built-in Encrypted Text column type (no manual encrypt/decrypt needed).

**Webhook signature**: Every inbound Salla webhook is verified with HMAC-SHA256 using the `SALLA_WEBHOOK_SECRET`. Requests without a valid signature are rejected with 401 before any data is touched.

---

## Retry System

Failed dispatches are automatically retried with exponential backoff.

### Retry schedule

| Attempt | Delay after previous |
|---------|---------------------|
| 1 (initial) | Immediate |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 attempts, status is set to `dead` — no further retries.

### Retryable vs non-retryable

| HTTP Status | Action |
|-------------|--------|
| 429, 500, 502, 503, 504 | Retry (transient) |
| 400, 401, 403 | Fail permanently (bad credentials) |

### How to register the Cron job

In Catalyst Console → Functions → Cron:

- **Name**: retry-dispatch
- **URL**: `POST /jobs/retry`
- **Schedule**: `*/1 * * * *` (every 60 seconds)
- **Header**: `X-Jobs-Secret: {your JOBS_SECRET value}`

---

## Environment Variables

Set these in Catalyst AppSail → Configuration → Environment Variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `SALLA_CLIENT_ID` | Yes | From Salla Partner portal (app credentials) |
| `SALLA_CLIENT_SECRET` | Yes | From Salla Partner portal |
| `SALLA_WEBHOOK_SECRET` | Yes | From Salla Partner portal → Webhook settings |
| `APP_BASE_URL` | Yes | AppSail URL (e.g. `https://appsail-XXX.catalystappsail.in`) |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for AES-256-GCM. Generate: `openssl rand -hex 32` |
| `JOBS_SECRET` | Recommended | Secret for protecting the `/jobs/retry` cron endpoint |
| `X_ZOHO_CATALYST_LISTEN_PORT` | Auto | Injected by Catalyst AppSail at runtime |
| `NODE_ENV` | Optional | Set to `production` to hide stack traces in error responses |

Also update `web-client/public/index.html` to set `window.__API_BASE__` to your AppSail URL before deploying the frontend.

---

## Development Commands

### Backend (appsail/)

```bash
cd Salla_Server_Side_Tracker/appsail
npm install
npm start          # runs node index.js
```

### Frontend (web-client/)

```bash
cd Salla_Server_Side_Tracker/web-client
npm install
npm start          # dev server on localhost:3000
npm run build      # production build
npm test           # Jest
npm test -- --testPathPattern=<filename>  # single file
```

For local frontend development, the API calls will be proxied to the AppSail URL set in `public/index.html`. You can override it by setting `REACT_APP_API_BASE` in a `.env.local` file.

---

## Deployment

```bash
# From the Salla_Server_Side_Tracker/ directory
catalyst deploy
```

This command:
1. Runs `npm run build` in `web-client/` (via the React Catalyst plugin)
2. Deploys the built static files to Catalyst Static
3. Deploys `appsail/` to Catalyst AppSail

After deploy, confirm the AppSail URL in Catalyst Console and update `window.__API_BASE__` in `public/index.html` if it changed.

### Salla Partner Portal settings to verify

| Setting | Value |
|---------|-------|
| App URL | Catalyst Static URL |
| OAuth Redirect URI | `{AppSail URL}/oauth/callback` |
| Webhook Security Strategy | **Signature** (not Token) |
| Webhook URL | `{AppSail URL}/webhooks/salla` |

---

## Known Gaps & Roadmap

### Remaining items

| Item | Priority | Notes |
|------|----------|-------|
| Register Cron job for `/jobs/retry` | **High** | Retry is built but won't run until registered in Catalyst Console |
| `JOBS_SECRET` env var | **High** | Set this before going live |
| Plans/billing (`plans` table) | Medium | Subscription quota enforcement not implemented |
| `jobs/reconcile.job.js` | Low | Order reconciliation for missed webhooks |
| `jobs/token-monitor.job.js` | Low | Daily check for expiring OAuth tokens |
| Dashboard JWT auth | Low | Currently trusts `store_id` from URL; acceptable inside Salla iframe |

### Architecture decisions

- **No ORM** — raw ZCQL queries via `zcatalyst-sdk-node`
- **Async dispatch** — webhook returns 200 immediately; platform POSTs happen after
- **Catalyst Encrypted Text** — used for `platform_connections` credentials; no manual encrypt/decrypt
- **AES-256-GCM** — used for OAuth tokens in `stores` table (manual encrypt/decrypt via `security/encryption.js`)
- **Dedup key** — `store_id + external_id + event_type` (not just order ID, because same order can trigger `order.created` and `order.paid` separately)
- **GA4 separate from Meta/TikTok/Snap** — GA4 reads from `ga4_settings` table + updates `events.status`; Meta/TikTok/Snap read from `platform_connections` + write to `event_dispatch_logs`
