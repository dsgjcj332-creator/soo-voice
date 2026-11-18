import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  sendCustomPosOrderWebhook,
  type SignedWebhookRequest,
} from '../src/lib/pos/custom-webhook-delivery.ts';
import type { PosCreateOrderInput } from '../src/lib/pos/types.ts';

const credentials = {
  orderWebhookUrl: 'https://bridge.example.com/soovoice/orders',
  orderWebhookSecret: 's'.repeat(48),
};
const input: PosCreateOrderInput = {
  merchantId: '11111111-1111-4111-8111-111111111111',
  locationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  localOrderId: 'order_123',
  idempotencyKey: 'soovoice:order_123',
  currency: 'EGP',
  lines: [{
    catalogItemId: 'menu-1',
    providerItemId: 'vendor-item-1',
    quantity: 2,
    modifierOptionIds: [],
  }],
  fulfillment: 'dine_in',
  tableReference: '12',
};

test('signed universal webhook sends canonical order and verifies signature bytes', async () => {
  let captured: SignedWebhookRequest | undefined;
  const result = await sendCustomPosOrderWebhook(credentials, input, async request => {
    captured = request;
    return { statusCode: 200, body: JSON.stringify({ status: 'accepted', providerOrderId: 'pos-987' }) };
  }, 1795000000);

  assert.equal(result.status, 'accepted');
  assert.equal(result.providerOrderId, 'pos-987');
  assert.ok(captured);
  const expected = createHmac('sha256', credentials.orderWebhookSecret)
    .update(captured!.headers['x-soovoice-timestamp'], 'utf8')
    .update('.', 'utf8')
    .update(captured!.body, 'utf8')
    .digest('hex');
  assert.equal(captured!.headers['x-soovoice-signature'], `sha256=${expected}`);
  assert.equal(captured!.headers['idempotency-key'], 'soovoice:order_123');
  const payload = JSON.parse(captured!.body);
  assert.equal(payload.eventType, 'order.created');
  assert.equal(payload.order.lines[0].providerItemId, 'vendor-item-1');
  assert.equal(payload.order.currency, 'EGP');
});

test('pending provider response is not treated as accepted', async () => {
  await assert.rejects(
    sendCustomPosOrderWebhook(credentials, input, async () => ({
      statusCode: 202,
      body: JSON.stringify({ status: 'pending', providerOrderId: 'pos-pending' }),
    }), 1795000000),
    /POS_ACCEPTANCE_PENDING/,
  );
});

test('rejected provider response is retryable as a failed outbox delivery', async () => {
  await assert.rejects(
    sendCustomPosOrderWebhook(credentials, input, async () => ({
      statusCode: 200,
      body: JSON.stringify({ status: 'rejected', reason: 'closed' }),
    }), 1795000000),
    /POS_ORDER_REJECTED/,
  );
});

test('non-2xx and malformed acknowledgements are never accepted', async () => {
  await assert.rejects(
    sendCustomPosOrderWebhook(credentials, input, async () => ({ statusCode: 503, body: '{}' }), 1795000000),
    /POS_WEBHOOK_REMOTE_UNAVAILABLE/,
  );
  await assert.rejects(
    sendCustomPosOrderWebhook(credentials, input, async () => ({ statusCode: 200, body: '{}' }), 1795000000),
    /POS_WEBHOOK_INVALID_RESPONSE/,
  );
});

test('unsafe URLs and weak secrets are rejected before network transport', async () => {
  let called = false;
  const transport = async () => {
    called = true;
    return { statusCode: 200, body: JSON.stringify({ status: 'accepted', providerOrderId: 'p1' }) };
  };
  await assert.rejects(
    sendCustomPosOrderWebhook({ ...credentials, orderWebhookUrl: 'http://bridge.example.com/orders' }, input, transport, 1795000000),
    /POS_WEBHOOK_URL_NOT_ALLOWED/,
  );
  await assert.rejects(
    sendCustomPosOrderWebhook({ ...credentials, orderWebhookUrl: 'https://127.0.0.1/orders' }, input, transport, 1795000000),
    /POS_WEBHOOK_URL_NOT_ALLOWED/,
  );
  await assert.rejects(
    sendCustomPosOrderWebhook({ ...credentials, orderWebhookSecret: 'short' }, input, transport, 1795000000),
    /POS_ORDER_WEBHOOK_CREDENTIALS_MISSING/,
  );
  assert.equal(called, false);
});
