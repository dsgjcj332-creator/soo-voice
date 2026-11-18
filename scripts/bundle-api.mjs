/**
 * Bundles the unified API catch-all (api/entry.ts -> api/[...slug].js).
 *
 * Why: the Vercel Node runtime compiles api/[...slug].ts but keeps the
 * import graph as extensionless ESM, which real Node cannot resolve
 * (and Express v4 is CommonJS while this project is ESM). A single
 * self-contained CJS bundle removes both failure modes.
 *
 * Runs as part of `npm run build`, before Vercel packages functions.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['api/entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'api/[...slug].js',
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none',
  minify: false,
});
