import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Webhook] Product updated', req.body);
  res.status(200).send('Product synced.');
}
