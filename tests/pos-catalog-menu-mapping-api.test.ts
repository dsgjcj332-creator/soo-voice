import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const locationId = '550e8400-e29b-41d4-a716-446655440001';
const connectionId = '550e8400-e29b-41d4-a716-446655440002';
const accessToken = 'merchant-session-token-abcdefghijklmnopqrstuvwxyz';
const originalFetch = globalThis.fetch;

type MockOptions = {
  menuRows?: Array<{ id: string }>;
  mappingStatus?: number;
};

async function withApi(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  run: (baseUrl: string, requests: Array<{ url: URL; init?: RequestInit }>) => Promise<void>,
) {
  process.env.SUPABASE_URL = 'https://soo-voice-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64);

  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return originalFetch(input, init);
    }
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
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function successfulSupabase(url: URL, init: RequestInit | undefined, options: MockOptions = {}) {
  if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
  if (url.pathname === '/rest/v1/pos_locations') return json([{ id: locationId, connection_id: connectionId }]);
  if (url.pathname === '/rest/v1/pos_catalog_items') return json([{ provider_item_id: 'provider-tea-1' }]);
  if (url.pathname === '/rest/v1/menu_items') return json(options.menuRows ?? [{ id: 'menu-tea-1' }]);
  if (url.pathname === '/rest/v1/pos_catalog_menu_links' && init?.method === 'POST') {
    if (options.mappingStatus && options.mappingStatus !== 201) return json({ message: 'mapping conflict' }, options.mappingStatus);
    const body = JSON.parse(String(init.body));
    return json([{
      id: '660e8400-e29b-41d4-a716-446655440000',
      location_id: body.location_id,
      provider_item_id: body.provider_item_id,
      menu_item_id: body.menu_item_id,
      field_overrides: body.field_overrides,
      approved_at: body.approved_at,
    }], 201);
  }
  throw new Error(`UNEXPECTED_SUPABASE_REQUEST: ${init?.method || 'GET'} ${url.pathname}`);
}

test('POS menu mapping rejects requests without a verified merchant session', async () => {
  await withApi(
    (url) => url.pathname === '/auth/v1/user' ? json({ message: 'missing bearer' }, 401) : json([]),
    async (baseUrl) => {
      const response = await originalFetch(`${baseUrl}/api/pos/catalog/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, providerItemId: 'provider-tea-1', menuItemId: 'menu-tea-1' }),
      });
      assert.equal(response.status, 401);
    },
  );
});

test('POS menu mapping rejects unknown override fields before database writes', async () => {
  await withApi(
    (url, init) => successfulSupabase(url, init),
    async (baseUrl, requests) => {
      const response = await originalFetch(`${baseUrl}/api/pos/catalog/mappings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId, providerItemId: 'provider-tea-1', menuItemId: 'menu-tea-1',
          fieldOverrides: { ownerId: true },
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(requests.some(request => request.url.pathname === '/rest/v1/pos_catalog_menu_links'), false);
    },
  );
});

test('POS menu mapping verifies tenant scope and records explicit merchant approval without editing the menu', async () => {
  await withApi(
    (url, init) => successfulSupabase(url, init),
    async (baseUrl, requests) => {
      const response = await originalFetch(`${baseUrl}/api/pos/catalog/mappings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId, providerItemId: 'provider-tea-1', menuItemId: 'menu-tea-1',
          fieldOverrides: { name: true, price: true, description: false },
        }),
      });
      assert.equal(response.status, 201);
      const body = await response.json() as Record<string, unknown>;
      assert.equal(body.provider_item_id, 'provider-tea-1');
      assert.deepEqual(body.field_overrides, { name: true, price: true });

      const locationRequest = requests.find(request => request.url.pathname === '/rest/v1/pos_locations');
      assert.ok(locationRequest?.url.searchParams.get('owner_id') === `eq.${ownerId}`);
      const menuRequest = requests.find(request => request.url.pathname === '/rest/v1/menu_items');
      assert.ok(menuRequest?.url.searchParams.get('ownerId') === `eq.${ownerId}`);
      const mappingRequest = requests.find(request => request.url.pathname === '/rest/v1/pos_catalog_menu_links');
      assert.equal(mappingRequest?.init?.method, 'POST');
      const saved = JSON.parse(String(mappingRequest?.init?.body));
      assert.equal(saved.owner_id, ownerId);
      assert.equal(saved.approved_by, ownerId);
      assert.deepEqual(saved.field_overrides, { name: true, price: true });
      assert.equal(requests.some(request => request.url.pathname === '/rest/v1/menu_items' && request.init?.method === 'PATCH'), false);
    },
  );
});

test('POS menu mapping refuses a menu item that is not returned for the authenticated merchant', async () => {
  await withApi(
    (url, init) => successfulSupabase(url, init, { menuRows: [] }),
    async (baseUrl, requests) => {
      const response = await originalFetch(`${baseUrl}/api/pos/catalog/mappings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, providerItemId: 'provider-tea-1', menuItemId: 'foreign-menu-item' }),
      });
      assert.equal(response.status, 404);
      assert.equal(requests.some(request => request.url.pathname === '/rest/v1/pos_catalog_menu_links'), false);
    },
  );
});

test('POS menu mapping returns conflict when a local menu item is already linked in the branch', async () => {
  await withApi(
    (url, init) => successfulSupabase(url, init, { mappingStatus: 409 }),
    async (baseUrl) => {
      const response = await originalFetch(`${baseUrl}/api/pos/catalog/mappings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, providerItemId: 'provider-tea-1', menuItemId: 'menu-tea-1' }),
      });
      assert.equal(response.status, 409);
    },
  );
});
