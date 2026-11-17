import type { PosCatalogItem } from './types';

export interface PersistedPosCatalogSnapshot {
  providerItemId: string;
  sourceUpdatedAt: string;
  sourceVersion?: string;
  contentFingerprint: string;
}

export type PosCatalogSyncOperation =
  | { type: 'create' | 'update'; providerItemId: string; item: PosCatalogItem; contentFingerprint: string }
  | { type: 'unchanged' | 'stale' | 'deactivate'; providerItemId: string; contentFingerprint?: string };

export interface PosCatalogSyncPlan {
  operations: PosCatalogSyncOperation[];
  counts: { create: number; update: number; unchanged: number; stale: number; deactivate: number };
}

function fingerprint(item: PosCatalogItem): string {
  // A deterministic change detector, not a security hash. Property order is
  // explicitly authored; modifier order is preserved because it can be meaningful.
  const canonical = JSON.stringify({
    categoryId: item.categoryId ?? null,
    name: item.name,
    description: item.description ?? null,
    currency: item.currency,
    unitPrice: item.unitPrice,
    available: item.available,
    modifierGroups: item.modifierGroups.map(group => ({
      id: group.id,
      providerId: group.providerId ?? null,
      name: group.name,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      options: group.options.map(option => ({
        id: option.id,
        providerId: option.providerId ?? null,
        name: option.name,
        priceDelta: option.priceDelta,
        available: option.available,
      })),
    })),
  });

  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Plan a single mapped-location catalog sync.
 *
 * The caller must pass a complete provider snapshot only when the provider
 * response is known to be complete. Partial/paginated snapshots never
 * deactivate records. This function performs no persistence or network I/O.
 */
export function planPosCatalogSync(
  incoming: PosCatalogItem[],
  existing: PersistedPosCatalogSnapshot[],
  providerLocationId: string,
  options: { completeSnapshot: boolean },
): PosCatalogSyncPlan {
  if (typeof providerLocationId !== 'string' || !providerLocationId.trim()) {
    throw new Error('INVALID_POS_SYNC_LOCATION');
  }
  if (!options || typeof options.completeSnapshot !== 'boolean') {
    throw new Error('INVALID_POS_SYNC_SNAPSHOT_MODE');
  }

  const current = new Map<string, PersistedPosCatalogSnapshot>();
  for (const row of existing) {
    if (!row || typeof row.providerItemId !== 'string' || !row.providerItemId ||
        !Number.isFinite(Date.parse(row.sourceUpdatedAt)) ||
        typeof row.contentFingerprint !== 'string' || !row.contentFingerprint) {
      throw new Error('INVALID_POS_SYNC_EXISTING_SNAPSHOT');
    }
    if (current.has(row.providerItemId)) throw new Error('DUPLICATE_POS_SYNC_EXISTING_ITEM');
    current.set(row.providerItemId, row);
  }

  const next = new Map<string, { item: PosCatalogItem; fingerprint: string }>();
  for (const item of incoming) {
    if (!item.locationIds.includes(providerLocationId)) continue;
    if (next.has(item.providerId)) throw new Error('DUPLICATE_POS_SYNC_INCOMING_ITEM');
    next.set(item.providerId, { item, fingerprint: fingerprint(item) });
  }

  const operations: PosCatalogSyncOperation[] = [];
  for (const [providerItemId, row] of next) {
    const previous = current.get(providerItemId);
    if (!previous) {
      operations.push({ type: 'create', providerItemId, item: row.item, contentFingerprint: row.fingerprint });
      continue;
    }

    const incomingTime = Date.parse(row.item.updatedAt);
    const previousTime = Date.parse(previous.sourceUpdatedAt);
    if (incomingTime < previousTime) {
      operations.push({ type: 'stale', providerItemId, contentFingerprint: row.fingerprint });
      continue;
    }
    if (incomingTime === previousTime) {
      if (row.fingerprint !== previous.contentFingerprint) {
        operations.push({ type: 'stale', providerItemId, contentFingerprint: row.fingerprint });
      } else {
        operations.push({ type: 'unchanged', providerItemId, contentFingerprint: row.fingerprint });
      }
      continue;
    }
    operations.push({ type: 'update', providerItemId, item: row.item, contentFingerprint: row.fingerprint });
  }

  if (options.completeSnapshot) {
    for (const providerItemId of current.keys()) {
      if (!next.has(providerItemId)) operations.push({ type: 'deactivate', providerItemId });
    }
  }

  const counts = { create: 0, update: 0, unchanged: 0, stale: 0, deactivate: 0 };
  for (const operation of operations) counts[operation.type] += 1;
  return { operations, counts };
}
