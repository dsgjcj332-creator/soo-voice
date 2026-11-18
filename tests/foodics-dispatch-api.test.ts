import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';
import { encryptPosCredentials } from '../src/lib/pos/credentials.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const connectionId = '550e8400-e29b-41d4-a716-446655440002';
const locationId = '550e8400-e29b-41d4-a716-446655440003';
const branchId = '9cc1b4c5-0000-4000-8000-000000000001';
const productId = '9cc34751-0000-4000-8000-000000000010';
const menuItemId = '550e8400-e29b-41d4-a716-446655440004';
const routeId = '550e8400-e29b-41d4-a716-446655440005';
const accessToken = 'merchant-session-token-abcdefghijklmnopqrstuvwxyz';

const originalFetch = globalThis.fetch;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function withApi(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  run: (baseUrl: string, requests: Array<{ url: URL; init?: RequestInit }>) => Promise<void>,
) {
  const previous = {
    url: process.env.SUPABASE_URL,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anon: process.env.SUPABASE_ANON_KEY,
    key: process.env.POS_CREDENTIALS_ENCRYPTION_KEY,
    version: process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION,
    clientId: process.env.FOODICS_CLIENT_ID,
    clientSecret: process.env.FOODICS_CLIENT_SECRET,
    workerSecret: process.env.POS_OUTBOX_WORKER_SECRET,
  };
  process.env.SUPABASE_URL = 'https://soo-voice-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = 'test-v1';
  process.env.POS_OUTBOX_WORKER_SECRET = 'pos-worker-secret-value-0123456789abcdef';

  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return originalFetch(input, init);
    requests.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;

  const server = createApiApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_UNAVAILABLE');
  try {
    await run(`http://127.0.0.1:${address.port}`, requests);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete (process.env as Record<string, unknown>)[key];
      else (process.env as Record<string, unknown>)[key] = value;
    }
  }
}

