import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApprovedPosMenuApplyPlan } from '../src/lib/pos/catalog-apply-planner.ts';
import type { PosCatalogReviewEntry } from '../src/lib/pos/catalog-review-planner.ts';

const entry: PosCatalogReviewEntry = {
  status: 'update',
  providerItemId: 'pos-item-1',
  menuItemId: 'menu-item-1',
  incoming: {
    id: 'pos-item-1',
    providerId: 'pos-item-1',
    locationIds: ['branch-1'],
    name: 'New name',
    description: 'New description',
    currency: 'EGP',
    unitPrice: 125,
    available: true,
    modifierGroups: [],
    updatedAt: '2026-11-17T10:00:00.000Z',
  },
  changes: {
    name: { current: 'Old name', proposed: 'New name', protectedByMerchant: false },
    description: { current: 'Old description', proposed: 'New description', protectedByMerchant: false },
    price: { current: 100, proposed: 125, protectedByMerchant: false },
    available: { current: false, proposed: true, protectedByMerchant: false },
    categoryId: { current: 'old-category', proposed: 'new-category', protectedByMerchant: false },
  },
};

const mapping = {
  providerItemId: 'pos-item-1',
  menuItemId: 'menu-item-1',
  fieldOverrides: {},
};

test('approved apply plan contains only explicitly selected supported fields and optimistic preconditions', () => {
  const plan = buildApprovedPosMenuApplyPlan(entry, mapping, ['name', 'price']);
  assert.deepEqual(plan, {
    menuItemId: 'menu-item-1',
    providerItemId: 'pos-item-1',
    patch: { name: 'New name', price: 125 },
    expected: { name: 'Old name', price: 100 },
  });
});

test('apply plan refuses merchant-protected fields', () => {
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(entry, { ...mapping, fieldOverrides: { price: true } }, ['price']),
    /POS_APPLY_FIELD_PROTECTED/,
  );
});

test('apply plan refuses mapping mismatches and non-update review states', () => {
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(entry, { ...mapping, menuItemId: 'other-menu-item' }, ['name']),
    /POS_APPLY_MAPPING_MISMATCH/,
  );
  assert.throws(
    () => buildApprovedPosMenuApplyPlan({ ...entry, status: 'manual_conflict' }, mapping, ['name']),
    /POS_APPLY_REQUIRES_REVIEWED_UPDATE/,
  );
});

test('apply plan refuses unsupported category and availability fields', () => {
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(entry, mapping, ['available' as never]),
    /POS_APPLY_FIELD_NOT_SUPPORTED/,
  );
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(entry, mapping, ['name', 'categoryId' as never]),
    /POS_APPLY_FIELD_NOT_SUPPORTED/,
  );
});

test('apply plan validates prices and rejects empty or duplicate selections', () => {
  const invalidPrice = {
    ...entry,
    changes: { ...entry.changes, price: { current: 100, proposed: Number.NaN, protectedByMerchant: false } },
  };
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(invalidPrice, mapping, ['price']),
    /POS_APPLY_INVALID_PRICE/,
  );
  assert.throws(() => buildApprovedPosMenuApplyPlan(entry, mapping, []), /POS_APPLY_FIELDS_REQUIRED/);
  assert.throws(() => buildApprovedPosMenuApplyPlan(entry, mapping, ['name', 'name']), /POS_APPLY_FIELDS_REQUIRED/);
});

test('apply plan refuses fields that are unchanged or absent from the review diff', () => {
  const unchanged = {
    ...entry,
    changes: { ...entry.changes, name: { current: 'Same name', proposed: 'Same name', protectedByMerchant: false } },
  };
  assert.throws(
    () => buildApprovedPosMenuApplyPlan(unchanged, mapping, ['name']),
    /POS_APPLY_FIELD_HAS_NO_CHANGE/,
  );
});
