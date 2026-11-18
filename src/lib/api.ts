/**
 * Unified backend API for SooVoice.
 *
 * This single Express app is mounted in two places:
 *  - Production (Vercel): api/[...slug].ts delegates every /api/* request here.
 *  - Local development:   server.ts mounts it with app.use('/api', createApiApp()).
 *
 * Security notes:
 *  - All admin/data routes require the `x-api-key` header (timing-safe compare).
 *  - All webhook routes require an HMAC-SHA256 signature header
 *    `x-soovoice-signature: sha256=<hex>` computed over the RAW request body
 *    with WEBHOOK_SECRET (fail-closed when the secret is not configured).
 *  - In-memory rate limiting per client IP (per-instance on serverless).
 *  - CORS origins can be restricted via ALLOWED_ORIGINS (comma-separated).
 *  - The real GEMINI_API_KEY never reaches the browser: /api/gemini-session
 *    mints a short-lived ephemeral token for the Gemini Live API instead.
 */
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI, Modality } from '@google/genai';
import { decryptPosCredentials, encryptPosCredentials } from './pos/credentials';
import { normalizePosCatalog } from './pos/catalog-normalizer';
import { verifyPosWebhookSignature } from './pos/webhook-security';
import { rotatePosWebhookSecret } from './pos/webhook-secret';
import { isUuid, parsePosLocationInput } from './pos/location-validation';
import { createBillingAdminRouter } from './billing-admin-api';
import { processOrderOutboxBatch, type OrderOutboxEvent, type PosDispatchTarget } from './pos/outbox-worker';
import { sendCustomPosOrderWebhook } from './pos/custom-webhook-delivery';
import { SupabaseOutboxStore } from './pos/supabase-outbox-store';
import { selectPosOrderRoute } from './pos/order-routing';
import type { PosCreateOrderInput, PosProviderId } from './pos/types';

