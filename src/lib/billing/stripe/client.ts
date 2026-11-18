/**
 * Stripe client implementing the officially documented API surface used for
 * SooVoice merchant subscriptions:
 *   - Checkout Sessions: POST /v1/checkout/sessions in `subscription` mode
 *     with form-encoded parameters (mode, line_items[0][price_data] with
 *     recurring interval, quantity, success_url, client_reference_id,
 *     customer_email, metadata, subscription_data[metadata]).
 *   - Subscriptions: GET /v1/subscriptions/{id} and POST /v1/subscriptions/{id}
 *     with cancel_at_period_end=true|false.
 *   - Webhook signature verification (v1 scheme): the Stripe-Signature header
 *     carries comma-separated `t=` and one or more `v1=` entries; the signed
 *     payload is `${t}.${rawBody}`; the expected signature is HMAC-SHA256
 *     keyed by the endpoint secret, compared in constant time against every
 *     v1 entry, with a timestamp tolerance (default 5 minutes, never 0).
 *     Unknown entries (v0, secret, destination, payload) are debug metadata
 *     and must be ignored.
 * Source: docs.stripe.com/api/checkout/sessions/create,
 *         docs.stripe.com/api/subscriptions/update, docs.stripe.com/webhooks.
 */
import crypto from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface StripeClientConfig {
  secretKey: string;
  fetch?: typeof fetch;
}

export interface StripeCheckoutSessionParams {
  planName: string;
  currency: string;
  amountMinor: number;
  billingInterval: 'monthly' | 'yearly';
  clientReferenceId: string;
  customerEmail?: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  metadata: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export class StripeClient {
  private readonly request: typeof fetch;

  constructor(private readonly config: StripeClientConfig) {
    if (!config.secretKey || typeof config.secretKey !== 'string' || config.secretKey.length < 20) {
      throw new Error('STRIPE_SECRET_KEY_REQUIRED');
    }
    this.request = config.fetch ?? fetch;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...extra,
    };
  }

