/**
 * Vercel serverless function — /api/store/orders/[orderId] (GET)
 *
 * Guest order tracking. The browser presents the per-order capability
 * token in the `x-order-token` header (NEVER in the URL). We hash it
 * and query the orders row by (id, guest_token_hash, expiry > now).
 * A leaked order id alone cannot read this row; an attacker needs the
 * HMAC token too, which only the original POST returned to that guest.
 *
 * Standalone (no Express) for clean bundling on the Vercel Node runtime.
 */

import { createHash } from 'node:crypto';

export const config = {
  maxDuration: 25,
};

const ORDER_ID_RE = /^order_[a-f0-9-]{16,64}$/i;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Secure order service is not configured' }));
    return;
  }

  const orderId = String(req.query?.orderId || '');
  const token = String(req.headers?.['x-order-token'] || req.headers?.['X-Order-Token'] || '');

  if (!ORDER_ID_RE.test(orderId) || token.length < 32 || token.length > 256) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Order not found' }));
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
    const response = await fetch(`${supabaseUrl}/rest/v1/orders?${query.toString()}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!response.ok) {
      console.error('[api/store/orders/get] tracking query failed:', response.status);
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Order tracking temporarily unavailable' }));
      return;
    }
    const rows = await response.json() as any[];
    if (!Array.isArray(rows) || rows.length !== 1) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Order not found' }));
      return;
    }
    res.statusCode = 200;
    res.end(JSON.stringify({
      orderId: rows[0].id,
      status: rows[0].status,
      items: rows[0].items,
      total: Number(rows[0].total),
      tableNumber: rows[0].tableNumber,
      createdAt: Number(rows[0].createdAt),
    }));
  } catch (err: any) {
    console.error('[api/store/orders/get] error:', err?.message || 'unknown');
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Order tracking temporarily unavailable' }));
  }
}
