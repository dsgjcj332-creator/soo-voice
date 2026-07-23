import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createApiApp } from './src/lib/api';

async function startServer() {
  const app = createApiApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // VITE MIDDLEWARE (Handles frontend React app) - DEV ONLY
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints: /api/analytics, /api/conversations, /api/orders, /api/webhook-settings, /api/health`);
  });
}

if (!process.env.NETLIFY) {
  startServer();
}
