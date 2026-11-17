import test from 'node:test';
import assert from 'node:assert/strict';
import { createPosSandboxAdapter } from '../src/lib/pos/testing/sandbox-adapter.ts';
import { processOrderOutboxBatch, type OrderOutboxEvent, type OutboxStore } from '../src/lib/pos/outbox-worker.ts';
import type { PosCreateOrderInput, PosConnectionContext } from '../src/lib/pos/types.ts';

const context: PosConnectionContext = {
  merchantId: 'merchant-sandbox-1',
  connectionId: 'connection-sandbox-1',
  locationId: 'sandbox-location-1',
};

function order(overrides: Partial<PosCreateOrderInput> = {}): PosCreateOrderInput {
  return {
    merchantId: context.merchantId,
    locationId: 'sandbox-location-1',
    localOrderId: 'local-order-1',
    idempotencyKey: 'request-1',
    currency: 'EGP',
    lines: [{
      catalogItemId: 'sandbox-item-1',
      providerItemId: 'sandbox-product-1',
      quantity: 2,
      modifierOptionIds: ['sandbox-small'],
    }],
    fulfillment: 'pickup',
    ...overrides,
  };
}

test('sandbox adapter exposes healthy capabilities, branch and normalized catalog', async () => {
  const sandbox = createPosSandboxAdapter();
  const capabilities = await sandbox.adapter.getCapabilities(context);
  const health = await sandbox.adapter.healthCheck(context);
  const locations = await sandbox.adapter.listLocations(context);
  const catalog = await sandbox.adapter.fetchCatalog(context, 'sandbox-branch-1');
  assert.equal(capabilities.menuRead, true);
  assert.equal(capabilities.orderCreate, true);
  assert.deepEqual(health, { ok: true, message: 'In-memory sandbox adapter is ready' });
  assert.equal(locations.length, 1);
  assert.equal(locations[0].active, true);
  assert.equal(catalog.length, 1);
  assert.deepEqual(sandbox.getAcceptedOrders(), []);
});

test('sandbox adapter exposes only its seeded branch and catalog', async () => {
  const sandbox = createPosSandboxAdapter();
  const locations = await sandbox.adapter.listLocations(context);
  const catalog = await sandbox.adapter.fetchCatalog(context, 'sandbox-branch-1');
  assert.equal(locations.length, 1);
  assert.equal(locations[0].active, true);
  assert.equal(catalog.length, 1);
  await assert.rejects(
    sandbox.adapter.fetchCatalog(context, 'another-branch'),
    /POS_SANDBOX_LOCATION_NOT_FOUND/,
  );
});

test('sandbox adapter accepts a valid order and records its provider ID', async () => {
  const sandbox = createPosSandboxAdapter();
  const result = await sandbox.adapter.createOrder(context, order());
  assert.equal(result.status, 'accepted');
  assert.equal(result.providerOrderId, 'sandbox-order-000001');
  assert.equal(sandbox.getAcceptedOrders().length, 1);
});

test('sandbox adapter returns the same provider order for an identical retry', async () => {
  const sandbox = createPosSandboxAdapter();
  const first = await sandbox.adapter.createOrder(context, order());
  const retry = await sandbox.adapter.createOrder(context, order());
  assert.deepEqual(retry, first);
  assert.equal(sandbox.getAcceptedOrders().length, 1);
});

test('sandbox adapter rejects idempotency-key reuse with a changed order', async () => {
  const sandbox = createPosSandboxAdapter();
  await sandbox.adapter.createOrder(context, order());
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ lines: [{
      catalogItemId: 'sandbox-item-1',
      providerItemId: 'sandbox-product-1',
      quantity: 3,
      modifierOptionIds: ['sandbox-small'],
    }] })),
    /POS_SANDBOX_IDEMPOTENCY_CONFLICT/,
  );
  assert.equal(sandbox.getAcceptedOrders().length, 1);
});

test('sandbox adapter rejects tenant and branch mismatches', async () => {
  const sandbox = createPosSandboxAdapter();
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ merchantId: 'another-merchant' })),
    /POS_SANDBOX_TENANT_MISMATCH/,
  );
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ locationId: 'another-location' })),
    /POS_SANDBOX_LOCATION_MISMATCH/,
  );
});

test('sandbox adapter validates catalog items, quantities and required modifiers', async () => {
  const sandbox = createPosSandboxAdapter();
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ lines: [{
      catalogItemId: 'unknown-item',
      providerItemId: 'unknown-item',
      quantity: 1,
      modifierOptionIds: ['sandbox-small'],
    }] })),
    /POS_SANDBOX_ITEM_NOT_AVAILABLE/,
  );
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ lines: [{
      catalogItemId: 'sandbox-item-1',
      providerItemId: 'sandbox-product-1',
      quantity: 0,
      modifierOptionIds: ['sandbox-small'],
    }] })),
    /POS_SANDBOX_INVALID_QUANTITY/,
  );
  await assert.rejects(
    sandbox.adapter.createOrder(context, order({ lines: [{
      catalogItemId: 'sandbox-item-1',
      providerItemId: 'sandbox-product-1',
      quantity: 1,
      modifierOptionIds: [],
    }] })),
    /POS_SANDBOX_INVALID_MODIFIERS/,
  );
});

test('sandbox adapter completes the leased outbox flow with a provider order link', async () => {
  const sandbox = createPosSandboxAdapter();
  const event: OrderOutboxEvent = {
    id: 'outbox-sandbox-1',
    order_id: 'local-order-outbox-1',
    owner_id: context.merchantId,
    event_type: 'order.created',
    payload: {},
    attempts: 0,
  };
  let linkedProviderOrderId = '';
  let retried = false;
  const store: OutboxStore = {
    async claim(workerId, limit, leaseSeconds) {
      assert.equal(workerId, 'sandbox-worker-0001');
      assert.equal(limit, 10);
      assert.equal(leaseSeconds, 120);
      return [event];
    },
    async complete(eventId, workerId, target, providerOrderId) {
      assert.equal(eventId, event.id);
      assert.equal(workerId, 'sandbox-worker-0001');
      assert.equal(target.provider, 'custom');
      linkedProviderOrderId = providerOrderId;
      return true;
    },
    async retry() {
      retried = true;
      return 'failed';
    },
  };

  const result = await processOrderOutboxBatch(
    store,
    'sandbox-worker-0001',
    async () => ({
      provider: 'custom',
      context,
      createOrder: input => sandbox.adapter.createOrder(context, input),
    }),
    row => order({
      localOrderId: row.order_id,
      idempotencyKey: `soovoice:${row.order_id}`,
    }),
  );

  assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0, leaseLost: 0 });
  assert.equal(linkedProviderOrderId, 'sandbox-order-000001');
  assert.equal(sandbox.getAcceptedOrders().length, 1);
  assert.equal(retried, false);
});