function merchantHeaders() {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

function encryptedFoodicsCredentials() {
  return encryptPosCredentials({ apiToken: 'foodics-account-token-value-123456' });
}

const CONNECTION_ROW = () => [{
  id: connectionId, provider: 'foodics', status: 'connected',
  credentials_ciphertext: encryptedFoodicsCredentials().ciphertext,
  credentials_key_version: encryptedFoodicsCredentials().keyVersion,
  outbound_orders_enabled: true,
}];

const FOODICS_PRODUCT = () => ({
  id: productId,
  name: 'Beef Burger',
  price: 50,
  is_active: true,
  is_ready: true,
  branches: [{ id: branchId, pivot: { price: 55, is_active: true, is_in_stock: true } }],
  modifiers: [{ id: 'mod-1', name: 'Sauce', pivot: { minimum_options: 1, maximum_options: 2 }, options: [{ id: 'opt-bbq', name: 'BBQ', is_active: true, price: 2 }] }],
});

function supabaseHandler(url: URL, overrides: { claimed?: unknown[] } = {}): Response | null {
  if (url.hostname !== 'soo-voice-test.supabase.co') return null;
  if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
  if (url.pathname === '/rest/v1/pos_order_routes') {
    return json([{ id: routeId, connection_id: connectionId, location_id: locationId, route_type: 'default', route_value: null }]);
  }
  if (url.pathname === '/rest/v1/pos_connections') return json(CONNECTION_ROW());
  if (url.pathname === '/rest/v1/pos_locations') {
    return json([{ id: locationId, currency: 'EGP', provider_location_id: branchId }]);
  }
  if (url.pathname === '/rest/v1/pos_catalog_menu_links') {
    return json([{ provider_item_id: productId, menu_item_id: menuItemId }]);
  }
  if (url.pathname === '/rest/v1/pos_catalog_items') {
    return json([{
      provider_item_id: productId, currency: 'EGP', active: true, available: true,
      unit_price: 55,
      modifier_groups: [{ id: 'mod-1', options: [{ id: 'opt-bbq', priceDelta: 2 }] }],
    }]);
  }
  if (url.pathname === '/rest/v1/rpc/claim_order_outbox') return json(overrides.claimed ?? []);
  if (url.pathname === '/rest/v1/rpc/complete_order_outbox') return json(true);
  if (url.pathname === '/rest/v1/rpc/sync_pos_catalog_snapshot') return json({ ok: true });
  if (url.pathname === '/rest/v1/order_outbox') return json([]);
  return json({}, 404);
}

test('outbox dispatch sends foodics orders through the real Foodics Orders API', async () => {
  const claimedEvent = {
    id: '9cc34751-0000-4000-8000-00000000face',
    order_id: 'order-123',
    owner_id: ownerId,
    event_type: 'order.created',
    payload: { items: [{ id: menuItemId, quantity: 2 }], tableNumber: '5', notes: 'no onions' },
    attempts: 0,
  };
  await withApi((url, init) => {
    if (url.href === 'https://api.foodics.com/v5/orders') {
      return json({ data: { id: 'foodics-order-1' } }, 201);
    }
    const supabase = supabaseHandler(url, { claimed: [claimedEvent] });
    if (supabase) return supabase;
    void init;
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const response = await fetch(`${baseUrl}/api/pos/outbox/dispatch`, {
      method: 'POST',
      headers: { Authorization: 'Bearer pos-worker-secret-value-0123456789abcdef' },
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { claimed: number; delivered: number; alertsRecorded: number };
    assert.equal(body.claimed, 1);
    assert.equal(body.delivered, 1);
    assert.equal(body.alertsRecorded, 0);

    const foodicsRequest = requests.find(request => request.url.href === 'https://api.foodics.com/v5/orders');
    assert.ok(foodicsRequest, 'expected a real Foodics order request');
    const payload = JSON.parse(String(foodicsRequest.init?.body)) as {
      id: string; type: number; branch_id: string; products: Array<{
        product_id: string; quantity: number; unit_price: number; kitchen_notes?: string;
      }>;
    };
    assert.match(payload.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(payload.type, 1);
    assert.equal(payload.branch_id, branchId);
    assert.equal(payload.products.length, 1);
    assert.equal(payload.products[0].product_id, productId);
    assert.equal(payload.products[0].quantity, 2);
    assert.equal(payload.products[0].unit_price, 55);
    assert.ok(payload.products[0].kitchen_notes?.includes('Table: 5'));
    const completeRequest = requests.find(request => request.url.pathname === '/rest/v1/rpc/complete_order_outbox');
    assert.ok(completeRequest, 'expected the outbox event to complete');
  });
});

test('sync-catalog pulls live Foodics products and persists a complete snapshot', async () => {
  await withApi((url, init) => {
    if (url.href.startsWith('https://api.foodics.com/v5/products')) {
      return json({ data: [FOODICS_PRODUCT()], meta: { last_page: 1 } });
    }
    const supabase = supabaseHandler(url);
    if (supabase) return supabase;
    void init;
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const response = await fetch(`${baseUrl}/api/pos/connections/${connectionId}/sync-catalog`, {
      method: 'POST',
      headers: merchantHeaders(),
      body: JSON.stringify({ locationId }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { syncedItems: number };
    assert.equal(body.syncedItems, 1);
    const rpcRequest = requests.find(request => request.url.pathname === '/rest/v1/rpc/sync_pos_catalog_snapshot');
    assert.ok(rpcRequest, 'expected the catalog snapshot RPC');
    const rpcArgs = JSON.parse(String(rpcRequest.init?.body)) as {
      p_owner_id: string; p_connection_id: string; p_location_id: string;
      p_complete_snapshot: boolean; p_items: Array<Record<string, unknown>>;
    };
    assert.equal(rpcArgs.p_owner_id, ownerId);
    assert.equal(rpcArgs.p_connection_id, connectionId);
    assert.equal(rpcArgs.p_location_id, locationId);
    assert.equal(rpcArgs.p_complete_snapshot, true);
    assert.equal(rpcArgs.p_items.length, 1);
    assert.equal(rpcArgs.p_items[0].unitPrice, 55);
  });
});

test('foodics oauth exchange requires configured client credentials and returns the token', async () => {
  await withApi((url, init) => {
    if (url.hostname === 'soo-voice-test.supabase.co' && url.pathname === '/auth/v1/user') return json({ id: ownerId });
    void init;
    return json({}, 404);
  }, async baseUrl => {
    const missing = await fetch(`${baseUrl}/api/pos/foodics/oauth/exchange`, {
      method: 'POST',
      headers: merchantHeaders(),
      body: JSON.stringify({ code: 'auth-code-1', redirectUri: 'https://app.soovoice.example/callback' }),
    });
    assert.equal(missing.status, 503);
    const body = await missing.json() as { error?: string };
    assert.equal(body.error, 'FOODICS_CLIENT_NOT_CONFIGURED');
  });
  process.env.FOODICS_CLIENT_ID = 'foodics-client-id-01';
  process.env.FOODICS_CLIENT_SECRET = 'foodics-client-secret-value-0123456789';
  await withApi((url, init) => {
    if (url.href === 'https://api.foodics.com/oauth/token') {
      assert.equal((init?.headers as Record<string, string>)['Content-Type'], 'application/json');
      return json({ token_type: 'Bearer', access_token: 'foodics-access-token-1234567890' });
    }
    if (url.hostname === 'soo-voice-test.supabase.co' && url.pathname === '/auth/v1/user') return json({ id: ownerId });
    void init;
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const response = await fetch(`${baseUrl}/api/pos/foodics/oauth/exchange`, {
      method: 'POST',
      headers: merchantHeaders(),
      body: JSON.stringify({ code: 'auth-code-1', redirectUri: 'https://app.soovoice.example/callback' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { apiToken: string };
    assert.equal(body.apiToken, 'foodics-access-token-1234567890');
    const tokenRequest = requests.find(request => request.url.href === 'https://api.foodics.com/oauth/token');
    assert.ok(tokenRequest, 'expected the token exchange request');
    const tokenBody = JSON.parse(String(tokenRequest.init?.body)) as Record<string, string>;
    assert.equal(tokenBody.grant_type, 'authorization_code');
    assert.equal(tokenBody.client_id, 'foodics-client-id-01');
    assert.equal(tokenBody.redirect_uri, 'https://app.soovoice.example/callback');
  });
});
