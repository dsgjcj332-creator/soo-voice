import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseOutboxStore } from '../src/lib/pos/supabase-outbox-store.ts';
import type { PosDispatchTarget } from '../src/lib/pos/outbox-worker.ts';

const target: PosDispatchTarget = {
  provider: 'custom',
  context: {
    merchantId: '11111111-1111-4111-8111-111111111111',
    connectionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    locationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  },
  async createOrder() {
    return { status: 'accepted', providerOrderId: 'pos-1' };
  },
};

test('Supabase outbox store claims durable events using the lease RPC', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const store = new SupabaseOutboxStore('https://db.example.com/', 'service-key', async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify([{
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      order_id: 'order-1',
      owner_id: '11111111-1111-4111-8111-111111111111',
      event_type: 'order.created',
      payload: { orderId: 'order-1', items: [{ id: 'menu-1', quantity: 1 }] },
      attempts: 0,
    }]), { status: 200 });
  });
  const rows = await store.claim('worker-test-0001', 10, 120);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].order_id, 'order-1');
  assert.equal(calls[0].url, 'https://db.example.com/rest/v1/rpc/claim_order_outbox');
  assert.equal(calls[0].body.p_lease_seconds, 120);
});

test('Supabase outbox store acknowledges accepted provider IDs with the leased connection', async () => {
  let sent: Record<string, unknown> | undefined;
  const store = new SupabaseOutboxStore('https://db.example.com', 'service-key', async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response('true', { status: 200 });
  });
  const completed = await store.complete('event-1', 'worker-test-0001', target, 'provider-123');
  assert.equal(completed, true);
  assert.equal(sent?.p_provider_id, 'custom');
  assert.equal(sent?.p_connection_id, target.context.connectionId);
  assert.equal(sent?.p_location_id, target.context.locationId);
  assert.equal(sent?.p_provider_order_id, 'provider-123');
});

test('Supabase outbox store accepts only known retry states', async () => {
  const store = new SupabaseOutboxStore('https://db.example.com', 'service-key', async () =>
    new Response(JSON.stringify('dead_letter'), { status: 200 }));
  assert.equal(await store.retry('event-1', 'worker-test-0001', 'POS_ORDER_REJECTED'), 'dead_letter');
  const invalid = new SupabaseOutboxStore('https://db.example.com', 'service-key', async () =>
    new Response(JSON.stringify('processing'), { status: 200 }));
  await assert.rejects(invalid.retry('event-1', 'worker-test-0001', 'BAD'), /OUTBOX_RETRY_INVALID_RESPONSE/);
});

test('Supabase outbox store fails closed on RPC errors', async () => {
  const store = new SupabaseOutboxStore('https://db.example.com', 'service-key', async () =>
    new Response('database error', { status: 500 }));
  await assert.rejects(store.claim('worker-test-0001', 10, 120), /OUTBOX_RPC_CLAIM_ORDER_OUTBOX_FAILED/);
});
