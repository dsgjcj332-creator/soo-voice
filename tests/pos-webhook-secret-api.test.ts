import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiApp } from '../src/lib/api.ts';
import { decryptPosCredentials, encryptPosCredentials } from '../src/lib/pos/credentials.ts';

const ownerId = '550e8400-e29b-41d4-a716-446655440000';
const connectionId = '550e8400-e29b-41d4-a716-446655440002';
const accessToken = 'merchant-session-token-abcdefghijklmnopqrstuvwxyz';
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
    key: process.env.POS_CREDENTIALS_ENCRYPTION_KEY,
    version: process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION,
  };
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
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
    if (previous.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.anon;
    if (previous.key === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY; else process.env.POS_CREDENTIALS_ENCRYPTION_KEY = previous.key;
    if (previous.version === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION; else process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = previous.version;
  }
}

function merchantHeaders() {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

test('webhook secret rotation returns plaintext once and preserves encrypted provider credentials', async () => {
  let initial: ReturnType<typeof encryptPosCredentials> | undefined;
  let saved: Record<string, unknown> | undefined;
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_connections' && (!init?.method || init.method === 'GET')) {
      assert.equal(url.searchParams.get('owner_id'), `eq.${ownerId}`);
      initial = encryptPosCredentials({ accessToken: 'vendor-access-token', accountId: 'account-42', webhookSecret: 'old-secret-value' });
      return json([{ id: connectionId, credentials_ciphertext: initial.ciphertext, credentials_key_version: initial.keyVersion }]);
    }
    if (url.pathname === '/rest/v1/pos_connections' && init?.method === 'PATCH') {
      assert.equal(url.searchParams.get('owner_id'), `eq.${ownerId}`);
      assert.ok(initial);
      assert.equal(url.searchParams.get('credentials_ciphertext'), `eq.${initial.ciphertext}`);
      assert.equal(url.searchParams.get('credentials_key_version'), `eq.${initial.keyVersion}`);
      saved = JSON.parse(String(init.body));
      return json([{ id: connectionId }]);
    }
    throw new Error(`UNEXPECTED_REQUEST: ${init?.method || 'GET'} ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections/${connectionId}/webhook-secret`, {
      method: 'POST', headers: merchantHeaders(),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    assert.equal(response.headers.get('pragma'), 'no-cache');
    const body = await response.json() as { secret: string };
    assert.equal(body.secret.length, 43);
    assert.notEqual(body.secret, 'old-secret-value');
    assert.ok(saved);
    assert.equal(saved.credentials_ciphertext?.toString().includes(body.secret), false);
    assert.deepEqual(decryptPosCredentials(String(saved.credentials_ciphertext), String(saved.credentials_key_version)), {
      accessToken: 'vendor-access-token', accountId: 'account-42', webhookSecret: body.secret,
    });
  });
});

test('webhook secret rotation refuses a concurrent credential update without returning a secret', async () => {
  let initial: ReturnType<typeof encryptPosCredentials> | undefined;
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_connections' && (!init?.method || init.method === 'GET')) {
      initial = encryptPosCredentials({ apiKey: 'vendor-key' });
      return json([{ id: connectionId, credentials_ciphertext: initial.ciphertext, credentials_key_version: initial.keyVersion }]);
    }
    if (url.pathname === '/rest/v1/pos_connections' && init?.method === 'PATCH') return json([]);
    throw new Error(`UNEXPECTED_REQUEST: ${init?.method || 'GET'} ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections/${connectionId}/webhook-secret`, {
      method: 'POST', headers: merchantHeaders(),
    });
    assert.equal(response.status, 409);
    const body = await response.json() as Record<string, unknown>;
    assert.equal('secret' in body, false);
  });
});

test('webhook secret rotation cannot read or update another merchant connection', async () => {
  let patchAttempted = false;
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ id: ownerId });
    if (url.pathname === '/rest/v1/pos_connections' && (!init?.method || init.method === 'GET')) {
      assert.equal(url.searchParams.get('owner_id'), `eq.${ownerId}`);
      return json([]);
    }
    if (init?.method === 'PATCH') patchAttempted = true;
    throw new Error(`UNEXPECTED_REQUEST: ${init?.method || 'GET'} ${url.pathname}`);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections/${connectionId}/webhook-secret`, {
      method: 'POST', headers: merchantHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(patchAttempted, false);
  });
});

test('webhook secret rotation requires a verified merchant session', async () => {
  let connectionRead = false;
  await withApi((url, init) => {
    if (url.pathname === '/auth/v1/user') return json({ message: 'unauthorized' }, 401);
    if (url.pathname === '/rest/v1/pos_connections') connectionRead = true;
    return json([]);
  }, async (baseUrl) => {
    const response = await originalFetch(`${baseUrl}/api/pos/connections/${connectionId}/webhook-secret`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(response.status, 401);
    assert.equal(connectionRead, false);
  });
});
