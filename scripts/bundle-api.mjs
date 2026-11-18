/**
 * Pre-bundles every Vercel API function as self-contained CJS.
 *
 * Why: the Vercel Node runtime compiles api/*.ts but keeps the import graph
 * as extensionless ESM, which real Node cannot resolve (and Express v4 is
 * CommonJS while this project is ESM). Sources live in api/src/ and every
 * function under api/ is generated here as one self-contained CJS bundle
 * with zero relative imports. Runs as part of `npm run build`, before Vercel
 * packages functions.
 */
import { build } from 'esbuild';

// Static functions: one bundle each, mirroring the api/src tree layout.
await build({
  entryPoints: [
    'api-src/health.ts',
    'api-src/gemini-session.ts',
    'api-src/voice-preview.ts',
    'api-src/store/orders.ts',
    'api-src/store/orders/[orderId].ts',
  ],
  outbase: 'api-src',
  outdir: 'api',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'warning',
  legalComments: 'none',
  minify: false,
});

// Unified catch-all: one self-contained CJS bundle.
await build({
  entryPoints: ['api-src/catch-all.ts'],
  outfile: 'api/[...slug].js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none',
  minify: false,
});
