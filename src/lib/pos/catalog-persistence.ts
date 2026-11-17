import { normalizePosCatalog } from './catalog-normalizer';
import type { PosCatalogItem } from './types';

export interface PosCatalogRpcClient {
  rpc(
    functionName: 'sync_pos_catalog_snapshot',
    args: {
      p_owner_id: string;
      p_connection_id: string;
      p_location_id: string;
      p_items: PosCatalogItem[];
      p_complete_snapshot: boolean;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
}

export interface PosCatalogPersistenceInput {
  ownerId: string;
  connectionId: string;
  locationId: string;
  providerLocationId: string;
  items: unknown;
  completeSnapshot: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Persists a normalized provider snapshot through a service-role-only RPC.
 * The caller must authenticate the merchant and resolve the connection and
 * mapped location from trusted database records before calling this function.
 */
export async function persistPosCatalogSnapshot(
  client: PosCatalogRpcClient,
  input: PosCatalogPersistenceInput,
): Promise<unknown> {
  if (![input.ownerId, input.connectionId, input.locationId].every(value => UUID.test(value))) {
    throw new Error('INVALID_POS_CATALOG_SCOPE');
  }
  if (typeof input.providerLocationId !== 'string' || !input.providerLocationId.trim()) {
    throw new Error('INVALID_POS_SYNC_LOCATION');
  }
  if (typeof input.completeSnapshot !== 'boolean') {
    throw new Error('INVALID_POS_SYNC_SNAPSHOT_MODE');
  }

  const normalized = normalizePosCatalog(input.items);
  const scopedItems = normalized.filter(item => item.locationIds.includes(input.providerLocationId));

  const { data, error } = await client.rpc('sync_pos_catalog_snapshot', {
    p_owner_id: input.ownerId,
    p_connection_id: input.connectionId,
    p_location_id: input.locationId,
    p_items: scopedItems,
    p_complete_snapshot: input.completeSnapshot,
  });
  if (error) throw new Error('POS_CATALOG_PERSIST_FAILED');
  return data;
}
