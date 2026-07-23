import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, requireApiKey } from '../_lib';
import { doc, getDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiKey(req, res)) return;

  try {
    const { ownerId } = req.query;
    const snap = await getDoc(doc(db, 'webhook_settings', ownerId as string));
    if (!snap.exists()) {
      return res.status(200).json({ webhookUrl: '', webhookSecret: '' });
    }
    const data = snap.data();
    res.status(200).json({ webhookUrl: data.webhookUrl, webhookSecret: data.webhookSecret });
  } catch (err) {
    console.error('[API] Webhook settings error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook settings' });
  }
}
