/**
 * Canonical contracts for multi-provider POS integrations.
 * Provider adapters translate between vendor-specific APIs and these types.
 * Secrets and provider access tokens must remain server-side.
 */
export type PosProviderId =
  | 'foodics'
  | 'toast'
  | 'square'
  | 'clover'
  | 'lightspeed'
  | 'oracle_simphony'
  | 'odoo'
  | 'shopify_pos'
  | 'salla'
  | 'custom';

export type PosConnectionStatus =
  | 'pending'
  | 'connected'
  | 'degraded'
  | 'reauthorization_required'
  | 'disconnected';

export interface PosCapabilities {
  menuRead: boolean;
  inventoryRead: boolean;
  orderCreate: boolean;
  orderRead: boolean;
  orderCancel: boolean;
  orderStatusWebhook: boolean;
  menuWebhook: boolean;
  multiLocation: boolean;
  modifiers: boolean;
  discounts: boolean;
  taxes: boolean;
}

export interface PosLocation {
  id: string;
  providerLocationId: string;
  name: string;
  timezone?: string;
  currency?: string;
  active: boolean;
}

export interface PosModifierOption {
  id: string;
  providerId?: string;
  name: string;
  priceDelta: number;
  available: boolean;
}

export interface PosModifierGroup {
  id: string;
  providerId?: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: PosModifierOption[];
}

export interface PosCatalogItem {
  id: string;
  providerId: string;
  locationIds: string[];
  categoryId?: string;
  name: string;
  description?: string;
  currency: string;
  unitPrice: number;
  available: boolean;
  modifierGroups: PosModifierGroup[];
  sourceVersion?: string;
  updatedAt: string;
}

export interface PosOrderLine {
  catalogItemId: string;
  providerItemId: string;
  quantity: number;
  modifierOptionIds: string[];
  notes?: string;
}

export interface PosCreateOrderInput {
  merchantId: string;
  locationId: string;
  localOrderId: string;
  idempotencyKey: string;
  currency: string;
  lines: PosOrderLine[];
  customer?: { name?: string; phone?: string };
  fulfillment: 'dine_in' | 'pickup' | 'delivery';
  tableReference?: string;
  notes?: string;
}

export interface PosCreateOrderResult {
  providerOrderId: string;
  status: 'accepted' | 'pending' | 'rejected';
  acceptedAt?: string;
  rawStatus?: string;
}

export interface PosWebhookEvent {
  provider: PosProviderId;
  providerEventId: string;
  eventType: string;
  occurredAt: string;
  providerLocationId?: string;
  payload: unknown;
}

export interface PosConnectionContext {
  merchantId: string;
  connectionId: string;
  locationId?: string;
}

/**
 * Implementations must verify provider signatures before returning webhook
 * events and must honor idempotency keys for order creation where supported.
 */
export interface PosAdapter {
  readonly provider: PosProviderId;
  getCapabilities(context: PosConnectionContext): Promise<PosCapabilities>;
  listLocations(context: PosConnectionContext): Promise<PosLocation[]>;
  fetchCatalog(context: PosConnectionContext, locationId: string): Promise<PosCatalogItem[]>;
  createOrder(
    context: PosConnectionContext,
    input: PosCreateOrderInput,
  ): Promise<PosCreateOrderResult>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Uint8Array,
  ): Promise<PosWebhookEvent>;
  healthCheck(context: PosConnectionContext): Promise<{ ok: boolean; message?: string }>;
}
