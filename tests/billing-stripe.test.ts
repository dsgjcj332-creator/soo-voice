import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { StripeClient, mapStripeStatus, mapStripeSubscription } from '../src/lib/billing/stripe/client.ts';

const originalFetch = globalThis.fetch;
const SECRET_KEY = 'sk_test_secret_key_value_0123456789';

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test.afterEach(() => { globalThis.fetch = originalFetch; });

test('Stripe checkout session posts the documented form-encoded parameters', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return jsonResponse({
      id: 'cs_test_abc123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_abc123',
      object: 'checkout.session',
    });
  }) as typeof fetch;
  const client = new StripeClient({ secretKey: SECRET_KEY });
  const session = await client.createCheckoutSession({
    planName: 'Pro Plan',
    currency: 'EGP',
    amountMinor: 4900,
    billingInterval: 'monthly',
    clientReferenceId: '550e8400-e29b-41d4-a716-446655440000',
    customerEmail: 'merchant@example.com',
    metadata: { owner_id: '550e8400-e29b-41d4-a716-446655440000', plan_id: 'p-1', price_id: 'pr-1' },
    successUrl: 'https://app.example.com/settings?billing=checkout-success',
    cancelUrl: 'https://app.example.com/settings?billing=checkout-cancel',
  });
  assert.equal(session.id, 'cs_test_abc123');
  assert.ok(session.url.startsWith('https://checkout.stripe.com/'));
  const request = requests[0];
  assert.equal(request.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal((request.init?.headers as Record<string, string>).Authorization, `Bearer ${SECRET_KEY}`);
  assert.equal((request.init?.headers as Record<string, string>)['Content-Type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(String(request.init?.body));
  assert.equal(form.get('mode'), 'subscription');
  assert.equal(form.get('line_items[0][quantity]'), '1');
  assert.equal(form.get('line_items[0][price_data][currency]'), 'egp');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '4900');
  assert.equal(form.get('line_items[0][price_data][recurring][interval]'), 'month');
  assert.equal(form.get('line_items[0][price_data][product_data][name]'), 'Pro Plan');
  assert.equal(form.get('client_reference_id'), '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(form.get('customer_email'), 'merchant@example.com');
  assert.equal(form.get('metadata[plan_id]'), 'p-1');
  assert.equal(form.get('subscription_data[metadata][plan_id]'), 'p-1');
});

test('Stripe yearly interval and missing price map correctly', async () => {
  globalThis.fetch = (async () => jsonResponse({
    error: { message: 'No such plan', type: 'invalid_request_error' },
  }, 400)) as typeof fetch;
  const client = new StripeClient({ secretKey: SECRET_KEY });
  await assert.rejects(
    client.createCheckoutSession({
      planName: 'Pro', currency: 'usd', amountMinor: 100, billingInterval: 'yearly',
      clientReferenceId: 'x', metadata: {}, successUrl: 'https://a.example/s', cancelUrl: 'https://a.example/c',
    }),
    /STRIPE_REQUEST_FAILED_400: No such plan/,
  );
  await assert.rejects(
    client.createCheckoutSession({
      planName: 'Pro', currency: 'usd', amountMinor: 100.5, billingInterval: 'monthly',
      clientReferenceId: 'x', metadata: {}, successUrl: 'https://a.example/s', cancelUrl: 'https://a.example/c',
    }),
    /STRIPE_AMOUNT_INVALID/,
  );
  await assert.rejects(
    client.createCheckoutSession({
      planName: 'Pro', currency: 'egyptian', amountMinor: 100, billingInterval: 'monthly',
      clientReferenceId: 'x', metadata: {}, successUrl: 'https://a.example/s', cancelUrl: 'https://a.example/c',
    }),
    /STRIPE_CURRENCY_INVALID/,
  );
});

test('Stripe subscription update posts cancel_at_period_end as a boolean param', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return jsonResponse({
      id: 'sub_1234567890',
      status: 'active',
      cancel_at_period_end: true,
      canceled_at: null,
      current_period_start: 1700000000,
      current_period_end: 1702592000,
      metadata: { plan_key: 'pro' },
    });
  }) as typeof fetch;
  const client = new StripeClient({ secretKey: SECRET_KEY });
  const subscription = await client.setSubscriptionCancelAtPeriodEnd('sub_1234567890', true);
  const form = new URLSearchParams(String(requests[0].init?.body));
  assert.equal(form.get('cancel_at_period_end'), 'true');
  assert.equal(subscription.cancelAtPeriodEnd, true);
  assert.equal(subscription.currentPeriodEnd, new Date(1702592000 * 1000).toISOString());
  await assert.rejects(client.setSubscriptionCancelAtPeriodEnd('not-a-sub', true), /STRIPE_SUBSCRIPTION_ID_INVALID/);
});

