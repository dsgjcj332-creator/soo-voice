/**
 * Foodics POS adapter implementing the canonical PosAdapter contract.
 * Capabilities are honest for this version: catalog/branches reading,
 * per-branch inventory signals and order creation are implemented; order
 * reading, cancellation and webhook verification are not wired yet (Foodics'
 * webhook signature scheme is not covered by the published documentation, so
 * verifyWebhook fails closed instead of trusting unverified calls).
 */
import type {
  PosAdapter,
  PosCapabilities,
  PosCatalogItem,
  PosConnectionContext,
  PosCreateOrderInput,
  PosCreateOrderResult,
  PosLocation,
  PosWebhookEvent,
} from '../types';
import { FoodicsClient } from './client';
import { buildFoodicsOrderPayload, mapFoodicsBranchesToLocations, mapFoodicsProductsToCatalogItems, type FoodicsPricingSource } from './mapping';

export interface FoodicsAdapterConfig {
  apiToken: string;
  sandbox?: boolean;
  /** ISO currency confirmed for the connected branch (e.g. "EGP"). */
  currency?: string;
  fetch?: typeof fetch;
}

const FOODICS_CAPABILITIES: PosCapabilities = {
  menuRead: true,
  inventoryRead: true,
  orderCreate: true,
  orderRead: false,
  orderCancel: false,
  orderStatusWebhook: false,
  menuWebhook: false,
  multiLocation: true,
  modifiers: true,
  discounts: false,
  taxes: false,
};

export function createFoodicsAdapter(config: FoodicsAdapterConfig): PosAdapter {
  const client = new FoodicsClient({ apiToken: config.apiToken, sandbox: config.sandbox, fetch: config.fetch });
  return {
    provider: 'foodics',
    async getCapabilities(): Promise<PosCapabilities> {
      return { ...FOODICS_CAPABILITIES };
    },
    async listLocations(): Promise<PosLocation[]> {
      return mapFoodicsBranchesToLocations(await client.listBranches());
    },
    async fetchCatalog(_context: PosConnectionContext, locationId: string): Promise<PosCatalogItem[]> {
      if (!locationId || typeof locationId !== 'string') throw new Error('FOODICS_CATALOG_LOCATION_REQUIRED');
      const currency = (config.currency ?? '').toUpperCase();
      const products = await client.listProducts();
      return mapFoodicsProductsToCatalogItems(products, locationId, currency);
    },
    async createOrder(context: PosConnectionContext, input: PosCreateOrderInput): Promise<PosCreateOrderResult> {
      if (input.locationId !== context.locationId) {
        throw new Error('FOODICS_ORDER_LOCATION_MISMATCH');
      }
      // Foodics prices orders from the branch price book; resolve stored
      // catalog prices so the payload matches what the merchant approved.
      const products = await client.listProducts();
      const catalog = mapFoodicsProductsToCatalogItems(products, context.locationId ?? '', input.currency);
      const pricing: FoodicsPricingSource = {
        itemPrice: providerItemId => catalog.find(item => item.providerId === providerItemId)?.unitPrice ?? null,
        optionPrice: optionId => {
          for (const item of catalog) {
            for (const group of item.modifierGroups) {
              const option = group.options.find(row => row.id === optionId);
              if (option) return option.priceDelta;
            }
          }
          return null;
        },
      };
      const payload = buildFoodicsOrderPayload(input, pricing);
      const result = await client.createOrder(payload);
      return {
        providerOrderId: payload.id,
        // A Foodics "Duplicate ID." replay means a previous attempt landed:
        // report accepted so the outbox marks the event delivered.
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        rawStatus: result.duplicated ? 'duplicate_id_replay' : 'created',
      };
    },
    async verifyWebhook(): Promise<PosWebhookEvent> {
      throw new Error('FOODICS_WEBHOOK_SIGNATURE_NOT_CONFIGURED');
    },
    async healthCheck(): Promise<{ ok: boolean; message?: string }> {
      try {
        await client.listBranches();
        return { ok: true };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'FOODICS_HEALTH_CHECK_FAILED' };
      }
    },
  };
}
