import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, requireApiKey } from '../_lib';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (!requireApiKey(req, res)) return;
    try {
      const { ownerId } = req.query;
      const q = query(collection(db, 'orders'), where('ownerId', '==', ownerId));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      orders.sort((a: any, b: any) => b.createdAt - a.createdAt);
      res.status(200).json({ orders, total: orders.length });
    } catch (err) {
      console.error('[API] Orders error:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    if (!requireApiKey(req, res)) return;
    try {
      const { orderId: id } = req.query;
      const { status } = req.body;
      if (!['pending', 'preparing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      await updateDoc(doc(db, 'orders', id as string), { status });
      res.status(200).json({ success: true, orderId: id, status });
    } catch (err) {
      console.error('[API] Order status update error:', err);
      res.status(500).json({ error: 'Failed to update order status' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    if (!requireApiKey(req, res)) return;
    try {
      const { orderId: id } = req.query;
      await deleteDoc(doc(db, 'orders', id as string));
      res.status(200).json({ success: true, orderId: id });
    } catch (err) {
      console.error('[API] Order delete error:', err);
      res.status(500).json({ error: 'Failed to delete order' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
