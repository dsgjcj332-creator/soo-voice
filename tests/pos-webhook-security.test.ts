import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signPosWebhookForTest, verifyPosWebhookSignature } from '../src/lib/pos/webhook-security';

const secret = 'a'.repeat(48);
const body = Buffer.from(JSON.stringify({ eventId: 'evt_1', eventType: 'catalog.snapshot' }));
const timestamp = '1795000000';

test('POS webhook signature accepts valid raw-body HMAC inside timestamp window', () => {
  const signature = signPosWebhookForTest(body, timestamp, secret);
  assert.equal(verifyPosWebhookSignature({ timestamp, signature, rawBody: body, secret, nowSeconds: 1795000000 }), true);
});

test('POS webhook signature rejects modified body and malformed signature', () => {
  const signature = signPosWebhookForTest(body, timestamp, secret);
  assert.equal(verifyPosWebhookSignature({ timestamp, signature, rawBody: Buffer.from('tampered'), secret, nowSeconds: 1795000000 }), false);
  assert.equal(verifyPosWebhookSignature({ timestamp, signature: 'sha256=bad', rawBody: body, secret, nowSeconds: 1795000000 }), false);
});

test('POS webhook signature rejects stale and future timestamps', () => {
  const signature = signPosWebhookForTest(body, timestamp, secret);
  assert.equal(verifyPosWebhookSignature({ timestamp, signature, rawBody: body, secret, nowSeconds: 1795000400 }), false);
  assert.equal(verifyPosWebhookSignature({ timestamp: '1795001000', signature, rawBody: body, secret, nowSeconds: 1795000000 }), false);
});

test('POS webhook signature fails closed for weak secrets and missing headers', () => {
  assert.equal(verifyPosWebhookSignature({ timestamp, signature: undefined, rawBody: body, secret, nowSeconds: 1795000000 }), false);
  assert.equal(verifyPosWebhookSignature({ timestamp, signature: 'sha256=' + 'a'.repeat(64), rawBody: body, secret: 'short', nowSeconds: 1795000000 }), false);
});
