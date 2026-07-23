import { createApiApp } from './src/lib/api';

const app = createApiApp();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints: /api/analytics, /api/conversations, /api/orders, /api/webhook-settings, /api/health`);
});
