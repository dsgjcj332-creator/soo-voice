import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApiApp } from '../src/lib/api.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const accessToken = 'merchant-session-token-abcdefghijklmnopqrstuvwxyz';
const planId = '650e8400-e29b-41d4-a716-446655440001';
const priceId = '650e8400-e29b-41d4-a716-446655440002';
const subscriptionRowId = '650e8400-e29b-41d4-a716-446655440003';
const stripeSubscriptionId = 'sub_1234567890abcdef';
const webhookSecret = 'whsec_test_endpoint_signing_secret_0123456789';
const apiKey = 'test-api-key-value-0123456789';

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
    apiKey: process.env.API_KEY,
    stripeKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    successUrl: process.env.BILLING_CHECKOUT_SUCCESS_URL,
    cancelUrl: process.env.BILLING_CHECKOUT_CANCEL_URL,
    posKey: process.env.POS_CREDENTIALS_ENCRYPTION_KEY,
    posVersion: process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION,
  };
  process.env.SUPABASE_URL = 'https://soo-voice-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.STRIPE_SECRET_KEY = 'sk_test_secret_key_value_0123456789';
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = 'test-v1';
  delete process.env.BILLING_CHECKOUT_SUCCESS_URL;
  delete process.env.BILLING_CHECKOUT_CANCEL_URL;

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

function merchantHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...extra };
}

function signedWebhook(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex');
  return { body, header: `t=${timestamp},v1=${signature}` };
}

function supabaseBase(url: URL) {
  return url.hostname === 'soo-voice-test.supabase.co';
}

test('billing plans lists active plans with their prices', async () => {
  await withApi((url, init) => {
    if (!supabaseBase(url)) return json({}, 404);
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/billing_plans') {
      return json([{ id: planId, plan_key: 'pro', display_name: 'Pro', description: null, features: {}, usage_limits: {} }]);
    }
    if (url.pathname === '/rest/v1/billing_plan_prices') {
      return json([
        { id: priceId, plan_id: planId, currency: 'EGP', billing_interval: 'monthly', amount_minor: 4900 },
        { id: priceId, plan_id: planId, currency: 'EGP', billing_interval: 'yearly', amount_minor: 49000 },
      ]);
    }
    void init;
    return json({}, 404);
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/billing/plans`, { headers: merchantHeaders() });
    assert.equal(response.status, 200);
    const body = await response.json() as Array<{ plan_key: string; prices: Array<{ billing_interval: string }> }>;
    assert.equal(body.length, 1);
    assert.equal(body[0].plan_key, 'pro');
    assert.equal(body[0].prices.length, 2);
  });
});

test('billing subscription resolves entitlements with the merchant JWT, not the service key', async () => {
  await withApi((url, init) => {
    if (!supabaseBase(url)) return json({}, 404);
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/rpc/get_my_billing_entitlements') {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      assert.equal(headers.apikey, 'anon-test-key');
      assert.equal(headers.Authorization, `Bearer ${accessToken}`);
      return json({ plan_key: 'pro', status: 'active', entitlements: { voice_minutes: 5000 } });
    }
    return json({}, 404);
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/billing/subscription`, { headers: merchantHeaders() });
    assert.equal(response.status, 200);
    const body = await response.json() as { plan_key: string };
    assert.equal(body.plan_key, 'pro');
  });
});

