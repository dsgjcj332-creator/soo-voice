import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireApiKey } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    const status = req.query.status as string;
    const limit = req.query.limit as string;
    const maxLimit = Math.min(parseInt(limit) || 50, 200);

    // Placeholder conversations response for Supabase-only mode
    const conversations: any[] = [];
    if (status && status !== 'All') {
      // filter placeholder
    }
    const sorted = conversations.sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, maxLimit);
    res.status(200).json({ conversations: sorted, total: sorted.length });
  } catch (err) {
    console.error('[API] Conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}
