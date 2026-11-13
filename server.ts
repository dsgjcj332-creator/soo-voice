import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createApiApp } from './src/lib/api';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Middleware to parse JSON bodies
  app.use(express.json());

  // ==========================================
  // UNIFIED API (same Express app used in Vercel production via api/[...slug].ts)
  // Routes inside createApiApp() are already defined with the /api prefix,
  // so it is mounted WITHOUT a path prefix.
  // ==========================================
  app.use(createApiApp());

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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.type('application/javascript').send(`
          const noop = () => {};
          export function createHotContext() {
            return {
              accept: noop,
              dispose: noop,
              prune: noop,
              decline: noop,
              invalidate: noop,
              on: noop,
              send: noop,
            };
          }
          export function updateStyle() {}
          export function removeStyle() {}
        `);
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
    console.log(`Backend API endpoints are ready at /api/*`);
  });
}

startServer();
