/**
 * Unified API entry for the Vercel catch-all function.
 *
 * The source of truth is the Express-style app in src/lib/api.ts. This file
 * is bundled to api/[...slug].js by scripts/bundle-api.mjs (see that file
 * for why the bundle must be prebuilt CJS).
 */
import { createApiApp } from '../src/lib/api';

const app = createApiApp();

export default function handler(req: any, res: any) {
  app(req, res);
}
