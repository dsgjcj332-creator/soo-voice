import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';
import { encryptPosCredentials } from '../src/lib/pos/credentials.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const connectionId = '550e8400-e29b-41d4-a716-446655440001';
const locationId = '550e8400-e29b-41d4-a716-446655440002';
const routeId = '550e8400-e29b-41d4-a716-446655440003';
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
  };
  process.env.SUPABASE_URL = 'https://soo-voice-routing-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
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
      const envKey = key === 'url' ? 'SUPABASE_URL' : key === 'service' ? 'SUPABASE_SERVICE_ROLE_KEY' :
        key === 'anon' ? 'SUPABASE_ANON_KEY' : 'POS_CREDENTIALS_ENCRYPTION_KEY';
      if (value === undefined) delete process.env[envKey]; else process.env[envKey] = value;
    }
  }
}

const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

test('merchant can list only their order routing rules', async () => {
  await withApi((url) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_order_routes') {
      assert.equal(url.searchParams.get('owner_id'), `eq.${ownerId}`);
      return json([{ id: routeId, owner_id: ownerId, route_type: 'default', location_id: locationId }]);
    }
    throw new Error(`UNEXPECTED_REQUEST ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/order-routes`, { headers });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    const rows = await response.json() as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, routeId);
  });
});

test('merchant saves a table-specific route through the scoped database RPC', async () => {
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/rpc/save_pos_order_route') {
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_owner_id, ownerId);
      assert.equal(body.p_connection_id, connectionId);
      assert.equal(body.p_location_id, locationId);
      assert.equal(body.p_route_type, 'table');
      assert.equal(body.p_route_value, 'T12');
      return json({ id: routeId, route_type: 'table', route_value: 'T12', location_id: locationId });
    }
    throw new Error(`UNEXPECTED_REQUEST ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/order-routes`, {
      method: 'POST', headers,
      body: JSON.stringify({ routeType: 'table', routeValue: ' t12 ', connectionId, locationId }),
    });
    assert.equal(response.status, 201);
    const result = await response.json() as Record<string, unknown>;
    assert.equal(result.route_value, 'T12');
  });
});

test('merchant cannot create malformed table references', async () => {
  let rpcCalled = false;
  await withApi((url) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname.includes('/rpc/')) rpcCalled = true;
    throw new Error(`UNEXPECTED_REQUEST ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/order-routes`, {
      method: 'POST', headers,
      body: JSON.stringify({ routeType: 'table', routeValue: 'T12?DROP', connectionId, locationId }),
    });
    assert.equal(response.status, 400);
    assert.equal(rpcCalled, false);
  });
});

test('merchant deletes only a route through the owner-scoped RPC', async () => {
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/rpc/delete_pos_order_route') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_owner_id, ownerId);
      assert.equal(body.p_route_id, routeId);
      return json(true);
    }
    throw new Error(`UNEXPECTED_REQUEST ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/order-routes/${routeId}`, {
      method: 'DELETE', headers,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: routeId, deleted: true });
  });
});

test('outbound-only POS credentials can activate dispatch without an inbound webhook secret', async () => {
  let encrypted: ReturnType<typeof encryptPosCredentials> | undefined;
  let savedStatus: Record<string, unknown> | undefined;
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_connections' && (!init?.method || init.method === 'GET')) {
      assert.equal(url.searchParams.get('owner_id'), `eq.${ownerId}`);
      encrypted = encryptPosCredentials({
        orderWebhookUrl: 'https://bridge.example.com/soovoice/orders',
        orderWebhookSecret: 'outbound-secret-value-that-is-long-enough-123',
      });
      return json([{
        id: connectionId, status: 'pending',
        inbound_webhooks_enabled: false, outbound_orders_enabled: false,
        credentials_ciphertext: encrypted.ciphertext,
        credentials_key_version: encrypted.keyVersion,
      }]);
    }
    if (url.pathname === '/rest/v1/pos_locations') {
      assert.equal(url.searchParams.get('connection_id'), `eq.${connectionId}`);
      return json([{ id: locationId }]);
    }
    if (url.pathname === '/rest/v1/pos_connections' && init?.method === 'PATCH') {
      savedStatus = JSON.parse(String(init.body));
      return json([{ id: connectionId, status: 'connected' }]);
    }
    throw new Error(`UNEXPECTED_REQUEST ${init?.method || 'GET'} ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections/${connectionId}/activate-webhooks`, {
      method: 'POST', headers,
      body: JSON.stringify({ confirmOutboundConfigured: true }),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as Record<string, unknown>;
    assert.equal(result.outboundOrderCreation, true);
    assert.equal(result.inboundWebhooks, false);
    assert.equal(savedStatus?.status, 'connected');
    assert.equal(savedStatus?.inbound_webhooks_enabled, false);
    assert.equal(savedStatus?.outbound_orders_enabled, true);
  });
});

test('connection listing exposes capability flags but never encrypted credentials', async () => {
  let encrypted: ReturnType<typeof encryptPosCredentials> | undefined;
  await withApi((url) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_connections') {
      encrypted = encryptPosCredentials({
        orderWebhookUrl: 'https://bridge.example.com/orders',
        orderWebhookSecret: 'outbound-secret-value-that-is-long-enough-123',
      });
      return json([{
        id: connectionId, provider: 'custom', display_name: 'Bridge', status: 'connected',
        credentials_ciphertext: encrypted.ciphertext,
        credentials_key_version: encrypted.keyVersion,
      }]);
    }
    throw new Error(`UNEXPECTED_REQUEST ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections`, { headers });
    assert.equal(response.status, 200);
    const [row] = await response.json() as Array<Record<string, unknown>>;
    assert.equal(row.outbound_orders_configured, true);
    assert.equal(row.outbound_orders_active, true);
    assert.equal(row.inbound_webhooks_configured, false);
    assert.equal('credentials_ciphertext' in row, false);
    assert.equal('credentials_key_version' in row, false);
  });
});
