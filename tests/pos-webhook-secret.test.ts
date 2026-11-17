import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decryptPosCredentials, encryptPosCredentials } from '../src/lib/pos/credentials.ts';
import { rotatePosWebhookSecret } from '../src/lib/pos/webhook-secret.ts';

function withKey<T>(run: () => T): T {
  const previousKey = process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
  const previousVersion = process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION;
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = 'test-v1';
  try { return run(); }
  finally {
    if (previousKey === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.POS_CREDENTIALS_ENCRYPTION_KEY = previousKey;
    if (previousVersion === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION;
    else process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = previousVersion;
  }
}

test('webhook secret rotation preserves provider credentials and encrypts the new secret', () => withKey(() => {
  const initial = encryptPosCredentials({ accessToken: 'provider-token', accountId: 'shop-123', webhookSecret: 'old-secret' });
  const rotated = rotatePosWebhookSecret(initial.ciphertext, initial.keyVersion);
  assert.equal(rotated.secret.length, 43);
  assert.notEqual(rotated.secret, 'old-secret');
  assert.equal(rotated.ciphertext.includes(rotated.secret), false);
  assert.deepEqual(decryptPosCredentials(rotated.ciphertext, rotated.keyVersion), {
    accessToken: 'provider-token',
    accountId: 'shop-123',
    webhookSecret: rotated.secret,
  });
}));

test('webhook secret rotation generates a different secret on every request', () => withKey(() => {
  const initial = encryptPosCredentials({ apiKey: 'provider-key' });
  const first = rotatePosWebhookSecret(initial.ciphertext, initial.keyVersion);
  const second = rotatePosWebhookSecret(first.ciphertext, first.keyVersion);
  assert.notEqual(first.secret, second.secret);
  assert.equal(decryptPosCredentials(second.ciphertext, second.keyVersion).webhookSecret, second.secret);
}));

test('webhook secret rotation fails closed when encrypted credentials cannot be decrypted', () => withKey(() => {
  assert.throws(() => rotatePosWebhookSecret('invalid', 'test-v1'), /envelope is invalid/);
}));
