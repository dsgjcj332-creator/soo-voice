/**
 * Translation between Foodics API resources and SooVoice's canonical POS
 * types, following the officially documented field names:
 *   - GET /products returns "price", "is_active", "is_ready" and an embedded
 *     "branches" relation whose pivot carries per-branch price, is_active and
 *     is_in_stock; modifier groups expose minimum/maximum options and options
 *     with an absolute "price".
 *   - POST /orders takes a client-generated UUIDv4 "id" (idempotency), an
 *     integer "type" (1 dine-in, 2 pickup, 3 delivery), "branch_id" and
 *     products with product_id/quantity/unit_price/options.
 * Source: apidocs.foodics.com/core/resources/products.html,
 *         developers.foodics.com/guides/making-orders.html.
 */
import crypto from 'node:crypto';
import type {
  PosCatalogItem,
  PosCreateOrderInput,
  PosLocation,
  PosModifierGroup,
} from '../types';
import type { FoodicsBranch, FoodicsOrderPayload, FoodicsProduct } from './client';

export function mapFoodicsBranchesToLocations(branches: FoodicsBranch[]): PosLocation[] {
  return branches
    .filter(branch => branch && typeof branch.id === 'string' && branch.id.length > 0)
    .map(branch => ({
      // Foodics branch objects carry no currency/timezone field; those are
      // confirmed by the merchant at location setup time in SooVoice.
      id: branch.id,
      providerLocationId: branch.id,
      name: typeof branch.name === 'string' ? branch.name : '',
      active: true,
    }));
}

export function mapFoodicsProductsToCatalogItems(
  products: FoodicsProduct[],
  providerLocationId: string,
  currency: string,
): PosCatalogItem[] {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('FOODICS_CATALOG_CURRENCY_REQUIRED');
  const now = new Date().toISOString();
  const items: PosCatalogItem[] = [];
  for (const product of products ?? []) {
    if (!product || typeof product.id !== 'string' || typeof product.name !== 'string') continue;
    const branchRelation = product.branches?.find(row => row?.id === providerLocationId);
    // A product with no relation to the requested branch is not sold there.
    if (!branchRelation) continue;
    const pivot = branchRelation.pivot ?? null;
    const unitPrice = typeof pivot?.price === 'number' && pivot.price >= 0
      ? pivot.price
      : (typeof product.price === 'number' && product.price >= 0 ? product.price : null);
    if (unitPrice === null) continue;
    const available = product.is_active === true
      && product.is_ready === true
      && pivot?.is_active !== false
      && pivot?.is_in_stock !== false;
    const modifierGroups: PosModifierGroup[] = (product.modifiers ?? [])
      .filter(group => group && typeof group.id === 'string')
      .map((group): PosModifierGroup | null => {
        const options = (group.options ?? [])
          .filter(option => option && typeof option.id === 'string')
          .map(option => ({
            id: option.id,
            providerId: option.id,
            name: typeof option.name === 'string' ? option.name : '',
            priceDelta: typeof option.price === 'number' && option.price >= 0 ? option.price : 0,
            available: option.is_active !== false,
          }));
        // A modifier group without options cannot be ordered; the canonical
        // contract also caps selections at the number of existing options.
        if (options.length === 0) return null;
        const minSelections = Math.min(Math.max(0, Number(group.pivot?.minimum_options ?? 0)), options.length);
        const maxSelections = Math.min(Math.max(minSelections, Number(group.pivot?.maximum_options ?? 0)), options.length);
        return {
          id: group.id,
          providerId: group.id,
          name: typeof group.name === 'string' ? group.name : '',
          required: minSelections > 0,
          minSelections,
          maxSelections,
          options,
        };
      })
      .filter((group): group is PosModifierGroup => group !== null);
    items.push({
      id: product.id,
      providerId: product.id,
      locationIds: [providerLocationId],
      name: product.name,
      currency,
      unitPrice,
      available,
      modifierGroups,
      updatedAt: now,
    });
  }
  return items;
}

export interface FoodicsPricingSource {
  /** providerItemId -> stored unit price for the mapped branch. */
  itemPrice(providerItemId: string): number | null;
  /** modifier option id -> absolute price (Foodics options need unit_price). */
  optionPrice(optionId: string): number | null;
}

/**
 * Derives a stable, UUIDv4-shaped order id from the local order id so Foodics
 * retries of the same SooVoice order always replay the same "id" and hit the
 * documented "Duplicate ID." idempotency path instead of double-entering.
 */
export function deriveFoodicsOrderId(localOrderId: string): string {
  const digest = crypto.createHash('sha256').update(`soovoice:${localOrderId}`).digest('hex');
  const hex = digest.slice(0, 32);
  const variantNibble = '89ab'[parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Maps a canonical order to the Foodics POST /orders payload. SooVoice's
 * free-form tableReference is NOT mapped to Foodics "table_id" (which expects
 * a Foodics table UUID); it is surfaced to the kitchen via kitchen_notes.
 */
export function buildFoodicsOrderPayload(
  input: PosCreateOrderInput,
  pricing: FoodicsPricingSource,
): FoodicsOrderPayload {
  const type: 1 | 2 | 3 = input.fulfillment === 'dine_in'
    ? 1
    : input.fulfillment === 'pickup' ? 2 : 3;
  const products = input.lines.map(line => {
    const unitPrice = pricing.itemPrice(line.providerItemId);
    if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('FOODICS_ORDER_ITEM_UNPRICED');
    }
    const options = (line.modifierOptionIds ?? []).map(optionId => {
      const optionPrice = pricing.optionPrice(optionId);
      if (optionPrice === null || !Number.isFinite(optionPrice) || optionPrice < 0) {
        throw new Error('FOODICS_ORDER_OPTION_UNPRICED');
      }
      return { modifier_option_id: optionId, quantity: 1, unit_price: optionPrice };
    });
    const notes = [line.notes, input.notes, input.tableReference && input.fulfillment === 'dine_in'
      ? `Table: ${input.tableReference}` : '']
      .filter(Boolean).join(' | ');
    return {
      product_id: line.providerItemId,
      quantity: line.quantity,
      unit_price: unitPrice,
      ...(notes ? { kitchen_notes: notes } : {}),
      ...(options.length > 0 ? { options } : {}),
    };
  });
  const payload: FoodicsOrderPayload = {
    id: deriveFoodicsOrderId(input.localOrderId),
    type,
    branch_id: input.locationId,
    products,
  };
  if (typeof input.customer?.name === 'string' && input.customer.name.trim()) {
    payload.customer_name = input.customer.name.trim().slice(0, 120);
  }
  return payload;
}
