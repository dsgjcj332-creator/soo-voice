import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export function requireApiKey(req: VercelRequest, res: VercelResponse): boolean {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    return false;
  }
  return true;
}

export function verifyWebhookSignature(req: VercelRequest, res: VercelResponse): boolean {
  const signature = req.headers['x-voiceai-signature'] as string;
  if (!signature || !signature.startsWith('sha256=')) {
    res.status(401).json({ error: 'Missing or invalid signature' });
    return false;
  }
  const expectedSig = signature.slice(7);
  const payload = JSON.stringify(req.body);
  const webhookSecret = process.env.WEBHOOK_SECRET || '';
  const computedSig = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  if (computedSig !== expectedSig) {
    res.status(401).json({ error: 'Signature verification failed' });
    return false;
  }
  return true;
}
