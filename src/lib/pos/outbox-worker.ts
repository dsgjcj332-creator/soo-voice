import type { PosCreateOrderInput, PosCreateOrderResult, PosConnectionContext, PosProviderId } from './types';

export interface OrderOutboxEvent {
  id: string;
  order_id: string;
  owner_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export interface OutboxStore {
  claim(workerId: string, limit: number, leaseSeconds: number): Promise<OrderOutboxEvent[]>;
  complete(eventId: string, workerId: string): Promise<boolean>;
  retry(eventId: string, workerId: string, errorCode: string): Promise<'failed' | 'dead_letter'>;
}

export interface PosDispatchTarget {
  provider: PosProviderId;
  context: PosConnectionContext;
  createOrder(input: PosCreateOrderInput): Promise<PosCreateOrderResult>;
}

export interface OutboxDispatchResult {
  claimed: number;
  delivered: number;
  failed: number;
  leaseLost: number;
}

export type ResolvePosTarget = (event: OrderOutboxEvent) => Promise<PosDispatchTarget>;
export type BuildPosOrder = (event: OrderOutboxEvent, target: PosDispatchTarget) => PosCreateOrderInput;

/**
 * Processes one leased batch. Provider resolution and canonical order mapping
 * are injected so this module never guesses which merchant connection/location
 * should receive an order. A provider "pending" response remains retryable;
 * only an explicit "accepted" response marks the outbox event delivered.
 */
export async function processOrderOutboxBatch(
  store: OutboxStore,
  workerId: string,
  resolveTarget: ResolvePosTarget,
  buildOrder: BuildPosOrder,
  options: { limit?: number; leaseSeconds?: number } = {},
): Promise<OutboxDispatchResult> {
  if (!workerId || workerId.length < 8 || workerId.length > 128) {
    throw new Error('INVALID_WORKER_ID');
  }
  const limit = options.limit ?? 10;
  const leaseSeconds = options.leaseSeconds ?? 120;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_BATCH_LIMIT');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 900) {
    throw new Error('INVALID_LEASE_SECONDS');
  }

  const events = await store.claim(workerId, limit, leaseSeconds);
  const result: OutboxDispatchResult = {
    claimed: events.length,
    delivered: 0,
    failed: 0,
    leaseLost: 0,
  };

  for (const event of events) {
    try {
      if (event.event_type !== 'order.created') throw new Error('UNSUPPORTED_OUTBOX_EVENT');
      const target = await resolveTarget(event);
      const input = buildOrder(event, target);
      const providerResult = await target.createOrder(input);
      if (providerResult.status !== 'accepted' || !providerResult.providerOrderId) {
        throw new Error(providerResult.status === 'rejected' ? 'POS_ORDER_REJECTED' : 'POS_ACCEPTANCE_PENDING');
      }
      const completed = await store.complete(event.id, workerId);
      if (completed) result.delivered += 1;
      else result.leaseLost += 1;
    } catch (error) {
      const rawCode = error instanceof Error ? error.message : 'POS_DISPATCH_FAILED';
      const safeCode = /^[A-Z0-9_]{1,80}$/.test(rawCode) ? rawCode : 'POS_DISPATCH_FAILED';
      try {
        const state = await store.retry(event.id, workerId, safeCode);
        if (state === 'failed' || state === 'dead_letter') result.failed += 1;
      } catch {
        result.leaseLost += 1;
      }
    }
  }
  return result;
}
