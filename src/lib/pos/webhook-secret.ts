import { randomBytes } from 'node:crypto';
import { decryptPosCredentials, encryptPosCredentials } from './credentials';

export interface RotatedPosWebhookSecret {
  secret: string;
  ciphertext: string;
  keyVersion: string;
}

/** Replace only the webhook secret while preserving all other encrypted provider credentials. */
export function rotatePosWebhookSecret(envelope: string, keyVersion: string): RotatedPosWebhookSecret {
  const credentials = decryptPosCredentials(envelope, keyVersion);
  const secret = randomBytes(32).toString('base64url');
  const encrypted = encryptPosCredentials({ ...credentials, webhookSecret: secret });
  return { secret, ciphertext: encrypted.ciphertext, keyVersion: encrypted.keyVersion };
}
