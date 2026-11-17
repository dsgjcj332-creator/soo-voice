import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD_PREFIX = 'soovoice:pos-credentials:';

export interface EncryptedPosCredentials {
  /** Versioned envelope: v1.<base64url iv>.<base64url auth tag>.<base64url ciphertext> */
  ciphertext: string;
  keyVersion: string;
}

function configuredKey(): { key: Buffer; version: string } {
  const encoded = process.env.POS_CREDENTIALS_ENCRYPTION_KEY;
  const version = process.env.POS_CREDENTIALS_ENCRYPTION_KEY_VERSION || 'v1';
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
    throw new Error('POS_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('POS_CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(version)) {
    throw new Error('POS_CREDENTIALS_ENCRYPTION_KEY_VERSION is invalid');
  }
  return { key, version };
}

function validateCredentials(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('POS credentials must be a JSON object');
  }
  const serialized = JSON.stringify(value);
  if (!serialized || serialized === '{}') {
    throw new Error('POS credentials must not be empty');
  }
}

/**
 * Server-only AES-256-GCM encryption for provider credentials.
 * Never call this from browser code and never log plaintext credentials.
 */
export function encryptPosCredentials(credentials: Record<string, unknown>): EncryptedPosCredentials {
  validateCredentials(credentials);
  const { key, version } = configuredKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(AAD_PREFIX + version, 'utf8'));
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    keyVersion: version,
    ciphertext: [version, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.'),
  };
}

/**
 * Decrypts only envelopes written with the currently configured key version.
 * A version mismatch fails closed; rotation must retain an explicit key ring.
 */
export function decryptPosCredentials(
  envelope: string,
  storedKeyVersion: string,
): Record<string, unknown> {
  const { key, version } = configuredKey();
  if (!storedKeyVersion || storedKeyVersion !== version) {
    throw new Error('POS credential key version is unavailable');
  }
  const parts = typeof envelope === 'string' ? envelope.split('.') : [];
  if (parts.length !== 4 || parts[0] !== version) {
    throw new Error('POS credential envelope is invalid');
  }
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const encrypted = Buffer.from(parts[3], 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || encrypted.length === 0) {
      throw new Error('invalid envelope lengths');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from(AAD_PREFIX + version, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const parsed: unknown = JSON.parse(plaintext);
    validateCredentials(parsed);
    return parsed;
  } catch {
    throw new Error('POS credentials could not be decrypted');
  }
}
