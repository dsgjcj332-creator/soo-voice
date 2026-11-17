import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePosCatalog } from '../src/lib/pos/catalog-normalizer.ts';
import { planPosCatalogSync, type PersistedPosCatalogSnapshot } from '../src/lib/pos/catalog-sync-planner.ts';

const rawItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'local-1',
  providerId: 'vendor-item-1',
  locationIds: ['branch-1'],
  categoryId: 'drinks',
  name: 'Tea',
  description: 'Hot tea',
  currency: 'EGP',
  unitPrice: 25.5,
  available: true,
  modifierGroups: [],
  updatedAt: '2026-11-17T10:00:00.000Z',
  ...overrides,
});

const normalized = (overrides: Record<string, unknown> = {}) =>
  normalizePosCatalog([rawItem(overrides)])[0];

const previous = (overrides: Partial<PersistedPosCatalogSnapshot> = {}): PersistedPosCatalogSnapshot => ({
  providerItemId: 'vendor-item-1',
  sourceUpdatedAt: '2026-11-17T09:00:00.000Z',
  contentFingerprint: 'old-fingerprint',
  ...overrides,
});

test('plans creates and updates using provider IDs scoped to a mapped location', () => {
  const plan = planPosCatalogSync(
    [normalized(), normalized({ id: 'local-2', providerId: 'vendor-item-2' }), normalized({ locationIds: ['branch-other'], providerId: 'other' })],
    [previous()],
    'branch-1',
    { completeSnapshot: false },
  );
  assert.deepEqual(plan.counts, { create: 1, update: 1, unchanged: 0, stale: 0, deactivate: 0 });
  assert.deepEqual(plan.operations.map(row => row.type), ['update', 'create']);
});

test('does not overwrite newer persisted source data with an older provider snapshot', () => {
  const plan = planPosCatalogSync(
    [normalized({ updatedAt: '2026-11-17T08:00:00.000Z' })],
    [previous({ sourceUpdatedAt: '2026-11-17T09:00:00.000Z' })],
    'branch-1',
    { completeSnapshot: true },
  );
  assert.equal(plan.operations[0].type, 'stale');
  assert.equal(plan.counts.deactivate, 0);
});

test('treats same timestamp with different content as stale instead of guessing', () => {
  const plan = planPosCatalogSync(
    [normalized({ name: 'Changed name', updatedAt: '2026-11-17T09:00:00.000Z' })],
    [previous()],
    'branch-1',
    { completeSnapshot: false },
  );
  assert.equal(plan.operations[0].type, 'stale');
});

test('marks exact same timestamp and content unchanged', () => {
  const item = normalized({ updatedAt: '2026-11-17T09:00:00.000Z' });
  const first = planPosCatalogSync([item], [], 'branch-1', { completeSnapshot: false });
  const fingerprint = first.operations[0].type === 'create' ? first.operations[0].contentFingerprint : '';
  const plan = planPosCatalogSync(
    [item],
    [previous({ sourceUpdatedAt: item.updatedAt, contentFingerprint: fingerprint })],
    'branch-1',
    { completeSnapshot: false },
  );
  assert.equal(plan.operations[0].type, 'unchanged');
});

test('only deactivates missing items for an explicitly complete snapshot', () => {
  const partial = planPosCatalogSync([], [previous()], 'branch-1', { completeSnapshot: false });
  const complete = planPosCatalogSync([], [previous()], 'branch-1', { completeSnapshot: true });
  assert.equal(partial.counts.deactivate, 0);
  assert.equal(complete.counts.deactivate, 1);
});

test('rejects duplicate persisted IDs and malformed existing snapshots', () => {
  assert.throws(
    () => planPosCatalogSync([], [previous(), previous()], 'branch-1', { completeSnapshot: false }),
    /DUPLICATE_POS_SYNC_EXISTING_ITEM/,
  );
  assert.throws(
    () => planPosCatalogSync([], [previous({ sourceUpdatedAt: 'bad-date' })], 'branch-1', { completeSnapshot: false }),
    /INVALID_POS_SYNC_EXISTING_SNAPSHOT/,
  );
});
