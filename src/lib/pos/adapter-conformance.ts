import { normalizePosCatalog } from './catalog-normalizer';
import type { PosAdapter, PosConnectionContext, PosLocation } from './types';

export interface PosAdapterConformanceResult {
  provider: PosAdapter['provider'];
  checkedAt: string;
  capabilities: Awaited<ReturnType<PosAdapter['getCapabilities']>>;
  locations: PosLocation[];
  catalogItemCount: number | null;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

function assertCapabilities(value: unknown): asserts value is Awaited<ReturnType<PosAdapter['getCapabilities']>> {
  const keys = [
    'menuRead', 'inventoryRead', 'orderCreate', 'orderRead', 'orderCancel',
    'orderStatusWebhook', 'menuWebhook', 'multiLocation', 'modifiers', 'discounts', 'taxes',
  ] as const;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('POS_ADAPTER_INVALID_CAPABILITIES');
  }
  const row = value as Record<string, unknown>;
  if (keys.some(key => typeof row[key] !== 'boolean')) {
    throw new Error('POS_ADAPTER_INVALID_CAPABILITIES');
  }
  if (row.orderCancel === true && row.orderRead !== true) {
    throw new Error('POS_ADAPTER_CANCEL_REQUIRES_ORDER_READ');
  }
  if (row.orderStatusWebhook === true && row.orderRead !== true) {
    throw new Error('POS_ADAPTER_STATUS_WEBHOOK_REQUIRES_ORDER_READ');
  }
}

function assertLocations(value: unknown): asserts value is PosLocation[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error('POS_ADAPTER_INVALID_LOCATIONS');
  }
  const providerIds = new Set<string>();
  const ids = new Set<string>();
  for (const location of value) {
    if (!location || typeof location !== 'object' ||
        typeof location.id !== 'string' || !location.id.trim() ||
        typeof location.providerLocationId !== 'string' || !location.providerLocationId.trim() ||
        typeof location.name !== 'string' || !location.name.trim() ||
        typeof location.active !== 'boolean') {
      throw new Error('POS_ADAPTER_INVALID_LOCATION');
    }
    if (ids.has(location.id) || providerIds.has(location.providerLocationId)) {
      throw new Error('POS_ADAPTER_DUPLICATE_LOCATION');
    }
    ids.add(location.id);
    providerIds.add(location.providerLocationId);
    if (location.currency !== undefined && !/^[A-Z]{3}$/.test(location.currency)) {
      throw new Error('POS_ADAPTER_INVALID_LOCATION_CURRENCY');
    }
    if (location.timezone !== undefined &&
        (typeof location.timezone !== 'string' || location.timezone.length > 80)) {
      throw new Error('POS_ADAPTER_INVALID_LOCATION_TIMEZONE');
    }
  }
}

/**
 * Runs safe, read-only checks against a registered adapter. This is intended
 * for sandbox onboarding and provider certification; it never creates orders
 * or changes merchant data.
 */
export async function runPosAdapterConformance(
  adapter: PosAdapter,
  context: PosConnectionContext,
  providerLocationId?: string,
): Promise<PosAdapterConformanceResult> {
  if (!adapter || typeof adapter.provider !== 'string' || !context ||
      typeof context.merchantId !== 'string' || !context.merchantId.trim() ||
      typeof context.connectionId !== 'string' || !context.connectionId.trim()) {
    throw new Error('POS_ADAPTER_INVALID_CONTEXT');
  }

  const checks: PosAdapterConformanceResult['checks'] = [];
  const capabilities = await adapter.getCapabilities(context);
  assertCapabilities(capabilities);
  checks.push({ name: 'capabilities', passed: true });

  const health = await adapter.healthCheck(context);
  if (!health || typeof health.ok !== 'boolean' ||
      (health.message !== undefined && (typeof health.message !== 'string' || health.message.length > 500))) {
    throw new Error('POS_ADAPTER_INVALID_HEALTH_RESPONSE');
  }
  if (!health.ok) throw new Error('POS_ADAPTER_HEALTH_CHECK_FAILED');
  checks.push({ name: 'health', passed: true });

  const locations = await adapter.listLocations(context);
  assertLocations(locations);
  checks.push({ name: 'locations', passed: true, detail: String(locations.length) });

  let catalogItemCount: number | null = null;
  if (providerLocationId !== undefined) {
    if (!providerLocationId.trim()) throw new Error('POS_ADAPTER_INVALID_LOCATION_SCOPE');
    const location = locations.find(row => row.providerLocationId === providerLocationId);
    if (!location || !location.active) throw new Error('POS_ADAPTER_LOCATION_NOT_AVAILABLE');
    checks.push({ name: 'location_scope', passed: true });
    if (capabilities.menuRead) {
      const rawCatalog = await adapter.fetchCatalog(context, providerLocationId);
      const catalog = normalizePosCatalog(rawCatalog);
      if (catalog.some(item => !item.locationIds.includes(providerLocationId))) {
        throw new Error('POS_ADAPTER_CATALOG_LOCATION_SCOPE_MISMATCH');
      }
      catalogItemCount = catalog.length;
      checks.push({ name: 'catalog', passed: true, detail: String(catalogItemCount) });
    } else {
      checks.push({ name: 'catalog', passed: true, detail: 'unsupported' });
    }
  }

  return {
    provider: adapter.provider,
    checkedAt: new Date().toISOString(),
    capabilities,
    locations,
    catalogItemCount,
    checks,
  };
}
