import test from 'node:test';
import assert from 'node:assert/strict';
import { FoodicsClient } from '../src/lib/pos/foodics/client.ts';

const originalFetch = globalThis.fetch;

function page(data: unknown[], page: number, lastPage: number) {
  return new Response(JSON.stringify({
    data,
    meta: { current_page: page, last_page: lastPage, per_page: 50, from: 1, to: data.length, total: data.length },
    links: { next: page < lastPage ? 'next-url' : null },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Foodics client paginates on meta.last_page and sends the documented headers', async () => {
  const requests: Array<{ url: string; headers: Record<string, string> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    if (url.includes('page=1')) return page([{ id: 'b-1' }], 1, 2);
    if (url.includes('page=2')) return page([{ id: 'b-2' }], 2, 2);
    throw new Error(`UNEXPECTED_REQUEST ${url}`);
  }) as typeof fetch;
  try {
    const client = new FoodicsClient({ apiToken: 'foodics-token-value-1234567890' });
    const branches = await client.listBranches();
    assert.deepEqual(branches.map(row => row.id), ['b-1', 'b-2']);
    assert.equal(requests.length, 2);
    assert.ok(requests[0].url.startsWith('https://api.foodics.com/v5/branches?'), requests[0].url);
    assert.equal(requests[0].headers.Authorization, 'Bearer foodics-token-value-1234567890');
    assert.ok(requests[0].headers.Authorization.startsWith('Bearer B') === false);
    assert.match(requests[0].headers.Authorization, /^Bearer [A-Za-z0-9-]+$/);
    assert.equal(requests[0].headers.Accept, 'application/json');
    assert.equal(requests[0].headers['Content-Type'], 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics client requests products with branches and modifiers included', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return page([{ id: 'p-1' }], 1, 1);
  }) as typeof fetch;
  try {
    const client = new FoodicsClient({ apiToken: 'foodics-token-value-1234567890' });
    const products = await client.listProducts();
    assert.equal(products.length, 1);
    assert.ok(urls[0].includes('/products?'), urls[0]);
    assert.ok(urls[0].includes('include=branches%2Cmodifiers') || urls[0].includes('include=branches,modifiers'), urls[0]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics client uses the sandbox base URL when configured', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return page([], 1, 1);
  }) as typeof fetch;
  try {
    const client = new FoodicsClient({ apiToken: 'foodics-token-value-1234567890', sandbox: true });
    await client.listBranches();
    assert.ok(urls[0].startsWith('https://api-sandbox.foodics.com/v5/branches'), urls[0]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics order creation reports the documented duplicate id replay as duplicated', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return jsonResponse({ message: 'The given data was invalid.', errors: { id: ['Duplicate ID.'] } }, 422);
  }) as typeof fetch;
  try {
    const client = new FoodicsClient({ apiToken: 'foodics-token-value-1234567890' });
    const result = await client.createOrder({
      id: '9cc34751-fd7f-41a3-a37b-80d0a85c1103',
      type: 1,
      branch_id: 'branch-uuid',
      products: [{ product_id: 'product-uuid', quantity: 1, unit_price: 50 }],
    });
    assert.equal(result.duplicated, true);
    assert.equal(requests[0].url, 'https://api.foodics.com/v5/orders');
    assert.equal((requests[0].init?.method), 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics order creation surfaces rejections and auth failures distinctly', async () => {
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (body.id === 'reject-1') return jsonResponse({ errors: { branch_id: ['Invalid branch.'] } }, 422);
    if (body.id === 'unauth-1') return jsonResponse({}, 401);
    if (body.id === 'server-1') return jsonResponse({}, 500);
    throw new Error('UNEXPECTED');
  }) as typeof fetch;
  try {
    const client = new FoodicsClient({ apiToken: 'foodics-token-value-1234567890' });
    const payload = (id: string) => ({
      id, type: 1 as const, branch_id: 'branch-uuid',
      products: [{ product_id: 'product-uuid', quantity: 1, unit_price: 50 }],
    });
    await assert.rejects(client.createOrder(payload('reject-1')), /FOODICS_ORDER_REJECTED/);
    await assert.rejects(client.createOrder(payload('unauth-1')), /FOODICS_AUTHORIZATION_FAILED/);
    await assert.rejects(client.createOrder(payload('server-1')), /FOODICS_ORDER_FAILED_500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
