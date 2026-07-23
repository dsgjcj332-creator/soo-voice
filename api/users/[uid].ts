import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, requireApiKey } from '../_lib';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { uid } = req.query;

  if (req.method === 'GET') {
    if (!requireApiKey(req, res)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid as string));
      if (!snap.exists()) {
        return res.status(404).json({ error: 'User not found' });
      }
      const data = snap.data();
      res.status(200).json({ uid: data.uid, email: data.email, displayName: data.displayName, plan: data.plan });
    } catch (err) {
      console.error('[API] User fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    if (!requireApiKey(req, res)) return;
    try {
      const { displayName, plan } = req.body;
      const updates: any = {};
      if (displayName) updates.displayName = displayName;
      if (plan && ['free', 'pro', 'enterprise'].includes(plan)) updates.plan = plan;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      await updateDoc(doc(db, 'users', uid as string), updates);
      res.status(200).json({ success: true, uid, ...updates });
    } catch (err) {
      console.error('[API] User update error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
