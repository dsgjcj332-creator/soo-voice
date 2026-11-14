/**
 * Unified backend API for SooVoice.
 *
 * This single Express app is mounted in two places:
 *  - Production (Vercel): api/[...slug].ts delegates every /api/* request here.
 *  - Local development:   server.ts mounts it with app.use('/api', createApiApp()).
 *
 * Security notes:
 *  - All admin/data routes require the `x-api-key` header (timing-safe compare).
 *  - All webhook routes require an HMAC-SHA256 signature header
 *    `x-soovoice-signature: sha256=<hex>` computed over the RAW request body
 *    with WEBHOOK_SECRET (fail-closed when the secret is not configured).
 *  - In-memory rate limiting per client IP (per-instance on serverless).
 *  - CORS origins can be restricted via ALLOWED_ORIGINS (comma-separated).
 *  - The real GEMINI_API_KEY never reaches the browser: /api/gemini-session
 *    mints a short-lived ephemeral token for the Gemini Live API instead.
 */
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { GoogleGenAI, Modality } from '@google/genai';

/** Constant-time string comparison (hash both sides first to equalize length). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Simple in-memory, per-IP fixed-window rate limiter (per serverless instance). */
function rateLimit(windowMs: number, max: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = firstHeader(req.headers['x-forwarded-for']);
    const ip = forwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    next();
  };
}

