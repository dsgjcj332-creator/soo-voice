import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, parsePosLocationInput } from '../src/lib/pos/location-validation';

const connectionId = '550e8400-e29b-41d4-a716-446655440000';

test('accepts and normalizes a valid branch mapping', () => {
  const result = parsePosLocationInput({
    connectionId,
    providerLocationId: '  branch-01 ',
    name: '  Downtown ',
    timezone: 'Africa/Cairo',
    currency: 'egp',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      connectionId,
      providerLocationId: 'branch-01',
      name: 'Downtown',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
    });
  }
});

test('rejects malformed connection identifiers', () => {
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(parsePosLocationInput({
    connectionId: 'not-a-uuid',
    providerLocationId: 'branch',
    name: 'Main',
  }).ok, false);
});

test('rejects missing and oversized provider identifiers or names', () => {
  assert.equal(parsePosLocationInput({ connectionId, providerLocationId: ' ', name: 'Main' }).ok, false);
  assert.equal(parsePosLocationInput({ connectionId, providerLocationId: 'x'.repeat(161), name: 'Main' }).ok, false);
  assert.equal(parsePosLocationInput({ connectionId, providerLocationId: 'branch', name: 'x'.repeat(121) }).ok, false);
});

test('rejects invalid IANA timezones and currency codes', () => {
  assert.equal(parsePosLocationInput({
    connectionId, providerLocationId: 'branch', name: 'Main', timezone: 'Mars/Olympus',
  }).ok, false);
  assert.equal(parsePosLocationInput({
    connectionId, providerLocationId: 'branch', name: 'Main', currency: 'US',
  }).ok, false);
});

test('allows optional timezone and currency', () => {
  const result = parsePosLocationInput({ connectionId, providerLocationId: 'branch', name: 'Main' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.timezone, null);
    assert.equal(result.value.currency, null);
  }
});
