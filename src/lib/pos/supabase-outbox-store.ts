import type { OutboxStore, OrderOutboxEvent, PosDispatchTarget } from './outbox-worker';

export type PosOutboxFetch = typeof fetch;

export class SupabaseOutboxStore implements OutboxStore {
  constructor(
    private readonly supabaseUrl: string,
    private readonly serviceKey: string,
    private readonly request: PosOutboxFetch = fetch,
  ) {}

  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.request(`${this.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`OUTBOX_RPC_${name.toUpperCase()}_FAILED`);
    return await response.json() as T;
  }

  async claim(workerId: string, limit: number, leaseSeconds: number): Promise<OrderOutboxEvent[]> {
    const rows = await this.rpc<unknown>('claim_order_outbox', {
      p_worker_id: workerId,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (!Array.isArray(rows)) throw new Error('OUTBOX_CLAIM_INVALID_RESPONSE');
    return rows.map((row: Record<string, unknown>) => {
      if (typeof row.id !== 'string' || typeof row.order_id !== 'string' ||
          typeof row.owner_id !== 'string' || typeof row.event_type !== 'string' ||
          !row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
        throw new Error('OUTBOX_EVENT_INVALID');
      }
      return {
        id: row.id,
        order_id: row.order_id,
        owner_id: row.owner_id,
        event_type: row.event_type,
        payload: row.payload as Record<string, unknown>,
        attempts: Number(row.attempts) || 0,
      };
    });
  }

  async complete(
    eventId: string,
    workerId: string,
    target: PosDispatchTarget,
    providerOrderId: string,
  ): Promise<boolean> {
    return this.rpc<boolean>('complete_order_outbox', {
      p_event_id: eventId,
      p_worker_id: workerId,
      p_provider_id: target.provider,
      p_connection_id: target.context.connectionId,
      p_location_id: target.context.locationId ?? null,
      p_provider_order_id: providerOrderId,
    });
  }

  async retry(eventId: string, workerId: string, errorCode: string): Promise<'failed' | 'dead_letter'> {
    const status = await this.rpc<unknown>('retry_order_outbox', {
      p_event_id: eventId,
      p_worker_id: workerId,
      p_error_code: errorCode,
    });
    if (status !== 'failed' && status !== 'dead_letter') throw new Error('OUTBOX_RETRY_INVALID_RESPONSE');
    return status;
  }
}