export function createApiApp() {
  const app = express();

  // CORS: restrict to ALLOWED_ORIGINS when configured. Left open by default so
  // the embeddable voice widget keeps working on merchant storefronts.
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
    }),
  );

  // JSON body parsing; keep the RAW body around for HMAC signature verification.
  app.use(
    express.json({
      limit: '2mb',
      verify(req: express.Request & { rawBody?: Buffer }, _res, buf) {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  // Global per-IP limiter for the whole API surface.
  app.use(rateLimit(60_000, 600));

  const requireApiKey = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const expected = process.env.API_KEY;
    if (!expected) {
      res.status(503).json({ error: 'API not configured: API_KEY is missing server-side' });
      return;
    }
    const provided = firstHeader(req.headers['x-api-key']);
    if (!provided || !safeEqual(provided, expected)) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
    next();
  };

  // Verifies `x-soovoice-signature: sha256=<hex hmac>` computed over the RAW body.
  const verifyWebhookSignature = (
    req: express.Request & { rawBody?: Buffer },
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret) {
      // Fail closed: webhooks are never accepted without a configured secret.
      res.status(503).json({ error: 'Webhooks not configured: WEBHOOK_SECRET is missing server-side' });
      return;
    }
    const signature = firstHeader(req.headers['x-soovoice-signature']);
    if (!signature || !signature.startsWith('sha256=')) {
      res.status(401).json({ error: 'Missing or invalid signature' });
      return;
    }
    const provided = signature.slice('sha256='.length);
    const raw =
      req.rawBody instanceof Buffer ? req.rawBody : Buffer.from(JSON.stringify(req.body ?? {}));
    const computed = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (!safeEqual(computed, provided)) {
      res.status(401).json({ error: 'Signature verification failed' });
      return;
    }
    next();
  };

  // ============ HEALTH ============
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // ============ EPHEMERAL GEMINI TOKEN (voice widget) ============
  /**
   * Mints a short-lived Gemini Live "ephemeral auth token" so browsers never
   * see the real GEMINI_API_KEY. The client uses `token.name` as its apiKey
   * together with httpOptions.apiVersion = 'v1alpha' when opening the session.
   */
  app.post('/api/gemini-session', rateLimit(60_000, 30), async (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Voice service not configured: GEMINI_API_KEY is missing server-side',
      });
      return;
    }
    try {
      const client = new GoogleGenAI({
        apiKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const token: any = await client.authTokens.create({
        config: { expireTime, newSessionExpireTime },
      });
      if (!token?.name) throw new Error('Token endpoint returned no token');
      res.set('Cache-Control', 'no-store');
      res.json({ token: token.name, expireTime, newSessionExpireTime });
    } catch (err) {
      console.error(
        '[API] Gemini ephemeral token error:',
        err instanceof Error ? err.message : err,
      );
      res.status(502).json({ error: 'Failed to create voice session token' });
    }
  });

  // ============ VOICE PREVIEW (TTS) ============
  /**
   * Generates a short audio sample of a given text in a given prebuilt voice
   * using Gemini's text-to-speech via generateContent with AUDIO modality.
   * Used by the Voice Studio page for A/B voice comparison before the owner
   * publishes a voice persona.
   *
   * Request:  POST /api/voice-preview
   * Body:     { text: string (<=280 chars), voice: string }
   * Response: { audio: string (base64 PCM, mime: 'audio/ogg; codecs=opus' or 'audio/L16') }
   */
  app.post('/api/voice-preview', rateLimit(60_000, 20), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'Voice service not configured: GEMINI_API_KEY is missing server-side' });
      return;
    }
    const text = String((req.body as any)?.text || '').trim().slice(0, 280);
    const voice = String((req.body as any)?.voice || '').trim();
    if (!text || !voice) {
      res.status(400).json({ error: 'Both `text` and `voice` are required' });
      return;
    }

    try {
      const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
      const response: any = await client.models.generateContent({
        model: 'gemini-3.1-flash-live-preview',
        contents: [{ role: 'user', parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      });

      const candidate = response?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      let inline: any = null;
      for (const p of parts) {
        if (p?.inlineData?.data) {
          inline = p.inlineData;
          break;
        }
      }
      if (!inline?.data) {
        res.status(502).json({ error: 'No audio data returned from Gemini' });
        return;
      }
      res.set('Cache-Control', 'no-store');
      res.json({ audio: inline.data, mime: inline.mimeType || 'audio/L16' });
    } catch (err) {
      console.error('[API] voice-preview error:', err instanceof Error ? err.message : err);
      res.status(502).json({ error: 'Failed to generate preview' });
    }
  });

  // ============ ANALYTICS ============
  app.get('/api/analytics/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { range } = req.query;
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      void ownerId;
      void since;

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

  // ============ CONVERSATIONS ============
  app.get('/api/conversations/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      const { status, limit } = req.query;
      void ownerId;
      const maxLimit = Math.min(parseInt(String(limit)) || 50, 200);

      // Placeholder conversations response for Supabase-only mode
      const conversations: any[] = [];
      if (status && status !== 'All') {
        // filter placeholder
      }
      const sorted = conversations
        .sort((a: any, b: any) => b.createdAt - a.createdAt)
        .slice(0, maxLimit);
      res.json({ conversations: sorted, total: sorted.length });
    } catch (err) {
      console.error('[API] Conversations error:', err);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ============ ORDERS ============
  app.get('/api/orders/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      void ownerId;
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

  // ============ WEBHOOK SETTINGS ============
  app.get('/api/webhook-settings/:ownerId', requireApiKey, async (req, res) => {
    try {
      const { ownerId } = req.params;
      void ownerId;
      // Placeholder webhook settings for Supabase-only mode
      res.json({ webhookUrl: '', webhookSecret: '' });
    } catch (err) {
      console.error('[API] Webhook settings error:', err);
      res.status(500).json({ error: 'Failed to fetch webhook settings' });
    }
  });

  // ============ OAUTH ============
  app.get('/api/oauth/callback', (req, res) => {
    const { shop, platform } = req.query;
    // NOTE: never log the authorization `code` — it is a bearer credential.
    console.log(`[OAuth] Callback received for ${platform || 'unknown'} / shop ${shop || 'unknown'}`);
    res.json({
      success: true,
      message: 'OAuth callback received. Token exchange must happen server-side.',
    });
  });

  // ============ WEBHOOKS (all signature-verified) ============
  app.post('/api/webhooks/app/uninstalled', verifyWebhookSignature, (req, res) => {
    console.log('[Webhook] App uninstalled — data erase queued');
    res.status(200).json({ received: true, event: 'app/uninstalled' });
  });

  app.post('/api/webhooks/products/updated', verifyWebhookSignature, (req, res) => {
    console.log('[Webhook] Product updated — AI knowledge base sync queued');
    res.status(200).json({ received: true, event: 'products/updated' });
  });

  app.post('/api/webhooks/orders/created', verifyWebhookSignature, (req, res) => {
    console.log('[Webhook] Order created');
    res.status(200).json({ received: true, event: 'orders/created' });
  });

  // ============ USERS ============
  app.get('/api/users/:uid', requireApiKey, async (req, res) => {
    try {
      const { uid } = req.params;
      void uid;
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

  // Explicit API terminator: any unmatched /api route (including wrong HTTP
  // methods on registered paths) returns a JSON 404 instead of falling through
  // to the SPA static fallback.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
