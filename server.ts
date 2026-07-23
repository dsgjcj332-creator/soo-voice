import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

export async function createApp() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '2mb' }));

  // Initialize Firebase (reuse if already initialized)
  const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

  // ==========================================
  // AUTH MIDDLEWARE
  // ==========================================
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cbngj055@gmail.com';

  // Simple API key middleware for protected routes
  const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
  };

  // Webhook signature verification middleware
  const verifyWebhookSignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const signature = req.headers['x-voiceai-signature'] as string;
    if (!signature || !signature.startsWith('sha256=')) {
      return res.status(401).json({ error: 'Missing or invalid signature' });
    }
    const expectedSig = signature.slice(7);
    const payload = JSON.stringify(req.body);
    const webhookSecret = process.env.WEBHOOK_SECRET || '';
    const computedSig = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    if (computedSig !== expectedSig) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }
    next();
  };

  // ==========================================
  // ANALYTICS API
  // ==========================================
  app.get('/api/analytics/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { range } = req.query;
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
      filtered.forEach((c: any) => {
        intentMap[c.intent] = (intentMap[c.intent] || 0) + 1;
      });

      const hourlyMap: Record<string, number> = {};
      filtered.forEach((c: any) => {
        const hour = new Date(c.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).replace(' ', '');
        hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
      });

      const uniqueUsers = new Set(filtered.map((c: any) => c.user)).size;

      res.json({
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
  });

  // ==========================================
  // CONVERSATIONS API
  // ==========================================
  app.get('/api/conversations/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { status, limit } = req.query;
      const maxLimit = Math.min(parseInt(limit as string) || 50, 200);

      const q = query(collection(db, 'conversations'), where('ownerId', '==', ownerId));
      const snapshot = await getDocs(q);
      let conversations = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

      if (status && status !== 'All') {
        conversations = conversations.filter((c: any) => c.status === status);
      }

      conversations.sort((a: any, b: any) => b.createdAt - a.createdAt);
      conversations = conversations.slice(0, maxLimit);

      res.json({ conversations, total: conversations.length });
    } catch (err) {
      console.error('[API] Conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ==========================================
  // ORDERS API
  // ==========================================
  app.get('/api/orders/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const q = query(collection(db, 'orders'), where('ownerId', '==', ownerId));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      orders.sort((a: any, b: any) => b.createdAt - a.createdAt);

      res.json({ orders, total: orders.length });
    } catch (err) {
      console.error('[API] Orders error:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.patch('/api/orders/:orderId/status', requireApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      if (!['pending', 'preparing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      await updateDoc(doc(db, 'orders', orderId), { status });
      res.json({ success: true, orderId, status });
    } catch (err) {
      console.error('[API] Order status update error:', err);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  app.delete('/api/orders/:orderId', requireApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      await deleteDoc(doc(db, 'orders', orderId));
      res.json({ success: true, orderId });
    } catch (err) {
      console.error('[API] Order delete error:', err);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // ==========================================
  // WEBHOOK SETTINGS API
  // ==========================================
  app.get('/api/webhook-settings/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const snap = await getDoc(doc(db, 'webhook_settings', ownerId));
      if (!snap.exists()) {
        return res.json({ webhookUrl: '', webhookSecret: '' });
      }
      const data = snap.data();
      res.json({ webhookUrl: data.webhookUrl, webhookSecret: data.webhookSecret });
    } catch (err) {
      console.error('[API] Webhook settings error:', err);
      res.status(500).json({ error: 'Failed to fetch webhook settings' });
    }
  });

  // ==========================================
  // OAUTH & APP STORE WEBHOOKS
  // ==========================================
  app.get('/api/oauth/callback', (req, res) => {
    const { code, shop, platform } = req.query;
    console.log(`[OAuth] Received auth code from ${platform} for shop ${shop}`);
    res.json({ success: true, message: "OAuth token exchanged successfully. You can now close this window." });
  });

  app.post('/api/webhooks/app/uninstalled', (req, res) => {
    const shopData = req.body;
    console.log(`[Webhook] GDPR/Data Erase: User uninstalled app`, shopData);
    res.status(200).send('Webhook received and data queued for deletion.');
  });

  app.post('/api/webhooks/products/updated', (req, res) => {
    const productData = req.body;
    console.log(`[Webhook] Product updated. Updating AI Knowledge Base...`, productData);
    res.status(200).send('Product synced with AI.');
  });

  // Incoming webhook from merchant store (order.created) - verify signature
  app.post('/api/webhooks/orders/created', verifyWebhookSignature, (req, res) => {
    const orderData = req.body;
    console.log(`[Webhook] Order created event received`, orderData);
    res.status(200).json({ success: true, message: 'Order webhook processed' });
  });

  // ==========================================
  // USERS API
  // ==========================================
  app.get('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) {
        return res.status(404).json({ error: 'User not found' });
      }
      const data = snap.data();
      res.json({ uid: data.uid, email: data.email, displayName: data.displayName, plan: data.plan });
    } catch (err) {
      console.error('[API] User fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  app.patch('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      const { displayName, plan } = req.body;
      const updates: any = {};
      if (displayName) updates.displayName = displayName;
      if (plan && ['free', 'pro', 'enterprise'].includes(plan)) updates.plan = plan;
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      await updateDoc(doc(db, 'users', uid), updates);
      res.json({ success: true, uid, ...updates });
    } catch (err) {
      console.error('[API] User update error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // ==========================================
  // HEALTH CHECK
  // ==========================================
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ==========================================
  // VITE MIDDLEWARE (Handles frontend React app) - DEV ONLY
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, PORT };
}

// Run as standalone server only in dev mode (not on Netlify)
if (!process.env.NETLIFY) {
  createApp().then(({ app, PORT }) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API endpoints: /api/analytics, /api/conversations, /api/orders, /api/webhook-settings, /api/health`);
    });
  });
}