/** Constant-time string comparison (hash both sides first to equalize length). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Simple in-memory, per-IP fixed-window rate limiter (per serverless instance). */
function rateLimit(windowMs: number, max: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = firstHeader(req.headers['x-forwarded-for']);
    const ip = forwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

export function createApiApp() {
  const app = express();

  // CORS: restrict to ALLOWED_ORIGINS when configured. Left open by default so
  // the embeddable voice widget keeps working on merchant storefronts.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
    }),
  );

  // JSON body parsing; keep the RAW body around for HMAC signature verification.
  app.use(
    express.json({
      limit: '2mb',
      verify(req: express.Request & { rawBody?: Buffer }, _res, buf) {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  // Global per-IP limiter for the whole API surface.
  app.use(rateLimit(60_000, 600));

  // Billing management uses Supabase-verified app_metadata admin claims;
  // service-role credentials remain server-side and never reach the browser.
  app.use('/api/admin/billing', createBillingAdminRouter());

  const requireApiKey = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const expected = process.env.API_KEY;
    if (!expected) {
      res.status(503).json({ error: 'API not configured: API_KEY is missing server-side' });
      return;
    }
    const provided = firstHeader(req.headers['x-api-key']);
    if (!provided || !safeEqual(provided, expected)) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
    next();
  };

  // Verifies `x-soovoice-signature: sha256=<hex hmac>` computed over the RAW body.
  const verifyWebhookSignature = (
    req: express.Request & { rawBody?: Buffer },
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      // Fail closed: webhooks are never accepted without a configured secret.
      res.status(503).json({ error: 'Webhooks not configured: WEBHOOK_SECRET is missing server-side' });
      return;
    }
    const signature = firstHeader(req.headers['x-soovoice-signature']);
    if (!signature || !signature.startsWith('sha256=')) {
      res.status(401).json({ error: 'Missing or invalid signature' });
      return;
    }
    const provided = signature.slice('sha256='.length);
    const raw =
      req.rawBody instanceof Buffer ? req.rawBody : Buffer.from(JSON.stringify(req.body ?? {}));
    const computed = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!safeEqual(computed, provided)) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }
    next();
  };

  // ============ AUTHENTICATED POS CONNECTION MANAGEMENT ============
  // The merchant identity is derived exclusively from a verified Supabase
  // access token. Never accept owner_id from the request body or x-api-key.
  const posConnectionRateLimit = rateLimit(60_000, 20);
  const posProviders = new Set([
    'foodics', 'toast', 'square', 'clover', 'lightspeed',
    'oracle_simphony', 'odoo', 'shopify_pos', 'salla', 'custom',
  ]);
  const getPosBackend = () => {
    let supabaseUrl = process.env.SUPABASE_URL || '';
    while (supabaseUrl.endsWith('/')) supabaseUrl = supabaseUrl.slice(0, -1);
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !serviceKey || !anonKey || !process.env.POS_CREDENTIALS_ENCRYPTION_KEY) return null;
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
    } catch {
      return null;
    }
    return { supabaseUrl, serviceKey, anonKey };
  };

  const authenticatePosMerchant = async (req: express.Request) => {
    const backend = getPosBackend();
    const authorization = firstHeader(req.headers.authorization) || '';
    const match = /^Bearer\s+([A-Za-z0-9._~-]{30,4096})$/i.exec(authorization);
    if (!backend || !match) return null;
    try {
      const response = await fetch(`${backend.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: backend.anonKey, Authorization: `Bearer ${match[1]}` },
      });
      if (!response.ok) return null;
      const user = await response.json() as { id?: unknown };
      if (typeof user?.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(user.id)) return null;
      return { backend, ownerId: user.id };
    } catch {
      return null;
    }
  };

  const posServiceHeaders = (serviceKey: string) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  });

  // Provider-neutral signed catalog webhook. The provider/owner/branch scope is
  // resolved from persisted connection records, never from caller-supplied IDs.
  app.post('/api/pos/webhooks/:connectionId', async (req, res) => {
    const connectionId = req.params.connectionId;
    const eventId = firstHeader(req.headers['x-pos-event-id']);
    const eventType = firstHeader(req.headers['x-pos-event-type']);
    const timestamp = firstHeader(req.headers['x-pos-timestamp']);
    const signature = firstHeader(req.headers['x-pos-signature']);
    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
    if (!isUuid(connectionId) || !eventId || !/^[A-Za-z0-9._:-]{1,160}$/.test(eventId) ||
        !eventType || !['catalog.snapshot', 'order.status'].includes(eventType) ||
        !rawBody || rawBody.length === 0 || rawBody.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Invalid POS webhook request' });
      return;
    }
    const backend = getPosBackend();
    if (!backend) {
      res.status(503).json({ error: 'POS webhook ingress is not configured' });
      return;
    }
    try {
      const connectionQuery = new URLSearchParams({
        select: 'id,owner_id,provider,status,credentials_ciphertext,credentials_key_version,inbound_webhooks_enabled',
        id: `eq.${connectionId}`,
        status: 'eq.connected',
        limit: '1',
      });
      const connectionResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_connections?${connectionQuery}`, {
        headers: posServiceHeaders(backend.serviceKey),
      });
      if (!connectionResponse.ok) {
        res.status(503).json({ error: 'Could not verify POS webhook connection' });
        return;
      }
      const connections = await connectionResponse.json() as Array<{
        id: string; owner_id: string; provider: string; status: string;
        credentials_ciphertext: string | null; credentials_key_version: string | null;
        inbound_webhooks_enabled: boolean;
      }>;
      if (!Array.isArray(connections) || connections.length !== 1) {
        res.status(404).json({ error: 'Active POS connection not found' });
        return;
      }
      const connection = connections[0];
      if (connection.inbound_webhooks_enabled !== true) {
        res.status(409).json({ error: 'Inbound webhooks are not enabled for this connection' });
        return;
      }
      if (!connection.credentials_ciphertext || !connection.credentials_key_version) {
        res.status(503).json({ error: 'POS webhook credentials are unavailable' });
        return;
      }
      const credentials = decryptPosCredentials(connection.credentials_ciphertext, connection.credentials_key_version);
      const webhookSecret = typeof credentials.webhookSecret === 'string' ? credentials.webhookSecret : '';
      if (!verifyPosWebhookSignature({ timestamp, signature, rawBody, secret: webhookSecret })) {
        res.status(401).json({ error: 'POS webhook signature verification failed' });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const providerLocationId = typeof body?.providerLocationId === 'string' ? body.providerLocationId.trim() : '';
      if (!providerLocationId || providerLocationId.length > 160) {
        res.status(400).json({ error: 'Invalid POS webhook branch' });
        return;
      }
      if (eventType === 'catalog.snapshot' &&
          (typeof body.completeSnapshot !== 'boolean' || !Array.isArray(body.items))) {
        res.status(400).json({ error: 'Invalid POS catalog snapshot payload' });
        return;
      }
      const providerOrderId = typeof body.providerOrderId === 'string' ? body.providerOrderId.trim() : '';
      const orderStatus = typeof body.status === 'string' ? body.status.trim() : '';
      if (eventType === 'order.status' &&
          (!providerOrderId || providerOrderId.length > 200 ||
           !['pending', 'preparing', 'completed', 'cancelled'].includes(orderStatus))) {
        res.status(400).json({ error: 'Invalid POS order status payload' });
        return;
      }
      const locationQuery = new URLSearchParams({
        select: 'id',
        owner_id: `eq.${connection.owner_id}`,
        connection_id: `eq.${connection.id}`,
        provider_location_id: `eq.${providerLocationId}`,
        active: 'eq.true',
        limit: '1',
      });
      const locationResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) {
        res.status(503).json({ error: 'Could not resolve POS branch' });
        return;
      }
      if (!Array.isArray(locations) || locations.length !== 1) {
        res.status(404).json({ error: 'Mapped active POS branch not found' });
        return;
      }

      if (eventType === 'order.status') {
        const rpcResponse = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/ingest_pos_order_status_webhook`, {
          method: 'POST',
          headers: posServiceHeaders(backend.serviceKey),
          body: JSON.stringify({
            p_owner_id: connection.owner_id,
            p_connection_id: connection.id,
            p_location_id: locations[0].id,
            p_provider_event_id: eventId,
            p_event_metadata: {
              provider: connection.provider,
              providerLocationId,
              occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt.slice(0, 40) : null,
            },
            p_provider_order_id: providerOrderId,
            p_order_status: orderStatus,
          }),
        });
        const result = await rpcResponse.json().catch(() => null) as Record<string, unknown> | null;
        if (!rpcResponse.ok || !result || result.accepted !== true) {
          console.error('[API] POS order status webhook ingestion failed:', rpcResponse.status);
          res.status(503).json({ error: 'POS order status webhook could not be processed; retry later' });
          return;
        }
        res.set('Cache-Control', 'no-store');
        res.status(200).json({
          accepted: true,
          duplicate: result.duplicate === true,
          updated: result.updated === true,
          status: typeof result.status === 'string' ? result.status : undefined,
        });
        return;
      }

      const normalized = normalizePosCatalog(body.items);
      const scopedItems = normalized.filter(item => item.locationIds.includes(providerLocationId));
      if (scopedItems.length !== normalized.length) {
        res.status(400).json({ error: 'Catalog payload contains products outside the mapped branch' });
        return;
      }
      const rpcResponse = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/ingest_pos_catalog_webhook`, {
        method: 'POST',
        headers: posServiceHeaders(backend.serviceKey),
        body: JSON.stringify({
          p_owner_id: connection.owner_id,
          p_connection_id: connection.id,
          p_location_id: locations[0].id,
          p_provider_event_id: eventId,
          p_event_type: eventType,
          p_event_metadata: {
            provider: connection.provider,
            providerLocationId,
            occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt.slice(0, 40) : null,
          },
          p_items: scopedItems,
          p_complete_snapshot: body.completeSnapshot,
        }),
      });
      const result = await rpcResponse.json().catch(() => null) as Record<string, unknown> | null;
      if (!rpcResponse.ok || !result || result.accepted !== true) {
        console.error('[API] POS webhook ingestion failed:', rpcResponse.status);
        res.status(503).json({ error: 'POS catalog webhook could not be processed; retry later' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.status(200).json({ accepted: true, duplicate: result.duplicate === true });
    } catch (err) {
      // Never log webhook bodies, signatures, or decrypted provider credentials.
      console.error('[API] POS webhook ingestion error:', err instanceof Error ? err.message : 'unknown');
      res.status(400).json({ error: 'POS webhook could not be validated or processed' });
    }
  });

  app.get('/api/pos/connections', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,provider,display_name,status,granted_scopes,last_sync_at,last_error_code,credentials_ciphertext,credentials_key_version,inbound_webhooks_enabled,outbound_orders_enabled,created_at,updated_at',
        owner_id: `eq.${auth.ownerId}`,
        order: 'created_at.desc',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) {
        console.error('[API] POS connection list failed:', response.status);
        res.status(503).json({ error: 'POS connections are temporarily unavailable' });
        return;
      }
      const rows = await response.json();
      // Decrypt only on the server to expose capability flags, never credentials.
      const safeRows = Array.isArray(rows) ? rows.map((row: Record<string, unknown>) => {
        let credentials: Record<string, unknown> = {};
        if (typeof row.credentials_ciphertext === 'string' && typeof row.credentials_key_version === 'string') {
          try { credentials = decryptPosCredentials(row.credentials_ciphertext, row.credentials_key_version); } catch { credentials = {}; }
        }
        const inboundConfigured = typeof credentials.webhookSecret === 'string' && credentials.webhookSecret.length >= 32;
        const outboundUrlIsHttps = typeof credentials.orderWebhookUrl === 'string' &&
          (() => { try { return new URL(credentials.orderWebhookUrl as string).protocol === 'https:'; } catch { return false; } })();
        const outboundConfigured = outboundUrlIsHttps &&
          typeof credentials.orderWebhookSecret === 'string' && credentials.orderWebhookSecret.length >= 32;
        const connected = row.status === 'connected';
        const { credentials_ciphertext: _ciphertext, credentials_key_version: _version, ...metadata } = row;
        return {
          ...metadata,
          inbound_webhooks_configured: inboundConfigured,
          outbound_orders_configured: outboundConfigured,
          inbound_webhooks_active: connected && row.inbound_webhooks_enabled === true && inboundConfigured,
          outbound_orders_active: connected && row.outbound_orders_enabled === true && outboundConfigured,
        };
      }) : [];
      res.set('Cache-Control', 'no-store');
      res.json(safeRows);
    } catch (err) {
      console.error('[API] POS connection list error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS connections are temporarily unavailable' });
    }
  });

  app.post('/api/pos/connections', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const body = req.body || {};
    const provider = typeof body.provider === 'string' ? body.provider : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 100) : null;
    const credentials = body.credentials;
    if (!posProviders.has(provider) || !credentials || typeof credentials !== 'object' ||
        Array.isArray(credentials) || Object.keys(credentials).length === 0) {
      res.status(400).json({ error: 'Provider and non-empty credentials object are required' });
      return;
    }
    // Foodics uses an account-level API token issued with the account owner's
    // authorization. Accept only that secret here; do not silently store
    // arbitrary JSON or imply that saving it verifies a live connection.
    if (provider === 'foodics') {
      const keys = Object.keys(credentials as Record<string, unknown>);
      const apiToken = (credentials as Record<string, unknown>).apiToken;
      if (keys.length !== 1 || keys[0] !== 'apiToken' || typeof apiToken !== 'string' ||
          apiToken.trim().length < 20 || apiToken.trim().length > 4096) {
        res.status(400).json({ error: 'Foodics requires a valid apiToken field only' });
        return;
      }
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(credentials);
      if (!serialized || Buffer.byteLength(serialized, 'utf8') > 16_384) {
        res.status(400).json({ error: 'Credentials payload is invalid or too large' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'Credentials payload is invalid' });
      return;
    }

    try {
      const encrypted = encryptPosCredentials(credentials as Record<string, unknown>);
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections`, {
        method: 'POST',
        headers: {
          ...posServiceHeaders(auth.backend.serviceKey),
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          owner_id: auth.ownerId,
          provider,
          display_name: displayName || provider,
          status: 'pending',
          credentials_ciphertext: encrypted.ciphertext,
          credentials_key_version: encrypted.keyVersion,
        }),
      });
      const rows = await response.json().catch(() => null) as Array<Record<string, unknown>> | null;
      if (!response.ok || !Array.isArray(rows) || rows.length !== 1) {
        console.error('[API] POS connection create failed:', response.status);
        res.status(503).json({ error: 'Could not save POS connection' });
        return;
      }
      const row = rows[0];
      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        id: row.id,
        provider: row.provider,
        display_name: row.display_name,
        status: row.status,
        created_at: row.created_at,
      });
    } catch (err) {
      // Never log request bodies, provider credentials, or encryption output.
      console.error('[API] POS connection create error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not save POS connection' });
    }
  });

  // Generate/rotate a per-connection inbound webhook secret. The plaintext
  // is returned once and is never stored or logged outside the encrypted envelope.
  app.post('/api/pos/connections/:connectionId/webhook-secret', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const connectionId = req.params.connectionId;
    if (!isUuid(connectionId)) {
      res.status(400).json({ error: 'A valid POS connection ID is required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,credentials_ciphertext,credentials_key_version',
        id: `eq.${connectionId}`,
        owner_id: `eq.${auth.ownerId}`,
        limit: '1',
      });
      const read = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const rows = await read.json().catch(() => null) as Array<{
        id: string; credentials_ciphertext: string | null; credentials_key_version: string | null;
      }> | null;
      if (!read.ok) {
        console.error('[API] POS webhook secret lookup failed:', read.status);
        res.status(503).json({ error: 'Could not access POS connection' });
        return;
      }
      if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].credentials_ciphertext || !rows[0].credentials_key_version) {
        res.status(404).json({ error: 'POS connection not found' });
        return;
      }

      const current = rows[0];
      const rotated = rotatePosWebhookSecret(current.credentials_ciphertext, current.credentials_key_version);
      const updateQuery = new URLSearchParams({
        id: `eq.${connectionId}`,
        owner_id: `eq.${auth.ownerId}`,
        credentials_ciphertext: `eq.${current.credentials_ciphertext}`,
        credentials_key_version: `eq.${current.credentials_key_version}`,
        select: 'id',
      });
      const update = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${updateQuery}`, {
        method: 'PATCH',
        headers: {
          ...posServiceHeaders(auth.backend.serviceKey),
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          credentials_ciphertext: rotated.ciphertext,
          credentials_key_version: rotated.keyVersion,
          updated_at: new Date().toISOString(),
        }),
      });
      const updated = await update.json().catch(() => null) as Array<{ id: string }> | null;
      if (!update.ok) {
        console.error('[API] POS webhook secret update failed:', update.status);
        res.status(503).json({ error: 'Could not rotate POS webhook secret' });
        return;
      }
      if (!Array.isArray(updated) || updated.length !== 1) {
        res.status(409).json({ error: 'POS connection changed; retry secret rotation' });
        return;
      }
      res.set('Cache-Control', 'no-store, max-age=0');
      res.set('Pragma', 'no-cache');
      res.status(200).json({ secret: rotated.secret });
    } catch (err) {
      // Do not log credentials, webhook secrets, signatures or request payloads.
      console.error('[API] POS webhook secret rotation error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not rotate POS webhook secret' });
    }
  });

  // Activate the selected connection for one or both supported directions.
  // Inbound webhook and outbound bridge credentials are validated separately;
  // an outbound-only middleware connection does not need an inbound secret.
  app.post('/api/pos/connections/:connectionId/activate-webhooks', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const connectionId = req.params.connectionId;
    const confirmInbound = req.body?.confirmWebhookConfigured === true;
    const confirmOutbound = req.body?.confirmOutboundConfigured === true;
    if (!isUuid(connectionId) || (!confirmInbound && !confirmOutbound)) {
      res.status(400).json({ error: 'Confirm at least one POS webhook or outbound order configuration' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,status,credentials_ciphertext,credentials_key_version,inbound_webhooks_enabled,outbound_orders_enabled',
        id: `eq.${connectionId}`,
        owner_id: `eq.${auth.ownerId}`,
        limit: '1',
      });
      const read = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const rows = await read.json().catch(() => null) as Array<{
        id: string; status: string; credentials_ciphertext: string | null;
        credentials_key_version: string | null; inbound_webhooks_enabled: boolean; outbound_orders_enabled: boolean;
      }> | null;
      if (!read.ok) {
        res.status(503).json({ error: 'Could not verify POS connection' });
        return;
      }
      if (!Array.isArray(rows) || rows.length !== 1) {
        res.status(404).json({ error: 'POS connection not found' });
        return;
      }
      const connection = rows[0];
      if (!connection.credentials_ciphertext || !connection.credentials_key_version) {
        res.status(409).json({ error: 'Generate a webhook secret before activation' });
        return;
      }
      const credentials = decryptPosCredentials(connection.credentials_ciphertext, connection.credentials_key_version);
      const inboundConfigured = typeof credentials.webhookSecret === 'string' && credentials.webhookSecret.length >= 32;
      const outboundConfigured = typeof credentials.orderWebhookUrl === 'string' &&
        typeof credentials.orderWebhookSecret === 'string' &&
        credentials.orderWebhookSecret.length >= 32 &&
        (() => { try { return new URL(credentials.orderWebhookUrl as string).protocol === 'https:'; } catch { return false; } })();
      if (confirmInbound && !inboundConfigured) {
        res.status(409).json({ error: 'Generate an inbound webhook secret before enabling inbound webhooks' });
        return;
      }
      if (confirmOutbound && !outboundConfigured) {
        res.status(409).json({ error: 'Configure an HTTPS orderWebhookUrl and orderWebhookSecret before enabling outbound orders' });
        return;
      }
      const locationQuery = new URLSearchParams({
        select: 'id',
        owner_id: `eq.${auth.ownerId}`,
        connection_id: `eq.${connectionId}`,
        active: 'eq.true',
        limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) {
        res.status(503).json({ error: 'Could not verify an active POS branch' });
        return;
      }
      if (!Array.isArray(locations) || locations.length === 0) {
        res.status(409).json({ error: 'Add at least one active POS branch before activation' });
        return;
      }
      if (!['pending', 'degraded', 'connected'].includes(connection.status)) {
        res.status(409).json({ error: 'This POS connection cannot be activated from its current state' });
        return;
      }
      const nextInboundEnabled = connection.inbound_webhooks_enabled || confirmInbound;
      const nextOutboundEnabled = connection.outbound_orders_enabled || confirmOutbound;
      if (connection.status === 'connected' &&
          nextInboundEnabled === connection.inbound_webhooks_enabled &&
          nextOutboundEnabled === connection.outbound_orders_enabled) {
        res.set('Cache-Control', 'no-store');
        res.json({
          activated: true, alreadyActive: true,
          inboundWebhooks: connection.inbound_webhooks_enabled,
          outboundOrderCreation: connection.outbound_orders_enabled,
        });
        return;
      }
      const updateQuery = new URLSearchParams({
        id: `eq.${connectionId}`,
        owner_id: `eq.${auth.ownerId}`,
        status: `eq.${connection.status}`,
        select: 'id,status',
      });
      const update = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${updateQuery}`, {
        method: 'PATCH',
        headers: { ...posServiceHeaders(auth.backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'connected',
          inbound_webhooks_enabled: nextInboundEnabled,
          outbound_orders_enabled: nextOutboundEnabled,
          last_error_code: null,
          updated_at: new Date().toISOString(),
        }),
      });
      const updated = await update.json().catch(() => null) as Array<{ id: string; status: string }> | null;
      if (!update.ok) {
        console.error('[API] POS webhook activation failed:', update.status);
        res.status(503).json({ error: 'Could not activate POS webhooks' });
        return;
      }
      if (!Array.isArray(updated) || updated.length !== 1) {
        res.status(409).json({ error: 'POS connection changed; refresh and try again' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json({
        activated: true, alreadyActive: false,
        inboundWebhooks: nextInboundEnabled, outboundOrderCreation: nextOutboundEnabled,
      });
    } catch (err) {
      console.error('[API] POS webhook activation error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not activate POS webhooks' });
    }
  });

  // ============ POS CATALOG REVIEW (READ-ONLY) ============
  // Exposes only persisted snapshots owned by the authenticated merchant.
  app.get('/api/pos/catalog', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    const locationId = typeof req.params.locationId === 'string' ? req.params.locationId : typeof req.query.locationId === 'string' ? req.query.locationId : '';
    if (!isUuid(locationId)) { res.status(400).json({ error: 'A valid POS location ID is required' }); return; }
    try {
      const locationQuery = new URLSearchParams({ select: 'id', id: `eq.${locationId}`, owner_id: `eq.${auth.ownerId}`, active: 'eq.true', limit: '1' });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, { headers: posServiceHeaders(auth.backend.serviceKey) });
      const ownedLocations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(ownedLocations) || ownedLocations.length !== 1) { res.status(404).json({ error: 'Active POS location not found' }); return; }
      const catalogQuery = new URLSearchParams({
        select: 'id,provider_item_id,category_id,name,description,currency,unit_price,available,modifier_groups,source_version,source_updated_at,active,last_synced_at',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`, order: 'name.asc', limit: '1000',
      });
      const catalogResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_items?${catalogQuery}`, { headers: posServiceHeaders(auth.backend.serviceKey) });
      if (!catalogResponse.ok) { console.error('[API] POS catalog review read failed:', catalogResponse.status); res.status(503).json({ error: 'POS catalog review is temporarily unavailable' }); return; }
      const rows = await catalogResponse.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS catalog review read error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS catalog review is temporarily unavailable' });
    }
  });
  // Returns merchant-owned menu rows, including assistant-only items that can
  // be offered by voice and still need an explicit POS catalog mapping.
  app.get('/api/pos/menu-items', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    try {
      const query = new URLSearchParams({
        select: 'id,name,description,price,isAiOnly',
        ownerId: `eq.${auth.ownerId}`,
        order: 'name.asc',
        limit: '1000',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/menu_items?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) { res.status(503).json({ error: 'SooVoice menu items are temporarily unavailable' }); return; }
      const rows = await response.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS mapping menu list error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'SooVoice menu items are temporarily unavailable' });
    }
  });

  // ============ POS CATALOG MENU MAPPINGS ============
  // A mapping is an explicit merchant approval record; this route never edits menu_items.
  app.get('/api/pos/catalog/mappings', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : '';
    if (!isUuid(locationId)) { res.status(400).json({ error: 'A valid POS location ID is required' }); return; }
    try {
      const locationQuery = new URLSearchParams({
        select: 'id', id: `eq.${locationId}`, owner_id: `eq.${auth.ownerId}`, active: 'eq.true', limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(locations) || locations.length !== 1) { res.status(404).json({ error: 'Active POS location not found' }); return; }

      const query = new URLSearchParams({
        select: 'id,connection_id,location_id,provider_item_id,menu_item_id,field_overrides,approved_at,updated_at',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`, order: 'approved_at.desc', limit: '1000',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_menu_links?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) { res.status(503).json({ error: 'POS menu mappings are temporarily unavailable' }); return; }
      const rows = await response.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS catalog mapping list error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS menu mappings are temporarily unavailable' });
    }
  });

  app.get('/api/pos/catalog/mapping-events/:locationId?', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    const locationId = typeof req.params.locationId === 'string' ? req.params.locationId : typeof req.query.locationId === 'string' ? req.query.locationId : '';
    if (!isUuid(locationId)) { res.status(400).json({ error: 'A valid POS location ID is required' }); return; }
    try {
      const locationQuery = new URLSearchParams({
        select: 'id', id: `eq.${locationId}`, owner_id: `eq.${auth.ownerId}`, limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(locations) || locations.length !== 1) { res.status(404).json({ error: 'POS location not found' }); return; }

      const query = new URLSearchParams({
        select: 'id,mapping_id,provider_item_id,menu_item_id,actor_id,event_type,previous_state,current_state,created_at',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`,
        order: 'created_at.desc', limit: '200',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_menu_link_events?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) { res.status(503).json({ error: 'POS mapping history is temporarily unavailable' }); return; }
      const rows = await response.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS mapping history error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS mapping history is temporarily unavailable' });
    }
  });

  app.post('/api/pos/catalog/mappings', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    const body = req.body || {};
    const locationId = typeof body.locationId === 'string' ? body.locationId : '';
    const providerItemId = typeof body.providerItemId === 'string' ? body.providerItemId.trim() : '';
    const menuItemId = typeof body.menuItemId === 'string' ? body.menuItemId.trim() : '';
    const rawOverrides = body.fieldOverrides && typeof body.fieldOverrides === 'object' && !Array.isArray(body.fieldOverrides)
      ? body.fieldOverrides : {};
    const allowedFields = ['name', 'description', 'price', 'available', 'categoryId'];
    const fieldOverrides: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(rawOverrides)) {
      if (!allowedFields.includes(key) || typeof value !== 'boolean') {
        res.status(400).json({ error: 'Invalid field override selection' }); return;
      }
      if (value) fieldOverrides[key] = true;
    }
    if (!isUuid(locationId) || !providerItemId || providerItemId.length > 160 ||
        !menuItemId || menuItemId.length > 128) {
      res.status(400).json({ error: 'Location, POS product and menu item are required' }); return;
    }

    try {
      const locationQuery = new URLSearchParams({
        select: 'id,connection_id', id: `eq.${locationId}`, owner_id: `eq.${auth.ownerId}`, active: 'eq.true', limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string; connection_id: string }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(locations) || locations.length !== 1) { res.status(404).json({ error: 'Active POS location not found' }); return; }

      const catalogQuery = new URLSearchParams({
        select: 'provider_item_id', owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`,
        provider_item_id: `eq.${providerItemId}`, active: 'eq.true', limit: '1',
      });
      const catalogResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_items?${catalogQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const catalogRows = await catalogResponse.json().catch(() => null) as Array<{ provider_item_id: string }> | null;
      if (!catalogResponse.ok) { res.status(503).json({ error: 'Could not verify POS product' }); return; }
      if (!Array.isArray(catalogRows) || catalogRows.length !== 1) { res.status(404).json({ error: 'Active POS product not found in this branch' }); return; }

      // menu_items uses the existing camelCase ownerId tenant column. Verify ownership
      // before accepting a free-form menu item ID; never trust an ID supplied by the browser.
      const menuQuery = new URLSearchParams({
        select: 'id,isAiOnly', id: `eq.${menuItemId}`, ownerId: `eq.${auth.ownerId}`, limit: '1',
      });
      const menuResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/menu_items?${menuQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const menuRows = await menuResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!menuResponse.ok) { res.status(503).json({ error: 'Could not verify SooVoice menu item' }); return; }
      if (!Array.isArray(menuRows) || menuRows.length !== 1) { res.status(404).json({ error: 'SooVoice menu item not found for this merchant' }); return; }

      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_menu_links?on_conflict=connection_id,location_id,provider_item_id`, {
        method: 'POST',
        headers: {
          ...posServiceHeaders(auth.backend.serviceKey),
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
          owner_id: auth.ownerId,
          connection_id: locations[0].connection_id,
          location_id: locationId,
          provider_item_id: providerItemId,
          menu_item_id: menuItemId,
          field_overrides: fieldOverrides,
          approved_by: auth.ownerId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      const rows = await response.json().catch(() => null) as Array<Record<string, unknown>> | null;
      if (!response.ok || !Array.isArray(rows) || rows.length !== 1) {
        if (response.status === 409) { res.status(409).json({ error: 'This menu item is already linked to another POS product in this branch' }); return; }
        console.error('[API] POS catalog mapping save failed:', response.status);
        res.status(503).json({ error: 'Could not save POS menu mapping' }); return;
      }
      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        id: rows[0].id, location_id: rows[0].location_id,
        provider_item_id: rows[0].provider_item_id, menu_item_id: rows[0].menu_item_id,
        field_overrides: rows[0].field_overrides, approved_at: rows[0].approved_at,
      });
    } catch (err) {
      console.error('[API] POS catalog mapping save error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not save POS menu mapping' });
    }
  });


  // Apply only merchant-selected fields from the persisted POS snapshot.
  // The browser supplies IDs and a stable request ID, never proposed values.
  app.post('/api/pos/catalog/apply', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }

    const body = req.body || {};
    const locationId = typeof body.locationId === 'string' ? body.locationId : '';
    const providerItemId = typeof body.providerItemId === 'string' ? body.providerItemId.trim() : '';
    const menuItemId = typeof body.menuItemId === 'string' ? body.menuItemId.trim() : '';
    const requestId = typeof body.requestId === 'string' ? body.requestId : '';
    const selectedFields = body.selectedFields;
    const allowedFields = ['name', 'description', 'price'] as const;

    if (!isUuid(locationId) || !providerItemId || providerItemId.length > 160 ||
        !menuItemId || menuItemId.length > 128 || !isUuid(requestId) ||
        !Array.isArray(selectedFields) || selectedFields.length === 0 ||
        selectedFields.length > allowedFields.length ||
        selectedFields.some((field: unknown) => typeof field !== 'string' || !allowedFields.includes(field as typeof allowedFields[number])) ||
        new Set(selectedFields).size !== selectedFields.length) {
      res.status(400).json({ error: 'A valid location, POS product, menu item, request ID and explicit field selection are required' });
      return;
    }

    try {
      const locationQuery = new URLSearchParams({
        select: 'id,connection_id,currency', id: `eq.${locationId}`,
        owner_id: `eq.${auth.ownerId}`, active: 'eq.true', limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string; connection_id: string; currency: string | null }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(locations) || locations.length !== 1) { res.status(404).json({ error: 'Active POS location not found' }); return; }

      const catalogQuery = new URLSearchParams({
        select: 'provider_item_id,name,description,currency,unit_price,active',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`,
        provider_item_id: `eq.${providerItemId}`, active: 'eq.true', limit: '1',
      });
      const catalogResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_items?${catalogQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const catalogRows = await catalogResponse.json().catch(() => null) as Array<{
        provider_item_id: string; name: string; description: string | null;
        currency: string; unit_price: string | number; active: boolean;
      }> | null;
      if (!catalogResponse.ok) { res.status(503).json({ error: 'Could not verify stored POS product' }); return; }
      if (!Array.isArray(catalogRows) || catalogRows.length !== 1 || catalogRows[0].active !== true) {
        res.status(404).json({ error: 'Active POS product not found in this branch' }); return;
      }
      const catalog = catalogRows[0];

      const mappingQuery = new URLSearchParams({
        select: 'id,connection_id,provider_item_id,menu_item_id,field_overrides,approved_by,approved_at',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`,
        provider_item_id: `eq.${providerItemId}`, menu_item_id: `eq.${menuItemId}`, limit: '1',
      });
      const mappingResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_menu_links?${mappingQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const mappings = await mappingResponse.json().catch(() => null) as Array<{
        id: string; connection_id: string; provider_item_id: string; menu_item_id: string;
        field_overrides: Record<string, boolean>; approved_by: string; approved_at: string;
      }> | null;
      if (!mappingResponse.ok) { res.status(503).json({ error: 'Could not verify merchant-approved mapping' }); return; }
      if (!Array.isArray(mappings) || mappings.length !== 1 ||
          mappings[0].connection_id !== locations[0].connection_id ||
          mappings[0].approved_by !== auth.ownerId || !mappings[0].approved_at) {
        res.status(409).json({ error: 'An active merchant-approved POS mapping is required' }); return;
      }
      const mapping = mappings[0];
      const overrides = mapping.field_overrides || {};
      if (selectedFields.some((field: string) => overrides[field] === true)) {
        res.status(409).json({ error: 'One or more selected fields are protected by the merchant' }); return;
      }

      const menuQuery = new URLSearchParams({
        select: 'id,name,description,price,ownerId,isAiOnly',
        id: `eq.${menuItemId}`, ownerId: `eq.${auth.ownerId}`,
        or: '(isAiOnly.is.null,isAiOnly.eq.false)', limit: '1',
      });
      const menuResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/menu_items?${menuQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const menuRows = await menuResponse.json().catch(() => null) as Array<{
        id: string; name: string; description: string | null; price: string | number;
      }> | null;
      if (!menuResponse.ok) { res.status(503).json({ error: 'Could not verify SooVoice menu item' }); return; }
      if (!Array.isArray(menuRows) || menuRows.length !== 1) {
        res.status(404).json({ error: 'SooVoice menu item not found for this merchant' }); return;
      }
      const menu = menuRows[0];
      const expected: Record<string, string | number | null> = {};
      const patch: Record<string, string | number> = {};

      for (const field of selectedFields as Array<typeof allowedFields[number]>) {
        if (field === 'name') {
          if (typeof catalog.name !== 'string' || !catalog.name.trim() || catalog.name.length > 200) {
            res.status(409).json({ error: 'Stored POS product name is not eligible for menu apply' }); return;
          }
          expected.name = menu.name;
          patch.name = catalog.name.trim();
        } else if (field === 'description') {
          const proposed = catalog.description ?? '';
          if (typeof proposed !== 'string' || proposed.length > 4000) {
            res.status(409).json({ error: 'Stored POS product description is not eligible for menu apply' }); return;
          }
          expected.description = menu.description;
          patch.description = proposed;
        } else if (field === 'price') {
          const locationCurrency = typeof locations[0].currency === 'string' ? locations[0].currency.toUpperCase() : '';
          const catalogCurrency = typeof catalog.currency === 'string' ? catalog.currency.toUpperCase() : '';
          const proposedPrice = Number(catalog.unit_price);
          const currentPrice = Number(menu.price);
          if (!locationCurrency || !catalogCurrency || locationCurrency !== catalogCurrency ||
              !Number.isFinite(proposedPrice) || proposedPrice < 0 || proposedPrice > 1_000_000 ||
              !Number.isFinite(currentPrice)) {
            res.status(409).json({ error: 'POS and SooVoice branch currencies must match before applying price' }); return;
          }
          expected.price = currentPrice;
          patch.price = proposedPrice;
        }
      }

      if (Object.keys(patch).some(field => patch[field] === expected[field])) {
        res.status(409).json({ error: 'Selected fields contain no changes; refresh the catalog review' }); return;
      }

      const rpcResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/rpc/apply_pos_catalog_menu_fields`, {
        method: 'POST',
        headers: { ...posServiceHeaders(auth.backend.serviceKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_owner_id: auth.ownerId,
          p_actor_id: auth.ownerId,
          p_location_id: locationId,
          p_provider_item_id: providerItemId,
          p_menu_item_id: menuItemId,
          p_request_id: requestId,
          p_selected_fields: selectedFields,
          p_expected: expected,
          p_patch: patch,
        }),
      });
      const result = await rpcResponse.json().catch(() => null);
      if (!rpcResponse.ok) {
        if (rpcResponse.status === 400) { res.status(400).json({ error: 'Invalid POS menu apply request' }); return; }
        if (rpcResponse.status === 409 || rpcResponse.status === 412) {
          res.status(409).json({ error: 'The menu or mapping changed; refresh the review before applying again' }); return;
        }
        console.error('[API] POS menu apply RPC failed:', rpcResponse.status);
        res.status(503).json({ error: 'Could not apply POS menu changes' }); return;
      }
      res.set('Cache-Control', 'no-store');
      res.json(result);
    } catch (err) {
      console.error('[API] POS menu apply error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not apply POS menu changes' });
    }
  });

  app.get('/api/pos/catalog/apply-events/:locationId?', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    const locationId = typeof req.params.locationId === 'string' ? req.params.locationId : typeof req.query.locationId === 'string' ? req.query.locationId : '';
    if (!isUuid(locationId)) { res.status(400).json({ error: 'A valid POS location ID is required' }); return; }
    try {
      const locationQuery = new URLSearchParams({
        select: 'id', id: `eq.${locationId}`, owner_id: `eq.${auth.ownerId}`, limit: '1',
      });
      const locationResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const locations = await locationResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!locationResponse.ok) { res.status(503).json({ error: 'Could not verify POS location' }); return; }
      if (!Array.isArray(locations) || locations.length !== 1) { res.status(404).json({ error: 'POS location not found' }); return; }
      const query = new URLSearchParams({
        select: 'id,mapping_id,provider_item_id,menu_item_id,actor_id,selected_fields,before_state,after_state,request_id,created_at',
        owner_id: `eq.${auth.ownerId}`, location_id: `eq.${locationId}`,
        order: 'created_at.desc', limit: '200',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_catalog_menu_apply_events?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) { res.status(503).json({ error: 'POS menu apply history is temporarily unavailable' }); return; }
      const rows = await response.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS menu apply history error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS menu apply history is temporarily unavailable' });
    }
  });

  // ============ MERCHANT POS ORDER ROUTING ============
  // Routing rules are edited only through verified merchant sessions. The
  // database RPC rechecks connection/location ownership and active state.
  app.get('/api/pos/order-routes', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,connection_id,location_id,route_type,route_value,created_at,updated_at',
        owner_id: `eq.${auth.ownerId}`,
        order: 'route_type.asc,route_value.asc',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_order_routes?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const rows = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(rows)) {
        res.status(503).json({ error: 'POS order routes are temporarily unavailable' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json(rows);
    } catch (error) {
      console.error('[API] POS order route list failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'POS order routes are temporarily unavailable' });
    }
  });

  app.post('/api/pos/order-routes', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const body = req.body || {};
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId : '';
    const locationId = typeof body.locationId === 'string' ? body.locationId : '';
    const routeType = body.routeType;
    const routeValue = body.routeValue;
    if (!isUuid(connectionId) || !isUuid(locationId) ||
        !['default', 'table'].includes(routeType) ||
        (routeType === 'default' && routeValue != null) ||
        (routeType === 'table' && (typeof routeValue !== 'string' ||
          routeValue.trim().length < 1 || routeValue.trim().length > 40 ||
          !/^[A-Za-z0-9][A-Za-z0-9 _./-]*$/.test(routeValue.trim())))) {
      res.status(400).json({ error: 'A valid route type, connection, branch, and optional table reference are required' });
      return;
    }
    try {
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/rpc/save_pos_order_route`, {
        method: 'POST',
        headers: posServiceHeaders(auth.backend.serviceKey),
        body: JSON.stringify({
          p_owner_id: auth.ownerId,
          p_connection_id: connectionId,
          p_location_id: locationId,
          p_route_type: routeType,
          p_route_value: routeType === 'table' ? routeValue.trim().toUpperCase() : null,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== 'object') {
        const code = typeof result?.message === 'string' ? result.message : '';
        if (code.includes('NOT_CONNECTED') || code.includes('NOT_ACTIVE_OR_NOT_OWNED')) {
          res.status(409).json({ error: 'The selected POS connection or branch is not active and connected' });
          return;
        }
        console.error('[API] POS order route save failed:', response.status, code);
        res.status(503).json({ error: 'Could not save POS order route' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.status(201).json(result);
    } catch (error) {
      console.error('[API] POS order route save failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Could not save POS order route' });
    }
  });

  app.delete('/api/pos/order-routes/:routeId', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const routeId = req.params.routeId;
    if (!isUuid(routeId)) {
      res.status(400).json({ error: 'A valid route ID is required' });
      return;
    }
    try {
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/rpc/delete_pos_order_route`, {
        method: 'POST',
        headers: posServiceHeaders(auth.backend.serviceKey),
        body: JSON.stringify({ p_owner_id: auth.ownerId, p_route_id: routeId }),
      });
      const deleted = await response.json().catch(() => false);
      if (!response.ok) {
        res.status(503).json({ error: 'Could not delete POS order route' });
        return;
      }
      if (deleted !== true) {
        res.status(404).json({ error: 'POS order route not found' });
        return;
      }
      res.status(200).json({ id: routeId, deleted: true });
    } catch (error) {
      console.error('[API] POS order route delete failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Could not delete POS order route' });
    }
  });

  // ============ POS LOCATION / BRANCH MANAGEMENT ============
  // Branch records are manually mapped until provider discovery adapters exist.
  app.get('/api/pos/locations', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,connection_id,provider_location_id,name,timezone,currency,active,created_at',
        owner_id: `eq.${auth.ownerId}`,
        order: 'created_at.desc',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${query}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      if (!response.ok) {
        console.error('[API] POS location list failed:', response.status);
        res.status(503).json({ error: 'POS locations are temporarily unavailable' });
        return;
      }
      const rows = await response.json();
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[API] POS location list error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'POS locations are temporarily unavailable' });
    }
  });

  app.post('/api/pos/locations', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const parsedLocation = parsePosLocationInput(req.body);
    if (parsedLocation.ok === false) {
      res.status(400).json({ error: parsedLocation.error });
      return;
    }
    const { connectionId, providerLocationId, name, timezone, currency } = parsedLocation.value;
    try {
      const ownerQuery = new URLSearchParams({
        select: 'id',
        id: `eq.${connectionId}`,
        owner_id: `eq.${auth.ownerId}`,
        limit: '1',
      });
      const ownerResponse = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_connections?${ownerQuery}`, {
        headers: posServiceHeaders(auth.backend.serviceKey),
      });
      const ownedConnections = await ownerResponse.json().catch(() => null) as Array<{ id: string }> | null;
      if (!ownerResponse.ok) {
        res.status(503).json({ error: 'Could not verify POS connection ownership' });
        return;
      }
      if (!Array.isArray(ownedConnections) || ownedConnections.length !== 1) {
        res.status(404).json({ error: 'POS connection not found' });
        return;
      }
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations`, {
        method: 'POST',
        headers: { ...posServiceHeaders(auth.backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify({
          owner_id: auth.ownerId,
          connection_id: connectionId,
          provider_location_id: providerLocationId,
          name,
          timezone: timezone || null,
          currency: currency || null,
          active: true,
        }),
      });
      const rows = await response.json().catch(() => null) as Array<Record<string, unknown>> | null;
      if (!response.ok || !Array.isArray(rows) || rows.length !== 1) {
        // A duplicate provider location is a conflict; other DB failures remain unavailable.
        if (response.status === 409) {
          res.status(409).json({ error: 'This provider location is already mapped to this connection' });
          return;
        }
        console.error('[API] POS location create failed:', response.status);
        res.status(503).json({ error: 'Could not save POS location' });
        return;
      }
      const row = rows[0];
      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        id: row.id, connection_id: row.connection_id,
        provider_location_id: row.provider_location_id, name: row.name,
        timezone: row.timezone, currency: row.currency, active: row.active,
        created_at: row.created_at,
      });
    } catch (err) {
      console.error('[API] POS location create error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not save POS location' });
    }
  });

  app.patch('/api/pos/locations/:locationId', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    const locationId = req.params.locationId;
    if (!isUuid(locationId) || req.body?.active !== false) {
      res.status(400).json({ error: 'A valid location ID and active=false are required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        id: `eq.${locationId}`,
        owner_id: `eq.${auth.ownerId}`,
        active: 'eq.true',
      });
      const response = await fetch(`${auth.backend.supabaseUrl}/rest/v1/pos_locations?${query}`, {
        method: 'PATCH',
        headers: { ...posServiceHeaders(auth.backend.serviceKey), Prefer: 'return=representation' },
        body: JSON.stringify({ active: false }),
      });
      if (!response.ok) {
        console.error('[API] POS location deactivate failed:', response.status);
        res.status(503).json({ error: 'Could not deactivate POS location' });
        return;
      }
      const rows = await response.json().catch(() => []);
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(404).json({ error: 'Active POS location not found' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json({ id: rows[0].id, active: false });
    } catch (err) {
      console.error('[API] POS location deactivate error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Could not deactivate POS location' });
    }
  });

  // ============ DURABLE POS ORDER OUTBOX DISPATCH ============
  // Called by a trusted scheduler/worker using a dedicated bearer secret.
  // No browser session or merchant-supplied owner ID is accepted here.
  const dispatchPosOutbox = async (req: express.Request, res: express.Response) => {
    const workerSecret = process.env.POS_OUTBOX_WORKER_SECRET || '';
    const authorization = firstHeader(req.headers.authorization) || '';
    const suppliedSecret = /^Bearer\s+(.+)$/i.exec(authorization)?.[1] || '';
    if (workerSecret.length < 32) {
      res.status(503).json({ error: 'POS outbox worker is not configured' });
      return;
    }
    if (!suppliedSecret || !safeEqual(suppliedSecret, workerSecret)) {
      res.status(401).json({ error: 'Unauthorized POS outbox worker' });
      return;
    }
    const backend = getPosBackend();
    if (!backend) {
      res.status(503).json({ error: 'POS outbox backend is not configured' });
      return;
    }

    const store = new SupabaseOutboxStore(backend.supabaseUrl, backend.serviceKey);
    const resolveTarget = async (event: OrderOutboxEvent): Promise<PosDispatchTarget> => {
      const routeQuery = new URLSearchParams({
        select: 'id,connection_id,location_id,route_type,route_value',
        owner_id: `eq.${event.owner_id}`,
      });
      const routeResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_order_routes?${routeQuery}`, {
        headers: posServiceHeaders(backend.serviceKey),
      });
      const routeRows = await routeResponse.json().catch(() => null) as Array<{
        id: string; connection_id: string; location_id: string;
        route_type: 'default' | 'table'; route_value: string | null;
      }> | null;
      if (!routeResponse.ok || !Array.isArray(routeRows)) throw new Error('POS_ORDER_ROUTE_LOOKUP_FAILED');
      const tableReference = typeof event.payload.tableNumber === 'string'
        ? event.payload.tableNumber : '';
      const route = selectPosOrderRoute(routeRows, tableReference);

      const connectionQuery = new URLSearchParams({
        select: 'id,provider,credentials_ciphertext,credentials_key_version,outbound_orders_enabled',
        id: `eq.${route.connection_id}`,
        owner_id: `eq.${event.owner_id}`,
        status: 'eq.connected',
        limit: '1',
      });
      const connectionResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_connections?${connectionQuery}`, {
        headers: posServiceHeaders(backend.serviceKey),
      });
      type PosConnectionRow = {
        id: string; provider: string; credentials_ciphertext: string | null;
        credentials_key_version: string | null; outbound_orders_enabled: boolean;
      };
      const connectionRows = await connectionResponse.json().catch(() => null) as PosConnectionRow[] | null;
      if (!connectionResponse.ok || !Array.isArray(connectionRows)) throw new Error('POS_CONNECTION_LOOKUP_FAILED');
      if (connectionRows.length !== 1) throw new Error('POS_ROUTE_CONNECTION_NOT_CONNECTED');
      const selected = connectionRows[0];
      if (selected.outbound_orders_enabled !== true) throw new Error('POS_OUTBOUND_NOT_ENABLED');
      if (!selected.credentials_ciphertext || !selected.credentials_key_version) {
        throw new Error('POS_CREDENTIALS_UNAVAILABLE');
      }
      let credentials: Record<string, unknown>;
      try {
        credentials = decryptPosCredentials(selected.credentials_ciphertext, selected.credentials_key_version);
      } catch {
        throw new Error('POS_CREDENTIALS_UNAVAILABLE');
      }
      if (typeof credentials.orderWebhookUrl !== 'string' ||
          typeof credentials.orderWebhookSecret !== 'string' ||
          credentials.orderWebhookSecret.length < 32) {
        throw new Error('POS_ORDER_TARGET_NOT_CONFIGURED');
      }
      if (!posProviders.has(selected.provider)) throw new Error('POS_PROVIDER_UNSUPPORTED');

      const locationQuery = new URLSearchParams({
        select: 'id,currency,provider_location_id',
        id: `eq.${route.location_id}`,
        owner_id: `eq.${event.owner_id}`,
        connection_id: `eq.${selected.id}`,
        active: 'eq.true',
        limit: '1',
      });
      const locationResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_locations?${locationQuery}`, {
        headers: posServiceHeaders(backend.serviceKey),
      });
      const locationRows = await locationResponse.json().catch(() => null) as Array<{
        id: string; currency: string | null; provider_location_id: string;
      }> | null;
      if (!locationResponse.ok || !Array.isArray(locationRows)) throw new Error('POS_LOCATION_LOOKUP_FAILED');
      if (locationRows.length !== 1) throw new Error('POS_ROUTE_LOCATION_NOT_ACTIVE');
      const location = locationRows[0];

      const rawItems = event.payload.items;
      if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) {
        throw new Error('POS_ORDER_ITEMS_INVALID');
      }
      const mappings = new Map<string, string>();
      let orderCurrency = location.currency?.toUpperCase() || '';
      for (const rawItem of rawItems) {
        const line = rawItem as Record<string, unknown>;
        const menuItemId = typeof line.id === 'string' ? line.id : '';
        if (!menuItemId || menuItemId.length > 128) throw new Error('POS_ORDER_ITEM_ID_INVALID');

        const mappingQuery = new URLSearchParams({
          select: 'provider_item_id,menu_item_id',
          owner_id: `eq.${event.owner_id}`,
          connection_id: `eq.${selected.id}`,
          location_id: `eq.${location.id}`,
          menu_item_id: `eq.${menuItemId}`,
          limit: '1',
        });
        const mappingResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_catalog_menu_links?${mappingQuery}`, {
          headers: posServiceHeaders(backend.serviceKey),
        });
        const mappingRows = await mappingResponse.json().catch(() => null) as Array<{
          provider_item_id: string; menu_item_id: string;
        }> | null;
        if (!mappingResponse.ok || !Array.isArray(mappingRows)) throw new Error('POS_MENU_MAPPING_LOOKUP_FAILED');
        if (mappingRows.length !== 1) throw new Error('POS_MENU_ITEM_NOT_MAPPED');

        const catalogQuery = new URLSearchParams({
          select: 'provider_item_id,currency,active,available',
          owner_id: `eq.${event.owner_id}`,
          connection_id: `eq.${selected.id}`,
          location_id: `eq.${location.id}`,
          provider_item_id: `eq.${mappingRows[0].provider_item_id}`,
          active: 'eq.true',
          available: 'eq.true',
          limit: '1',
        });
        const catalogResponse = await fetch(`${backend.supabaseUrl}/rest/v1/pos_catalog_items?${catalogQuery}`, {
          headers: posServiceHeaders(backend.serviceKey),
        });
        const catalogRows = await catalogResponse.json().catch(() => null) as Array<{
          provider_item_id: string; currency: string; active: boolean; available: boolean;
        }> | null;
        if (!catalogResponse.ok || !Array.isArray(catalogRows)) throw new Error('POS_CATALOG_LOOKUP_FAILED');
        if (catalogRows.length !== 1 || !catalogRows[0].active || !catalogRows[0].available) {
          throw new Error('POS_CATALOG_ITEM_UNAVAILABLE');
        }
        const itemCurrency = catalogRows[0].currency.toUpperCase();
        if (orderCurrency && orderCurrency !== itemCurrency) throw new Error('POS_ORDER_CURRENCY_MISMATCH');
        orderCurrency = itemCurrency;
        mappings.set(menuItemId, mappingRows[0].provider_item_id);
      }
      if (!/^[A-Z]{3}$/.test(orderCurrency)) throw new Error('POS_LOCATION_CURRENCY_REQUIRED');

      const context = {
        merchantId: event.owner_id,
        connectionId: selected.id,
        locationId: location.id,
      };
      return {
        provider: selected.provider as PosProviderId,
        context,
        orderCurrency,
        menuMappings: mappings,
        providerLocationId: location.provider_location_id,
        async createOrder(input: PosCreateOrderInput) {
          return sendCustomPosOrderWebhook({
            orderWebhookUrl: credentials.orderWebhookUrl as string,
            orderWebhookSecret: credentials.orderWebhookSecret as string,
          }, input);
        },
      } as PosDispatchTarget;
    };

    try {
      const result = await processOrderOutboxBatch(
        store,
        `soovoice-${crypto.randomUUID()}`,
        resolveTarget,
        (event, target) => {
          const runtimeTarget = target as PosDispatchTarget & {
            orderCurrency: string; menuMappings: Map<string, string>; providerLocationId: string;
          };
          const rawItems = event.payload.items as Array<Record<string, unknown>>;
          const lines = rawItems.map(line => {
            const menuItemId = String(line.id || '');
            const providerItemId = runtimeTarget.menuMappings.get(menuItemId);
            const quantity = Number(line.quantity);
            if (!providerItemId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
              throw new Error('POS_ORDER_LINE_INVALID_OR_UNMAPPED');
            }
            return {
              catalogItemId: menuItemId,
              providerItemId,
              quantity,
              modifierOptionIds: [],
            };
          });
          const tableNumber = typeof event.payload.tableNumber === 'string'
            ? event.payload.tableNumber.slice(0, 24) : '';
          return {
            merchantId: event.owner_id,
            locationId: runtimeTarget.providerLocationId,
            localOrderId: event.order_id,
            idempotencyKey: `soovoice:${event.order_id}`,
            currency: runtimeTarget.orderCurrency,
            lines,
            fulfillment: 'dine_in',
            tableReference: tableNumber || undefined,
            notes: typeof event.payload.notes === 'string' ? event.payload.notes.slice(0, 1000) : undefined,
          };
        },
        { limit: 10, leaseSeconds: 120 },
      );
      res.set('Cache-Control', 'no-store');
      res.status(200).json(result);
    } catch (error) {
      console.error('[API] POS outbox dispatch failed:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'POS outbox dispatch is temporarily unavailable' });
    }
  };
  app.post('/api/pos/outbox/dispatch', dispatchPosOutbox);
  app.get('/api/pos/outbox/dispatch', dispatchPosOutbox);

  // ============ TRUSTED GUEST ORDER FLOW ============
  // Browser clients submit catalog IDs and quantities only. The database
  // function reloads prices and atomically writes the order + outbox event.
  const orderRateLimit = rateLimit(60_000, 20);
  const getOrderBackend = () => {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const tokenSecret = process.env.ORDER_TOKEN_SECRET || '';
    if (!supabaseUrl || !serviceKey || tokenSecret.length < 32) return null;
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return null;
    } catch {
      return null;
    }
    return { supabaseUrl, serviceKey, tokenSecret };
  };

  const sha256Hex = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
  const orderHeaders = (serviceKey: string) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  });

  app.post('/api/store/orders', orderRateLimit, async (req, res) => {
    const backend = getOrderBackend();
    if (!backend) {
      res.status(503).json({ error: 'Secure order service is not configured' });
      return;
    }

    const body = req.body || {};
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
    const tableNumberRaw = typeof body.tableNumber === 'string' ? body.tableNumber : '';
    const tableNumber = tableNumberRaw.replace(/[٠-٩]/g, (d: string) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d: string) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 24);
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    const inputItems = body.items;
    const orderNotes = typeof body.notes === 'string' ? body.notes.trim() : '';
    if ((body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 1000)) ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(ownerId) ||
        !/^[0-9a-f-]{36}$/i.test(idempotencyKey) ||
        !tableNumber || !Array.isArray(inputItems) || inputItems.length < 1 || inputItems.length > 50) {
      res.status(400).json({ error: 'Invalid order request' });
      return;
    }

    const seen = new Set<string>();
    const items: Array<{ id: string; quantity: number }> = [];
    for (const line of inputItems) {
      const id = typeof line?.id === 'string' ? line.id.trim() : '';
      const quantity = Number(line?.quantity);
      if (!id || id.length > 128 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || seen.has(id)) {
        res.status(400).json({ error: 'Invalid order item or quantity' });
        return;
      }
      seen.add(id);
      items.push({ id, quantity });
    }
    items.sort((a, b) => a.id.localeCompare(b.id));

    // Durable owner + per-client limits are shared across serverless instances.
    // The client bucket is an HMAC; raw IP addresses never enter the database.
    const forwardedFor = firstHeader(req.headers['x-forwarded-for']);
    const clientIp = forwardedFor?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const ownerBucket = 'owner:' + crypto.createHmac('sha256', backend.tokenSecret)
      .update('guest-order-owner:v1:' + ownerId).digest('hex');
    const clientBucket = 'client:' + crypto.createHmac('sha256', backend.tokenSecret)
      .update('guest-order-client:v1:' + ownerId + ':' + clientIp).digest('hex');
    try {
      const limitResponse = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/consume_guest_order_rate_limit`, {
        method: 'POST',
        headers: orderHeaders(backend.serviceKey),
        body: JSON.stringify({
          p_owner_bucket: ownerBucket,
          p_client_bucket: clientBucket,
          p_window_seconds: 60,
          p_owner_limit: 120,
          p_client_limit: 20,
        }),
      });
      const allowed = limitResponse.ok ? await limitResponse.json().catch(() => null) : null;
      if (!limitResponse.ok || typeof allowed !== 'boolean') {
        console.error('[API] Guest order rate-limit RPC unavailable:', limitResponse.status);
        res.status(503).json({ error: 'Order protection is temporarily unavailable' });
        return;
      }
      if (!allowed) {
        res.set('Retry-After', '60');
        res.status(429).json({ error: 'Too many orders. Please wait before trying again.' });
        return;
      }
    } catch (error) {
      console.error('[API] Guest order rate-limit error:', error instanceof Error ? error.message : 'unknown');
      res.status(503).json({ error: 'Order protection is temporarily unavailable' });
      return;
    }

    // Deterministic per-order capability lets a safe retry reuse the same
    // guest token without storing or returning a plaintext token from SQL.
    const guestToken = crypto.createHmac('sha256', backend.tokenSecret)
      .update(`soovoice-guest-order:v1:${ownerId}:${idempotencyKey}`)
      .digest('base64url');
    const guestTokenHash = sha256Hex(guestToken);
    const requestHash = sha256Hex(JSON.stringify({ ownerId, tableNumber, items, notes: orderNotes }));

    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/create_guest_order`, {
        method: 'POST',
        headers: orderHeaders(backend.serviceKey),
        body: JSON.stringify({
          p_owner_id: ownerId,
          p_table_number: tableNumber,
          p_items: items,
          p_order_notes: orderNotes,
          p_idempotency_key: idempotencyKey,
          p_guest_token_hash: guestTokenHash,
          p_request_hash: requestHash,
        }),
      });
      const result = await response.json().catch(() => null) as any;
      if (!response.ok || !result?.orderId || !Array.isArray(result.items)) {
        const dbMessage = String(result?.message || result?.details || result?.hint || '');
        if (dbMessage.includes('ITEM_UNAVAILABLE')) {
          res.status(409).json({ error: 'One or more items are no longer available' });
          return;
        }
        if (dbMessage.includes('IDEMPOTENCY_CONFLICT')) {
          res.status(409).json({ error: 'This checkout key was already used for a different cart' });
          return;
        }
        if (dbMessage.includes('INVALID_')) {
          res.status(400).json({ error: 'Order validation failed' });
          return;
        }
        console.error('[API] Secure guest order RPC failed:', response.status, dbMessage.slice(0, 240));
        res.status(response.status >= 500 ? 503 : 400).json({ error: 'Could not place this order' });
        return;
      }

      res.set('Cache-Control', 'no-store');
      res.status(201).json({
        orderId: result.orderId,
        guestToken,
        items: result.items,
        total: Number(result.total),
        tableNumber: result.tableNumber,
        createdAt: Number(result.createdAt),
        notes: typeof result.notes === 'string' ? result.notes : orderNotes,
        replayed: Boolean(result.replayed),
      });
    } catch (err) {
      console.error('[API] Secure guest order error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Order service temporarily unavailable' });
    }
  });

  app.get('/api/store/orders/:orderId', orderRateLimit, async (req, res) => {
    const backend = getOrderBackend();
    if (!backend) {
      res.status(503).json({ error: 'Secure order service is not configured' });
      return;
    }
    const orderId = String(req.params.orderId || '');
    const token = firstHeader(req.headers['x-order-token']) || '';
    if (!/^order_[a-f0-9-]{16,64}$/i.test(orderId) || token.length < 32 || token.length > 256) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,status,items,total,tableNumber,createdAt',
        id: `eq.${orderId}`,
        guest_token_hash: `eq.${sha256Hex(token)}`,
        guest_token_expires_at: `gt.${new Date().toISOString()}`,
        limit: '1',
      });
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/orders?${query.toString()}`, {
        headers: orderHeaders(backend.serviceKey),
      });
      if (!response.ok) {
        console.error('[API] Guest order tracking query failed:', response.status);
        res.status(503).json({ error: 'Order tracking temporarily unavailable' });
        return;
      }
      const rows = await response.json() as any[];
      if (!Array.isArray(rows) || rows.length !== 1) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json({
        orderId: rows[0].id,
        status: rows[0].status,
        items: rows[0].items,
        total: Number(rows[0].total),
        tableNumber: rows[0].tableNumber,
        createdAt: Number(rows[0].createdAt),
      });
    } catch (err) {
      console.error('[API] Guest order tracking error:', err instanceof Error ? err.message : 'unknown');
      res.status(503).json({ error: 'Order tracking temporarily unavailable' });
    }
  });

  // ============ HEALTH ============
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ============ EPHEMERAL GEMINI TOKEN (voice widget) ============
  /**
   * Mints a short-lived Gemini Live "ephemeral auth token" so browsers never
   * see the real GEMINI_API_KEY. The client uses `token.name` as its apiKey
   * together with httpOptions.apiVersion = 'v1alpha' when opening the session.
   */
  app.post('/api/gemini-session', rateLimit(60_000, 30), async (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Voice service not configured: GEMINI_API_KEY is missing server-side',
      });
      return;
    }
    try {
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const token: any = await client.authTokens.create({
        config: { expireTime, newSessionExpireTime },
      });
      if (!token?.name) throw new Error('Token endpoint returned no token');
      res.set('Cache-Control', 'no-store');
      res.json({ token: token.name, expireTime, newSessionExpireTime });
    } catch (err) {
      console.error(
        '[API] Gemini ephemeral token error:',
        err instanceof Error ? err.message : err,
      );
      res.status(502).json({ error: 'Failed to create voice session token' });
    }
  });

  // ============ VOICE PREVIEW (TTS) ============
  /**
   * Generates a short audio sample of a given text in a given prebuilt voice
   * using Gemini's text-to-speech via generateContent with AUDIO modality.
   * Used by the Voice Studio page for A/B voice comparison before the owner
   * publishes a voice persona.
   *
   * Request:  POST /api/voice-preview
   * Body:     { text: string (<=280 chars), voice: string }
   * Response: { audio: string (base64 PCM, mime: 'audio/ogg; codecs=opus' or 'audio/L16') }
   */
  app.post('/api/voice-preview', rateLimit(60_000, 20), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'Voice service not configured: GEMINI_API_KEY is missing server-side' });
      return;
    }
    const text = String((req.body as any)?.text || '').trim().slice(0, 280);
    const voice = String((req.body as any)?.voice || '').trim();
    if (!text || !voice) {
      res.status(400).json({ error: 'Both `text` and `voice` are required' });
      return;
    }

    try {
      const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
      const response: any = await client.models.generateContent({
        model: 'gemini-3.1-flash-live-preview',
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      });

      const candidate = response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      let inline: any = null;
      for (const p of parts) {
        if (p?.inlineData?.data) {
          inline = p.inlineData;
          break;
        }
      }
      if (!inline?.data) {
        res.status(502).json({ error: 'No audio data returned from Gemini' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json({ audio: inline.data, mime: inline.mimeType || 'audio/L16' });
    } catch (err) {
      console.error('[API] voice-preview error:', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'Failed to generate preview' });
    }
  });

  // ============ ANALYTICS ============
  app.get('/api/analytics/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { range } = req.query;
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      void ownerId;
      void since;

      // Never return fabricated success-shaped data. Until the tenant-scoped
      // analytics repository is configured, make the missing capability explicit.
      return res.status(501).json({ error: 'Analytics storage is not implemented yet' });
    } catch (err) {
      console.error('[API] Analytics error:', err);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // ============ CONVERSATIONS ============
  app.get('/api/conversations/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { status, limit } = req.query;
      void ownerId;
      const maxLimit = Math.min(parseInt(String(limit)) || 50, 200);

      void status;
      void maxLimit;
      return res.status(501).json({ error: 'Conversation storage is not implemented yet' });
    } catch (err) {
      console.error('[API] Conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ============ ORDERS ============
  app.get('/api/orders/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      void ownerId;
      return res.status(501).json({ error: 'Order storage is not implemented yet' });
    } catch (err) {
      console.error('[API] Orders error:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.patch('/api/orders/:orderId/status', requireApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      if (!['pending', 'preparing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      void orderId;
      return res.status(501).json({ error: 'Order status persistence is not implemented yet' });
    } catch (err) {
      console.error('[API] Order status update error:', err);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  app.delete('/api/orders/:orderId', requireApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      void orderId;
      return res.status(501).json({ error: 'Order deletion is not implemented yet' });
    } catch (err) {
      console.error('[API] Order delete error:', err);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // ============ WEBHOOK SETTINGS ============
  app.get('/api/webhook-settings/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      void ownerId;
      return res.status(501).json({ error: 'Webhook settings storage is not implemented yet' });
    } catch (err) {
      console.error('[API] Webhook settings error:', err);
      res.status(500).json({ error: 'Failed to fetch webhook settings' });
    }
  });

  // ============ OAUTH ============
  app.get('/api/oauth/callback', (req, res) => {
    const { shop, platform } = req.query;
    // NOTE: never log the authorization `code` — it is a bearer credential.
    console.log(`[OAuth] Callback received for ${platform || 'unknown'} / shop ${shop || 'unknown'}`);
    return res.status(501).json({
      error: 'OAuth token exchange is not configured. No account was connected.',
    });
  });

  // ============ WEBHOOKS (all signature-verified) ============
  app.post('/api/webhooks/app/uninstalled', verifyWebhookSignature, (req, res) => {
    console.warn('[Webhook] app/uninstalled received but durable processing is not configured');
    res.status(503).json({ error: 'Webhook processing is temporarily unavailable; retry later' });
  });

  app.post('/api/webhooks/products/updated', verifyWebhookSignature, (req, res) => {
    console.warn('[Webhook] products/updated received but durable processing is not configured');
    res.status(503).json({ error: 'Webhook processing is temporarily unavailable; retry later' });
  });

  app.post('/api/webhooks/orders/created', verifyWebhookSignature, (req, res) => {
    console.warn('[Webhook] orders/created received but durable processing is not configured');
    res.status(503).json({ error: 'Webhook processing is temporarily unavailable; retry later' });
  });

  // ============ USERS ============
  app.get('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      void uid;
      void uid;
      return res.status(501).json({ error: 'User repository is not implemented yet' });
    } catch (err) {
      console.error('[API] User fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.patch('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      const { displayName, plan } = req.body;
      const updates: any = {};
      if (displayName) updates.displayName = displayName;
      if (plan && ['free', 'pro', 'enterprise'].includes(plan)) updates.plan = plan;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      void uid;
      void updates;
      return res.status(501).json({ error: 'User persistence is not implemented yet' });
    } catch (err) {
      console.error('[API] User update error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Explicit API terminator: any unmatched /api route (including wrong HTTP
  // methods on registered paths) returns a JSON 404 instead of falling through
  // to the SPA static fallback.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
