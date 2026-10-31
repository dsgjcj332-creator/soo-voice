import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireApiKey } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    // Placeholder webhook settings for Supabase-only mode
    res.status(200).json({ webhookUrl: '', webhookSecret: '' });
  } catch (err) {
    console.error('[API] Webhook settings error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook settings' });
  }
}
