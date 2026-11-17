import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 300;
const MAX_TIMESTAMP_LENGTH = 16;

export interface PosWebhookSignatureInput {
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: Uint8Array;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

/** Verify HMAC-SHA256 over "<unix-seconds>.<raw-body>" with bounded clock skew. */
export function verifyPosWebhookSignature(input: PosWebhookSignatureInput): boolean {
  const { timestamp, signature, rawBody, secret } = input;
  if (!secret || secret.length < 32 || !timestamp || timestamp.length > MAX_TIMESTAMP_LENGTH ||
      !/^\d{10,16}$/.test(timestamp) || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isSafeInteger(timestampSeconds) || !Number.isFinite(nowSeconds) ||
      !Number.isInteger(tolerance) || tolerance < 1 || tolerance > 3600 ||
      Math.abs(nowSeconds - timestampSeconds) > tolerance) return false;

  const expected = createHmac('sha256', secret)
    .update(timestamp, 'utf8')
    .update('.', 'utf8')
    .update(rawBody)
    .digest();
  const provided = Buffer.from(signature.slice('sha256='.length), 'hex');
  return provided.length === expected.length && timingSafeEqual(expected, provided);
}

export function signPosWebhookForTest(rawBody: Uint8Array, timestamp: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret)
    .update(timestamp, 'utf8').update('.', 'utf8').update(rawBody).digest('hex');
}
