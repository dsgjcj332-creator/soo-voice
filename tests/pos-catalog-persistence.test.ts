import test from 'node:test';
import assert from 'node:assert/strict';
import { persistPosCatalogSnapshot, type PosCatalogRpcClient } from '../src/lib/pos/catalog-persistence.ts';

const scope = {
  ownerId: '00000000-0000-4000-8000-000000000001',
  connectionId: '00000000-0000-4000-8000-000000000002',
  locationId: '00000000-0000-4000-8000-000000000003',
  providerLocationId: 'branch-1',
  completeSnapshot: false,
};

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'local-1', providerId: 'provider-1', locationIds: ['branch-1'],
  categoryId: 'drinks', name: 'Tea', description: 'Hot tea',
  currency: 'EGP', unitPrice: 20, available: true, modifierGroups: [],
  updatedAt: '2026-11-17T10:00:00.000Z', ...overrides,
});

test('normalizes and scopes records before calling the privileged snapshot RPC', async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const client: PosCatalogRpcClient = {
    async rpc(name, args) {
      call = { name, args };
      return { data: { received: 1 }, error: null };
    },
  };
  const result = await persistPosCatalogSnapshot(client, {
    ...scope,
    items: [item(), item({ providerId: 'other-branch-item', locationIds: ['branch-2'] })],
  });
  assert.deepEqual(result, { received: 1 });
  assert.equal(call?.name, 'sync_pos_catalog_snapshot');
  assert.equal((call?.args.p_items as unknown[]).length, 1);
  assert.equal(call?.args.p_owner_id, scope.ownerId);
  assert.equal(call?.args.p_complete_snapshot, false);
});

test('does not call RPC for invalid scope or malformed catalog', async () => {
  let calls = 0;
  const client: PosCatalogRpcClient = {
    async rpc() { calls += 1; return { data: null, error: null }; },
  };
  await assert.rejects(persistPosCatalogSnapshot(client, { ...scope, ownerId: 'not-a-uuid', items: [] }), /INVALID_POS_CATALOG_SCOPE/);
  await assert.rejects(persistPosCatalogSnapshot(client, { ...scope, items: [{ nope: true }] }), /INVALID_POS_CATALOG_COLLECTION/);
  assert.equal(calls, 0);
});

test('rejects RPC errors without leaking provider or database details', async () => {
  const client: PosCatalogRpcClient = {
    async rpc() { return { data: null, error: { message: 'private database detail' } }; },
  };
  await assert.rejects(persistPosCatalogSnapshot(client, { ...scope, items: [item()] }), /POS_CATALOG_PERSIST_FAILED/);
});

test('an empty complete snapshot is passed explicitly and only when requested', async () => {
  let args: Record<string, unknown> | undefined;
  const client: PosCatalogRpcClient = {
    async rpc(_name, input) { args = input; return { data: { deactivated: 3 }, error: null }; },
  };
  await persistPosCatalogSnapshot(client, { ...scope, items: [], completeSnapshot: true });
  assert.equal(args?.p_complete_snapshot, true);
  assert.deepEqual(args?.p_items, []);
});
