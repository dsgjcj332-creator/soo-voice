/**
 * Vercel serverless function — /api/health
 * Minimal endpoint with ZERO dependencies, so it can never fail to bundle.
 * Used to verify the serverless runtime itself is alive (and that any
 * other API error is downstream, not a Vercel function error).
 */
export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
}
