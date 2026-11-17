import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePosCatalog } from '../src/lib/pos/catalog-normalizer.ts';

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'local-1',
  providerId: 'vendor-item-1',
  locationIds: ['branch-1'],
  categoryId: 'drinks',
  name: 'Tea',
  description: 'Hot tea',
  currency: 'EGP',
  unitPrice: 25.5,
  available: true,
  modifierGroups: [{
    id: 'size',
    providerId: 'vendor-size',
    name: 'Size',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: 'small', providerId: 's', name: 'Small', priceDelta: 0, available: true },
      { id: 'large', providerId: 'l', name: 'Large', priceDelta: 5, available: true },
    ],
  }],
  updatedAt: '2026-11-17T10:00:00.000Z',
  ...overrides,
});

test('normalizes a valid provider catalog and canonicalizes timestamps', () => {
  const [normalized] = normalizePosCatalog([item()]);
  assert.equal(normalized.unitPrice, 25.5);
  assert.equal(normalized.currency, 'EGP');
  assert.equal(normalized.updatedAt, '2026-11-17T10:00:00.000Z');
  assert.equal(normalized.modifierGroups[0].options[1].priceDelta, 5);
});

test('supports negative modifier price deltas while keeping item prices non-negative', () => {
  const row = item();
  (row.modifierGroups[0].options[0] as { priceDelta: number }).priceDelta = -2.5;
  assert.equal(normalizePosCatalog([row])[0].modifierGroups[0].options[0].priceDelta, -2.5);
  assert.throws(() => normalizePosCatalog([item({ unitPrice: -1 })]), /UNIT_PRICE/);
});

test('rejects malformed currency, non-finite prices and invalid timestamps', () => {
  assert.throws(() => normalizePosCatalog([item({ currency: 'egp' })]), /CURRENCY/);
  assert.throws(() => normalizePosCatalog([item({ unitPrice: Number.NaN })]), /UNIT_PRICE/);
  assert.throws(() => normalizePosCatalog([item({ updatedAt: 'not-a-date' })]), /UPDATED_AT/);
});

test('rejects duplicate provider item IDs and duplicate branch IDs', () => {
  assert.throws(() => normalizePosCatalog([item(), item({ id: 'local-2' })]), /DUPLICATE_POS_CATALOG_PROVIDER_ITEM/);
  assert.throws(() => normalizePosCatalog([item({ locationIds: ['branch-1', 'branch-1'] })]), /DUPLICATE_POS_CATALOG_LOCATION/);
});

test('rejects invalid modifier selection rules and duplicate options', () => {
  const invalidRequired = item();
  (invalidRequired.modifierGroups[0] as { minSelections: number }).minSelections = 0;
  assert.throws(() => normalizePosCatalog([invalidRequired]), /MODIFIER_REQUIRED/);
  const duplicateOption = item();
  (duplicateOption.modifierGroups[0].options[1] as { id: string }).id = 'small';
  assert.throws(() => normalizePosCatalog([duplicateOption]), /DUPLICATE_POS_CATALOG_MODIFIER_OPTION/);
});

test('rejects oversized or malformed catalog payloads', () => {
  assert.throws(() => normalizePosCatalog({ items: [] }), /INVALID_POS_CATALOG/);
  assert.throws(() => normalizePosCatalog([null]), /INVALID_POS_CATALOG_ITEM/);
});
