import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Middleware to parse JSON bodies
  app.use(express.json());

  // ==========================================
  // REAL APP STORE WEBHOOKS & OAUTH SIMULATION
  // ==========================================

  // 1. Shopify/Salla App Install Auth Callback
  app.get('/api/oauth/callback', (req, res) => {
    const { code, shop, platform } = req.query;
    console.log(`[OAuth] Received auth code from ${platform} for shop ${shop}`);
    // Here we would exchange 'code' for a permanent 'access_token'
    // Then save it to the database for this merchant.
    res.json({ success: true, message: "OAuth token exchanged successfully. You can now close this window." });
  });

  // 2. Webhook: When the user Uninstalls the app
  // This is MANDATORY for Shopify/Salla app store approval
  app.post('/api/webhooks/app/uninstalled', (req, res) => {
    const shopData = req.body;
    console.log(`[Webhook] Mandatory GDPR/Data Erase: User uninstalled app`, shopData);
    // Delete store data/keys from DB here
    res.status(200).send('Webhook received and data queued for deletion.');
  });

  // 3. Webhook: Product creation/update 
  // Keeps the Knowledge Base in sync automatically!
  app.post('/api/webhooks/products/updated', (req, res) => {
    const productData = req.body;
    console.log(`[Webhook] Product updated. Updating AI Knowledge Base...`, productData);
    // Add product JSON to Knowledge Context
    res.status(200).send('Product synced with AI.');
  });

  // ==========================================
  // VITE MIDDLEWARE (Handles frontend React app)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    // The preview host does not expose a Vite WebSocket endpoint. Serve an
    // inert client for any cached HTML that still references the HMR module.
    app.use((req, res, next) => {
      if (req.url?.startsWith('/@vite/client')) {
        res.type('application/javascript').send('');
        return;
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Since Express 4.x we use catch-all for SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Backend API endpoints are ready for App Store webhooks!`);
  });
}

startServer();