test('billing checkout creates a Stripe subscription session for the selected price', async () => {
  await withApi((url, init) => {
    if (url.href === 'https://api.stripe.com/v1/checkout/sessions') {
      return json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1', object: 'checkout.session' });
    }
    if (!supabaseBase(url)) return json({}, 404);
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/billing_plans') {
      if (url.searchParams.get('plan_key') !== 'eq.pro') return json([]);
      return json([{ id: planId, plan_key: 'pro', display_name: 'Pro' }]);
    }
    if (url.pathname === '/rest/v1/billing_plan_prices') return json([{ id: priceId, amount_minor: 4900 }]);
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const response = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST', headers: merchantHeaders(),
      body: JSON.stringify({ planKey: 'pro', billingInterval: 'monthly', currency: 'EGP' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { checkoutUrl: string; sessionId: string };
    assert.equal(body.sessionId, 'cs_test_1');
    assert.ok(body.checkoutUrl.startsWith('https://checkout.stripe.com/'));
    const stripeRequest = requests.find(request => request.url.href === 'https://api.stripe.com/v1/checkout/sessions');
    assert.ok(stripeRequest, 'expected a Stripe checkout request');
    const form = new URLSearchParams(String(stripeRequest.init?.body));
    assert.equal(form.get('mode'), 'subscription');
    assert.equal(form.get('line_items[0][price_data][unit_amount]'), '4900');
    assert.equal(form.get('line_items[0][price_data][recurring][interval]'), 'month');
    assert.equal(form.get('client_reference_id'), ownerId);
    assert.equal(form.get('metadata[price_id]'), priceId);
    assert.equal(form.get('metadata[billing_interval]'), 'monthly');
    // Hosted checkout redirect target echoes the request origin by default.
    assert.ok((form.get('success_url') ?? '').startsWith('http://127.0.0.1:'), form.get('success_url') ?? '');
    const missingPrice = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST', headers: merchantHeaders(),
      body: JSON.stringify({ planKey: 'nope', billingInterval: 'monthly', currency: 'EGP' }),
    });
    assert.equal(missingPrice.status, 404);
    const invalid = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST', headers: merchantHeaders(),
      body: JSON.stringify({ planKey: 'pro', billingInterval: 'weekly', currency: 'EGP' }),
    });
    assert.equal(invalid.status, 400);
  });
});

