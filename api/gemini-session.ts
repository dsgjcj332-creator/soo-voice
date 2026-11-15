/**
 * Vercel serverless function — /api/gemini-session
 *
 * Mints a short-lived Gemini Live "ephemeral auth token" so browsers
 * never see the real GEMINI_API_KEY. The client uses `token.name` as
 * its apiKey together with httpOptions.apiVersion = 'v1alpha' when
 * opening the Live session.
 *
 * Standalone (no Express) — Express v4 is CommonJS but the project is
 * ESM ("type": "module"), and that ESM/CJS mismatch was causing Vercel
 * to crash the catch-all serverless function with
 * FUNCTION_INVOCATION_FAILED before any of our own code could even
 * run. A standalone function with only the @google/genai dependency
 * bundles cleanly and runs in the Vercel Node runtime.
 */
import { GoogleGenAI } from '@google/genai';

export const config = {
  maxDuration: 25,
};

export default async function handler(_req: any, res: any) {
  // Always JSON, never let Vercel render an HTML error page.
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 503;
    res.end(JSON.stringify({
      error: 'Voice service not configured: GEMINI_API_KEY is missing server-side',
    }));
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const token: any = await client.authTokens.create({
      config: { expireTime, newSessionExpireTime },
    });
    if (!token?.name) throw new Error('Token endpoint returned no token');
    res.statusCode = 200;
    res.end(JSON.stringify({ token: token.name, expireTime, newSessionExpireTime }));
  } catch (err: any) {
    // Surface the real cause so the merchant can diagnose from the
    // network tab instead of staring at a vague "500".
    console.error('[api/gemini-session] token error:', err?.message || err);
    res.statusCode = 502;
    res.end(JSON.stringify({
      error: 'Failed to create voice session token',
      detail: err?.message ? String(err.message).slice(0, 200) : undefined,
      // 403 usually means the free-tier key does not have Live API
      // access in this region, or the key is invalid. The frontend
      // shows `detail` to the merchant so they know which one it is.
      hint: err?.status === 403
        ? 'API key rejected (403). Check that the key is valid, the Gemini Live API is available in your region, and billing is enabled if needed.'
        : undefined,
    }));
  }
}
