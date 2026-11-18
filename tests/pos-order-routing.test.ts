import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTableReference, selectPosOrderRoute, type PosOrderRoute } from '../src/lib/pos/order-routing.ts';

const north: PosOrderRoute = {
  id: 'route-default', connection_id: 'conn-north', location_id: 'loc-north',
  route_type: 'default', route_value: null,
};
const southTable: PosOrderRoute = {
  id: 'route-table-t12', connection_id: 'conn-south', location_id: 'loc-south',
  route_type: 'table', route_value: 'T12',
};

test('normalizes table references without changing internal punctuation', () => {
  assert.equal(normalizeTableReference('  t12  '), 'T12');
  assert.equal(normalizeTableReference('Table-2'), 'TABLE-2');
  assert.equal(normalizeTableReference(undefined), '');
});

test('routes an exact table to its configured branch', () => {
  assert.equal(selectPosOrderRoute([north, southTable], ' t12 ').location_id, 'loc-south');
});

test('routes unmatched tables and orders without a table to the default branch', () => {
  assert.equal(selectPosOrderRoute([north, southTable], 'T99').location_id, 'loc-north');
  assert.equal(selectPosOrderRoute([north], undefined).location_id, 'loc-north');
});

test('does not guess when no default route exists', () => {
  assert.throws(() => selectPosOrderRoute([southTable], 'T99'), /POS_ORDER_DEFAULT_ROUTE_NOT_CONFIGURED/);
});

test('fails closed on ambiguous duplicate route records', () => {
  assert.throws(() => selectPosOrderRoute([north, { ...north, id: 'duplicate' }], 'T99'), /POS_ORDER_DEFAULT_ROUTE_AMBIGUOUS/);
  assert.throws(() => selectPosOrderRoute([north, southTable, { ...southTable, id: 'duplicate' }], 'T12'), /POS_ORDER_TABLE_ROUTE_AMBIGUOUS/);
});
