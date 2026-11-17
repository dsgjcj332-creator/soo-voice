import test from 'node:test';
import assert from 'node:assert/strict';
import { PosAdapterRegistry } from '../src/lib/pos/registry.ts';
import type { PosAdapter, PosProviderId } from '../src/lib/pos/types.ts';

function adapter(provider: PosProviderId): PosAdapter {
  const unsupported = async (): Promise<never> => {
    throw new Error('Not implemented by registry test adapter');
  };
  return {
    provider,
    getCapabilities: unsupported,
    listLocations: unsupported,
    fetchCatalog: unsupported,
    createOrder: unsupported,
    verifyWebhook: unsupported,
    healthCheck: unsupported,
  };
}

test('registry starts empty and reports registered providers only', () => {
  const registry = new PosAdapterRegistry();
  assert.deepEqual(registry.listRegistered(), []);
  assert.equal(registry.has('foodics'), false);
});

test('register/get/has preserve the exact adapter instance', () => {
  const registry = new PosAdapterRegistry();
  const foodics = adapter('foodics');
  registry.register(foodics);
  assert.equal(registry.has('foodics'), true);
  assert.equal(registry.get('foodics'), foodics);
  assert.deepEqual(registry.listRegistered(), ['foodics']);
});

test('duplicate provider registration is rejected', () => {
  const registry = new PosAdapterRegistry();
  registry.register(adapter('square'));
  assert.throws(() => registry.register(adapter('square')), /already registered/);
  assert.deepEqual(registry.listRegistered(), ['square']);
});

test('unknown/unconfigured provider fails closed', () => {
  const registry = new PosAdapterRegistry();
  assert.throws(() => registry.get('toast'), /not configured/);
});
