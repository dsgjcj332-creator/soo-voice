import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decryptPosCredentials, encryptPosCredentials } from '../src/lib/pos/credentials.ts';

function withKey<T>(run: () => T): T {
  const previousKey = process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
  const previousVersion = process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION;
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = 'test-v1';
  try {
    return run();
  } finally {
    if (previousKey === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.POS_CREDENTIALS_ENCRYPTION_KEY = previousKey;
    if (previousVersion === undefined) delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION;
    else process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION = previousVersion;
  }
}

test('POS credentials encrypt and decrypt without storing plaintext', () => withKey(() => {
  const credentials = { accessToken: 'secret-token', accountId: 'merchant-42' };
  const encrypted = encryptPosCredentials(credentials);
  assert.equal(encrypted.keyVersion, 'test-v1');
  assert.equal(encrypted.ciphertext.includes('secret-token'), false);
  assert.deepEqual(decryptPosCredentials(encrypted.ciphertext, encrypted.keyVersion), credentials);
}));

test('POS credential encryption uses a fresh IV for every write', () => withKey(() => {
  const first = encryptPosCredentials({ token: 'same' });
  const second = encryptPosCredentials({ token: 'same' });
  assert.notEqual(first.ciphertext, second.ciphertext);
}));

test('POS credential decryption rejects tampered ciphertext', () => withKey(() => {
  const encrypted = encryptPosCredentials({ token: 'secret' });
  const parts = encrypted.ciphertext.split('.');
  parts[3] = (parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A'));
  assert.throws(() => decryptPosCredentials(parts.join('.'), encrypted.keyVersion), /could not be decrypted/);
}));

test('POS credential decryption rejects an unavailable key version', () => withKey(() => {
  const encrypted = encryptPosCredentials({ token: 'secret' });
  assert.throws(() => decryptPosCredentials(encrypted.ciphertext, 'old-key'), /key version is unavailable/);
}));

test('POS credential encryption fails closed when key is malformed', () => {
  const previous = process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
  delete process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
  try {
    assert.throws(() => encryptPosCredentials({ token: 'secret' }), /32-byte key/);
  } finally {
    if (previous !== undefined) process.env.POS_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});

test('POS credential encryption rejects empty and non-object payloads', () => withKey(() => {
  assert.throws(() => encryptPosCredentials({}), /must not be empty/);
  assert.throws(() => encryptPosCredentials(null as unknown as Record<string, unknown>), /JSON object/);
}));
