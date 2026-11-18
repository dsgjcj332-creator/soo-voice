import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const conversationId = '9cc34751-0000-4000-8000-00000000c0de';
const orderId = 'order_1700000000';
const accessToken = 'merchant-session-token-abcdefghijklmnopqrstuvwxyz';
const apiKey = 'test-api-key-value-0123456789';

const originalFetch = globalThis.fetch;

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function withApi(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  run: (baseUrl: string, requests: Array<{ url: URL; init?: RequestInit }>) => Promise<void>,
) {
  const previous = {
    url: process.env.SUPABASE_URL,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anon: process.env.SUPABASE_ANON_KEY,
    apiKey: process.env.API_KEY,
  };
  process.env.SUPABASE_URL = 'https://soo-voice-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.API_KEY = apiKey;

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

function apiHeaders(extra: Record<string, string> = {}) {
  return { 'x-api-key': apiKey, 'Content-Type': 'application/json', ...extra };
}

test('orders API lists, updates and deletes real rows', async () => {
  await withApi((url, init) => {
    if (url.pathname === '/rest/v1/orders' && (!init?.method || init.method === 'GET')) {
      assert.equal(url.searchParams.get('ownerId'), `eq.${ownerId}`);
      assert.equal(url.searchParams.get('order'), 'createdAt.desc');
      return json([{ id: orderId, ownerId, status: 'pending', total: 90 }]);
    }
    if (url.pathname === `/rest/v1/orders` && init?.method === 'PATCH') {
      if (url.searchParams.get('id') === `eq.${orderId}`) {
        assert.deepEqual(JSON.parse(String(init.body)), { status: 'preparing' });
        return json([{ id: orderId, status: 'preparing' }]);
      }
      return json([]);
    }
    if (url.pathname === '/rest/v1/orders' && init?.method === 'DELETE') {
      return json([{ id: orderId }]);
    }
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const list = await fetch(`${baseUrl}/api/orders/${ownerId}`, { headers: apiHeaders() });
    assert.equal(list.status, 200);
    const listBody = await list.json() as Array<{ id: string }>;
    assert.equal(listBody.length, 1);

    const update = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
      method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ status: 'preparing' }),
    });
    assert.equal(update.status, 200);
    const updateBody = await update.json() as { status: string };
    assert.equal(updateBody.status, 'preparing');

    const invalid = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
      method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ status: 'bogus' }),
    });
    assert.equal(invalid.status, 400);

    const notFound = await fetch(`${baseUrl}/api/orders/missing-id/status`, {
      method: 'PATCH', headers: apiHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ status: 'preparing' }),
    });
    assert.equal(notFound.status, 404);

    const remove = await fetch(`${baseUrl}/api/orders/${orderId}`, { method: 'DELETE', headers: apiHeaders() });
    assert.equal(remove.status, 200);
    const removeBody = await remove.json() as { deleted: string };
    assert.equal(removeBody.deleted, orderId);
    assert.ok(requests.length >= 4);
  });
});

