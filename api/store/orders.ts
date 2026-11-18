/**
 * Vercel serverless function — /api/store/orders (POST)
 *
 * Trusted guest checkout. The browser sends only item IDs + quantities
 * (never names or prices). This server uses the Supabase service-role key
 * to call the `create_guest_order` RPC, which re-reads prices from
 * menu_items and atomically creates the order + outbox event in one
 * transaction. It also derives a per-order capability token (HMAC of the
 * owner + idempotency key) and stores only its SHA-256 hash.
 *
 * Standalone (no Express) for clean bundling on the Vercel Node runtime
 * — Express v4 is CommonJS but the project is ESM, which crashes the
 * catch-all function. See api/gemini-session.ts for the same pattern.
 */

import { createHash, createHmac } from 'node:crypto';

export const config = {
  maxDuration: 25,
};

interface OrderItemInput {
  id: string;
  quantity: number;
}

interface RequestBody {
  ownerId?: string;
  tableNumber?: string;
  idempotencyKey?: string;
  items?: OrderItemInput[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[0-9a-f-]{36}$/i;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacBase64Url(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // --- Validate environment ---
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const tokenSecret = process.env.ORDER_TOKEN_SECRET || '';
  if (!supabaseUrl || !serviceKey || tokenSecret.length < 32) {
    res.statusCode = 503;
    res.end(JSON.stringify({
      error: 'Secure order service is not configured',
      hint: 'Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ORDER_TOKEN_SECRET (32+ chars) in Vercel env vars.',
    }));
    return;
  }

  // --- Validate request body ---
  const body: RequestBody = req.body || {};
  const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
  const tableNumberRaw = typeof body.tableNumber === 'string' ? body.tableNumber : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
  const inputItems = body.items;

  // Normalize Arabic-Indic + Persian digits and strip bidi marks.
  const tableNumber = tableNumberRaw
    .replace(/[\u0660-\u0669]/g, (d: string) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d: string) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim()
    .slice(0, 24);

  if (!UUID_RE.test(ownerId)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid owner ID' }));
    return;
  }
  if (!IDEMPOTENCY_RE.test(idempotencyKey)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid idempotency key' }));
    return;
  }
  if (!tableNumber) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Invalid table number' }));
    return;
  }
  if (!Array.isArray(inputItems) || inputItems.length < 1 || inputItems.length > 50) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Items must be an array of 1 to 50 lines' }));
    return;
  }

  const seen = new Set<string>();
  const items: Array<{ id: string; quantity: number }> = [];
  for (const line of inputItems) {
    const id = typeof line?.id === 'string' ? line.id.trim() : '';
    const quantity = Number(line?.quantity);
    if (!id || id.length > 128 || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || seen.has(id)) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid order item or quantity' }));
      return;
    }
    seen.add(id);
    items.push({ id, quantity });
  }
  items.sort((a, b) => a.id.localeCompare(b.id));

  // Durable owner + per-client limits are shared across serverless instances.
  // HMAC bucket keys ensure raw IP addresses are never stored.
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
    ?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const ownerBucket = 'owner:' + createHmac('sha256', tokenSecret)
    .update('guest-order-owner:v1:' + ownerId).digest('hex');
  const clientBucket = 'client:' + createHmac('sha256', tokenSecret)
    .update('guest-order-client:v1:' + ownerId + ':' + clientIp).digest('hex');

  try {
    const limitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_guest_order_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
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
      console.error('[api/store/orders] Rate-limit RPC unavailable:', limitResponse.status);
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Order protection is temporarily unavailable' }));
      return;
    }
    if (!allowed) {
      res.setHeader('Retry-After', '60');
      res.statusCode = 429;
      res.end(JSON.stringify({ error: 'Too many orders. Please wait before trying again.' }));
      return;
    }
  } catch (err: any) {
    console.error('[api/store/orders] Rate-limit error:', err?.message || 'unknown');
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Order protection is temporarily unavailable' }));
    return;
  }

  // --- Derive capability token (HMAC) + hashes ---
  const guestToken = hmacBase64Url(
    tokenSecret,
    `soovoice-guest-order:v1:${ownerId}:${idempotencyKey}`
  );
  const guestTokenHash = sha256Hex(guestToken);
  const requestHash = sha256Hex(JSON.stringify({ ownerId, tableNumber, items }));

  // --- Call the Supabase RPC ---
  try {
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_guest_order`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_owner_id: ownerId,
        p_table_number: tableNumber,
        p_items: items,
        p_idempotency_key: idempotencyKey,
        p_guest_token_hash: guestTokenHash,
        p_request_hash: requestHash,
      }),
    });

    const rpcResult = await rpcResponse.json().catch(() => null) as any;

    if (!rpcResponse.ok || !rpcResult?.orderId || !Array.isArray(rpcResult.items)) {
      const dbMessage = String(rpcResult?.message || rpcResult?.details || rpcResult?.hint || '');
      if (dbMessage.includes('ITEM_UNAVAILABLE')) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: 'One or more items are no longer available' }));
        return;
      }
      if (dbMessage.includes('IDEMPOTENCY_CONFLICT')) {
        res.statusCode = 409;
        res.end(JSON.stringify({ error: 'This checkout key was already used for a different cart' }));
        return;
      }
      if (dbMessage.includes('INVALID_')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Order validation failed', detail: dbMessage.slice(0, 200) }));
        return;
      }
      console.error('[api/store/orders] RPC failed:', rpcResponse.status, dbMessage.slice(0, 240));
      res.statusCode = rpcResponse.status >= 500 ? 503 : 400;
      res.end(JSON.stringify({ error: 'Could not place this order', detail: dbMessage.slice(0, 200) || undefined }));
      return;
    }

    res.statusCode = 201;
    res.end(JSON.stringify({
      orderId: rpcResult.orderId,
      guestToken,
      items: rpcResult.items,
      total: Number(rpcResult.total),
      tableNumber: String(rpcResult.tableNumber),
      createdAt: Number(rpcResult.createdAt),
      replayed: Boolean(rpcResult.replayed),
    }));
  } catch (err: any) {
    console.error('[api/store/orders] error:', err?.message || 'unknown');
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Order service temporarily unavailable' }));
  }
}