test('Stripe webhook signature verifies the documented v1 HMAC scheme', () => {
  const secret = 'whsec_test_endpoint_signing_secret_0123456789';
  const payload = JSON.stringify({
    id: 'evt_test_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', subscription: 'sub_1234567890' } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const header = `t=${timestamp},v1=${expected}`;
  const event = StripeClient.verifyWebhookSignature(payload, header, secret);
  assert.equal(event.id, 'evt_test_1');
  assert.equal(event.type, 'checkout.session.completed');
  const object = event.data.object as { subscription?: string };
  assert.equal(object.subscription, 'sub_1234567890');
});

test('Stripe webhook signature rejects tampered, stale and malformed headers', () => {
  const secret = 'whsec_test_endpoint_signing_secret_0123456789';
  const payload = '{"id":"evt_1","type":"x","data":{"object":{}}}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  // Tampered body
  assert.throws(
    () => StripeClient.verifyWebhookSignature('{"id":"evt_1","type":"y","data":{"object":{}}}', `t=${timestamp},v1=${signature}`, secret),
    /STRIPE_WEBHOOK_SIGNATURE_INVALID/,
  );
  // Wrong secret
  assert.throws(
    () => StripeClient.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, 'whsec_other_secret_value_0123456789'),
    /STRIPE_WEBHOOK_SIGNATURE_INVALID/,
  );
  // Stale timestamp beyond tolerance
  assert.throws(
    () => StripeClient.verifyWebhookSignature(payload, `t=${timestamp},v1=${signature}`, secret, { toleranceSeconds: 300, nowSeconds: timestamp + 301 }),
    /STRIPE_WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE/,
  );
  // Missing header entries
  assert.throws(() => StripeClient.verifyWebhookSignature(payload, 't=123', secret), /STRIPE_WEBHOOK_SIGNATURE_INVALID/);
  assert.throws(() => StripeClient.verifyWebhookSignature(payload, '', secret), /STRIPE_WEBHOOK_SIGNATURE_INVALID/);
});

test('Stripe webhook signature accepts rolled secrets and ignores debug entries', () => {
  const oldSecret = 'whsec_old_signing_secret_0123456789abcdef';
  const newSecret = 'whsec_new_signing_secret_0123456789abcdef';
  const payload = '{"id":"evt_1","type":"x","data":{"object":{}}}';
  const timestamp = Math.floor(Date.now() / 1000);
  const oldSignature = crypto.createHmac('sha256', oldSecret).update(`${timestamp}.${payload}`).digest('hex');
  const newSignature = crypto.createHmac('sha256', newSecret).update(`${timestamp}.${payload}`).digest('hex');
  // Header with debug metadata (v0, secret, destination, payload) and both v1s
  const header = [
    `t=${timestamp}`,
    `v1=${newSignature}`,
    `v0=${'0'.repeat(64)}`,
    `secret=${newSecret.slice(0, 8)}****`,
    'destination=we_endpoint123',
    `payload=${'a'.repeat(8)}`,
    `v1=${oldSignature}`,
  ].join(',');
  const event = StripeClient.verifyWebhookSignature(payload, header, newSecret);
  assert.equal(event.id, 'evt_1');
  // v0-only (sandbox) signature must never authenticate
  assert.throws(
    () => StripeClient.verifyWebhookSignature(payload, `t=${timestamp},v0=${'0'.repeat(64)}`, newSecret),
    /STRIPE_WEBHOOK_SIGNATURE_INVALID/,
  );
});

test('Stripe status and subscription mapping covers the documented statuses', () => {
  assert.equal(mapStripeStatus('active'), 'active');
  assert.equal(mapStripeStatus('unpaid'), 'past_due');
  assert.equal(mapStripeStatus('incomplete_expired'), 'expired');
  assert.equal(mapStripeStatus('mystery'), 'incomplete');
  const mapped = mapStripeSubscription({
    id: 'sub_1', status: 'trialing', cancel_at_period_end: false, canceled_at: null,
    current_period_start: 1700000000, current_period_end: 1702592000, metadata: { plan_key: 'pro' },
  });
  assert.equal(mapped.status, 'trialing');
  assert.equal(mapped.currentPeriodStart, new Date(1700000000 * 1000).toISOString());
  assert.deepEqual(mapped.metadata, { plan_key: 'pro' });
});
