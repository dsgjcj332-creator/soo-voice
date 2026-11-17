# SooVoice — Live Voice AI Ordering Agent

![SooVoice](public/logo-full.svg)

A SaaS platform that adds a **live voice agent** to restaurants and online stores. Customers speak instead of clicking through menus; the agent understands the order, answers questions from the merchant's knowledge base, and adds items to the cart automatically.

Powered by the **Gemini Live API** (audio in / audio out) with function calling (`add_to_cart`, `place_order`).

## Highlights

- **Live voice widget** — embeddable on any storefront, with real-time audio transcription and multi-Arabic-dialect support (Egyptian, Gulf, Levantine, MSA) plus English.
- **Merchant dashboard** — analytics, conversation logs, knowledge base (brand profile, strict FAQs, custom documents), digital menu, billing, and widget settings.
- **Super-admin area** — manage merchants, voices, servers, and system settings.
- **Store integrations** — OAuth install flow and product-sync webhooks for Salla/Shopify-style app stores.
- **Security-first API** — HMAC-verified webhooks, timing-safe API keys, per-IP rate limiting, CORS allowlist, and ephemeral Gemini tokens (the real API key never reaches the browser).

## Architecture

```
Browser (React 19 + Vite 6 + Tailwind 4)
│
├── VoiceWidget ──POST /api/gemini-session──▶ serverless function
│                                              │ mints ephemeral token
│                                              ▼
│                                     Gemini Live API (v1alpha)
│                                     audio + function calling
│
└── Dashboard ──/api/* (x-api-key)──▶ unified Express API
                                     ├─ analytics / conversations / orders
                                     ├─ users / webhook-settings
                                     ├─ /api/oauth/callback
                                     └─ /api/webhooks/* (HMAC-verified)
                                              │
                                              ▼
                                          Supabase (auth + database)
```

The **same Express app** (`src/lib/api.ts`) runs in two places:

- **Production (Vercel):** `api/[...slug].ts` delegates every `/api/*` request to it.
- **Local development:** `server.ts` mounts it with `app.use('/api', createApiApp())`.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.8 (strict, `tsc --noEmit` clean) |
| UI | React 19, React Router 7, Tailwind CSS 4, Motion, Recharts, lucide-react |
| Build | Vite 6 |
| Server | Express 4 (`tsx` in dev, `@vercel/node` serverless in production) |
| Database / Auth | Supabase |
| AI | `@google/genai` — Gemini Live API with ephemeral auth tokens |

## Project Structure

```
├── api/
│   └── [...slug].ts        # Vercel catch-all → src/lib/api.ts
├── src/
│   ├── components/
│   │   ├── layout/         # Dashboard / Public / SuperAdmin layouts
│   │   ├── onboarding/
│   │   └── widget/         # VoiceWidget (Gemini Live client)
│   ├── contexts/           # Auth, Cart, Language, Settings, Knowledge
│   ├── lib/
│   │   ├── api.ts          # ⭐ unified backend API (single source of truth)
│   │   ├── supabase.ts     # Supabase client (env or localStorage config)
│   │   └── utils.ts
│   ├── pages/              # Dashboard, KB, Conversations, Admin, Public pages…
│   └── services/           # merchants, conversations, voices, settings
├── server.ts               # dev server: unified API + Vite middleware
├── index.html
├── vite.config.ts
└── package.json
```

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local    # fill in the values (see table below)
npm run dev                   # dev server on http://localhost:3000
```

Other scripts:

```bash
npm run build   # production build (dist/)
npm run preview # preview the production build
npm run lint    # TypeScript type check (tsc --noEmit)
npm run clean   # remove dist/
```

## Environment Variables

| Variable | Scope | Description |
|---|---|---|
| `GEMINI_API_KEY` | **server-only** | Gemini API key. Used by the serverless function to mint ephemeral Live-API tokens. **Never** prefixed with `VITE_`. |
| `WEBHOOK_SECRET` | **server-only** | HMAC secret for inbound webhooks (`x-soovoice-signature: sha256=<hex of RAW body>`). Webhooks fail closed if unset. |
| `API_KEY` | **server-only** | Admin API key required via the `x-api-key` header on data routes. |
| `APP_URL` | server | Public deployment URL (OAuth callbacks, self-referential links). |
| `ALLOWED_ORIGINS` | server | Optional comma-separated CORS allowlist. Empty = allow all (needed while the widget is embedded on arbitrary storefronts). |
| `VITE_SUPABASE_URL` | client (public) | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | client (public) | Supabase anon key — safe to expose, protected by RLS. |
| `SUPABASE_URL` | **server-only** | Supabase project URL used by trusted guest-order and POS connection APIs. |
| `SUPABASE_ANON_KEY` | server-only | Supabase anon/publishable key used by the server to validate merchant access tokens with Supabase Auth. |\n| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Service-role key used only by trusted order and POS connection endpoints. Never expose it to Vite/browser code. |
| `ORDER_TOKEN_SECRET` | **server-only** | At least 32 random characters; HMAC key for per-order guest capability tokens. |
| `POS_CREDENTIALS_ENCRYPTION_KEY` | **server-only** | Base64-encoded 32-byte AES-256-GCM key for POS credentials. Generate with `openssl rand -base64 32`; never expose or commit it. |
| `POS_CREDENTIALS_ENCRYPTION_KEY_VERSION` | server-only | Key version stored with encrypted POS credentials; defaults to `v1`. Keep the matching key available for every stored version. |

## Security Model

- **Trusted guest checkout.** `/api/store/orders` accepts product IDs and quantities only; the database reloads each merchant-owned, non-AI-only catalog price and atomically writes the order plus an outbox event. Guest tracking requires a per-order capability token; only its SHA-256 hash is stored and it expires after seven days. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ORDER_TOKEN_SECRET` server-side.
- **POS connection secrets.** `GET /api/pos/connections` and `POST /api/pos/connections` require a Supabase Bearer access token. The server resolves the merchant ID from Supabase Auth (never from request input), encrypts credentials with AES-256-GCM before persistence, and returns metadata only. Connections remain `pending` until a real provider adapter and connection validation flow are implemented.\n- **Outbox is not POS delivery.** The transaction creates a durable `order.created` event, but a worker and provider adapter are still required before an order can be claimed as accepted by a cashier/POS.

