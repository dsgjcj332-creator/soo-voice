import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, requireApiKey } from '../_lib';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    const status = req.query.status as string;
    const limit = req.query.limit as string;
    const maxLimit = Math.min(parseInt(limit) || 50, 200);

    const q = query(collection(db, 'conversations'), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    let conversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (status && status !== 'All') {
      conversations = conversations.filter((c: any) => c.status === status);
    }

    conversations.sort((a: any, b: any) => b.createdAt - a.createdAt);
    conversations = conversations.slice(0, maxLimit);

    res.status(200).json({ conversations, total: conversations.length });
  } catch (err) {
    console.error('[API] Conversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
}
