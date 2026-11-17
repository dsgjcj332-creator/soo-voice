import type {
  PosAdapter,
  PosCapabilities,
  PosCatalogItem,
  PosConnectionContext,
  PosCreateOrderInput,
  PosCreateOrderResult,
  PosLocation,
} from '../types';

export interface PosSandboxOrder {
  input: PosCreateOrderInput;
  result: PosCreateOrderResult;
}

export interface PosSandboxAdapter {
  adapter: PosAdapter;
  getAcceptedOrders(): PosSandboxOrder[];
}

const SANDBOX_LOCATION: PosLocation = {
  id: 'sandbox-location-1',
  providerLocationId: 'sandbox-branch-1',
  name: 'SooVoice Sandbox Branch',
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  active: true,
};

const SANDBOX_CATALOG: PosCatalogItem[] = [{
  id: 'sandbox-item-1',
  providerId: 'sandbox-product-1',
  locationIds: ['sandbox-branch-1'],
  categoryId: 'sandbox-category-1',
  name: 'Sandbox Coffee',
  description: 'A non-production test item',
  currency: 'EGP',
  unitPrice: 50,
  available: true,
  modifierGroups: [{
    id: 'sandbox-size',
    name: 'Size',
    required: true,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { id: 'sandbox-small', name: 'Small', priceDelta: 0, available: true },
      { id: 'sandbox-large', name: 'Large', priceDelta: 15, available: true },
    ],
  }],
  sourceVersion: 'sandbox-v1',
  updatedAt: '2026-11-18T00:00:00.000Z',
}];

const CAPABILITIES: PosCapabilities = {
  menuRead: true,
  inventoryRead: false,
  orderCreate: true,
  orderRead: true,
  orderCancel: false,
  orderStatusWebhook: false,
  menuWebhook: false,
  multiLocation: true,
  modifiers: true,
  discounts: false,
  taxes: false,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${stable(row[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Deterministic, in-memory POS adapter for automated tests and developer
 * onboarding only. It is deliberately not registered in the production
 * adapter registry and never calls an external service.
 */
export function createPosSandboxAdapter(): PosSandboxAdapter {
  const accepted = new Map<string, { fingerprint: string; order: PosSandboxOrder }>();
  let sequence = 0;

  const adapter: PosAdapter = {
    provider: 'custom',

    async getCapabilities() {
      return clone(CAPABILITIES);
    },

    async listLocations(_context: PosConnectionContext) {
      return [clone(SANDBOX_LOCATION)];
    },

    async fetchCatalog(_context: PosConnectionContext, providerLocationId: string) {
      if (providerLocationId !== SANDBOX_LOCATION.providerLocationId) {
        throw new Error('POS_SANDBOX_LOCATION_NOT_FOUND');
      }
      return clone(SANDBOX_CATALOG);
    },

    async createOrder(context: PosConnectionContext, input: PosCreateOrderInput) {
      if (!context || !input || context.merchantId !== input.merchantId ||
          !context.merchantId || !context.connectionId) {
        throw new Error('POS_SANDBOX_TENANT_MISMATCH');
      }
      if (input.locationId !== SANDBOX_LOCATION.id ||
          (context.locationId !== undefined && context.locationId !== input.locationId)) {
        throw new Error('POS_SANDBOX_LOCATION_MISMATCH');
      }
      if (input.currency !== SANDBOX_LOCATION.currency || !Array.isArray(input.lines) ||
          input.lines.length < 1 || input.lines.length > 100) {
        throw new Error('POS_SANDBOX_INVALID_ORDER');
      }
      if (typeof input.idempotencyKey !== 'string' ||
          !input.idempotencyKey.trim() || input.idempotencyKey.length > 200) {
        throw new Error('POS_SANDBOX_INVALID_IDEMPOTENCY_KEY');
      }

      for (const line of input.lines) {
        if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
          throw new Error('POS_SANDBOX_INVALID_QUANTITY');
        }
        const item = SANDBOX_CATALOG.find(row =>
          row.id === line.catalogItemId && row.providerId === line.providerItemId &&
          row.available && row.locationIds.includes(SANDBOX_LOCATION.providerLocationId));
        if (!item || item.currency !== input.currency) {
          throw new Error('POS_SANDBOX_ITEM_NOT_AVAILABLE');
        }
        const selected = new Set(line.modifierOptionIds);
        if (selected.size !== line.modifierOptionIds.length) {
          throw new Error('POS_SANDBOX_DUPLICATE_MODIFIER');
        }
        for (const group of item.modifierGroups) {
          const matches = group.options.filter(option => selected.has(option.id));
          if (matches.some(option => !option.available) ||
              matches.length < group.minSelections || matches.length > group.maxSelections) {
            throw new Error('POS_SANDBOX_INVALID_MODIFIERS');
          }
        }
        const knownOptions = new Set(item.modifierGroups.flatMap(group => group.options.map(option => option.id)));
        if ([...selected].some(id => !knownOptions.has(id))) {
          throw new Error('POS_SANDBOX_UNKNOWN_MODIFIER');
        }
      }

      const fingerprint = stable(input);
      const idempotencyScope = `${context.merchantId}:${context.connectionId}:${input.idempotencyKey}`;
      const previous = accepted.get(idempotencyScope);
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          throw new Error('POS_SANDBOX_IDEMPOTENCY_CONFLICT');
        }
        return clone(previous.order.result);
      }

      sequence += 1;
      const order: PosSandboxOrder = {
        input: clone(input),
        result: {
          providerOrderId: `sandbox-order-${String(sequence).padStart(6, '0')}`,
          status: 'accepted',
          acceptedAt: new Date().toISOString(),
          rawStatus: 'accepted',
        },
      };
      accepted.set(idempotencyScope, { fingerprint, order });
      return clone(order.result);
    },

    async verifyWebhook() {
      throw new Error('POS_SANDBOX_WEBHOOK_NOT_IMPLEMENTED');
    },

    async healthCheck() {
      return { ok: true, message: 'In-memory sandbox adapter is ready' };
    },
  };

  return {
    adapter,
    getAcceptedOrders: () => [...accepted.values()].map(row => clone(row.order)),
  };
}
