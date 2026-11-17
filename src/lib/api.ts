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
import { encryptPosCredentials } from './pos/credentials';
import { isUuid, parsePosLocationInput } from './pos/location-validation';

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

  app.get('/api/pos/connections', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) {
      res.status(401).json({ error: 'A valid merchant session is required' });
      return;
    }
    try {
      const query = new URLSearchParams({
        select: 'id,provider,display_name,status,granted_scopes,last_sync_at,last_error_code,created_at,updated_at',
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
      // Explicit allowlist: credential ciphertext is never returned to clients.
      res.set('Cache-Control', 'no-store');
      res.json(Array.isArray(rows) ? rows : []);
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
  // Returns only merchant-owned public menu rows eligible for an explicit POS mapping.
  app.get('/api/pos/menu-items', posConnectionRateLimit, async (req, res) => {
    const auth = await authenticatePosMerchant(req);
    if (!auth) { res.status(401).json({ error: 'A valid merchant session is required' }); return; }
    try {
      const query = new URLSearchParams({
        select: 'id,name,description,price',
        ownerId: `eq.${auth.ownerId}`,
        or: '(isAiOnly.is.null,isAiOnly.eq.false)',
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
        select: 'id', id: `eq.${menuItemId}`, ownerId: `eq.${auth.ownerId}`, or: '(isAiOnly.is.null,isAiOnly.eq.false)', limit: '1',
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
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(ownerId) ||
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

    // Deterministic per-order capability lets a safe retry reuse the same
    // guest token without storing or returning a plaintext token from SQL.
    const guestToken = crypto.createHmac('sha256', backend.tokenSecret)
      .update(`soovoice-guest-order:v1:${ownerId}:${idempotencyKey}`)
      .digest('base64url');
    const guestTokenHash = sha256Hex(guestToken);
    const requestHash = sha256Hex(JSON.stringify({ ownerId, tableNumber, items }));

    try {
      const response = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/create_guest_order`, {
        method: 'POST',
        headers: orderHeaders(backend.serviceKey),
        body: JSON.stringify({
          p_owner_id: ownerId,
          p_table_number: tableNumber,
          p_items: items,
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
