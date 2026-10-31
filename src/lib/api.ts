import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

export function createApiApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '2mb' }));

  const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    next();
  };

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

  // HEALTH CHECK
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ANALYTICS
  app.get('/api/analytics/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { range } = req.query;
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      const since = Date.now() - days * 24 * 60 * 60 * 1000;

      // Placeholder analytics response for Supabase-only mode
      res.json({
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
  });

  // CONVERSATIONS
  app.get('/api/conversations/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { status, limit } = req.query;
      const maxLimit = Math.min(parseInt(limit as string) || 50, 200);

      // Placeholder conversations response for Supabase-only mode
      const conversations: any[] = [];
      if (status && status !== 'All') {
        // filter placeholder
      }
      const sorted = conversations.sort((a: any, b: any) => b.createdAt - a.createdAt).slice(0, maxLimit);
      res.json({ conversations: sorted, total: sorted.length });
    } catch (err) {
      console.error('[API] Conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ORDERS
  app.get('/api/orders/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      // Placeholder orders response for Supabase-only mode
      const orders: any[] = [];
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
      // Placeholder update for Supabase-only mode
      res.json({ success: true, orderId, status });
    } catch (err) {
      console.error('[API] Order status update error:', err);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  app.delete('/api/orders/:orderId', requireApiKey, async (req, res) => {
    try {
      const { orderId } = req.params;
      // Placeholder delete for Supabase-only mode
      res.json({ success: true, orderId });
    } catch (err) {
      console.error('[API] Order delete error:', err);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // WEBHOOK SETTINGS
  app.get('/api/webhook-settings/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      // Placeholder webhook settings for Supabase-only mode
      res.json({ webhookUrl: '', webhookSecret: '' });
    } catch (err) {
      console.error('[API] Webhook settings error:', err);
      res.status(500).json({ error: 'Failed to fetch webhook settings' });
    }
  });

  // OAUTH & WEBHOOKS
  app.get('/api/oauth/callback', (req, res) => {
    const { code, shop, platform } = req.query;
    console.log(`[OAuth] Received auth code from ${platform} for shop ${shop}`);
    res.json({ success: true, message: 'OAuth token exchanged successfully.' });
  });

  app.post('/api/webhooks/app/uninstalled', (req, res) => {
    console.log('[Webhook] App uninstalled', req.body);
    res.status(200).send('Webhook received.');
  });

  app.post('/api/webhooks/products/updated', (req, res) => {
    console.log('[Webhook] Product updated', req.body);
    res.status(200).send('Product synced.');
  });

  app.post('/api/webhooks/orders/created', verifyWebhookSignature, (req, res) => {
    console.log('[Webhook] Order created', req.body);
    res.status(200).json({ success: true, message: 'Order webhook processed' });
  });

  // USERS
  app.get('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      // Placeholder user fetch for Supabase-only mode
      res.status(404).json({ error: 'User not found' });
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
      // Placeholder user update for Supabase-only mode
      res.json({ success: true, uid, ...updates });
    } catch (err) {
      console.error('[API] User update error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  return app;
}
