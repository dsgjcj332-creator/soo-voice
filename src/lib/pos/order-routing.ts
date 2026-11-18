export type PosOrderRoute = {
  id: string;
  connection_id: string;
  location_id: string;
  route_type: 'default' | 'table';
  route_value: string | null;
};

export function normalizeTableReference(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase().slice(0, 40);
}

/** Prefer an exact table route; otherwise use the explicit merchant default. */
export function selectPosOrderRoute(
  routes: PosOrderRoute[],
  tableReference: unknown,
): PosOrderRoute {
  const table = normalizeTableReference(tableReference);
  const tableMatches = table
    ? routes.filter(route => route.route_type === 'table' &&
        normalizeTableReference(route.route_value) === table)
    : [];
  if (tableMatches.length > 1) throw new Error('POS_ORDER_TABLE_ROUTE_AMBIGUOUS');
  if (tableMatches.length === 1) return tableMatches[0];

  const defaults = routes.filter(route => route.route_type === 'default');
  if (defaults.length === 0) throw new Error('POS_ORDER_DEFAULT_ROUTE_NOT_CONFIGURED');
  if (defaults.length > 1) throw new Error('POS_ORDER_DEFAULT_ROUTE_AMBIGUOUS');
  return defaults[0];
}
