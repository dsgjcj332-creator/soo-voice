import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFoodicsCredentials } from '../src/lib/pos/foodics-credentials.ts';

test('accepts one non-empty Foodics API token and trims surrounding whitespace', () => {
  assert.deepEqual(parseFoodicsCredentials({ apiToken: '  ' + 'x'.repeat(32) + '  }), { apiToken: 'x'.repeat(32) });
});

test('rejects a missing or non-object Foodics credential payload', () => {
  assert.throws(() => parseFoodicsCredentials(null), /FOODICS_CREDENTIALS_INVALID/);
  assert.throws(() => parseFoodicsCredentials({}), /FOODICS_API_TOKEN_REQUIRED/);
  assert.throws(() => parseFoodicsCredentials({ apiKey: 'x'.repeat(32) }), /FOODICS_API_TOKEN_REQUIRED/);
});

test('rejects arbitrary extra fields so tokens cannot be mixed with bridge credentials', () => {
  assert.throws(() => parseFoodicsCredentials({ apiToken: 'x'.repeat(32), orderWebhookSecret: 'y'.repeat(32) }), /FOODICS_API_TOKEN_REQUIRED/);
});

test('rejects short and oversized tokens', () => {
  assert.throws(() => parseFoodicsCredentials({ apiToken: 'short' }), /FOODICS_API_TOKEN_INVALID/);
  assert.throws(() => parseFoodicsCredentials({ apiToken: 'x'.repeat(4097) }), /FOODICS_API_TOKEN_INVALID/);
});
