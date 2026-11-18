import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import type { PosCreateOrderInput, PosCreateOrderResult } from './types';

export interface CustomOrderWebhookCredentials {
  orderWebhookUrl: string;
  orderWebhookSecret: string;
}

export interface SignedWebhookRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type SignedWebhookTransport = (request: SignedWebhookRequest) => Promise<{
  statusCode: number;
  body: string;
}>;

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a, b, c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      return isIP(mapped) === 4 && isPublicAddress(mapped);
    }
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    // Only global-unicast 2000::/3 addresses are routable public destinations.
    if (firstHextet < 0x2000 || firstHextet > 0x3fff) return false;
    if (normalized.startsWith('2001:db8:')) return false;
    return true;
  }
  return false;
}

async function secureHttpsPost(request: SignedWebhookRequest): Promise<{ statusCode: number; body: string }> {
  const url = new URL(request.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.port && url.port !== '443' || !url.hostname || isIP(url.hostname) !== 0 ||
      url.hostname === 'localhost' || !url.hostname.includes('.')) {
    throw new Error('POS_WEBHOOK_URL_NOT_ALLOWED');
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => {
    throw new Error('POS_WEBHOOK_DNS_FAILED');
  });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) {
    throw new Error('POS_WEBHOOK_DESTINATION_NOT_PUBLIC');
  }
  const pinned = addresses[0];
  const pinnedLookup = ((_hostname: string, _options: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
    callback(null, pinned.address, isIP(pinned.address));
  }) as never;

  return new Promise((resolve, reject) => {
    const outgoing = https.request(url, {
      method: 'POST',
      headers: request.headers,
      lookup: pinnedLookup,
      timeout: 8_000,
    }, response => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 32_768) {
          outgoing.destroy(new Error('POS_WEBHOOK_RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        statusCode: response.statusCode || 0,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    outgoing.on('timeout', () => outgoing.destroy(new Error('POS_WEBHOOK_TIMEOUT')));
    outgoing.on('error', reject);
    outgoing.end(request.body);
  });
}

/**
 * Signed provider-neutral order delivery for a merchant-operated POS bridge.
 * A middleware translates this canonical payload to the vendor's own API.
 * Redirects are not followed and DNS is pinned to a verified public address.
 */
export async function sendCustomPosOrderWebhook(
  credentials: CustomOrderWebhookCredentials,
  input: PosCreateOrderInput,
  transport: SignedWebhookTransport = secureHttpsPost,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<PosCreateOrderResult> {
  if (!credentials || typeof credentials.orderWebhookUrl !== 'string' ||
      typeof credentials.orderWebhookSecret !== 'string' ||
      credentials.orderWebhookSecret.length < 32) {
    throw new Error('POS_ORDER_WEBHOOK_CREDENTIALS_MISSING');
  }
  const url = new URL(credentials.orderWebhookUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || isIP(url.hostname) !== 0 || !url.hostname.includes('.')) {
    throw new Error('POS_WEBHOOK_URL_NOT_ALLOWED');
  }
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 1) throw new Error('INVALID_WEBHOOK_TIMESTAMP');

  const body = JSON.stringify({
    version: 1,
    eventType: 'order.created',
    occurredAt: new Date(nowSeconds * 1000).toISOString(),
    idempotencyKey: input.idempotencyKey,
    order: {
      localOrderId: input.localOrderId,
      merchantId: input.merchantId,
      locationId: input.locationId,
      currency: input.currency,
      fulfillment: input.fulfillment,
      tableReference: input.tableReference ?? null,
      notes: input.notes ?? null,
      customer: input.customer ?? null,
      lines: input.lines,
    },
  });
  const timestamp = String(nowSeconds);
  const signature = createHmac('sha256', credentials.orderWebhookSecret)
    .update(timestamp, 'utf8').update('.', 'utf8').update(body, 'utf8').digest('hex');

  let response: { statusCode: number; body: string };
  try {
    response = await transport({
      url: url.toString(),
      headers: {
        'content-type': 'application/json',
        'x-soovoice-timestamp': timestamp,
        'x-soovoice-signature': `sha256=${signature}`,
        'x-soovoice-event-id': input.idempotencyKey,
        'x-soovoice-event-type': 'order.created',
        'idempotency-key': input.idempotencyKey,
      },
      body,
    });
  } catch (error) {
    const code = error instanceof Error && /^POS_[A-Z0-9_]+$/.test(error.message)
      ? error.message : 'POS_WEBHOOK_DELIVERY_FAILED';
    throw new Error(code);
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(response.statusCode >= 500 ? 'POS_WEBHOOK_REMOTE_UNAVAILABLE' : 'POS_WEBHOOK_REMOTE_REJECTED');
  }
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(response.body) as Record<string, unknown>;
  } catch {
    throw new Error('POS_WEBHOOK_INVALID_RESPONSE');
  }
  if (result.status === 'pending') throw new Error('POS_ACCEPTANCE_PENDING');
  if (result.status === 'rejected') throw new Error('POS_ORDER_REJECTED');
  if (result.status !== 'accepted' || typeof result.providerOrderId !== 'string' ||
      !result.providerOrderId.trim() || result.providerOrderId.length > 200) {
    throw new Error('POS_WEBHOOK_INVALID_RESPONSE');
  }
  return { status: 'accepted', providerOrderId: result.providerOrderId.trim(), acceptedAt: new Date(nowSeconds * 1000).toISOString() };
}
