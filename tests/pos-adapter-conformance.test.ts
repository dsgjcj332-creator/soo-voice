import test from 'node:test';
import assert from 'node:assert/strict';
import { runPosAdapterConformance } from '../src/lib/pos/adapter-conformance.ts';
import type { PosAdapter } from '../src/lib/pos/types.ts';

const context = { merchantId: 'merchant-1', connectionId: 'connection-1' };
const capabilities = {
  menuRead: true, inventoryRead: false, orderCreate: false, orderRead: false,
  orderCancel: false, orderStatusWebhook: false, menuWebhook: true,
  multiLocation: true, modifiers: true, discounts: false, taxes: false,
};
const catalog = [{
  id: 'item-1', providerId: 'provider-item-1', locationIds: ['provider-location-1'],
  name: 'Coffee', currency: 'EGP', unitPrice: 50, available: true,
  modifierGroups: [], updatedAt: '2026-11-18T10:00:00.000Z',
}];

function adapter(overrides: Partial<PosAdapter> = {}): PosAdapter {
  return {
    provider: 'custom',
    getCapabilities: async () => capabilities,
    listLocations: async () => [{
      id: 'local-location-1', providerLocationId: 'provider-location-1',
      name: 'Main branch', currency: 'EGP', active: true,
    }],
    fetchCatalog: async () => catalog,
    createOrder: async () => { throw new Error('must not create orders during conformance'); },
    verifyWebhook: async () => { throw new Error('not part of read-only conformance'); },
    healthCheck: async () => ({ ok: true }),
    ...overrides,
  };
}

test('read-only conformance validates health, location and normalized catalog', async () => {
  let createOrderCalled = false;
  const result = await runPosAdapterConformance(adapter({
    createOrder: async () => {
      createOrderCalled = true;
      throw new Error('unexpected order creation');
    },
  }), context, 'provider-location-1');
  assert.equal(result.provider, 'custom');
  assert.equal(result.catalogItemCount, 1);
  assert.deepEqual(result.checks.map(row => row.name), [
    'capabilities', 'health', 'locations', 'location_scope', 'catalog',
  ]);
  assert.equal(createOrderCalled, false);
});

test('conformance rejects capability contradictions', async () => {
  await assert.rejects(
    runPosAdapterConformance(adapter({
      getCapabilities: async () => ({ ...capabilities, orderCancel: true }),
    }), context),
    /POS_ADAPTER_CANCEL_REQUIRES_ORDER_READ/,
  );
});

test('conformance rejects unhealthy adapters', async () => {
  await assert.rejects(
    runPosAdapterConformance(adapter({ healthCheck: async () => ({ ok: false, message: 'offline' }) }), context),
    /POS_ADAPTER_HEALTH_CHECK_FAILED/,
  );
});

test('conformance rejects duplicate provider location identifiers', async () => {
  await assert.rejects(
    runPosAdapterConformance(adapter({
      listLocations: async () => [
        { id: 'a', providerLocationId: 'same', name: 'A', active: true },
        { id: 'b', providerLocationId: 'same', name: 'B', active: true },
      ],
    }), context),
    /POS_ADAPTER_DUPLICATE_LOCATION/,
  );
});

test('conformance rejects inactive or unknown requested locations', async () => {
  await assert.rejects(
    runPosAdapterConformance(adapter(), context, 'unknown-location'),
    /POS_ADAPTER_LOCATION_NOT_AVAILABLE/,
  );
});

test('conformance rejects catalog rows outside the requested provider location', async () => {
  await assert.rejects(
    runPosAdapterConformance(adapter({
      fetchCatalog: async () => catalog.map(item => ({ ...item, locationIds: ['another-location'] })),
    }), context, 'provider-location-1'),
    /POS_ADAPTER_CATALOG_LOCATION_SCOPE_MISMATCH/,
  );
});

test('conformance does not fetch catalog when provider does not support it', async () => {
  let catalogCalled = false;
  const result = await runPosAdapterConformance(adapter({
    getCapabilities: async () => ({ ...capabilities, menuRead: false }),
    fetchCatalog: async () => { catalogCalled = true; return catalog; },
  }), context, 'provider-location-1');
  assert.equal(result.catalogItemCount, null);
  assert.equal(catalogCalled, false);
  assert.deepEqual(result.checks.at(-1), { name: 'catalog', passed: true, detail: 'unsupported' });
});
