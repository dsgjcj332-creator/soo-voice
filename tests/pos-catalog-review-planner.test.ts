import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePosCatalog } from '../src/lib/pos/catalog-normalizer.ts';
import { buildPosCatalogReview, type ExistingMerchantMenuItem } from '../src/lib/pos/catalog-review-planner.ts';

const item = (overrides: Record<string, unknown> = {}) => normalizePosCatalog([{
  id: 'incoming-1', providerId: 'pos-1', locationIds: ['branch-1'],
  name: 'Tea', description: 'Fresh tea', categoryId: 'drinks',
  currency: 'EGP', unitPrice: 30, available: true, modifierGroups: [],
  updatedAt: '2026-11-17T12:00:00.000Z', ...overrides,
}])[0];

const existing = (overrides: Partial<ExistingMerchantMenuItem> = {}): ExistingMerchantMenuItem => ({
  menuItemId: 'menu-1', providerItemId: 'pos-1',
  name: 'My Tea', description: 'House blend', price: 25, available: true,
  categoryId: 'hot-drinks',
  sourceUpdatedAt: '2026-11-17T11:00:00.000Z',
  contentFingerprint: 'stored-fingerprint',
  ...overrides,
});

test('proposes new POS products without writing or applying them', () => {
  const review = buildPosCatalogReview([item()], [], 'branch-1', { completeSnapshot: false });
  assert.equal(review.counts.add, 1);
  assert.equal(review.entries[0].status, 'add');
  assert.equal(review.requiresMerchantApproval, true);
});

test('marks merchant-edited fields as conflicts and exposes both values', () => {
  const review = buildPosCatalogReview([item()], [existing({ overrides: { name: true, price: true } })], 'branch-1', { completeSnapshot: false });
  const row = review.entries[0];
  assert.equal(row.status, 'manual_conflict');
  assert.equal(row.changes.name?.protectedByMerchant, true);
  assert.equal(row.changes.name?.current, 'My Tea');
  assert.equal(row.changes.name?.proposed, 'Tea');
  assert.equal(row.changes.price?.protectedByMerchant, true);
  assert.equal(row.changes.description?.protectedByMerchant, false);
});

test('ordinary provider changes are shown as updates when no merchant override exists', () => {
  const review = buildPosCatalogReview([item()], [existing()], 'branch-1', { completeSnapshot: false });
  assert.equal(review.entries[0].status, 'update');
  assert.equal(review.counts.update, 1);
});

test('does not hide missing menu items for partial snapshots', () => {
  const review = buildPosCatalogReview([], [existing()], 'branch-1', { completeSnapshot: false });
  assert.equal(review.counts.hide, 0);
});

test('proposes hiding missing linked items only for complete snapshots', () => {
  const review = buildPosCatalogReview([], [existing()], 'branch-1', { completeSnapshot: true });
  assert.equal(review.counts.hide, 1);
  assert.equal(review.entries[0].menuItemId, 'menu-1');
});

test('keeps stale provider snapshots out of the update proposal', () => {
  const review = buildPosCatalogReview([item({ updatedAt: '2026-11-17T10:00:00.000Z' })], [existing()], 'branch-1', { completeSnapshot: false });
  assert.equal(review.counts.stale, 1);
  assert.deepEqual(review.entries[0].changes, {});
});

test('rejects duplicate existing provider links', () => {
  assert.throws(() => buildPosCatalogReview([item()], [existing(), existing({ menuItemId: 'menu-2' })], 'branch-1', { completeSnapshot: false }), /INVALID_POS_REVIEW_EXISTING_ITEM/);
});