  private async parseError(response: Response): Promise<Error> {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: unknown; type?: unknown } }
      | null;
    const detail = typeof body?.error?.message === 'string' ? `: ${body.error.message}` : '';
    return new Error(`STRIPE_REQUEST_FAILED_${response.status}${detail}`);
  }

  async createCheckoutSession(params: StripeCheckoutSessionParams): Promise<StripeCheckoutSession> {
    if (!Number.isInteger(params.amountMinor) || params.amountMinor < 0) {
      throw new Error('STRIPE_AMOUNT_INVALID');
    }
    if (!/^[a-z]{3}$/i.test(params.currency)) {
      throw new Error('STRIPE_CURRENCY_INVALID');
    }
    // Stripe currencies are lowercase ISO codes; accept either input case.
    const currency = params.currency.toLowerCase();
    const interval = params.billingInterval === 'yearly' ? 'year' : 'month';
    const form = new URLSearchParams({
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.clientReferenceId,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': String(params.amountMinor),
      'line_items[0][price_data][recurring][interval]': interval,
      'line_items[0][price_data][product_data][name]': params.planName.slice(0, 200),
    });
    if (params.customerEmail) form.set('customer_email', params.customerEmail.slice(0, 800));
    for (const [key, value] of Object.entries(params.metadata)) {
      form.set(`metadata[${key}]`, value);
      form.set(`subscription_data[metadata][${key}]`, value);
    }
    const response = await this.request(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: this.headers(),
      body: form.toString(),
    });
    if (!response.ok) throw await this.parseError(response);
    const body = await response.json().catch(() => null) as
      | { id?: unknown; url?: unknown; object?: unknown }
      | null;
    if (!body || typeof body.id !== 'string' || typeof body.url !== 'string') {
      throw new Error('STRIPE_RESPONSE_INVALID');
    }
    return { id: body.id, url: body.url };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
    if (!/^sub_[A-Za-z0-9]{8,}$/.test(subscriptionId)) throw new Error('STRIPE_SUBSCRIPTION_ID_INVALID');
    const response = await this.request(`${STRIPE_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) throw await this.parseError(response);
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.id !== 'string') throw new Error('STRIPE_RESPONSE_INVALID');
    return mapStripeSubscription(body);
  }

  async setSubscriptionCancelAtPeriodEnd(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<StripeSubscription> {
    if (!/^sub_[A-Za-z0-9]{8,}$/.test(subscriptionId)) throw new Error('STRIPE_SUBSCRIPTION_ID_INVALID');
    const form = new URLSearchParams({ cancel_at_period_end: cancelAtPeriodEnd ? 'true' : 'false' });
    const response = await this.request(`${STRIPE_API_BASE}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'POST',
      headers: this.headers(),
      body: form.toString(),
    });
    if (!response.ok) throw await this.parseError(response);
    const body = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.id !== 'string') throw new Error('STRIPE_RESPONSE_INVALID');
    return mapStripeSubscription(body);
  }

  /**
   * Verifies the Stripe-Signature header against the raw request body and
   * returns the parsed event. Throws STRIPE_WEBHOOK_* errors on any mismatch.
   */
  static verifyWebhookSignature(
    rawBody: string | Buffer | Uint8Array,
    signatureHeader: string,
    endpointSecret: string,
    options: { toleranceSeconds?: number; nowSeconds?: number } = {},
  ): StripeWebhookEvent {
    if (!signatureHeader || typeof signatureHeader !== 'string' ||
        !endpointSecret || typeof endpointSecret !== 'string' || endpointSecret.length < 16) {
      throw new Error('STRIPE_WEBHOOK_SIGNATURE_INVALID');
    }
    const entries = new Map<string, string[]>();
    for (const element of signatureHeader.split(',')) {
      const trimmed = element.trim();
      const separator = trimmed.indexOf('=');
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1);
      const list = entries.get(key) ?? [];
      list.push(value);
      entries.set(key, list);
    }
    const timestamp = entries.get('t')?.[0];
    const signatures = entries.get('v1') ?? [];
    if (!timestamp || !/^\d{1,14}$/.test(timestamp) || signatures.length === 0) {
      throw new Error('STRIPE_WEBHOOK_SIGNATURE_INVALID');
    }
    const payloadText = typeof rawBody === 'string'
      ? rawBody
      : Buffer.from(rawBody as unknown as Uint8Array).toString('utf8');
    const signedPayload = `${timestamp}.${payloadText}`;
    const expected = crypto.createHmac('sha256', endpointSecret).update(signedPayload).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const matched = signatures.some(signature => {
      if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
      const provided = Buffer.from(signature, 'utf8');
      return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
    });
    if (!matched) throw new Error('STRIPE_WEBHOOK_SIGNATURE_INVALID');
    const tolerance = options.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS;
    if (tolerance <= 0) throw new Error('STRIPE_WEBHOOK_TOLERANCE_INVALID');
    const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > tolerance) {
      throw new Error('STRIPE_WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE');
    }
    let event: unknown;
    try {
      event = JSON.parse(payloadText);
    } catch {
      throw new Error('STRIPE_WEBHOOK_PAYLOAD_INVALID');
    }
    const candidate = event as { id?: unknown; type?: unknown; data?: { object?: unknown } };
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.type !== 'string' ||
        !candidate.data || typeof candidate.data !== 'object' ||
        !candidate.data.object || typeof candidate.data.object !== 'object') {
      throw new Error('STRIPE_WEBHOOK_PAYLOAD_INVALID');
    }
    return {
      id: candidate.id,
      type: candidate.type,
      data: { object: candidate.data.object as Record<string, unknown> },
    };
  }
}

export function mapStripeSubscription(body: Record<string, unknown>): StripeSubscription {
  const toIso = (value: unknown): string | null =>
    typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
  const metadata: Record<string, string> = {};
  if (body.metadata && typeof body.metadata === 'object') {
    for (const [key, value] of Object.entries(body.metadata as Record<string, unknown>)) {
      if (typeof value === 'string') metadata[key] = value;
    }
  }
  return {
    id: typeof body.id === 'string' ? body.id : '',
    status: typeof body.status === 'string' ? body.status : 'incomplete',
    cancelAtPeriodEnd: body.cancel_at_period_end === true,
    canceledAt: toIso(body.canceled_at),
    currentPeriodStart: toIso(body.current_period_start),
    currentPeriodEnd: toIso(body.current_period_end),
    metadata,
  };
}

/** Maps Stripe subscription statuses onto the merchant_subscriptions enum. */
export function mapStripeStatus(status: string): string {
  switch (status) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'unpaid': return 'past_due';
    case 'canceled': return 'canceled';
    case 'paused': return 'paused';
    case 'incomplete': return 'incomplete';
    case 'incomplete_expired': return 'expired';
    default: return 'incomplete';
  }
}
