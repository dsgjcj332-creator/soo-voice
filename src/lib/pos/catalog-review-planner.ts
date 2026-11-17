import type { PosCatalogItem } from './types';
import {
  planPosCatalogSync,
  type PersistedPosCatalogSnapshot,
} from './catalog-sync-planner';

export type MerchantMenuField = 'name' | 'description' | 'price' | 'available' | 'categoryId';

export interface MerchantMenuOverrideFlags {
  name?: boolean;
  description?: boolean;
  price?: boolean;
  available?: boolean;
  categoryId?: boolean;
}

export interface ExistingMerchantMenuItem extends PersistedPosCatalogSnapshot {
  menuItemId: string;
  providerItemId: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
  categoryId?: string;
  overrides?: MerchantMenuOverrideFlags;
}

export type PosCatalogReviewStatus =
  | 'add'
  | 'update'
  | 'manual_conflict'
  | 'unchanged'
  | 'stale'
  | 'hide';

export interface PosCatalogReviewEntry {
  status: PosCatalogReviewStatus;
  providerItemId: string;
  menuItemId?: string;
  incoming?: PosCatalogItem;
  changes: Partial<Record<MerchantMenuField, { current: string | number | boolean | null; proposed: string | number | boolean | null; protectedByMerchant: boolean }>>;
}

export interface PosCatalogReview {
  entries: PosCatalogReviewEntry[];
  counts: Record<PosCatalogReviewStatus, number>;
  requiresMerchantApproval: true;
}

/**
 * Builds a read-only review proposal. It never writes to the merchant menu.
 * Merchant-authored fields are preserved and surfaced as conflicts instead
 * of being silently overwritten by the provider snapshot.
 */
export function buildPosCatalogReview(
  incoming: PosCatalogItem[],
  existing: ExistingMerchantMenuItem[],
  providerLocationId: string,
  options: { completeSnapshot: boolean },
): PosCatalogReview {
  const currentByProviderId = new Map<string, ExistingMerchantMenuItem>();
  for (const row of existing) {
    if (!row || typeof row.providerItemId !== 'string' || !row.providerItemId ||
        typeof row.menuItemId !== 'string' || !row.menuItemId ||
        currentByProviderId.has(row.providerItemId)) {
      throw new Error('INVALID_POS_REVIEW_EXISTING_ITEM');
    }
    currentByProviderId.set(row.providerItemId, row);
  }

  const plan = planPosCatalogSync(incoming, existing, providerLocationId, options);
  const incomingByProviderId = new Map(
    incoming.filter(item => item.locationIds.includes(providerLocationId)).map(item => [item.providerId, item]),
  );
  const entries: PosCatalogReviewEntry[] = [];

  for (const operation of plan.operations) {
    const current = currentByProviderId.get(operation.providerItemId);
    if (operation.type === 'create') {
      entries.push({
        status: 'add',
        providerItemId: operation.providerItemId,
        incoming: operation.item,
        changes: {
          name: { current: null, proposed: operation.item.name, protectedByMerchant: false },
          description: { current: null, proposed: operation.item.description ?? '', protectedByMerchant: false },
          price: { current: null, proposed: operation.item.unitPrice, protectedByMerchant: false },
          available: { current: null, proposed: operation.item.available, protectedByMerchant: false },
          categoryId: { current: null, proposed: operation.item.categoryId ?? null, protectedByMerchant: false },
        },
      });
      continue;
    }
    if (operation.type === 'deactivate') {
      entries.push({ status: 'hide', providerItemId: operation.providerItemId, menuItemId: current?.menuItemId, changes: {} });
      continue;
    }
    if (operation.type === 'stale') {
      entries.push({ status: 'stale', providerItemId: operation.providerItemId, menuItemId: current?.menuItemId, incoming: incomingByProviderId.get(operation.providerItemId), changes: {} });
      continue;
    }
    if (operation.type === 'unchanged') {
      entries.push({ status: 'unchanged', providerItemId: operation.providerItemId, menuItemId: current?.menuItemId, incoming: incomingByProviderId.get(operation.providerItemId), changes: {} });
      continue;
    }

    if (operation.type !== 'update') continue;
    const item = operation.item;
    if (!current) throw new Error('POS_REVIEW_ITEM_SCOPE_MISMATCH');
    const proposed: Record<MerchantMenuField, string | number | boolean | null> = {
      name: item.name,
      description: item.description ?? '',
      price: item.unitPrice,
      available: item.available,
      categoryId: item.categoryId ?? null,
    };
    const values: Record<MerchantMenuField, string | number | boolean | null> = {
      name: current.name,
      description: current.description,
      price: current.price,
      available: current.available,
      categoryId: current.categoryId ?? null,
    };
    const changes: PosCatalogReviewEntry['changes'] = {};
    let protectedChange = false;
    for (const field of Object.keys(proposed) as MerchantMenuField[]) {
      if (values[field] === proposed[field]) continue;
      const protectedByMerchant = current.overrides?.[field] === true;
      if (protectedByMerchant) protectedChange = true;
      changes[field] = { current: values[field], proposed: proposed[field], protectedByMerchant };
    }
    entries.push({
      status: protectedChange ? 'manual_conflict' : Object.keys(changes).length ? 'update' : 'unchanged',
      providerItemId: operation.providerItemId,
      menuItemId: current.menuItemId,
      incoming: item,
      changes,
    });
  }

  const counts: PosCatalogReview['counts'] = {
    add: 0, update: 0, manual_conflict: 0, unchanged: 0, stale: 0, hide: 0,
  };
  for (const entry of entries) counts[entry.status] += 1;
  return { entries, counts, requiresMerchantApproval: true };
}