test('analytics computes real order metrics for the requested range', async () => {
  await withApi((url) => {
    if (url.pathname === '/rest/v1/orders') {
      assert.equal(url.searchParams.get('select'), 'status,total');
      return json([
        { status: 'completed', total: 90 },
        { status: 'completed', total: 55.5 },
        { status: 'pending', total: 30 },
        { status: 'cancelled', total: 100 },
      ]);
    }
    return json({}, 404);
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/analytics/${ownerId}?range=7d`, { headers: apiHeaders() });
    assert.equal(response.status, 200);
    const body = await response.json() as {
      range: string; totalOrders: number; ordersByStatus: Record<string, number>;
      revenueTotal: number; averageOrderValue: number;
    };
    assert.equal(body.range, '7d');
    assert.equal(body.totalOrders, 4);
    assert.equal(body.ordersByStatus.completed, 2);
    assert.equal(body.ordersByStatus.cancelled, 1);
    assert.equal(body.revenueTotal, 175.5);
    assert.equal(body.averageOrderValue, 58.5);
  });
});

test('conversations API appends messages and returns scoped threads', async () => {
  await withApi((url, init) => {
    if (url.pathname === '/rest/v1/conversations' && (!init?.method || init.method === 'GET') && url.searchParams.get('id')) {
      return json([{ id: conversationId }]);
    }
    if (url.pathname === '/rest/v1/conversations' && (!init?.method || init.method === 'GET') && !url.searchParams.get('id')) {
      return json([{ id: conversationId, session_id: 'sess-1', status: 'open', message_count: 2 }]);
    }
    if (url.pathname === '/rest/v1/conversations' && init?.method === 'POST') {
      assert.ok(String(url).includes('on_conflict=owner_id,session_id'));
      return json([{ id: conversationId, status: 'open', message_count: 2 }]);
    }
    if (url.pathname === '/rest/v1/conversation_messages' && init?.method === 'POST') {
      return json([{ id: 'msg-1' }]);
    }
    if (url.pathname === '/rest/v1/conversation_messages' && init?.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'content-range': '*/3' } });
    }
    if (url.pathname === '/rest/v1/conversation_messages' && (!init?.method || init.method === 'GET')) {
      return json([{ id: 'msg-1', role: 'user', content: 'عايز برجر' }]);
    }
    if (url.pathname === '/rest/v1/conversations' && init?.method === 'PATCH') return json([{ id: conversationId }]);
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const append = await fetch(`${baseUrl}/api/conversations/${ownerId}`, {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ sessionId: 'sess-1', role: 'user', content: 'عايز برجر' }),
    });
    assert.equal(append.status, 201);
    const appendBody = await append.json() as { conversationId: string; messageCount: number };
    assert.equal(appendBody.conversationId, conversationId);
    assert.equal(appendBody.messageCount, 3);

    const invalid = await fetch(`${baseUrl}/api/conversations/${ownerId}`, {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ sessionId: 'sess-1', role: 'admin', content: 'x' }),
    });
    assert.equal(invalid.status, 400);

    const list = await fetch(`${baseUrl}/api/conversations/${ownerId}?status=open`, { headers: apiHeaders() });
    assert.equal(list.status, 200);
    const listBody = await list.json() as Array<{ id: string }>;
    assert.equal(listBody.length, 1);

    const messages = await fetch(`${baseUrl}/api/conversations/${ownerId}/${conversationId}/messages`, { headers: apiHeaders() });
    assert.equal(messages.status, 200);
    const messagesBody = await messages.json() as Array<{ role: string }>;
    assert.equal(messagesBody[0].role, 'user');
    assert.ok(requests.some(request => request.init?.method === 'PATCH'), 'expected summary counter update');
  });
});

test('webhook settings GET and PUT persist merchant configuration', async () => {
  await withApi((url, init) => {
    if (url.pathname === '/rest/v1/merchant_webhook_settings' && (!init?.method || init.method === 'GET')) {
      if (url.searchParams.get('ownerId') === `eq.${ownerId}`) return json([]);
      return json({}, 404);
    }
    if (url.pathname === '/rest/v1/merchant_webhook_settings' && init?.method === 'POST') {
      assert.ok(String(url).includes('on_conflict=owner_id'));
      return json([{ ownerId, url: 'https://merchant.example.com/hooks', enabled: true }]);
    }
    return json({}, 404);
  }, async baseUrl => {
    const unset = await fetch(`${baseUrl}/api/webhook-settings/${ownerId}`, { headers: apiHeaders() });
    assert.equal(unset.status, 200);
    const unsetBody = await unset.json() as { configured: boolean };
    assert.equal(unsetBody.configured, false);

    const invalidSecret = await fetch(`${baseUrl}/api/webhook-settings/${ownerId}`, {
      method: 'PUT', headers: apiHeaders(),
      body: JSON.stringify({ url: 'https://merchant.example.com/hooks', secret: 'short' }),
    });
    assert.equal(invalidSecret.status, 400);

    const insecureUrl = await fetch(`${baseUrl}/api/webhook-settings/${ownerId}`, {
      method: 'PUT', headers: apiHeaders(),
      body: JSON.stringify({ url: 'http://merchant.example.com/hooks', secret: '0123456789abcdef0123456789abcdef' }),
    });
    assert.equal(insecureUrl.status, 400);

    const save = await fetch(`${baseUrl}/api/webhook-settings/${ownerId}`, {
      method: 'PUT', headers: apiHeaders(),
      body: JSON.stringify({
        url: 'https://merchant.example.com/hooks',
        secret: '0123456789abcdef0123456789abcdef',
        events: ['orders'],
      }),
    });
    assert.equal(save.status, 200);
    const saveBody = await save.json() as { url: string };
    assert.equal(saveBody.url, 'https://merchant.example.com/hooks');
  });
});

test('legacy routes still require the admin API key', async () => {
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/orders/${ownerId}`);
    assert.equal(response.status, 401);
    const body = await response.json() as { error?: string };
    assert.match(body.error ?? '', /Invalid or missing API key/);
  });
});

test('guest session tokens are not accepted as merchant identities here', async () => {
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/orders/${ownerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.status, 401);
  });
});
