import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';

const deadLetterRow = {
  id: '99999999-5555-4555-8555-555555555555',
  order_id: 'order-dead-letter-1',
  owner_id: '550e8400-e29b-41d4-a716-446655440000',
  attempts: 3,
  last_error_code: 'POS_PROVIDER_TIMEOUT',
};

const originalFetch = globalThis.fetch;

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'POS_CREDENTIALS_ENCRYPTION_KEY',
  'POS_CREDENTIALS_ENCRYPTION_KEY_VERSION',
  'CRON_SECRET',
  'POS_OUTBOX_WORKER_SECRET',
] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function withApi(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  run: (baseUrl: string, requests: Array<{ url: URL; init?: RequestInit }>) => Promise<void>,
) {
  const previous = ENV_KEYS.map(key => [key, process.env[key]] as const);
  process.env.SUPABASE_URL = 'https://soo-voice-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = 'test-v1';

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
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test('POS cron dispatch rejects calls when CRON_SECRET is not configured', async () => {
  delete process.env.CRON_SECRET;
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/pos/outbox/cron`, {
      headers: { Authorization: 'Bearer worker-secret-that-is-long-enough-123456' },
    });
    assert.equal(response.status, 503);
    const body = await response.json() as { error?: string };
    assert.equal(body.error, 'POS cron dispatch is not configured');
  });
});

test('POS cron dispatch rejects wrong bearer credentials', async () => {
  process.env.CRON_SECRET = 'cron-secret-value-that-is-long-enough-123456';
  await withApi(async () => json({}), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/pos/outbox/cron`, {
      headers: { Authorization: 'Bearer wrong-secret-value-that-is-long-enough-000000' },
    });
    assert.equal(response.status, 401);
    const body = await response.json() as { error?: string };
    assert.equal(body.error, 'Unauthorized POS cron dispatch');
  });
});

test('POS cron dispatch runs the batch and records dead-letter alerts', async () => {
  process.env.CRON_SECRET = 'cron-secret-value-that-is-long-enough-123456';
  await withApi((url, init) => {
    if (url.pathname === '/rest/v1/rpc/claim_order_outbox') return json([]);
    if (url.pathname === '/rest/v1/order_outbox') {
      assert.equal(url.searchParams.get('status'), 'eq.dead_letter');
      return json([deadLetterRow]);
    }
    if (url.pathname === '/rest/v1/pos_dispatch_alerts') {
      assert.equal((init?.headers as Record<string, string>)?.Prefer, 'resolution=ignore-duplicates,return=representation');
      return json([{ id: 'alert-1' }]);
    }
    return json({}, 404);
  }, async (baseUrl, requests) => {
    const response = await fetch(`${baseUrl}/api/pos/outbox/cron`, {
      headers: { Authorization: 'Bearer cron-secret-value-that-is-long-enough-123456' },
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { claimed: number; delivered: number; failed: number; leaseLost: number; alertsRecorded: number };
    assert.deepEqual(body, { claimed: 0, delivered: 0, failed: 0, leaseLost: 0, alertsRecorded: 1 });
    const alertInsert = requests.find(request => request.url.pathname === '/rest/v1/pos_dispatch_alerts');
    assert.ok(alertInsert, 'expected an alert insert request');
    const payload = JSON.parse(String(alertInsert.init?.body)) as Array<{ event_id: string; error_code: string; attempts: number }>;
    assert.equal(payload.length, 1);
    assert.equal(payload[0].event_id, deadLetterRow.id);
    assert.equal(payload[0].error_code, deadLetterRow.last_error_code);
    assert.equal(payload[0].attempts, deadLetterRow.attempts);
  });
});
