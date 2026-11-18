import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFoodicsOrderPayload,
  deriveFoodicsOrderId,
  mapFoodicsBranchesToLocations,
  mapFoodicsProductsToCatalogItems,
  type FoodicsPricingSource,
} from '../src/lib/pos/foodics/mapping.ts';
import type { FoodicsProduct } from '../src/lib/pos/foodics/client.ts';

const BRANCH = '9cc1b4c5-0000-4000-8000-000000000001';

const PRODUCTS: FoodicsProduct[] = [
  {
    id: '9cc34751-0000-4000-8000-000000000010',
    name: 'Beef Burger',
    price: 50,
    is_active: true,
    is_ready: true,
    selling_method: 1,
    branches: [{ id: BRANCH, pivot: { price: 55, is_active: true, is_in_stock: true } }],
    modifiers: [{
      id: 'mod-1',
      name: 'Sauce',
      pivot: { minimum_options: 1, maximum_options: 2 },
      options: [
        { id: 'opt-bbq', name: 'BBQ', is_active: true, price: 2 },
        { id: 'opt-off', name: 'Disabled', is_active: false, price: 3 },
      ],
    }],
  },
  {
    id: '9cc34751-0000-4000-8000-000000000011',
    name: 'Out of stock',
    price: 30,
    is_active: true,
    is_ready: true,
    branches: [{ id: BRANCH, pivot: { price: 30, is_active: true, is_in_stock: false } }],
  },
  {
    id: '9cc34751-0000-4000-8000-000000000012',
    name: 'Not ready',
    price: 30,
    is_active: true,
    is_ready: false,
    branches: [{ id: BRANCH }],
  },
  {
    id: '9cc34751-0000-4000-8000-000000000013',
    name: 'Other branch only',
    price: 30,
    is_active: true,
    is_ready: true,
    branches: [{ id: 'other-branch' }],
  },
];

test('Foodics branches map to canonical locations', () => {
  const locations = mapFoodicsBranchesToLocations([
    { id: BRANCH, name: 'Downtown', reference: 'dt-1', receives_online_orders: true },
  ]);
  assert.equal(locations.length, 1);
  assert.equal(locations[0].providerLocationId, BRANCH);
  assert.equal(locations[0].name, 'Downtown');
  assert.equal(locations[0].active, true);
});

test('Foodics products map with per-branch price, availability and modifiers', () => {
  const items = mapFoodicsProductsToCatalogItems(PRODUCTS, BRANCH, 'EGP');
  // priced products on this branch: burger + out-of-stock variant; "not ready"
  // still has no pivot price but a base price, so it maps as unavailable.
  assert.equal(items.length, 3);
  const burger = items[0];
  assert.equal(burger.providerId, PRODUCTS[0].id);
  assert.equal(burger.unitPrice, 55);
  assert.equal(burger.available, true);
  assert.equal(burger.currency, 'EGP');
  assert.deepEqual(burger.locationIds, [BRANCH]);
  assert.equal(burger.modifierGroups.length, 1);
  assert.equal(burger.modifierGroups[0].required, true);
  assert.equal(burger.modifierGroups[0].minSelections, 1);
  assert.equal(burger.modifierGroups[0].maxSelections, 2);
  assert.equal(burger.modifierGroups[0].options[0].priceDelta, 2);
  assert.equal(burger.modifierGroups[0].options[0].available, true);
  assert.equal(burger.modifierGroups[0].options[1].available, false);
  const outOfStock = items[1];
  assert.equal(outOfStock.available, false);
  const notReady = items[2];
  assert.equal(notReady.unitPrice, 30);
  assert.equal(notReady.available, false);
});

test('Foodics catalog mapping rejects a non-ISO currency', () => {
  assert.throws(() => mapFoodicsProductsToCatalogItems(PRODUCTS, BRANCH, 'egp'), /FOODICS_CATALOG_CURRENCY_REQUIRED/);
});

test('Foodics order id derivation is stable, unique and UUIDv4-shaped', () => {
  const first = deriveFoodicsOrderId('order-123');
  const second = deriveFoodicsOrderId('order-123');
  const other = deriveFoodicsOrderId('order-456');
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

const PRICING: FoodicsPricingSource = {
  itemPrice: providerItemId => providerItemId === PRODUCTS[0].id ? 55 : null,
  optionPrice: optionId => optionId === 'opt-bbq' ? 2 : null,
};

function baseInput(overrides: Partial<Parameters<typeof buildFoodicsOrderPayload>[0]> = {}) {
  return {
    merchantId: 'merchant-1',
    locationId: BRANCH,
    localOrderId: 'order-123',
    idempotencyKey: 'soovoice:order-123',
    currency: 'EGP',
    lines: [{ catalogItemId: 'menu-1', providerItemId: PRODUCTS[0].id, quantity: 2, modifierOptionIds: ['opt-bbq'] }],
    fulfillment: 'dine_in' as const,
    tableReference: '5',
    notes: 'no onions',
    ...overrides,
  };
}

test('Foodics order payload maps type, branch, prices, options and kitchen notes', () => {
  const payload = buildFoodicsOrderPayload(baseInput(), PRICING);
  assert.equal(payload.id, deriveFoodicsOrderId('order-123'));
  assert.equal(payload.type, 1);
  assert.equal(payload.branch_id, BRANCH);
  assert.equal(payload.products.length, 1);
  assert.equal(payload.products[0].product_id, PRODUCTS[0].id);
  assert.equal(payload.products[0].quantity, 2);
  assert.equal(payload.products[0].unit_price, 55);
  // tableReference is surfaced to the kitchen, never sent as table_id
  assert.ok(payload.products[0].kitchen_notes?.includes('Table: 5'));
  assert.ok(payload.products[0].kitchen_notes?.includes('no onions'));
  assert.equal(payload.products[0].options?.[0].modifier_option_id, 'opt-bbq');
  assert.equal(payload.products[0].options?.[0].unit_price, 2);
  assert.equal((payload as unknown as { table_id?: string }).table_id, undefined);
});

test('Foodics order payload maps fulfillment types', () => {
  assert.equal(buildFoodicsOrderPayload(baseInput({ fulfillment: 'pickup' }), PRICING).type, 2);
  assert.equal(buildFoodicsOrderPayload(baseInput({ fulfillment: 'delivery' }), PRICING).type, 3);
});

test('Foodics order payload includes a trimmed customer name when present', () => {
  const payload = buildFoodicsOrderPayload(baseInput({ customer: { name: '  Ahmed  ' } }), PRICING);
  assert.equal(payload.customer_name, 'Ahmed');
  const without = buildFoodicsOrderPayload(baseInput(), PRICING);
  assert.equal(without.customer_name, undefined);
});

test('Foodics order payload fails closed on unpriced items or options', () => {
  assert.throws(() => buildFoodicsOrderPayload(
    baseInput({ lines: [{ catalogItemId: 'menu-2', providerItemId: 'unknown-item', quantity: 1, modifierOptionIds: [] }] }),
    PRICING,
  ), /FOODICS_ORDER_ITEM_UNPRICED/);
  assert.throws(() => buildFoodicsOrderPayload(
    baseInput({ lines: [{ catalogItemId: 'menu-1', providerItemId: PRODUCTS[0].id, quantity: 1, modifierOptionIds: ['unknown-option'] }] }),
    PRICING,
  ), /FOODICS_ORDER_OPTION_UNPRICED/);
});
