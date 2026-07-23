import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWebhookSignature } from '../../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyWebhookSignature(req, res)) return;
  console.log('[Webhook] Order created', req.body);
  res.status(200).json({ success: true, message: 'Order webhook processed' });
}
