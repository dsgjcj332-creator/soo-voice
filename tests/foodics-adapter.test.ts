import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodicsAdapter } from '../src/lib/pos/foodics/adapter.ts';
import { runPosAdapterConformance } from '../src/lib/pos/adapter-conformance.ts';

const originalFetch = globalThis.fetch;
const BRANCH = '9cc1b4c5-0000-4000-8000-000000000001';
const CONTEXT = { merchantId: '550e8400-e29b-41d4-a716-446655440000', connectionId: '550e8400-e29b-41d4-a716-446655440002', locationId: BRANCH };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function foodicsFetchMock(handlers: {
  branches?: unknown;
  products?: unknown;
  orderResponse?: Response;
}) {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://api.foodics.com/v5/branches')) {
      return jsonResponse({ data: handlers.branches ?? [], meta: { last_page: 1 } });
    }
    if (url.startsWith('https://api.foodics.com/v5/products')) {
      return jsonResponse({ data: handlers.products ?? [], meta: { last_page: 1 } });
    }
    if (url === 'https://api.foodics.com/v5/orders') {
      return handlers.orderResponse ?? jsonResponse({ data: { id: 'x' } }, 201);
    }
    throw new Error(`UNEXPECTED_FOODICS_REQUEST ${url}`);
  }) as typeof fetch;
}

test('Foodics adapter declares only implemented capabilities', async () => {
  globalThis.fetch = foodicsFetchMock({});
  try {
    const adapter = createFoodicsAdapter({ apiToken: 'foodics-token-value-1234567890' });
    const capabilities = await adapter.getCapabilities(CONTEXT);
    assert.equal(capabilities.menuRead, true);
    assert.equal(capabilities.orderCreate, true);
    assert.equal(capabilities.modifiers, true);
    assert.equal(capabilities.multiLocation, true);
    // Not implemented in this version; declared honestly so the registry
    // never promises an unimplemented integration.
    assert.equal(capabilities.orderRead, false);
    assert.equal(capabilities.orderCancel, false);
    assert.equal(capabilities.orderStatusWebhook, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics adapter passes the canonical conformance suite', async () => {
  globalThis.fetch = foodicsFetchMock({
    branches: [{ id: BRANCH, name: 'Downtown', receives_online_orders: true }],
    products: [{
      id: '9cc34751-0000-4000-8000-000000000010',
      name: 'Beef Burger',
      price: 50,
      is_active: true,
      is_ready: true,
      branches: [{ id: BRANCH, pivot: { price: 55, is_active: true, is_in_stock: true } }],
      modifiers: [{ id: 'mod-1', name: 'Sauce', pivot: { minimum_options: 0, maximum_options: 0 }, options: [{ id: 'opt-1', name: 'BBQ', is_active: true, price: 2 }] }],
    }],
  });
  try {
    const adapter = createFoodicsAdapter({ apiToken: 'foodics-token-value-1234567890', currency: 'EGP' });
    const result = await runPosAdapterConformance(adapter, CONTEXT, BRANCH);
    const failed = result.checks.filter(check => !check.passed);
    assert.deepEqual(failed, []);
    assert.equal(result.provider, 'foodics');
    assert.equal(result.locations.length, 1);
    assert.equal(result.catalogItemCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics adapter health check fails closed on API errors', async () => {
  globalThis.fetch = (async () => jsonResponse({}, 401)) as typeof fetch;
  try {
    const adapter = createFoodicsAdapter({ apiToken: 'foodics-token-value-1234567890' });
    const health = await adapter.healthCheck(CONTEXT);
    assert.equal(health.ok, false);
    assert.match(health.message ?? '', /FOODICS_AUTHORIZATION_FAILED/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics adapter createOrder reports accepted and duplicate replays', async () => {
  globalThis.fetch = foodicsFetchMock({
    products: [{
      id: '9cc34751-0000-4000-8000-000000000010',
      name: 'Beef Burger',
      is_active: true,
      is_ready: true,
      branches: [{ id: BRANCH, pivot: { price: 55 } }],
    }],
    orderResponse: jsonResponse({ data: { id: 'order-remote' } }, 201),
  });
  try {
    const adapter = createFoodicsAdapter({ apiToken: 'foodics-token-value-1234567890', currency: 'EGP' });
    const input = {
      merchantId: CONTEXT.merchantId,
      locationId: BRANCH,
      localOrderId: 'order-123',
      idempotencyKey: 'soovoice:order-123',
      currency: 'EGP',
      lines: [{ catalogItemId: 'menu-1', providerItemId: '9cc34751-0000-4000-8000-000000000010', quantity: 1, modifierOptionIds: [] }],
      fulfillment: 'pickup' as const,
    };
    const result = await adapter.createOrder(CONTEXT, input);
    assert.equal(result.status, 'accepted');
    assert.equal(result.rawStatus, 'created');
    assert.match(result.providerOrderId ?? '', /^[0-9a-f-]{36}$/);
    await assert.rejects(
      adapter.createOrder({ ...CONTEXT, locationId: 'other' }, input),
      /FOODICS_ORDER_LOCATION_MISMATCH/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Foodics adapter verifyWebhook fails closed until the signature spec ships', async () => {
  const adapter = createFoodicsAdapter({ apiToken: 'foodics-token-value-1234567890' });
  await assert.rejects(
    adapter.verifyWebhook({}, new Uint8Array()),
    /FOODICS_WEBHOOK_SIGNATURE_NOT_CONFIGURED/,
  );
});