- **No API keys in the browser.** The widget requests a short-lived **ephemeral token** from `/api/gemini-session`; the real `GEMINI_API_KEY` lives only in serverless functions.
- **Signed webhooks.** Every webhook route requires `x-soovoice-signature: sha256=<hex>` (HMAC-SHA256 over the raw body). Verification is constant-time and fails closed when `WEBHOOK_SECRET` is missing.
- **Timing-safe API keys.** `x-api-key` comparisons use hashed constant-time equality.
- **Rate limiting.** Global per-IP limit (600 req/min) plus a stricter limit on token minting (30 req/min), per serverless instance.
- **CORS allowlist.** Set `ALLOWED_ORIGINS` to lock the API to known dashboard/widget origins once merchant domains are registered.

## POS connections and branch mappings

The Integrations page includes a bilingual POS management panel. A merchant must have a real Supabase Auth session; local demo users are not authorized to create or manage POS connections.

- `GET/POST /api/pos/connections` lists a merchant's connections and stores new credential objects encrypted server-side. Secret fields are never returned to the browser.
- `GET/POST/PATCH /api/pos/locations` lists, manually maps, and deactivates branch mappings. Deactivation preserves historical order references. Every operation derives the merchant from the verified Supabase session; location creation also verifies that the selected connection belongs to that merchant.
- A canonical POS catalog validation boundary now rejects malformed provider IDs, currencies, unsafe prices, duplicate item/branch/modifier IDs, invalid timestamps, and inconsistent modifier selection rules before normalized data is accepted. Signed modifier price deltas are supported. This is validation only; it does not yet persist or synchronize catalog rows.\n- Branch IDs are entered manually for now. Provider branch discovery, provider credential validation, connection health checks, OAuth, menu/catalog sync, order delivery, and a deployed worker are not implemented.\n- Outbox leases now have an explicit expiry timestamp. Expired workers cannot complete or retry an event; another worker may reclaim it after expiry.
- New connections remain `pending`; adding credentials or a branch mapping does not mean the external POS is connected or synchronized.

Apply `sql/2026_11_18_multi_pos_registry.sql` before using these endpoints. Configure the server-only Supabase URL, anon key, service-role key, and `POS_CREDENTIALS_ENCRYPTION_KEY` / version as documented in `.env.example`. Never expose server secrets through `VITE_*` variables.

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Set the server-side env vars from the table above in Project Settings.
3. Build command: `npm run build` — API routes are picked up automatically from `api/`.
4. Run the required Supabase SQL migrations in order: `sql/orders_setup.sql` (if the orders table does not exist), `sql/2026_11_17_harden_orders_rls.sql`, `sql/2026_11_18_multi_pos_registry.sql`, `sql/2026_11_19_secure_guest_checkout.sql`, and `sql/2026_11_20_enforce_outbox_lease_expiry.sql`. Verify them in staging before production.
5. Run `sql/store_settings.sql` in the Supabase SQL Editor (one-time). It creates the
   `store_settings` table that powers the merchant store profile, voice-widget
   visibility toggle, geo-fence and menu session duration. Until it is applied the
   app degrades gracefully to localStorage-only persistence.

## Store Access Control (QR dine-in)

Merchants control the customer menu from **Settings → Table Experience & Access Control**:

- **Restaurant profile** — Arabic/English name, phone, address; shown on the
  customer menu, the QR stand and the browser tab.
- **Voice waiter toggle** — hide the AI voice widget for a manual-only menu.
- **Session duration** — the menu stays open 5/10/15/30/60/120 minutes after a QR
  scan, or always. Expired sessions show a lock screen until the guest re-scans.
- **Geo-fence** — the menu opens only within a configurable radius (100 m – 5 km)
  of the restaurant's coordinates. Owners preview freely via `?preview=1` links;
  real QR scans always enforce the lock.

## Roadmap

- Real Supabase queries behind the placeholder API responses (analytics, conversations, orders).
- Native Salla/Shopify HMAC signature verification on top of the app's own scheme.
- Redis/Upstash-backed rate limiting shared across serverless instances.
- Code-splitting for the dashboard bundle (currently ~1.7 MB minified).

## License

Apache-2.0 (see source headers).
