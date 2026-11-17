import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processOrderOutboxBatch,
  type OrderOutboxEvent,
  type OutboxStore,
  type PosDispatchTarget,
} from '../src/lib/pos/outbox-worker.ts';

const event = (id: string): OrderOutboxEvent => ({
  id,
  order_id: `order_${id}`,
  owner_id: '00000000-0000-4000-8000-000000000001',
  event_type: 'order.created',
  payload: { orderId: `order_${id}` },
  attempts: 0,
});

function storeWith(events: OrderOutboxEvent[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const store: OutboxStore = {
    async claim(workerId, limit, leaseSeconds) {
      calls.push({ method: 'claim', args: [workerId, limit, leaseSeconds] });
      return events;
    },
    async complete(...args) {
      calls.push({ method: 'complete', args });
      return true;
    },
    async retry(...args) {
      calls.push({ method: 'retry', args });
      return 'failed';
    },
  };
  return { store, calls };
}

const target: PosDispatchTarget = {
  provider: 'custom',
  context: {
    merchantId: '00000000-0000-4000-8000-000000000001',
    connectionId: '00000000-0000-4000-8000-000000000002',
    locationId: '00000000-0000-4000-8000-000000000003',
  },
  async createOrder(input) {
    assert.equal(input.localOrderId, 'order_ok');
    return { providerOrderId: 'provider-123', status: 'accepted' };
  },
};

test('worker completes only after explicit provider acceptance', async () => {
  const { store, calls } = storeWith([event('ok')]);
  const result = await processOrderOutboxBatch(
    store,
    'worker-test-0001',
    async () => target,
    (row) => ({
      merchantId: row.owner_id,
      locationId: target.context.locationId!,
      localOrderId: row.order_id,
      idempotencyKey: `soovoice:${row.order_id}`,
      currency: 'XXX',
      lines: [],
      fulfillment: 'dine_in',
    }),
  );
  assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0, leaseLost: 0 });
  assert.equal(calls.filter((call) => call.method === 'complete').length, 1);
  assert.equal(calls.some((call) => call.method === 'retry'), false);
});

test('pending provider acceptance is retried, never marked delivered', async () => {
  const { store, calls } = storeWith([event('pending')]);
  const pendingTarget: PosDispatchTarget = {
    ...target,
    async createOrder() {
      return { providerOrderId: 'provider-pending', status: 'pending' };
    },
  };
  const result = await processOrderOutboxBatch(
    store,
    'worker-test-0002',
    async () => pendingTarget,
    () => ({
      merchantId: pendingTarget.context.merchantId,
      locationId: pendingTarget.context.locationId!,
      localOrderId: 'order_pending',
      idempotencyKey: 'soovoice:order_pending',
      currency: 'XXX',
      lines: [],
      fulfillment: 'dine_in',
    }),
  );
  assert.equal(result.failed, 1);
  assert.equal(calls.some((call) => call.method === 'complete'), false);
  assert.equal(calls.some((call) => call.method === 'retry' && call.args[2] === 'POS_ACCEPTANCE_PENDING'), true);
});

test('missing POS connection is safely retried', async () => {
  const { store, calls } = storeWith([event('missing')]);
  const result = await processOrderOutboxBatch(
    store,
    'worker-test-0003',
    async () => { throw new Error('POS_CONNECTION_NOT_CONFIGURED'); },
    () => { throw new Error('must not build an order without a POS target'); },
  );
  assert.equal(result.failed, 1);
  assert.equal(calls.some((call) => call.method === 'complete'), false);
  assert.equal(calls.some((call) => call.method === 'retry'), true);
});

test('worker rejects invalid batch settings before claiming', async () => {
  const { store, calls } = storeWith([]);
  await assert.rejects(
    processOrderOutboxBatch(store, 'worker-test-0004', async () => target, () => {
      throw new Error('unused');
    }, { limit: 100 }),
    /INVALID_BATCH_LIMIT/,
  );
  assert.equal(calls.length, 0);
});