test('stripe webhook activates, updates and cancels merchant subscriptions idempotently', async () => {
  await withApi((url, init) => {
    if (url.href.startsWith('https://api.stripe.com/v1/subscriptions/')) {
      return json({
        id: stripeSubscriptionId, status: 'active', cancel_at_period_end: false,
        canceled_at: null, current_period_start: 1700000000, current_period_end: 1702592000,
        metadata: {},
      });
    }
    if (!supabaseBase(url)) return json({}, 404);
    if (url.pathname === '/rest/v1/merchant_subscriptions' && (!init?.method || init.method === 'GET')) {
      return json([]);
    }
    if (url.pathname === '/rest/v1/merchant_subscriptions' && init?.method === 'POST') {
      const rows = JSON.parse(String(init.body)) as Array<Record<string, unknown>>;
      return json([{ id: subscriptionRowId, ...rows[0] }]);
    }
    if (url.pathname === '/rest/v1/merchant_subscriptions' && init?.method === 'PATCH') {
      const patch = JSON.parse(String(init.body)) as Record<string, unknown>;
      return json([{ id: subscriptionRowId, ...patch }]);
    }
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const activated = signedWebhook({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          client_reference_id: ownerId,
          subscription: stripeSubscriptionId,
          customer: 'cus_123',
          metadata: { plan_id: planId, price_id: priceId, billing_interval: 'monthly', currency: 'EGP' },
        },
      },
    });
    const activateResponse = await fetch(`${baseUrl}/api/billing/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': activated.header },
      body: activated.body,
    });
    assert.equal(activateResponse.status, 200);
    const activateBody = await activateResponse.json() as { handled: string; subscriptionId?: string };
    assert.equal(activateBody.handled, 'subscription_activated');
    const insertRequest = requests.find(request => request.init?.method === 'POST' && request.url.pathname === '/rest/v1/merchant_subscriptions');
    assert.ok(insertRequest, 'expected subscription insert');
    const inserted = JSON.parse(String(insertRequest.init?.body))[0] as Record<string, unknown>;
    assert.equal(inserted.owner_id, ownerId);
    assert.equal(inserted.plan_id, planId);
    assert.equal(inserted.price_id, priceId);
    assert.equal(inserted.payment_provider, 'stripe');
    assert.equal(inserted.external_subscription_id, stripeSubscriptionId);
    assert.equal(inserted.current_period_end, new Date(1702592000 * 1000).toISOString());

    // Renewal / status change flows through customer.subscription.updated
    const updated = signedWebhook({
      id: 'evt_sub_updated_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: stripeSubscriptionId, status: 'past_due', cancel_at_period_end: false,
          canceled_at: null, current_period_start: 1702592000, current_period_end: 1705184000,
        },
      },
    });
    const updateResponse = await fetch(`${baseUrl}/api/billing/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': updated.header },
      body: updated.body,
    });
    assert.equal(updateResponse.status, 200);
    const updateBody = await updateResponse.json() as { handled: string };
    assert.equal(updateBody.handled, 'subscription_updated');
    const patchRequest = requests.filter(request => request.init?.method === 'PATCH').pop();
    assert.ok(patchRequest, 'expected subscription patch');
    assert.equal(JSON.parse(String(patchRequest.init?.body)).status, 'past_due');

    // Cancelation at period end
    const deleted = signedWebhook({
      id: 'evt_sub_deleted_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: stripeSubscriptionId, status: 'canceled', cancel_at_period_end: false,
          canceled_at: 1702593000, current_period_start: 1700000000, current_period_end: 1702592000,
        },
      },
    });
    const deleteResponse = await fetch(`${baseUrl}/api/billing/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': deleted.header },
      body: deleted.body,
    });
    assert.equal(deleteResponse.status, 200);
    const deleteBody = await deleteResponse.json() as { handled: string };
    assert.equal(deleteBody.handled, 'subscription_updated');

    // Forged signature is rejected
    const forged = signedWebhook({ id: 'evt_forge', type: 'checkout.session.completed', data: { object: {} } });
    const forgedResponse = await fetch(`${baseUrl}/api/billing/webhooks/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=1234,v1=${'f'.repeat(64)}` },
      body: forged.body,
    });
    assert.equal(forgedResponse.status, 400);
    const forgedBody = await forgedResponse.json() as { error?: string };
    assert.equal(forgedBody.error, 'STRIPE_WEBHOOK_SIGNATURE_INVALID');
  });
});

test('billing subscription cancel defers to Stripe and mirrors the gateway flag', async () => {
  await withApi((url, init) => {
    if (url.href === `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}` && init?.method === 'POST') {
      const form = new URLSearchParams(String(init.body));
      assert.equal(form.get('cancel_at_period_end'), 'true');
      return json({
        id: stripeSubscriptionId, status: 'active', cancel_at_period_end: true,
        canceled_at: null, current_period_start: 1700000000, current_period_end: 1702592000, metadata: {},
      });
    }
    if (!supabaseBase(url)) return json({}, 404);
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/merchant_subscriptions' && (!init?.method || init.method === 'GET')) {
      return json([{
        id: subscriptionRowId, status: 'active', payment_provider: 'stripe',
        external_subscription_id: stripeSubscriptionId, cancel_at_period_end: false,
      }]);
    }
    if (url.pathname === '/rest/v1/merchant_subscriptions' && init?.method === 'PATCH') return json([{ id: subscriptionRowId }]);
    return json({}, 404);
  }, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/billing/subscription/cancel`, {
      method: 'POST', headers: merchantHeaders(), body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null };
    assert.equal(body.cancelAtPeriodEnd, true);
    assert.equal(body.currentPeriodEnd, new Date(1702592000 * 1000).toISOString());
  });
});

test('billing routes reject unauthenticated callers', async () => {
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/billing/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey: 'pro', billingInterval: 'monthly', currency: 'EGP' }),
    });
    assert.equal(response.status, 401);
    const subscription = await fetch(`${baseUrl}/api/billing/subscription`);
    assert.equal(subscription.status, 401);
  });
});

test('billing health probe reports configuration flags without leaking secrets', async () => {
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health/billing`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      status: string;
      billing: Record<string, unknown>;
    };
    assert.equal(body.status, 'ok');
    assert.equal(body.billing.stripeConfigured, true);
    assert.equal(body.billing.stripeWebhookConfigured, true);
    assert.equal(body.billing.posBackendConfigured, true);
    assert.equal(body.billing.posCredentialsEncryptionConfigured, true);
    assert.equal(body.billing.foodicsOAuthConfigured, false);
    assert.equal(body.billing.stripeCheckoutRedirectsConfigured, false);
    // Probe responses must never carry secret material.
    const serialized = JSON.stringify(body);
    assert.ok(!serialized.includes('sk_test_secret_key_value_0123456789'));
    assert.ok(!serialized.includes(webhookSecret));
  });
});
