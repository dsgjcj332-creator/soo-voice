/**
 * Vercel catch-all for the unified API.
 *
 * The production runtime is Vercel's own Node runtime; we only need minimal
 * request/response types here, so the heavy `@vercel/node` package is not
 * required as a project dependency.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../src/lib/api';

const app = createApiApp();

export default function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse,
) {
  app(req as any, res as any);
}
