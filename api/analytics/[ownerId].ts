import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, requireApiKey } from '../_lib';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    const range = req.query.range as string;
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const q = query(collection(db, 'conversations'), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    const conversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const filtered = conversations.filter((c: any) => c.createdAt >= since);

    const totalCalls = filtered.length;
    const successfulCalls = filtered.filter((c: any) => c.isSuccess).length;
    const conversionRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

    const intentMap: Record<string, number> = {};
    filtered.forEach((c: any) => { intentMap[c.intent] = (intentMap[c.intent] || 0) + 1; });

    const hourlyMap: Record<string, number> = {};
    filtered.forEach((c: any) => {
      const hour = new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
    });

    const uniqueUsers = new Set(filtered.map((c: any) => c.user)).size;

    res.status(200).json({
      totalCalls,
      successfulCalls,
      failedCalls: totalCalls - successfulCalls,
      conversionRate,
      activeUsers: uniqueUsers,
      intentDistribution: Object.entries(intentMap).map(([name, value]) => ({ name, value })),
      peakHours: Object.entries(hourlyMap).map(([hour, calls]) => ({ hour, calls })),
      satisfactionScore: conversionRate,
    });
  } catch (err) {
    console.error('[API] Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
