import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireApiKey } from '../_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    const range = req.query.range as string;
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Placeholder analytics response for Supabase-only mode
    res.status(200).json({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      conversionRate: 0,
      activeUsers: 0,
      intentDistribution: [],
      peakHours: [],
      satisfactionScore: 0,
    });
  } catch (err) {
    console.error('[API] Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
